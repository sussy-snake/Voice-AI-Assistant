import { LLMConfig } from '../../types';
import { TokenHealthService } from './tokenHealthService';

const VAULT_STORAGE_KEY = 'voice_ai_llm_config';

export interface VaultCredentials {
  userName: string;
  geminiApiKey: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  githubToken?: string;
  isOnboardingCompleted?: boolean;
}

export class CredentialVault {
  /**
   * Check if the user has completed onboarding and has at least one valid inference engine
   */
  public static hasCompletedSetup(config: LLMConfig): boolean {
    if (config.geminiApiKey && config.geminiApiKey.trim().length > 10) {
      return true;
    }
    if (config.provider === 'ollama') {
      return true;
    }
    return false;
  }

  /**
   * Save credentials to local storage & secure vault
   */
  public static saveCredentials(updated: Partial<LLMConfig>, currentConfig: LLMConfig): LLMConfig {
    const merged: LLMConfig = {
      ...currentConfig,
      ...updated,
    };
    try {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save to localStorage vault:', e);
    }
    return merged;
  }

  /**
   * Test a Gemini API key live
   */
  public static async testGeminiKey(apiKey: string): Promise<{ isValid: boolean; message: string }> {
    if (!apiKey || apiKey.trim().length < 10) {
      return { isValid: false, message: 'Please enter a valid Gemini API key.' };
    }

    try {
      const res = await TokenHealthService.verifyGeminiKey(apiKey.trim());
      return {
        isValid: res.isValid,
        message: res.message,
      };
    } catch (e: any) {
      return {
        isValid: false,
        message: `Validation Error: ${e.message}`,
      };
    }
  }
}
