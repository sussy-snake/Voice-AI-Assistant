import { Task, FileMatch, SystemStatus } from '../types';

// Check if running within a native Tauri container
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Safe invoke wrapper for Tauri v2
async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(command, args);
    } catch (err) {
      console.error(`Tauri invoke error [${command}]:`, err);
      throw err;
    }
  }
  throw new Error('Not running inside Tauri runtime');
}

// -------------------------------------------------------------
// Web Fallback Storage & Mock Handlers
// -------------------------------------------------------------
const STORAGE_KEY_TASKS = 'voice_ai_web_tasks';

function getWebTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWebTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
}

// -------------------------------------------------------------
// Unified Bridge Interface
// -------------------------------------------------------------

export const TauriBridge = {
  isNative: isTauri,

  /**
   * High-speed filesystem crawler
   */
  async scanFilesystem(options: {
    query?: string;
    path?: string;
    extensions?: string[];
    max_results?: number;
  }): Promise<FileMatch[]> {
    if (isTauri()) {
      return await invokeTauri<FileMatch[]>('scan_filesystem', { options });
    }

    // Web Fallback: simulated directory search
    console.info('[Web Fallback] Simulating filesystem search for:', options);
    const mockFiles: FileMatch[] = [
      { name: 'document_q3_report.pdf', path: 'C:/Users/Documents/document_q3_report.pdf', is_dir: false, size_bytes: 2048576, extension: 'pdf', modified_at: Date.now() / 1000 - 3600 },
      { name: 'project_notes.md', path: 'C:/Users/Documents/project_notes.md', is_dir: false, size_bytes: 4096, extension: 'md', modified_at: Date.now() / 1000 - 86400 },
      { name: 'voice_pipeline.rs', path: 'C:/Projects/voice-assistant/src/voice_pipeline.rs', is_dir: false, size_bytes: 12400, extension: 'rs', modified_at: Date.now() / 1000 - 7200 },
      { name: 'invoice_march_2026.pdf', path: 'C:/Users/Finance/invoice_march_2026.pdf', is_dir: false, size_bytes: 1048576, extension: 'pdf', modified_at: Date.now() / 1000 - 50000 },
      { name: 'package.json', path: 'C:/Projects/app/package.json', is_dir: false, size_bytes: 1530, extension: 'json', modified_at: Date.now() / 1000 - 1000 },
      { name: 'voice_model_weights.bin', path: 'C:/LocalModels/whisper/voice_model_weights.bin', is_dir: false, size_bytes: 142000000, extension: 'bin', modified_at: Date.now() / 1000 - 90000 },
    ];

    const q = options.query?.toLowerCase() || '';
    const exts = options.extensions?.map(e => e.toLowerCase().replace('.', ''));

    return mockFiles.filter(f => {
      const matchQ = !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
      const matchExt = !exts || (f.extension && exts.includes(f.extension.toLowerCase()));
      return matchQ && matchExt;
    });
  },

  /**
   * Opens file or path in OS explorer
   */
  async openFilePath(path: string): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>('open_file_path', { path });
    }
    console.info('[Web Fallback] Open file path:', path);
    window.open(path, '_blank');
    return true;
  },

  /**
   * Schedule persistent task in SQLite
   */
  async scheduleTask(payload: {
    title: string;
    due_date: string;
    description?: string | null;
    recurring?: string | null;
    reminder_offset_mins?: number;
  }): Promise<{ success: boolean; task?: Task; message: string }> {
    if (isTauri()) {
      return await invokeTauri('schedule_task', { payload });
    }

    // Web Fallback: localStorage
    const tasks = getWebTasks();
    const newTask: Task = {
      id: 'task_' + Math.random().toString(36).substring(2, 9),
      title: payload.title,
      description: payload.description || null,
      due_date: payload.due_date,
      recurring: (payload.recurring as any) || null,
      reminder_offset_mins: payload.reminder_offset_mins || 0,
      is_completed: false,
      notified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    tasks.push(newTask);
    saveWebTasks(tasks);

    // Trigger web notification permission check
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Task Scheduled', {
        body: `'${newTask.title}' scheduled for ${newTask.due_date}`,
      });
    }

    return {
      success: true,
      task: newTask,
      message: 'Task scheduled in browser storage.',
    };
  },

  /**
   * Fetch all scheduled tasks
   */
  async listTasks(): Promise<Task[]> {
    if (isTauri()) {
      return await invokeTauri<Task[]>('list_tasks');
    }
    return getWebTasks();
  },

  /**
   * Toggle task completed state
   */
  async toggleTaskCompleted(taskId: string, completed: boolean): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>('toggle_task_completed', { taskId, completed });
    }
    const tasks = getWebTasks();
    const target = tasks.find(t => t.id === taskId);
    if (target) {
      target.is_completed = completed;
      target.updated_at = new Date().toISOString();
      saveWebTasks(tasks);
    }
    return true;
  },

  /**
   * Delete task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>('delete_task', { taskId });
    }
    const tasks = getWebTasks().filter(t => t.id !== taskId);
    saveWebTasks(tasks);
    return true;
  },

  /**
   * Query OS telemetry & hardware metrics
   */
  async getSystemStatus(): Promise<SystemStatus> {
    if (isTauri()) {
      return await invokeTauri<SystemStatus>('system_status');
    }

    // Web Fallback: simulated hardware info
    const simulatedCpu = Math.floor(12 + Math.random() * 18);
    const simulatedRamUsed = 7840;
    const simulatedRamTotal = 16384;

    return {
      cpu_usage_percent: simulatedCpu,
      cpu_cores: navigator.hardwareConcurrency || 8,
      cpu_brand: 'Host Processor (Web Browser Mode)',
      total_memory_mb: simulatedRamTotal,
      used_memory_mb: simulatedRamUsed,
      memory_usage_percent: Math.round((simulatedRamUsed / simulatedRamTotal) * 1000) / 10,
      total_swap_mb: 4096,
      used_swap_mb: 850,
      uptime_seconds: 48200,
      os_name: navigator.platform || 'Web Environment',
      kernel_version: 'Web Standard 1.0',
      host_name: 'Browser-Client',
      disks: [
        {
          name: 'Primary Drive',
          mount_point: '/',
          total_space_gb: 512,
          available_space_gb: 234.5,
          used_space_gb: 277.5,
          usage_percent: 54.2,
        },
      ],
    };
  },

  /**
   * Pushes desktop/browser notification
   */
  async sendNotification(title: string, body: string): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>('send_desktop_notification', { title, body });
    }

    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
        return true;
      } else if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          new Notification(title, { body });
          return true;
        }
      }
    }
    return false;
  },
};
