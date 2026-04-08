/**
 * MCP tool definitions and handlers for the Israel Hiking Map API.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  searchPois,
  planRoute,
  getPoiDetails,
  getClosestPoint,
} from "./client.js";
import type {
  SearchResult,
  RoutingFeatureCollection,
  PoiFeature,
} from "./client.js";

// ---------------------------------------------------------------------------
// Formatters - turn raw API responses into readable text
// ---------------------------------------------------------------------------

function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No results found.";
  }

  const lines: string[] = [`Found ${results.length} result(s):\n`];

  for (const r of results) {
    const iconLabel = r.icon.replace("icon-", "").replace(/-/g, " ");
    lines.push(`  ${r.title}`);
    lines.push(`    Display name: ${r.displayName}`);
    lines.push(`    Location: ${r.location.lat.toFixed(5)}, ${r.location.lng.toFixed(5)}`);
    lines.push(`    Type: ${iconLabel}`);
    lines.push(`    Source: ${r.source} | ID: ${r.id}`);
    if (r.hasExtraData) {
      lines.push(`    Has extra data: yes`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatRoute(fc: RoutingFeatureCollection): string {
  if (!fc.features || fc.features.length === 0) {
    return "No route could be calculated.";
  }

  const feature = fc.features[0];
  const coords = feature.geometry.coordinates;
  const lines: string[] = [];

  // Basic route info
  const name = feature.properties?.Name ?? "Route";
  lines.push(`Route: ${name}\n`);

  // Distance calculation (haversine approximation)
  let totalDistanceKm = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    totalDistanceKm += haversineKm(lat1, lng1, lat2, lng2);
  }
  lines.push(`Total distance: ${totalDistanceKm.toFixed(2)} km`);
  lines.push(`Total points: ${coords.length}`);

  // Elevation profile
  const elevations = coords
    .map((c) => c[2])
    .filter((e) => e !== undefined && e !== null);
  if (elevations.length > 0) {
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    const startElev = elevations[0];
    const endElev = elevations[elevations.length - 1];

    let totalAscent = 0;
    let totalDescent = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) totalAscent += diff;
      else totalDescent += Math.abs(diff);
    }

    lines.push(`\nElevation Profile:`);
    lines.push(`  Start: ${startElev.toFixed(0)} m`);
    lines.push(`  End: ${endElev.toFixed(0)} m`);
    lines.push(`  Min: ${minElev.toFixed(0)} m`);
    lines.push(`  Max: ${maxElev.toFixed(0)} m`);
    lines.push(`  Total ascent: ${totalAscent.toFixed(0)} m`);
    lines.push(`  Total descent: ${totalDescent.toFixed(0)} m`);
  }

  // Road types summary
  const roadDetails = feature.properties?.details?.road_class;
  if (roadDetails && roadDetails.length > 0) {
    lines.push(`\nRoad types along the route:`);
    const typeCounts = new Map<string, number>();
    for (const [start, end, roadType] of roadDetails) {
      const segmentPoints = end - start;
      typeCounts.set(
        roadType,
        (typeCounts.get(roadType) ?? 0) + segmentPoints
      );
    }
    const sorted = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [roadType, count] of sorted) {
      const pct = ((count / coords.length) * 100).toFixed(0);
      lines.push(`  ${roadType}: ${pct}%`);
    }
  }

  // Start and end coordinates
  const start = coords[0];
  const end = coords[coords.length - 1];
  lines.push(`\nStart: ${start[1].toFixed(5)}, ${start[0].toFixed(5)}`);
  lines.push(`End: ${end[1].toFixed(5)}, ${end[0].toFixed(5)}`);

  return lines.join("\n");
}

function formatPoiDetails(poi: PoiFeature): string {
  const props = poi.properties;
  const lines: string[] = [];

  // Extract names
  const name =
    (props["name:en"] as string) ??
    (props["name:he"] as string) ??
    (props["name"] as string) ??
    "Unknown";
  const hebrewName = (props["name:he"] as string) ?? "";

  lines.push(`${name}`);
  if (hebrewName && hebrewName !== name) {
    lines.push(`Hebrew: ${hebrewName}`);
  }
  lines.push("");

  // Location
  if (poi.geometry.type === "Point") {
    const coords = poi.geometry.coordinates as number[];
    lines.push(
      `Location: ${coords[1]?.toFixed(5)}, ${coords[0]?.toFixed(5)}`
    );
    if (coords[2] != null) {
      lines.push(`Elevation: ${coords[2].toFixed(0)} m`);
    }
  }

  // POI metadata
  const category = props["poiCategory"] as string;
  const source = props["poiSource"] as string;
  const icon = (props["poiIcon"] as string)
    ?.replace("icon-", "")
    .replace(/-/g, " ");
  const poiId = props["poiId"] ?? props["identifier"];

  if (category) lines.push(`Category: ${category}`);
  if (source) lines.push(`Source: ${source}`);
  if (icon) lines.push(`Type: ${icon}`);
  if (poiId) lines.push(`ID: ${poiId}`);

  // Description
  const description = props["description"] as string;
  if (description) {
    lines.push(`\nDescription: ${description}`);
  }

  // Wikipedia
  const wikipedia = props["wikipedia"] as string;
  if (wikipedia) {
    lines.push(`Wikipedia: ${wikipedia}`);
  }

  // Wikidata
  const wikidata = props["wikidata"] as string;
  if (wikidata) {
    lines.push(`Wikidata: ${wikidata}`);
  }

  // Last modified
  const lastModified = props["poiLastModified"] as string;
  if (lastModified) {
    lines.push(`Last modified: ${lastModified}`);
  }

  // Available languages
  const languages = props["poiLanguages"] as string[];
  if (languages && languages.length > 0) {
    lines.push(`Available languages: ${languages.join(", ")}`);
  }

  // Websites
  const websiteKeys = Object.keys(props).filter((k) => k.startsWith("website"));
  for (const key of websiteKeys) {
    lines.push(`Website: ${props[key]}`);
  }

  // Image
  const image = props["image"] as string;
  if (image) {
    lines.push(`Image: ${image}`);
  }

  return lines.join("\n");
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// ITM <-> WGS84 coordinate conversion
// ---------------------------------------------------------------------------

/**
 * Convert Israel Transverse Mercator (ITM) to WGS84.
 * Based on the standard ITM projection parameters.
 */
