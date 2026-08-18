import { ChatMessage, ToolCall } from '../types';

export interface LocalEngineResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export class LocalKnowledgeEngine {
  public static processQuery(messages: ChatMessage[]): LocalEngineResponse {
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
        content: `📅 **Today's Date & Time:**\n- **Date:** ${dateFormatted}\n- **Current Time:** ${timeFormatted}\n- **Timezone:** ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n\n*How can I help with your CS engineering studies or daily tasks today?*`,
      };
    }

    // -------------------------------------------------------------
    // 2. Automated Tool Calling: Task Scheduling Intent
    // -------------------------------------------------------------
    if (
      query.startsWith('schedule') ||
      query.startsWith('remind me') ||
      query.startsWith('add task') ||
      query.includes('remind me to') ||
      query.includes('set a reminder')
    ) {
      let taskTitle = 'Study Session';
      if (query.includes('to ')) {
        taskTitle = query.split('to ')[1]?.split(' at ')[0]?.split(' on ')[0] || 'Study Task';
      } else if (query.includes('schedule ')) {
        taskTitle = query.replace('schedule ', '').split(' at ')[0]?.split(' on ')[0] || 'Assignment';
      }

      // Default due time 2 hours from now
      const dueDate = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

      return {
        content: `I've prepared the task schedule for you:`,
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
    // 3. Automated Tool Calling: File Search Intent
    // -------------------------------------------------------------
    if (
      query.startsWith('find') ||
      query.startsWith('search') ||
      query.includes('where is') ||
      query.includes('find my') ||
      query.includes('search files')
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
        content: `Searching your local filesystem for files matching **"${searchTerm}"**...`,
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
    // 4. Automated Tool Calling: System Diagnostics
    // -------------------------------------------------------------
    if (
      query.includes('system') ||
      query.includes('cpu') ||
      query.includes('ram') ||
      query.includes('memory') ||
      query.includes('disk') ||
      query.includes('hardware') ||
      query.includes('specs')
    ) {
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
    // 5. CS Engineering & Study Knowledge Base
    // -------------------------------------------------------------
    if (query.includes('dsa') || query.includes('data structure') || query.includes('binary search') || query.includes('tree') || query.includes('graph')) {
      return {
        content: `### 🚀 Core Data Structures & Time Complexities\n\n| Data Structure | Access | Search | Insertion | Deletion | Space |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| **Array** | $\\mathcal{O}(1)$ | $\\mathcal{O}(n)$ | $\\mathcal{O}(n)$ | $\\mathcal{O}(n)$ | $\\mathcal{O}(n)$ |\n| **Hash Table** | N/A | $\\mathcal{O}(1)$ avg | $\\mathcal{O}(1)$ avg | $\\mathcal{O}(1)$ avg | $\\mathcal{O}(n)$ |\n| **BST (Balanced)** | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(n)$ |\n| **Binary Heap** | $\\mathcal{O}(1)$ (min/max) | $\\mathcal{O}(n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(\\log n)$ | $\\mathcal{O}(n)$ |\n\n#### 💡 Standard Binary Search (C++ / Python):\n\`\`\`cpp\nint binarySearch(const vector<int>& arr, int target) {\n    int low = 0, high = arr.size() - 1;\n    while (low <= high) {\n        int mid = low + (high - low) / 2;\n        if (arr[mid] == target) return mid;\n        else if (arr[mid] < target) low = mid + 1;\n        else high = mid - 1;\n    }\n    return -1; // Not found\n}\n\`\`\`\n\n*Would you like me to analyze a specific algorithm or trace a problem step-by-step?*`,
      };
    }

    if (query.includes('os') || query.includes('deadlock') || query.includes('mutex') || query.includes('semaphore') || query.includes('operating system')) {
      return {
        content: `### 🖥️ Operating Systems: Deadlock & Synchronization\n\n#### 4 Necessary Conditions for Deadlock (Coffman Conditions):\n1. **Mutual Exclusion:** At least one resource must be held in a non-shareable mode.\n2. **Hold and Wait:** A process is holding at least one resource and requesting additional resources.\n3. **No Preemption:** Resources cannot be forcibly confiscated from a process.\n4. **Circular Wait:** A closed chain of processes exists where each process holds resources needed by the next.\n\n#### ⚡ Mutex vs. Binary Semaphore:\n- **Mutex:** Ownership-based locking mechanism. Only the thread that locked the mutex can unlock it.\n- **Semaphore:** Signaling mechanism. Any thread can signal (increment) or wait (decrement) on the semaphore count.`,
      };
    }

    if (query.includes('dbms') || query.includes('sql') || query.includes('acid') || query.includes('normalization')) {
      return {
        content: `### 💾 Database Management Systems (DBMS)\n\n#### 🛡️ ACID Properties:\n- **Atomicity:** All operations in a transaction succeed, or the entire transaction is rolled back.\n- **Consistency:** Database transitions from one valid state to another, preserving integrity constraints.\n- **Isolation:** Concurrent transactions execute without interfering with one another.\n- **Durability:** Committed transactions persist permanently, even in the event of a system crash.\n\n#### 📐 Normal Forms Hierarchy:\n- **1NF:** Atomic values, no repeating groups.\n- **2NF:** 1NF + No partial dependency on candidate keys.\n- **3NF:** 2NF + No transitive dependency ($A \\rightarrow B \\rightarrow C$).\n- **BCNF:** For every functional dependency $X \\rightarrow Y$, $X$ must be a super key.`,
      };
    }

    if (query.includes('network') || query.includes('osi') || query.includes('tcp') || query.includes('udp')) {
      return {
        content: `### 🌐 Computer Networks: OSI 7-Layer Model & Protocols\n\n| Layer # | Layer Name | Primary Protocol / PDU | Key Function |\n| :--- | :--- | :--- | :--- |\n| **7** | Application | HTTP, HTTPS, DNS, SSH | User application interface |\n| **6** | Presentation | TLS, SSL, JPEG, JSON | Data encryption, compression, formatting |\n| **5** | Session | RPC, NetBIOS | Session establishment & sync |\n| **4** | Transport | TCP (Segments), UDP (Datagrams) | End-to-end reliability, port addressing |\n| **3** | Network | IP, ICMP, OSPF (Packets) | Logical addressing & routing |\n| **2** | Data Link | Ethernet, Wi-Fi, MAC (Frames) | Physical addressing & frame check (CRC) |\n| **1** | Physical | Bits (Signals, Cables) | Raw binary transmission over medium |\n\n#### 🤝 TCP 3-Way Handshake:\n1. **Client $\\rightarrow$ Server:** \`SYN\` (Seq = $x$)\n2. **Server $\\rightarrow$ Client:** \`SYN-ACK\` (Seq = $y$, Ack = $x + 1$)\n3. **Client $\\rightarrow$ Server:** \`ACK\` (Seq = $x + 1$, Ack = $y + 1$)`,
      };
    }

    // -------------------------------------------------------------
    // 6. General Intelligent Fallback
    // -------------------------------------------------------------
    return {
      content: `I'm your **CS Engineering & Daily Companion**. Today is **${dateFormatted}** (${timeFormatted}).\n\nHere is how I can assist your engineering workflow:\n- 💻 **Code & Algorithms:** Ask me to write, debug, or analyze time complexity for C++, Python, Java, Rust, or SQL.\n- 📅 **Task & Exam Scheduler:** Say *"Schedule DSA revision tomorrow at 4pm"* to create reminders with desktop notifications.\n- 🔍 **File Search:** Say *"Find my operating systems pdf"* or *"Find project files"* to crawl your local drive.\n- 📊 **Hardware Stats:** Say *"Check system stats"* to inspect CPU, RAM, and Disk storage.\n- ⚡ **AI Model Providers:** To unlock full LLM reasoning (Ollama, Gemini, OpenAI, Claude), click **Settings (⚙️)** in the top bar!`,
    };
  }
}
