export type ChunkingStrategy = 'recursive' | 'markdown_ast' | 'sliding_window';

export interface ChunkMetadata {
  docId: string;
  sourceName: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  strategy: ChunkingStrategy;
  tags?: string[];
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  strategy?: ChunkingStrategy;
  chunkSize?: number;
  chunkOverlap?: number;
}

export class ChunkingEngine {
  /**
   * Split document text into chunks based on selected strategy
   */
  public static chunkDocument(
    text: string,
    sourceName: string,
    options: ChunkingOptions = {}
  ): DocumentChunk[] {
    const strategy = options.strategy || 'recursive';
    const chunkSize = options.chunkSize || 350; // target characters/tokens
    const chunkOverlap = options.chunkOverlap || 50;
    const docId = 'doc_' + Math.random().toString(36).substring(2, 9);

    let rawChunks: { text: string; startChar: number; endChar: number }[] = [];

    switch (strategy) {
      case 'markdown_ast':
        rawChunks = this.chunkMarkdownAst(text, chunkSize, chunkOverlap);
        break;
      case 'sliding_window':
        rawChunks = this.chunkSlidingWindow(text, chunkSize, chunkOverlap);
        break;
      case 'recursive':
      default:
        rawChunks = this.chunkRecursive(text, chunkSize, chunkOverlap);
        break;
    }

    return rawChunks.map((c, index) => ({
      id: `${docId}_chk_${index}`,
      text: c.text.trim(),
      metadata: {
        docId,
        sourceName,
        chunkIndex: index,
        startChar: c.startChar,
        endChar: c.endChar,
        strategy,
      },
    }));
  }

  /**
   * 1. Recursive Character Hierarchical Chunking
   * Splits on Paragraphs (\n\n) -> Lines (\n) -> Sentences (. ) -> Words ( )
   */
  private static chunkRecursive(
    text: string,
    chunkSize: number,
    chunkOverlap: number
  ): { text: string; startChar: number; endChar: number }[] {
    const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];
    const chunks: { text: string; startChar: number; endChar: number }[] = [];

    const splitRecursively = (
      input: string,
      offset: number,
      sepIndex: number
    ): void => {
      if (input.length <= chunkSize || sepIndex >= separators.length) {
        if (input.trim().length > 0) {
          chunks.push({
            text: input,
            startChar: offset,
            endChar: offset + input.length,
          });
        }
        return;
      }

      const sep = separators[sepIndex];
      const splits = input.split(sep);
      let currentChunk = '';
      let currentStart = offset;

      for (let i = 0; i < splits.length; i++) {
        const piece = splits[i] + (i < splits.length - 1 ? sep : '');
        if ((currentChunk + piece).length <= chunkSize) {
          currentChunk += piece;
        } else {
          if (currentChunk.trim().length > 0) {
            chunks.push({
              text: currentChunk,
              startChar: currentStart,
              endChar: currentStart + currentChunk.length,
            });
            // Apply overlap
            const overlapText = currentChunk.slice(-chunkOverlap);
            currentStart = currentStart + currentChunk.length - overlapText.length;
            currentChunk = overlapText + piece;
          } else {
            // Single piece is larger than chunkSize, descend to next separator
            splitRecursively(piece, currentStart, sepIndex + 1);
            currentStart += piece.length;
          }
        }
      }

      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk,
          startChar: currentStart,
          endChar: currentStart + currentChunk.length,
        });
      }
    };

    splitRecursively(text, 0, 0);
    return chunks;
  }

  /**
   * 2. Markdown & Code AST Block Chunking
   * Keeps headers, markdown sections, and code blocks intact
   */
  private static chunkMarkdownAst(
    text: string,
    chunkSize: number,
    _chunkOverlap: number
  ): { text: string; startChar: number; endChar: number }[] {
    const chunks: { text: string; startChar: number; endChar: number }[] = [];
    const lines = text.split('\n');
    let currentBlock = '';
    let blockStart = 0;
    let inCodeBlock = false;

    let charCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeader = line.startsWith('#') || line.startsWith('##') || line.startsWith('###');
      const isCodeFence = line.trim().startsWith('```');

      if (isCodeFence) {
        inCodeBlock = !inCodeBlock;
      }

      // If encountering header outside code block and current block has content, split
      if (isHeader && !inCodeBlock && currentBlock.length > 50) {
        chunks.push({
          text: currentBlock,
          startChar: blockStart,
          endChar: charCounter,
        });
        currentBlock = '';
        blockStart = charCounter;
      }

      currentBlock += line + '\n';
      charCounter += line.length + 1;

      // If current block exceeds target size outside a code block
      if (currentBlock.length >= chunkSize && !inCodeBlock) {
        chunks.push({
          text: currentBlock,
          startChar: blockStart,
          endChar: charCounter,
        });
        currentBlock = '';
        blockStart = charCounter;
      }
    }

    if (currentBlock.trim().length > 0) {
      chunks.push({
        text: currentBlock,
        startChar: blockStart,
        endChar: charCounter,
      });
    }

    return chunks;
  }

  /**
   * 3. Sliding Window Token/Char Chunking
   * Fixed length window with precise stride
   */
  private static chunkSlidingWindow(
    text: string,
    chunkSize: number,
    chunkOverlap: number
  ): { text: string; startChar: number; endChar: number }[] {
    const chunks: { text: string; startChar: number; endChar: number }[] = [];
    const stride = Math.max(1, chunkSize - chunkOverlap);
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const slice = text.substring(start, end);
      chunks.push({
        text: slice,
        startChar: start,
        endChar: end,
      });
      if (end === text.length) break;
      start += stride;
    }

    return chunks;
  }
}
