import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Mic,
  FileCode,
  Calendar,
  Activity,
  FolderOpen,
  Clock,
  Sparkles,
  Bot,
  User,
  Trash2,
  Copy,
  Check,
  Code2,
  Search,
  GitBranch,
  Mail,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { ChatMessage, ToolResult, FileMatch, SystemStatus, Task, GitOperationResult, GoogleOperationResult, ComputeTaskResult, GitStatusResult } from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { TauriBridge } from '../services/tauriBridge';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  activeToolRunning: string | null;
  interimTranscript: string;
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
  voiceMode: 'push-to-talk' | 'voice-activated';
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onClearChat: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isProcessing,
  activeToolRunning,
  interimTranscript,
  isListening,
  isSpeaking,
  volume,
  voiceMode,
  onSendMessage,
  onStopGeneration,
  onStartListening,
  onStopListening,
  onClearChat,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript, activeToolRunning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim() && !isProcessing) {
      onSendMessage(inputVal.trim());
      setInputVal('');
    }
  };

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // -------------------------------------------------------------
  // Render Markdown Text with Code Blocks & Copy Buttons
  // -------------------------------------------------------------
  const renderMessageContent = (content: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let blockCount = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          text: content.substring(lastIndex, match.index),
        });
      }

      parts.push({
        type: 'code',
        lang: match[1] || 'text',
        code: match[2],
        index: blockCount++,
      });

      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        text: content.substring(lastIndex),
      });
    }

    if (parts.length === 0) {
      parts.push({ type: 'text', text: content });
    }

    return (
      <div className="space-y-2">
        {parts.map((p, i) => {
          if (p.type === 'code') {
            const isCopied = copiedIndex === p.index;
            return (
              <div key={i} className="my-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400">
                  <span>{p.lang}</span>
                  <button
                    onClick={() => handleCopyCode(p.code || '', p.index!)}
                    className="flex items-center space-x-1 text-slate-300 hover:text-white"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-accent-emerald" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 text-[11px] font-mono text-slate-100 overflow-x-auto whitespace-pre leading-relaxed">
                  <code>{p.code}</code>
                </pre>
              </div>
            );
          }
          return (
            <div key={i} className="whitespace-pre-wrap select-text leading-relaxed">
              {p.text}
            </div>
          );
        })}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Tool Result Renderers
  // -------------------------------------------------------------
  const renderToolResultCard = (tr: ToolResult) => {
    if (tr.error) {
      return (
        <div key={tr.toolCallId} className="p-2.5 my-1.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-200 text-xs">
          <span className="font-semibold">Tool [{tr.name}] Error:</span> {tr.error}
        </div>
      );
    }

    if (tr.name === 'scan_filesystem') {
      const files: FileMatch[] = Array.isArray(tr.result) ? tr.result : [];
      return (
        <div key={tr.toolCallId} className="my-2 p-3 rounded-lg bg-surface/95 border border-surfaceBorder text-xs">
          <div className="flex items-center justify-between font-semibold text-slate-200 mb-2">
            <span className="flex items-center space-x-1.5 text-accent-cyan">
              <FileCode className="w-3.5 h-3.5" />
              <span>Filesystem Matches ({files.length})</span>
            </span>
          </div>

          {files.length === 0 ? (
            <p className="text-slate-400 italic">No matching files found.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-2 truncate max-w-[70%]">
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-brand-950 text-brand-400 border border-brand-800/50">
                      {file.extension || (file.is_dir ? 'DIR' : 'FILE')}
                    </span>
                    <span className="truncate text-slate-200 font-mono text-[11px]" title={file.path}>
                      {file.name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatBytes(file.size_bytes)}
                    </span>
                    <button
                      onClick={() => TauriBridge.openFilePath(file.path)}
                      className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                      title="Open in System Explorer"
                    >
                      <FolderOpen className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (tr.name === 'git_commit_and_push' || tr.name === 'git_create_repo') {
      const gitRes: GitOperationResult = tr.result;
      return (
        <div key={tr.toolCallId} className="my-2 p-3 rounded-lg bg-surface/95 border border-accent-cyan/40 text-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-accent-cyan font-semibold">
            <GitBranch className="w-4 h-4" />
            <span>Git Operation Completed</span>
          </div>
          <p className="text-slate-200">{gitRes?.message}</p>
          {gitRes?.repo_url && (
            <a
              href={gitRes.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-accent-cyan hover:underline text-[11px]"
            >
              <span>Open on GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      );
    }

    if (tr.name === 'git_status_check') {
      const status: GitStatusResult = tr.result;
      return (
        <div key={tr.toolCallId} className="my-2 p-3 rounded-lg bg-surface/95 border border-slate-800 text-xs space-y-1">
          <div className="flex items-center justify-between font-semibold text-slate-200">
            <span className="flex items-center space-x-1.5 text-accent-cyan">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Git Status ({status.current_branch})</span>
            </span>
            <span className={status.clean ? 'text-accent-emerald' : 'text-accent-amber'}>
              {status.clean ? 'Clean' : 'Modified'}
            </span>
          </div>
          {status.modified_files.length > 0 && (
            <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded max-h-24 overflow-y-auto">
              {status.modified_files.map((f, i) => (
                <div key={i} className="text-amber-300">✎ {f}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (tr.name === 'gmail_send_message') {
      const gRes: GoogleOperationResult = tr.result;
      return (
        <div key={tr.toolCallId} className="my-2 p-3 rounded-lg bg-surface/95 border border-accent-rose/40 text-xs space-y-1">
          <div className="flex items-center space-x-1.5 text-accent-rose font-semibold">
            <Mail className="w-4 h-4" />
            <span>Gmail Sent</span>
          </div>
          <p className="text-slate-200">{gRes?.message}</p>
          {gRes?.details && <p className="text-slate-400 text-[11px]">{gRes.details}</p>}
        </div>
      );
    }

    if (tr.name === 'calendar_add_event') {
      const gRes: GoogleOperationResult = tr.result;
      return (
        <div key={tr.toolCallId} className="my-2 p-3 rounded-lg bg-surface/95 border border-accent-emerald/40 text-xs space-y-1">
          <div className="flex items-center space-x-1.5 text-accent-emerald font-semibold">
            <Calendar className="w-4 h-4" />
            <span>Google Calendar Updated</span>
          </div>
          <p className="text-slate-200">{gRes?.message}</p>
        </div>
      );
    }

    if (tr.name === 'run_hardware_compute') {
      const compRes: ComputeTaskResult = tr.result;
      return (
        <div key={tr.toolCallId} className="my-2 p-3 rounded-lg bg-surface/95 border border-brand-500/40 text-xs space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-brand-300">
            <span className="flex items-center space-x-1.5 text-accent-cyan">
              <Zap className="w-4 h-4" />
              <span>NPU / CPU Hardware Compute ({compRes?.elapsed_ms}ms)</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-950 text-brand-300">
              {compRes?.threads_used} Parallel Threads
            </span>
          </div>
          <p className="text-slate-200">{compRes?.result_summary}</p>
        </div>
      );
    }

    if (tr.name === 'schedule_task') {
      const task: Task = tr.result?.task;
      return (
        <div key={tr.toolCallId} className="my-2 p-3 rounded-lg bg-surface/95 border border-surfaceBorder text-xs">
          <div className="flex items-center space-x-1.5 text-accent-emerald font-semibold mb-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Task Saved to SQLite</span>
          </div>
          {task ? (
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
              <div className="font-semibold text-slate-100">{task.title}</div>
              <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1 font-mono">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{new Date(task.due_date).toLocaleString()}</span>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-slate-300">{tr.result?.message || 'Task recorded.'}</p>
          )}
        </div>
      );
    }

    if (tr.name === 'system_status') {
      const status: SystemStatus = tr.result;
      return (
        <div key={tr.toolCallId} className="my-2 p-3 rounded-lg bg-surface/95 border border-surfaceBorder text-xs">
          <div className="flex items-center space-x-1.5 text-accent-amber font-semibold mb-2">
            <Activity className="w-3.5 h-3.5" />
            <span>System Telemetry Snapshot</span>
          </div>
          {status && (
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">CPU Load</span>
                <span className="font-mono font-bold text-slate-200 text-sm">
                  {status.cpu_usage_percent}%
                </span>
                <span className="text-[10px] text-slate-500 block truncate">{status.cpu_brand}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">RAM Usage</span>
                <span className="font-mono font-bold text-slate-200 text-sm">
                  {Math.round(status.used_memory_mb / 1024)}GB / {Math.round(status.total_memory_mb / 1024)}GB
                </span>
                <span className="text-[10px] text-slate-500 block">{status.memory_usage_percent}% in use</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const csQuickPrompts = [
    { label: '🐙 Push to GitHub', query: 'Push my code changes to GitHub repository.', icon: GitBranch },
    { label: '📅 Mark on Calendar', query: 'Mark OS Lab assignment on my Google Calendar for Friday at 5pm.', icon: Calendar },
    { label: '✉️ Send Email', query: 'Send email to professor@college.edu with subject "Lab Assignment 4" and body "Hello, here is my completed assignment."', icon: Mail },
    { label: '⚡ NPU Compute', query: 'Run hardware compute benchmark with full CPU and NPU acceleration.', icon: Zap },
    { label: '🚀 DSA Complexity', query: 'Show me the Big-O time complexity cheatsheet for sorting and trees.', icon: Code2 },
    { label: '🔍 Find Notes', query: 'Find my notes and pdf files on this computer.', icon: Search },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          if (m.role === 'tool') return null;

          return (
            <div
              key={m.id}
              className={`flex items-start space-x-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-md bg-brand-600/30 border border-brand-500/50 flex items-center justify-center text-brand-300 shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-tr-none'
                    : 'bg-surface border border-surfaceBorder text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Message Body with Code Highlighter */}
                {renderMessageContent(m.content)}

                {/* Tool Calling Badges */}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                    {m.toolCalls.map((tc) => (
                      <span
                        key={tc.id}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-accent-cyan"
                      >
                        <Sparkles className="w-2.5 h-2.5 animate-spin" />
                        <span>Invoking: {tc.name}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Inline Tool Execution Results */}
                {m.toolResults && m.toolResults.map((tr) => renderToolResultCard(tr))}

                <div className="text-[9px] text-slate-400 text-right mt-1 opacity-70">
                  {m.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Active Tool Execution Indicator */}
        {activeToolRunning && (
          <div className="flex items-center space-x-2 text-xs text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-3 py-2 rounded-lg animate-pulse">
            <Sparkles className="w-4 h-4" />
            <span>Executing system tool: <strong>{activeToolRunning}</strong>...</span>
          </div>
        )}

        {/* Interim Streaming Voice Dictation Preview */}
        {interimTranscript && (
          <div className="p-2.5 rounded-lg bg-brand-950/40 border border-brand-800/60 text-xs text-brand-200 flex items-center space-x-2 animate-pulse">
            <Mic className="w-3.5 h-3.5 text-brand-400" />
            <span className="italic">{interimTranscript}</span>
            <span className="w-1.5 h-3 bg-brand-400 inline-block animate-ping"></span>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* CS Engineering Quick Action Chips */}
      <div className="px-3.5 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-surfaceBorder/40 bg-surface/30">
        {csQuickPrompts.map((chip, i) => {
          const Icon = chip.icon;
          return (
            <button
              key={i}
              onClick={() => onSendMessage(chip.query)}
              disabled={isProcessing}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 hover:text-white shrink-0 transition-colors"
            >
              <Icon className="w-3 h-3 text-brand-400" />
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Audio Waveform Meter */}
      <div className="px-3.5 pb-2">
        <AudioVisualizer volume={volume} isListening={isListening} isSpeaking={isSpeaking} />
      </div>

      {/* Input Control Console */}
      <div className="p-3 bg-surface/90 border-t border-surfaceBorder">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          {/* Push-to-Talk / Mic Button */}
          {voiceMode === 'push-to-talk' ? (
            <button
              type="button"
              onMouseDown={onStartListening}
              onMouseUp={onStopListening}
              onTouchStart={onStartListening}
              onTouchEnd={onStopListening}
              className={`p-2.5 rounded-xl border transition-all ${
                isListening
                  ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/30 scale-105'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Hold to Speak (Push-to-Talk) or press Space"
            >
              <Mic className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={isListening ? onStopListening : onStartListening}
              className={`p-2.5 rounded-xl border transition-all ${
                isListening
                  ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-500/30 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={isListening ? 'Stop Continuous VAD' : 'Start Continuous VAD Listening'}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          {/* Text Input */}
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              isListening
                ? 'Listening to speech...'
                : voiceMode === 'push-to-talk'
                ? 'Hold Space/Mic to speak, or type git/calendar/coding commands...'
                : 'Type or speak naturally...'
            }
            disabled={isProcessing}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />

          {/* Stop Generation or Send Button */}
          {isProcessing ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="p-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white border border-red-500 transition-colors"
              title="Stop AI Generation"
            >
              <Square className="w-4 h-4 fill-white" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md shadow-brand-600/20 transition-all"
              title="Send Command"
            >
              <Send className="w-4 h-4" />
            </button>
          )}

          {/* Clear Chat Button */}
          <button
            type="button"
            onClick={onClearChat}
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
