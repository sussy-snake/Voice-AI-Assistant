import { ChunkingEngine } from './chunkingEngine';
import { globalVectorStore } from './vectorStore';

export const PRESET_KNOWLEDGE_DOCS = [
  {
    name: 'Operating_Systems_Core_Concepts.md',
    content: `# Operating Systems Core Concepts & Architecture

## Process Scheduling & Concurrency
- **CPU Schedulers**: Preemptive (Round Robin, Shortest Remaining Time First) vs Non-preemptive (FCFS, Shortest Job First).
- **Round Robin (RR)**: Allocates fixed time quantum (e.g. 10-50ms). Time complexity per context switch is O(1). High responsiveness for interactive systems.
- **Deadlock Coffman Conditions**: Four conditions must simultaneously hold for a deadlock:
  1. Mutual Exclusion: At least one resource is held in a non-shareable mode.
  2. Hold and Wait: A process holds at least one resource while waiting for other resources.
  3. No Preemption: Resources cannot be forcibly taken from a process holding them.
  4. Circular Wait: A closed chain of processes exists where each process holds resources needed by the next.

## Virtual Memory & Paging
- **Paging Mechanism**: Translates virtual addresses to physical addresses using Page Tables and Translation Lookaside Buffer (TLB).
- **Page Fault**: Hardware interrupt when a page is not loaded in physical RAM. Triggers OS trap, fetches page from swap/disk, updates page table, and restarts instruction.
- **Page Replacement Algorithms**:
  - LRU (Least Recently Used): Replaces page unused for longest time (approximated with clock algorithm).
  - FIFO: Replaces oldest page (subject to Belady's Anomaly).
  - Optimal (OPT): Replaces page not needed for longest future time (theoretical benchmark).`,
  },
  {
    name: 'Data_Structures_And_Algorithms_Guide.md',
    content: `# Data Structures & Algorithms Quick Reference

## Time Complexity Summary
- **Sorting Algorithms**:
  - QuickSort: Average O(N log N), Worst case O(N^2) (mitigated by Randomized Pivot or Median-of-Three). Space O(log N).
  - MergeSort: Guaranteed O(N log N) time in all cases. Space O(N). Stable sort.
  - HeapSort: Guaranteed O(N log N) time. Space O(1) in-place.
- **Graph Algorithms**:
  - Dijkstra's Single Source Shortest Path: O((V + E) log V) using Min-Heap / Priority Queue with adjacency list. Requires non-negative edge weights.
  - Bellman-Ford: O(V * E) shortest path supporting negative edge weights and negative cycle detection.
  - Floyd-Warshall: O(V^3) All-Pairs Shortest Path via Dynamic Programming.
  - A* Search: O(E) with admissible heuristic function h(n) <= h*(n).

## Dynamic Programming Patterns
- **Memoization (Top-Down)**: Recursion with caching table.
- **Tabulation (Bottom-Up)**: Iterative table building avoiding call stack overhead.
- **Common Patterns**: 0/1 Knapsack, Longest Common Subsequence (LCS), Matrix Chain Multiplication, Interval DP, Tree DP.`,
  },
  {
    name: 'Database_Systems_And_Networking.md',
    content: `# Database Systems, Storage & Networking

## Database Systems & ACID Guarantees
- **Atomicity**: All operations in a transaction succeed or all roll back (WAL - Write-Ahead Logging).
- **Consistency**: Transactions preserve database invariants and integrity constraints.
- **Isolation**: Concurrent transactions do not interfere (Read Uncommitted, Read Committed, Repeatable Read, Serializable via MVCC / 2-Phase Locking).
- **Durability**: Committed transactions persist permanently across crashes (fsync to non-volatile disk).
- **Indexing**: B+ Trees provide O(log N) range queries and point lookups with high fan-out (order 100-500) minimizing disk I/O.

## Computer Networks & OSI Model
- **Layer 7 - Application**: HTTP/HTTPS, DNS, SSH, SMTP, WebSocket.
- **Layer 4 - Transport**:
  - TCP: Connection-oriented, 3-way handshake (SYN, SYN-ACK, ACK), flow control (sliding window), congestion control, guaranteed order.
  - UDP: Connectionless, lightweight, low-latency datagrams for voice/video streaming and DNS.
- **Layer 3 - Network**: IP routing, ICMP, packet fragmentation.`,
  },
  {
    name: 'Voice_RAG_Architecture_Goa.md',
    content: `# Voice-Enabled RAG Pipeline Architecture (#RAGInGoa)

## Sub-200ms Real-Time RAG Workflow
- **Streaming Transcription**: Instant voice token chunking with VAD (Voice Activity Detection) delivery under 30ms.
- **Multi-Strategy Chunking Engine**:
  1. Hierarchical Recursive Character Splitting (\n\n, \n, ., words).
  2. Markdown / Code AST-Aware Block Chunking.
  3. Sliding Window Token Overlap Chunking.
- **Vector Retrieval**: Sub-5ms in-memory Cosine Similarity with subword n-gram embedding.
- **Guardrails System**: Out-of-domain rejection when similarity is below confidence threshold (0.35), stopping hallucination.
- **Latency Benchmarking Harness**: Automated test suite measuring statistical P50, P70, P90, and P100 response latencies.`,
  },
];

export function initializePresetKnowledge(): void {
  if (globalVectorStore.getStats().totalChunks > 0) return;

  for (const doc of PRESET_KNOWLEDGE_DOCS) {
    const chunks = ChunkingEngine.chunkDocument(doc.content, doc.name, {
      strategy: 'recursive',
      chunkSize: 350,
      chunkOverlap: 50,
    });
    globalVectorStore.addChunks(chunks);
  }
}
