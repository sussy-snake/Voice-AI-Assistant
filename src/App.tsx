import { useState, useEffect, useCallback } from 'react';
import { LLMConfig, AudioSettings, VoiceMode } from './types';
import { useAudioPipeline } from './hooks/useAudioPipeline';
import { useAgentOrchestrator } from './hooks/useAgentOrchestrator';
import { Header } from './components/Header';
import { ChatInterface } from './components/ChatInterface';
import { TaskManagerModal } from './components/TaskManagerModal';
import { FileExplorerModal } from './components/FileExplorerModal';
import { SettingsModal } from './components/SettingsModal';
import { GitIntegrationModal } from './components/GitIntegrationModal';
import { GoogleIntegrationModal } from './components/GoogleIntegrationModal';
import { RAGKnowledgeModal } from './components/RAGKnowledgeModal';
import { isTauri } from './services/tauriBridge';
import { initializePresetKnowledge } from './services/rag/presetKnowledge';

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'gemini',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1:latest',
  llamacppUrl: 'http://localhost:8080',
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  githubToken: '',
  googleAccessToken: '',
  googleRefreshToken: '',
  systemPrompt:
    'You are a high-performance local AI Companion, Voice RAG Engine, and Computer Science Assistant styled after G-Helper.\n' +
    'You have direct access to local system tools, grounded vector retrieval, and cloud integrations:\n' +
    '- `rag_retrieve`: Search indexed documents for grounded citations and facts.\n' +
    '- `git_create_repo` & `git_commit_and_push`: To manage GitHub repositories, stage, commit, and push code.\n' +
    '- `gmail_send_message`, `gmail_list_messages`, `gmail_read_message`: Full Gmail management.\n' +
    '- `calendar_add_event`: To mark deadlines and exams on Google Calendar.\n' +
    '- `scan_filesystem`: To locate user files, documents, codebases, and notes.\n' +
    '- `schedule_task`: To schedule local reminders with desktop notifications in SQLite.\n' +
    '- `run_hardware_compute`: To run parallel offline compute utilizing full CPU cores and NPU DirectML.\n' +
    '- `system_status`: To inspect live CPU load, RAM usage, and disk storage.\n\n' +
    'Be concise, intelligent, empathetic, and execute appropriate tools directly when requested by the user.',
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

  // Modal dialog states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isRAGModalOpen, setIsRAGModalOpen] = useState(false);

  // Initialize preset RAG knowledge documents
  useEffect(() => {
    initializePresetKnowledge();
  }, []);

  // Initialize Agent Orchestrator
  const {
    messages,
    isProcessing,
    activeToolRunning,
    sendMessage,
    stopGeneration,
    clearChat,
  } = useAgentOrchestrator(config);

  // Voice callback
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

  const handleSaveConfig = (newConfig: LLMConfig) => {
    setConfig(newConfig);
    localStorage.setItem('voice_ai_llm_config', JSON.stringify(newConfig));
  };

  const handleSaveAudioSettings = (newAudio: AudioSettings) => {
    setAudioSettings(newAudio);
    localStorage.setItem('voice_ai_audio_settings', JSON.stringify(newAudio));
  };

  const handleSaveGitHubToken = (token: string) => {
    const updated = { ...config, githubToken: token };
    setConfig(updated);
    localStorage.setItem('voice_ai_llm_config', JSON.stringify(updated));
  };

  const handleSaveGoogleTokens = (accessToken: string, refreshToken?: string) => {
    const updated = {
      ...config,
      googleAccessToken: accessToken,
      googleRefreshToken: refreshToken || config.googleRefreshToken,
    };
    setConfig(updated);
    localStorage.setItem('voice_ai_llm_config', JSON.stringify(updated));
  };

  const toggleVoiceMode = () => {
    const nextMode: VoiceMode = audioSettings.voiceMode === 'push-to-talk' ? 'voice-activated' : 'push-to-talk';
    const updated: AudioSettings = { ...audioSettings, voiceMode: nextMode };
    setAudioSettings(updated);
    localStorage.setItem('voice_ai_audio_settings', JSON.stringify(updated));
  };

  // Setup Tauri desktop event listeners & Global Shortcuts
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
      {/* Sleek G-Helper Top Header with RAG and Telemetry */}
      <Header
        config={config}
        voiceMode={audioSettings.voiceMode}
        isListening={audioState.isListening}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenFileExplorer={() => setIsFileExplorerOpen(true)}
        onOpenTaskManager={() => setIsTaskManagerOpen(true)}
        onOpenGitModal={() => setIsGitModalOpen(true)}
        onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        onOpenRAGModal={() => setIsRAGModalOpen(true)}
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

      <RAGKnowledgeModal
        isOpen={isRAGModalOpen}
        onClose={() => setIsRAGModalOpen(false)}
      />

      <GitIntegrationModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
        githubToken={config.githubToken}
        onSaveToken={handleSaveGitHubToken}
      />

      <GoogleIntegrationModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        googleToken={config.googleAccessToken}
        googleRefreshToken={config.googleRefreshToken}
        onSaveTokens={handleSaveGoogleTokens}
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
