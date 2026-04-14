import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  fetchText,
  fetchXml,
  extractXmlBlocks,
  extractXmlElements,
  extractHtmlBlocks,
  stripTags,
} from "./client.js";

// ---------------------------------------------------------------------------
// URL validation -- restrict to known Israeli supermarket price domains (SSRF prevention)
// ---------------------------------------------------------------------------

const ALLOWED_DOMAINS = [
  'prices.shufersal.co.il',
  'publishedprices.co.il',
  'url.retail.publishedprices.co.il',
  'prices.mega.co.il',
  'prices.ybitan.co.il',
  'prices.carrefour.co.il',
];

function validateUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Only HTTP(S) URLs are allowed, got: ${parsed.protocol}`);
  }
  const isAllowed = ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
  if (!isAllowed) {
    throw new Error(`URL domain not in allowlist: ${parsed.hostname}. Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Chain registry -- all chains mandated to publish under the 2014 Food Act
// ---------------------------------------------------------------------------

interface ChainInfo {
  id: string;
  nameHe: string;
  nameEn: string;
  dataSource: "web" | "ftp" | "publishprice";
  /** URL for web/publishprice sources, FTP username for ftp sources */
  endpoint: string;
  /** Whether this MCP can directly fetch price files from this chain */
  directAccess: boolean;
}

const CHAINS: Record<string, ChainInfo> = {
  shufersal: {
    id: "7290027600007",
    nameHe: "שופרסל",
    nameEn: "Shufersal",
    dataSource: "web",
    endpoint: "https://prices.shufersal.co.il/",
    directAccess: true,
  },
  rami_levy: {
    id: "7290058140886",
    nameHe: "רמי לוי",
    nameEn: "Rami Levy",
    dataSource: "ftp",
    endpoint: "RamiLevi",
    directAccess: false,
  },
  yeinot_bitan: {
    id: "7290055700007",
    nameHe: "יינות ביתן",
    nameEn: "Yeinot Bitan / Carrefour",
    dataSource: "publishprice",
    endpoint: "https://prices.carrefour.co.il/",
    directAccess: true,
  },
  osher_ad: {
    id: "7290103152017",
    nameHe: "אושר עד",
    nameEn: "Osher Ad",
    dataSource: "ftp",
    endpoint: "osherad",
    directAccess: false,
  },
  victory: {
    id: "7290696200003",
    nameHe: "ויקטורי",
    nameEn: "Victory",
    dataSource: "ftp",
    endpoint: "Victory",
    directAccess: false,
  },
  tiv_taam: {
    id: "7290873255550",
    nameHe: "טיב טעם",
    nameEn: "Tiv Taam",
    dataSource: "ftp",
    endpoint: "TivTaam",
    directAccess: false,
  },
  hazi_hinam: {
    id: "7290700100008",
    nameHe: "חצי חינם",
    nameEn: "Hazi Hinam",
    dataSource: "ftp",
    endpoint: "HaziHinam",
    directAccess: false,
  },
  yohananof: {
    id: "7290803800003",
    nameHe: "יוחננוף",
    nameEn: "Yohananof",
    dataSource: "ftp",
    endpoint: "yohananof",
    directAccess: false,
  },
  mega: {
    id: "7290055700014",
    nameHe: "מגה",
    nameEn: "Mega",
    dataSource: "ftp",
    endpoint: "Mega",
    directAccess: false,
  },
  dor_alon: {
    id: "7290492000005",
    nameHe: "דור אלון",
    nameEn: "Dor Alon",
    dataSource: "ftp",
    endpoint: "doralon",
    directAccess: false,
  },
  bareket: {
    id: "7290875100003",
    nameHe: "עוף והודו ברקת",
    nameEn: "Bareket",
    dataSource: "ftp",
    endpoint: "Bareket",
    directAccess: false,
  },
  mahsani_ashuk: {
    id: "7290661400001",
    nameHe: "מחסני השוק",
    nameEn: "Mahsani A'Shuk",
    dataSource: "ftp",
    endpoint: "MahsaniAShuk",
    directAccess: false,
  },
  zol_vebegadol: {
    id: "7290058173198",
    nameHe: "זול ובגדול",
    nameEn: "Zol VeBegadol",
    dataSource: "ftp",
    endpoint: "ZolVeBegadol",
    directAccess: false,
  },
  super_pharm: {
    id: "7290172900007",
    nameHe: "סופר פארם",
    nameEn: "Super-Pharm",
    dataSource: "ftp",
    endpoint: "SuperPharm",
    directAccess: false,
  },
  king_store: {
    id: "7290058108879",
    nameHe: "קינג סטור",
    nameEn: "King Store",
    dataSource: "ftp",
    endpoint: "KingStore",
    directAccess: false,
  },
  stop_market: {
    id: "7290639000004",
    nameHe: "סטופ מרקט",
    nameEn: "Stop Market",
    dataSource: "ftp",
    endpoint: "StopMarket",
    directAccess: false,
  },
  polizer: {
    id: "7291059100008",
    nameHe: "פוליצר",
    nameEn: "Polizer",
    dataSource: "ftp",
    endpoint: "polizer",
    directAccess: false,
  },
  good_pharm: {
    id: "7290058197699",
    nameHe: "גוד פארם",
    nameEn: "Good Pharm",
    dataSource: "ftp",
    endpoint: "GoodPharm",
    directAccess: false,
  },
  keshet: {
    id: "7290785400000",
    nameHe: "קשת טעמים",
    nameEn: "Keshet Taamim",
    dataSource: "ftp",
    endpoint: "Keshet",
    directAccess: false,
  },
  cofix: {
    id: "7291056200008",
    nameHe: "קופיקס",
    nameEn: "Cofix",
    dataSource: "ftp",
    endpoint: "Cofix",
    directAccess: false,
  },
  het_cohen: {
    id: "7290700100015",
    nameHe: 'ח. כהן',
    nameEn: "Het Cohen",
    dataSource: "ftp",
    endpoint: "HetCohen",
    directAccess: false,
  },
  salach_dabach: {
    id: "7290526500006",
    nameHe: "סאלח דבאח",
    nameEn: "Salach D'abach",
    dataSource: "ftp",
    endpoint: "SalachDabach",
    directAccess: false,
  },
  super_yuda: {
    id: "7290058148776",
    nameHe: "סופר יודה",
    nameEn: "Super Yuda",
    dataSource: "ftp",
    endpoint: "SuperYuda",
    directAccess: false,
  },
  super_sapir: {
    id: "7290058156607",
    nameHe: "סופר ספיר",
    nameEn: "Super Sapir",
    dataSource: "ftp",
    endpoint: "SuperSapir",
    directAccess: false,
  },
  quik: {
    id: "7290058169201",
    nameHe: "קוויק",
    nameEn: "Quik",
    dataSource: "ftp",
    endpoint: "Quik",
    directAccess: false,
  },
  maayan_2000: {
    id: "7290058159628",
    nameHe: "מעיין אלפיים",
    nameEn: "Maayan 2000",
    dataSource: "ftp",
    endpoint: "Maayan2000",
    directAccess: false,
  },
  netiv_hased: {
    id: "7290058177776",
    nameHe: "נתיב החסד",
    nameEn: "Netiv HaHesed",
    dataSource: "ftp",
    endpoint: "NetivHased",
    directAccess: false,
  },
  shefa_barcart_ashem: {
    id: "7290058134977",
    nameHe: "שפע ברכת השם",
    nameEn: "Shefa Birkat Hashem",
    dataSource: "ftp",
    endpoint: "ShefaBarcartAshem",
    directAccess: false,
  },
  shuk_ahir: {
    id: "7290058177998",
    nameHe: "שוק העיר",
    nameEn: "Shuk Ha'Ir",
    dataSource: "ftp",
    endpoint: "ShukAhir",
    directAccess: false,
  },
  yellow: {
    id: "7290058194988",
    nameHe: "יילו",
    nameEn: "Yellow",
    dataSource: "ftp",
    endpoint: "Yellow",
    directAccess: false,
  },
  fresh_market: {
    id: "7290876100000",
    nameHe: "פרש מרקט / סופר דוש",
    nameEn: "Fresh Market / Super Dosh",
    dataSource: "ftp",
    endpoint: "FreshMarketAndSuperDosh",
    directAccess: false,
  },
  meshnat_yosef: {
    id: "7290058189984",
    nameHe: "משנת יוסף",
    nameEn: "Meshnat Yosef",
    dataSource: "ftp",
    endpoint: "MeshnatYosef",
    directAccess: false,
  },
  wolt: {
    id: "7290058199068",
    nameHe: "וולט",
    nameEn: "Wolt",
    dataSource: "ftp",
    endpoint: "Wolt",
    directAccess: false,
  },
};

