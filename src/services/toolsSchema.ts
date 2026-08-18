export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required: string[];
  };
}

export const SYSTEM_TOOLS: ToolDefinition[] = [
  {
    name: 'scan_filesystem',
    description: 'Recursively scans local filesystem directories with high-speed multi-threaded search to find files matching query names, paths, or file extensions.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Filename, keyword, or regex pattern to search for (e.g. "invoice", "main.rs", "budget").',
        },
        path: {
          type: 'string',
          description: 'Starting folder directory path. If omitted or empty, searches from current or home directory.',
        },
        extensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of file extensions to filter by without dot (e.g. ["pdf", "docx", "rs", "cpp", "java", "py"]).',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default 30).',
        },
      },
      required: [],
    },
  },
  {
    name: 'schedule_task',
    description: 'Schedules a persistent task, reminder, or event in the local SQLite database and triggers desktop notifications.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the task or reminder.',
        },
        due_date: {
          type: 'string',
          description: 'Due date/time in ISO-8601 string format (e.g. "2026-08-19T14:30:00Z").',
        },
        description: {
          type: 'string',
          description: 'Optional detailed description or notes for the task.',
        },
        recurring: {
          type: 'string',
          enum: ['none', 'daily', 'weekly', 'monthly'],
          description: 'Recurrence frequency if the task repeats.',
        },
        reminder_offset_mins: {
          type: 'number',
          description: 'Minutes before due_date to trigger the desktop reminder notification.',
        },
      },
      required: ['title', 'due_date'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Lists all scheduled tasks, reminders, and their current completion/due status from the SQLite database.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'system_status',
    description: 'Retrieves real-time OS hardware telemetry including CPU utilization %, RAM usage, swap space, and disk partitions.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_status_check',
    description: 'Inspects the git status of a local project directory (modified files, untracked files, branch).',
    parameters: {
      type: 'object',
      properties: {
        folder_path: {
          type: 'string',
          description: 'Path of the local repository directory. Defaults to current directory.',
        },
      },
      required: [],
    },
  },
  {
    name: 'git_commit_and_push',
    description: 'Stages all project code (git add .), creates a commit with an informative commit message, and pushes to remote GitHub repository.',
    parameters: {
      type: 'object',
      properties: {
        folder_path: {
          type: 'string',
          description: 'Local repository folder path. Defaults to current directory.',
        },
        commit_message: {
          type: 'string',
          description: 'Descriptive commit message summarizing code changes.',
        },
        branch: {
          type: 'string',
          description: 'Target git branch to push to (defaults to "main").',
        },
      },
      required: ['commit_message'],
    },
  },
  {
    name: 'git_create_repo',
    description: 'Creates a new remote repository on GitHub via API, links the local folder, and pushes the initial code commit.',
    parameters: {
      type: 'object',
      properties: {
        repo_name: {
          type: 'string',
          description: 'Name of the repository to create on GitHub.',
        },
        is_private: {
          type: 'boolean',
          description: 'Whether the GitHub repo should be private (true) or public (false).',
        },
        description: {
          type: 'string',
          description: 'Repository description.',
        },
        local_folder_path: {
          type: 'string',
          description: 'Path of the local project directory to link and push.',
        },
      },
      required: ['repo_name'],
    },
  },
  {
    name: 'gmail_send_message',
    description: 'Sends an email from your connected Gmail account to specified recipients.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address (e.g. professor@university.edu).',
        },
        subject: {
          type: 'string',
          description: 'Email subject line.',
        },
        body: {
          type: 'string',
          description: 'Body text content of the email.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'gmail_list_messages',
    description: 'Searches and lists emails in your Gmail inbox based on a search query (e.g. "from:professor", "subject:exam", "is:unread", "interview").',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query string (e.g. "from:google", "exam", "is:unread").',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of emails to retrieve (default 10).',
        },
      },
      required: [],
    },
  },
  {
    name: 'gmail_read_message',
    description: 'Reads the full content and plain-text body of a specific email by its message ID.',
    parameters: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The unique message ID of the email to read.',
        },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'calendar_add_event',
    description: 'Marks an important date, exam, submission deadline, or study block directly on your Google Calendar.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Event title (e.g. "Data Structures Exam", "OS Lab Submission").',
        },
        start_time: {
          type: 'string',
          description: 'Start date/time in ISO-8601 format (e.g. "2026-08-20T10:00:00Z").',
        },
        end_time: {
          type: 'string',
          description: 'End date/time in ISO-8601 format.',
        },
        description: {
          type: 'string',
          description: 'Additional notes or syllabus topics for the calendar event.',
        },
      },
      required: ['title', 'start_time', 'end_time'],
    },
  },
  {
    name: 'run_hardware_compute',
    description: 'Executes heavy offline compute tasks utilizing 100% of CPU cores, AVX2 SIMD, and NPU neural acceleration.',
    parameters: {
      type: 'object',
      properties: {
        task_type: {
          type: 'string',
          enum: ['prime_sieve', 'matrix_dot_product', 'vector_benchmark'],
          description: 'Type of parallel compute task to execute.',
        },
        dataset_size: {
          type: 'number',
          description: 'Dataset size or computation iterations.',
        },
      },
      required: ['task_type'],
    },
  },
];

export function getOpenAITools() {
  return SYSTEM_TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function getGeminiFunctionDeclarations() {
  return [
    {
      functionDeclarations: SYSTEM_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties: Object.entries(t.parameters.properties).reduce((acc, [key, prop]) => {
            acc[key] = {
              type: prop.type === 'array' ? 'ARRAY' : prop.type.toUpperCase(),
              description: prop.description,
              ...(prop.enum ? { enum: prop.enum } : {}),
            };
            return acc;
          }, {} as Record<string, any>),
          required: t.parameters.required,
        },
      })),
    },
  ];
}
