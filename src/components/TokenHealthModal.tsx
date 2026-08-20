import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  GitBranch,
  Mail,
  Zap,
} from 'lucide-react';
import { LLMConfig } from '../types';
import { TokenHealthService, OverallTokenHealth } from '../services/auth/tokenHealthService';

interface TokenHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onUpdateTokens: (newTokens: Partial<LLMConfig>) => void;
}

export const TokenHealthModal: React.FC<TokenHealthModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateTokens,
}) => {
  const [health, setHealth] = useState<OverallTokenHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runHealthCheck = async () => {
    setIsLoading(true);
    try {
      const results = await TokenHealthService.checkAllHealth({
        githubToken: config.githubToken,
        geminiApiKey: config.geminiApiKey,
        googleAccessToken: config.googleAccessToken,
        googleRefreshToken: config.googleRefreshToken,
      });
      setHealth(results);
    } catch (e: any) {
      setStatusMessage(`Health check failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runHealthCheck();
    }
  }, [isOpen, config]);

  const handleForceRefreshGoogle = async () => {
    if (!config.googleRefreshToken) {
      setStatusMessage('No Refresh Token configured. Please provide a refresh token or authenticate via OAuth Playground.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Exchanging refresh token for a brand new Google Access Token...');
    try {
      const res = await TokenHealthService.refreshGoogleToken(config.googleRefreshToken);
      if (res.success && res.newAccessToken) {
        onUpdateTokens({ googleAccessToken: res.newAccessToken });
        setStatusMessage('✅ Google Access Token successfully refreshed and saved!');
        await runHealthCheck();
      } else {
        setStatusMessage(`❌ Refresh failed: ${res.message}`);
      }
    } catch (e: any) {
      setStatusMessage(`Error during refresh: ${e.message}`);
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
            <ShieldCheck className="w-4 h-4 text-accent-emerald" />
            <span>Token Health Center & Self-Healing Credentials</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Summary Bar */}
        <div className="p-3 bg-slate-950/60 border-b border-surfaceBorder flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">System Status:</span>
            {health?.allHealthy ? (
              <span className="flex items-center space-x-1 text-accent-emerald font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All Tokens Valid & Armed</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-accent-amber font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>1 or more credentials require attention</span>
              </span>
            )}
          </div>

          <button
            onClick={runHealthCheck}
            disabled={isLoading}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center space-x-1"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Test All Now</span>
          </button>
        </div>

        {/* Status Toast Message */}
        {statusMessage && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-brand-950/60 border border-brand-800 text-brand-200 text-xs">
            {statusMessage}
          </div>
        )}

        {/* Credentials Cards List */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          {/* 1. Google Suite (Gmail & Calendar) Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-semibold text-slate-200">
                <Mail className="w-4 h-4 text-accent-rose" />
                <span>Google Suite (Gmail & Calendar OAuth)</span>
              </div>
              {health?.statuses.google.isValid ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-accent-emerald border border-emerald-800/60">
                  {health.statuses.google.isExpiringSoon ? '🟡 Expiring Soon' : '🟢 Active'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-950 text-red-300 border border-red-800/60">
                  🔴 Expired / Unset
                </span>
              )}
            </div>

            <p className="text-slate-400 text-[11px]">
              {health?.statuses.google.message || 'Validating Google OAuth status...'}
            </p>

            {health?.statuses.google.expiresInSeconds !== undefined && health.statuses.google.expiresInSeconds > 0 && (
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
                <Clock className="w-3 h-3 text-accent-amber" />
                <span>Remaining Lifetime: {Math.round(health.statuses.google.expiresInSeconds / 60)} minutes</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <a
                href="https://developers.google.com/oauthplayground"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-[11px] text-accent-cyan hover:underline"
              >
                <span>OAuth Playground Helper</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={handleForceRefreshGoogle}
                disabled={isLoading}
                className="px-3 py-1 rounded-lg bg-accent-rose hover:bg-rose-600 disabled:opacity-50 text-white font-medium flex items-center space-x-1 text-[11px]"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Auto-Refresh Token</span>
              </button>
            </div>
          </div>

          {/* 2. GitHub Personal Access Token Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-semibold text-slate-200">
                <GitBranch className="w-4 h-4 text-accent-cyan" />
                <span>GitHub Automation Token (Repo & Push)</span>
              </div>
              {health?.statuses.github.isValid ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-accent-emerald border border-emerald-800/60">
                  🟢 Connected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-950 text-red-300 border border-red-800/60">
                  🔴 Not Configured
                </span>
              )}
            </div>

            <p className="text-slate-400 text-[11px]">
              {health?.statuses.github.message || 'Validating GitHub token...'}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-[11px] text-accent-cyan hover:underline"
              >
                <span>Generate GitHub Token</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-[10px] text-slate-500 font-mono">Scopes: repo, workflow</span>
            </div>
          </div>

          {/* 3. Google Gemini 2.0 API Key Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-semibold text-slate-200">
                <Zap className="w-4 h-4 text-brand-400" />
                <span>Google Gemini 2.0 Flash Key</span>
              </div>
              {health?.statuses.gemini.isValid ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-accent-emerald border border-emerald-800/60">
                  🟢 Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800/60">
                  🟡 Offline Mode Active
                </span>
              )}
            </div>

            <p className="text-slate-400 text-[11px]">
              {health?.statuses.gemini.message || 'Validating Gemini API key...'}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-[11px] text-accent-cyan hover:underline"
              >
                <span>Get Free Gemini Key (Google AI Studio)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-[10px] text-slate-500 font-mono">Permanent (No Expiry)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
