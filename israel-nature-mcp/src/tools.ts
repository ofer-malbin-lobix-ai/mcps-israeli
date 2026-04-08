import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  searchObservations,
  searchTaxa,
  getSpeciesInArea,
  getObservationStats,
  searchBiodiversity,
  type INatObservation,
  type INatTaxon,
  type INatSpeciesCountItem,
  type GBIFOccurrence,
} from "./client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatObservation(obs: INatObservation): Record<string, unknown> {
  const lat = obs.location ? obs.location.split(",")[0] : null;
  const lng = obs.location ? obs.location.split(",")[1] : null;

  return {
    id: obs.id,
    species: obs.taxon?.preferred_common_name ?? obs.species_guess ?? "Unknown",
    scientific_name: obs.taxon?.name ?? null,
    location_name: obs.place_guess,
    latitude: lat ? parseFloat(lat) : null,
    longitude: lng ? parseFloat(lng) : null,
    observed_on: obs.observed_on,
    quality_grade: obs.quality_grade,
    photo_url: obs.photos?.[0]?.url?.replace("square", "medium") ?? null,
    url: obs.uri,
  };
}

function formatTaxon(taxon: INatTaxon): Record<string, unknown> {
  return {
    id: taxon.id,
    scientific_name: taxon.name,
    common_name: taxon.preferred_common_name ?? null,
    rank: taxon.rank,
    iconic_group: taxon.iconic_taxon_name ?? null,
    observations_count: taxon.observations_count ?? null,
    wikipedia_url: taxon.wikipedia_url ?? null,
  };
}

function formatSpeciesCount(item: INatSpeciesCountItem): Record<string, unknown> {
  return {
    count: item.count,
    ...formatTaxon(item.taxon),
  };
}

