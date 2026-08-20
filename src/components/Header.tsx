import React, { useEffect, useState } from 'react';
import {
  Cpu,
  HardDrive,
  Settings,
  FolderSearch,
  CalendarCheck,
  Mic,
  Radio,
  Zap,
  GitBranch,
  Mail,
  Database,
  ShieldCheck,
  User,
} from 'lucide-react';
import { SystemStatus, LLMConfig, VoiceMode } from '../types';
import { TauriBridge } from '../services/tauriBridge';
import { TokenHealthService, OverallTokenHealth } from '../services/auth/tokenHealthService';

interface HeaderProps {
  config: LLMConfig;
  voiceMode: VoiceMode;
  isListening: boolean;
  onOpenSettings: () => void;
  onOpenFileExplorer: () => void;
  onOpenTaskManager: () => void;
  onOpenGitModal: () => void;
  onOpenGoogleModal: () => void;
  onOpenRAGModal: () => void;
  onOpenTokenHealthModal: () => void;
  onOpenAccountModal: () => void;
  onToggleVoiceMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  voiceMode,
  isListening,
  onOpenSettings,
  onOpenFileExplorer,
  onOpenTaskManager,
  onOpenGitModal,
  onOpenGoogleModal,
  onOpenRAGModal,
  onOpenTokenHealthModal,
  onOpenAccountModal,
  onToggleVoiceMode,
}) => {
  const [stats, setStats] = useState<SystemStatus | null>(null);
  const [tokenHealth, setTokenHealth] = useState<OverallTokenHealth | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await TauriBridge.getSystemStatus();
        setStats(data);
      } catch {
        // ignore
      }
    };

    const checkTokens = async () => {
      try {
        const health = await TokenHealthService.checkAllHealth({
          githubToken: config.githubToken,
          geminiApiKey: config.geminiApiKey,
          googleAccessToken: config.googleAccessToken,
          googleRefreshToken: config.googleRefreshToken,
        });
        setTokenHealth(health);
      } catch {
        // ignore
      }
    };

    fetchStats();
    checkTokens();

    const interval = setInterval(fetchStats, 3000);
    const tokenInterval = setInterval(checkTokens, 60000); // check tokens every minute

    return () => {
      clearInterval(interval);
      clearInterval(tokenInterval);
    };
  }, [config]);

  const getCpuColor = (usage: number) => {
    if (usage < 45) return 'text-accent-emerald border-accent-emerald/30 bg-accent-emerald/10';
    if (usage < 75) return 'text-accent-amber border-accent-amber/30 bg-accent-amber/10';
    return 'text-accent-rose border-accent-rose/30 bg-accent-rose/10';
  };

  const getRamColor = (percent: number) => {
    if (percent < 60) return 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10';
    if (percent < 85) return 'text-accent-amber border-accent-amber/30 bg-accent-amber/10';
    return 'text-accent-rose border-accent-rose/30 bg-accent-rose/10';
  };

  return (
    <header className="flex items-center justify-between px-3.5 py-2.5 bg-surface/90 backdrop-blur-md border-b border-surfaceBorder select-none">
      {/* Brand, Provider, and Token Health Pill */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 font-bold tracking-tight text-white">
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center shadow-sm shadow-brand-500/20">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-wide">VoiceAI</span>
        </div>

        {/* Model Badge */}
        <div className="hidden sm:flex items-center px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mr-1.5 animate-pulse"></span>
          <span className="capitalize">{config.provider}</span>
        </div>

        {/* Live Token Health Status Indicator */}
        <button
          onClick={onOpenTokenHealthModal}
          className="hidden md:flex items-center px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] font-mono transition-all hover:scale-105"
          title="Open Token Health Center"
        >
          <ShieldCheck
            className={`w-3 h-3 mr-1 ${
              tokenHealth?.allHealthy ? 'text-accent-emerald' : 'text-accent-amber'
            }`}
          />
          <span className={tokenHealth?.allHealthy ? 'text-accent-emerald' : 'text-accent-amber'}>
            {tokenHealth?.allHealthy ? 'Tokens: Healthy' : 'Tokens: Check'}
          </span>
        </button>

        {/* Voice RAG Pipeline Sub-200ms Badge */}
        <div className="hidden lg:flex items-center px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-[10px] font-mono text-accent-emerald">
          <span>⚡ RAG &lt;200ms</span>
        </div>
      </div>

      {/* Center Telemetry (G-Helper Style) */}
      <div className="flex items-center space-x-1.5">
        {stats && (
          <>
            {/* CPU Badge */}
            <div
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium transition-all ${getCpuColor(
                stats.cpu_usage_percent
              )}`}
              title={`CPU: ${stats.cpu_brand} (${stats.cpu_cores} Cores)`}
            >
              <Cpu className="w-3 h-3" />
              <span>{stats.cpu_usage_percent}%</span>
            </div>

            {/* RAM Badge */}
            <div
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium transition-all ${getRamColor(
                stats.memory_usage_percent
              )}`}
              title={`RAM: ${Math.round(stats.used_memory_mb / 1024)}GB / ${Math.round(
                stats.total_memory_mb / 1024
              )}GB`}
            >
              <HardDrive className="w-3 h-3" />
              <span>{stats.memory_usage_percent}%</span>
            </div>
          </>
        )}

        {/* Voice Mode Switcher */}
        <button
          onClick={onToggleVoiceMode}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
            isListening
              ? 'bg-red-950/80 border-red-600 text-red-300 animate-pulse'
              : voiceMode === 'push-to-talk'
              ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              : 'bg-brand-950/60 border-brand-700/60 text-brand-300 hover:bg-brand-900/60'
          }`}
          title={`Click to switch mode (Current: ${voiceMode}, ${isListening ? 'Listening' : 'Idle'})`}
        >
          {voiceMode === 'push-to-talk' ? (
            <>
              <Mic className={`w-3 h-3 ${isListening ? 'text-red-400' : 'text-slate-400'}`} />
              <span>PTT</span>
            </>
          ) : (
            <>
              <Radio className="w-3 h-3 text-brand-400 animate-pulse" />
              <span>VAD</span>
            </>
          )}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-1">
        {/* Account Profile & Google Connect Button */}
        <button
          onClick={onOpenAccountModal}
          className="p-1.5 rounded-lg text-brand-400 hover:text-brand-300 hover:bg-surfaceHover border border-brand-800/40 hover:border-brand-700 transition-all hover:scale-105"
          title="Account Profile & Google Connect"
        >
          <User className="w-4 h-4" />
        </button>

        {/* Token Health Center Button */}
        <button
          onClick={onOpenTokenHealthModal}
          className="p-1.5 rounded-lg text-slate-400 hover:text-accent-emerald hover:bg-surfaceHover border border-transparent hover:border-surfaceBorder transition-all hover:scale-105"
          title="Token Health Center & Self-Healing Credentials"
        >
          <ShieldCheck className="w-4 h-4 text-accent-emerald" />
        </button>

        {/* Voice RAG Hub Button */}
        <button
          onClick={onOpenRAGModal}
          className="p-1.5 rounded-lg text-slate-400 hover:text-accent-cyan hover:bg-surfaceHover border border-transparent hover:border-surfaceBorder transition-all hover:scale-105"
          title="Voice-Enabled RAG Knowledge Hub (#RAGInGoa)"
        >
          <Database className="w-4 h-4 text-accent-cyan" />
        </button>

        {/* GitHub Automation Button */}
        <button
          onClick={onOpenGitModal}
          className="p-1.5 rounded-lg text-slate-400 hover:text-accent-cyan hover:bg-surfaceHover border border-transparent hover:border-surfaceBorder transition-all hover:scale-105"
          title="Git & GitHub Hub (Create & Push Code)"
        >
          <GitBranch className="w-4 h-4" />
        </button>

        {/* Google Suite Button */}
        <button
          onClick={onOpenGoogleModal}
          className="p-1.5 rounded-lg text-slate-400 hover:text-accent-rose hover:bg-surfaceHover border border-transparent hover:border-surfaceBorder transition-all hover:scale-105"
          title="Google Suite (Gmail & Calendar)"
        >
          <Mail className="w-4 h-4" />
        </button>

        {/* Filesystem Scanner */}
        <button
          onClick={onOpenFileExplorer}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-surfaceHover border border-transparent hover:border-surfaceBorder transition-all hover:scale-105"
          title="Filesystem Scanner"
        >
          <FolderSearch className="w-4 h-4" />
        </button>

        {/* SQLite Task Scheduler */}
        <button
          onClick={onOpenTaskManager}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-surfaceHover border border-transparent hover:border-surfaceBorder transition-all hover:scale-105"
          title="SQLite Task Scheduler"
        >
          <CalendarCheck className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-surfaceHover border border-transparent hover:border-surfaceBorder transition-all hover:scale-105"
          title="Settings & Model Configuration"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
