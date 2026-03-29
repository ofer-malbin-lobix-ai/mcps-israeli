# Skills-IL MCP Servers

A collection of MCP (Model Context Protocol) servers for Israeli data sources and APIs, maintained by the [skills-il](https://github.com/skills-il) organization.

Browse all MCPs at [agentskills.co.il/mcp](https://agentskills.co.il/he/mcp).

## Available MCPs

| MCP | Description | API | Auth |
|-----|-------------|-----|------|
| [boi-exchange-mcp](./boi-exchange-mcp) | Bank of Israel official exchange rates (sha'ar yatzig) for 30+ currencies | [BOI SDMX API](https://edge.boi.gov.il/) | None |
| [israel-railways-mcp](./israel-railways-mcp) | Israel Railways train schedules, platforms, occupancy, and service updates | [rail.co.il](https://rail.co.il/) | None |
| [tase-mcp](./tase-mcp) | Tel Aviv Stock Exchange market data (securities, indices, Maya filings) | [TASE Data Hub](https://openapi.tase.co.il/tase/prod/) | API Key |

## Structure

Each subdirectory is a standalone MCP server with its own `package.json`, build system, and README:

```
mcps/
  boi-exchange-mcp/      # Bank of Israel exchange rates
  israel-railways-mcp/   # Israel Railways schedules
  tase-mcp/              # Tel Aviv Stock Exchange
```

## Adding a New MCP

Use the `create-mcp-admin` skill in Claude Code to create and deploy a new MCP end-to-end.

## License

Each MCP has its own license. See the LICENSE file in each subdirectory.
