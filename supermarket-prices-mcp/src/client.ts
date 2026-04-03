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
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

let lastRequestTime = 0;

async function rateLimitedWait(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  const waitMs = REQUEST_INTERVAL_MS - elapsed;
  lastRequestTime = waitMs > 0 ? now + waitMs : now;
  if (waitMs > 0) {
    await new Promise((resolve) =>
      setTimeout(resolve, waitMs)
    );
  }
}

export async function fetchWithRateLimit(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  await rateLimitedWait();

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_RESPONSE_SIZE) {
    throw new Error(`Response too large (${contentLength} bytes). Maximum is ${MAX_RESPONSE_SIZE} bytes.`);
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
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_RESPONSE_SIZE) {
    throw new Error(`Response too large (${contentLength} bytes). Maximum is ${MAX_RESPONSE_SIZE} bytes.`);
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
  const lowerXml = xml.toLowerCase();
  const openTag = `<${tagName.toLowerCase()}`;
  const closeTag = `</${tagName.toLowerCase()}>`;
  let pos = 0;

  while (pos < lowerXml.length) {
    const start = lowerXml.indexOf(openTag, pos);
    if (start === -1) break;
    const gtPos = xml.indexOf(">", start);
    if (gtPos === -1) break;
    const contentStart = gtPos + 1;
    const end = lowerXml.indexOf(closeTag, contentStart);
    if (end === -1) break;
    results.push(xml.slice(contentStart, end).trim());
    pos = end + closeTag.length;
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
  const lowerXml = xml.toLowerCase();
  const openTag = `<${blockTag.toLowerCase()}`;
  const closeTag = `</${blockTag.toLowerCase()}>`;
  let pos = 0;

  while (pos < lowerXml.length) {
    const start = lowerXml.indexOf(openTag, pos);
    if (start === -1) break;
    const gtPos = xml.indexOf(">", start);
    if (gtPos === -1) break;
    const contentStart = gtPos + 1;
    const end = lowerXml.indexOf(closeTag, contentStart);
    if (end === -1) break;
    const blockContent = xml.slice(contentStart, end);
    pos = end + closeTag.length;

    const record: Record<string, string> = {};
    for (const field of fields) {
      const vals = extractXmlElements(blockContent, field);
      if (vals.length > 0) {
        record[field] = vals[0];
      }
    }

    if (Object.keys(record).length > 0) {
      results.push(record);
    }
  }

  return results;
}

/**
 * Extract blocks between matching open/close HTML/XML tags using string search.
 * Returns the full inner content of each block (including nested tags).
 */
export function extractHtmlBlocks(html: string, tagName: string): string[] {
  const results: string[] = [];
  const lowerHtml = html.toLowerCase();
  const openTag = `<${tagName.toLowerCase()}`;
  const closeTag = `</${tagName.toLowerCase()}>`;
  let pos = 0;

  while (pos < lowerHtml.length) {
    const start = lowerHtml.indexOf(openTag, pos);
    if (start === -1) break;
    const gtPos = html.indexOf(">", start);
    if (gtPos === -1) break;
    const contentStart = gtPos + 1;
    const end = lowerHtml.indexOf(closeTag, contentStart);
    if (end === -1) break;
    results.push(html.slice(start, end + closeTag.length));
    pos = end + closeTag.length;
  }

  return results;
}

/**
 * Strip all HTML/XML tags from a string using a char-walker (no regex).
 */
export function stripTags(html: string): string {
  let result = "";
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    if (html[i] === "<") inTag = true;
    else if (html[i] === ">") inTag = false;
    else if (!inTag) result += html[i];
  }
  return result;
}
