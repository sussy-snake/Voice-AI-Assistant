export type LLMProvider = 'ollama' | 'llamacpp' | 'gemini' | 'openai' | 'anthropic';

export type VoiceMode = 'push-to-talk' | 'voice-activated';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  due_date: string;
  recurring?: 'daily' | 'weekly' | 'monthly' | 'none' | null;
  reminder_offset_mins: number;
  is_completed: boolean;
  notified: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileMatch {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
  extension?: string | null;
  modified_at?: number | null;
}

export interface DiskMetric {
  name: string;
  mount_point: string;
  total_space_gb: number;
  available_space_gb: number;
  used_space_gb: number;
  usage_percent: number;
}

export interface SystemStatus {
  cpu_usage_percent: number;
  cpu_cores: number;
  cpu_brand: string;
  total_memory_mb: number;
  used_memory_mb: number;
  memory_usage_percent: number;
  total_swap_mb: number;
  used_swap_mb: number;
  uptime_seconds: number;
  os_name: string;
  kernel_version: string;
  host_name: string;
  disks: DiskMetric[];
}

export interface LLMConfig {
  provider: LLMProvider;
  ollamaUrl: string;
  ollamaModel: string;
  llamacppUrl: string;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  systemPrompt: string;
  temperature: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: any;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
}

export interface AudioSettings {
  voiceMode: VoiceMode;
  vadSensitivity: number; // 0.005 to 0.08
  pushToTalkKey: string; // e.g. "Space"
  whisperEndpoint: string;
  useWebSpeechFallback: boolean;
  smartPunctuation: boolean;
  autoCapitalize: boolean;
}

export interface AudioState {
  isListening: boolean;
  isSpeaking: boolean;
  volume: number; // 0.0 to 1.0
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
}
