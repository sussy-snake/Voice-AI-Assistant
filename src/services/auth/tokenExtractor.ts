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
   * 3. Raw authorization headers / bearer tokens / HTTP dumps
   */
  public static extractTokens(input: string): ExtractedOAuthTokens {
    const raw = input.trim();
    if (!raw) {
      return { success: false, message: 'Empty input provided.' };
    }

    let accessToken: string | undefined = undefined;
    let refreshToken: string | undefined = undefined;
    let expiresIn: number | undefined = undefined;

    // 1. Try URI decoding if URL-encoded
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      // ignore
    }

    // 2. Extract from URL query/hash parameters or raw key-values
    const accessMatch = decoded.match(/access_token[=:]\s*"?([^"&#\s\r\n]+)"?/i) || raw.match(/access_token[=:]\s*"?([^"&#\s\r\n]+)"?/i);
    if (accessMatch && accessMatch[1]) {
      accessToken = accessMatch[1].trim();
    }

    const refreshMatch = decoded.match(/refresh_token[=:]\s*"?([^"&#\s\r\n]+)"?/i) || raw.match(/refresh_token[=:]\s*"?([^"&#\s\r\n]+)"?/i);
    if (refreshMatch && refreshMatch[1]) {
      refreshToken = refreshMatch[1].trim();
      if (refreshToken.includes('%')) {
        try {
          refreshToken = decodeURIComponent(refreshToken);
        } catch {
          // ignore
        }
      }
    }

    const expiresMatch = decoded.match(/expires_in[=:]\s*"?([0-9]+)"?/i);
    if (expiresMatch && expiresMatch[1]) {
      expiresIn = parseInt(expiresMatch[1], 10);
    }

    // 3. Fallback regex for raw JSON structure
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

    // 4. Standalone token regex patterns
    if (!accessToken) {
      const ya29Match = decoded.match(/(ya29\.[a-zA-Z0-9_\-\.]+)/) || raw.match(/(ya29\.[a-zA-Z0-9_\-\.]+)/);
      if (ya29Match && ya29Match[1]) {
        accessToken = ya29Match[1].trim();
      }
    }

    if (!refreshToken) {
      const rfMatch = decoded.match(/(1\/\/[a-zA-Z0-9_\-\.]+)/) || raw.match(/(1\/\/[a-zA-Z0-9_\-\.]+)/);
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
      message: 'Could not find a valid Google token in the provided text. Paste the full URL or ya29... token.',
    };
  }
}