function formatGBIFOccurrence(occ: GBIFOccurrence): Record<string, unknown> {
  return {
    key: occ.key,
    species: occ.species,
    scientific_name: occ.scientificName,
    latitude: occ.decimalLatitude ?? null,
    longitude: occ.decimalLongitude ?? null,
    date: occ.eventDate ?? null,
    locality: occ.locality ?? null,
    basis_of_record: occ.basisOfRecord,
    dataset: occ.datasetName ?? null,
    institution: occ.institutionCode ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const searchObservationsShape = {
  species: z
    .string()
    .optional()
    .describe(
      "Species name to search for (common or scientific, e.g. 'gazelle' or 'Gazella gazella')"
    ),
  lat: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .describe("Latitude for location-based search"),
  lng: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe("Longitude for location-based search"),
  radius_km: z
    .number()
    .min(0.1)
    .max(500)
    .optional()
    .describe("Search radius in kilometers (requires lat/lng)"),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(20)
    .describe("Number of results per page (default 20, max 200)"),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for pagination"),
};

const searchObservationsSchema = z
  .object(searchObservationsShape)
  .refine(
    (data) => {
      const has = [data.lat, data.lng, data.radius_km].filter(v => v !== undefined);
      return has.length === 0 || has.length === 3;
    },
    { message: "lat, lng, and radius_km must all be provided together" }
  );

export function registerTools(server: McpServer): void {
  // 1. search_observations
  server.tool(
    "search_observations",
    "Search nature observations in Israel via iNaturalist. Returns recent observations with species, location, date, and photo URLs. Filter by species name, geographic coordinates, or both.",
    searchObservationsShape,
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
    async (rawParams) => {
      const parsed = searchObservationsSchema.safeParse(rawParams);
      if (!parsed.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid parameters: ${parsed.error.errors.map(e => e.message).join(", ")}`,
            },
          ],
          isError: true,
        };
      }
      const params = parsed.data;
      try {
        const data = await searchObservations({
          species: params.species,
          lat: params.lat,
          lng: params.lng,
          radius_km: params.radius_km,
          per_page: params.per_page,
          page: params.page,
        });

        const observations = data.results.map(formatObservation);

        const result = {
          total_results: data.total_results,
          page: data.page,
          per_page: data.per_page,
          observations,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching observations: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 2. search_species
  server.tool(
    "search_species",
    "Search for species found in Israel via iNaturalist taxa autocomplete. Accepts common names in English or Hebrew, or scientific names. Returns matching taxa with observation counts.",
    {
      query: z
        .string()
        .describe(
          "Species search query (e.g. 'eagle', 'נשר', 'Aquila')"
        ),
      per_page: z
        .number()
        .int()
        .min(1)
        .max(30)
        .default(10)
        .describe("Number of results (default 10, max 30)"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
    async (params) => {
      try {
        const data = await searchTaxa(params.query, params.per_page);

        const taxa = data.results.map(formatTaxon);

        const result = {
          total_results: data.total_results,
          taxa,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching species: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 3. get_species_in_area
  server.tool(
    "get_species_in_area",
    "Get species observed in a specific area of Israel. Provide coordinates and radius to discover what species have been recorded nearby. Returns species list with observation counts.",
    {
      lat: z
        .number()
        .min(29)
        .max(34)
        .describe("Latitude (Israel range: ~29.5 to ~33.3)"),
      lng: z
        .number()
        .min(34)
        .max(36)
        .describe("Longitude (Israel range: ~34.2 to ~35.9)"),
      radius_km: z
        .number()
        .min(0.1)
        .max(100)
        .default(5)
        .describe("Search radius in kilometers (default 5, max 100)"),
      per_page: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(20)
        .describe("Number of species to return (default 20, max 200)"),
      page: z
        .number()
        .int()
        .min(1)
        .default(1)
        .describe("Page number for pagination"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
    async (params) => {
      try {
        const data = await getSpeciesInArea({
          lat: params.lat,
          lng: params.lng,
          radius_km: params.radius_km,
          per_page: params.per_page,
          page: params.page,
        });

        const species = data.results.map(formatSpeciesCount);

        const result = {
          total_species: data.total_results,
          page: data.page,
          per_page: data.per_page,
          area: {
            center: { lat: params.lat, lng: params.lng },
            radius_km: params.radius_km,
          },
          species,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting species in area: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 4. get_observation_stats
  server.tool(
    "get_observation_stats",
    "Get observation statistics for Israel from iNaturalist. Optionally filter by taxon name to get counts for a specific group (e.g. 'Aves' for birds, 'Mammalia' for mammals).",
    {
      taxon_name: z
        .string()
        .optional()
        .describe(
          "Taxon name to filter by (e.g. 'Aves', 'Mammalia', 'Reptilia', 'Gazella gazella')"
        ),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
    async (params) => {
      try {
        const data = await getObservationStats(params.taxon_name);

        const result = {
          total_observations: data.total_results,
          filter: params.taxon_name ?? "all taxa",
          source: "iNaturalist",
          region: "Israel (place_id: 6815)",
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting observation stats: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 5. search_biodiversity
  server.tool(
    "search_biodiversity",
    "Search GBIF (Global Biodiversity Information Facility) for biodiversity occurrence records in Israel. Best for scientific/research queries using scientific names. Returns specimen and observation records with coordinates and dates.",
    {
      species: z
        .string()
        .optional()
        .describe(
          "Scientific name to search for (e.g. 'Gazella gazella', 'Aquila chrysaetos')"
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(300)
        .default(20)
        .describe("Number of results (default 20, max 300)"),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Offset for pagination"),
    },
    {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
    async (params) => {
      try {
        const data = await searchBiodiversity({
          species: params.species,
          limit: params.limit,
          offset: params.offset,
        });

        const occurrences = data.results.map(formatGBIFOccurrence);

        const result = {
          total_records: data.count,
          offset: data.offset,
          limit: data.limit,
          source: "GBIF",
          region: "Israel (country: IL)",
          occurrences,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching biodiversity records: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
