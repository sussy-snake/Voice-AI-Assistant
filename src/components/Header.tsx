import React, { useEffect, useState } from 'react';
import {
  Cpu,
  HardDrive,
  Settings,
  FolderSearch,
  CalendarCheck,
  Mic,
  Radio,
  GitBranch,
  Mail,
  Database,
  ShieldCheck,
  User,
  Sparkles,
} from 'lucide-react';
import { SystemStatus, LLMConfig, VoiceMode } from '../types';
import { TauriBridge } from '../services/tauriBridge';
import { TokenHealthService, OverallTokenHealth } from '../services/auth/tokenHealthService';
import { AssistantLogo } from './AssistantLogo';

interface HeaderProps {
  config: LLMConfig;
  voiceMode: VoiceMode;
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
  onOpenSettings: () => void;
  onOpenFileExplorer: () => void;
  onOpenTaskManager: () => void;
  onOpenGitModal: () => void;
  onOpenGoogleModal: () => void;
  onOpenRAGModal: () => void;
  onOpenTokenHealthModal: () => void;
  onOpenAccountModal: () => void;
  onOpenResearchDrawer: () => void;
  onToggleVoiceMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  voiceMode,
  isListening,
  isSpeaking,
  volume,
  onOpenSettings,
  onOpenFileExplorer,
  onOpenTaskManager,
  onOpenGitModal,
  onOpenGoogleModal,
  onOpenRAGModal,
  onOpenTokenHealthModal,
  onOpenAccountModal,
  onOpenResearchDrawer,
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
    const tokenInterval = setInterval(checkTokens, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(tokenInterval);
    };
  }, [config]);

  const getCpuColor = (usage: number) => {
    if (usage < 45) return 'text-accent-emerald border-emerald-500/30 bg-emerald-950/40';
    if (usage < 75) return 'text-accent-amber border-amber-500/30 bg-amber-950/40';
    return 'text-accent-rose border-rose-500/30 bg-rose-950/40';
  };

  const getRamColor = (percent: number) => {
    if (percent < 60) return 'text-accent-cyan border-cyan-500/30 bg-cyan-950/40';
    if (percent < 85) return 'text-accent-amber border-amber-500/30 bg-amber-950/40';
    return 'text-accent-rose border-rose-500/30 bg-rose-950/40';
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-neutral-900/60 backdrop-blur-2xl border-b border-white/10 select-none z-30 relative shadow-xl">
      {/* Brand & Assistant Logo */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-2">
          <AssistantLogo
            size={30}
            isListening={isListening}
            isSpeaking={isSpeaking}
            volume={volume}
          />
          <span className="text-sm font-bold tracking-wide bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            VoiceAI
          </span>
        </div>

        {/* Model Badge */}
        <div className="hidden sm:flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mr-1.5 animate-pulse"></span>
          <span className="capitalize">{config.provider}</span>
        </div>

        {/* Token Health Status Indicator */}
        <button
          onClick={onOpenTokenHealthModal}
          className="hidden md:flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 text-[10px] font-mono transition-all hover:scale-105"
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

        {/* Workspace Research Quick Launcher */}
        <button
          onClick={onOpenResearchDrawer}
          className="hidden lg:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-[10px] font-mono text-accent-cyan hover:bg-cyan-900/50 transition-all hover:scale-105"
          title="Open Deep Workspace Research Hub"
        >
          <Sparkles className="w-3 h-3" />
          <span>Research Engine</span>
        </button>
      </div>

      {/* Center Telemetry & Voice Mode */}
      <div className="flex items-center space-x-1.5">
        {stats && (
          <>
            {/* CPU Badge */}
            <div
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-medium backdrop-blur-md transition-all ${getCpuColor(
                stats.cpu_usage_percent
              )}`}
              title={`CPU: ${stats.cpu_brand} (${stats.cpu_cores} Cores)`}
            >
              <Cpu className="w-3 h-3" />
              <span>{stats.cpu_usage_percent}%</span>
            </div>

            {/* RAM Badge */}
            <div
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-medium backdrop-blur-md transition-all ${getRamColor(
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
          className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
            isListening
              ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
              : voiceMode === 'push-to-talk'
              ? 'bg-white/10 border-white/15 text-slate-300 hover:text-white'
              : 'bg-brand-950/70 border-brand-500/50 text-brand-300'
          }`}
          title={`Voice mode: ${voiceMode}`}
        >
          {voiceMode === 'push-to-talk' ? (
            <>
              <Mic className={`w-3 h-3 ${isListening ? 'text-rose-400' : 'text-slate-400'}`} />
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

      {/* Right Controls Action Bar */}
      <div className="flex items-center space-x-1">
        {/* Research Drawer Button */}
        <button
          onClick={onOpenResearchDrawer}
          className="p-1.5 rounded-xl text-accent-cyan hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="Deep Multi-File Workspace Research"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Account Profile Button */}
        <button
          onClick={onOpenAccountModal}
          className="p-1.5 rounded-xl text-brand-400 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="Account Profile & 1-Click Google Connect"
        >
          <User className="w-4 h-4" />
        </button>

        {/* Token Health Center Button */}
        <button
          onClick={onOpenTokenHealthModal}
          className="p-1.5 rounded-xl text-accent-emerald hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="Token Health Center"
        >
          <ShieldCheck className="w-4 h-4" />
        </button>

        {/* Voice RAG Hub Button */}
        <button
          onClick={onOpenRAGModal}
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="Voice-Enabled RAG Knowledge Hub"
        >
          <Database className="w-4 h-4" />
        </button>

        {/* GitHub Automation Button */}
        <button
          onClick={onOpenGitModal}
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="Git & GitHub Hub"
        >
          <GitBranch className="w-4 h-4" />
        </button>

        {/* Google Suite Button */}
        <button
          onClick={onOpenGoogleModal}
          className="p-1.5 rounded-xl text-accent-rose hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="Google Suite (Gmail & Calendar)"
        >
          <Mail className="w-4 h-4" />
        </button>

        {/* Filesystem Scanner */}
        <button
          onClick={onOpenFileExplorer}
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="Filesystem Scanner"
        >
          <FolderSearch className="w-4 h-4" />
        </button>

        {/* SQLite Task Scheduler */}
        <button
          onClick={onOpenTaskManager}
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="SQLite Task Scheduler"
        >
          <CalendarCheck className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all hover:scale-105"
          title="Settings & Model Configuration"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
