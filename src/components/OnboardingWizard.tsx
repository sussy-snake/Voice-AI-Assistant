import React, { useState } from 'react';
import {
  Sparkles,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Zap,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { LLMConfig } from '../types';
import { CredentialVault } from '../services/auth/credentialVault';
import { OAuthLoopbackClient } from '../services/auth/oauthLoopbackClient';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onComplete: (updatedConfig: LLMConfig) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  config,
  onComplete,
}) => {
  const [apiKey, setApiKey] = useState(config.geminiApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    tested: boolean;
    isValid: boolean;
    message: string;
  }>({
    tested: Boolean(config.geminiApiKey && config.geminiApiKey.length > 10),
    isValid: Boolean(config.geminiApiKey && config.geminiApiKey.length > 10),
    message: config.geminiApiKey ? 'Configured Key' : '',
  });

  const [googleConnected, setGoogleConnected] = useState(
    Boolean(config.googleRefreshToken && config.googleRefreshToken.length > 5)
  );
  const [isLoopbackListening, setIsLoopbackListening] = useState(false);
  const [googleStatusMsg, setGoogleStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleValidateKey = async (keyToTest?: string) => {
    const key = keyToTest !== undefined ? keyToTest : apiKey;
    if (!key || key.trim().length < 10) {
      setValidationStatus({
        tested: true,
        isValid: false,
        message: 'Please enter your Gemini API key.',
      });
      return;
    }

    setIsValidating(true);
    const res = await CredentialVault.testGeminiKey(key);
    setIsValidating(false);
    setValidationStatus({
      tested: true,
      isValid: res.isValid,
      message: res.message,
    });
  };

  const handleStartGoogleConnect = async () => {
    setIsLoopbackListening(true);
    setGoogleStatusMsg('🚀 Opening browser for 1-click Google authorization...');

    await OAuthLoopbackClient.startGoogleSignIn(
      (tokens) => {
        setIsLoopbackListening(false);
        setGoogleConnected(true);
        setGoogleStatusMsg('🎉 Google Account Connected & Refresh Token Saved!');
        const updated = CredentialVault.saveCredentials(
          {
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token || config.googleRefreshToken,
          },
          config
        );
        onComplete(updated);
      },
      (err) => {
        setIsLoopbackListening(false);
        setGoogleStatusMsg(`Notice: ${err}`);
      }
    );
  };

  const handleFinish = () => {
    const updated = CredentialVault.saveCredentials(
      {
        geminiApiKey: apiKey.trim(),
        provider: 'gemini',
      },
      config
    );
    onComplete(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      {/* Liquid Glass Modal Container */}
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-950/90 border border-white/15 p-6 md:p-8 shadow-2xl overflow-hidden space-y-6">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-gradient-to-r from-blue-600/30 via-indigo-500/30 to-cyan-400/30 blur-3xl pointer-events-none rounded-full" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-cyan p-0.5 shadow-lg shadow-brand-500/20 mb-1">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent-cyan" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Welcome to Voice AI Assistant
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Complete quick one-time setup to activate your desktop AI intelligence and Google integrations.
          </p>
        </div>

        {/* 2-Step Glass Cards */}
        <div className="space-y-4">
          {/* Step 1: Gemini AI Brain */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-white">1. Gemini AI Brain</span>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-accent-cyan hover:underline flex items-center space-x-1 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-800/40 transition-all hover:scale-105"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-[11px] text-slate-300">
              Powers instant question answering, coding assistance, and real-time reasoning.
            </p>

            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="Paste your API key (starts with AIzaSy...)"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setValidationStatus({ tested: false, isValid: false, message: '' });
                }}
                className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-brand-400 pr-20"
              />
              <div className="absolute right-2.5 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleValidateKey()}
                  disabled={isValidating || !apiKey.trim()}
                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-[11px] font-bold text-white rounded-lg transition-all"
                >
                  {isValidating ? 'Testing...' : 'Test'}
                </button>
              </div>
            </div>

            {/* Validation Feedback */}
            {validationStatus.tested && (
              <div
                className={`flex items-center space-x-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border ${
                  validationStatus.isValid
                    ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-800/50 text-rose-300'
                }`}
              >
                {validationStatus.isValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                )}
                <span>{validationStatus.message}</span>
              </div>
            )}
          </div>

          {/* Step 2: Google Suite (Gmail & Calendar) */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <span className="text-sm font-semibold text-white">2. Google Services (Optional)</span>
              </div>
              {googleConnected ? (
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-700/50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  Gmail & Calendar
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-300">
              Enables autonomous email sending, inbox searching, and Google Calendar event scheduling.
            </p>

            <button
              type="button"
              onClick={handleStartGoogleConnect}
              disabled={isLoopbackListening}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center space-x-2 border border-white/10 transition-all hover:scale-[1.01] active:scale-98"
            >
              <Zap className={`w-3.5 h-3.5 text-accent-cyan ${isLoopbackListening ? 'animate-spin' : ''}`} />
              <span>
                {isLoopbackListening
                  ? 'Authorizing in Browser (127.0.0.1:8989)...'
                  : googleConnected
                  ? 'Re-Connect Google Account'
                  : 'Connect Google Account (1-Click)'}
              </span>
            </button>

            {googleStatusMsg && (
              <p className="text-[11px] text-brand-300 bg-brand-950/50 p-2 rounded-lg border border-brand-800/40">
                {googleStatusMsg}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Skip for now (Use Offline Mode)
          </button>

          <button
            type="button"
            onClick={handleFinish}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-blue-500/25 flex items-center space-x-2 transition-all hover:scale-105 active:scale-95"
          >
            <span>Launch Assistant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
