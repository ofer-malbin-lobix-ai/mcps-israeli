# Israel Clinical Trials MCP Server

An MCP (Model Context Protocol) server that searches active and completed clinical trials at Israeli hospitals and research centers via the [ClinicalTrials.gov v2 API](https://clinicaltrials.gov/data-api/api).

> **Disclaimer**: This tool is for informational purposes only and does not constitute medical advice. Clinical trial information may change frequently. Always consult qualified healthcare providers before making any medical decisions, including decisions about participating in clinical trials.

## Tools

| Tool | Description |
|------|-------------|
| `search_trials` | Search clinical trials in Israel by condition, keyword, or intervention |
| `get_trial_details` | Get full details for a specific trial by NCT ID |
| `find_trials_by_hospital` | Find trials at a specific Israeli hospital (e.g. Sheba, Hadassah, Ichilov, Rambam) |
| `list_recruiting_trials` | List currently recruiting trials in Israel, optionally filtered by condition |
| `get_trial_locations` | Get all Israeli sites and contact info for a specific trial |

## Installation

```bash
npm install
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "israel-clinical-trials": {
      "command": "node",
      "args": ["/path/to/israel-clinical-trials-mcp/dist/index.js"]
    }
  }
}
```

## Usage with Claude Code

```bash
claude mcp add israel-clinical-trials node /path/to/israel-clinical-trials-mcp/dist/index.js
```

## Example Queries

- "Find recruiting cancer trials in Israel"
- "What clinical trials are running at Hadassah hospital?"
- "Get details for trial NCT05659901"
- "Show me all Israeli sites for trial NCT05659901"
- "Find diabetes trials with pembrolizumab in Israel"

## API

This server uses the [ClinicalTrials.gov v2 API](https://clinicaltrials.gov/data-api/api), which is free and requires no authentication. All queries are automatically filtered to trials with sites in Israel.

## License

MIT
