/**
 * TASE MCP Tools
 *
 * All tools for the TASE (Tel Aviv Stock Exchange) MCP server.
 *
 * Endpoint paths:
 *   CONFIRMED: /board-and-management/positions?issuerId=76
 *   ESTIMATED: /securities, /securities/{id}, /securities/{id}/end-of-day,
 *              /indices, /indices/{id}/end-of-day, /indices/{id}/components,
 *              /announcements
 *   The estimated paths follow REST conventions based on official TASE product names.
 *   If an endpoint returns a 404, the path may need adjustment once official docs are available.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { taseClient, type TaseClientResponse } from "./client.js";

const langSchema = z
  .enum(["he-IL", "en-US"])
  .optional()
  .default("he-IL")
  .describe("Response language: he-IL (Hebrew, default) or en-US (English)");

function formatResult(result: TaseClientResponse): {
  content: { type: "text"; text: string }[];
  isError?: boolean;
} {
  if (!result.ok) {
    return {
      content: [{ type: "text" as const, text: result.error! }],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
}

const toolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

export function registerTools(server: McpServer): void {
  // 1. List Securities (ESTIMATED endpoint)
  server.registerTool(
    "tase_list_securities",
    {
      title: "List TASE Securities",
      description: "List all securities traded on the Tel Aviv Stock Exchange (TASE), including stocks, bonds, and ETFs. Returns security IDs, names, and classification data.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const result = await taseClient.get("/securities", undefined, lang);
      return formatResult(result);
    }
  );

  // 2. Get Security Details (ESTIMATED endpoint)
  server.registerTool(
    "tase_get_security",
    {
      title: "Get TASE Security Details",
      description: "Get detailed information about a specific security traded on TASE by its security ID. Returns classification, company info, and trading details.",
      inputSchema: {
        securityId: z.string().min(1).describe("TASE security identifier"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ securityId, lang }) => {
      const result = await taseClient.get(
        `/securities/${encodeURIComponent(securityId)}`,
        undefined,
        lang
      );
      return formatResult(result);
    }
  );

  // 3. Get Security End-of-Day Data (ESTIMATED endpoint)
  server.registerTool(
    "tase_get_security_eod",
    {
      title: "Get TASE Security End-of-Day Data",
      description: "Get end-of-day price data for a specific TASE security. Returns daily open, high, low, close, adjusted price, market cap, and volume.",
      inputSchema: {
        securityId: z.string().min(1).describe("TASE security identifier"),
        fromDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
        toDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ securityId, fromDate, toDate, lang }) => {
      const result = await taseClient.get(
        `/securities/${encodeURIComponent(securityId)}/end-of-day`,
        { fromDate, toDate },
        lang
      );
      return formatResult(result);
    }
  );

  // 4. List Indices (ESTIMATED endpoint)
  server.registerTool(
    "tase_list_indices",
    {
      title: "List TASE Indices",
      description: "List all indices on the Tel Aviv Stock Exchange, including TA-35, TA-125, TA-90, and sector indices.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const result = await taseClient.get("/indices", undefined, lang);
      return formatResult(result);
    }
  );

  // 5. Get Index End-of-Day Data (ESTIMATED endpoint)
  server.registerTool(
    "tase_get_index_eod",
    {
      title: "Get TASE Index End-of-Day Data",
      description: "Get end-of-day data for a specific TASE index. Returns daily values, volumes, and market capitalization.",
      inputSchema: {
        indexId: z.string().min(1).describe("TASE index identifier (e.g., TA-35, TA-125)"),
        fromDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
        toDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ indexId, fromDate, toDate, lang }) => {
      const result = await taseClient.get(
        `/indices/${encodeURIComponent(indexId)}/end-of-day`,
        { fromDate, toDate },
        lang
      );
      return formatResult(result);
    }
  );

  // 6. Get Index Components (ESTIMATED endpoint)
  server.registerTool(
    "tase_get_index_components",
    {
      title: "Get TASE Index Components",
      description: "Get the stocks that compose a TASE index with their weights. Useful for analyzing TA-35, TA-125, and other index compositions.",
      inputSchema: {
        indexId: z.string().min(1).describe("TASE index identifier (e.g., TA-35, TA-125)"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ indexId, lang }) => {
      const result = await taseClient.get(
        `/indices/${encodeURIComponent(indexId)}/components`,
        undefined,
        lang
      );
      return formatResult(result);
    }
  );

  // 7. Get Maya Announcements (ESTIMATED endpoint)
  server.registerTool(
    "tase_get_maya_announcements",
    {
      title: "Get Maya Announcements",
      description: "Get company announcements and filings from TASE Maya system. Maya is the official disclosure platform for Israeli public companies.",
      inputSchema: {
        companyId: z.string().optional().describe("Filter by numeric TASE issuer/company ID (e.g., '76')"),
        fromDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
        toDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ companyId, fromDate, toDate, lang }) => {
      const result = await taseClient.get(
        "/announcements",
        { companyId, fromDate, toDate },
        lang
      );
      return formatResult(result);
    }
  );

  // 8. Get Management Positions (CONFIRMED endpoint: /board-and-management/positions?issuerId=76)
  server.registerTool(
    "tase_get_management_positions",
    {
      title: "Get Management Positions",
      description: "Get board of directors and management officer positions and holdings for a TASE-listed company. This is a confirmed TASE API endpoint.",
      inputSchema: {
        issuerId: z.number().describe("TASE issuer/company ID (e.g., 76)"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ issuerId, lang }) => {
      const result = await taseClient.get(
        "/board-and-management/positions",
        { issuerId: String(issuerId) },
        lang
      );
      return formatResult(result);
    }
  );
}
