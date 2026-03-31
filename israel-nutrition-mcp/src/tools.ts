/**
 * Tool definitions and handlers for the Israel Nutrition MCP server
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  searchFoods,
  getFoodByCode,
  getFoodsByCodes,
  getRecipeIngredients,
  searchByNutrient,
  NUTRIENT_FIELDS,
  type FoodRecord,
  type NutrientField,
} from "./client.js";

// ── Formatting helpers ──────────────────────────────────────────────

const NUTRIENT_UNITS: Record<string, string> = {
  food_energy: "kcal",
  protein: "g",
  total_fat: "g",
  carbohydrates: "g",
  total_dietary_fiber: "g",
  moisture: "g",
  alcohol: "g",
  cholesterol: "mg",
  saturated_fat: "g",
  oleic: "g",
  linoleic: "g",
  linolenic: "g",
  calcium: "mg",
  iron: "mg",
  magnesium: "mg",
  phosphorus: "mg",
  potassium: "mg",
  sodium: "mg",
  zinc: "mg",
  copper: "mg",
  vitamin_a_iu: "IU",
  carotene: "mcg",
  vitamin_e: "mg",
  vitamin_c: "mg",
  thiamin: "mg",
  riboflavin: "mg",
  niacin: "mg",
  vitamin_b6: "mg",
  folate: "mcg",
  vitamin_b12: "mcg",
  butyric: "g",
  caproic: "g",
  caprylic: "g",
  capric: "g",
  lauric: "g",
  myristic: "g",
  palmitic: "g",
  stearic: "g",
  arachidonic: "g",
  docosahexanoic: "g",
};

const NUTRIENT_DISPLAY_NAMES: Record<string, string> = {
  food_energy: "Energy",
  protein: "Protein",
  total_fat: "Total Fat",
  carbohydrates: "Carbohydrates",
  total_dietary_fiber: "Dietary Fiber",
  moisture: "Water Content",
  alcohol: "Alcohol",
  cholesterol: "Cholesterol",
  saturated_fat: "Saturated Fat",
  oleic: "Oleic Acid",
  linoleic: "Linoleic Acid",
  linolenic: "Linolenic Acid",
  calcium: "Calcium",
  iron: "Iron",
  magnesium: "Magnesium",
  phosphorus: "Phosphorus",
  potassium: "Potassium",
  sodium: "Sodium",
  zinc: "Zinc",
  copper: "Copper",
  vitamin_a_iu: "Vitamin A",
  carotene: "Carotene",
  vitamin_e: "Vitamin E",
  vitamin_c: "Vitamin C",
  thiamin: "Thiamin (B1)",
  riboflavin: "Riboflavin (B2)",
  niacin: "Niacin (B3)",
  vitamin_b6: "Vitamin B6",
  folate: "Folate",
  vitamin_b12: "Vitamin B12",
  butyric: "Butyric Acid",
  caproic: "Caproic Acid",
  caprylic: "Caprylic Acid",
  capric: "Capric Acid",
  lauric: "Lauric Acid",
  myristic: "Myristic Acid",
  palmitic: "Palmitic Acid",
  stearic: "Stearic Acid",
  arachidonic: "Arachidonic Acid",
  docosahexanoic: "DHA (Docosahexaenoic Acid)",
};

function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "N/A";
  return `${value} ${unit}`;
}

function formatFoodSummary(food: FoodRecord): string {
  return [
    `${food.shmmitzrach} (code: ${food.smlmitzrach})`,
    `  Energy: ${formatValue(food.food_energy, "kcal")}`,
    `  Protein: ${formatValue(food.protein, "g")}`,
    `  Fat: ${formatValue(food.total_fat, "g")}`,
    `  Carbs: ${formatValue(food.carbohydrates, "g")}`,
    `  Fiber: ${formatValue(food.total_dietary_fiber, "g")}`,
  ].join("\n");
}

type NutrientGroup = {
  name: string;
  fields: Array<{ key: string; displayName: string; unit: string }>;
};

const NUTRIENT_GROUPS: NutrientGroup[] = [
  {
    name: "Macronutrients",
    fields: [
      { key: "food_energy", displayName: "Energy", unit: "kcal" },
      { key: "protein", displayName: "Protein", unit: "g" },
      { key: "total_fat", displayName: "Total Fat", unit: "g" },
      { key: "carbohydrates", displayName: "Carbohydrates", unit: "g" },
      { key: "total_dietary_fiber", displayName: "Dietary Fiber", unit: "g" },
      { key: "moisture", displayName: "Water Content", unit: "g" },
      { key: "alcohol", displayName: "Alcohol", unit: "g" },
    ],
  },
  {
    name: "Vitamins",
    fields: [
      { key: "vitamin_a_iu", displayName: "Vitamin A", unit: "IU" },
      { key: "carotene", displayName: "Carotene", unit: "mcg" },
      { key: "vitamin_e", displayName: "Vitamin E", unit: "mg" },
      { key: "vitamin_c", displayName: "Vitamin C", unit: "mg" },
      { key: "thiamin", displayName: "Thiamin (B1)", unit: "mg" },
      { key: "riboflavin", displayName: "Riboflavin (B2)", unit: "mg" },
      { key: "niacin", displayName: "Niacin (B3)", unit: "mg" },
      { key: "vitamin_b6", displayName: "Vitamin B6", unit: "mg" },
      { key: "folate", displayName: "Folate", unit: "mcg" },
      { key: "vitamin_b12", displayName: "Vitamin B12", unit: "mcg" },
    ],
  },
  {
    name: "Minerals",
    fields: [
      { key: "calcium", displayName: "Calcium", unit: "mg" },
      { key: "iron", displayName: "Iron", unit: "mg" },
      { key: "magnesium", displayName: "Magnesium", unit: "mg" },
      { key: "phosphorus", displayName: "Phosphorus", unit: "mg" },
      { key: "potassium", displayName: "Potassium", unit: "mg" },
      { key: "sodium", displayName: "Sodium", unit: "mg" },
      { key: "zinc", displayName: "Zinc", unit: "mg" },
      { key: "copper", displayName: "Copper", unit: "mg" },
    ],
  },
  {
    name: "Lipids & Fatty Acids",
    fields: [
      { key: "cholesterol", displayName: "Cholesterol", unit: "mg" },
      { key: "saturated_fat", displayName: "Saturated Fat", unit: "g" },
      { key: "oleic", displayName: "Oleic Acid", unit: "g" },
      { key: "linoleic", displayName: "Linoleic Acid", unit: "g" },
      { key: "linolenic", displayName: "Linolenic Acid", unit: "g" },
      { key: "butyric", displayName: "Butyric Acid", unit: "g" },
      { key: "caproic", displayName: "Caproic Acid", unit: "g" },
      { key: "caprylic", displayName: "Caprylic Acid", unit: "g" },
      { key: "capric", displayName: "Capric Acid", unit: "g" },
      { key: "lauric", displayName: "Lauric Acid", unit: "g" },
      { key: "myristic", displayName: "Myristic Acid", unit: "g" },
      { key: "palmitic", displayName: "Palmitic Acid", unit: "g" },
      { key: "stearic", displayName: "Stearic Acid", unit: "g" },
      { key: "arachidonic", displayName: "Arachidonic Acid", unit: "g" },
      {
        key: "docosahexanoic",
        displayName: "DHA (Docosahexaenoic Acid)",
        unit: "g",
      },
    ],
  },
];

function formatFullNutrition(food: FoodRecord): string {
  const lines: string[] = [
    `=== ${food.shmmitzrach} (code: ${food.smlmitzrach}) ===`,
    `All values per 100g`,
    "",
  ];

  for (const group of NUTRIENT_GROUPS) {
    lines.push(`--- ${group.name} ---`);
    for (const field of group.fields) {
      const value = food[field.key] as number | null;
      lines.push(`  ${field.displayName}: ${formatValue(value, field.unit)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Tool annotations (shared) ───────────────────────────────────────

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

// ── Register all tools ──────────────────────────────────────────────

export function registerTools(server: McpServer): void {
  // 1. search_foods
  server.tool(
    "search_foods",
    "Search Israeli foods by name (Hebrew or English). Returns food name, code, calories, protein, fat, carbs, and fiber for each match.",
    {
      query: z
        .string()
        .describe(
          'Text to search for, e.g. "חומוס" (hummus) or "bread". Supports Hebrew and English.'
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum number of results to return (default 20, max 100)"),
    },
    TOOL_ANNOTATIONS,
    async ({ query, limit }) => {
      try {
        const { records, total } = await searchFoods(query, limit);

        if (records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No foods found matching "${query}". Try searching in Hebrew for best results.`,
              },
            ],
          };
        }

        const header = `Found ${total} foods matching "${query}" (showing ${records.length}):\n\n`;
        const body = records.map(formatFoodSummary).join("\n\n");

        return {
          content: [{ type: "text" as const, text: header + body }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching foods: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 2. get_nutrition
  server.tool(
    "get_nutrition",
    "Get the full nutritional breakdown (all 74 components) for a specific food by its code. Values are per 100g. Nutrients are organized by category: macros, vitamins, minerals, and fatty acids.",
    {
      food_code: z
        .number()
        .int()
        .describe(
          "The smlmitzrach food item code. Use search_foods to find codes."
        ),
    },
    TOOL_ANNOTATIONS,
    async ({ food_code }) => {
      try {
        const food = await getFoodByCode(food_code);

        if (!food) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No food found with code ${food_code}. Use search_foods to find valid food codes.`,
              },
            ],
          };
        }

        return {
          content: [{ type: "text" as const, text: formatFullNutrition(food) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching nutrition data: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 3. get_recipe_ingredients
  server.tool(
    "get_recipe_ingredients",
    "Get the ingredient composition for a recipe/composite food item. Returns a list of ingredients with their percentage in the recipe.",
    {
      food_code: z
        .number()
        .int()
        .describe(
          "The smlmitzrach food item code of the recipe. Use search_foods to find codes."
        ),
    },
    TOOL_ANNOTATIONS,
    async ({ food_code }) => {
      try {
        const ingredients = await getRecipeIngredients(food_code);

        if (ingredients.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No recipe ingredients found for food code ${food_code}. This food may not be a composite recipe, or the code may be invalid.`,
              },
            ],
          };
        }

        const header = `Recipe ingredients for ${ingredients[0].shmmitzrach} (code: ${food_code}):\n\n`;
        const body = ingredients
          .map(
            (ing) =>
              `  - ${ing.shmmarciv} (code: ${ing.smlmarciv}): ${ing.achuz_marciv}%`
          )
          .join("\n");

        return {
          content: [{ type: "text" as const, text: header + body }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching recipe ingredients: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 4. compare_foods
  server.tool(
    "compare_foods",
    "Side-by-side nutritional comparison of 2-5 foods. Highlights key differences in calories, protein, fat, fiber, and sodium.",
    {
      food_codes: z
        .array(z.number().int())
        .min(2)
        .max(5)
        .describe(
          "Array of 2-5 smlmitzrach food item codes to compare. Use search_foods to find codes."
        ),
    },
    TOOL_ANNOTATIONS,
    async ({ food_codes }) => {
      try {
        const foods = await getFoodsByCodes(food_codes);

        if (foods.length < 2) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could only find ${foods.length} of the ${food_codes.length} requested foods. Need at least 2 valid food codes for comparison.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `=== Nutritional Comparison (per 100g) ===\n`,
        ];

        // Header row
        const names = foods.map((f) => f.shmmitzrach);
        lines.push(`Foods: ${names.join(" | ")}`);
        lines.push(`Codes: ${foods.map((f) => f.smlmitzrach).join(" | ")}`);
        lines.push("");

        // Key nutrients comparison
        const keyNutrients: Array<{
          key: keyof FoodRecord;
          name: string;
          unit: string;
        }> = [
          { key: "food_energy", name: "Energy", unit: "kcal" },
          { key: "protein", name: "Protein", unit: "g" },
          { key: "total_fat", name: "Total Fat", unit: "g" },
          { key: "carbohydrates", name: "Carbs", unit: "g" },
          { key: "total_dietary_fiber", name: "Fiber", unit: "g" },
          { key: "sodium", name: "Sodium", unit: "mg" },
          { key: "calcium", name: "Calcium", unit: "mg" },
          { key: "iron", name: "Iron", unit: "mg" },
          { key: "vitamin_c", name: "Vitamin C", unit: "mg" },
          { key: "cholesterol", name: "Cholesterol", unit: "mg" },
          { key: "saturated_fat", name: "Saturated Fat", unit: "g" },
        ];

        // Find max column width for alignment
        const maxNameLen = Math.max(
          ...keyNutrients.map((n) => n.name.length)
        );

        for (const nutrient of keyNutrients) {
          const values = foods.map((f) => {
            const val = f[nutrient.key] as number | null;
            return formatValue(val, nutrient.unit);
          });
          const paddedName = nutrient.name.padEnd(maxNameLen);
          lines.push(`  ${paddedName}  ${values.join("  |  ")}`);
        }

        // Highlight section
        lines.push("");
        lines.push("--- Key Highlights ---");

        const highlights: Array<{
          key: keyof FoodRecord;
          name: string;
          unit: string;
        }> = [
          { key: "food_energy", name: "calories", unit: "kcal" },
          { key: "protein", name: "protein", unit: "g" },
          { key: "total_dietary_fiber", name: "fiber", unit: "g" },
          { key: "sodium", name: "sodium", unit: "mg" },
        ];

        for (const h of highlights) {
          const values = foods.map((f) => ({
            name: f.shmmitzrach,
            val: (f[h.key] as number | null) ?? 0,
          }));
          const sorted = [...values].sort((a, b) => b.val - a.val);
          if (sorted[0].val > 0) {
            lines.push(
              `  Highest ${h.name}: ${sorted[0].name} (${sorted[0].val} ${h.unit})`
            );
            lines.push(
              `  Lowest ${h.name}: ${sorted[sorted.length - 1].name} (${sorted[sorted.length - 1].val} ${h.unit})`
            );
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error comparing foods: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 5. search_by_nutrient
  server.tool(
    "search_by_nutrient",
    "Find foods ranked by a specific nutrient value (highest or lowest). Useful for finding foods rich in protein, calcium, iron, vitamin C, etc.",
    {
      nutrient: z
        .enum(NUTRIENT_FIELDS as unknown as [string, ...string[]])
        .describe(
          'Nutrient field name to sort by, e.g. "protein", "calcium", "vitamin_c", "food_energy"'
        ),
      order: z
        .enum(["high", "low"])
        .default("high")
        .describe(
          'Sort order: "high" for highest values first, "low" for lowest (default: "high")'
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum number of results (default 20, max 100)"),
    },
    TOOL_ANNOTATIONS,
    async ({ nutrient, order, limit }) => {
      try {
        const displayName =
          NUTRIENT_DISPLAY_NAMES[nutrient] || nutrient;
        const unit = NUTRIENT_UNITS[nutrient] || "";
        const direction = order === "high" ? "highest" : "lowest";

        const { records, total } = await searchByNutrient(
          nutrient,
          order,
          limit
        );

        if (records.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No results found for nutrient "${nutrient}".`,
              },
            ],
          };
        }

        const header = `Top ${records.length} foods with ${direction} ${displayName} (out of ${total} total):\n\n`;
        const body = records
          .map((food, i) => {
            const val = food[nutrient as keyof FoodRecord] as number | null;
            return `${i + 1}. ${food.shmmitzrach} (code: ${food.smlmitzrach}): ${formatValue(val, unit)}`;
          })
          .join("\n");

        return {
          content: [{ type: "text" as const, text: header + body }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching by nutrient: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
