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

export interface HardwareComputeProfile {
  cpu_cores_logical: number;
  cpu_cores_physical?: number | null;
  cpu_brand: string;
  avx2_supported: boolean;
  npu_detected: boolean;
  npu_type: string;
  directml_gpu_detected: boolean;
  max_compute_threads: number;
  compute_mode: string;
}

export interface ComputeTaskResult {
  task_name: string;
  elapsed_ms: number;
  threads_used: number;
  hardware_backend: string;
  result_summary: string;
}

export interface GitStatusResult {
  is_repo: boolean;
  current_branch: string;
  status_text: string;
  modified_files: string[];
  untracked_files: string[];
  clean: boolean;
}

export interface GitHubRepo {
  name: string;
  html_url: string;
  clone_url: string;
  private: boolean;
  description?: string | null;
}

export interface GitOperationResult {
  success: boolean;
  message: string;
  output?: string | null;
  repo_url?: string | null;
}

export interface CalendarEventItem {
  id: string;
  summary: string;
  start_time: string;
  end_time: string;
  description?: string | null;
  html_link?: string | null;
}

export interface GoogleOperationResult {
  success: boolean;
  message: string;
  details?: string | null;
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
  githubToken?: string;
  googleAccessToken?: string;
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
  vadSensitivity: number;
  pushToTalkKey: string;
  whisperEndpoint: string;
  useWebSpeechFallback: boolean;
  smartPunctuation: boolean;
  autoCapitalize: boolean;
}

export interface AudioState {
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
}
