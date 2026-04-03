const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const THROTTLE_MS = 350;

let lastRequestTime = 0;

function getApiKeyParam(): string {
  const apiKey = process.env.NCBI_API_KEY;
  return apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < THROTTLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export async function pubmedSearch(
  term: string,
  maxResults: number,
  options?: { mindate?: string; maxdate?: string; datetype?: string; rettype?: string }
): Promise<unknown> {
  await throttle();

  let url = `${BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=${maxResults}&retmode=json${getApiKeyParam()}`;

  if (options?.mindate) {
    url += `&mindate=${encodeURIComponent(options.mindate)}`;
  }
  if (options?.maxdate) {
    url += `&maxdate=${encodeURIComponent(options.maxdate)}`;
  }
  if (options?.datetype) {
    url += `&datetype=${encodeURIComponent(options.datetype)}`;
  }
  if (options?.rettype) {
    url += `&rettype=${encodeURIComponent(options.rettype)}`;
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`PubMed esearch failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function pubmedSummary(ids: string[]): Promise<unknown> {
  await throttle();

  const url = `${BASE_URL}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json${getApiKeyParam()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`PubMed esummary failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function pubmedFetch(ids: string[]): Promise<string> {
  await throttle();

  const url = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&rettype=abstract&retmode=xml${getApiKeyParam()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`PubMed efetch failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
