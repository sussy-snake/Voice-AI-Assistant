import React, { useState, useEffect } from 'react';
import { X, GitBranch, GitPullRequest, Plus, RefreshCw, ExternalLink, UploadCloud } from 'lucide-react';
import { GitStatusResult, GitHubRepo } from '../types';
import { TauriBridge } from '../services/tauriBridge';

interface GitIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubToken?: string;
  onSaveToken: (token: string) => void;
}

export const GitIntegrationModal: React.FC<GitIntegrationModalProps> = ({
  isOpen,
  onClose,
  githubToken = '',
  onSaveToken,
}) => {
  const [token, setToken] = useState(githubToken);
  const [gitStatus, setGitStatus] = useState<GitStatusResult | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadGitInfo = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const status = await TauriBridge.gitStatusCheck();
      setGitStatus(status);

      if (token.trim()) {
        const repoList = await TauriBridge.gitListUserRepos(token.trim());
        setRepos(repoList);
      }
    } catch (e: any) {
      console.error('Git error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (githubToken) {
      setToken(githubToken);
    }
  }, [githubToken, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadGitInfo();
    }
  }, [isOpen, token]);

  const handleSaveToken = () => {
    onSaveToken(token.trim());
    setStatusMessage('GitHub token saved successfully!');
    loadGitInfo();
  };

  const handleCommitAndPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim()) return;

    setIsLoading(true);
    try {
      const res = await TauriBridge.gitCommitAndPush({
        commit_message: commitMsg.trim(),
        branch: gitStatus?.current_branch || 'main',
      });
      setStatusMessage(res.message);
      setCommitMsg('');
      await loadGitInfo();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim() || !token.trim()) return;

    setIsLoading(true);
    try {
      const res = await TauriBridge.gitCreateRepo({
        github_token: token.trim(),
        repo_name: newRepoName.trim(),
        is_private: isPrivate,
        local_folder_path: '.',
      });
      setStatusMessage(res.message);
      setNewRepoName('');
      await loadGitInfo();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceBorder bg-slate-900/50">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <GitBranch className="w-4 h-4 text-accent-cyan" />
            <span>Git & GitHub Automation Hub</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadGitInfo}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Refresh Git Status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* GitHub Token Setup */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">GitHub Personal Access Token</span>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-accent-cyan hover:underline text-[11px]"
              >
                <span>Generate Token</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={handleSaveToken}
                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium"
              >
                Save
              </button>
            </div>
          </div>

          {/* Status Message Notification */}
          {statusMessage && (
            <div className="p-2.5 rounded-lg bg-brand-950/60 border border-brand-800 text-brand-200 text-xs">
              {statusMessage}
            </div>
          )}

          {/* Local Repository Status */}
          {gitStatus && (
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                  <GitPullRequest className="w-3.5 h-3.5 text-accent-emerald" />
                  <span>Current Branch: <strong className="text-white font-mono">{gitStatus.current_branch}</strong></span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    gitStatus.clean
                      ? 'bg-accent-emerald/20 text-accent-emerald'
                      : 'bg-accent-amber/20 text-accent-amber'
                  }`}
                >
                  {gitStatus.clean ? 'Working Tree Clean' : `${gitStatus.modified_files.length + gitStatus.untracked_files.length} Uncommitted Changes`}
                </span>
              </div>

              {/* Modified Files Preview */}
              {gitStatus.modified_files.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded">
                  {gitStatus.modified_files.map((f, i) => (
                    <div key={i} className="truncate text-amber-300">✎ {f}</div>
                  ))}
                  {gitStatus.untracked_files.map((f, i) => (
                    <div key={i} className="truncate text-cyan-300">+ {f}</div>
                  ))}
                </div>
              )}

              {/* Commit & Push Form */}
              <form onSubmit={handleCommitAndPush} className="pt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Commit message (e.g. Completed OS Assignment 4)..."
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-brand-500"
                />
                <button
                  type="submit"
                  disabled={isLoading || !commitMsg.trim()}
                  className="px-3 py-1.5 rounded-lg bg-accent-emerald hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold flex items-center space-x-1"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Push</span>
                </button>
              </form>
            </div>
          )}

          {/* Create New Remote Repository */}
          <form onSubmit={handleCreateRepo} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5 text-brand-400" />
              <span>Create New GitHub Repository & Link Project</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Repository name (e.g. dsa-notes)..."
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-brand-500"
              />
              <label className="flex items-center space-x-1.5 px-2 text-slate-400 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="accent-brand-500 rounded"
                />
                <span>Private</span>
              </label>
              <button
                type="submit"
                disabled={isLoading || !newRepoName.trim() || !token.trim()}
                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create</span>
              </button>
            </div>
          </form>

          {/* User Repositories List */}
          {repos.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-300">Your Recent GitHub Repositories:</div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {repos.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 hover:border-slate-700"
                  >
                    <span className="font-mono text-slate-200 truncate">{r.name}</span>
                    <a
                      href={r.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
