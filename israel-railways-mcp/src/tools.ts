/**
 * Tool registrations for israel-railways-mcp.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchRoutes, getServiceUpdates } from "./client.js";
import { STATIONS, findStation } from "./stations.js";

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

function errorResult(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

function resolveStation(query: string): { id: string; name: string } {
  const station = findStation(query);
  if (!station) {
    throw new Error(
      `Station not found: "${query}". Use the list_stations tool to see all available stations. Try searching by city name (e.g. "Tel Aviv", "Haifa", "Jerusalem").`
    );
  }
  return { id: station.id, name: station.nameEn };
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    });
  } catch {
    return isoString;
  }
}

export function registerTools(server: McpServer): void {
  // --- search_routes ---
  server.registerTool(
    "search_routes",
    {
      title: "Search Train Routes",
      description:
        "Search for train routes between two Israel Railways stations. Returns departure/arrival times, platform numbers, transfers, and predicted occupancy. Station names can be in Hebrew or English (fuzzy matching supported).",
      inputSchema: z.object({
        from: z
          .string()
          .describe(
            'Origin station name or ID, e.g. "Tel Aviv", "חיפה", "3700"'
          ),
        to: z
          .string()
          .describe(
            'Destination station name or ID, e.g. "Jerusalem", "באר שבע"'
          ),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
          .describe("Travel date in YYYY-MM-DD format"),
        hour: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM")
          .default("08:00")
          .describe("Departure time in HH:MM format (default 08:00)"),
      }),
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ from, to, date, hour }) => {
      try {
        const origin = resolveStation(from);
        const dest = resolveStation(to);

        const routes = await searchRoutes(origin.id, dest.id, date, hour);

        const output = {
          from: origin.name,
          to: dest.name,
          date,
          routeCount: routes.length,
          routes: routes.map((r) => {
            const departure = formatTime(r.departureTime);
            const arrival = formatTime(r.arrivalTime);
            const transfers = r.trains.length - 1;

            return {
              departure,
              arrival,
              transfers,
              trains: r.trains.map((t) => {
                const fromSt = findStation(t.originStation);
                const toSt = findStation(t.destinationStation);
                return {
                  trainNumber: t.trainNumber,
                  from: fromSt?.nameEn ?? t.originStation,
                  to: toSt?.nameEn ?? t.destinationStation,
                  departure: formatTime(t.departureTime),
                  arrival: formatTime(t.arrivalTime),
                  platform: t.originPlatform,
                  destPlatform: t.destPlatform,
                  occupancy: `${t.occupancy}%`,
                  stops: t.stopStations.length,
                };
              }),
            };
          }),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- list_stations ---
  server.registerTool(
    "list_stations",
    {
      title: "List Stations",
      description:
        "List all Israel Railways stations with IDs and names in Hebrew and English. Use this to find station IDs for the search_routes tool.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe(
            'Optional filter to search by name (Hebrew or English), e.g. "Tel Aviv", "ירושלים"'
          ),
      }),
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ filter }) => {
      try {
        let stations = STATIONS;
        if (filter) {
          const q = filter.toLowerCase();
          stations = STATIONS.filter(
            (s) =>
              s.nameEn.toLowerCase().includes(q) ||
              s.nameHe.includes(filter)
          );
        }

        const output = {
          count: stations.length,
          stations: stations.map((s) => ({
            id: s.id,
            nameEn: s.nameEn,
            nameHe: s.nameHe,
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- get_service_updates ---
  server.registerTool(
    "get_service_updates",
    {
      title: "Get Service Updates",
      description:
        "Get current Israel Railways service updates, disruptions, and announcements. Includes scheduled maintenance, route changes, and emergency notices.",
      inputSchema: z.object({}),
      annotations: TOOL_ANNOTATIONS,
    },
    async () => {
      try {
        const updates = await getServiceUpdates();

        if (updates.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  count: 0,
                  message: "No active service updates.",
                }),
              },
            ],
          };
        }

        const output = {
          count: updates.length,
          updates: updates.map((u) => ({
            header: u.header,
            content: u.content,
            startDate: u.startDate,
            endDate: u.endDate,
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
}
