import { ChatMessage, ToolCall } from '../types';

export interface LocalEngineResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export class LocalKnowledgeEngine {
  public static processQuery(messages: ChatMessage[], _config?: { githubToken?: string; googleAccessToken?: string }): LocalEngineResponse {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const query = (lastUserMsg?.content || '').trim().toLowerCase();

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    // -------------------------------------------------------------
    // 1. Date & Time Queries
    // -------------------------------------------------------------
    if (
      query.includes("date") ||
      query.includes("what day") ||
      query.includes("today") ||
      query.includes("time is it") ||
      query.includes("current time") ||
      query.includes("what year") ||
      query.includes("what month")
    ) {
      return {
        content: `📅 **Today's Date & Time:**\n- **Date:** ${dateFormatted}\n- **Current Time:** ${timeFormatted}\n- **Timezone:** ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n\n*How can I help with your coding, GitHub repos, or college calendar today?*`,
      };
    }

    // -------------------------------------------------------------
    // 2. Git & GitHub Repository Automation
    // -------------------------------------------------------------
    if (query.includes('push') || query.includes('commit') || query.includes('git status') || query.includes('create repo') || query.includes('github')) {
      if (query.includes('create') && (query.includes('repo') || query.includes('repository'))) {
        let repoName = 'cs-coursework-project';
        const match = query.match(/create (?:a )?(?:new )?(?:repo|repository) (?:named |called )?([a-zA-Z0-9_-]+)/i);
        if (match && match[1]) {
          repoName = match[1];
        }

        return {
          content: `Creating new repository **${repoName}** on your GitHub profile and pushing current code...`,
          toolCalls: [
            {
              id: 'call_git_create_' + Date.now(),
              name: 'git_create_repo',
              arguments: {
                repo_name: repoName,
                is_private: false,
                description: 'Created with Local Voice AI Assistant',
              },
            },
          ],
        };
      }

      if (query.includes('status')) {
        return {
          content: `Checking git status and modified files in your project directory...`,
          toolCalls: [
            {
              id: 'call_git_status_' + Date.now(),
              name: 'git_status_check',
              arguments: {},
            },
          ],
        };
      }

      // Default: commit and push
      let commitMsg = 'Update code files and assignment solutions';
      if (query.includes('with message') || query.includes('saying')) {
        commitMsg = query.split(/with message|saying/i)[1]?.trim() || commitMsg;
      }

      return {
        content: `Staging project changes and pushing to your remote GitHub repository...`,
        toolCalls: [
          {
            id: 'call_git_push_' + Date.now(),
            name: 'git_commit_and_push',
            arguments: {
              commit_message: commitMsg,
              branch: 'main',
            },
          },
        ],
      };
    }

    // -------------------------------------------------------------
    // 3. Gmail Integration: Send Email Intent
    // -------------------------------------------------------------
    if (query.startsWith('send email') || query.startsWith('send mail') || query.includes('mail to') || query.includes('email to')) {
      let recipient = 'professor@university.edu';
      let subject = 'CS Coursework / Assignment Update';
      let body = 'Hello,\n\nPlease find attached my assignment updates.\n\nBest regards,\nStudent';

      const emailMatch = query.match(/to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch && emailMatch[1]) {
        recipient = emailMatch[1];
      }

      if (query.includes('about') || query.includes('regarding')) {
        subject = query.split(/about|regarding/i)[1]?.split(/saying|body/i)[0]?.trim() || subject;
      }

      return {
        content: `Drafting and sending email to **${recipient}** via Gmail...`,
        toolCalls: [
          {
            id: 'call_gmail_' + Date.now(),
            name: 'gmail_send_message',
            arguments: {
              to: recipient,
              subject: subject.charAt(0).toUpperCase() + subject.slice(1),
              body: body,
            },
          },
        ],
      };
    }

    // -------------------------------------------------------------
    // 4. Google Calendar Integration: Add Event Intent
    // -------------------------------------------------------------
    if (query.includes('calendar') || (query.includes('mark') && (query.includes('exam') || query.includes('deadline')))) {
      let eventTitle = 'Exam / Assignment Deadline';
      if (query.includes('mark ') || query.includes('add ')) {
        eventTitle = query.replace(/^(mark|add|schedule)\s+/i, '').split(/on|at|for/i)[0]?.trim() || eventTitle;
      }

      const start = new Date(Date.now() + 86400 * 1000).toISOString();
      const end = new Date(Date.now() + 86400 * 1000 + 3600 * 1000).toISOString();

      return {
        content: `Marking **"${eventTitle}"** on your Google Calendar...`,
        toolCalls: [
          {
            id: 'call_cal_' + Date.now(),
            name: 'calendar_add_event',
            arguments: {
              title: eventTitle.charAt(0).toUpperCase() + eventTitle.slice(1),
              start_time: start,
              end_time: end,
              description: 'Scheduled via Voice AI Assistant',
            },
          },
        ],
      };
    }

    // -------------------------------------------------------------
    // 5. Hardware NPU & CPU Compute Acceleration
    // -------------------------------------------------------------
    if (query.includes('compute') || query.includes('npu') || query.includes('hardware') || query.includes('benchmark') || query.includes('parallel')) {
      return {
        content: `Dispatching parallel multi-threaded compute task utilizing available CPU cores and NPU DirectML tensor pipeline...`,
        toolCalls: [
          {
            id: 'call_compute_' + Date.now(),
            name: 'run_hardware_compute',
            arguments: {
              task_type: 'prime_sieve',
              dataset_size: 3000000,
            },
          },
        ],
      };
    }

    // -------------------------------------------------------------
    // 6. Task Scheduling (SQLite)
    // -------------------------------------------------------------
    if (
      query.startsWith('schedule') ||
      query.startsWith('remind me') ||
      query.startsWith('add task') ||
      query.includes('remind me to')
    ) {
      let taskTitle = 'Study Session';
      if (query.includes('to ')) {
        taskTitle = query.split('to ')[1]?.split(' at ')[0]?.split(' on ')[0] || 'Study Task';
      } else if (query.includes('schedule ')) {
        taskTitle = query.replace('schedule ', '').split(' at ')[0]?.split(' on ')[0] || 'Assignment';
      }

      const dueDate = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

      return {
        content: `I've prepared the task schedule in SQLite:`,
        toolCalls: [
          {
            id: 'call_sched_' + Date.now(),
            name: 'schedule_task',
            arguments: {
              title: taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1),
              due_date: dueDate,
              description: 'CS Engineering Study & Homework Reminder',
              recurring: 'none',
              reminder_offset_mins: 10,
            },
          },
        ],
      };
    }

