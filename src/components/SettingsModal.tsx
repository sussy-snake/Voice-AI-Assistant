import React, { useState } from 'react';
import { X, Save, Sliders, Cpu, Mic, Key, ExternalLink, Zap } from 'lucide-react';
import { LLMConfig, AudioSettings, LLMProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  audioSettings: AudioSettings;
  onSaveConfig: (newConfig: LLMConfig) => void;
  onSaveAudioSettings: (newAudioSettings: AudioSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  audioSettings,
  onSaveConfig,
  onSaveAudioSettings,
}) => {
  const [localConfig, setLocalConfig] = useState<LLMConfig>({ ...config });
  const [localAudio, setLocalAudio] = useState<AudioSettings>({ ...audioSettings });
  const [activeTab, setActiveTab] = useState<'llm' | 'audio' | 'system'>('llm');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig(localConfig);
    onSaveAudioSettings(localAudio);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceBorder bg-slate-900/50">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Sliders className="w-4 h-4 text-brand-400" />
            <span>AI Model & Voice Settings</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-surfaceBorder bg-slate-950/40 px-4 pt-2 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('llm')}
            className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'llm'
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>LLM Provider</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'audio'
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice & Audio</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'system'
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Instructions</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* LLM Engine Tab */}
          {activeTab === 'llm' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Active AI Provider</label>
                <select
                  value={localConfig.provider}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, provider: e.target.value as LLMProvider })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="gemini">Google Gemini (Recommended - Free & Fast 1M Context)</option>
                  <option value="ollama">Ollama (Local Offline LLM - llama3.1 / qwen2.5-coder)</option>
                  <option value="openai">OpenAI (GPT-4o-mini / GPT-4o)</option>
                  <option value="llamacpp">Llama.cpp (Local GGUF Server)</option>
                  <option value="anthropic">Anthropic Claude (3.5 Sonnet)</option>
                </select>
              </div>

              {localConfig.provider === 'gemini' && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-brand-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-300 flex items-center space-x-1">
                      <Zap className="w-3.5 h-3.5 text-accent-cyan" />
                      <span>Google Gemini Configuration</span>
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-accent-cyan hover:underline text-[11px]"
                    >
                      <span>Get Free API Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Gemini API Key</label>
                    <input
                      type="password"
                      value={localConfig.geminiApiKey}
                      onChange={(e) => setLocalConfig({ ...localConfig, geminiApiKey: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white font-mono"
                      placeholder="Paste your Gemini API key (starts with AIzaSy...)"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Gemini Model</label>
                    <select
                      value={localConfig.geminiModel || 'gemini-1.5-flash'}
                      onChange={(e) => setLocalConfig({ ...localConfig, geminiModel: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white text-xs"
                    >
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Recommended - Super Fast & 1M Context)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning & Coding)</option>
                      <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Experimental Next-Gen)</option>
                    </select>
                  </div>
                </div>
              )}

              {localConfig.provider === 'ollama' && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                    💡 <strong>To use Ollama offline:</strong> Install from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline">ollama.com</a> and run:
                    <code className="block mt-1 text-accent-cyan font-mono">ollama run llama3.1</code>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Ollama Server Endpoint</label>
                    <input
                      type="text"
                      value={localConfig.ollamaUrl}
                      onChange={(e) => setLocalConfig({ ...localConfig, ollamaUrl: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Model Name</label>
                    <input
                      type="text"
                      value={localConfig.ollamaModel}
                      onChange={(e) => setLocalConfig({ ...localConfig, ollamaModel: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white font-mono"
                      placeholder="llama3.1:latest, qwen2.5-coder:latest"
                    />
                  </div>
                </div>
              )}

              {localConfig.provider === 'openai' && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div>
                    <label className="block text-slate-400 mb-1">OpenAI API Key</label>
                    <input
                      type="password"
                      value={localConfig.openaiApiKey}
                      onChange={(e) => setLocalConfig({ ...localConfig, openaiApiKey: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white font-mono"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Model</label>
                    <input
                      type="text"
                      value={localConfig.openaiModel}
                      onChange={(e) => setLocalConfig({ ...localConfig, openaiModel: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-white font-mono"
                      placeholder="gpt-4o-mini"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Creativity / Temperature ({localConfig.temperature})
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={localConfig.temperature}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, temperature: parseFloat(e.target.value) })
                  }
                  className="w-full accent-brand-500"
                />
              </div>
            </div>
          )}

          {/* Voice & Dictation Tab */}
          {activeTab === 'audio' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Voice Activation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLocalAudio({ ...localAudio, voiceMode: 'push-to-talk' })}
                    className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                      localAudio.voiceMode === 'push-to-talk'
                        ? 'bg-brand-950/60 border-brand-500 text-brand-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold">Push-to-Talk</div>
                    <div className="text-[10px] text-slate-500">Hold Space or mic button to speak</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalAudio({ ...localAudio, voiceMode: 'voice-activated' })}
                    className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                      localAudio.voiceMode === 'voice-activated'
                        ? 'bg-brand-950/60 border-brand-500 text-brand-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold">Voice-Activated (VAD)</div>
                    <div className="text-[10px] text-slate-500">Automatic speech detection</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  VAD Sensitivity Threshold ({localAudio.vadSensitivity})
                </label>
                <input
                  type="range"
                  min="0.005"
                  max="0.06"
                  step="0.002"
                  value={localAudio.vadSensitivity}
                  onChange={(e) =>
                    setLocalAudio({ ...localAudio, vadSensitivity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Push-to-Talk Key</label>
                <input
                  type="text"
                  value={localAudio.pushToTalkKey}
                  onChange={(e) => setLocalAudio({ ...localAudio, pushToTalkKey: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  placeholder="Space"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localAudio.smartPunctuation}
                    onChange={(e) =>
                      setLocalAudio({ ...localAudio, smartPunctuation: e.target.checked })
                    }
                    className="accent-brand-500 rounded"
                  />
                  <span className="text-slate-300">Enable Smart Punctuation (auto replaces "comma", "period", etc.)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localAudio.autoCapitalize}
                    onChange={(e) =>
                      setLocalAudio({ ...localAudio, autoCapitalize: e.target.checked })
                    }
                    className="accent-brand-500 rounded"
                  />
                  <span className="text-slate-300">Auto-capitalize first letters of sentences</span>
                </label>
              </div>
            </div>
          )}

          {/* System Prompt Tab */}
          {activeTab === 'system' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Your Name</label>
                <input
                  type="text"
                  value={localConfig.userName || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, userName: e.target.value })}
                  placeholder="Your Name (e.g. Harsh)..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-slate-300 font-semibold">System Instructions & Companion Role</label>
                <textarea
                  rows={8}
                  value={localConfig.systemPrompt}
                  onChange={(e) => setLocalConfig({ ...localConfig, systemPrompt: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-3 border-t border-surfaceBorder bg-slate-900/50 space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium flex items-center space-x-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
