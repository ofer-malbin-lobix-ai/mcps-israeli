# supermarket-prices-mcp

An MCP (Model Context Protocol) server that provides access to Israeli supermarket price data from the government-mandated Price Transparency Law.

## Background

Under Israel's 2014 Food Act (Price Transparency in the Food Industry), all supermarket chains with 3 or more stores are required to publish their product prices, promotions, and store information as XML files daily. This data is publicly accessible.

This MCP server wraps that public data, making it queryable through standard MCP tools. It covers ~35 supermarket chains including Shufersal, Rami Levy, Yeinot Bitan, Osher Ad, Victory, Tiv Taam, and many more.

## Data Sources

The price transparency data is published in three ways:

| Source Type | Example Chains | Access |
|-------------|---------------|--------|
| **Web portals** | Shufersal | Direct HTTP (this MCP fetches directly) |
| **PublishPrice portals** | Yeinot Bitan/Carrefour | Direct HTTP (this MCP fetches directly) |
| **FTP feeds** | Rami Levy, Victory, Tiv Taam, and ~25 others | FTP at `url.retail.publishedprices.co.il` |

For FTP-based chains, this MCP provides connection details and guidance on using the [OpenIsraeliSupermarkets](https://github.com/OpenIsraeliSupermarkets) Python scraper or the [Kaggle dataset](https://www.kaggle.com/datasets/erlichsefi/israeli-supermarkets-2024) (updated daily).

## Tools

| Tool | Description |
|------|-------------|
| `list_chains` | List all ~35 Israeli supermarket chains, their IDs, data feed types, and access URLs |
| `get_chain_files` | Browse published price/promo/store XML files from a specific chain |
| `search_products` | Search for products by name (Hebrew/English) or barcode in a price XML file |
| `compare_prices` | Compare a product's price across multiple chains/stores |
| `get_store_data` | Get store locations, addresses, and cities from a chain's store data |
| `get_promotions` | Get current promotions, discounts, and sales from a chain |
| `get_xml_schema_info` | Reference documentation for the XML data schema and field definitions |

### Typical Workflow

1. **`list_chains`** to see all available chains and their access methods
2. **`get_chain_files`** with a chain key and file type to browse available data files
3. **`search_products`** with an XML file URL and a product name to find items
4. **`compare_prices`** with multiple XML URLs and a barcode to compare across stores
5. **`get_promotions`** to check current sales and discounts

## Installation

```bash
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "supermarket-prices": {
      "command": "node",
      "args": ["/path/to/supermarket-prices-mcp/dist/index.js"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add supermarket-prices node /path/to/supermarket-prices-mcp/dist/index.js
```

## XML Data Schema

The Israeli supermarket XML files follow a government-mandated schema:

### Price Files (PriceFull / Price)

Each `<Item>` contains:
- `ItemCode` -- Product barcode (EAN-13)
- `ItemName` -- Product name (Hebrew)
- `ItemPrice` -- Price in ILS
- `UnitOfMeasurePrice` -- Price per standard unit
- `ManufacturerName` -- Manufacturer
- `Quantity`, `UnitOfMeasure` -- Package size
- `PriceUpdateDate` -- When the price was last updated

### Promotion Files (PromoFull / Promo)

Each `<Promotion>` contains:
- `PromotionId`, `PromotionDescription`
- `PromotionStartDate`, `PromotionEndDate`
- `DiscountRate`, `DiscountType`
- List of applicable `ItemCode` values

### Store Files

Each `<Store>` contains:
- `StoreId`, `StoreName`
- `Address`, `City`, `ZipCode`
- `StoreType`

## Related Projects

- [OpenIsraeliSupermarkets](https://github.com/OpenIsraeliSupermarkets) -- Community tools for scraping and parsing the raw data
- [israeli-supermarket-scarpers](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers) -- Python scraper package (`pip install il-supermarket-scarper`)
- [israeli-supermarket-parsers](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-parsers) -- Python parser for the XML data
- [Kaggle Dataset](https://www.kaggle.com/datasets/erlichsefi/israeli-supermarkets-2024) -- Daily-updated aggregated dataset

## License

MIT
