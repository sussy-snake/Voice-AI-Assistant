export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
}

export interface ServiceAccountTokenResult {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  message: string;
}

export class ServiceAccountAuth {
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.file',
  ].join(' ');

  /**
   * Headless Token Acquisition using Service Account JSON Key
   */
  public static async getAccessToken(
    jsonKeyString: string
  ): Promise<ServiceAccountTokenResult> {
    try {
      const creds: ServiceAccountCredentials = JSON.parse(jsonKeyString);
      if (!creds.client_email || !creds.private_key) {
        return {
          success: false,
          message: 'Invalid credentials.json: Missing client_email or private_key.',
        };
      }

      const now = Math.floor(Date.now() / 1000);
      const header = { alg: 'RS256', typ: 'JWT' };
      const claimSet = {
        iss: creds.client_email,
        scope: this.SCOPES,
        aud: creds.token_uri || 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      };

      const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
      const encodedClaims = this.base64UrlEncode(JSON.stringify(claimSet));
      const signingInput = `${encodedHeader}.${encodedClaims}`;

      // Sign with RSA-SHA256 using native WebCrypto PKCS#8
      const signature = await this.signRSA256(creds.private_key, signingInput);
      const jwt = `${signingInput}.${signature}`;

      // Exchange JWT Assertion for Google OAuth Access Token
      const res = await fetch(creds.token_uri || 'https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        return {
          success: false,
          message: `Service Account Token Error (${res.status}): ${errText}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        accessToken: data.access_token,
        expiresIn: data.expires_in || 3600,
        message: 'Headless Service Account token acquired successfully via RSA256 JWT!',
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Failed to sign or exchange service account credentials: ${e.message}`,
      };
    }
  }

  private static async signRSA256(pemPrivateKey: string, data: string): Promise<string> {
    const pemContents = pemPrivateKey
      .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
      .replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
      .replace(/\s+/g, '');

    const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer.buffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, dataBuffer);

    return this.base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
  }

  private static base64UrlEncode(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private static base64UrlEncodeBytes(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
