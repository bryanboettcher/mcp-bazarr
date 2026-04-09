/**
 * Bazarr REST API client.
 *
 * Auth: X-API-KEY header with the API key from Bazarr settings.
 * All endpoints are under /api/ prefix.
 */

export interface BazarrClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class BazarrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: BazarrClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;

    if (!this.apiKey) {
      throw new Error("BAZARR_API_KEY is required");
    }
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      "X-API-KEY": this.apiKey,
      Accept: "application/json",
      ...extra,
    };
  }

  /**
   * GET request. Query params are appended as URL search params.
   * Array params use the `key[]` convention (e.g., seriesid[]=1&seriesid[]=2).
   */
  async get(path: string, params?: Record<string, unknown>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/api/${path}`);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null) continue;
        if (Array.isArray(val)) {
          // Bazarr uses key[] for array params (e.g., seriesid[], radarrid[])
          const arrayKey = key.endsWith("[]") ? key : `${key}[]`;
          for (const item of val) {
            url.searchParams.append(arrayKey, String(item));
          }
        } else {
          url.searchParams.set(key, String(val));
        }
      }
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers(),
    });

    return this.handleResponse(res, "GET", path);
  }

  /**
   * POST request with form-urlencoded body.
   * Bazarr API uses form data for POST/PATCH/DELETE.
   */
  async post(path: string, data?: Record<string, unknown>): Promise<unknown> {
    return this.formRequest("POST", path, data);
  }

  async patch(path: string, data?: Record<string, unknown>): Promise<unknown> {
    return this.formRequest("PATCH", path, data);
  }

  async delete(path: string, data?: Record<string, unknown>): Promise<unknown> {
    return this.formRequest("DELETE", path, data);
  }

  private async formRequest(
    method: string,
    path: string,
    data?: Record<string, unknown>
  ): Promise<unknown> {
    const url = `${this.baseUrl}/api/${path}`;
    const body = new URLSearchParams();
    if (data) {
      for (const [key, val] of Object.entries(data)) {
        if (val === undefined || val === null) continue;
        if (Array.isArray(val)) {
          for (const item of val) {
            body.append(key, String(item));
          }
        } else {
          body.append(key, String(val));
        }
      }
    }

    const res = await fetch(url, {
      method,
      headers: this.headers({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: body.toString(),
    });

    return this.handleResponse(res, method, path);
  }

  private async handleResponse(res: Response, method: string, path: string): Promise<unknown> {
    if (res.status === 204) {
      return { success: true };
    }

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