const CHAIN_KEYS = Object.keys(CHAINS);

// XML fields present in Israeli supermarket price files (government-mandated schema)
const PRICE_ITEM_FIELDS = [
  "ItemCode",
  "ItemType",
  "ItemName",
  "ManufacturerName",
  "ManufactureCountry",
  "ManufacturerItemDescription",
  "UnitQty",
  "Quantity",
  "UnitOfMeasure",
  "bIsWeighted",
  "QtyInPackage",
  "ItemPrice",
  "UnitOfMeasurePrice",
  "AllowDiscount",
  "ItemStatus",
  "PriceUpdateDate",
];

const STORE_FIELDS = [
  "StoreId",
  "StoreName",
  "Address",
  "City",
  "ZipCode",
  "BikoretNo",
  "StoreType",
];

const PROMO_FIELDS = [
  "PromotionId",
  "PromotionDescription",
  "PromotionStartDate",
  "PromotionStartHour",
  "PromotionEndDate",
  "PromotionEndHour",
  "MinQty",
  "MaxQty",
  "DiscountRate",
  "DiscountType",
  "MinPurchaseAmnt",
  "MinNoOfItemOfered",
  "RewardType",
  "AllowMultipleDiscounts",
];

// ---------------------------------------------------------------------------
// Shufersal helpers -- Shufersal has a clean web interface for browsing files
// ---------------------------------------------------------------------------

/** File type IDs on Shufersal's price transparency site */
const SHUFERSAL_FILE_TYPES: Record<string, string> = {
  all: "0",
  prices: "1",
  pricesfull: "2",
  promos: "3",
  promosfull: "4",
  stores: "5",
};

interface ShufersalFileEntry {
  name: string;
  url: string;
  date: string;
}

/**
 * Parse Shufersal's file listing page to extract download links.
 * The page uses a table with download links in specific columns.
 */
