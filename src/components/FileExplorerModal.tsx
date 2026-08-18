import React, { useState } from 'react';
import { X, Search, FolderSearch, FolderOpen, File, HardDrive, Filter } from 'lucide-react';
import { FileMatch } from '../types';
import { TauriBridge } from '../services/tauriBridge';

interface FileExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FileExplorerModal: React.FC<FileExplorerModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [searchPath, setSearchPath] = useState('');
  const [selectedExts, setSelectedExts] = useState<string[]>([]);
  const [results, setResults] = useState<FileMatch[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const availableExtensions = ['pdf', 'rs', 'py', 'ts', 'tsx', 'json', 'md', 'docx', 'xlsx'];

  const toggleExtension = (ext: string) => {
    setSelectedExts((prev) =>
      prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext]
    );
  };

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsScanning(true);
    try {
      const files = await TauriBridge.scanFilesystem({
        query: query.trim() || undefined,
        path: searchPath.trim() || undefined,
        extensions: selectedExts.length > 0 ? selectedExts : undefined,
        max_results: 50,
      });
      setResults(files);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceBorder bg-slate-900/50">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <FolderSearch className="w-4 h-4 text-accent-cyan" />
            <span>Fast Filesystem Crawler (Rust Engine)</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Filter Controls */}
        <form onSubmit={handleScan} className="p-4 border-b border-surfaceBorder bg-slate-950/40 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search file name, regex, or keyword..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan"
              />
            </div>

            <input
              type="text"
              placeholder="Path (Default: Home)..."
              value={searchPath}
              onChange={(e) => setSearchPath(e.target.value)}
              className="w-1/3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent-cyan"
            />

            <button
              type="submit"
              disabled={isScanning}
              className="px-4 py-2 rounded-lg bg-accent-cyan hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center space-x-1 shrink-0 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
            </button>
          </div>

          {/* Extension Filter Pills */}
          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 flex items-center space-x-1 mr-1">
              <Filter className="w-3 h-3" />
              <span>Filter ext:</span>
            </span>
            {availableExtensions.map((ext) => {
              const active = selectedExts.includes(ext);
              return (
                <button
                  type="button"
                  key={ext}
                  onClick={() => toggleExtension(ext)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                    active
                      ? 'bg-accent-cyan/20 border border-accent-cyan text-accent-cyan'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  .{ext}
                </button>
              );
            })}
          </div>
        </form>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {results.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              {isScanning ? 'Scanning filesystem...' : 'Enter search terms and click Scan to crawl files.'}
            </div>
          ) : (
            results.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center space-x-2.5 truncate max-w-[75%]">
                  {file.is_dir ? (
                    <HardDrive className="w-4 h-4 text-brand-400 shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-accent-cyan shrink-0" />
                  )}

                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 truncate">{file.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{file.path}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatBytes(file.size_bytes)}
                  </span>
                  <button
                    onClick={() => TauriBridge.openFilePath(file.path)}
                    className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                    title="Open in System File Manager"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
