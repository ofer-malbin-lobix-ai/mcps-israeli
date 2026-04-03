/**
 * Tool definitions and handlers for the Israel Elections MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  datastoreSearch,
  getSettlementResourceId,
  SUPPORTED_KNESSETS,
  type DataStoreRecord,
  type KnessetNumber,
} from "./client.js";

const CHARACTER_LIMIT = 25_000;

// ---------------------------------------------------------------------------
// Known metadata fields (not party vote columns)
// ---------------------------------------------------------------------------

const META_FIELDS = new Set([
  "_id",
  "סמל ועדה",
  "שם ישוב",
  "סמל ישוב",
  "בזב",
  "מצביעים",
  "פסולים",
  "כשרים",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract party vote columns from a record (everything that is not a metadata field).
 */
function extractPartyVotes(
  record: DataStoreRecord
): Array<{ party: string; votes: number }> {
  const parties: Array<{ party: string; votes: number }> = [];
  for (const [key, value] of Object.entries(record)) {
    if (META_FIELDS.has(key)) continue;
    const votes = Number(value);
    if (!isNaN(votes) && votes > 0) {
      parties.push({ party: key, votes });
    }
  }
  return parties.sort((a, b) => b.votes - a.votes);
}

function formatElectionResult(
  record: DataStoreRecord,
  knesset: number
): string {
  const settlement = String(record["שם ישוב"] || "Unknown");
  const eligible = Number(record["בזב"] || 0);
  const voters = Number(record["מצביעים"] || 0);
  const invalid = Number(record["פסולים"] || 0);
  const valid = Number(record["כשרים"] || 0);
  const turnout = eligible > 0 ? ((voters / eligible) * 100).toFixed(1) : "N/A";

  const parties = extractPartyVotes(record);

  const lines: string[] = [];
  lines.push(`## Knesset ${knesset} - ${settlement}`);
  lines.push("");
  lines.push(`- **Eligible voters**: ${eligible.toLocaleString()}`);
  lines.push(`- **Actual voters**: ${voters.toLocaleString()}`);
  lines.push(`- **Turnout**: ${turnout}%`);
  lines.push(`- **Invalid ballots**: ${invalid.toLocaleString()}`);
  lines.push(`- **Valid ballots**: ${valid.toLocaleString()}`);
  lines.push("");
  lines.push("### Party Results");
  lines.push("");
  lines.push("| Party Code | Votes | % of Valid |");
  lines.push("|---|---|---|");

  for (const { party, votes } of parties) {
    const pct = valid > 0 ? ((votes / valid) * 100).toFixed(1) : "0.0";
    lines.push(`| ${party} | ${votes.toLocaleString()} | ${pct}% |`);
  }

  return lines.join("\n");
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return (
    text.slice(0, CHARACTER_LIMIT) +
    "\n\n---\n*Response truncated. Use more specific filters to see fewer results.*"
  );
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const KnessetNumberSchema = z
  .number()
  .int()
  .refine((n): n is KnessetNumber => SUPPORTED_KNESSETS.includes(n as KnessetNumber), {
    message: "Supported Knesset numbers: 23, 24, 25",
  });

const GetElectionResultsSchema = z
  .object({
    knesset_number: KnessetNumberSchema.describe(
      "Knesset election number (23, 24, or 25)"
    ),
    settlement_name: z
      .string()
      .min(1)
      .describe("Settlement name in Hebrew (e.g. 'ירושלים', 'תל אביב -יפו')"),
  })
  .strict();

const SearchSettlementsSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .describe("Search query in Hebrew to match settlement names"),
    knesset_number: KnessetNumberSchema.describe(
      "Knesset election number (23, 24, or 25)"
    ),
  })
  .strict();

const GetTurnoutSchema = z
  .object({
    knesset_number: KnessetNumberSchema.describe(
      "Knesset election number (23, 24, or 25)"
    ),
    settlement_name: z
      .string()
      .min(1)
      .describe("Settlement name in Hebrew"),
  })
  .strict();