/**
 * Extract YYYYMMDD date from a filename. Supermarket filenames contain both the
 * chain ID (starts with 72/73) and the date (starts with 20/19), so prefer the
 * 8-digit run that looks like a plausible year.
 */
function extractFileDate(name: string): string {
  const runs = name.match(/\d{8}/g) ?? [];
  const year = runs.find((d) => d.startsWith("20") || d.startsWith("19"));
  if (!year) return "unknown";
  return `${year.slice(0, 4)}-${year.slice(4, 6)}-${year.slice(6, 8)}`;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function parseShufersalFileList(html: string): ShufersalFileEntry[] {
  const entries: ShufersalFileEntry[] = [];

  // Look for direct file download links
  const fileLinks =
    html.match(
      /href="([^"]*(?:\.gz|\.xml)[^"]*)"/gi
    ) ?? [];

  for (const link of fileLinks) {
    const urlMatch = link.match(/href="([^"]*)"/i);
    if (!urlMatch) continue;

    let fileUrl = decodeHtmlEntities(urlMatch[1]);
    if (fileUrl.startsWith("/")) {
      fileUrl = `https://prices.shufersal.co.il${fileUrl}`;
    }

    const nameMatch = fileUrl.match(/([^/]+\.(?:gz|xml))$/i);
    const name = nameMatch ? nameMatch[1] : fileUrl;

    const date = extractFileDate(name);

    entries.push({ name, url: fileUrl, date });
  }

  // Also parse table rows which contain file info
  const rows = extractHtmlBlocks(html, "tr");

  for (const row of rows) {
    const linkMatch = row.match(/href="([^"]*FileObject\/UpdateCategory[^"]*)"/i);
    if (!linkMatch) continue;

    const cells = extractHtmlBlocks(row, "td");
    const texts = cells.map((c) => stripTags(c).trim());

    if (texts.length >= 2) {
      let fileUrl = decodeHtmlEntities(linkMatch[1]);
      if (fileUrl.startsWith("/")) {
        fileUrl = `https://prices.shufersal.co.il${fileUrl}`;
      }
      // Avoid adding duplicates
      if (!entries.some((e) => e.url === fileUrl)) {
        entries.push({
          name: texts[0] || "unknown",
          url: fileUrl,
          date: texts[1] || "unknown",
        });
      }
    }
  }

  return entries;
}

/**
 * Parse PublishPrice-style file listing pages.
 * These pages embed file data in a JavaScript const.
 */
