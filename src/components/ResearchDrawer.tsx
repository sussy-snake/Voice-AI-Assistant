import React, { useState, useRef } from 'react';
import {
  X,
  FileCode,
  Sparkles,
  UploadCloud,
  Layers,
  Trash2,
  FileCheck,
  Code2,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  GitPullRequest,
  Check,
  Search,
} from 'lucide-react';
import { IngestedFile, FileIngestionEngine } from '../services/research/fileIngestionEngine';
import { ResearchOperations, ResearchAnalysisResult, DiffLine } from '../services/research/researchOperations';

interface ResearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (text: string) => void;
}

export const ResearchDrawer: React.FC<ResearchDrawerProps> = ({
  isOpen,
  onClose,
  onSendToChat,
}) => {
  const [files, setFiles] = useState<IngestedFile[]>([
    FileIngestionEngine.createFromFileContent(
      'System_Architecture.md',
      '# System Architecture\n\n## Component Overview\n- Voice Pipeline: VAD + Whisper + Gemini 2.0 Flash\n- Token Vault: Encrypted Local Store\n- Research Engine: Multi-File Ingestion\n\nTODO: Add automated PostgreSQL connector\nTODO: Implement end-to-end integration tests\n'
    ),
    FileIngestionEngine.createFromFileContent(
      'Database_Config.rs',
      '// Database Configuration\npub struct DBConfig {\n    pub connection_url: String,\n    pub pool_size: u32,\n}\n\n// Note: Verify password encryption\n'
    ),
  ]);

  const [selectedFile, setSelectedFile] = useState<IngestedFile | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ResearchAnalysisResult | null>(null);
  const [activeDiff, setActiveDiff] = useState<{ file: IngestedFile; diff: DiffLine[]; newContent: string } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (uploadedFiles: FileList | null) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    setIsProcessing(true);

    try {
      const parsedList: IngestedFile[] = [];
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const ingested = await FileIngestionEngine.parseUploadedFile(file);
        parsedList.push(ingested);
      }
      setFiles((prev) => [...prev, ...parsedList]);
    } catch (e: any) {
      console.error('File parsing error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleSummarizeAll = () => {
    const result = ResearchOperations.summarizeAll(files);
    setAnalysisResult(result);
  };

  const handleExtractActionItems = () => {
    const result = ResearchOperations.extractActionItems(files);
    setAnalysisResult(result);
  };

  const handleScanVulnerabilities = () => {
    const result = ResearchOperations.scanCodeVulnerabilities(files);
    setAnalysisResult(result);
  };

  const handleCreateSampleDiff = (targetFile: IngestedFile) => {
    const modified = targetFile.content + '\n// Added by Voice AI Assistant\npub fn verify_system_integrity() -> bool {\n    true\n}\n';
    const diff = ResearchOperations.generateFileDiff(targetFile.content, modified);
    setActiveDiff({ file: targetFile, diff, newContent: modified });
  };

  const handleApplyDiff = () => {
    if (!activeDiff) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === activeDiff.file.id ? { ...f, content: activeDiff.newContent } : f))
    );
    setActiveDiff(null);
    setAnalysisResult({
      title: 'File Edit Applied',
      markdownSummary: `✅ Successfully updated \`${activeDiff.file.name}\` with new code changes!`,
    });
  };

  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedFile?.id === id) setSelectedFile(null);
  };

  const totalTokens = files.reduce((acc, f) => acc + f.estimatedTokens, 0);

  const getFileIcon = (ext: string) => {
    if (['rs', 'ts', 'js', 'py', 'java', 'cpp', 'c', 'go'].includes(ext)) return <Code2 className="w-4 h-4 text-accent-cyan" />;
    if (['csv', 'xlsx'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-accent-emerald" />;
    if (['md', 'txt'].includes(ext)) return <FileText className="w-4 h-4 text-accent-amber" />;
    return <FileCode className="w-4 h-4 text-brand-400" />;
  };

  const filteredFiles = searchFilter.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(searchFilter.toLowerCase()))
    : files;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex justify-end">
      <div className="w-full max-w-2xl h-full bg-neutral-900/80 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Workspace Research Engine</h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {files.length} Files Ingested • ~{totalTokens} Total Tokens
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Chips Bar */}
        <div className="flex items-center gap-1.5 p-3 border-b border-white/10 bg-black/30 overflow-x-auto no-scrollbar text-xs font-medium">
          <button
            onClick={handleSummarizeAll}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white flex items-center space-x-1.5 shrink-0 transition-all hover:scale-105 active:scale-95"
          >
            <Layers className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Summarize All</span>
          </button>

          <button
            onClick={handleExtractActionItems}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white flex items-center space-x-1.5 shrink-0 transition-all hover:scale-105 active:scale-95"
          >
            <FileCheck className="w-3.5 h-3.5 text-accent-emerald" />
            <span>Extract Action Items</span>
          </button>

          <button
            onClick={handleScanVulnerabilities}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white flex items-center space-x-1.5 shrink-0 transition-all hover:scale-105 active:scale-95"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-accent-rose" />
            <span>Scan Vulnerabilities</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-300 ${
              dragOver
                ? 'border-brand-400 bg-brand-950/40 scale-[1.01]'
                : 'border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files)}
              multiple
              className="hidden"
              accept=".pdf,.txt,.md,.rs,.ts,.tsx,.py,.java,.c,.cpp,.go,.json,.csv"
            />
            <div className="flex flex-col items-center justify-center space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-300">
                <UploadCloud className={`w-5 h-5 ${isProcessing ? 'animate-bounce' : ''}`} />
              </div>
              <span className="font-semibold text-slate-200 text-xs">
                {isProcessing ? 'Parsing and Tokenizing Documents...' : 'Drop files or folders here to ingest'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Supports .PDF, .MD, .TXT, .CSV, .RS, .TS, .PY, .JAVA, Source Code
              </span>
            </div>
          </div>

          {/* Analysis Result Banner */}
          {analysisResult && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-brand-800/60 shadow-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-100 text-xs flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-accent-cyan" />
                  <span>{analysisResult.title}</span>
                </h3>
                {onSendToChat && (
                  <button
                    onClick={() => onSendToChat(analysisResult.markdownSummary)}
                    className="px-2.5 py-1 rounded-lg bg-brand-600/60 hover:bg-brand-600 text-white text-[10px] font-semibold flex items-center space-x-1"
                  >
                    <span>Insert into Chat</span>
                  </button>
                )}
              </div>
              <div className="text-slate-300 text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                {analysisResult.markdownSummary}
              </div>
            </div>
          )}

          {/* Active Diff Review Card */}
          {activeDiff && (
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-accent-cyan/50 space-y-3 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-accent-cyan">
                  <GitPullRequest className="w-4 h-4" />
                  <span>Targeted File Edit Review: {activeDiff.file.name}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveDiff(null)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyDiff}
                    className="px-3 py-1 rounded-lg bg-accent-emerald hover:bg-emerald-600 text-slate-950 font-bold text-[11px] flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Apply Edit</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 font-mono text-[10px] max-h-40 overflow-y-auto space-y-0.5 border border-slate-800">
                {activeDiff.diff.map((d, i) => (
                  <div
                    key={i}
                    className={`px-1.5 py-0.5 rounded ${
                      d.type === 'added'
                        ? 'bg-emerald-950/80 text-accent-emerald'
                        : d.type === 'removed'
                        ? 'bg-rose-950/80 text-accent-rose'
                        : 'text-slate-400'
                    }`}
                  >
                    {d.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Inspector Search */}
          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-slate-300">Indexed File Workspace</span>
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter files..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-2 py-1 text-white text-[11px]"
              />
            </div>
          </div>

          {/* File List Cards */}
          <div className="space-y-2">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => setSelectedFile(file)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedFile?.id === file.id
                    ? 'bg-brand-950/40 border-brand-500/50 shadow-lg'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center space-x-3 truncate max-w-[65%]">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                    {getFileIcon(file.extension)}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-100 truncate text-xs">{file.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {file.chunks.length} Chunks • ~{file.estimatedTokens} Tokens • {file.importedAt}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCreateSampleDiff(file); }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-accent-cyan border border-white/10 text-[10px] flex items-center space-x-1"
                    title="Generate Targeted Edit Diff"
                  >
                    <GitPullRequest className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteFile(file.id, e)}
                    className="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-300"
                    title="Remove from Workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
