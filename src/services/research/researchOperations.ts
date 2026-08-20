import { IngestedFile } from './fileIngestionEngine';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNum?: number;
  content: string;
}

export interface ResearchAnalysisResult {
  title: string;
  markdownSummary: string;
  actionItems?: string[];
  vulnerabilities?: { severity: 'critical' | 'high' | 'medium' | 'low'; issue: string; lineHint?: string }[];
}

export class ResearchOperations {
  /**
   * 1. Summarize Single or Multiple Ingested Files
   */
  public static summarizeAll(files: IngestedFile[]): ResearchAnalysisResult {
    if (files.length === 0) {
      return {
        title: 'Empty Workspace',
        markdownSummary: 'No files currently ingested in the research workspace.',
      };
    }

    const totalTokens = files.reduce((acc, f) => acc + f.estimatedTokens, 0);
    const summarySections = files.map((f) => {
      const firstChunk = f.chunks[0]?.text.slice(0, 300) || f.content.slice(0, 300);
      return `### 📄 \`${f.name}\` (${f.estimatedTokens} tokens, ${f.chunks.length} chunks)\n- **Extension:** \`.${f.extension}\`\n- **Preview:** ${firstChunk}...\n`;
    });

    return {
      title: `Workspace Synthesis (${files.length} Files, ~${totalTokens} Tokens)`,
      markdownSummary: `## 📚 Multi-File Workspace Overview\n\nIngested **${files.length} documents** spanning approximately **${totalTokens} tokens**.\n\n${summarySections.join('\n')}`,
    };
  }

  /**
   * 2. Cross-Document Comparison
   */
  public static compareDocuments(fileA: IngestedFile, fileB: IngestedFile): ResearchAnalysisResult {
    const linesA = new Set(fileA.content.split('\n').map((l) => l.trim()).filter(Boolean));
    const linesB = new Set(fileB.content.split('\n').map((l) => l.trim()).filter(Boolean));

    let commonCount = 0;
    for (const line of linesA) {
      if (linesB.has(line)) commonCount++;
    }

    const similarity = Math.round((commonCount / Math.max(1, linesA.size + linesB.size - commonCount)) * 100);

    return {
      title: `Comparative Analysis: ${fileA.name} vs ${fileB.name}`,
      markdownSummary: `### ⚖️ Document Comparison\n\n- **File A:** \`${fileA.name}\` (${fileA.estimatedTokens} tokens)\n- **File B:** \`${fileB.name}\` (${fileB.estimatedTokens} tokens)\n- **Lexical Overlap Similarity:** **${similarity}%**\n\n#### Key Observations:\n1. **Structure:** \`${fileA.name}\` has ${fileA.chunks.length} chunks vs ${fileB.chunks.length} chunks in \`${fileB.name}\`.\n2. **Density:** Shared concepts detected across ${commonCount} distinct content blocks.`,
    };
  }

  /**
   * 3. Action Items Extractor
   */
  public static extractActionItems(files: IngestedFile[]): ResearchAnalysisResult {
    const actionItems: string[] = [];
    const todoRegex = /(?:TODO|FIXME|NOTE|ACTION|URGENT|DEADLINE)[\s:-]+([^\r\n]+)/gi;

    for (const f of files) {
      let match;
      while ((match = todoRegex.exec(f.content)) !== null) {
        actionItems.push(`[${f.name}] ${match[0].trim()}`);
      }
    }

    if (actionItems.length === 0) {
      actionItems.push('Review code architecture and add comprehensive unit tests.');
      actionItems.push('Verify environment variables and OAuth token expiration.');
      actionItems.push('Check performance latency under heavy parallel compute loads.');
    }

    return {
      title: `Extracted Action Items (${actionItems.length} Items)`,
      markdownSummary: `### 📋 Action Items & Task List\n\n${actionItems.map((item, i) => `${i + 1}. **${item}**`).join('\n')}`,
      actionItems,
    };
  }

  /**
   * 4. Static Code Vulnerability & Security Scanner
   */
  public static scanCodeVulnerabilities(files: IngestedFile[]): ResearchAnalysisResult {
    const vulnerabilities: { severity: 'critical' | 'high' | 'medium' | 'low'; issue: string; lineHint?: string }[] = [];

    const patterns = [
      { regex: /password\s*=\s*["'][^"']+["']/i, severity: 'critical' as const, issue: 'Hardcoded plaintext password credentials detected' },
      { regex: /api[_-]?key\s*=\s*["'][a-zA-Z0-9_\-]{16,}["']/i, severity: 'critical' as const, issue: 'Exposed API key in source code' },
      { regex: /eval\s*\(/i, severity: 'high' as const, issue: 'Unsafe dynamic eval() execution' },
      { regex: /SELECT\s+.*\s+FROM\s+.*WHERE\s+.*\+/i, severity: 'high' as const, issue: 'Possible SQL string concatenation vulnerability' },
      { regex: /http:\/\/localhost/i, severity: 'low' as const, issue: 'Unencrypted HTTP localhost reference' },
    ];

    for (const f of files) {
      const lines = f.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const p of patterns) {
          if (p.regex.test(line)) {
            vulnerabilities.push({
              severity: p.severity,
              issue: `${p.issue} in \`${f.name}\``,
              lineHint: `Line ${i + 1}: ${line.trim().slice(0, 60)}...`,
            });
          }
        }
      }
    }

    return {
      title: `Security & Vulnerability Audit (${vulnerabilities.length} Findings)`,
      markdownSummary: `### 🛡️ Code Security Scan Results\n\nTotal security findings: **${vulnerabilities.length}**\n\n${
        vulnerabilities.length === 0
          ? '✅ No obvious hardcoded credentials or critical eval vulnerabilities found in workspace files.'
          : vulnerabilities
              .map(
                (v) =>
                  `- **[${v.severity.toUpperCase()}]** ${v.issue}\n  *${v.lineHint || ''}*`
              )
              .join('\n\n')
      }`,
      vulnerabilities,
    };
  }

  /**
   * 5. Generate Unified Diff between Original and Modified Content
   */
  public static generateFileDiff(original: string, modified: string): DiffLine[] {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const diff: DiffLine[] = [];

    const maxLen = Math.max(origLines.length, modLines.length);
    for (let i = 0; i < maxLen; i++) {
      const o = origLines[i];
      const m = modLines[i];

      if (o === undefined) {
        diff.push({ type: 'added', lineNum: i + 1, content: `+ ${m}` });
      } else if (m === undefined) {
        diff.push({ type: 'removed', lineNum: i + 1, content: `- ${o}` });
      } else if (o !== m) {
        diff.push({ type: 'removed', lineNum: i + 1, content: `- ${o}` });
        diff.push({ type: 'added', lineNum: i + 1, content: `+ ${m}` });
      } else {
        diff.push({ type: 'unchanged', lineNum: i + 1, content: `  ${o}` });
      }
    }

    return diff;
  }
}
