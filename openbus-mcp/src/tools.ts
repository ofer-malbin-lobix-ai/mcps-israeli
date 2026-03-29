import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchApi, type ApiError } from "./client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateSchema = z.string().regex(dateRegex, "Date must be YYYY-MM-DD format");

function formatError(err: unknown): string {
  if (typeof err === "object" && err !== null && "status" in err) {
    const apiErr = err as ApiError;
    return `API error ${apiErr.status} (${apiErr.statusText}): ${apiErr.body}`;
  }
  if (err instanceof Error) {
    return `Error: ${err.message}`;
  }
  return `Unknown error: ${String(err)}`;
}

function formatRecord(record: Record<string, unknown>, indent = ""): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${indent}${key}:`);
      lines.push(formatRecord(value as Record<string, unknown>, indent + "  "));
    } else if (Array.isArray(value)) {
      lines.push(`${indent}${key}: [${value.join(", ")}]`);
    } else {
      lines.push(`${indent}${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

function formatResults(data: unknown, entityName: string): string {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `No ${entityName} found matching your query.`;
    }
    const header = `Found ${data.length} ${entityName}${data.length === 1 ? "" : "s"}:\n`;
    const entries = data.map((item: unknown, i: number) => {
      if (typeof item === "object" && item !== null) {
        return `--- ${entityName} ${i + 1} ---\n${formatRecord(item as Record<string, unknown>)}`;
      }
      return `${i + 1}. ${String(item)}`;
    });
    return header + entries.join("\n\n");
  }
  if (typeof data === "object" && data !== null) {
    return formatRecord(data as Record<string, unknown>);
  }
  return String(data);
}

