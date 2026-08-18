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
          description: 'Starting folder directory path. If omitted or empty, searches from the user home directory.',
        },
        extensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of file extensions to filter by without dot (e.g. ["pdf", "docx", "rs", "json"]).',
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
          description: 'Due date/time in ISO-8601 string format (e.g. "2026-08-19T14:30:00Z" or "2026-08-20T09:00:00").',
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
          description: 'Minutes before due_date to trigger the desktop reminder notification (e.g. 10).',
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
    name: 'delete_task',
    description: 'Deletes a scheduled task by its unique ID.',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The unique UUID of the task to delete.',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'system_status',
    description: 'Retrieves real-time OS hardware telemetry including CPU utilization %, RAM usage, swap space, disk partition storage, and system uptime.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'open_file_path',
    description: 'Opens a local file or folder directory in the default system file manager or application (Windows Explorer, macOS Finder, Linux xdg-open).',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative file/directory path to open.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'send_desktop_notification',
    description: 'Pushes an immediate native desktop notification banner with a custom title and message body.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Notification title header.',
        },
        body: {
          type: 'string',
          description: 'Notification message body.',
        },
      },
      required: ['title', 'body'],
    },
  },
];

// Convert to OpenAI / Ollama tools format
export function getOpenAITools() {
  return SYSTEM_TOOLS.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Convert to Gemini FunctionDeclarations format
export function getGeminiFunctionDeclarations() {
  return [
    {
      functionDeclarations: SYSTEM_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties: Object.entries(t.parameters.properties).reduce((acc, [key, prop]) => {
            acc[key] = {
              type: prop.type.toUpperCase(),
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
