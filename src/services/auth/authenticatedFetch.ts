import { TokenHealthService } from './tokenHealthService';

export class AuthenticatedFetch {
  private static refreshPromise: Promise<string | null> | null = null;

  /**
   * Execute fetch with automatic 401 interceptor, silent token refresh, and request replay.
   */
  public static async fetchWithAutoRetry(
    url: string,
    options: RequestInit,
    getTokens: () => { accessToken: string; refreshToken?: string },
    onTokenRefreshed: (newToken: string) => void
  ): Promise<Response> {
    const { accessToken, refreshToken } = getTokens();

    const headers = new Headers(options.headers || {});
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    let response = await fetch(url, { ...options, headers });

    // Intercept 401 Unauthorized
    if (response.status === 401 && refreshToken) {
      console.warn('⚠️ 401 Unauthorized detected. Pausing queue for silent background token refresh...');

      try {
        // Ensure only one refresh executes concurrently across requests
        if (!this.refreshPromise) {
          this.refreshPromise = (async () => {
            const res = await TokenHealthService.refreshGoogleToken(refreshToken);
            if (res.success && res.newAccessToken) {
              onTokenRefreshed(res.newAccessToken);
              return res.newAccessToken;
            }
            return null;
          })().finally(() => {
            this.refreshPromise = null;
          });
        }

        const freshToken = await this.refreshPromise;
        if (freshToken) {
          console.info('✨ Silent Token Refresh completed! Replaying failed API request...');
          headers.set('Authorization', `Bearer ${freshToken}`);
          response = await fetch(url, { ...options, headers });
        }
      } catch (e) {
        console.error('Failed to auto-heal 401 request:', e);
      }
    }

    return response;
  }
}