function itmToWgs84(easting: number, northing: number): { lat: number; lng: number } {
  // ITM parameters
  const a = 6378137.0; // GRS80 semi-major axis
  const f = 1 / 298.257222101;
  const e2 = 2 * f - f * f;
  const e = Math.sqrt(e2);
  const e_prime2 = e2 / (1 - e2);
  const k0 = 1.0000067;
  const lon0 = (35.2045169444444 * Math.PI) / 180;
  const lat0 = (31.7343936111111 * Math.PI) / 180;
  const FE = 219529.584;
  const FN = 626907.39;

  const x = easting - FE;
  const y = northing - FN;

  // Footpoint latitude
  const M = y / k0;
  const mu =
    M /
    (a *
      (1 -
        e2 / 4 -
        (3 * e2 * e2) / 64 -
        (5 * e2 * e2 * e2) / 256));
  const e1 =
    (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) *
      Math.sin(4 * mu) +
    ((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 = e_prime2 * Math.cos(phi1) * Math.cos(phi1);
  const R1 =
    (a * (1 - e2)) /
    Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = x / (N1 * k0);

  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e_prime2) *
          D * D * D * D) /
          24 +
        ((61 +
          90 * T1 +
          298 * C1 +
          45 * T1 * T1 -
          252 * e_prime2 -
          3 * C1 * C1) *
          D * D * D * D * D * D) /
          720);

  const lng =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * D * D * D) / 6 +
      ((5 -
        2 * C1 +
        28 * T1 -
        3 * C1 * C1 +
        8 * e_prime2 +
        24 * T1 * T1) *
        D * D * D * D * D) /
        120) /
      Math.cos(phi1);

  return {
    lat: (lat * 180) / Math.PI,
    lng: (lng * 180) / Math.PI,
  };
}

/**
 * Convert WGS84 to Israel Transverse Mercator (ITM).
 */
