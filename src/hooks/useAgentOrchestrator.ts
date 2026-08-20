import { useState, useRef, useCallback } from 'react';
import { ChatMessage, LLMConfig, ToolCall, ToolResult } from '../types';
import { LLMClient } from '../services/llmAdapters';
import { TauriBridge } from '../services/tauriBridge';

export function useAgentOrchestrator(config: LLMConfig) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${config.userName || 'there'}! I'm your native desktop **AI Companion & CS Assistant**.\n\nI'm running locally in the background. You can speak or type to me to:\n- 🐙 **Git & GitHub:** *"Create a repo named os-lab and push code"* or *"Git status"*\n- ✉️ **Gmail:** *"Send email to professor@college.edu regarding my assignment"*\n- 📅 **Google Calendar:** *"Mark DSA midterm on my Google Calendar for Friday"*\n- ⚡ **Offline NPU/CPU Compute:** *"Run hardware compute benchmark"*\n- 🔍 **Filesystem:** *"Find my DBMS pdf notes"*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeToolRunning, setActiveToolRunning] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // -------------------------------------------------------------
  // Tool Dispatcher
  // -------------------------------------------------------------
  const executeToolCall = async (toolCall: ToolCall): Promise<ToolResult> => {
    setActiveToolRunning(toolCall.name);
    console.info(`[Agent] Executing tool: ${toolCall.name}`, toolCall.arguments);

    try {
      let resultData: any;

      switch (toolCall.name) {
        case 'scan_filesystem': {
          resultData = await TauriBridge.scanFilesystem({
            query: toolCall.arguments.query,
            path: toolCall.arguments.path,
            extensions: toolCall.arguments.extensions,
            max_results: toolCall.arguments.max_results || 30,
          });
          break;
        }

        case 'schedule_task': {
          resultData = await TauriBridge.scheduleTask({
            title: toolCall.arguments.title,
            due_date: toolCall.arguments.due_date,
            description: toolCall.arguments.description,
            recurring: toolCall.arguments.recurring,
            reminder_offset_mins: toolCall.arguments.reminder_offset_mins,
          });
          break;
        }

        case 'list_tasks': {
          resultData = await TauriBridge.listTasks();
          break;
        }

        case 'delete_task': {
          resultData = await TauriBridge.deleteTask(toolCall.arguments.task_id);
          break;
        }

        case 'system_status': {
          resultData = await TauriBridge.getSystemStatus();
          break;
        }

        case 'open_file_path': {
          resultData = await TauriBridge.openFilePath(toolCall.arguments.path);
          break;
        }

        case 'send_desktop_notification': {
          resultData = await TauriBridge.sendNotification(
            toolCall.arguments.title,
            toolCall.arguments.body
          );
          break;
        }

        // Git & GitHub
        case 'git_status_check': {
          resultData = await TauriBridge.gitStatusCheck(toolCall.arguments.folder_path);
          break;
        }

        case 'git_commit_and_push': {
          resultData = await TauriBridge.gitCommitAndPush({
            folder_path: toolCall.arguments.folder_path,
            commit_message: toolCall.arguments.commit_message,
            branch: toolCall.arguments.branch,
          });
          break;
        }

        case 'git_create_repo': {
          resultData = await TauriBridge.gitCreateRepo({
            github_token: config.githubToken || '',
            repo_name: toolCall.arguments.repo_name,
            is_private: toolCall.arguments.is_private,
            description: toolCall.arguments.description,
            local_folder_path: toolCall.arguments.local_folder_path,
          });
          break;
        }

        // Gmail & Google Calendar
        case 'gmail_send_message':
        case 'send_gmail_message': {
          resultData = await TauriBridge.gmailSendMessage({
            access_token: config.googleAccessToken || '',
            to: toolCall.arguments.to,
            subject: toolCall.arguments.subject,
            body: toolCall.arguments.body,
          });
          break;
        }

        case 'query_database': {
          resultData = await TauriBridge.queryDatabase(
            toolCall.arguments.sql_query,
            toolCall.arguments.connection_string
          );
          break;
        }

        case 'gmail_list_messages': {
          resultData = await TauriBridge.gmailListMessages({
            access_token: config.googleAccessToken || '',
            query: toolCall.arguments.query,
            max_results: toolCall.arguments.max_results,
          });
          break;
        }

        case 'gmail_read_message': {
          resultData = await TauriBridge.gmailReadMessage({
            access_token: config.googleAccessToken || '',
            message_id: toolCall.arguments.message_id,
          });
          break;
        }

        case 'calendar_add_event': {
          resultData = await TauriBridge.calendarAddEvent({
            access_token: config.googleAccessToken || '',
            title: toolCall.arguments.title,
            start_time: toolCall.arguments.start_time,
            end_time: toolCall.arguments.end_time,
            description: toolCall.arguments.description,
          });
          break;
        }

        case 'calendar_list_events': {
          resultData = await TauriBridge.calendarListEvents(
            config.googleAccessToken || '',
            toolCall.arguments.max_results
          );
          break;
        }

        // Hardware Compute Acceleration
        case 'run_hardware_compute': {
          resultData = await TauriBridge.runHardwareCompute(
            toolCall.arguments.task_type,
            toolCall.arguments.dataset_size
          );
          break;
        }

        default:
          throw new Error(`Unknown tool function: ${toolCall.name}`);
      }

      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result: resultData,
      };
    } catch (err: any) {
      console.error(`Tool execution error [${toolCall.name}]:`, err);
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result: null,
        error: err.message || 'Tool execution failed',
      };
    } finally {
      setActiveToolRunning(null);
    }
  };

  // -------------------------------------------------------------
  // Orchestrator Loop
  // -------------------------------------------------------------
  const sendMessage = useCallback(
    async (userInput: string) => {
      const trimmed = userInput.trim();
      if (!trimmed || isProcessing) return;

      const userMsgId = 'msg_' + Date.now();
      const userMessage: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsProcessing(true);

      const client = new LLMClient(config);
      abortControllerRef.current = new AbortController();

      const currentHistory: ChatMessage[] = [...messages, userMessage];
      let recursionDepth = 0;
      const MAX_RECURSION = 3;
      const executedToolIds = new Set<string>();

      try {
        while (recursionDepth < MAX_RECURSION) {
          recursionDepth++;
          const assistantMsgId = 'asst_' + Date.now() + '_' + recursionDepth;
          let streamedText = '';
          const detectedToolMap = new Map<string, ToolCall>();

          const assistantMessage: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isStreaming: true,
          };

          setMessages((prev) => [...prev, assistantMessage]);

          const stream = client.streamChat(currentHistory, abortControllerRef.current.signal);

          for await (const chunk of stream) {
            if (chunk.content) {
              streamedText += chunk.content;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: streamedText } : m))
              );
            }

            if (chunk.toolCalls) {
              for (const tc of chunk.toolCalls) {
                if (!detectedToolMap.has(tc.id)) {
                  detectedToolMap.set(tc.id, tc);
                }
              }
              const uniqueToolList = Array.from(detectedToolMap.values());
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, toolCalls: uniqueToolList } : m
                )
              );
            }
          }

          const uniqueTools = Array.from(detectedToolMap.values());
          const finalizedAsst: ChatMessage = {
            ...assistantMessage,
            content: streamedText,
            toolCalls: uniqueTools.length > 0 ? uniqueTools : undefined,
            isStreaming: false,
          };

          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? finalizedAsst : m))
          );
          currentHistory.push(finalizedAsst);

          // Find pending unexecuted tool calls
          const unexecutedTools = uniqueTools.filter((tc) => !executedToolIds.has(tc.id));
          if (unexecutedTools.length === 0) {
            break;
          }

          const toolResults: ToolResult[] = [];
          for (const tc of unexecutedTools) {
            executedToolIds.add(tc.id);
            const res = await executeToolCall(tc);
            toolResults.push(res);
          }

          const toolMsgId = 'tool_' + Date.now();
          const toolMessage: ChatMessage = {
            id: toolMsgId,
            role: 'tool',
            content: JSON.stringify(toolResults),
            toolResults,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          setMessages((prev) => [...prev, toolMessage]);
          currentHistory.push(toolMessage);

          // If this was a single-turn tool completion without conversational LLM loop, stop cleanly
          if (config.provider !== 'openai' && config.provider !== 'gemini' && config.provider !== 'anthropic') {
            break;
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            {
              id: 'err_' + Date.now(),
              role: 'assistant',
              content: `⚠️ **Notice:** ${err.message || 'Error occurred while processing request.'}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      } finally {
        setIsProcessing(false);
        setActiveToolRunning(null);
      }
    },
    [messages, config, isProcessing]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setActiveToolRunning(null);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isProcessing,
    activeToolRunning,
    sendMessage,
    stopGeneration,
    clearChat,
  };
}
