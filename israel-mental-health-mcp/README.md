# israel-mental-health-mcp

An MCP (Model Context Protocol) server for finding community mental health clinics, psychiatric emergency services, and quality metrics across Israel. Based on official Ministry of Health data published on [data.gov.il](https://data.gov.il).

> **Important:** This server provides publicly available government data for informational purposes only. It does not constitute medical advice, diagnosis, or treatment recommendations. If you or someone you know is in a mental health crisis, please contact emergency services (Magen David Adom: 101) or the national mental health hotline (1-800-363-363).

## Tools

| Tool | Description |
|------|-------------|
| `find_clinics` | Search mental health clinics by city, HMO, or target audience |
| `get_clinic_details` | Get full details for a specific clinic (therapy types, specializations, all wait times) |
| `find_by_therapy` | Find clinics offering a specific therapy type (CBT, DBT, trauma, etc.) |
| `find_by_specialization` | Find clinics specializing in a condition (eating disorders, addictions, PTSD, etc.) |
| `get_quality_metrics` | Get quality measurement data for mental health services |

## Data Sources

All data comes from the Israeli Ministry of Health via the data.gov.il open data portal:

- **Mental Health Clinics**: Full directory of community mental health clinics with HMO affiliation, services, wait times, and contact info
- **Quality Metrics**: Five quality indicators including treatment plan documentation, discharge summaries, community follow-up appointments, long-term hospitalization plans, and lipid profile measurements

## Installation

```bash
npm install israel-mental-health-mcp
```

Or clone and build from source:

```bash
git clone <repo-url>
cd israel-mental-health-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "israel-mental-health-mcp": {
      "command": "npx",
      "args": ["-y", "israel-mental-health-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-mental-health-mcp -- npx -y israel-mental-health-mcp
```

## API

No authentication required. The server uses the free government open data API at `data.gov.il`.

Rate limited to 10 requests per second.

## License

MIT
