/**
 * Israel Railways API client.
 * Uses the rail.co.il internal API (same endpoints that power the official website).
 */

const API_BASE = "https://rail-api.rail.co.il/rjpa/api/v1";
// Public key from rail.co.il website JavaScript; overridable via env var if rotated
const API_KEY =
  process.env.ISRAEL_RAILWAYS_API_KEY ?? "5e64d66cf03f4547bcac5de2de06b566";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

// Optional Israeli egress proxy. rail-api.rail.co.il is fronted by Cloudflare
// with a WAF that rejects requests from many datacenter ASNs (Railway Singapore
// / EU West both 403 even with correct headers). If IL_PROXY_URL is set, all
// rail-api traffic is forwarded through a small proxy running in AWS
// il-central-1 (Tel Aviv) whose IP range the WAF accepts. The proxy accepts
// POST JSON {endpoint, body} with an x-api-key header matching IL_PROXY_KEY.
const IL_PROXY_URL = process.env.IL_PROXY_URL;
const IL_PROXY_KEY = process.env.IL_PROXY_KEY;

export interface TrainLeg {
  trainNumber: number;
  originStation: string;
  destinationStation: string;
  departureTime: string;
  arrivalTime: string;
  originPlatform: number;
  destPlatform: number;
  occupancy: number;
  stopStations: StopStation[];
}

export interface StopStation {
  stationId: string;
  arrivalTime: string;
  departureTime: string;
  platform: number;
}

export interface Route {
  departureTime: string;
  arrivalTime: string;
  trains: TrainLeg[];
}

export interface ServiceUpdate {
  id: string;
  header: string;
  content: string;
  startDate: string;
  endDate: string;
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 500;

async function railRequest<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();

  const upstreamUrl = `${API_BASE}/${endpoint}`;
  const upstreamHeaders = {
    "Content-Type": "application/json",
    "ocp-apim-subscription-key": API_KEY,
    "User-Agent": USER_AGENT,
    // rail-api.rail.co.il's WAF rejects requests that don't look like they
    // originated from the official site. Without these, every request from
    // a datacenter ASN (e.g. Railway) returns 403 Forbidden even with a
    // valid subscription key.
    Referer: "https://www.rail.co.il/",
    Origin: "https://www.rail.co.il",
  };

  const response = IL_PROXY_URL && IL_PROXY_KEY
    ? await fetch(IL_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": IL_PROXY_KEY,
        },
        body: JSON.stringify({
          url: upstreamUrl,
          method: "POST",
          headers: upstreamHeaders,
          body,
        }),
        signal: AbortSignal.timeout(20_000),
      })
    : await fetch(upstreamUrl, {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Israel Railways API returned 403 Forbidden. The API key may have been rotated. Check for updates at https://github.com/skills-il/mcps"
      );
    }
    throw new Error(
      `Israel Railways API returned status ${response.status}: ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

function formatDateParam(dateStr: string): string {
  // API expects YYYY-MM-DD
  return dateStr;
}

function formatTimeParam(hour: string): string {
  // API expects HH:MM
  return hour;
}

interface SearchTrainResponse {
  result: {
    travels: Array<{
      departureTime: string;
      arrivalTime: string;
      trains: Array<{
        trainNumber: number;
        orignStation: number; // sic: typo in Israel Railways API response
        destinationStation: number;
        departureTime: string;
        arrivalTime: string;
        originPlatform: number;
        destPlatform: number;
        predictedPctLoad: number;
        stopStations: Array<{
          stationId: number;
          arrivalTime: string;
          departureTime: string;
          platform: number;
        }>;
      }>;
    }>;
    numOfResultsToShow: number;
    startFromIndex: number;
  };
}

export async function searchRoutes(
  fromStation: string,
  toStation: string,
  date: string,
  hour: string
): Promise<Route[]> {
  const data = await railRequest<SearchTrainResponse>(
    "timetable/searchTrain",
    {
      fromStation,
      toStation,
      date: formatDateParam(date),
      hour: formatTimeParam(hour),
      scheduleType: "ByDeparture",
      systemType: "2",
      languageId: "English",
    }
  );

  const result = data.result;
  const start = result.startFromIndex ?? 0;
  const travels = result.travels ?? [];
  const count = result.numOfResultsToShow ?? travels.length;
  const sliced = count > 0 ? travels.slice(start, start + count) : [];

  return sliced.map((t) => ({
    departureTime: t.departureTime,
    arrivalTime: t.arrivalTime,
    trains: t.trains.map((tr) => ({
      trainNumber: tr.trainNumber,
      originStation: String(tr.orignStation),
      destinationStation: String(tr.destinationStation),
      departureTime: tr.departureTime,
      arrivalTime: tr.arrivalTime,
      originPlatform: tr.originPlatform,
      destPlatform: tr.destPlatform,
      occupancy: tr.predictedPctLoad,
      stopStations: (tr.stopStations || []).map((ss) => ({
        stationId: String(ss.stationId),
        arrivalTime: ss.arrivalTime,
        departureTime: ss.departureTime,
        platform: ss.platform,
      })),
    })),
  }));
}

interface GeneralUpdatesResponse {
  result: Array<{
    id: number;
    header: string;
    content: string;
    startDate: string;
    endDate: string;
  }>;
}

export async function getServiceUpdates(): Promise<ServiceUpdate[]> {
  const data = await railRequest<GeneralUpdatesResponse>(
    "timetable/generalMessages",
    { languageId: "English" }
  );

  return (data.result || []).map((u) => ({
    id: String(u.id),
    header: u.header,
    content: u.content,
    startDate: u.startDate,
    endDate: u.endDate,
  }));
}
