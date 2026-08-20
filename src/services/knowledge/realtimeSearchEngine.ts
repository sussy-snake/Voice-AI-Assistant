export interface RealtimeSearchResult {
  title: string;
  summary: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
}

export class RealtimeSearchEngine {
  /**
   * Performs live real-time knowledge retrieval via public zero-key encyclopedia & search endpoints.
   */
  public static async queryKnowledge(query: string): Promise<string | null> {
    const cleanQuery = query
      .replace(/^(what is|who is|where is|tell me about|explain|how does|what are|where can I find)\s+/i, '')
      .replace(/[?!.]+$/, '')
      .trim();

    if (!cleanQuery) return null;

    try {
      // 1. First attempt: Direct Wikipedia Page Summary
      const directSummary = await this.fetchWikipediaSummary(cleanQuery);
      if (directSummary && directSummary.extract && directSummary.extract.length > 50) {
        return this.formatWikipediaResponse(directSummary);
      }

      // 2. Second attempt: Wikipedia Search API to find best matching entity
      const searchResults = await this.searchWikipedia(cleanQuery);
      if (searchResults && searchResults.length > 0) {
        const topResult = searchResults[0];
        const pageSummary = await this.fetchWikipediaSummary(topResult.title);
        if (pageSummary && pageSummary.extract && pageSummary.extract.length > 50) {
          return this.formatWikipediaResponse(pageSummary);
        }
      }

      // 3. Third attempt: DuckDuckGo Instant Knowledge API
      const ddgResult = await this.fetchDuckDuckGo(cleanQuery);
      if (ddgResult && (ddgResult.AbstractText || ddgResult.Answer)) {
        return `### 🌐 ${cleanQuery.toUpperCase()}\n\n${ddgResult.Answer || ddgResult.AbstractText}\n\n*Source: DuckDuckGo Knowledge Graph (${ddgResult.AbstractSource || 'Instant Answers'})*`;
      }
    } catch (e) {
      console.warn('Live real-time knowledge lookup warning:', e);
    }

    return null;
  }

  private static async fetchWikipediaSummary(title: string): Promise<any> {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Voice-AI-Assistant/1.0' } });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return null;
  }

  private static async searchWikipedia(term: string): Promise<any[]> {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        term
      )}&utf8=&format=json&origin=*`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data.query?.search || [];
      }
    } catch {
      // ignore
    }
    return [];
  }

  private static async fetchDuckDuckGo(term: string): Promise<any> {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(term)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return null;
  }

  private static formatWikipediaResponse(data: any): string {
    const title = data.title || 'Knowledge Result';
    const description = data.description ? `*(${data.description})*` : '';
    const extract = data.extract || '';
    const pageUrl = data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;

    return `### 🌍 **${title}** ${description}\n\n${extract}\n\n---\n**🔗 Read more:** [${title} on Wikipedia](${pageUrl})`;
  }
}
