import { LLMConfig } from '../../types';
import { TokenHealthService } from './tokenHealthService';

export class BackgroundTokenDaemon {
  private static intervalId: any = null;
  private static isRefreshing = false;

  /**
   * Start Autonomous Background Token Daemon
   */
  public static startDaemon(
    getConfig: () => LLMConfig,
    onTokenUpdated: (newAccessToken: string) => void
  ) {
    if (this.intervalId) return;

    console.info('🚀 Autonomous Background Token Daemon started (60s check interval).');

    // Run check immediately on launch
    this.checkAndRefresh(getConfig(), onTokenUpdated);

    // Run every 60 seconds
    this.intervalId = setInterval(() => {
      this.checkAndRefresh(getConfig(), onTokenUpdated);
    }, 60000);
  }

  public static stopDaemon() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private static async checkAndRefresh(
    config: LLMConfig,
    onTokenUpdated: (newAccessToken: string) => void
  ) {
    if (!config.googleRefreshToken || this.isRefreshing) return;

    try {
      // Test current token lifetime
      const health = await TokenHealthService.verifyGoogleToken(config.googleAccessToken || '');

      // Proactively refresh if expired or expiring within 5 minutes (300 seconds)
      if (!health.isValid || health.isExpiringSoon || (health.expiresInSeconds && health.expiresInSeconds <= 300)) {
        this.isRefreshing = true;
        console.info('🔄 Background Token Daemon: Proactively renewing Google token (under 5m threshold)...');

        const refreshRes = await TokenHealthService.refreshGoogleToken(config.googleRefreshToken);
        if (refreshRes.success && refreshRes.newAccessToken) {
          console.info('✨ Background Token Daemon: Successfully acquired fresh Google access token silently!');
          onTokenUpdated(refreshRes.newAccessToken);
        } else {
          console.warn('Background Token Daemon renewal notice:', refreshRes.message);
        }
      }
    } catch (e) {
      console.warn('Background Token Daemon error:', e);
    } finally {
      this.isRefreshing = false;
    }
  }
}
