# Skills-IL MCP Servers

A collection of MCP (Model Context Protocol) servers for Israeli data sources and APIs, maintained by the [skills-il](https://github.com/skills-il) organization.

Browse all MCPs at [agentskills.co.il/mcp](https://agentskills.co.il/he/mcp).

## Available MCPs

| MCP | Description | API | Auth |
|-----|-------------|-----|------|
| [tase-mcp](./tase-mcp) | Tel Aviv Stock Exchange market data (securities, indices, Maya filings) | [TASE Data Hub](https://openapi.tase.co.il/tase/prod/) | API Key |

## Structure

Each subdirectory is a standalone MCP server with its own `package.json`, build system, and README:

```
mcps/
  tase-mcp/         # Tel Aviv Stock Exchange
  <future-mcp>/     # More MCPs added here
```

## Adding a New MCP

Use the `create-mcp-admin` skill in Claude Code to create and deploy a new MCP end-to-end.

## License

Each MCP has its own license. See the LICENSE file in each subdirectory.
