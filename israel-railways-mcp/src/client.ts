/**
 * Israel Railways API client.
 * Uses the rail.co.il internal API (same endpoints that power the official website).
 */

const API_BASE = "https://rail-api.rail.co.il/rjpa/api/v1";
const API_KEY = "5e64d66cf03f4547bcac5de2de06b566";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

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

  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ocp-apim-subscription-key": API_KEY,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
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
        orignStation: number;
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
  const start = result.startFromIndex;
  const count = result.numOfResultsToShow;
  const travels = result.travels.slice(start, start + count);

  return travels.map((t) => ({
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
  const response = await fetch(
    `${API_BASE}/timetable/generalMessages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ocp-apim-subscription-key": API_KEY,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        languageId: "English",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Israel Railways API returned status ${response.status} for service updates`
    );
  }

  const data = (await response.json()) as GeneralUpdatesResponse;

  return (data.result || []).map((u) => ({
    id: String(u.id),
    header: u.header,
    content: u.content,
    startDate: u.startDate,
    endDate: u.endDate,
  }));
}
