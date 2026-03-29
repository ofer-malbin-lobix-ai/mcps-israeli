/**
 * Bank of Israel SDMX API client.
 * Fetches exchange rate data from the official BOI series database.
 */

const API_BASE =
  "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0";

interface ExchangeRateEntry {
  seriesCode: string;
  currency: string;
  date: string;
  rate: number;
  dataType: string;
}

function parseCSV(csv: string): ExchangeRateEntry[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(",");
  const seriesIdx = header.indexOf("SERIES_CODE");
  const currencyIdx = header.indexOf("BASE_CURRENCY");
  const dateIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  const dataTypeIdx = header.indexOf("DATA_TYPE");

  if (seriesIdx === -1 || dateIdx === -1 || valueIdx === -1) {
    throw new Error(
      "Unexpected CSV format from BOI API. Expected columns: SERIES_CODE, TIME_PERIOD, OBS_VALUE"
    );
  }

  const entries: ExchangeRateEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length <= Math.max(seriesIdx, dateIdx, valueIdx)) continue;

    const rate = parseFloat(cols[valueIdx]);
    if (isNaN(rate)) continue;

    entries.push({
      seriesCode: cols[seriesIdx],
      currency: currencyIdx !== -1 ? cols[currencyIdx] : "",
      date: cols[dateIdx],
      rate,
      dataType: dataTypeIdx !== -1 ? cols[dataTypeIdx] : "",
    });
  }

  return entries;
}

function buildURL(params: {
  currency?: string;
  startDate?: string;
  endDate?: string;
  dataType?: string;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set("format", "csv");

  if (params.dataType) {
    searchParams.set("c[DATA_TYPE]", params.dataType);
  }
  if (params.currency) {
    searchParams.set("c[BASE_CURRENCY]", params.currency.toUpperCase());
  }
  if (params.startDate) {
    searchParams.set("startperiod", params.startDate);
  }
  if (params.endDate) {
    searchParams.set("endperiod", params.endDate);
  }

  return `${API_BASE}?${searchParams.toString()}`;
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 300;

async function fetchBOI(url: string): Promise<string> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: { Accept: "text/csv" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "No data found for the given parameters. Check that the currency code is valid and the date range contains business days."
      );
    }
    throw new Error(
      `BOI API returned status ${response.status}: ${response.statusText}`
    );
  }

  return response.text();
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function getLatestRate(
  currency: string
): Promise<ExchangeRateEntry> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 14);

  const url = buildURL({
    currency,
    startDate: formatDate(start),
    endDate: formatDate(end),
    dataType: "OF00",
  });

  const csv = await fetchBOI(url);
  const entries = parseCSV(csv).filter((e) => e.dataType === "OF00");

  if (entries.length === 0) {
    throw new Error(
      `No representative rate found for ${currency.toUpperCase()}/ILS in the last 14 days. Verify the currency code is supported by the Bank of Israel.`
    );
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries[0];
}

export async function getHistoricalRates(
  currency: string,
  startDate: string,
  endDate: string
): Promise<ExchangeRateEntry[]> {
  const url = buildURL({
    currency,
    startDate,
    endDate,
    dataType: "OF00",
  });

  const csv = await fetchBOI(url);
  const entries = parseCSV(csv).filter((e) => e.dataType === "OF00");

  if (entries.length === 0) {
    throw new Error(
      `No rates found for ${currency.toUpperCase()}/ILS between ${startDate} and ${endDate}. The BOI publishes rates on business days only (Sunday-Thursday).`
    );
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

export async function listAvailableCurrencies(): Promise<string[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);

  const url = buildURL({
    startDate: formatDate(start),
    endDate: formatDate(end),
    dataType: "OF00",
  });

  const csv = await fetchBOI(url);
  const entries = parseCSV(csv).filter((e) => e.dataType === "OF00");

  const currencies = new Set<string>();
  for (const entry of entries) {
    if (entry.currency) {
      currencies.add(entry.currency);
    }
  }

  return Array.from(currencies).sort();
}
