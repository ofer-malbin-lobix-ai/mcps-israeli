/**
 * HTTP client with rate limiting for fetching Israeli supermarket price data.
 *
 * Data sources:
 * - Shufersal: https://prices.shufersal.co.il/ (web scraping, HTML pages)
 * - PublishPrice-based chains: https://prices.{chain}.co.il/ (web)
 * - Cerberus-based chains: FTP at url.retail.publishedprices.co.il
 *
 * This client handles the web-based sources. FTP-based chains are documented
 * but not directly accessed (they require FTP protocol support).
 */

const REQUEST_INTERVAL_MS = 1500;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

let lastRequestTime = 0;

async function rateLimitedWait(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

export async function fetchWithRateLimit(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  await rateLimitedWait();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await rateLimitedWait();
      }

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent":
            "supermarket-prices-mcp/1.0 (Israeli Price Transparency MCP Server)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
          ...options.headers,
        },
      });

      clearTimeout(timeout);

      if (!response.ok && response.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeout);
      lastError =
        err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        continue;
      }
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetchWithRateLimit(url);
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} fetching ${url}: ${response.statusText}`
    );
  }
  return response.text();
}

export async function fetchXml(url: string): Promise<string> {
  const response = await fetchWithRateLimit(url, {
    headers: {
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} fetching XML from ${url}: ${response.statusText}`
    );
  }
  return response.text();
}

/**
 * Parse a simple XML string to extract values for given tag names.
 * This is a lightweight parser for the standardized Israeli supermarket XML format.
 * It does not depend on any XML library - the format is well-defined by government regulation.
 */
export function extractXmlElements(
  xml: string,
  tagName: string
): string[] {
  const results: string[] = [];
  const regex = new RegExp(
    `<${tagName}[^>]*>([^<]*)</${tagName}>`,
    "gi"
  );
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/**
 * Extract repeated XML blocks (e.g., <Item>...</Item>) and parse their child elements.
 */
export function extractXmlBlocks(
  xml: string,
  blockTag: string,
  fields: string[]
): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const blockRegex = new RegExp(
    `<${blockTag}[^>]*>([\\s\\S]*?)</${blockTag}>`,
    "gi"
  );
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(xml)) !== null) {
    const blockContent = blockMatch[1];
    const record: Record<string, string> = {};

    for (const field of fields) {
      const fieldRegex = new RegExp(
        `<${field}[^>]*>([^<]*)</${field}>`,
        "i"
      );
      const fieldMatch = fieldRegex.exec(blockContent);
      if (fieldMatch) {
        record[field] = fieldMatch[1].trim();
      }
    }

    if (Object.keys(record).length > 0) {
      results.push(record);
    }
  }

  return results;
}
