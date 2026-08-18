import React, { useState, useEffect } from 'react';
import { X, Mail, Calendar, Send, Plus, RefreshCw, Clock, ExternalLink, Inbox, Search, CheckCircle2 } from 'lucide-react';
import { CalendarEventItem, GmailMessageSummary, GmailMessageDetail } from '../types';
import { TauriBridge } from '../services/tauriBridge';

interface GoogleIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleToken?: string;
  googleRefreshToken?: string;
  onSaveTokens: (accessToken: string, refreshToken?: string) => void;
}

export const GoogleIntegrationModal: React.FC<GoogleIntegrationModalProps> = ({
  isOpen,
  onClose,
  googleToken = '',
  googleRefreshToken = '',
  onSaveTokens,
}) => {
  const [token, setToken] = useState(googleToken);
  const [refreshToken, setRefreshToken] = useState(googleRefreshToken);
  const [activeTab, setActiveTab] = useState<'inbox' | 'gmail' | 'calendar'>('inbox');
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Email form state
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Calendar form state
  const [eventTitle, setEventTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  const loadInbox = async (q?: string) => {
    if (!token.trim()) return;
    setIsLoading(true);
    try {
      const list = await TauriBridge.gmailListMessages({
        access_token: token.trim(),
        query: q || undefined,
        max_results: 12,
      });
      setMessages(list);
    } catch (e) {
      console.error('Inbox error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCalendarEvents = async () => {
    if (!token.trim()) return;
    setIsLoading(true);
    try {
      const data = await TauriBridge.calendarListEvents(token.trim(), 10);
      setEvents(data);
    } catch (e) {
      console.error('Calendar error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReadMessage = async (msgId: string) => {
    if (!token.trim()) return;
    setIsLoading(true);
    try {
      const detail = await TauriBridge.gmailReadMessage({
        access_token: token.trim(),
        message_id: msgId,
      });
      setSelectedMessage(detail);
    } catch (e: any) {
      setStatusMsg(`Read error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken) {
      setToken(googleToken);
    }
    if (googleRefreshToken) {
      setRefreshToken(googleRefreshToken);
    }
  }, [googleToken, googleRefreshToken, isOpen]);

  useEffect(() => {
    if (isOpen && token.trim()) {
      if (activeTab === 'inbox') loadInbox();
      if (activeTab === 'calendar') loadCalendarEvents();
    }
  }, [isOpen, token, activeTab]);

  const handleSaveTokens = () => {
    onSaveTokens(token.trim(), refreshToken.trim() || undefined);
    setStatusMsg('Google Tokens saved! Persistent auto-sync is active.');
    if (activeTab === 'inbox') loadInbox();
    if (activeTab === 'calendar') loadCalendarEvents();
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim() || !subject.trim() || !body.trim()) return;

    setIsLoading(true);
    try {
      const res = await TauriBridge.gmailSendMessage({
        access_token: token.trim(),
        to: toEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      setStatusMsg(res.message);
      setToEmail('');
      setSubject('');
      setBody('');
    } catch (err: any) {
      setStatusMsg(`Email error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !startTime || !endTime) return;

    setIsLoading(true);
    try {
      const res = await TauriBridge.calendarAddEvent({
        access_token: token.trim(),
        title: eventTitle.trim(),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        description: eventNotes.trim() || undefined,
      });
      setStatusMsg(res.message);
      setEventTitle('');
      setStartTime('');
      setEndTime('');
      setEventNotes('');
      await loadCalendarEvents();
    } catch (err: any) {
      setStatusMsg(`Calendar error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceBorder bg-slate-900/50">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Mail className="w-4 h-4 text-accent-rose" />
            <span>Google Suite (Gmail Full Access & Calendar)</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Token Management Card */}
        <div className="p-3 bg-slate-950/60 border-b border-surfaceBorder space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Google OAuth Credentials</span>
            {token && (
              <span className="flex items-center space-x-1 text-[10px] text-accent-emerald">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected & Saved</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Access Token (ya29...)</label>
              <input
                type="password"
                placeholder="ya29.a0..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Refresh Token (1//04...)</label>
              <input
                type="password"
                placeholder="Auto-refresh token..."
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveTokens}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow"
            >
              Save Credentials
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-surfaceBorder bg-slate-950/40 px-4 pt-2 gap-2 text-xs font-medium">
          <button
            onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); }}
            className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'inbox'
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox & Search</span>
          </button>

          <button
            onClick={() => setActiveTab('gmail')}
            className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'gmail'
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose Email</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'calendar'
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Google Calendar</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-brand-950/60 border border-brand-800 text-brand-200 text-xs">
              {statusMsg}
            </div>
          )}

          {/* Inbox & Search Tab */}
          {activeTab === 'inbox' && (
            <div className="space-y-3">
              {selectedMessage ? (
                // Full Email Reader View
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="text-accent-cyan hover:underline flex items-center space-x-1 text-xs"
                    >
                      <span>← Back to Inbox</span>
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono">{selectedMessage.date}</span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">{selectedMessage.subject}</h3>
                    <div className="text-[11px] text-slate-400 mt-1">
                      <span>From: <strong className="text-slate-200">{selectedMessage.sender}</strong></span>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800 text-slate-200 text-[12px] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {selectedMessage.body_plain}
                  </div>
                </div>
              ) : (
                // Inbox Search & List View
                <>
                  <form onSubmit={(e) => { e.preventDefault(); loadInbox(searchQuery); }} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search emails (e.g. from:google, exam, is:unread)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-lg bg-accent-rose hover:bg-rose-600 disabled:opacity-50 text-white font-medium flex items-center space-x-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>Search</span>
                    </button>
                  </form>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {messages.length === 0 ? (
                      <div className="text-slate-500 text-center py-6">
                        {token.trim() ? 'No emails found matching query.' : 'Please enter your Google OAuth credentials above to view emails.'}
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => handleReadMessage(m.id)}
                          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 cursor-pointer transition-all space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200 truncate max-w-[70%]">
                              {m.sender || 'Unknown Sender'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{m.date?.split(' ').slice(0, 4).join(' ')}</span>
                          </div>
                          <div className="text-slate-300 font-medium text-xs truncate">{m.subject || '(No Subject)'}</div>
                          <div className="text-[11px] text-slate-500 truncate">{m.snippet}</div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Compose Email Tab */}
          {activeTab === 'gmail' && (
            <form onSubmit={handleSendEmail} className="space-y-2.5">
              <div>
                <label className="block text-slate-400 mb-0.5">To (Recipient Email)</label>
                <input
                  type="email"
                  placeholder="professor@university.edu"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Subject</label>
                <input
                  type="text"
                  placeholder="CS Assignment 4 Submission - Harsh"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Message Body</label>
                <textarea
                  rows={5}
                  placeholder="Dear Professor, please find my assignment details below..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-[11px]"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading || !toEmail.trim()}
                  className="px-4 py-2 rounded-lg bg-accent-rose hover:bg-rose-600 disabled:opacity-50 text-white font-bold flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Email</span>
                </button>
              </div>
            </form>
          )}

          {/* Google Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="space-y-3">
              <form onSubmit={handleAddCalendarEvent} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                  <Plus className="w-3.5 h-3.5 text-accent-emerald" />
                  <span>Mark Exam or Deadline on Google Calendar</span>
                </div>

                <input
                  type="text"
                  placeholder="Event title (e.g. Operating Systems Final Exam)..."
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-brand-500"
                  required
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Start Time</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">End Time</label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Syllabus notes or location (optional)..."
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !eventTitle.trim()}
                    className="px-4 py-1.5 rounded-lg bg-accent-emerald hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold"
                  >
                    Add Event
                  </button>
                </div>
              </form>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-slate-300">
                  <span>Upcoming Calendar Schedule:</span>
                  <button onClick={loadCalendarEvents} className="p-1 rounded text-slate-400 hover:text-white">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {events.length === 0 ? (
                    <div className="text-slate-500 text-center py-4">No events found or token not set.</div>
                  ) : (
                    events.map((ev) => (
                      <div key={ev.id} className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-200">{ev.summary}</div>
                          <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-mono mt-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(ev.start_time).toLocaleString()}</span>
                          </div>
                        </div>
                        {ev.html_link && (
                          <a href={ev.html_link} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-white">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
