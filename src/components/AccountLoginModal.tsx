import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { LLMConfig } from '../types';
import { TokenHealthService } from '../services/auth/tokenHealthService';

interface AccountLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSaveProfile: (profile: {
    userName: string;
    googleEmail?: string;
    geminiApiKey?: string;
    githubToken?: string;
    googleAccessToken?: string;
    googleRefreshToken?: string;
  }) => void;
}

export const AccountLoginModal: React.FC<AccountLoginModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveProfile,
}) => {
  const [userName, setUserName] = useState(config.userName || 'Harsh');
  const [googleEmail, setGoogleEmail] = useState('jaytriharshvardhan@gmail.com');
  const [geminiKey, setGeminiKey] = useState(config.geminiApiKey || '');
  const [githubToken, setGithubToken] = useState(config.githubToken || '');
  const [googleAccessToken, setGoogleAccessToken] = useState(config.googleAccessToken || '');
  const [googleRefreshToken, setGoogleRefreshToken] = useState(config.googleRefreshToken || '');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAutoCaptureAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg('Verifying credentials and syncing profile...');

    try {
      // Test credentials in background
      await TokenHealthService.checkAllHealth({
        githubToken,
        geminiApiKey: geminiKey,
        googleAccessToken,
        googleRefreshToken,
      });

      onSaveProfile({
        userName: userName.trim(),
        googleEmail: googleEmail.trim(),
        geminiApiKey: geminiKey.trim(),
        githubToken: githubToken.trim(),
        googleAccessToken: googleAccessToken.trim(),
        googleRefreshToken: googleRefreshToken.trim(),
      });

      setStatusMsg('✅ Account & Credentials saved successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMsg(`Notice: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surfaceBorder bg-slate-900/60">
          <div className="flex items-center space-x-2.5 text-white font-semibold">
            <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <span>Account Profile & Automated Google Connect</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleAutoCaptureAndSave} className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Welcome Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-brand-950/80 to-slate-900 border border-brand-800/50 space-y-1.5">
            <div className="flex items-center space-x-2 text-brand-300 font-semibold">
              <Sparkles className="w-4 h-4 text-accent-cyan" />
              <span>Personalized Voice Assistant Profile</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Connect your Google ID and credentials once. The system will automatically monitor, authenticate, and silently refresh all tokens in the background!
            </p>
          </div>

          {statusMsg && (
            <div className="p-2.5 rounded-lg bg-brand-950/60 border border-brand-800 text-brand-200 text-xs">
              {statusMsg}
            </div>
          )}

          {/* User Name & Google Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Your Name</label>
              <input
                type="text"
                placeholder="e.g. Harsh"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Google Email Address</label>
              <input
                type="email"
                placeholder="user@gmail.com"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                required
              />
            </div>
          </div>

          {/* Google OAuth Access & Refresh Tokens */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-200">
              <span className="flex items-center space-x-1.5 text-accent-rose">
                <Mail className="w-3.5 h-3.5" />
                <span>Google OAuth Tokens (Gmail & Calendar)</span>
              </span>
              <a
                href="https://developers.google.com/oauthplayground"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent-cyan hover:underline flex items-center space-x-0.5"
              >
                <span>OAuth Helper</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="space-y-1.5">
              <input
                type="password"
                placeholder="Google Access Token (ya29.a0...)"
                value={googleAccessToken}
                onChange={(e) => setGoogleAccessToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-[11px]"
              />
              <input
                type="password"
                placeholder="Google Refresh Token (1//04... for permanent auto-refresh)"
                value={googleRefreshToken}
                onChange={(e) => setGoogleRefreshToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Gemini & GitHub API Keys */}
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">Google Gemini API Key</label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-accent-cyan hover:underline"
                >
                  Get Free Key
                </a>
              </div>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-[11px]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">GitHub Token (Optional)</label>
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-accent-cyan hover:underline"
                >
                  Create Token
                </a>
              </div>
              <input
                type="password"
                placeholder="ghp_..."
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-500 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-accent-emerald" />
              <span>Encrypted locally in desktop storage</span>
            </span>

            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold flex items-center space-x-1.5 shadow-lg shadow-brand-600/30 transition-all hover:scale-105"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save & Connect Account</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