const CompareElectionsSchema = z
  .object({
    settlement_name: z
      .string()
      .min(1)
      .describe(
        "Settlement name in Hebrew. Compared across Knesset 23, 24, and 25."
      ),
  })
  .strict();

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // 1. get_election_results
  server.registerTool(
    "get_election_results",
    {
      title: "Get Election Results",
      description:
        "Get Knesset election results for a specific settlement. " +
        "Returns party vote counts, eligible voters, actual voters, turnout, and invalid/valid ballot counts. " +
        "Settlement names are in Hebrew. Supports Knesset 23, 24, and 25.",
      inputSchema: GetElectionResultsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ knesset_number, settlement_name }) => {
      try {
        const resourceId = getSettlementResourceId(knesset_number as KnessetNumber);
        const result = await datastoreSearch({
          resourceId,
          filters: { "שם ישוב": settlement_name },
          limit: 1,
        });

        if (result.records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No results found for "${settlement_name}" in Knesset ${knesset_number} elections. Try using search_settlements to find the exact name.`,
              },
            ],
          };
        }

        const text = formatElectionResult(result.records[0], knesset_number);
        return { content: [{ type: "text" as const, text }] };
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

  // 2. search_settlements
  server.registerTool(
    "search_settlements",
    {
      title: "Search Settlements",
      description:
        "Search for settlement names in Knesset election data. " +
        "Use this to find the exact Hebrew settlement name before querying results. " +
        "Returns matching settlement names with basic vote totals (eligible voters, actual voters).",
      inputSchema: SearchSettlementsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ query, knesset_number }) => {
      try {
        const resourceId = getSettlementResourceId(knesset_number as KnessetNumber);
        const result = await datastoreSearch({
          resourceId,
          q: query,
          fields: "שם ישוב,סמל ישוב,בזב,מצביעים,כשרים",
          limit: 50,
        });

        if (result.records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No settlements found matching "${query}" in Knesset ${knesset_number} data.`,
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(
          `# Settlements matching "${query}" (Knesset ${knesset_number})\n`
        );
        lines.push(
          `Found ${result.records.length} result(s) (out of ${result.total} total).\n`
        );
        lines.push("| Settlement | Code | Eligible Voters | Actual Voters | Valid Ballots |");
        lines.push("|---|---|---|---|---|");

        for (const rec of result.records) {
          const name = String(rec["שם ישוב"] || "");
          const code = String(rec["סמל ישוב"] || "");
          const eligible = Number(rec["בזב"] || 0);
          const voters = Number(rec["מצביעים"] || 0);
          const valid = Number(rec["כשרים"] || 0);
          lines.push(
            `| ${name} | ${code} | ${eligible.toLocaleString()} | ${voters.toLocaleString()} | ${valid.toLocaleString()} |`
          );
        }

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

  // 3. get_turnout
  server.registerTool(
    "get_turnout",
    {
      title: "Get Voter Turnout",
      description:
        "Get voter turnout statistics for a settlement in a specific Knesset election. " +
        "Returns eligible voters, actual voters, turnout percentage, and invalid/valid ballot counts.",
      inputSchema: GetTurnoutSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ knesset_number, settlement_name }) => {
      try {
        const resourceId = getSettlementResourceId(knesset_number as KnessetNumber);
        const result = await datastoreSearch({
          resourceId,
          filters: { "שם ישוב": settlement_name },
          fields: "שם ישוב,סמל ישוב,בזב,מצביעים,פסולים,כשרים",
          limit: 1,
        });

        if (result.records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No results found for "${settlement_name}" in Knesset ${knesset_number}. Try using search_settlements to find the exact name.`,
              },
            ],
          };
        }

        const rec = result.records[0];
        const settlement = String(rec["שם ישוב"] || "");
        const eligible = Number(rec["בזב"] || 0);
        const voters = Number(rec["מצביעים"] || 0);
        const invalid = Number(rec["פסולים"] || 0);
        const valid = Number(rec["כשרים"] || 0);
        const turnoutPct =
          eligible > 0 ? ((voters / eligible) * 100).toFixed(1) : "N/A";
        const invalidPct =
          voters > 0 ? ((invalid / voters) * 100).toFixed(1) : "N/A";

        const lines = [
          `# Voter Turnout: ${settlement} (Knesset ${knesset_number})`,
          "",
          `- **Eligible voters (בזב)**: ${eligible.toLocaleString()}`,
          `- **Actual voters (מצביעים)**: ${voters.toLocaleString()}`,
          `- **Turnout**: ${turnoutPct}%`,
          `- **Invalid ballots (פסולים)**: ${invalid.toLocaleString()} (${invalidPct}% of votes)`,
          `- **Valid ballots (כשרים)**: ${valid.toLocaleString()}`,
        ];

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

  // 4. compare_elections
  server.registerTool(
    "compare_elections",
    {
      title: "Compare Elections",
      description:
        "Compare election results for a settlement across Knesset 23, 24, and 25. " +
        "Returns side-by-side turnout data and top parties for each election. " +
        "Useful for understanding voting trends over time.",
      inputSchema: CompareElectionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ settlement_name }) => {
      try {
        const results: Array<{
          knesset: number;
          found: boolean;
          record?: DataStoreRecord;
        }> = [];

        for (const knesset of SUPPORTED_KNESSETS) {
          const resourceId = getSettlementResourceId(knesset);
          const result = await datastoreSearch({
            resourceId,
            filters: { "שם ישוב": settlement_name },
            limit: 1,
          });

          results.push({
            knesset,
            found: result.records.length > 0,
            record: result.records[0],
          });
        }

        const found = results.filter((r) => r.found);
        if (found.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No election data found for "${settlement_name}" in any Knesset (23, 24, 25). Try using search_settlements to find the exact name.`,
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(`# Election Comparison: ${settlement_name}`);
        lines.push("");

        // Turnout comparison table
        lines.push("## Turnout Comparison");
        lines.push("");
        lines.push("| Metric | Knesset 23 | Knesset 24 | Knesset 25 |");
        lines.push("|---|---|---|---|");

        const metrics = [
          { label: "Eligible voters", field: "בזב" },
          { label: "Actual voters", field: "מצביעים" },
          { label: "Turnout %", field: "_turnout" },
          { label: "Valid ballots", field: "כשרים" },
          { label: "Invalid ballots", field: "פסולים" },
        ];

        for (const metric of metrics) {
          const cells = results.map((r) => {
            if (!r.found || !r.record) return "N/A";
            if (metric.field === "_turnout") {
              const eligible = Number(r.record["בזב"] || 0);
              const voters = Number(r.record["מצביעים"] || 0);
              return eligible > 0
                ? `${((voters / eligible) * 100).toFixed(1)}%`
                : "N/A";
            }
            const val = Number(r.record[metric.field] || 0);
            return val.toLocaleString();
          });
          lines.push(`| ${metric.label} | ${cells.join(" | ")} |`);
        }

        // Top parties per election
        for (const r of found) {
          if (!r.record) continue;
          const parties = extractPartyVotes(r.record);
          const valid = Number(r.record["כשרים"] || 0);
          const top = parties.slice(0, 5);

          lines.push("");
          lines.push(`## Top 5 Parties - Knesset ${r.knesset}`);
          lines.push("");
          lines.push("| Party Code | Votes | % of Valid |");
          lines.push("|---|---|---|");

          for (const { party, votes } of top) {
            const pct = valid > 0 ? ((votes / valid) * 100).toFixed(1) : "0.0";
            lines.push(`| ${party} | ${votes.toLocaleString()} | ${pct}% |`);
          }
        }

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
