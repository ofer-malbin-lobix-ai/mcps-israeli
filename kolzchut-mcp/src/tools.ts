/**
 * Tool registrations for kolzchut-mcp-server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  searchRights,
  getArticle,
  getArticleSections,
  getArticleSection,
  listCategoryMembers,
  listCategories,
} from "./client.js";

export function registerTools(server: McpServer): void {
  // 1. search_rights
  server.registerTool(
    "kolzchut_search_rights",
    {
      title: "Search Kolzchut Rights Articles",
      description: `Search Kolzchut (All-Rights / כל-זכות), Israel's authoritative rights and entitlements knowledge base. Searches across thousands of articles covering rights for new immigrants (olim), tax benefits, housing, health insurance, employment, disability, elderly care, and more.

Args:
  - query (string): Search query in Hebrew or English (Hebrew recommended for best results)
  - limit (number): Max results 1-50, default 10
  - offset (number): Pagination offset, default 0

Returns: Array of matching articles with title, snippet, word count, and page ID for follow-up with get_article.`,
      inputSchema: {
        query: z.string().min(1).max(500).describe("Search query (Hebrew or English)"),
        limit: z.number().int().min(1).max(50).default(10).describe("Max results to return"),
        offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, limit, offset }) => {
      try {
        const output = await searchRights(query, limit, offset);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: formatError(error) }],
        };
      }
    }
  );

  // 2. get_article
  server.registerTool(
    "kolzchut_get_article",
    {
      title: "Get Kolzchut Article",
      description: `Retrieve the full content of a specific rights article from Kolzchut. Use the exact Hebrew page title from search results or category listings.

Args:
  - title (string): Exact page title (e.g., "הטבות מס לעולים", "ביטוח בריאות")
  - format (string): "wikitext" for structured markup or "html" for plain text (default: wikitext)

Returns: Full article content with title and page ID. Content is truncated at 25,000 characters if very long.`,
      inputSchema: {
        title: z.string().min(1).describe("Exact page title from Kolzchut"),
        format: z.enum(["wikitext", "html"]).default("wikitext").describe("Content format"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ title, format }) => {
      try {
        const output = await getArticle(title, format);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: formatError(error) }],
        };
      }
    }
  );

  // 3. get_article_sections
  server.registerTool(
    "kolzchut_get_article_sections",
    {
      title: "Get Article Section Headings",
      description: `List the section headings of a Kolzchut article. Useful for understanding article structure before reading specific sections with get_article_section.

Args:
  - title (string): Exact page title

Returns: Array of sections with index number, heading text, and nesting level.`,
      inputSchema: {
        title: z.string().min(1).describe("Exact page title from Kolzchut"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ title }) => {
      try {
        const output = await getArticleSections(title);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: formatError(error) }],
        };
      }
    }
  );

  // 4. get_article_section
  server.registerTool(
    "kolzchut_get_article_section",
    {
      title: "Get Specific Article Section",
      description: `Read a specific section of a Kolzchut article by its index number. Use get_article_sections first to find the section index.

Args:
  - title (string): Exact page title
  - section (number): Section index from get_article_sections
  - format (string): "wikitext" or "html" (default: wikitext)

Returns: Content of the specified section.`,
      inputSchema: {
        title: z.string().min(1).describe("Exact page title from Kolzchut"),
        section: z.number().int().min(0).describe("Section index from get_article_sections"),
        format: z.enum(["wikitext", "html"]).default("wikitext").describe("Content format"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ title, section, format }) => {
      try {
        const output = await getArticleSection(title, section, format);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: formatError(error) }],
        };
      }
    }
  );

  // 5. list_category_members
  server.registerTool(
    "kolzchut_list_category_members",
    {
      title: "List Category Members",
      description: `List all articles in a Kolzchut rights category. Categories group related rights articles (e.g., "עולים חדשים" for new immigrants, "נכות" for disability, "דיור" for housing).

Args:
  - category (string): Category name in Hebrew (without "קטגוריה:" prefix, added automatically)
  - limit (number): Max results 1-50, default 20
  - continue_token (string): Token from previous response for pagination

Returns: Array of page titles and IDs in the category.`,
      inputSchema: {
        category: z.string().min(1).describe("Category name in Hebrew"),
        limit: z.number().int().min(1).max(50).default(20).describe("Max results"),
        continue_token: z.string().optional().describe("Pagination token from previous response"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ category, limit, continue_token }) => {
      try {
        const output = await listCategoryMembers(category, limit, continue_token);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: formatError(error) }],
        };
      }
    }
  );

  // 6. list_categories
  server.registerTool(
    "kolzchut_list_categories",
    {
      title: "Browse Kolzchut Categories",
      description: `Browse available rights categories on Kolzchut. Use to discover which topic areas are covered. Categories are in Hebrew.

Args:
  - prefix (string): Filter categories starting with this prefix (e.g., "עולים", "מס", "דיור")
  - limit (number): Max results 1-50, default 20
  - continue_token (string): Token from previous response for pagination

Returns: Array of category names matching the prefix.`,
      inputSchema: {
        prefix: z.string().default("").describe("Category name prefix filter (Hebrew)"),
        limit: z.number().int().min(1).max(50).default(20).describe("Max results"),
        continue_token: z.string().optional().describe("Pagination token from previous response"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ prefix, limit, continue_token }) => {
      try {
        const output = await listCategories(prefix, limit, continue_token);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: formatError(error) }],
        };
      }
    }
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Error: Request timed out. The Kolzchut API may be temporarily unavailable. Try again.";
    }
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}
