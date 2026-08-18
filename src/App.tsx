import { useState, useEffect, useCallback } from 'react';
import { LLMConfig, AudioSettings, VoiceMode } from './types';
import { useAudioPipeline } from './hooks/useAudioPipeline';
import { useAgentOrchestrator } from './hooks/useAgentOrchestrator';
import { Header } from './components/Header';
import { ChatInterface } from './components/ChatInterface';
import { TaskManagerModal } from './components/TaskManagerModal';
import { FileExplorerModal } from './components/FileExplorerModal';
import { SettingsModal } from './components/SettingsModal';
import { isTauri } from './services/tauriBridge';

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1:latest',
  llamacppUrl: 'http://localhost:8080',
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  systemPrompt:
    'You are a high-performance local Voice AI Assistant styled after G-Helper. You have access to local system tools:\n' +
    '- `scan_filesystem`: To locate user files, documents, codebases, and media.\n' +
    '- `schedule_task`: To schedule reminders, calendar events, or recurring tasks.\n' +
    '- `list_tasks`: To query existing scheduled tasks.\n' +
    '- `system_status`: To inspect live CPU load, RAM usage, and disk partitions.\n' +
    '- `open_file_path`: To open files or folders in the system file manager.\n' +
    '- `send_desktop_notification`: To trigger OS notifications.\n\n' +
    'Be concise, helpful, and execute appropriate tools directly when requested by the user.',
  temperature: 0.7,
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  voiceMode: 'push-to-talk',
  vadSensitivity: 0.015,
  pushToTalkKey: 'Space',
  whisperEndpoint: 'http://localhost:8000',
  useWebSpeechFallback: true,
  smartPunctuation: true,
  autoCapitalize: true,
};

export function App() {
  // Load persistent configurations
  const [config, setConfig] = useState<LLMConfig>(() => {
    try {
      const saved = localStorage.getItem('voice_ai_llm_config');
      return saved ? { ...DEFAULT_LLM_CONFIG, ...JSON.parse(saved) } : DEFAULT_LLM_CONFIG;
    } catch {
      return DEFAULT_LLM_CONFIG;
    }
  });

  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    try {
      const saved = localStorage.getItem('voice_ai_audio_settings');
      return saved ? { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(saved) } : DEFAULT_AUDIO_SETTINGS;
    } catch {
      return DEFAULT_AUDIO_SETTINGS;
    }
  });

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);

  // Initialize Agent Orchestrator
  const {
    messages,
    isProcessing,
    activeToolRunning,
    sendMessage,
    stopGeneration,
    clearChat,
  } = useAgentOrchestrator(config);

  // Audio Callback when user completes speech
  const handleTranscriptionComplete = useCallback(
    (transcript: string) => {
      if (transcript.trim()) {
        sendMessage(transcript.trim());
      }
    },
    [sendMessage]
  );

  // Initialize Audio Pipeline
  const {
    audioState,
    startListening,
    stopListening,
  } = useAudioPipeline({
    settings: audioSettings,
    onTranscriptionComplete: handleTranscriptionComplete,
  });

  // Save changes to local storage
  const handleSaveConfig = (newConfig: LLMConfig) => {
    setConfig(newConfig);
    localStorage.setItem('voice_ai_llm_config', JSON.stringify(newConfig));
  };

  const handleSaveAudioSettings = (newAudio: AudioSettings) => {
    setAudioSettings(newAudio);
    localStorage.setItem('voice_ai_audio_settings', JSON.stringify(newAudio));
  };

  const toggleVoiceMode = () => {
    const nextMode: VoiceMode = audioSettings.voiceMode === 'push-to-talk' ? 'voice-activated' : 'push-to-talk';
    const updated: AudioSettings = { ...audioSettings, voiceMode: nextMode };
    setAudioSettings(updated);
    localStorage.setItem('voice_ai_audio_settings', JSON.stringify(updated));
  };

  // Setup Tauri desktop event listeners
  useEffect(() => {
    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        const unlisten = listen('task-due', (event: any) => {
          console.info('Task Due Event:', event.payload);
        });
        return () => {
          unlisten.then((fn) => fn());
        };
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-slate-100 font-sans overflow-hidden">
      {/* Sleek G-Helper Top Header */}
      <Header
        config={config}
        voiceMode={audioSettings.voiceMode}
        isListening={audioState.isListening}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenFileExplorer={() => setIsFileExplorerOpen(true)}
        onOpenTaskManager={() => setIsTaskManagerOpen(true)}
        onToggleVoiceMode={toggleVoiceMode}
      />

      {/* Main Chat & Voice Dashboard */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <ChatInterface
          messages={messages}
          isProcessing={isProcessing}
          activeToolRunning={activeToolRunning}
          interimTranscript={audioState.interimTranscript}
          isListening={audioState.isListening}
          isSpeaking={audioState.isSpeaking}
          volume={audioState.volume}
          voiceMode={audioSettings.voiceMode}
          onSendMessage={sendMessage}
          onStopGeneration={stopGeneration}
          onStartListening={startListening}
          onStopListening={stopListening}
          onClearChat={clearChat}
        />
      </main>

      {/* Modal Dialogs */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        audioSettings={audioSettings}
        onSaveConfig={handleSaveConfig}
        onSaveAudioSettings={handleSaveAudioSettings}
      />

      <FileExplorerModal
        isOpen={isFileExplorerOpen}
        onClose={() => setIsFileExplorerOpen(false)}
      />

      <TaskManagerModal
        isOpen={isTaskManagerOpen}
        onClose={() => setIsTaskManagerOpen(false)}
      />
    </div>
  );
}

export default App;
