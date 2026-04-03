const INATURALIST_BASE_URL = "https://api.inaturalist.org/v1";
const GBIF_BASE_URL = "https://api.gbif.org/v1";
const ISRAEL_PLACE_ID = 6815;
const ISRAEL_COUNTRY_CODE = "IL";
const REQUEST_TIMEOUT_MS = 30_000;
const THROTTLE_MS = 200;

let lastRequestTime = 0;

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < THROTTLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${response.statusText} for ${url}`
    );
  }

  return response;
}

// ---------------------------------------------------------------------------
// iNaturalist types
// ---------------------------------------------------------------------------

export interface INatPhoto {
  id: number;
  url: string;
  attribution: string;
}

export interface INatTaxon {
  id: number;
  name: string;
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  rank: string;
  observations_count?: number;
  wikipedia_url?: string;
}

export interface INatObservation {
  id: number;
  species_guess: string | null;
  taxon: INatTaxon | null;
  place_guess: string | null;
  location: string | null; // "lat,lng"
  created_at: string;
  observed_on: string | null;
  quality_grade: string;
  photos: INatPhoto[];
  uri: string;
}

export interface INatObservationsResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: INatObservation[];
}

export interface INatTaxaResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: INatTaxon[];
}

export interface INatSpeciesCountItem {
  count: number;
  taxon: INatTaxon;
}

export interface INatSpeciesCountsResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: INatSpeciesCountItem[];
}

// ---------------------------------------------------------------------------
// GBIF types
// ---------------------------------------------------------------------------

export interface GBIFOccurrence {
  key: number;
  species: string;
  scientificName: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  eventDate?: string;
  locality?: string;
  basisOfRecord: string;
  datasetName?: string;
  institutionCode?: string;
}

export interface GBIFOccurrenceResponse {
  offset: number;
  limit: number;
  count: number;
  results: GBIFOccurrence[];
}

export interface GBIFSpecies {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
  rank: string;
  taxonomicStatus: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
}

export interface GBIFSpeciesSearchResponse {
  offset: number;
  limit: number;
  count: number;
  results: GBIFSpecies[];
}

// ---------------------------------------------------------------------------
// iNaturalist client
// ---------------------------------------------------------------------------

export async function searchObservations(params: {
  species?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  per_page?: number;
  page?: number;
}): Promise<INatObservationsResponse> {
  const query = new URLSearchParams();
  query.set("place_id", String(ISRAEL_PLACE_ID));
  query.set("per_page", String(params.per_page ?? 20));
  query.set("page", String(params.page ?? 1));
  query.set("order_by", "created_at");
  query.set("order", "desc");

  if (params.species) {
    query.set("taxon_name", params.species);
  }

  if (
    params.lat !== undefined &&
    params.lng !== undefined &&
    params.radius_km !== undefined
  ) {
    query.set("lat", String(params.lat));
    query.set("lng", String(params.lng));
    query.set("radius", String(params.radius_km));
  }

  const url = `${INATURALIST_BASE_URL}/observations?${query.toString()}`;
  const response = await throttledFetch(url);
  return (await response.json()) as INatObservationsResponse;
}

export async function searchTaxa(
  queryText: string,
  perPage = 10
): Promise<INatTaxaResponse> {
  const query = new URLSearchParams();
  query.set("q", queryText);
  query.set("per_page", String(perPage));
  query.set("place_id", String(ISRAEL_PLACE_ID));

  const url = `${INATURALIST_BASE_URL}/taxa/autocomplete?${query.toString()}`;
  const response = await throttledFetch(url);
  return (await response.json()) as INatTaxaResponse;
}

export async function getSpeciesInArea(params: {
  lat: number;
  lng: number;
  radius_km: number;
  per_page?: number;
  page?: number;
}): Promise<INatSpeciesCountsResponse> {
  const query = new URLSearchParams();
  query.set("place_id", String(ISRAEL_PLACE_ID));
  query.set("lat", String(params.lat));
  query.set("lng", String(params.lng));
  query.set("radius", String(params.radius_km));
  query.set("per_page", String(params.per_page ?? 20));
  query.set("page", String(params.page ?? 1));

  const url = `${INATURALIST_BASE_URL}/observations/species_counts?${query.toString()}`;
  const response = await throttledFetch(url);
  return (await response.json()) as INatSpeciesCountsResponse;
}

export async function getObservationStats(
  taxonName?: string
): Promise<INatObservationsResponse> {
  const query = new URLSearchParams();
  query.set("place_id", String(ISRAEL_PLACE_ID));
  query.set("per_page", "0");

  if (taxonName) {
    query.set("taxon_name", taxonName);
  }

  const url = `${INATURALIST_BASE_URL}/observations?${query.toString()}`;
  const response = await throttledFetch(url);
  return (await response.json()) as INatObservationsResponse;
}

// ---------------------------------------------------------------------------
// GBIF client
// ---------------------------------------------------------------------------

export async function searchBiodiversity(params: {
  species?: string;
  limit?: number;
  offset?: number;
}): Promise<GBIFOccurrenceResponse> {
  const query = new URLSearchParams();
  query.set("country", ISRAEL_COUNTRY_CODE);
  query.set("limit", String(params.limit ?? 20));
  query.set("offset", String(params.offset ?? 0));

  if (params.species) {
    query.set("scientificName", params.species);
  }

  const url = `${GBIF_BASE_URL}/occurrence/search?${query.toString()}`;
  const response = await throttledFetch(url);
  return (await response.json()) as GBIFOccurrenceResponse;
}

export async function searchGBIFSpecies(
  queryText: string,
  limit = 10
): Promise<GBIFSpeciesSearchResponse> {
  const query = new URLSearchParams();
  query.set("q", queryText);
  query.set("limit", String(limit));

  const url = `${GBIF_BASE_URL}/species/search?${query.toString()}`;
  const response = await throttledFetch(url);
  return (await response.json()) as GBIFSpeciesSearchResponse;
}
