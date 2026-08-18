import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, Clock, CheckCircle2, Circle, Trash2, BellRing, RefreshCw } from 'lucide-react';
import { Task } from '../types';
import { TauriBridge } from '../services/tauriBridge';

interface TaskManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskManagerModal: React.FC<TaskManagerModalProps> = ({ isOpen, onClose }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurring, setRecurring] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [description, setDescription] = useState('');

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const data = await TauriBridge.listTasks();
      setTasks(data);
    } catch (e) {
      console.error('Failed to load tasks:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    try {
      await TauriBridge.scheduleTask({
        title: title.trim(),
        due_date: new Date(dueDate).toISOString(),
        description: description.trim() || null,
        recurring: recurring === 'none' ? null : recurring,
        reminder_offset_mins: 5,
      });

      setTitle('');
      setDueDate('');
      setDescription('');
      setRecurring('none');
      await loadTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleToggleCompleted = async (task: Task) => {
    await TauriBridge.toggleTaskCompleted(task.id, !task.is_completed);
    await loadTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    await TauriBridge.deleteTask(taskId);
    await loadTasks();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceBorder bg-slate-900/50">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Calendar className="w-4 h-4 text-brand-400" />
            <span>SQLite Task Scheduler</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadTasks}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Refresh Tasks"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Create Task Form */}
        <form onSubmit={handleCreateTask} className="p-4 border-b border-surfaceBorder bg-slate-950/40 space-y-2.5">
          <div className="text-xs font-semibold text-slate-300">Schedule New Task or Reminder</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              required
            />
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              required
            />
          </div>

          <div className="flex gap-2 items-center">
            <select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="none">One-time</option>
              <option value="daily">Repeats Daily</option>
              <option value="weekly">Repeats Weekly</option>
              <option value="monthly">Repeats Monthly</option>
            </select>

            <input
              type="text"
              placeholder="Notes/Description (optional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />

            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs flex items-center space-x-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No scheduled tasks found in SQLite database.
            </div>
          ) : (
            tasks.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  t.is_completed
                    ? 'bg-slate-950/40 border-slate-900 opacity-60'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start space-x-2.5 truncate max-w-[80%]">
                  <button
                    onClick={() => handleToggleCompleted(t)}
                    className="mt-0.5 text-slate-400 hover:text-accent-emerald transition-colors"
                  >
                    {t.is_completed ? (
                      <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>

                  <div className="truncate">
                    <div
                      className={`text-xs font-semibold truncate ${
                        t.is_completed ? 'line-through text-slate-500' : 'text-slate-200'
                      }`}
                    >
                      {t.title}
                    </div>

                    {t.description && (
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{t.description}</div>
                    )}

                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono mt-1">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{new Date(t.due_date).toLocaleString()}</span>
                      </span>
                      {t.recurring && t.recurring !== 'none' && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-brand-300 font-medium">
                          {t.recurring}
                        </span>
                      )}
                      {t.notified && (
                        <span className="flex items-center space-x-0.5 text-accent-cyan">
                          <BellRing className="w-2.5 h-2.5" />
                          <span>Notified</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTask(t.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                  title="Delete Task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
