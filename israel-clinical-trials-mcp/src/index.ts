#!/usr/bin/env node

/**
 * Israel Clinical Trials MCP Server
 *
 * Search active and completed clinical trials at Israeli hospitals
 * and research centers via the ClinicalTrials.gov v2 API.
 *
 * DISCLAIMER: This tool is for informational purposes only and does not
 * constitute medical advice. Always consult qualified healthcare providers
 * for medical decisions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import {
  searchTrialsSchema,
  getTrialDetailsSchema,
  findTrialsByHospitalSchema,
  listRecruitingTrialsSchema,
  getTrialLocationsSchema,
  handleSearchTrials,
  handleGetTrialDetails,
  handleFindTrialsByHospital,
  handleListRecruitingTrials,
  handleGetTrialLocations,
} from "./tools.js";

const SERVER_NAME = "israel-clinical-trials-mcp";
const SERVER_VERSION = "1.0.0";

function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.tool(
    "search_trials",
    "Search clinical trials in Israel by condition, keyword, or intervention. Returns NCT ID, title, status, conditions, sponsor, phases, and key dates.",
    searchTrialsSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => {
      try {
        const text = await handleSearchTrials(searchTrialsSchema.parse(args));
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error searching trials: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_trial_details",
    "Get full details for a specific clinical trial by NCT ID, including eligibility criteria, description, interventions, locations, and contacts.",
    getTrialDetailsSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => {
      try {
        const text = await handleGetTrialDetails(getTrialDetailsSchema.parse(args));
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error fetching trial details: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "find_trials_by_hospital",
    'Find clinical trials at a specific Israeli hospital or institution (e.g. "Sheba", "Hadassah", "Ichilov", "Rambam").',
    findTrialsByHospitalSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => {
      try {
        const text = await handleFindTrialsByHospital(findTrialsByHospitalSchema.parse(args));
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error searching hospital trials: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_recruiting_trials",
    "List all currently recruiting clinical trials in Israel, optionally filtered by medical condition. Results sorted by most recently updated.",
    listRecruitingTrialsSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => {
      try {
        const text = await handleListRecruitingTrials(listRecruitingTrialsSchema.parse(args));
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error listing recruiting trials: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_trial_locations",
    "Get all Israeli locations and contact information for a specific clinical trial by NCT ID.",
    getTrialLocationsSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => {
      try {
        const text = await handleGetTrialLocations(getTrialLocationsSchema.parse(args));
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error fetching trial locations: ${message}` }], isError: true };
      }
    }
  );

  return server;
}

async function runStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runHttp() {
  const app = express();
  app.use(express.json());

  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.get("/health", (_req, res) => {
    res.status(200).send("ok");
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport!);
        },
      });
      transport.onclose = () => {
        if (transport!.sessionId) transports.delete(transport!.sessionId);
      };
      const server = createServer();
      await server.connect(transport);
    }
    await transport.handleRequest(req, res, req.body);
  });

  const handleSession = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing mcp-session-id");
      return;
    }
    await transport.handleRequest(req, res);
  };
  app.get("/mcp", handleSession);
  app.delete("/mcp", handleSession);

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.error(`${SERVER_NAME} listening on :${port}/mcp`);
  });
}

const main = process.env.PORT ? runHttp : runStdio;
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
