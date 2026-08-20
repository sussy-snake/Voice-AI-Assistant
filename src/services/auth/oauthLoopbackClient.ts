import { TauriBridge, isTauri } from '../tauriBridge';

export interface OAuthTokensReceived {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export class OAuthLoopbackClient {
  private static isListening = false;

  /**
   * Start 1-Click Automated Google Sign-In with Loopback HTTP Server
   */
  public static async startGoogleSignIn(
    onSuccess: (tokens: OAuthTokensReceived) => void,
    onError: (err: string) => void
  ): Promise<void> {
    if (!isTauri()) {
      // Browser fallback: open OAuth playground
      window.open('https://developers.google.com/oauthplayground', '_blank');
      onError('Desktop environment active. Opened OAuth helper in your browser.');
      return;
    }

    try {
      if (!this.isListening) {
        this.isListening = true;
        const { listen } = await import('@tauri-apps/api/event');
        listen<OAuthTokensReceived>('oauth-tokens-received', (event) => {
          console.info('OAuth Loopback Received Tokens:', event.payload);
          onSuccess(event.payload);
        });
      }

      await TauriBridge.startOAuthLoopbackFlow();
    } catch (err: any) {
      console.error('Failed to start OAuth loopback flow:', err);
      onError(err.message || 'Failed to start loopback server.');
    }
  }
}
