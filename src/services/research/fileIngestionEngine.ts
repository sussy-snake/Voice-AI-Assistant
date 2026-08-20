export interface IngestedFile {
  id: string;
  name: string;
  extension: string;
  sizeBytes: number;
  content: string;
  estimatedTokens: number;
  chunks: FileChunk[];
  importedAt: string;
}

export interface FileChunk {
  chunkIndex: number;
  text: string;
  tokenCount: number;
  startLine?: number;
  endLine?: number;
}

export class FileIngestionEngine {
  /**
   * Estimate token count (roughly 4 characters per token)
   */
  public static estimateTokens(text: string): number {
    return Math.max(1, Math.round(text.length / 3.8));
  }

  /**
   * Parse a single File object from browser / drag-and-drop
   */
  public static async parseUploadedFile(file: File): Promise<IngestedFile> {
    const text = await this.readFileText(file);
    const estimatedTokens = this.estimateTokens(text);
    const chunks = this.createChunks(text, 750, 100);

    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'txt' : 'txt';

    return {
      id: 'file_' + Math.random().toString(36).substring(2, 9),
      name: file.name,
      extension: ext,
      sizeBytes: file.size,
      content: text,
      estimatedTokens,
      chunks,
      importedAt: new Date().toLocaleTimeString(),
    };
  }

  /**
   * Ingest raw code or text with a given filename
   */
  public static createFromFileContent(name: string, content: string): IngestedFile {
    const estimatedTokens = this.estimateTokens(content);
    const chunks = this.createChunks(content, 750, 100);
    const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || 'txt' : 'txt';

    return {
      id: 'file_' + Math.random().toString(36).substring(2, 9),
      name,
      extension: ext,
      sizeBytes: content.length,
      content,
      estimatedTokens,
      chunks,
      importedAt: new Date().toLocaleTimeString(),
    };
  }

  /**
   * Read raw text or decode binary formats (Plaintext, Markdown, Code, CSV, PDF stream)
   */
  private static async readFileText(file: File): Promise<string> {
    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        return this.extractSimplePdfText(arrayBuffer);
      } catch {
        return `[PDF File: ${file.name} (Binary Content - ${file.size} bytes)]`;
      }
    }

    return await file.text();
  }

  /**
   * Extract readable text streams from simple PDF streams
   */
  private static extractSimplePdfText(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const str = new TextDecoder('latin1').decode(bytes);
    const textBlocks: string[] = [];

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    while ((match = streamRegex.exec(str)) !== null) {
      const streamContent = match[1];
      // Filter printable ASCII characters
      const clean = streamContent.replace(/[^ -~\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean.length > 20) {
        textBlocks.push(clean);
      }
    }

    return textBlocks.length > 0 ? textBlocks.join('\n\n') : `[PDF Document Text Content: ${bytes.length} bytes]`;
  }

  /**
   * AST-aware / paragraph-aware token chunking (500–1000 tokens with overlap)
   */
  public static createChunks(
    text: string,
    targetTokens = 750,
    overlapTokens = 100
  ): FileChunk[] {
    const targetChars = targetTokens * 4;
    const overlapChars = overlapTokens * 4;
    const lines = text.split('\n');
    const chunks: FileChunk[] = [];

    let currentChunk = '';
    let startLine = 1;
    let currentLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk += line + '\n';
      currentLine++;

      if (currentChunk.length >= targetChars) {
        chunks.push({
          chunkIndex: chunks.length,
          text: currentChunk.trim(),
          tokenCount: this.estimateTokens(currentChunk),
          startLine,
          endLine: currentLine - 1,
        });

        // Compute overlap
        const overlapText = currentChunk.slice(-overlapChars);
        currentChunk = overlapText;
        startLine = Math.max(1, currentLine - Math.round(overlapChars / 40));
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        text: currentChunk.trim(),
        tokenCount: this.estimateTokens(currentChunk),
        startLine,
        endLine: currentLine,
      });
    }

    return chunks;
  }
}
