import { ScoredChunk } from './vectorStore';

export interface GuardrailDecision {
  passed: boolean;
  reason?: string;
  guardrailType?: 'confidence_low' | 'injection_detected' | 'refusal' | 'grounded';
  suggestedAction?: 'reject' | 'proceed' | 'fallback_general';
  confidenceScore: number;
}

export interface GroundedCitation {
  chunkId: string;
  sourceName: string;
  chunkIndex: number;
  similarityScore: number;
  snippet: string;
}

export class GuardrailsEngine {
  public static readonly MIN_CONFIDENCE_THRESHOLD = 0.35; // 35% similarity threshold

  /**
   * Evaluate input query and retrieved context against security & confidence guardrails
   */
  public static evaluateRetrieval(
    query: string,
    retrievedChunks: ScoredChunk[]
  ): GuardrailDecision {
    const cleanQuery = query.trim().toLowerCase();

    // 1. Prompt Injection & System Exploit Filter
    const injectionPatterns = [
      'ignore previous instructions',
      'system prompt',
      'override system',
      'jailbreak',
      'reveal api key',
      'reveal token',
    ];

    for (const pattern of injectionPatterns) {
      if (cleanQuery.includes(pattern)) {
        return {
          passed: false,
          reason: `Security Guardrail Triggered: Disallowed prompt injection pattern detected ("${pattern}").`,
          guardrailType: 'injection_detected',
          suggestedAction: 'reject',
          confidenceScore: 0,
        };
      }
    }

    // 2. Confidence & Groundedness Threshold Check
    if (retrievedChunks.length === 0) {
      return {
        passed: false,
        reason: 'Confidence Guardrail: No relevant documents found in knowledge base.',
        guardrailType: 'confidence_low',
        suggestedAction: 'fallback_general',
        confidenceScore: 0,
      };
    }

    const topScore = retrievedChunks[0].similarityScore;
    if (topScore < this.MIN_CONFIDENCE_THRESHOLD) {
      return {
        passed: false,
        reason: `Confidence Guardrail: Retrieved context similarity (${(topScore * 100).toFixed(1)}%) is below the groundedness threshold (${(this.MIN_CONFIDENCE_THRESHOLD * 100).toFixed(1)}%).`,
        guardrailType: 'confidence_low',
        suggestedAction: 'fallback_general',
        confidenceScore: topScore,
      };
    }

    return {
      passed: true,
      reason: 'Passed all safety and groundedness guardrails.',
      guardrailType: 'grounded',
      suggestedAction: 'proceed',
      confidenceScore: topScore,
    };
  }

  /**
   * Format retrieved chunks into clean grounded citations
   */
  public static formatCitations(chunks: ScoredChunk[]): GroundedCitation[] {
    return chunks.map((c) => ({
      chunkId: c.chunk.id,
      sourceName: c.chunk.metadata.sourceName,
      chunkIndex: c.chunk.metadata.chunkIndex,
      similarityScore: Math.round(c.similarityScore * 100),
      snippet: c.chunk.text.length > 180 ? c.chunk.text.slice(0, 180) + '...' : c.chunk.text,
    }));
  }
}
