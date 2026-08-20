export interface ExtractedOAuthTokens {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  success: boolean;
  message: string;
}

export class TokenExtractor {
  /**
   * Automatically extracts access_token and refresh_token from:
   * 1. Google OAuth Playground share URLs (e.g. https://developers.google.com/oauthplayground/#...&access_token=ya29...&refresh_token=1%2F...)
   * 2. Raw JSON response strings from Google OAuth ({ "access_token": "...", "refresh_token": "..." })
   * 3. Raw authorization headers / bearer tokens
   */
  public static extractTokens(input: string): ExtractedOAuthTokens {
    const raw = input.trim();
    if (!raw) {
      return { success: false, message: 'Empty input provided.' };
    }

    let accessToken: string | undefined = undefined;
    let refreshToken: string | undefined = undefined;
    let expiresIn: number | undefined = undefined;

    // 1. Check if input is a URL with query/hash parameters
    if (raw.includes('oauthplayground') || raw.includes('access_token=') || raw.includes('refresh_token=')) {
      try {
        // Decode full URL including hash fragment
        const decoded = decodeURIComponent(raw);

        const accessMatch = decoded.match(/access_token=([^&#\s]+)/i);
        if (accessMatch && accessMatch[1]) {
          accessToken = accessMatch[1].trim();
        }

        const refreshMatch = decoded.match(/refresh_token=([^&#\s]+)/i);
        if (refreshMatch && refreshMatch[1]) {
          refreshToken = refreshMatch[1].trim();
        }

        const expiresMatch = decoded.match(/expires_in=([0-9]+)/i);
        if (expiresMatch && expiresMatch[1]) {
          expiresIn = parseInt(expiresMatch[1], 10);
        }
      } catch {
        // continue to regex
      }
    }

    // 2. Check if input is raw JSON response
    if (!accessToken || !refreshToken) {
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.access_token) accessToken = parsed.access_token;
          if (parsed.refresh_token) refreshToken = parsed.refresh_token;
          if (parsed.expires_in) expiresIn = parsed.expires_in;
        }
      } catch {
        // ignore
      }
    }

    // 3. Fallback regex for standalone ya29... token and 1//04... refresh token
    if (!accessToken) {
      const ya29Match = raw.match(/(ya29\.[a-zA-Z0-9_\-\.]+)/);
      if (ya29Match && ya29Match[1]) {
        accessToken = ya29Match[1].trim();
      }
    }

    if (!refreshToken) {
      const rfMatch = raw.match(/(1\/\/[a-zA-Z0-9_\-\.]+)/);
      if (rfMatch && rfMatch[1]) {
        refreshToken = rfMatch[1].trim();
      }
    }

    if (accessToken) {
      return {
        accessToken,
        refreshToken,
        expiresIn,
        success: true,
        message: refreshToken
          ? '🎉 Extracted BOTH Access Token & Permanent Refresh Token!'
          : '✅ Extracted Access Token (ya29...) successfully!',
      };
    }

    return {
      success: false,
      message: 'Could not find a valid Google token in the provided URL/text.',
    };
  }
}
