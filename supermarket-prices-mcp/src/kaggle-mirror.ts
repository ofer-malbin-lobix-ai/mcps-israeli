/**
 * Kaggle-backed mirror for chains we can't reach directly from Railway
 * (currently: Yeinot Bitan + Carrefour, whose origin WAF blocks all cloud ASNs).
 *
 * The OpenIsraeliSupermarkets project scrapes every Israeli chain from residential
 * infra and publishes a daily snapshot on Kaggle. We download the relevant CSV
 * once per cold start, stream-parse it into a compact Map keyed by ItemCode, and
 * persist the resulting JSON to /tmp so subsequent container restarts within the
 * 4 h TTL skip the re-download.
 *
 * The CSV is ~169 MB raw; the resulting Map is ~30-50 MB in memory. No auth
 * needed — Kaggle's download endpoint 302s to a signed GCS URL.
 */

import { createWriteStream, promises as fsp, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { productSignature, signaturesMatch, type ProductSignature } from "./product-signature.js";

const TTL_MS = 4 * 60 * 60_000; // 4 hours — Kaggle publishes daily, 4 h is fresh enough
const DOWNLOAD_TIMEOUT_MS = 90_000;

export interface KaggleItem {
  itemCode: string;
  itemName: string;
  price: number;
  unitPrice?: string;
  manufacturer?: string;
  updatedAt: string; // YYYY-MM-DD
}

interface MirrorSnapshot {
  /** ISO timestamp when the snapshot was built. */
  builtAt: number;
  /** barcode → best (cheapest) row. */
  byCode: Record<string, KaggleItem>;
}

/** In-process handle per chain key. */
interface ChainHandle {
  file: string; // kaggle file name
  url: string; // full kaggle download url
  snapshot: MirrorSnapshot | null;
  loading: Promise<MirrorSnapshot> | null;
}

const CHAINS: Record<string, ChainHandle> = {
  yeinot_bitan: {
    file: "price_full_file_yayno_bitan_and_carrefour.csv",
    url: "https://www.kaggle.com/api/v1/datasets/download/erlichsefi/israeli-supermarkets-2024/price_full_file_yayno_bitan_and_carrefour.csv",
    snapshot: null,
    loading: null,
  },
};

function persistPath(chainKey: string): string {
  return path.join(tmpdir(), `kaggle-mirror-${chainKey}.json`);
}

/** Parse one CSV line with a minimal quote-aware splitter. Fields that contain
 *  commas or newlines are quoted per RFC 4180; the project's CSVs follow that. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch === '"') {
      inQuotes = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function downloadToTemp(url: string, dest: string): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "supermarket-prices-mcp/1.0 (+openisraelisupermarkets mirror)",
      },
    });
    if (!res.ok || !res.body) {
      throw new Error(`Kaggle download failed: HTTP ${res.status}`);
    }
    await pipeline(Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream), createWriteStream(dest));
  } finally {
    clearTimeout(t);
  }
}

async function buildSnapshotFromCsv(csvPath: string): Promise<MirrorSnapshot> {
  const byCode: Record<string, KaggleItem> = {};
  const stream = createReadStream(csvPath, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const snapshotDate = new Date().toISOString().slice(0, 10);

  let header: string[] | null = null;
  let idxItemCode = -1, idxItemName = -1, idxItemPrice = -1;
  let idxUnitPrice = -1, idxManufacturer = -1;
  let rows = 0;

  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = splitCsv(line).map((h) => h.trim().toLowerCase());
      idxItemCode = header.indexOf("itemcode");
      idxItemName = header.indexOf("itemname");
      idxItemPrice = header.indexOf("itemprice");
      idxUnitPrice = header.indexOf("unitofmeasureprice");
      idxManufacturer = header.indexOf("manufacturername");
      if (idxItemCode < 0 || idxItemName < 0 || idxItemPrice < 0) {
        throw new Error(`Kaggle CSV missing required columns; got ${header.join(",")}`);
      }
      continue;
    }
    const cols = splitCsv(line);
    const code = cols[idxItemCode]?.trim();
    const name = cols[idxItemName]?.trim();
    const price = Number(cols[idxItemPrice]);
    if (!code || !name || !Number.isFinite(price) || price <= 0) continue;
    rows++;

    const existing = byCode[code];
    if (existing && existing.price <= price) continue; // keep cheapest per barcode
    byCode[code] = {
      itemCode: code,
      itemName: name,
      price,
      unitPrice: idxUnitPrice >= 0 ? cols[idxUnitPrice]?.trim() : undefined,
      manufacturer: idxManufacturer >= 0 ? cols[idxManufacturer]?.trim() : undefined,
      updatedAt: snapshotDate,
    };
  }

  console.error(`[kaggle] parsed rows=${rows} uniqueBarcodes=${Object.keys(byCode).length}`);
  return { builtAt: Date.now(), byCode };
}

async function loadOrRefresh(chainKey: string): Promise<MirrorSnapshot> {
  const handle = CHAINS[chainKey];
  if (!handle) throw new Error(`no kaggle mirror for chain: ${chainKey}`);
  const now = Date.now();

  if (handle.snapshot && now - handle.snapshot.builtAt < TTL_MS) {
    return handle.snapshot;
  }
  if (handle.loading) return handle.loading;

  handle.loading = (async () => {
    const tmpFile = persistPath(chainKey);
    const csvFile = path.join(tmpdir(), `kaggle-${chainKey}.csv`);
    // Fast path: persisted snapshot JSON < TTL old
    try {
      const stat = await fsp.stat(tmpFile);
      if (now - stat.mtimeMs < TTL_MS) {
        const raw = await fsp.readFile(tmpFile, "utf-8");
        const snap = JSON.parse(raw) as MirrorSnapshot;
        console.error(`[kaggle] chain=${chainKey} snapshot=HIT /tmp age=${Math.round((now - snap.builtAt) / 60_000)}m barcodes=${Object.keys(snap.byCode).length}`);
        handle.snapshot = snap;
        return snap;
      }
    } catch { /* no persisted snapshot — fall through */ }

    // Slow path: download + parse
    const start = Date.now();
    console.error(`[kaggle] chain=${chainKey} downloading ${handle.file}…`);
    await downloadToTemp(handle.url, csvFile);
    const dlMs = Date.now() - start;
    const stat = await fsp.stat(csvFile);
    console.error(`[kaggle] chain=${chainKey} downloaded ${(stat.size / 1024 / 1024).toFixed(1)} MB in ${dlMs}ms`);

    const parseStart = Date.now();
    const snap = await buildSnapshotFromCsv(csvFile);
    console.error(`[kaggle] chain=${chainKey} parsed in ${Date.now() - parseStart}ms`);

    // Persist + unlink CSV to save disk
    await fsp.writeFile(tmpFile, JSON.stringify(snap));
    await fsp.unlink(csvFile).catch(() => undefined);

    handle.snapshot = snap;
    return snap;
  })();

  try {
    return await handle.loading;
  } finally {
    handle.loading = null;
  }
}