    // -------------------------------------------------------------
    // 7. File Search Intent
    // -------------------------------------------------------------
    if (
      query.startsWith('find') ||
      query.startsWith('search') ||
      query.includes('where is') ||
      query.includes('find my')
    ) {
      let searchTerm = query.replace(/^(find|search|where is|locate)\s+/i, '').replace(/^(my|the)\s+/i, '');
      const exts: string[] = [];

      if (query.includes('pdf')) exts.push('pdf');
      if (query.includes('notes') || query.includes('doc')) exts.push('md', 'docx', 'pdf', 'txt');
      if (query.includes('cpp') || query.includes('c++')) exts.push('cpp', 'h');
      if (query.includes('java')) exts.push('java');
      if (query.includes('python') || query.includes('py')) exts.push('py', 'ipynb');
      if (query.includes('rust')) exts.push('rs');
      if (query.includes('code') || query.includes('project')) exts.push('cpp', 'java', 'py', 'ts', 'js', 'rs', 'sql');

      return {
        content: `Searching your local filesystem for **"${searchTerm}"**...`,
        toolCalls: [
          {
            id: 'call_scan_' + Date.now(),
            name: 'scan_filesystem',
            arguments: {
              query: searchTerm.replace(/(files|notes|code|pdf|assignments)/gi, '').trim() || undefined,
              extensions: exts.length > 0 ? exts : undefined,
              max_results: 25,
            },
          },
        ],
      };
    }

    // -------------------------------------------------------------
    // 8. System Diagnostics
    // -------------------------------------------------------------
    if (query.includes('system') || query.includes('cpu') || query.includes('ram') || query.includes('memory') || query.includes('disk')) {
      return {
        content: `Querying real-time system performance telemetry...`,
        toolCalls: [
          {
            id: 'call_sys_' + Date.now(),
            name: 'system_status',
            arguments: {},
          },
        ],
      };
    }

    // -------------------------------------------------------------
    // 9. CS Engineering Knowledge Base
    // -------------------------------------------------------------
    if (query.includes('dsa') || query.includes('binary search') || query.includes('tree') || query.includes('graph')) {
      return {
        content: `### 🚀 Core Data Structures & Complexities\n\n| Data Structure | Access | Search | Insertion | Space |\n| :--- | :--- | :--- | :--- | :--- |\n| **Array** | $\\mathcal{O}(1)$ | $\\mathcal{O}(n)$ | $\\mathcal{O}(n)$ | $\\mathcal{O}(n)$ |\n| **Hash Table** | N/A | $\\mathcal{O}(1)$ avg | $\\mathcal{O}(1)$ avg | $\\mathcal{O}(n)$ |\n| **BST (Balanced)** | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(n)$ |\n| **Binary Heap** | $\\mathcal{O}(1)$ | $\\mathcal{O}(n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(n)$ |\n\n\`\`\`cpp\nint binarySearch(const vector<int>& arr, int target) {\n    int low = 0, high = arr.size() - 1;\n    while (low <= high) {\n        int mid = low + (high - low) / 2;\n        if (arr[mid] == target) return mid;\n        else if (arr[mid] < target) low = mid + 1;\n        else high = mid - 1;\n    }\n    return -1;\n}\n\`\`\``,
      };
    }

    return {
      content: `I'm your **Native Desktop CS Engineering Companion**. Today is **${dateFormatted}** (${timeFormatted}).\n\nHere are the OS & study tasks I can handle for you:\n- 🐙 **Git & GitHub:** Say *"Push my code to GitHub"* or *"Create a new repo for this project"*.\n- ✉️ **Gmail:** Say *"Send email to professor@college.edu about lab assignment"*.\n- 📅 **Google Calendar:** Say *"Mark OS exam on my Google Calendar for next Monday"*.\n- ⚡ **Offline NPU/CPU Compute:** Say *"Run parallel compute benchmark"* to utilize 100% of your CPU/NPU hardware.\n- 🔍 **Files & Notes:** Say *"Find my DBMS pdf notes"* to crawl your local disk.`,
    };
  }
}
