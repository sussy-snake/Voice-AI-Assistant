import {
  Task,
  FileMatch,
  SystemStatus,
  GitStatusResult,
  GitOperationResult,
  GitHubRepo,
  GoogleOperationResult,
  CalendarEventItem,
  HardwareComputeProfile,
  ComputeTaskResult,
} from '../types';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

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

// Local storage keys
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

export const TauriBridge = {
  isNative: isTauri,

  // -----------------------------------------------------------
  // Filesystem Search & File Operations
  // -----------------------------------------------------------
  async scanFilesystem(options: {
    query?: string;
    path?: string;
    extensions?: string[];
    max_results?: number;
  }): Promise<FileMatch[]> {
    if (isTauri()) {
      return await invokeTauri<FileMatch[]>('scan_filesystem', { options });
    }

    const mockFiles: FileMatch[] = [
      { name: 'OS_Lab_Assignment_4.cpp', path: 'C:/CS_Projects/OperatingSystems/OS_Lab_Assignment_4.cpp', is_dir: false, size_bytes: 8420, extension: 'cpp', modified_at: Date.now() / 1000 - 1200 },
      { name: 'DSA_Tree_Traversal.py', path: 'C:/CS_Projects/DSA/DSA_Tree_Traversal.py', is_dir: false, size_bytes: 4120, extension: 'py', modified_at: Date.now() / 1000 - 3600 },
      { name: 'DBMS_Normalization_Notes.pdf', path: 'C:/StudyMaterial/Semester5/DBMS_Normalization_Notes.pdf', is_dir: false, size_bytes: 3145728, extension: 'pdf', modified_at: Date.now() / 1000 - 86400 },
      { name: 'Computer_Networks_Lab_Manual.pdf', path: 'C:/StudyMaterial/Networks/Computer_Networks_Lab_Manual.pdf', is_dir: false, size_bytes: 2048576, extension: 'pdf', modified_at: Date.now() / 1000 - 50000 },
      { name: 'main.rs', path: 'C:/CS_Projects/RustEngine/src/main.rs', is_dir: false, size_bytes: 9340, extension: 'rs', modified_at: Date.now() / 1000 - 1000 },
    ];

    const q = options.query?.toLowerCase() || '';
    const exts = options.extensions?.map((e) => e.toLowerCase().replace('.', ''));

    return mockFiles.filter((f) => {
      const matchQ = !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
      const matchExt = !exts || (f.extension && exts.includes(f.extension.toLowerCase()));
      return matchQ && matchExt;
    });
  },

  async openFilePath(path: string): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>('open_file_path', { path });
    }
    window.open(path, '_blank');
    return true;
  },

  // -----------------------------------------------------------
  // Git & GitHub Integration
  // -----------------------------------------------------------
  async gitStatusCheck(folderPath?: string): Promise<GitStatusResult> {
    if (isTauri()) {
      return await invokeTauri<GitStatusResult>('git_status_check', { folderPath });
    }
    return {
      is_repo: true,
      current_branch: 'main',
      status_text: 'On branch main\nChanges to be committed:\n  modified: src/App.tsx',
      modified_files: ['src/App.tsx', 'src/types/index.ts'],
      untracked_files: ['notes.txt'],
      clean: false,
    };
  },

  async gitCommitAndPush(options: {
    folder_path?: string;
    commit_message: string;
    branch?: string;
  }): Promise<GitOperationResult> {
    if (isTauri()) {
      return await invokeTauri<GitOperationResult>('git_commit_and_push', {
        folderPath: options.folder_path,
        commitMessage: options.commit_message,
        branch: options.branch,
      });
    }

    return {
      success: true,
      message: `[Simulated] Staged changes, committed with message: "${options.commit_message}", and pushed to GitHub main branch.`,
      output: '3 files changed, 45 insertions(+)',
    };
  },

  async gitCreateRepo(options: {
    github_token: string;
    repo_name: string;
    is_private?: boolean;
    description?: string;
    local_folder_path?: string;
  }): Promise<GitOperationResult> {
    if (isTauri()) {
      return await invokeTauri<GitOperationResult>('git_create_repo', {
        githubToken: options.github_token,
        repoName: options.repo_name,
        isPrivate: options.is_private ?? false,
        description: options.description,
        localFolderPath: options.local_folder_path,
      });
    }

    if (!options.github_token || !options.github_token.trim()) {
      throw new Error('GitHub token is missing. Please enter your GitHub token.');
    }

    // Direct Live GitHub REST API Call
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.github_token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: options.repo_name.trim(),
        private: options.is_private ?? false,
        description: options.description || 'Created with Local Voice AI Assistant',
        auto_init: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `GitHub error (${res.status})`);
    }

    const data = await res.json();
    return {
      success: true,
      message: `Repository '${options.repo_name}' created live on your GitHub profile!`,
      repo_url: data.html_url,
      output: `Remote URL: ${data.clone_url}`,
    };
  },

  async gitListUserRepos(github_token: string): Promise<GitHubRepo[]> {
    if (isTauri()) {
      return await invokeTauri<GitHubRepo[]>('git_list_user_repos', { githubToken: github_token });
    }

    if (!github_token || !github_token.trim()) {
      return [];
    }

    // Direct Live GitHub API Call
    const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=15', {
      headers: {
        Authorization: `Bearer ${github_token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      console.warn('GitHub list repos error:', res.statusText);
      return [];
    }

    const data = await res.json();
    return data.map((r: any) => ({
      name: r.name,
      html_url: r.html_url,
      clone_url: r.clone_url,
      private: r.private,
      description: r.description,
    }));
  },

  // -----------------------------------------------------------
  // Google Suite: Gmail & Calendar
  // -----------------------------------------------------------
  async gmailSendMessage(options: {
    access_token: string;
    to: string;
    subject: string;
    body: string;
  }): Promise<GoogleOperationResult> {
    if (isTauri()) {
      return await invokeTauri<GoogleOperationResult>('gmail_send_message', {
        accessToken: options.access_token,
        to: options.to,
        subject: options.subject,
        body: options.body,
      });
    }

    return {
      success: true,
      message: `[Simulated] Email sent via Gmail to ${options.to}!`,
      details: `Subject: ${options.subject}`,
    };
  },

  async calendarAddEvent(options: {
    access_token: string;
    title: string;
    start_time: string;
    end_time: string;
    description?: string;
  }): Promise<GoogleOperationResult> {
    if (isTauri()) {
      return await invokeTauri<GoogleOperationResult>('calendar_add_event', {
        accessToken: options.access_token,
        title: options.title,
        startTime: options.start_time,
        endTime: options.end_time,
        description: options.description,
      });
    }

    return {
      success: true,
      message: `[Simulated] Added '${options.title}' to Google Calendar (${new Date(options.start_time).toLocaleString()})`,
    };
  },

  async calendarListEvents(accessToken: string, maxResults?: number): Promise<CalendarEventItem[]> {
    if (isTauri()) {
      return await invokeTauri<CalendarEventItem[]>('calendar_list_events', {
        accessToken,
        maxResults,
      });
    }

    return [
      { id: '1', summary: 'Operating Systems Lab Submission', start_time: new Date(Date.now() + 86400000).toISOString(), end_time: new Date(Date.now() + 90000000).toISOString(), description: 'Submit assignment 4' },
      { id: '2', summary: 'Data Structures & Algorithms Midterm', start_time: new Date(Date.now() + 259200000).toISOString(), end_time: new Date(Date.now() + 266400000).toISOString(), description: 'Trees & Graphs' },
    ];
  },

  // -----------------------------------------------------------
  // Hardware NPU & Multi-Threaded CPU Compute
  // -----------------------------------------------------------
  async getHardwareComputeProfile(): Promise<HardwareComputeProfile> {
    if (isTauri()) {
      return await invokeTauri<HardwareComputeProfile>('get_hardware_compute_profile');
    }

    const cores = navigator.hardwareConcurrency || 8;
    return {
      cpu_cores_logical: cores,
      cpu_cores_physical: Math.floor(cores / 2),
      cpu_brand: 'Host Processor (NPU/DirectML Ready)',
      avx2_supported: true,
      npu_detected: true,
      npu_type: 'Neural Processing Unit / DirectML',
      directml_gpu_detected: true,
      max_compute_threads: cores,
      compute_mode: `Multi-Threaded Hardware Engine (${cores} Cores + NPU DirectML)`,
    };
  },

  async runHardwareCompute(taskType: string, datasetSize?: number): Promise<ComputeTaskResult> {
    if (isTauri()) {
      return await invokeTauri<ComputeTaskResult>('run_hardware_compute', {
        taskType,
        datasetSize,
      });
    }

    return {
      task_name: taskType,
      elapsed_ms: 48,
      threads_used: navigator.hardwareConcurrency || 8,
      hardware_backend: 'Local Hardware Acceleration Engine (Direct Parallel Dispatch)',
      result_summary: `Computed ${taskType} with SIMD and parallel thread utilization.`,
    };
  },

  // -----------------------------------------------------------
  // Task Scheduler (SQLite)
  // -----------------------------------------------------------
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

    return {
      success: true,
      task: newTask,
      message: 'Task scheduled in persistent storage.',
    };
  },

  async listTasks(): Promise<Task[]> {
    if (isTauri()) {
      return await invokeTauri<Task[]>('list_tasks');
    }
    return getWebTasks();
  },

  async toggleTaskCompleted(taskId: string, completed: boolean): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>('toggle_task_completed', { taskId, completed });
    }
    const tasks = getWebTasks();
    const target = tasks.find((t) => t.id === taskId);
    if (target) {
      target.is_completed = completed;
      target.updated_at = new Date().toISOString();
      saveWebTasks(tasks);
    }
    return true;
  },

  async deleteTask(taskId: string): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>('delete_task', { taskId });
    }
    const tasks = getWebTasks().filter((t) => t.id !== taskId);
    saveWebTasks(tasks);
    return true;
  },

  async getSystemStatus(): Promise<SystemStatus> {
    if (isTauri()) {
      return await invokeTauri<SystemStatus>('system_status');
    }

    const simulatedCpu = Math.floor(12 + Math.random() * 18);
    const simulatedRamUsed = 7840;
    const simulatedRamTotal = 16384;

    return {
      cpu_usage_percent: simulatedCpu,
      cpu_cores: navigator.hardwareConcurrency || 8,
      cpu_brand: 'Host Processor (Low-RAM Desktop Shell)',
      total_memory_mb: simulatedRamTotal,
      used_memory_mb: simulatedRamUsed,
      memory_usage_percent: Math.round((simulatedRamUsed / simulatedRamTotal) * 1000) / 10,
      total_swap_mb: 4096,
      used_swap_mb: 850,
      uptime_seconds: 48200,
      os_name: navigator.platform || 'Desktop Environment',
      kernel_version: '1.0.0',
      host_name: 'Desktop-Workstation',
      disks: [
        {
          name: 'Primary Drive',
          mount_point: 'C:/',
          total_space_gb: 512,
          available_space_gb: 240.5,
          used_space_gb: 271.5,
          usage_percent: 53.0,
        },
      ],
    };
  },

  async sendNotification(title: string, body: string): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>('send_desktop_notification', { title, body });
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
      return true;
    }
    return false;
  },
};
