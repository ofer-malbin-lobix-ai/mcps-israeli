/**
 * Tool definitions and handlers for the Israel Vehicle Registry MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  datastoreSearch,
  type DataStoreRecord,
} from "./client.js";

const CHARACTER_LIMIT = 25_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVehicle(rec: DataStoreRecord): string {
  const lines: string[] = [];
  lines.push(`## ${rec.kinuy_mishari || rec.degem_nm} (${rec.mispar_rechev})`);
  lines.push(`- **Manufacturer**: ${rec.tozeret_nm}`);
  lines.push(`- **Model code**: ${rec.degem_nm}`);
  if (rec.kinuy_mishari) lines.push(`- **Commercial name**: ${rec.kinuy_mishari}`);
  lines.push(`- **Year**: ${rec.shnat_yitzur}`);
  lines.push(`- **Fuel**: ${rec.sug_delek_nm}`);
  lines.push(`- **Color**: ${rec.tzeva_rechev}`);
  lines.push(`- **Ownership**: ${rec.baalut}`);
  lines.push(`- **Trim**: ${rec.ramat_gimur}`);
  lines.push(`- **Safety level**: ${rec.ramat_eivzur_betihuty}`);
  lines.push(`- **Emissions group**: ${rec.kvutzat_zihum}`);
  lines.push(`- **Engine**: ${rec.degem_manoa}`);
  lines.push(`- **Front tires**: ${rec.zmig_kidmi}`);
  lines.push(`- **Rear tires**: ${rec.zmig_ahori}`);
  lines.push(`- **Chassis (VIN)**: ${rec.misgeret}`);
  lines.push(`- **First registered**: ${rec.moed_aliya_lakvish}`);
  lines.push(`- **Last test**: ${rec.mivchan_acharon_dt}`);
  lines.push(`- **Test valid until**: ${rec.tokef_dt}`);
  return lines.join("\n");
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT) +
    "\n\n---\n*Response truncated. Use filters or pagination to see more results.*"
  );
}

// ---------------------------------------------------------------------------
// Tool: search_vehicle
// ---------------------------------------------------------------------------

const SearchVehicleSchema = z
  .object({
    plate_number: z
      .coerce.string()
      .regex(/^\d{5,8}$/, "Plate number must be 5-8 digits")
      .describe("Israeli license plate number (mispar rechev), e.g. 1234567"),
  })
  .strict();

// ---------------------------------------------------------------------------
// Tool: search_by_model
// ---------------------------------------------------------------------------

const SearchByModelSchema = z
  .object({
    manufacturer: z
      .string()
      .optional()
      .describe(
        "Manufacturer name in Hebrew (tozeret_nm), e.g. 'טויוטה', 'יונדאי'"
      ),
    commercial_name: z
      .string()
      .optional()
      .describe(
        "Commercial model name (kinuy_mishari), e.g. 'COROLLA', 'i20'"
      ),
    year: z
      .number()
      .int()
      .optional()
      .describe("Year of manufacture (shnat_yitzur)"),
    fuel_type: z
      .string()
      .optional()
      .describe("Fuel type in Hebrew (sug_delek_nm), e.g. 'בנזין', 'דיזל', 'חשמל'"),
    limit: z.number().int().min(1).max(100).default(20).describe("Max results"),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Pagination offset"),
  })
  .strict();

// ---------------------------------------------------------------------------
// Tool: count_vehicles
// ---------------------------------------------------------------------------

const CountVehiclesSchema = z
  .object({
    manufacturer: z
      .string()
      .optional()
      .describe("Manufacturer name in Hebrew, e.g. 'טויוטה'"),
    fuel_type: z
      .string()
      .optional()
      .describe("Fuel type in Hebrew, e.g. 'בנזין', 'דיזל', 'חשמל'"),
    year: z
      .number()
      .int()
      .optional()
      .describe("Year of manufacture"),
    color: z
      .string()
      .optional()
      .describe("Vehicle color in Hebrew, e.g. 'לבן', 'שחור'"),
    ownership: z
      .string()
      .optional()
      .describe("Ownership type in Hebrew, e.g. 'פרטי', 'השכרה'"),
  })
  .strict();

// ---------------------------------------------------------------------------
// Tool: get_test_status
// ---------------------------------------------------------------------------

const GetTestStatusSchema = z
  .object({
    plate_number: z
      .coerce.string()
      .regex(/^\d{5,8}$/, "Plate number must be 5-8 digits")
      .describe("Israeli license plate number"),
  })
  .strict();

// ---------------------------------------------------------------------------
// Tool: list_manufacturers (uses sampling to discover manufacturers)
// ---------------------------------------------------------------------------

const ListManufacturersSchema = z
  .object({
    search: z
      .string()
      .optional()
      .describe("Optional text search to filter manufacturer names (Hebrew)"),
  })
  .strict();

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // 1. search_vehicle
  server.registerTool(
    "search_vehicle",
    {
      title: "Search Vehicle by Plate Number",
      description:
        "Look up an Israeli vehicle by its license plate number (mispar rechev). " +
        "Returns make, model, year, fuel type, color, safety rating, emissions group, " +
        "roadworthiness test dates, chassis number, and more from the Ministry of Transport registry.",
      inputSchema: SearchVehicleSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ plate_number }) => {
      try {
        const result = await datastoreSearch({
          filters: { mispar_rechev: plate_number },
          limit: 5,
        });

        if (result.records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No vehicle found with plate number ${plate_number}.`,
              },
            ],
          };
        }

        const text = result.records.map(formatVehicle).join("\n\n");
        return { content: [{ type: "text" as const, text: truncate(text) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // 2. search_by_model
  server.registerTool(
    "search_by_model",
    {
      title: "Search Vehicles by Model",
      description:
        "Search Israeli vehicles by manufacturer, commercial name, year, or fuel type. " +
        "Manufacturer names are in Hebrew (e.g. 'טויוטה'). Commercial names are usually " +
        "in English (e.g. 'COROLLA'). Supports pagination via limit and offset.",
      inputSchema: SearchByModelSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ manufacturer, commercial_name, year, fuel_type, limit, offset }) => {
      try {
        const filters: Record<string, unknown> = {};
        if (manufacturer) filters.tozeret_nm = manufacturer;
        if (commercial_name) filters.kinuy_mishari = commercial_name;
        if (year) filters.shnat_yitzur = year;
        if (fuel_type) filters.sug_delek_nm = fuel_type;

        if (Object.keys(filters).length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Provide at least one filter (manufacturer, commercial_name, year, or fuel_type).",
              },
            ],
          };
        }

        const result = await datastoreSearch({ filters, limit, offset });

        if (result.records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No vehicles found matching the given criteria.",
              },
            ],
          };
        }

        const header = `Found ${result.total} vehicles (showing ${result.records.length}, offset ${offset}).\n\n`;
        const body = result.records.map(formatVehicle).join("\n\n");
        const hasMore = result.total > offset + result.records.length;
        const footer = hasMore
          ? `\n\n---\n*More results available. Use offset=${offset + result.records.length} to see the next page.*`
          : "";

        return {
          content: [
            { type: "text" as const, text: truncate(header + body + footer) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // 3. count_vehicles
  server.registerTool(
    "count_vehicles",
    {
      title: "Count Vehicles",
      description:
        "Count how many vehicles in the Israeli registry match given criteria. " +
        "Filter by manufacturer (Hebrew), fuel type, year, color, or ownership type. " +
        "Returns the total count without fetching individual records. " +
        "Example: count electric cars by setting fuel_type to 'חשמל'.",
      inputSchema: CountVehiclesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ manufacturer, fuel_type, year, color, ownership }) => {
      try {
        const filters: Record<string, unknown> = {};
        if (manufacturer) filters.tozeret_nm = manufacturer;
        if (fuel_type) filters.sug_delek_nm = fuel_type;
        if (year) filters.shnat_yitzur = year;
        if (color) filters.tzeva_rechev = color;
        if (ownership) filters.baalut = ownership;

        if (Object.keys(filters).length === 0) {
          // Return total fleet size
          const result = await datastoreSearch({ limit: 0 });
          return {
            content: [
              {
                type: "text" as const,
                text: `Total vehicles in the Israeli registry: ${result.total.toLocaleString()}`,
              },
            ],
          };
        }

        const result = await datastoreSearch({ filters, limit: 0 });

        const criteria = Object.entries(filters)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");

        return {
          content: [
            {
              type: "text" as const,
              text: `Vehicles matching [${criteria}]: ${result.total.toLocaleString()}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // 4. get_test_status
  server.registerTool(
    "get_test_status",
    {
      title: "Check Vehicle Test Status",
      description:
        "Check whether an Israeli vehicle's annual roadworthiness test (test/טסט) is current or expired. " +
        "Returns the last test date, validity expiration date, and whether the test is still valid today.",
      inputSchema: GetTestStatusSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ plate_number }) => {
      try {
        const result = await datastoreSearch({
          filters: { mispar_rechev: plate_number },
          fields: "mispar_rechev,tozeret_nm,kinuy_mishari,shnat_yitzur,mivchan_acharon_dt,tokef_dt",
          limit: 1,
        });

        if (result.records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No vehicle found with plate number ${plate_number}.`,
              },
            ],
          };
        }

        const rec = result.records[0];
        const validUntil = String(rec.tokef_dt || "");
        const validDate = new Date(String(rec.tokef_dt || ""));
        const isValid = !isNaN(validDate.getTime()) && validDate >= new Date();

        const lines = [
          `# Test Status for ${rec.kinuy_mishari || rec.tozeret_nm} (${plate_number})`,
          "",
          `- **Vehicle**: ${rec.tozeret_nm} ${rec.kinuy_mishari || ""} (${rec.shnat_yitzur})`,
          `- **Last test**: ${rec.mivchan_acharon_dt || "N/A"}`,
          `- **Valid until**: ${validUntil || "N/A"}`,
          `- **Status**: ${isValid ? "VALID" : "EXPIRED"}`,
        ];

        if (!isValid && validUntil) {
          lines.push(
            `- **Note**: Test expired on ${validUntil}. The vehicle must pass a new roadworthiness test.`
          );
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // 5. list_manufacturers
  server.registerTool(
    "list_manufacturers",
    {
      title: "List Vehicle Manufacturers",
      description:
        "Discover vehicle manufacturer names in the Israeli registry. " +
        "Fetches a sample of up to 500 vehicles and extracts unique manufacturer names. " +
        "Optionally filter by a search term. Manufacturer names are in Hebrew. " +
        "Use count_vehicles with a specific manufacturer to get exact counts.",
      inputSchema: ListManufacturersSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ search }) => {
      try {
        // Fetch a sample to discover manufacturers
        const result = await datastoreSearch({
          q: search,
          fields: "tozeret_nm",
          limit: 500,
        });

        // Aggregate unique manufacturers from the sample
        const counts = new Map<string, number>();
        for (const rec of result.records) {
          const name = String(rec.tozeret_nm || "").trim();
          if (name) {
            counts.set(name, (counts.get(name) || 0) + 1);
          }
        }

        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No manufacturers found." },
            ],
          };
        }

        const lines = [
          `# Vehicle Manufacturers (from ${result.records.length.toLocaleString()} sampled records)\n`,
          "| # | Manufacturer | In sample |",
          "|---|---|---|",
        ];
        sorted.forEach(([name, count], i) => {
          lines.push(`| ${i + 1} | ${name} | ${count.toLocaleString()} |`);
        });
        lines.push(
          "\n*Counts are from a sample. Use count_vehicles with a specific manufacturer for exact totals.*"
        );

        return {
          content: [{ type: "text" as const, text: truncate(lines.join("\n")) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
