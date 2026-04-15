/**
 * FTP client for the central Cerberus server used by ~22 Israeli supermarket chains
 * (url.retail.publishedprices.co.il). Each chain has its own FTP username; the
 * password is empty. Files are .gz-compressed XML, same format as Shufersal.
 *
 * Mirrors the conventions of client.ts: in-memory TTL cache, timing logs,
 * gzip-aware response decoding.
 */

import { Client } from "basic-ftp";
import { gunzipSync } from "node:zlib";
import { Writable } from "node:stream";

const FTP_HOST = "url.retail.publishedprices.co.il";
const FTP_TIMEOUT_MS = 12_000;
const CACHE_TTL_LIST_MS = 10 * 60_000; // 10 min for file listings
const CACHE_TTL_FILE_MS = 2 * 60 * 60_000; // 2 h for XML files
const CACHE_MAX_ENTRIES = 40;

export interface FtpFileEntry {
  name: string;
  size: number;
  date: string; // YYYY-MM-DD or "unknown"
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const listCache = new Map<string, CacheEntry<FtpFileEntry[]>>();
const fileCache = new Map<string, CacheEntry<string>>();

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return e.value;
}

function cachePut<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttl: number): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

function extractFileDate(name: string): string {
  const runs = name.match(/\d{8}/g) ?? [];
  const year = runs.find((d) => d.startsWith("20") || d.startsWith("19"));
  if (!year) return "unknown";
  return `${year.slice(0, 4)}-${year.slice(4, 6)}-${year.slice(6, 8)}`;
}

async function withClient<T>(user: string, secure: boolean, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(FTP_TIMEOUT_MS);
  client.ftp.verbose = false;
  try {
    await client.access({
      host: FTP_HOST,
      user,
      password: "",
      secure,
      secureOptions: secure ? { rejectUnauthorized: false } : undefined,
    });
    return await fn(client);
  } finally {
    client.close();
  }
}

/** List all PriceFull/PromoFull/Stores files for a chain, newest first by filename. */
export async function listFtpFiles(user: string, secure = false): Promise<FtpFileEntry[]> {
  const cacheKey = `${secure ? "ftps" : "ftp"}:${user}`;
  const cached = cacheGet(listCache, cacheKey);
  if (cached) {
    console.error(`[ftp] chain=${user} op=list cache=HIT dt=<1ms entries=${cached.length}`);
    return cached;
  }

  const start = Date.now();
  const entries = await withClient(user, secure, async (client) => {
    const raw = await client.list();
    return raw
      .filter((f) => f.isFile)
      .map<FtpFileEntry>((f) => ({
        name: f.name,
        size: f.size,
        date: extractFileDate(f.name),
      }))
      // For per-store chains (Rami Levy etc.), the largest PriceFull file is the
      // flagship store with the widest inventory — better coverage than alphabetical first.
      // For chain-wide publishers (Shufersal, Osher Ad), size still picks the latest full snapshot.
      .sort((a, b) => b.size - a.size);
  });
  const dt = Date.now() - start;
  console.error(`[ftp] chain=${user} op=list dt=${dt}ms entries=${entries.length}${secure ? " tls" : ""}`);

  cachePut(listCache, cacheKey, entries, CACHE_TTL_LIST_MS);
  return entries;
}

/** Download a single file and return its decompressed text (gz if .gz, plain otherwise). */
export async function fetchFtpXml(user: string, filename: string, secure = false): Promise<string> {
  const cacheKey = `${secure ? "ftps" : "ftp"}:${user}:${filename}`;
  const cached = cacheGet(fileCache, cacheKey);
  if (cached !== undefined) {
    console.error(`[ftp] chain=${user} file=${filename.slice(0, 60)} cache=HIT dt=<1ms`);
    return cached;
  }

  const start = Date.now();
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    },
  });

  await withClient(user, secure, async (client) => {
    await client.downloadTo(sink, filename);
  });

  const bytes = Buffer.concat(chunks);
  const isGz =
    filename.toLowerCase().endsWith(".gz") ||
    (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b);
  let text: string;
  try {
    text = isGz ? gunzipSync(bytes).toString("utf-8") : new TextDecoder().decode(bytes);
  } catch {
    text = new TextDecoder().decode(bytes);
  }

  const dt = Date.now() - start;
  console.error(
    `[ftp] chain=${user} file=${filename.slice(0, 60)} dt=${dt}ms size=${text.length}${isGz ? " gz" : ""}${secure ? " tls" : ""}`
  );

  cachePut(fileCache, cacheKey, text, CACHE_TTL_FILE_MS);
  return text;
}
