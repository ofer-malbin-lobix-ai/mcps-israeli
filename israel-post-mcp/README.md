# Israel Post MCP Server

MCP server for tracking packages through Israel Post (דואר ישראל). Retrieves delivery history with dates, actions, branch names, and cities using the Israel Post tracking system.

## Tools

| Tool | Description |
|------|-------------|
| `track_package` | Track a package by tracking number. Returns full delivery history with timestamps, status actions, branch names, and cities. |
| `get_delivery_status` | Get just the current delivery status of a package (delivered, in transit, etc.) without full history. |

## Setup

No API key required. The server accesses the public Israel Post tracking system.

### Claude Code / Claude Desktop

```json
{
  "mcpServers": {
    "israel-post": {
      "command": "npx",
      "args": ["-y", "israel-post-mcp"]
    }
  }
}
```

### Build from source

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/israel-post-mcp
npm install
npm run build
node dist/index.js
```

## Supported tracking formats

- Registered mail: `RR123456789IL`
- EMS: `EE123456789IL`
- Parcels: `CP123456789IL`
- International shipments with IL suffix

## Limitations

- Uses an undocumented Israel Post endpoint (not an official public API). May break if Israel Post changes their website.
- Each tracking request requires a two-step flow (CSRF token extraction), so responses are slightly slower than typical API calls.
- Israel Post may rate-limit or block requests if too many are made in rapid succession.
- Branch/post office finder is not available (no confirmed public API endpoint exists for this).

## License

MIT
