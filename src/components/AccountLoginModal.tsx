import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Zap,
  ClipboardPaste,
  FileCode,
} from 'lucide-react';
import { LLMConfig } from '../types';
import { TokenHealthService } from '../services/auth/tokenHealthService';
import { TokenExtractor } from '../services/auth/tokenExtractor';
import { OAuthLoopbackClient } from '../services/auth/oauthLoopbackClient';
import { ServiceAccountAuth } from '../services/auth/serviceAccountAuth';

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
  const [oauthUrlInput, setOauthUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isLoopbackListening, setIsLoopbackListening] = useState(false);

  if (!isOpen) return null;

  const handleExtractFromUrl = (urlOrText: string) => {
    if (!urlOrText.trim()) return;
    const extracted = TokenExtractor.extractTokens(urlOrText);
    if (extracted.success) {
      if (extracted.accessToken) setGoogleAccessToken(extracted.accessToken);
      if (extracted.refreshToken) setGoogleRefreshToken(extracted.refreshToken);
      setStatusMsg(extracted.message);
    } else {
      setStatusMsg(`Notice: ${extracted.message}`);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setOauthUrlInput(text);
        handleExtractFromUrl(text);
      }
    } catch {
      setStatusMsg('Please paste the OAuth link directly into the box below (Ctrl+V).');
    }
  };

  const handleAutoCaptureAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg('Verifying credentials and syncing profile...');

    try {
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

  const handleStartLoopbackSignIn = async () => {
    setIsLoopbackListening(true);
    setStatusMsg('🚀 Loopback server started on http://127.0.0.1:8989/callback. Authorize in your browser...');

    await OAuthLoopbackClient.startGoogleSignIn(
      (tokens) => {
        setIsLoopbackListening(false);
        setGoogleAccessToken(tokens.access_token);
        if (tokens.refresh_token) {
          setGoogleRefreshToken(tokens.refresh_token);
        }
        setStatusMsg('🎉 Google Account Connected & Tokens Vaulted Successfully!');
      },
      (err) => {
        setIsLoopbackListening(false);
        setStatusMsg(`Notice: ${err}`);
      }
    );
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

          {/* 🌐 1-Click Automated Google Sign-In with Loopback Server */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-500/40 space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-100 flex items-center space-x-1.5 text-blue-300">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>🌐 1-Click Automated Google Sign-In</span>
              </span>
              <span className="text-[10px] text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded-full border border-blue-400/30">
                Port 8989 Loopback
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Launches your default browser, captures authorization tokens automatically via local loopback, and saves them to encrypted vault.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleStartLoopbackSignIn}
                disabled={isLoopbackListening}
                className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center space-x-1.5 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-98 text-[11px]"
              >
                <Zap className={`w-3.5 h-3.5 ${isLoopbackListening ? 'animate-spin' : ''}`} />
                <span>{isLoopbackListening ? 'Listening...' : 'Sign In (Browser)'}</span>
              </button>

              <label className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center space-x-1.5 border border-white/10 cursor-pointer transition-all hover:scale-[1.02] active:scale-98 text-[11px]">
                <FileCode className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Service Account Key</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const res = await ServiceAccountAuth.getAccessToken(text);
                    if (res.success && res.accessToken) {
                      setGoogleAccessToken(res.accessToken);
                      setStatusMsg('🎉 Headless Service Account token generated via RSA256 JWT!');
                    } else {
                      setStatusMsg(`Service Account Error: ${res.message}`);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* ⚡ Instant 1-Click OAuth Link Parser Box */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-accent-cyan/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center space-x-1.5 text-accent-cyan">
                <Zap className="w-4 h-4 text-accent-cyan" />
                <span>⚡ Auto-Extract from OAuth Link or URL</span>
              </span>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-accent-cyan border border-accent-cyan/30 flex items-center space-x-1 text-[11px]"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span>Paste from Clipboard</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Paste the OAuth Playground URL from your browser, and we will automatically extract and auto-fill both the Access Token and Refresh Token for you:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste URL (https://developers.google.com/oauthplayground/#...)"
                value={oauthUrlInput}
                onChange={(e) => {
                  setOauthUrlInput(e.target.value);
                  handleExtractFromUrl(e.target.value);
                }}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] focus:border-accent-cyan"
              />
              <button
                type="button"
                onClick={() => handleExtractFromUrl(oauthUrlInput)}
                className="px-3 py-1.5 rounded-lg bg-accent-cyan text-slate-950 font-bold hover:bg-cyan-400 transition-colors"
              >
                Auto-Extract
              </button>
            </div>
          </div>

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
                <span>Google OAuth Tokens (Auto-Filled)</span>
              </span>
              <a
                href="https://developers.google.com/oauthplayground"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent-cyan hover:underline flex items-center space-x-0.5"
              >
                <span>Open Playground</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="space-y-1.5">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Access Token (ya29...)</label>
                <input
                  type="password"
                  placeholder="ya29.a0... (or paste OAuth URL)"
                  value={googleAccessToken}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('oauthplayground') || val.includes('access_token=') || val.includes('refresh_token=')) {
                      handleExtractFromUrl(val);
                    } else {
                      setGoogleAccessToken(val);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Refresh Token (1//04...)</label>
                <input
                  type="password"
                  placeholder="1//04... (Enables Permanent Auto-Refresh)"
                  value={googleRefreshToken}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('oauthplayground') || val.includes('refresh_token=')) {
                      handleExtractFromUrl(val);
                    } else {
                      setGoogleRefreshToken(val);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-[11px]"
                />
              </div>
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