async function handleToolCall(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  entityName: string
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const data = await fetchApi(path, params);
    const text = formatResults(data, entityName);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    return { content: [{ type: "text", text: formatError(err) }] };
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // 1. get_stop_arrivals
  server.tool(
    "get_stop_arrivals",
    "Get actual arrival times at a bus stop. Returns SIRI real-time arrival data for a given GTFS stop ID.",
    {
      gtfs_stop_id: z.number().int().describe("The GTFS stop ID (integer) to query arrivals for"),
      limit: z.number().int().min(1).max(500000).default(100).describe("Max results to return (default 100, max 500000)"),
      offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
    },
    TOOL_ANNOTATIONS,
    async ({ gtfs_stop_id, limit, offset }) => {
      return handleToolCall("/stop_arrivals/list", { gtfs_stop_id, limit, offset }, "arrival");
    }
  );

  // 2. get_ride_performance
  server.tool(
    "get_ride_performance",
    "Compare planned vs actual ride execution for a specific operator and line over a date range. Shows delays, early departures, and schedule adherence.",
    {
      date_from: dateSchema.describe("Start date (YYYY-MM-DD)"),
      date_to: dateSchema.describe("End date (YYYY-MM-DD)"),
      operator_ref: z.number().int().describe("Operator reference ID (e.g., 3 for Egged)"),
      line_ref: z.number().int().describe("Line reference ID"),
      limit: z.number().int().min(1).max(500000).default(100).describe("Max results to return (default 100, max 500000)"),
      offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
    },
    TOOL_ANNOTATIONS,
    async ({ date_from, date_to, operator_ref, line_ref, limit, offset }) => {
      return handleToolCall(
        "/rides_execution/list",
        { date_from, date_to, operator_ref, line_ref, limit, offset },
        "ride"
      );
    }
  );

  // 3. search_routes
  server.tool(
    "search_routes",
    "Search planned GTFS routes by operator, line number, name, agency, or type. Returns route metadata including short name, long name, and direction.",
    {
      date_from: dateSchema.optional().describe("Filter routes active from this date (YYYY-MM-DD)"),
      date_to: dateSchema.optional().describe("Filter routes active until this date (YYYY-MM-DD)"),
      line_refs: z.string().optional().describe("Comma-separated line reference IDs"),
      operator_refs: z.string().optional().describe("Comma-separated operator reference IDs"),
      route_short_name: z.string().optional().describe("Exact route short name (e.g., '480')"),
      route_long_name_contains: z.string().optional().describe("Substring to search in route long name"),
      agency_name: z.string().optional().describe("Agency name to filter by (e.g., 'אגד', 'דן')"),
      route_type: z.number().int().optional().describe("GTFS route type (3=bus, 2=rail, etc.)"),
      route_direction: z.number().int().optional().describe("Route direction (0 or 1)"),
      order_by: z.string().optional().describe("Field to order results by"),
      limit: z.number().int().min(1).max(500000).default(100).describe("Max results to return (default 100, max 500000)"),
      offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
    },
    TOOL_ANNOTATIONS,
    async (params) => {
      return handleToolCall("/gtfs_routes/list", params, "route");
    }
  );

  // 4. find_stops
  server.tool(
    "find_stops",
    "Find bus and transit stops by GTFS stop code or city name. Returns stop location and metadata.",
    {
      date_from: dateSchema.optional().describe("Filter stops active from this date (YYYY-MM-DD)"),
      date_to: dateSchema.optional().describe("Filter stops active until this date (YYYY-MM-DD)"),
      code: z.number().int().optional().describe("GTFS stop code (integer)"),
      city: z.string().optional().describe("City name to filter stops (e.g., 'תל אביב', 'ירושלים')"),
      limit: z.number().int().min(1).max(500000).default(100).describe("Max results to return (default 100, max 500000)"),
      offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
    },
    TOOL_ANNOTATIONS,
    async (params) => {
      return handleToolCall("/gtfs_stops/list", params, "stop");
    }
  );

  // 5. get_route_timetable
  server.tool(
    "get_route_timetable",
    "Get planned timetables for routes. Filter by planned start time date range and line references.",
    {
      planned_start_time_date_from: dateSchema.optional().describe("Start date for planned departure times (YYYY-MM-DD)"),
      planned_start_time_date_to: dateSchema.optional().describe("End date for planned departure times (YYYY-MM-DD)"),
      line_refs: z.string().optional().describe("Comma-separated line reference IDs to filter by"),
      limit: z.number().int().min(1).max(500000).default(100).describe("Max results to return (default 100, max 500000)"),
      offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
    },
    TOOL_ANNOTATIONS,
    async (params) => {
      return handleToolCall("/route_timetable/list", params, "timetable entry");
    }
  );

  // 6. get_vehicle_locations
  server.tool(
    "get_vehicle_locations",
    "Get real-time SIRI vehicle locations within a geographic bounding box and time range. Useful for tracking buses on a map.",
    {
      lat_min: z.number().optional().describe("Minimum latitude of bounding box"),
      lat_max: z.number().optional().describe("Maximum latitude of bounding box"),
      lon_min: z.number().optional().describe("Minimum longitude of bounding box"),
      lon_max: z.number().optional().describe("Maximum longitude of bounding box"),
      recorded_at_time_from: z.string().optional().describe("Start datetime for recorded positions (ISO 8601 or YYYY-MM-DD)"),
      recorded_at_time_to: z.string().optional().describe("End datetime for recorded positions (ISO 8601 or YYYY-MM-DD)"),
      siri_routes__line_ref: z.number().int().optional().describe("SIRI line reference ID to filter by"),
      siri_routes__operator_ref: z.number().int().optional().describe("SIRI operator reference ID to filter by"),
      limit: z.number().int().min(1).max(500000).default(100).describe("Max results to return (default 100, max 500000)"),
      offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
    },
    TOOL_ANNOTATIONS,
    async (params) => {
      return handleToolCall("/siri_vehicle_locations/list", params, "vehicle location");
    }
  );

  // 7. list_agencies
  server.tool(
    "list_agencies",
    "List Israeli transit operators/agencies (e.g., Egged, Dan, Metropoline). Filter by date range to see which agencies were active.",
    {
      date_from: dateSchema.optional().describe("Filter agencies active from this date (YYYY-MM-DD)"),
      date_to: dateSchema.optional().describe("Filter agencies active until this date (YYYY-MM-DD)"),
      limit: z.number().int().min(1).max(500000).default(100).describe("Max results to return (default 100, max 500000)"),
      offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
    },
    TOOL_ANNOTATIONS,
    async (params) => {
      return handleToolCall("/gtfs_agencies/list", params, "agency");
    }
  );
}
