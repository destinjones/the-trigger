/**
 * HTTP layer injected into every source.
 *
 *   live      — real network (what the daily Action uses)
 *   record    — live, and writes every response to a cassette file
 *   replay    — serves responses from a cassette; never touches the network
 *
 * Cassettes make snapshots reproducible from recorded upstream bytes, and let
 * source parsers be tested against real responses.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Http } from './_types.ts';

const UA = 'the-trigger/0.1 (+https://github.com/destinjones/the-trigger)';

export interface CassetteEntry {
  key: string;
  status: number;
  body: string;
  /** Free-form provenance, e.g. "recorded 2026-10-14 via proxy; list trimmed". */
  note?: string;
}
export interface Cassette {
  recordedAt: string;
  entries: CassetteEntry[];
}

/** Strip credentials so cassettes are safe to commit and keys match across machines. */
export function cassetteKey(method: string, url: string, body?: unknown): string {
  const u = new URL(url);
  for (const p of ['api_key', 'apikey', 'key', 'registrationkey']) u.searchParams.delete(p);
  u.searchParams.sort();
  const b = body === undefined ? '' : ' ' + JSON.stringify(body);
  return `${method} ${u.toString()}${b}`;
}

export class HttpError extends Error {
  constructor(public status: number, public url: string, snippet: string) {
    super(`HTTP ${status} for ${redact(url)}: ${toPlain(snippet).slice(0, 160)}`);
  }
}

/** Error bodies are often HTML pages; keep only their text so messages stay readable. */
function toPlain(body: string): string {
  return body.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function redact(url: string): string {
  return url.replace(/(api_key|apikey|registrationkey|key)=[^&]+/gi, '$1=REDACTED');
}

type Raw = (method: string, url: string, body: unknown, headers: Record<string, string>) => Promise<{ status: number; body: string }>;

function wrap(raw: Raw): Http {
  async function text(method: string, url: string, body: unknown, headers: Record<string, string> = {}): Promise<string> {
    const res = await raw(method, url, body, headers);
    if (res.status < 200 || res.status >= 300) throw new HttpError(res.status, url, res.body);
    return res.body;
  }
  function json<T>(s: string, url: string): T {
    try {
      return JSON.parse(s) as T;
    } catch {
      throw new Error(`Invalid JSON from ${redact(url)}: ${s.slice(0, 120)}`);
    }
  }
  return {
    getText: (url, init) => text('GET', url, undefined, init?.headers),
    getJson: async <T>(url: string, init?: { headers?: Record<string, string> }) =>
      json<T>(await text('GET', url, undefined, { accept: 'application/json', ...init?.headers }), url),
    postJson: async <T>(url: string, body: unknown, init?: { headers?: Record<string, string> }) =>
      json<T>(await text('POST', url, body, { 'content-type': 'application/json', accept: 'application/json', ...init?.headers }), url),
  };
}

const liveRaw: Raw = async (method, url, body, headers) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'user-agent': UA, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await res.text();
      // Retry only on throttling and server errors.
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      return { status: res.status, body: text };
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
};

export function liveHttp(): Http {
  return wrap(liveRaw);
}

export function recordingHttp(path: string, recordedAt: string): Http {
  const cassette: Cassette = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Cassette)
    : { recordedAt, entries: [] };
  return wrap(async (method, url, body, headers) => {
    const res = await liveRaw(method, url, body, headers);
    const key = cassetteKey(method, url, body);
    cassette.entries = cassette.entries.filter((e) => e.key !== key);
    cassette.entries.push({ key, status: res.status, body: res.body });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(cassette, null, 2) + '\n');
    return res;
  });
}

export function replayHttp(path: string): Http {
  const cassette = JSON.parse(readFileSync(path, 'utf8')) as Cassette;
  const byKey = new Map(cassette.entries.map((e) => [e.key, e]));
  return wrap(async (method, url, body) => {
    const key = cassetteKey(method, url, body);
    const hit = byKey.get(key);
    if (!hit) throw new Error(`replay: no cassette entry for ${key}`);
    return { status: hit.status, body: hit.body };
  });
}

/** In-memory fake for unit tests: map of cassette key (or URL prefix) -> body. */
export function fakeHttp(routes: Record<string, string | { status: number; body: string }>): Http {
  return wrap(async (method, url, body) => {
    const key = cassetteKey(method, url, body);
    const match = routes[key] ?? Object.entries(routes).find(([k]) => key.startsWith(k))?.[1];
    if (match === undefined) return { status: 404, body: `no fake route for ${key}` };
    return typeof match === 'string' ? { status: 200, body: match } : match;
  });
}