export async function lookupByBarcode(
  chainKey: string,
  barcode: string
): Promise<KaggleItem | undefined> {
  const snap = await loadOrRefresh(chainKey);
  return snap.byCode[barcode];
}

export async function lookupByName(
  chainKey: string,
  needle: string,
  limit = 5
): Promise<KaggleItem[]> {
  const snap = await loadOrRefresh(chainKey);
  const lc = needle.toLowerCase();
  const matches: KaggleItem[] = [];
  for (const it of Object.values(snap.byCode)) {
    if (!it.itemName.toLowerCase().includes(lc)) continue;
    matches.push(it);
    if (matches.length >= limit * 4) break; // collect a few extra then sort
  }
  matches.sort((a, b) => a.price - b.price);
  return matches.slice(0, limit);
}

/** Scan all items for ones whose name signature matches the given pivot. */
export async function lookupBySignature(
  chainKey: string,
  pivot: ProductSignature,
  limit = 1
): Promise<KaggleItem[]> {
  const snap = await loadOrRefresh(chainKey);
  const matches: KaggleItem[] = [];
  for (const it of Object.values(snap.byCode)) {
    const sig = productSignature(it.itemName);
    if (!sig) continue;
    if (!signaturesMatch(pivot, sig)) continue;
    matches.push(it);
  }
  matches.sort((a, b) => a.price - b.price);
  return matches.slice(0, limit);
}
