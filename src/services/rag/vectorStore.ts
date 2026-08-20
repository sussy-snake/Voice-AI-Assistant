import { DocumentChunk } from './chunkingEngine';

export interface ScoredChunk {
  chunk: DocumentChunk;
  similarityScore: number;
  retrievalLatencyMs: number;
}

export interface VectorStoreStats {
  totalDocuments: number;
  totalChunks: number;
  vocabSize: number;
  avgChunkLength: number;
}

export class VectorStore {
  private chunks: Map<string, DocumentChunk> = new Map();
  private vectors: Map<string, Map<string, number>> = new Map();
  private docFrequencies: Map<string, number> = new Map();
  private totalDocsIndexed = 0;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Tokenize & normalize text for subword/n-gram indexing
   */
  private tokenize(text: string): string[] {
    const clean = text.toLowerCase().replace(/[^a-z0-9_\-\s]/g, ' ');
    const words = clean.split(/\s+/).filter((w) => w.length > 1);

    const tokens: string[] = [];
    for (const w of words) {
      tokens.push(w);
      // Generate 3-gram character shingles for typo tolerance
      if (w.length > 3) {
        for (let i = 0; i <= w.length - 3; i++) {
          tokens.push('$' + w.substring(i, i + 3));
        }
      }
    }
    return tokens;
  }

  /**
   * Compute normalized TF-IDF vector for a set of tokens
   */
  private computeVector(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }

    const vector = new Map<string, number>();
    let normSq = 0;

    for (const [token, count] of tf.entries()) {
      const docCount = this.docFrequencies.get(token) || 1;
      const idf = Math.log((this.totalDocsIndexed + 1) / (docCount + 0.5)) + 1;
      const weight = (1 + Math.log(count)) * idf;
      vector.set(token, weight);
      normSq += weight * weight;
    }

    // L2 Normalization
    const norm = Math.sqrt(normSq) || 1;
    for (const [token, weight] of vector.entries()) {
      vector.set(token, weight / norm);
    }

    return vector;
  }

  /**
   * Add a list of document chunks into the Vector Store
   */
  public addChunks(chunks: DocumentChunk[]): void {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
      const tokens = this.tokenize(chunk.text);
      const uniqueTokens = new Set(tokens);

      for (const t of uniqueTokens) {
        this.docFrequencies.set(t, (this.docFrequencies.get(t) || 0) + 1);
      }

      this.totalDocsIndexed++;
    }

    // Recompute L2 TF-IDF vectors
    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.text);
      const vec = this.computeVector(tokens);
      this.vectors.set(chunk.id, vec);
    }

    this.saveToStorage();
  }

  /**
   * Search vector index using Cosine Similarity
   * Returns topK scored chunks with latency probe
   */
  public search(query: string, topK = 4): ScoredChunk[] {
    const t0 = performance.now();
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.chunks.size === 0) {
      return [];
    }

    const queryVec = this.computeVector(queryTokens);
    const scored: { chunk: DocumentChunk; similarityScore: number }[] = [];

    for (const [chunkId, chunkVec] of this.vectors.entries()) {
      const chunk = this.chunks.get(chunkId);
      if (!chunk) continue;

      // Cosine dot product between normalized vectors
      let dot = 0;
      for (const [token, qWeight] of queryVec.entries()) {
        const cWeight = chunkVec.get(token);
        if (cWeight !== undefined) {
          dot += qWeight * cWeight;
        }
      }

      if (dot > 0.05) {
        scored.push({
          chunk,
          similarityScore: Math.min(1.0, Math.round(dot * 1000) / 1000),
        });
      }
    }

    scored.sort((a, b) => b.similarityScore - a.similarityScore);
    const topResults = scored.slice(0, topK);

    const elapsedMs = Math.round((performance.now() - t0) * 100) / 100;

    return topResults.map((r) => ({
      ...r,
      retrievalLatencyMs: elapsedMs,
    }));
  }

  /**
   * Clear all indexed chunks
   */
  public clear(): void {
    this.chunks.clear();
    this.vectors.clear();
    this.docFrequencies.clear();
    this.totalDocsIndexed = 0;
    localStorage.removeItem('voice_rag_vector_chunks');
  }

  public getStats(): VectorStoreStats {
    const docIds = new Set<string>();
    let totalLen = 0;

    for (const chunk of this.chunks.values()) {
      docIds.add(chunk.metadata.docId);
      totalLen += chunk.text.length;
    }

    return {
      totalDocuments: docIds.size,
      totalChunks: this.chunks.size,
      vocabSize: this.docFrequencies.size,
      avgChunkLength: this.chunks.size > 0 ? Math.round(totalLen / this.chunks.size) : 0,
    };
  }

  public getAllChunks(): DocumentChunk[] {
    return Array.from(this.chunks.values());
  }

  private saveToStorage(): void {
    try {
      const serialized = JSON.stringify(Array.from(this.chunks.values()));
      localStorage.setItem('voice_rag_vector_chunks', serialized);
    } catch {
      // ignore
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('voice_rag_vector_chunks');
      if (saved) {
        const chunks: DocumentChunk[] = JSON.parse(saved);
        this.addChunks(chunks);
      }
    } catch {
      // ignore
    }
  }
}

// Global Singleton Instance
export const globalVectorStore = new VectorStore();
