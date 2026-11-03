// Klien API. Token Bearer: access token hanya di MEMORI, refresh token di localStorage
// (rotasi di server + deteksi reuse). Satu refresh pada satu waktu (single-flight) dan
// diserialisasi lintas tab lewat Web Locks agar rotasi tidak bentrok.

import { API_URL } from './config';
import type { Session } from './types';

export class ApiError extends Error {
  status: number;
  code?: string;
  issues?: { path: string; message: string }[];
  constructor(status: number, message: string, code?: string, issues?: { path: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

const RT_KEY = 'aa.rt';
let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
const listeners = new Set<(s: Session | null) => void>();

export const getAccessToken = () => accessToken;

export function onSession(fn: (s: Session | null) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
}

export function setSession(s: Session | null) {
  accessToken = s ? s.access_token : null;
  try {
    if (s) localStorage.setItem(RT_KEY, s.refresh_token);
    else localStorage.removeItem(RT_KEY);
  } catch {
    /* penyimpanan tidak tersedia */
  }
  listeners.forEach((fn) => fn(s));
}

interface RawOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

async function raw<T>(path: string, { method = 'GET', body, token, signal }: RawOptions = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'NEXT_PUBLIC_API_URL belum diisi.');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: 'no-store',
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Tidak bisa terhubung ke server. Periksa koneksi atau status backend.');
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new ApiError(res.status, json?.message || `Permintaan gagal (HTTP ${res.status}).`, json?.code, json?.issues);
  }
  return json as T;
}

async function doRefresh(): Promise<boolean> {
  const rt = getStoredRefreshToken();
  if (!rt) return false;
  try {
    const r = await raw<{ data: Session }>('/api/auth/refresh', { method: 'POST', body: { refresh_token: rt } });
    setSession(r.data);
    return true;
  } catch (e) {
    // Hanya 401 yang berarti sesi benar-benar habis; gangguan jaringan tidak boleh mengeluarkan pengguna.
    if (e instanceof ApiError && e.status === 401) setSession(null);
    return false;
  }
}

export function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const run = () => doRefresh();
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  refreshPromise = (locks ? locks.request('aa-refresh', run) : run()).finally(() => {
    refreshPromise = null;
  }) as Promise<boolean>;
  return refreshPromise;
}

/** Panggilan API terotentikasi. Mengembalikan isi `data` dari respons. */
export async function api<T = unknown>(path: string, opts: Omit<RawOptions, 'token'> = {}): Promise<T> {
  if (!accessToken) await refreshSession();
  try {
    const r = await raw<{ data: T }>(path, { ...opts, token: accessToken });
    return r.data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && (e.code === 'TOKEN_EXPIRED' || e.code === 'TOKEN_INVALID' || e.code === 'NO_TOKEN')) {
      if (await refreshSession()) {
        const r = await raw<{ data: T }>(path, { ...opts, token: accessToken });
        return r.data;
      }
    }
    throw e;
  }
}

// ── Alur login (tanpa access token; memakai challenge token sementara) ──────────────────────
export interface LoginStep {
  challenge_token: string;
  next: '2fa' | '2fa_setup';
}

export const loginStep1 = (username: string, password: string) =>
  raw<{ data: LoginStep }>('/api/auth/login', { method: 'POST', body: { username, password } }).then((r) => r.data);

export const loginVerify2fa = (challenge: string, code: string) =>
  raw<{ data: Session }>('/api/auth/2fa', { method: 'POST', body: { code }, token: challenge }).then((r) => {
    setSession(r.data);
    return r.data;
  });

export const loginSetup2fa = (challenge: string) =>
  raw<{ data: { secret: string; otpauth_uri: string } }>('/api/auth/2fa/setup', { method: 'POST', token: challenge }).then((r) => r.data);

export const loginEnable2fa = (challenge: string, code: string) =>
  raw<{ data: Session }>('/api/auth/2fa/enable', { method: 'POST', body: { code }, token: challenge }).then((r) => {
    setSession(r.data);
    return r.data;
  });

export async function logoutRequest() {
  const rt = getStoredRefreshToken();
  try {
    await raw('/api/auth/logout', { method: 'POST', body: rt ? { refresh_token: rt } : {}, token: accessToken });
  } catch {
    /* tetap keluar secara lokal */
  }
  setSession(null);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.issues?.length ? `${e.message} ${e.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}` : e.message;
  return 'Terjadi kesalahan.';
}
