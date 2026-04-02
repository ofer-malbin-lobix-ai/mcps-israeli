#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { trackPackage } from "./client.js";

const server = new McpServer({
  name: "israel-post-mcp",
  version: "1.0.0",
});

server.tool(
  "track_package",
  "Track a package or mail item through Israel Post (דואר ישראל). Returns the full delivery history with dates, actions, branch names, and cities. Supports registered mail, EMS, parcels, and international shipments. Use when a user provides an Israel Post tracking number or asks about package delivery status.",
  {
    tracking_number: z
      .string()
      .describe(
        "Israel Post tracking number (e.g., RR123456789IL, EE987654321IL, CP123456789IL)"
      ),
    language: z
      .enum(["he", "en"])
      .default("he")
      .describe("Response language: 'he' for Hebrew (default), 'en' for English"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async ({ tracking_number, language }) => {
    try {
      const result = await trackPackage(tracking_number, language);

      const statusEmoji = result.isDelivered ? "V" : "...";
      let text = `Package: ${result.trackingNumber}\n`;
      text += `Type: ${result.packageTypeName}\n`;
      text += `Status: ${statusEmoji} ${result.latestStatus}\n\n`;
      text += `Delivery History:\n`;

      for (const event of result.events) {
        text += `  ${event.date} | ${event.action} | ${event.branch}, ${event.city}\n`;
      }

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error tracking package ${tracking_number}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_delivery_status",
  "Get the current delivery status of an Israel Post package. Returns just the latest status (delivered, in transit, etc.) without the full history. Faster and more concise than track_package.",
  {
    tracking_number: z
      .string()
      .describe("Israel Post tracking number"),
    language: z
      .enum(["he", "en"])
      .default("he")
      .describe("Response language: 'he' for Hebrew (default), 'en' for English"),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
  },
  async ({ tracking_number, language }) => {
    try {
      const result = await trackPackage(tracking_number, language);
      const latest = result.events[0];

      let text = `Package: ${result.trackingNumber}\n`;
      text += `Status: ${result.latestStatus}\n`;
      text += `Delivered: ${result.isDelivered ? "Yes" : "No"}\n`;
      if (latest) {
        text += `Last update: ${latest.date}\n`;
        text += `Location: ${latest.branch}, ${latest.city}\n`;
      }

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error checking status for ${tracking_number}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
