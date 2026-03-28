# TASE MCP - Tel Aviv Stock Exchange MCP Server

An [MCP](https://modelcontextprotocol.io/) server providing access to Tel Aviv Stock Exchange (TASE) market data through the official TASE Data Hub API.

## Prerequisites

- Node.js 18+
- TASE Data Hub API key - [register here](https://openapi.tase.co.il/tase/prod/)
- Some data products require a paid subscription. Contact marketdatateam@tase.co.il for details

## Installation

```bash
npx tase-mcp
```

Or install locally:

```bash
git clone https://github.com/skills-il/tase-mcp.git
cd tase-mcp
npm install
npm run build
node dist/index.js
```

## Environment Variable

```bash
export TASE_API_KEY=your_api_key_here
```

## Available Tools

| Tool | Description |
|------|-------------|
| `tase_list_securities` | List all securities traded on TASE |
| `tase_get_security` | Get details for a specific security |
| `tase_get_security_eod` | Get end-of-day price data for a security |
| `tase_list_indices` | List all TASE indices (TA-35, TA-125, etc.) |
| `tase_get_index_eod` | Get end-of-day data for an index |
| `tase_get_index_components` | Get stocks composing an index with weights |
| `tase_get_maya_announcements` | Get Maya company announcements and filings |
| `tase_get_management_positions` | Get board and management positions and holdings |

All tools accept an optional `lang` parameter: `he-IL` (Hebrew, default) or `en-US` (English).

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tase": {
      "command": "npx",
      "args": ["-y", "tase-mcp"],
      "env": {
        "TASE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Claude Code Configuration

```bash
claude mcp add tase -- npx -y tase-mcp
```

Then set the environment variable:

```bash
export TASE_API_KEY=your_api_key_here
```

## Rate Limits

The TASE API allows 10 requests per 2 seconds. This server enforces a conservative client-side limit of 5 requests per second to stay safely within bounds.

## License

MIT
