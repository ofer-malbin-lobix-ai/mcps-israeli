# Kolzchut MCP Server

MCP server for [Kolzchut (All-Rights / כל-זכות)](https://www.kolzchut.org.il), Israel's authoritative knowledge base for rights and entitlements. Provides AI agents with access to thousands of structured articles covering rights for new immigrants (olim), tax benefits, housing, health insurance, employment, disability, elderly care, and more.

## Features

- **Full-text search** across all Kolzchut rights articles in Hebrew and English
- **Article retrieval** with wikitext or plain text output
- **Section-level reading** for targeted information extraction
- **Category browsing** to discover rights by topic area
- **No authentication required** - uses the public MediaWiki API

## Tools

| Tool | Description |
|------|-------------|
| `kolzchut_search_rights` | Search rights articles by keyword |
| `kolzchut_get_article` | Get full article content by title |
| `kolzchut_get_article_sections` | List section headings of an article |
| `kolzchut_get_article_section` | Read a specific section by index |
| `kolzchut_list_category_members` | List articles in a rights category |
| `kolzchut_list_categories` | Browse available rights categories |

## Installation

```bash
npm install
npm run build
```

## Usage

### Claude Code / Claude Desktop

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "kolzchut": {
      "command": "node",
      "args": ["/path/to/kolzchut-mcp/dist/index.js"]
    }
  }
}
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Example Queries

- "What tax benefits do new immigrants get in Israel?"
- "Search for housing rights for olim"
- "What are the rights of people with disabilities in Israel?"
- "List all categories related to employment"

## Data Source

All data comes from [kolzchut.org.il](https://www.kolzchut.org.il), maintained by the Kolzchut (All-Rights) non-profit organization. Content is licensed under CC BY-SA 3.0.

## License

MIT