function wgs84ToItm(lat: number, lng: number): { easting: number; northing: number } {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const e2 = 2 * f - f * f;
  const e_prime2 = e2 / (1 - e2);
  const k0 = 1.0000067;
  const lon0 = (35.2045169444444 * Math.PI) / 180;
  const FE = 219529.584;
  const FN = 626907.39;

  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;

  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = e_prime2 * Math.cos(phi) * Math.cos(phi);
  const A = Math.cos(phi) * (lambda - lon0);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(4 * phi) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * phi));

  const lat0 = (31.7343936111111 * Math.PI) / 180;
  const M0 =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * lat0 -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(2 * lat0) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(4 * lat0) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * lat0));

  const easting =
    FE +
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * e_prime2) *
          A * A * A * A * A) /
          120);

  const northing =
    FN +
    k0 *
      (M -
        M0 +
        N *
          Math.tan(phi) *
          ((A * A) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * e_prime2) *
              A * A * A * A * A * A) /
              720));

  return { easting, northing };
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // 1. search_pois
  server.registerTool(
    "search_pois",
    {
      title: "Search Points of Interest",
      description:
        "Search for points of interest in Israel by name or keyword. " +
        "Returns locations of hiking trails, water sources, viewpoints, campgrounds, " +
        "historical sites, and more from OpenStreetMap and Wikidata. " +
        "Supports Hebrew and English search terms.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Search term (Hebrew or English). Examples: 'Ein Gedi', 'water', 'viewpoint', 'parking'"
          ),
        language: z
          .enum(["he", "en"])
          .optional()
          .default("he")
          .describe("Language for results. Defaults to Hebrew (he)."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ query, language }) => {
      try {
        const results = await searchPois(query, language ?? "he");
        const text = formatSearchResults(results);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error searching POIs: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // 2. plan_route
  server.registerTool(
    "plan_route",
    {
      title: "Plan Hiking Route",
      description:
        "Plan a route between two geographic points in Israel. " +
        "Returns distance, elevation profile (ascent, descent, min/max), " +
        "and road type breakdown. Supports hiking, biking, and 4WD profiles. " +
        "Coordinates are in WGS84 (latitude, longitude).",
      inputSchema: z.object({
        from_lat: z.number().describe("Start point latitude (WGS84)"),
        from_lng: z.number().describe("Start point longitude (WGS84)"),
        to_lat: z.number().describe("End point latitude (WGS84)"),
        to_lng: z.number().describe("End point longitude (WGS84)"),
        route_type: z
          .enum(["Hike", "Bike", "4WD", "None"])
          .optional()
          .default("Hike")
          .describe(
            "Routing profile. 'Hike' for walking/hiking, 'Bike' for cycling, '4WD' for off-road driving, 'None' for straight line. Defaults to 'Hike'."
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ from_lat, from_lng, to_lat, to_lng, route_type }) => {
      try {
        const result = await planRoute(
          from_lat,
          from_lng,
          to_lat,
          to_lng,
          route_type ?? "Hike"
        );
        const text = formatRoute(result);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: `Error planning route: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );

  // 3. find_trails
  server.registerTool(
    "find_trails",
    {
      title: "Find Trails Near Location",
      description:
        "Search for hiking trails and routes near a given location in Israel. " +
        "Uses the Israel Hiking Map search API filtered for trail-related results. " +
        "Provide a place name or area to find nearby trails.",
      inputSchema: z.object({
        area: z
          .string()
          .describe(
            "Area or place name to search trails near. Examples: 'Galilee', 'Negev', 'Golan', 'Carmel', 'Ein Gedi'"
          ),
        language: z
          .enum(["he", "en"])
          .optional()
          .default("he")
          .describe("Language for results. Defaults to Hebrew (he)."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ area, language }) => {
      try {
        // Search for trails by appending "trail" to the query
        const trailQuery = `${area} trail`;
        const allResults = await searchPois(trailQuery, language ?? "he");

        // Filter for trail-like icons
        const trailIcons = new Set([
          "icon-hike",
          "icon-bike",
          "icon-four-by-four",
          "icon-route-hike",
        ]);
        const trailResults = allResults.filter(
          (r) => trailIcons.has(r.icon) || r.title.toLowerCase().includes("trail")
        );

        // If filtering yields few results, also search without "trail" suffix
        let finalResults = trailResults;
        if (trailResults.length < 3) {
          const areaResults = await searchPois(area, language ?? "he");
          const moreTrails = areaResults.filter(
            (r) =>
              trailIcons.has(r.icon) ||
              r.title.toLowerCase().includes("trail") ||
              r.title.toLowerCase().includes("path") ||
              r.title.toLowerCase().includes("route") ||
              r.title.includes("שביל") ||
              r.title.includes("מסלול")
          );
          // Merge, deduplicate by id
          const seen = new Set(finalResults.map((r) => r.id));
          for (const r of moreTrails) {
            if (!seen.has(r.id)) {
              finalResults.push(r);
              seen.add(r.id);
            }
          }
        }

        if (finalResults.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No trails found near "${area}". Try a different area name or a broader region (e.g., "Galilee", "Negev").`,
              },
            ],
          };
        }

        const text = formatSearchResults(finalResults);
        return { content: [{ type: "text", text: `Trails near ${area}:\n\n${text}` }] };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: `Error finding trails: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );

  // 4. get_poi_details
  server.registerTool(
    "get_poi_details",
    {
      title: "Get POI Details",
      description:
        "Get detailed information about a specific point of interest. " +
        "Requires the source and ID from a previous search result. " +
        "Returns names in multiple languages, location, elevation, category, " +
        "Wikipedia links, images, and more.",
      inputSchema: z.object({
        source: z
          .string()
          .describe(
            "The data source of the POI. Common values: 'OSM' (OpenStreetMap), 'Wikidata'."
          ),
        id: z
          .string()
          .describe(
            "The unique identifier of the POI within its source. Example: 'node_29090735', 'Q1218'."
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ source, id }) => {
      try {
        const poi = await getPoiDetails(source, id);
        const text = formatPoiDetails(poi);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: `Error getting POI details: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );

  // 5. convert_coordinates
  server.registerTool(
    "convert_coordinates",
    {
      title: "Convert Coordinates",
      description:
        "Convert coordinates between Israel Transverse Mercator (ITM) and WGS84 systems. " +
        "ITM is the official coordinate system used in Israeli maps and surveys. " +
        "WGS84 is the global GPS standard (latitude/longitude).",
      inputSchema: z.object({
        direction: z
          .enum(["itm_to_wgs84", "wgs84_to_itm"])
          .describe("Conversion direction"),
        x: z
          .number()
          .describe(
            "For itm_to_wgs84: ITM Easting (X). For wgs84_to_itm: WGS84 Latitude (note: NOT longitude)"
          ),
        y: z
          .number()
          .describe(
            "For itm_to_wgs84: ITM Northing (Y). For wgs84_to_itm: WGS84 Longitude (note: NOT latitude)"
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ direction, x, y }) => {
      try {
        let text: string;

        if (direction === "itm_to_wgs84") {
          const result = itmToWgs84(x, y);
          text = [
            "ITM to WGS84 Conversion:",
            `  Input (ITM): Easting=${x}, Northing=${y}`,
            `  Output (WGS84): Latitude=${result.lat.toFixed(6)}, Longitude=${result.lng.toFixed(6)}`,
            "",
            `Google Maps: https://www.google.com/maps?q=${result.lat.toFixed(6)},${result.lng.toFixed(6)}`,
            `Israel Hiking Map: https://israelhiking.osm.org.il/#/map/15/${result.lat.toFixed(5)}/${result.lng.toFixed(5)}`,
          ].join("\n");
        } else {
          const result = wgs84ToItm(x, y);
          text = [
            "WGS84 to ITM Conversion:",
            `  Input (WGS84): Latitude=${x}, Longitude=${y}`,
            `  Output (ITM): Easting=${result.easting.toFixed(2)}, Northing=${result.northing.toFixed(2)}`,
          ].join("\n");
        }

        return { content: [{ type: "text", text }] };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error converting coordinates: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
