export interface ServiceTokenStatus {
  service: 'github' | 'google' | 'gemini';
  isValid: boolean;
  isExpiringSoon?: boolean;
  expiresInSeconds?: number;
  message: string;
  lastChecked: string;
  details?: Record<string, any>;
}

export interface OverallTokenHealth {
  allHealthy: boolean;
  statuses: Record<'github' | 'google' | 'gemini', ServiceTokenStatus>;
}

export class TokenHealthService {
  /**
   * 1. Test & Validate GitHub Personal Access Token
   */
  public static async verifyGitHubToken(token: string): Promise<ServiceTokenStatus> {
    const timestamp = new Date().toLocaleTimeString();
    if (!token || !token.trim()) {
      return {
        service: 'github',
        isValid: false,
        message: 'No GitHub token configured.',
        lastChecked: timestamp,
      };
    }

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const scopes = res.headers.get('x-oauth-scopes') || 'repo';
        return {
          service: 'github',
          isValid: true,
          message: `Connected as @${data.login} (${data.name || 'User'})`,
          lastChecked: timestamp,
          details: {
            username: data.login,
            avatar_url: data.avatar_url,
            scopes,
            public_repos: data.public_repos,
          },
        };
      } else if (res.status === 401) {
        return {
          service: 'github',
          isValid: false,
          message: 'GitHub token is expired or unauthorized (401).',
          lastChecked: timestamp,
        };
      } else {
        return {
          service: 'github',
          isValid: false,
          message: `GitHub API error (${res.status}): ${res.statusText}`,
          lastChecked: timestamp,
        };
      }
    } catch (err: any) {
      return {
        service: 'github',
        isValid: false,
        message: `Network error connecting to GitHub: ${err.message}`,
        lastChecked: timestamp,
      };
    }
  }

  /**
   * 2. Test & Validate Google Gemini API Key
   */
  public static async verifyGeminiKey(apiKey: string): Promise<ServiceTokenStatus> {
    const timestamp = new Date().toLocaleTimeString();
    if (!apiKey || !apiKey.trim()) {
      return {
        service: 'gemini',
        isValid: false,
        message: 'No Gemini API key configured.',
        lastChecked: timestamp,
      };
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
      );

      if (res.ok) {
        const data = await res.json();
        const count = data.models?.length || 0;
        return {
          service: 'gemini',
          isValid: true,
          message: `Gemini API key is active (${count} models available).`,
          lastChecked: timestamp,
          details: { modelCount: count },
        };
      } else if (res.status === 400 || res.status === 403) {
        return {
          service: 'gemini',
          isValid: false,
          message: 'Gemini API key is invalid or quota exceeded.',
          lastChecked: timestamp,
        };
      } else {
        return {
          service: 'gemini',
          isValid: false,
          message: `Gemini API returned status ${res.status}`,
          lastChecked: timestamp,
        };
      }
    } catch (err: any) {
      return {
        service: 'gemini',
        isValid: false,
        message: `Network error connecting to Gemini API: ${err.message}`,
        lastChecked: timestamp,
      };
    }
  }

  /**
   * 3. Test & Validate Google OAuth Access Token (Gmail / Calendar)
   */
  public static async verifyGoogleToken(accessToken: string): Promise<ServiceTokenStatus> {
    const timestamp = new Date().toLocaleTimeString();
    if (!accessToken || !accessToken.trim()) {
      return {
        service: 'google',
        isValid: false,
        message: 'No Google OAuth Access Token configured.',
        lastChecked: timestamp,
      };
    }

    try {
      const res = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken.trim()}`
      );

      if (res.ok) {
        const data = await res.json();
        const expiresIn = data.expires_in || 0;
        const isExpiringSoon = expiresIn < 300; // less than 5 minutes

        return {
          service: 'google',
          isValid: true,
          isExpiringSoon,
          expiresInSeconds: expiresIn,
          message: isExpiringSoon
            ? `Google Token expiring in ${Math.round(expiresIn / 60)}m (Auto-refresh armed).`
            : `Google Token active (${Math.round(expiresIn / 60)} mins remaining).`,
          lastChecked: timestamp,
          details: {
            scope: data.scope,
            email: data.email,
            expires_in: expiresIn,
          },
        };
      } else {
        return {
          service: 'google',
          isValid: false,
          isExpiringSoon: true,
          expiresInSeconds: 0,
          message: 'Google Access Token is expired or revoked.',
          lastChecked: timestamp,
        };
      }
    } catch (err: any) {
      return {
        service: 'google',
        isValid: false,
        message: `Network error checking Google token: ${err.message}`,
        lastChecked: timestamp,
      };
    }
  }

  /**
   * 4. Silent Background Google Token Refresh
   * Exchanges refresh_token for a fresh access_token
   */
  public static async refreshGoogleToken(
    refreshToken: string
  ): Promise<{ success: boolean; newAccessToken?: string; message: string }> {
    if (!refreshToken || !refreshToken.trim()) {
      return {
        success: false,
        message: 'No Refresh Token available. Please authenticate via OAuth Playground.',
      };
    }

    try {
      // Use standard OAuth2 token refresh endpoint
      const bodyParams = new URLSearchParams({
        client_id: '407408718192.apps.googleusercontent.com',
        client_secret: '************',
        refresh_token: refreshToken.trim(),
        grant_type: 'refresh_token',
      });

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          return {
            success: true,
            newAccessToken: data.access_token,
            message: 'Successfully refreshed Google OAuth Access Token silently!',
          };
        }
      }

      return {
        success: false,
        message: 'Google token refresh request failed. Please renew via OAuth Playground.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Token refresh error: ${err.message}`,
      };
    }
  }

  /**
   * Run complete multi-service health scan
   */
  public static async checkAllHealth(config: {
    githubToken?: string;
    geminiApiKey?: string;
    googleAccessToken?: string;
    googleRefreshToken?: string;
  }): Promise<OverallTokenHealth> {
    const [github, gemini, google] = await Promise.all([
      this.verifyGitHubToken(config.githubToken || ''),
      this.verifyGeminiKey(config.geminiApiKey || ''),
      this.verifyGoogleToken(config.googleAccessToken || ''),
    ]);

    return {
      allHealthy: github.isValid && gemini.isValid && google.isValid,
      statuses: {
        github,
        gemini,
        google,
      },
    };
  }
}
