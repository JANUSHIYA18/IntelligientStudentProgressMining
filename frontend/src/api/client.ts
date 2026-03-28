const normalizeBaseUrl = (rawBaseUrl?: string) => {
  const fallback =
    typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:3000/api";
  const resolved = (rawBaseUrl || fallback).trim();
  return resolved.replace(/\/+$/, "");
};

const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  cacheTtlMs?: number;
  bypassCache?: boolean;
}

type CacheEntry = { expiresAt: number; data: unknown };
const responseCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();
const DEFAULT_GET_CACHE_TTL_MS = 30_000;

const getCacheKey = (path: string, token?: string | null) => {
  const tokenKey = token ? token.slice(0, 20) : "anon";
  return `${tokenKey}:${path}`;
};

const clearResponseCache = () => {
  responseCache.clear();
  inflightRequests.clear();
};

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, cacheTtlMs = DEFAULT_GET_CACHE_TTL_MS, bypassCache = false } = options;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const cacheKey = getCacheKey(normalizedPath, token);
  const now = Date.now();
  const isGet = method === "GET";

  if (isGet && !bypassCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const execute = async () => {
    const res = await fetch(`${API_BASE_URL}${normalizedPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.success) {
      const msg = json?.message || `Request failed with status ${res.status}`;
      throw new Error(msg);
    }

    return json.data as T;
  };

  if (isGet) {
    const promise = execute()
      .then((data) => {
        if (!bypassCache && cacheTtlMs > 0) {
          responseCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtlMs });
        }
        return data;
      })
      .finally(() => {
        inflightRequests.delete(cacheKey);
      });
    inflightRequests.set(cacheKey, promise);
    return promise;
  }

  const data = await execute();
  clearResponseCache();
  return data;
}

export function getSessionAuth() {
  const token = sessionStorage.getItem("token");
  const userRaw = sessionStorage.getItem("user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  return { token, user };
}

export { API_BASE_URL };