function parsePublishPriceFileList(
  html: string,
  baseUrl: string
): ShufersalFileEntry[] {
  const entries: ShufersalFileEntry[] = [];

  // PublishPrice sites embed: const files = [{name: "...", size: ...}, ...]
  const filesMatch = html.match(/const\s+files\s*=\s*(\[[\s\S]*?\]);/);
  if (!filesMatch) return entries;

  try {
    const files: Array<{ name: string; size?: number }> = JSON.parse(
      filesMatch[1]
    );
    // Also extract the path
    const pathMatch = html.match(
      /const\s+path\s*=\s*['"]([^'"]*)['"]/
    );
    const path = pathMatch ? pathMatch[1] : "";

    for (const file of files) {
      const fileUrl = path
        ? `${baseUrl.replace(/\/$/, "")}/${path}/${file.name}`
        : `${baseUrl.replace(/\/$/, "")}/${file.name}`;

      const date = extractFileDate(file.name);

      entries.push({ name: file.name, url: fileUrl, date });
    }
  } catch {
    // JSON parse failed -- return empty
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // =========================================================================
  // 1. list_chains
  // =========================================================================
  server.tool(
    "list_chains",
    "List all Israeli supermarket chains required to publish prices under the 2014 Food Act, their chain IDs, data feed types, and access URLs. Returns the full registry of ~35 chains.",
    {},
    {
      title: "List Israeli Supermarket Chains",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async () => {
      const lines: string[] = [
        "Israeli Supermarket Chains -- Price Transparency Law Registry",
        "=".repeat(60),
        "",
        `Total chains: ${CHAIN_KEYS.length}`,
        "",
        "Legend:",
        "  [WEB]  = HTTP/web access (this MCP can fetch files directly)",
        "  [FTP]  = FTP access at url.retail.publishedprices.co.il",
        "  [PUB]  = PublishPrice web portal",
        "",
      ];

      for (const key of CHAIN_KEYS) {
        const c = CHAINS[key];
        const tag =
          c.dataSource === "web"
            ? "[WEB]"
            : c.dataSource === "publishprice"
              ? "[PUB]"
              : "[FTP]";
        const access = c.directAccess ? "(direct access)" : "(FTP client needed)";

        lines.push(`${tag} ${c.nameEn} / ${c.nameHe}`);
        lines.push(`     Key: ${key}`);
        lines.push(`     Chain ID: ${c.id}`);
        if (c.dataSource === "ftp") {
          lines.push(
            `     FTP: url.retail.publishedprices.co.il (user: ${c.endpoint})`
          );
        } else {
          lines.push(`     URL: ${c.endpoint}`);
        }
        lines.push(`     Access: ${access}`);
        lines.push("");
      }

      lines.push("---");
      lines.push(
        "Data is published daily as XML files containing prices, promotions, and store info."
      );
      lines.push(
        "File types: PriceFull (all products), Price (updates), PromoFull, Promo, Stores"
      );
      lines.push(
        "Community project: https://github.com/OpenIsraeliSupermarkets"
      );
      lines.push(
        "Kaggle dataset: https://www.kaggle.com/datasets/erlichsefi/israeli-supermarkets-2024"
      );

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // =========================================================================
  // 2. get_chain_files
  // =========================================================================
  server.tool(
    "get_chain_files",
    "List the latest published price/promo/store data files from a specific supermarket chain. Works with web-accessible chains (Shufersal, Yeinot Bitan). Returns file names, download URLs, and dates.",
    {
      chain: z
        .string()
        .describe(
          "Chain key from list_chains (e.g. 'shufersal', 'yeinot_bitan')"
        ),
      file_type: z
        .enum(["all", "prices", "pricesfull", "promos", "promosfull", "stores"])
        .default("all")
        .describe(
          "Type of data file: 'prices' (updates), 'pricesfull' (full snapshot), 'promos', 'promosfull', 'stores', or 'all'"
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(20)
        .describe("Maximum number of files to return (1-50, default 20)"),
    },
    {
      title: "Get Chain Data Files",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ chain, file_type, limit }) => {
      const chainInfo = CHAINS[chain];
      if (!chainInfo) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown chain: "${chain}". Use list_chains to see available chain keys.`,
            },
          ],
          isError: true,
        };
      }

      if (!chainInfo.directAccess) {
        const lines = [
          `${chainInfo.nameEn} / ${chainInfo.nameHe} uses FTP-based data publishing.`,
          "",
          "This MCP cannot directly access FTP feeds. To access this chain's data:",
          "",
          "1. Use the OpenIsraeliSupermarkets Python scraper:",
          "   pip install il-supermarket-scarper",
          '   from il_supermarket_scarper import ScarpingTask',
          '   ScarpingTask(dump_folder="output", only_latest=True,',
          `       enabled_scrapers=["${chainInfo.endpoint}"]).start()`,
          "",
          "2. Or access the Kaggle dataset (updated daily):",
          "   https://www.kaggle.com/datasets/erlichsefi/israeli-supermarkets-2024",
          "",
          `FTP host: url.retail.publishedprices.co.il`,
          `FTP user: ${chainInfo.endpoint}`,
          `FTP password: (empty)`,
          "",
          "The FTP contains .gz-compressed XML files with price, promo, and store data.",
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      }

      try {
        let entries: ShufersalFileEntry[] = [];

        if (chainInfo.dataSource === "web") {
          // Shufersal-style web portal
          const catId = SHUFERSAL_FILE_TYPES[file_type] ?? "0";
          const url = `${chainInfo.endpoint}FileObject/UpdateCategory?catID=${catId}&storeId=0&sort=Time&sortdir=DESC`;
          const html = await fetchText(url);
          entries = parseShufersalFileList(html);
        } else if (chainInfo.dataSource === "publishprice") {
          // PublishPrice-style portal
          const html = await fetchText(chainInfo.endpoint);
          entries = parsePublishPriceFileList(html, chainInfo.endpoint);

          // Filter by file type if not "all"
          if (file_type !== "all") {
            const typeMap: Record<string, string> = {
              prices: "price",
              pricesfull: "pricefull",
              promos: "promo",
              promosfull: "promofull",
              stores: "store",
            };
            const pattern = typeMap[file_type];
            if (pattern) {
              entries = entries.filter((e) =>
                e.name.toLowerCase().includes(pattern)
              );
            }
          }
        }

        const limited = entries.slice(0, limit);

        if (limited.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: [
                  `No files found for ${chainInfo.nameEn} (${file_type}).`,
                  "",
                  "The chain's price transparency portal may be temporarily unavailable,",
                  "or the page format may have changed.",
                  "",
                  `Try visiting directly: ${chainInfo.endpoint}`,
                ].join("\n"),
              },
            ],
          };
        }

        const lines = [
          `${chainInfo.nameEn} / ${chainInfo.nameHe} -- Published Data Files`,
          "=".repeat(50),
          `File type: ${file_type}`,
          `Showing: ${limited.length} of ${entries.length} files`,
          "",
        ];

        for (const entry of limited) {
          lines.push(`File: ${entry.name}`);
          lines.push(`  Date: ${entry.date}`);
          lines.push(`  URL: ${entry.url}`);
          lines.push("");
        }

        lines.push("---");
        lines.push(
          "Files are .gz-compressed XML. Use get_price_data or get_store_data to parse contents."
        );

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching files for ${chainInfo.nameEn}: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // 3. search_products
  // =========================================================================
  server.tool(
    "search_products",
    "Search for products by name or barcode in a supermarket chain's price data XML file. Provide a direct URL to a PriceFull XML file (from get_chain_files) and a search query. Supports Hebrew product names.",
    {
      xml_url: z
        .string()
        .url()
        .describe(
          "Direct URL to a PriceFull or Price XML file (get this from get_chain_files)"
        ),
      query: z
        .string()
        .min(1)
        .describe(
          "Product name (Hebrew or English) or barcode (ItemCode) to search for"
        ),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum results to return (1-100, default 20)"),
    },
    {
      title: "Search Products",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ xml_url, query, limit }) => {
      try {
        validateUrl(xml_url);
        const xml = await fetchXml(xml_url);
        const items = extractXmlBlocks(xml, "Item", PRICE_ITEM_FIELDS);

        if (items.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No items found in this XML file. The file may be empty, compressed (.gz), or in an unexpected format. Make sure to use an uncompressed XML URL.",
              },
            ],
          };
        }

        const queryLower = query.toLowerCase();
        const matches = items.filter((item) => {
          const name = (item.ItemName ?? "").toLowerCase();
          const code = (item.ItemCode ?? "").toLowerCase();
          const manufacturer = (item.ManufacturerName ?? "").toLowerCase();
          const desc = (
            item.ManufacturerItemDescription ?? ""
          ).toLowerCase();

          return (
            name.includes(queryLower) ||
            code.includes(queryLower) ||
            manufacturer.includes(queryLower) ||
            desc.includes(queryLower)
          );
        });

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No products matching "${query}" found in ${items.length} items. Try a broader search term or a different Hebrew spelling.`,
              },
            ],
          };
        }

        const limited = matches.slice(0, limit);

        // Extract chain/store info from XML root
        const chainId =
          extractXmlElements(xml, "ChainId")[0] ?? "unknown";
        const storeId =
          extractXmlElements(xml, "StoreId")[0] ?? "unknown";

        const lines = [
          `Product Search Results for "${query}"`,
          "=".repeat(50),
          `Chain ID: ${chainId}, Store ID: ${storeId}`,
          `Found: ${matches.length} matches (showing ${limited.length})`,
          "",
        ];

        for (const item of limited) {
          const price = item.ItemPrice
            ? `${parseFloat(item.ItemPrice).toFixed(2)} ILS`
            : "N/A";

          lines.push(
            `${item.ItemName ?? "Unknown"} -- ${price}`
          );
          lines.push(`  Barcode: ${item.ItemCode ?? "N/A"}`);
          if (item.ManufacturerName) {
            lines.push(`  Manufacturer: ${item.ManufacturerName}`);
          }
          if (item.ManufacturerItemDescription) {
            lines.push(
              `  Description: ${item.ManufacturerItemDescription}`
            );
          }
          if (item.Quantity && item.UnitOfMeasure) {
            lines.push(
              `  Size: ${item.Quantity} ${item.UnitOfMeasure}`
            );
          }
          if (item.UnitOfMeasurePrice) {
            lines.push(
              `  Unit price: ${parseFloat(item.UnitOfMeasurePrice).toFixed(2)} ILS per unit`
            );
          }
          if (item.PriceUpdateDate) {
            lines.push(`  Updated: ${item.PriceUpdateDate}`);
          }
          lines.push("");
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error searching products: ${msg}\n\nMake sure the URL points to an uncompressed XML file. Files ending in .gz must be decompressed first.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // 4. compare_prices
  // =========================================================================
  server.tool(
    "compare_prices",
    "Compare a product's price across multiple XML price files (from different chains or stores). Provide multiple PriceFull XML URLs and a barcode (ItemCode) to compare.",
    {
      xml_urls: z
        .array(z.string().url())
        .min(1)
        .max(10)
        .describe(
          "Array of PriceFull XML file URLs to compare (from different chains/stores)"
        ),
      item_code: z
        .string()
        .min(1)
        .describe(
          "Product barcode (ItemCode) to compare across files. Use search_products to find the code first."
        ),
    },
    {
      title: "Compare Prices Across Chains",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ xml_urls, item_code }) => {
      const results: Array<{
        chainId: string;
        storeId: string;
        itemName: string;
        price: string;
        unitPrice: string;
        updateDate: string;
        url: string;
      }> = [];

      const errors: string[] = [];

      for (const url of xml_urls) {
        try {
          validateUrl(url);
          const xml = await fetchXml(url);
          const items = extractXmlBlocks(xml, "Item", PRICE_ITEM_FIELDS);
          const chainId =
            extractXmlElements(xml, "ChainId")[0] ?? "unknown";
          const storeId =
            extractXmlElements(xml, "StoreId")[0] ?? "unknown";

          const match = items.find(
            (item) => item.ItemCode === item_code
          );

          if (match) {
            results.push({
              chainId,
              storeId,
              itemName: match.ItemName ?? "Unknown",
              price: match.ItemPrice ?? "N/A",
              unitPrice: match.UnitOfMeasurePrice ?? "N/A",
              updateDate: match.PriceUpdateDate ?? "N/A",
              url,
            });
          } else {
            errors.push(
              `Product ${item_code} not found in file (chain ${chainId}, store ${storeId})`
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Error fetching ${url}: ${msg}`);
        }
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: [
                `Product ${item_code} not found in any of the ${xml_urls.length} provided files.`,
                "",
                ...errors,
                "",
                "Tips:",
                "- Verify the barcode using search_products first",
                "- Not all products are sold at every chain",
                "- Make sure URLs point to uncompressed XML files",
              ].join("\n"),
            },
          ],
        };
      }

      // Sort by price ascending
      results.sort((a, b) => {
        const pa = parseFloat(a.price) || Infinity;
        const pb = parseFloat(b.price) || Infinity;
        return pa - pb;
      });

      // Look up chain names
      const chainNameMap: Record<string, string> = {};
      for (const c of Object.values(CHAINS)) {
        chainNameMap[c.id] = `${c.nameEn} / ${c.nameHe}`;
      }

      const lines = [
        `Price Comparison: ${results[0].itemName}`,
        `Barcode: ${item_code}`,
        "=".repeat(50),
        "",
      ];

      const cheapest = parseFloat(results[0].price) || 0;
      const expensive =
        parseFloat(results[results.length - 1].price) || 0;
      if (cheapest > 0 && expensive > 0 && results.length > 1) {
        const savings = ((expensive - cheapest) / expensive) * 100;
        lines.push(
          `Price range: ${cheapest.toFixed(2)} - ${expensive.toFixed(2)} ILS`
        );
        lines.push(
          `Potential savings: ${savings.toFixed(1)}% (${(expensive - cheapest).toFixed(2)} ILS)`
        );
        lines.push("");
      }

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const chainName = chainNameMap[r.chainId] ?? `Chain ${r.chainId}`;
        const price = parseFloat(r.price);
        const priceStr = price ? `${price.toFixed(2)} ILS` : "N/A";
        const marker = i === 0 ? " << CHEAPEST" : "";

        lines.push(
          `${i + 1}. ${chainName} (Store ${r.storeId})`
        );
        lines.push(`   Price: ${priceStr}${marker}`);
        if (r.unitPrice !== "N/A") {
          lines.push(
            `   Unit price: ${parseFloat(r.unitPrice).toFixed(2)} ILS`
          );
        }
        lines.push(`   Updated: ${r.updateDate}`);
        lines.push("");
      }

      if (errors.length > 0) {
        lines.push("---");
        lines.push("Notes:");
        for (const e of errors) {
          lines.push(`  - ${e}`);
        }
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // =========================================================================
  // 5. get_store_data
  // =========================================================================
  server.tool(
    "get_store_data",
    "Get store locations and details from a chain's Stores XML file. Returns store names, addresses, cities, and IDs. Can filter by city name.",
    {
      xml_url: z
        .string()
        .url()
        .describe(
          "Direct URL to a Stores XML file (get this from get_chain_files with file_type='stores')"
        ),
      city_filter: z
        .string()
        .optional()
        .describe(
          "Optional city name to filter by (Hebrew, e.g. 'תל אביב' or English)"
        ),
      limit: z
        .number()
        .min(1)
        .max(200)
        .default(50)
        .describe("Maximum stores to return (1-200, default 50)"),
    },
    {
      title: "Get Store Locations",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ xml_url, city_filter, limit }) => {
      try {
        validateUrl(xml_url);
        const xml = await fetchXml(xml_url);
        let stores = extractXmlBlocks(xml, "Store", STORE_FIELDS);

        if (stores.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No stores found in this XML file. Make sure the URL points to an uncompressed Stores XML file.",
              },
            ],
          };
        }

        const chainId =
          extractXmlElements(xml, "ChainId")[0] ?? "unknown";
        const chainName =
          extractXmlElements(xml, "ChainName")[0] ?? "unknown";

        if (city_filter) {
          const filter = city_filter.toLowerCase();
          stores = stores.filter(
            (s) =>
              (s.City ?? "").toLowerCase().includes(filter) ||
              (s.Address ?? "").toLowerCase().includes(filter)
          );
        }

        const limited = stores.slice(0, limit);

        const lines = [
          `Store Locations: ${chainName}`,
          `Chain ID: ${chainId}`,
          "=".repeat(50),
          city_filter ? `Filtered by: "${city_filter}"` : "",
          `Found: ${stores.length} stores (showing ${limited.length})`,
          "",
        ].filter(Boolean);

        for (const store of limited) {
          lines.push(
            `Store #${store.StoreId ?? "?"}: ${store.StoreName ?? "Unknown"}`
          );
          if (store.Address) {
            lines.push(`  Address: ${store.Address}`);
          }
          if (store.City) {
            lines.push(`  City: ${store.City}`);
          }
          if (store.ZipCode) {
            lines.push(`  ZIP: ${store.ZipCode}`);
          }
          if (store.StoreType) {
            lines.push(`  Type: ${store.StoreType}`);
          }
          lines.push("");
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching store data: ${msg}\n\nMake sure the URL points to an uncompressed Stores XML file.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // 6. get_promotions
  // =========================================================================
  server.tool(
    "get_promotions",
    "Get current promotions and sales from a chain's Promo XML file. Returns promotion descriptions, discount details, validity dates, and applicable products.",
    {
      xml_url: z
        .string()
        .url()
        .describe(
          "Direct URL to a PromoFull or Promo XML file (from get_chain_files with file_type='promos' or 'promosfull')"
        ),
      query: z
        .string()
        .optional()
        .describe(
          "Optional search filter for promotion descriptions (Hebrew or English)"
        ),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(30)
        .describe("Maximum promotions to return (1-100, default 30)"),
    },
    {
      title: "Get Promotions",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ xml_url, query, limit }) => {
      try {
        validateUrl(xml_url);
        const xml = await fetchXml(xml_url);
        let promos = extractXmlBlocks(xml, "Promotion", PROMO_FIELDS);

        // Also extract item codes within each promotion block
        const promoBlocks = extractHtmlBlocks(xml, "Promotion");

        const promoItemMap: Record<string, string[]> = {};
        for (const block of promoBlocks) {
          const promoIds = extractXmlElements(block, "PromotionId");
          if (promoIds.length === 0) continue;
          const promoId = promoIds[0].trim();
          const itemCodes = extractXmlElements(block, "ItemCode");
          if (itemCodes.length > 0) {
            promoItemMap[promoId] = itemCodes;
          }
        }

        if (promos.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No promotions found in this XML file. Make sure the URL points to an uncompressed Promo XML file.",
              },
            ],
          };
        }

        const chainId =
          extractXmlElements(xml, "ChainId")[0] ?? "unknown";
        const storeId =
          extractXmlElements(xml, "StoreId")[0] ?? "unknown";

        if (query) {
          const q = query.toLowerCase();
          promos = promos.filter((p) =>
            (p.PromotionDescription ?? "").toLowerCase().includes(q)
          );
        }

        const limited = promos.slice(0, limit);

        const lines = [
          `Promotions`,
          `Chain ID: ${chainId}, Store ID: ${storeId}`,
          "=".repeat(50),
          query ? `Search filter: "${query}"` : "",
          `Found: ${promos.length} promotions (showing ${limited.length})`,
          "",
        ].filter(Boolean);

        for (const promo of limited) {
          lines.push(
            `Promotion #${promo.PromotionId ?? "?"}`
          );
          if (promo.PromotionDescription) {
            lines.push(`  ${promo.PromotionDescription}`);
          }
          if (promo.PromotionStartDate && promo.PromotionEndDate) {
            lines.push(
              `  Valid: ${promo.PromotionStartDate} - ${promo.PromotionEndDate}`
            );
          }
          if (promo.DiscountRate) {
            const discountType =
              promo.DiscountType === "1" ? "%" : "ILS";
            lines.push(
              `  Discount: ${promo.DiscountRate} ${discountType}`
            );
          }
          if (promo.MinQty) {
            lines.push(`  Min quantity: ${promo.MinQty}`);
          }
          if (promo.MinPurchaseAmnt && promo.MinPurchaseAmnt !== "0") {
            lines.push(
              `  Min purchase: ${promo.MinPurchaseAmnt} ILS`
            );
          }

          // Show applicable items
          const items = promoItemMap[promo.PromotionId ?? ""];
          if (items && items.length > 0) {
            const displayed = items.slice(0, 5);
            lines.push(
              `  Applies to ${items.length} product(s): ${displayed.join(", ")}${items.length > 5 ? "..." : ""}`
            );
          }

          lines.push("");
        }

        lines.push("---");
        lines.push(
          "Use search_products with the item codes above to get product names and prices."
        );

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching promotions: ${msg}\n\nMake sure the URL points to an uncompressed Promo XML file.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // 7. get_xml_schema_info
  // =========================================================================
  server.tool(
    "get_xml_schema_info",
    "Get documentation about the Israeli supermarket XML data schema, file types, and field definitions. Useful for understanding what data is available before querying.",
    {},
    {
      title: "XML Schema Reference",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async () => {
      const lines = [
        "Israeli Supermarket Price Transparency -- Data Schema Reference",
        "=".repeat(60),
        "",
        "Background:",
        "Under Israel's 2014 Food Act (Price Transparency in the Food Industry),",
        "all supermarket chains with 3+ stores must publish product prices as",
        "XML files daily. This data is publicly accessible.",
        "",
        "FILE TYPES",
        "-".repeat(40),
        "",
        "1. PriceFull -- Complete product catalog with all current prices",
        "   Updated: Usually daily (full snapshot)",
        "   XML root: <Items>",
        "",
        "2. Price -- Incremental price updates since last PriceFull",
        "   Updated: Multiple times per day",
        "   XML root: <Items>",
        "",
        "3. PromoFull -- Complete list of all active promotions",
        "   Updated: Usually daily",
        "   XML root: <Promotions>",
        "",
        "4. Promo -- Incremental promotion updates",
        "   Updated: Multiple times per day",
        "   XML root: <Promotions>",
        "",
        "5. Stores -- Store locations and details",
        "   Updated: Periodically",
        "   XML root: <Stores> or <SubChains>",
        "",
        "PRICE FILE FIELDS (per <Item>)",
        "-".repeat(40),
        ...PRICE_ITEM_FIELDS.map((f) => `  - ${f}`),
        "",
        "Key fields explained:",
        "  ItemCode = Barcode / EAN-13",
        "  ItemName = Product name (Hebrew)",
        "  ItemPrice = Price in ILS (New Israeli Shekel)",
        "  UnitOfMeasurePrice = Price per standard unit (for comparison)",
        "  bIsWeighted = 1 if sold by weight",
        "  QtyInPackage = Units per package",
        "  ItemStatus = 0 (available), 1 (out of stock)",
        "",
        "PROMOTION FILE FIELDS (per <Promotion>)",
        "-".repeat(40),
        ...PROMO_FIELDS.map((f) => `  - ${f}`),
        "",
        "  Each promotion can include a list of <ItemCode> elements",
        "  indicating which products are eligible.",
        "",
        "STORE FILE FIELDS (per <Store>)",
        "-".repeat(40),
        ...STORE_FIELDS.map((f) => `  - ${f}`),
        "",
        "ROOT-LEVEL FIELDS (in all files)",
        "-".repeat(40),
        "  ChainId, SubChainId, StoreId, BikoretNo",
        "  ChainName (in store files)",
        "",
        "FILE NAMING CONVENTION",
        "-".repeat(40),
        "  {Type}{ChainId}-{StoreId}-{DateTimeStamp}.xml",
        "  Example: PriceFull7290027600007-001-202403280000.xml",
        "  - PriceFull = file type",
        "  - 7290027600007 = chain barcode (Shufersal)",
        "  - 001 = store ID",
        "  - 202403280000 = YYYYMMDDHHMMM timestamp",
        "",
        "DATA SOURCES",
        "-".repeat(40),
        "  Web portals: Shufersal, PublishPrice-based chains",
        "  FTP: url.retail.publishedprices.co.il (most chains)",
        "  Kaggle (aggregated): erlichsefi/israeli-supermarkets-2024",
        "  Python scraper: pip install il-supermarket-scarper",
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // =========================================================================
  // 8. find_product -- one-shot price comparison across chains
  // =========================================================================
  server.tool(
    "find_product",
    "One-shot price comparison. Given a product name (Hebrew OK) or barcode, fetches the latest PriceFull file of each specified chain in parallel, finds matches, and returns a list sorted cheapest first. Replaces the list_chains → get_chain_files → search_products → compare_prices workflow.",
    {
      query: z
        .string()
        .min(2)
        .describe("Product name (Hebrew OK) or barcode (7+ digits)"),
      chains: z
        .array(z.string())
        .optional()
        .describe(
          "Chain keys to search. Defaults to ['shufersal','yeinot_bitan'] (the two web-accessible chains)."
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Max matches per chain (default 5)"),
    },
    {
      title: "Find Cheapest Price",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ query, chains, limit }) => {
      const targets = chains ?? ["shufersal", "yeinot_bitan"];
      const isBarcode = /^\d{7,}$/.test(query.trim());
      const needle = query.trim().toLowerCase();

      interface Match {
        chainName: string;
        itemName: string;
        itemCode: string;
        price: number;
        unitPrice?: string;
        manufacturer?: string;
        updatedAt?: string;
      }

      async function searchChain(chainKey: string): Promise<{ chainKey: string; matches: Match[]; error?: string }> {
        const info = CHAINS[chainKey];
        if (!info) return { chainKey, matches: [], error: `unknown chain: ${chainKey}` };
        if (!info.directAccess) {
          return { chainKey, matches: [], error: `${info.nameEn} requires FTP access (not supported by this MCP)` };
        }

        try {
          // 1. List files and pick the newest PriceFull
          let entries: ShufersalFileEntry[] = [];
          if (info.dataSource === "web") {
            const catId = SHUFERSAL_FILE_TYPES["pricesfull"] ?? "2";
            const url = `${info.endpoint}FileObject/UpdateCategory?catID=${catId}&storeId=0&sort=Time&sortdir=DESC`;
            const html = await fetchText(url);
            entries = parseShufersalFileList(html);
          } else if (info.dataSource === "publishprice") {
            const html = await fetchText(info.endpoint);
            entries = parsePublishPriceFileList(html, info.endpoint);
            entries = entries.filter((e) => e.name.toLowerCase().includes("pricefull"));
          }

          if (entries.length === 0) {
            return { chainKey, matches: [], error: `no PriceFull files found for ${info.nameEn}` };
          }

          const priceUrl = entries[0].url;
          const updatedAt = entries[0].date;

          // 2. Fetch + parse
          const xml = await fetchXml(priceUrl);
          const items = extractXmlBlocks(xml, "Item", PRICE_ITEM_FIELDS);

          // 3. Filter
          const filtered: Match[] = [];
          for (const it of items) {
            const code = it["ItemCode"] ?? "";
            const name = it["ItemName"] ?? "";
            const hit = isBarcode
              ? code === query.trim()
              : name.toLowerCase().includes(needle);
            if (!hit) continue;
            const priceStr = it["ItemPrice"] ?? "";
            const price = Number(priceStr);
            if (!Number.isFinite(price) || price <= 0) continue;
            filtered.push({
              chainName: info.nameEn,
              itemName: name,
              itemCode: code,
              price,
              unitPrice: it["UnitOfMeasurePrice"],
              manufacturer: it["ManufacturerName"],
              updatedAt,
            });
          }

          filtered.sort((a, b) => a.price - b.price);
          return { chainKey, matches: filtered.slice(0, limit) };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { chainKey, matches: [], error: msg };
        }
      }

      const results = await Promise.all(targets.map(searchChain));

      const allMatches = results.flatMap((r) => r.matches);
      allMatches.sort((a, b) => a.price - b.price);

      const failures = results.filter((r) => r.error).map((r) => `${r.chainKey}: ${r.error}`);

      const lines: string[] = [];
      lines.push(`Price comparison for: ${query}`);
      lines.push("=".repeat(50));

      if (allMatches.length === 0) {
        lines.push("");
        lines.push("No matches found.");
      } else {
        lines.push("");
        allMatches.forEach((m, i) => {
          lines.push(`${i + 1}. ${m.chainName} — ₪${m.price.toFixed(2)}`);
          lines.push(`   ${m.itemName}`);
          lines.push(`   barcode=${m.itemCode}${m.manufacturer ? ` | ${m.manufacturer}` : ""}${m.unitPrice ? ` | unit=₪${m.unitPrice}` : ""}`);
          if (m.updatedAt && m.updatedAt !== "unknown") lines.push(`   updated=${m.updatedAt}`);
          lines.push("");
        });
      }

      if (failures.length > 0) {
        lines.push("---");
        lines.push("Partial failures:");
        for (const f of failures) lines.push(`  ${f}`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

}
