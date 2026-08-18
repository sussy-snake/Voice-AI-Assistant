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
} from 'lucide-react';
import { ChatMessage, ToolResult, FileMatch, SystemStatus, Task } from '../types';
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
                {task.recurring && task.recurring !== 'none' && (
                  <span className="px-1.5 py-0.5 rounded bg-brand-950 text-brand-300 border border-brand-800">
                    {task.recurring}
                  </span>
                )}
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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          if (m.role === 'tool') return null; // Rendered inline with assistant responses

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
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-tr-none'
                    : 'bg-surface border border-surfaceBorder text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Message Body */}
                <div className="whitespace-pre-wrap select-text">{m.content}</div>

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
                ? 'Hold Mic or Space to speak, or type command...'
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
