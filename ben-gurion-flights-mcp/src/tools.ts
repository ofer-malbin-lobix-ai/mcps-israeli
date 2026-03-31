/**
 * Tool definitions and handlers for the Ben Gurion Flights MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchFlights, type FlightRecord } from "./client.js";

/** Format an ISO timestamp to a human-readable string. */
function formatTime(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IL", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

/** Format a single arrival flight as readable text. */
function formatArrival(f: FlightRecord): string {
  const lines = [
    `Flight: ${f.CHOPER}${f.CHFLTN} (${f.CHOPERD})`,
    `From: ${f.CHLOC1D || f.CHLOC1T} (${f.CHLOC1}) - ${f.CHLOC1TH}`,
    `Country: ${f.CHLOCCT} / ${f.CHLOC1CH}`,
    `Scheduled: ${formatTime(f.CHSTOL)}`,
    `Actual/Estimated: ${formatTime(f.CHPTOL)}`,
    `Terminal: ${f.CHTERM ?? "N/A"}`,
    `Status: ${f.CHRMINE || "N/A"} / ${f.CHRMINH || "N/A"}`,
  ];
  return lines.join("\n");
}

/** Format a single departure flight as readable text. */
function formatDeparture(f: FlightRecord): string {
  const lines = [
    `Flight: ${f.CHOPER}${f.CHFLTN} (${f.CHOPERD})`,
    `To: ${f.CHLOC1D || f.CHLOC1T} (${f.CHLOC1}) - ${f.CHLOC1TH}`,
    `Country: ${f.CHLOCCT} / ${f.CHLOC1CH}`,
    `Scheduled: ${formatTime(f.CHSTOL)}`,
    `Actual/Estimated: ${formatTime(f.CHPTOL)}`,
    `Terminal: ${f.CHTERM ?? "N/A"}`,
    `Check-in: ${f.CHCINT || "N/A"} (Zone: ${f.CHCKZN || "N/A"})`,
    `Status: ${f.CHRMINE || "N/A"} / ${f.CHRMINH || "N/A"}`,
  ];
  return lines.join("\n");
}

/** Format a flight with full details (for flight status lookup). */
function formatFlightFull(f: FlightRecord): string {
  const direction = f.CHAORD === "A" ? "Arrival" : "Departure";
  const cityLabel = f.CHAORD === "A" ? "From" : "To";
  const lines = [
    `Flight: ${f.CHOPER}${f.CHFLTN} (${f.CHOPERD})`,
    `Type: ${direction}`,
    `${cityLabel}: ${f.CHLOC1D || f.CHLOC1T} (${f.CHLOC1}) - ${f.CHLOC1TH}`,
    `Country: ${f.CHLOCCT} / ${f.CHLOC1CH}`,
    `Scheduled: ${formatTime(f.CHSTOL)}`,
    `Actual/Estimated: ${formatTime(f.CHPTOL)}`,
    `Terminal: ${f.CHTERM ?? "N/A"}`,
  ];
  if (f.CHAORD === "D") {
    lines.push(`Check-in: ${f.CHCINT || "N/A"} (Zone: ${f.CHCKZN || "N/A"})`);
  }
  lines.push(`Status: ${f.CHRMINE || "N/A"} / ${f.CHRMINH || "N/A"}`);
  return lines.join("\n");
}

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

/**
 * Register all flight tools on the given MCP server.
 */
export function registerTools(server: McpServer): void {
  // 1. get_arrivals
  server.tool(
    "get_arrivals",
    "Get current arriving flights at Ben Gurion Airport (TLV). Data from Israel Airports Authority, updated every 15 minutes.",
    {
      airline: z
        .string()
        .optional()
        .describe("Filter by airline IATA code (e.g. 'LY' for El Al, 'W6' for Wizz Air)"),
      origin: z
        .string()
        .optional()
        .describe("Filter by origin city name (English, e.g. 'LONDON')"),
      status: z
        .string()
        .optional()
        .describe("Filter by flight status (e.g. 'LANDED', 'EXPECTED', 'DELAYED')"),
    },
    TOOL_ANNOTATIONS,
    async ({ airline, origin, status }) => {
      try {
        const filters: Record<string, string> = { CHAORD: "A" };
        if (airline) filters.CHOPER = airline.toUpperCase();
        if (status) filters.CHRMINE = status.toUpperCase();

        const q = origin || undefined;

        const { records, total } = await searchFlights({
          filters,
          q,
          sort: "CHSTOL desc",
          limit: 100,
        });

        if (records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No arriving flights found matching the given filters.",
              },
            ],
          };
        }

        const header = `Ben Gurion Airport - Arrivals (showing ${records.length} of ${total})\n${"=".repeat(60)}`;
        const formatted = records.map(formatArrival).join("\n\n---\n\n");

        return {
          content: [{ type: "text" as const, text: `${header}\n\n${formatted}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching arrivals: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 2. get_departures
  server.tool(
    "get_departures",
    "Get current departing flights from Ben Gurion Airport (TLV). Data from Israel Airports Authority, updated every 15 minutes.",
    {
      airline: z
        .string()
        .optional()
        .describe("Filter by airline IATA code (e.g. 'LY' for El Al, 'W6' for Wizz Air)"),
      destination: z
        .string()
        .optional()
        .describe("Filter by destination city name (English, e.g. 'PARIS')"),
      status: z
        .string()
        .optional()
        .describe("Filter by flight status (e.g. 'DEPARTED', 'BOARDING', 'FINAL CALL')"),
    },
    TOOL_ANNOTATIONS,
    async ({ airline, destination, status }) => {
      try {
        const filters: Record<string, string> = { CHAORD: "D" };
        if (airline) filters.CHOPER = airline.toUpperCase();
        if (status) filters.CHRMINE = status.toUpperCase();

        const q = destination || undefined;

        const { records, total } = await searchFlights({
          filters,
          q,
          sort: "CHSTOL desc",
          limit: 100,
        });

        if (records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No departing flights found matching the given filters.",
              },
            ],
          };
        }

        const header = `Ben Gurion Airport - Departures (showing ${records.length} of ${total})\n${"=".repeat(60)}`;
        const formatted = records.map(formatDeparture).join("\n\n---\n\n");

        return {
          content: [{ type: "text" as const, text: `${header}\n\n${formatted}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching departures: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 3. get_flight_status
  server.tool(
    "get_flight_status",
    "Look up a specific flight by flight number at Ben Gurion Airport. Accepts formats like 'LY1626', 'W6 2843', or 'EL AL 1626'.",
    {
      flight_number: z
        .string()
        .describe("Flight number (e.g. 'LY1626', 'W62843', 'LY 315')"),
    },
    TOOL_ANNOTATIONS,
    async ({ flight_number }) => {
      try {
        // Parse flight number: extract airline code (letters) and number (digits)
        const cleaned = flight_number.trim().toUpperCase().replace(/\s+/g, "");
        const match = cleaned.match(/^([A-Z]{2})(\d+)$/);

        if (!match) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not parse flight number "${flight_number}". Expected format: airline code + number, e.g. "LY1626" or "W62843".`,
              },
            ],
            isError: true,
          };
        }

        const [, airlineCode, flightNum] = match;

        const { records } = await searchFlights({
          filters: { CHOPER: airlineCode, CHFLTN: flightNum },
          limit: 10,
        });

        if (records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No flights found for ${airlineCode}${flightNum}. The flight may not be scheduled for today or may have already been removed from the board.`,
              },
            ],
          };
        }

        const header = `Flight Status: ${airlineCode}${flightNum}\n${"=".repeat(40)}`;
        const formatted = records.map(formatFlightFull).join("\n\n---\n\n");

        return {
          content: [{ type: "text" as const, text: `${header}\n\n${formatted}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error looking up flight: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 4. search_flights
  server.tool(
    "search_flights",
    "Search flights at Ben Gurion Airport by destination, city, country, or airline name. Supports Hebrew and English text search.",
    {
      query: z
        .string()
        .describe("Search text (city, country, airline name - works in Hebrew and English)"),
    },
    TOOL_ANNOTATIONS,
    async ({ query }) => {
      try {
        const { records, total } = await searchFlights({
          q: query,
          sort: "CHSTOL desc",
          limit: 100,
        });

        if (records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No flights found matching "${query}".`,
              },
            ],
          };
        }

        const header = `Search results for "${query}" (showing ${records.length} of ${total})\n${"=".repeat(60)}`;
        const formatted = records.map(formatFlightFull).join("\n\n---\n\n");

        return {
          content: [{ type: "text" as const, text: `${header}\n\n${formatted}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching flights: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 5. get_airport_summary
  server.tool(
    "get_airport_summary",
    "Get summary statistics of current Ben Gurion Airport activity: total arrivals/departures, flights by airline, status breakdown, and top destination countries.",
    {},
    TOOL_ANNOTATIONS,
    async () => {
      try {
        const { records, total } = await searchFlights({ limit: 500 });

        const arrivals = records.filter((r) => r.CHAORD === "A");
        const departures = records.filter((r) => r.CHAORD === "D");

        // Count by airline
        const byAirline = new Map<string, number>();
        for (const r of records) {
          const key = `${r.CHOPER} (${r.CHOPERD})`;
          byAirline.set(key, (byAirline.get(key) ?? 0) + 1);
        }
        const airlineSorted = [...byAirline.entries()].sort((a, b) => b[1] - a[1]);

        // Count by status
        const byStatus = new Map<string, number>();
        for (const r of records) {
          const status = r.CHRMINE || "UNKNOWN";
          byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
        }
        const statusSorted = [...byStatus.entries()].sort((a, b) => b[1] - a[1]);

        // Count by country
        const byCountry = new Map<string, number>();
        for (const r of records) {
          const country = r.CHLOCCT || "UNKNOWN";
          byCountry.set(country, (byCountry.get(country) ?? 0) + 1);
        }
        const countrySorted = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);

        const lines: string[] = [
          `Ben Gurion Airport (TLV) - Activity Summary`,
          `${"=".repeat(50)}`,
          ``,
          `Total flights on board: ${total} (showing ${records.length})`,
          `Arrivals: ${arrivals.length}`,
          `Departures: ${departures.length}`,
          ``,
          `--- Flights by Status ---`,
          ...statusSorted.map(([status, count]) => `  ${status}: ${count}`),
          ``,
          `--- Flights by Airline ---`,
          ...airlineSorted.map(([airline, count]) => `  ${airline}: ${count}`),
          ``,
          `--- Flights by Country ---`,
          ...countrySorted.map(([country, count]) => `  ${country}: ${count}`),
        ];

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching airport summary: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
