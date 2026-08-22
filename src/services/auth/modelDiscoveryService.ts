export class ModelDiscoveryService {
  private static cachedGeminiModels: string[] | null = null;
  private static cachedGroqModels: string[] | null = null;

  /**
   * Dynamically query Google API for active generateContent models
   */
  public static async discoverGeminiModels(apiKey: string): Promise<string[]> {
    if (!apiKey || apiKey.trim().length < 10) {
      return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    }

    if (this.cachedGeminiModels && this.cachedGeminiModels.length > 0) {
      return this.cachedGeminiModels;
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//i, ''))
          .filter((slug: string) => !slug.includes('embedding') && !slug.includes('aqa'));

        // Sort 2.5 and flash models to the top
        models.sort((a: string, b: string) => {
          if (a.includes('2.5') && !b.includes('2.5')) return -1;
          if (!a.includes('2.5') && b.includes('2.5')) return 1;
          if (a.includes('flash') && !b.includes('flash')) return -1;
          if (!a.includes('flash') && b.includes('flash')) return 1;
          return 0;
        });

        if (models.length > 0) {
          this.cachedGeminiModels = models;
          return models;
        }
      }
    } catch (e) {
      console.warn('Dynamic Gemini model discovery warning:', e);
    }

    return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  }

  /**
   * Dynamically query Groq API for active chat models
   */
  public static async discoverGroqModels(apiKey: string): Promise<string[]> {
    if (!apiKey || apiKey.trim().length < 5) return ['llama-3.1-8b-instant', 'llama3-70b-8192'];

    if (this.cachedGroqModels && this.cachedGroqModels.length > 0) {
      return this.cachedGroqModels;
    }

    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      if (res.ok) {
        const data = await res.json();
        const models = (data.data || [])
          .map((m: any) => m.id)
          .filter((id: string) => id && !id.includes('whisper'));

        // Sort llama-3.1-8b-instant and 70b to the top
        models.sort((a: string, b: string) => {
          if (a.includes('llama-3.1-8b') && !b.includes('llama-3.1-8b')) return -1;
          if (!a.includes('llama-3.1-8b') && b.includes('llama-3.1-8b')) return 1;
          return 0;
        });

        if (models.length > 0) {
          this.cachedGroqModels = models;
          return models;
        }
      }
    } catch (e) {
      console.warn('Dynamic Groq model discovery warning:', e);
    }

    return ['llama-3.1-8b-instant', 'llama3-70b-8192'];
  }
}
