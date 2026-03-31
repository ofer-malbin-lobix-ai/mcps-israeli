# israel-nutrition-mcp

MCP server for Israel's National Nutrition Database (Tzameret), providing access to 4,500+ foods with 74 nutritional components per item. Data is sourced from the Israeli Ministry of Health's official database via [data.gov.il](https://data.gov.il).

## Data Source

The [Tzameret database](https://data.gov.il/dataset/tzameret) is maintained by Israel's Ministry of Health and contains comprehensive nutritional information for foods commonly consumed in Israel, including traditional Israeli and Middle Eastern dishes. All nutritional values are per 100g.

## Tools

### search_foods
Search foods by name in Hebrew or English. Returns food name, code, calories, protein, fat, carbs, and fiber for each match.

**Parameters:**
- `query` (required) - Text to search for, e.g. "חומוס" or "bread"
- `limit` (optional) - Max results, default 20

### get_nutrition
Get the full nutritional breakdown (all 74 components) for a specific food, organized by category: macronutrients, vitamins, minerals, and fatty acids.

**Parameters:**
- `food_code` (required) - The smlmitzrach food item code

### get_recipe_ingredients
Get ingredient composition for a recipe/composite food item.

**Parameters:**
- `food_code` (required) - The smlmitzrach food item code

### compare_foods
Side-by-side nutritional comparison of 2-5 foods with key difference highlights.

**Parameters:**
- `food_codes` (required) - Array of 2-5 smlmitzrach food codes

### search_by_nutrient
Find foods ranked by a specific nutrient value (highest or lowest). Useful for finding foods rich in protein, calcium, iron, etc.

**Parameters:**
- `nutrient` (required) - Field name like "protein", "calcium", "vitamin_c"
- `order` (optional) - "high" or "low", default "high"
- `limit` (optional) - Max results, default 20

## Installation

```bash
npm install -g israel-nutrition-mcp
```

Or run directly with npx:

```bash
npx israel-nutrition-mcp
```

## Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "israel-nutrition-mcp": {
      "command": "npx",
      "args": ["-y", "israel-nutrition-mcp"]
    }
  }
}
```

## Development

```bash
npm install
npm run build
npm start
```

## License

MIT
