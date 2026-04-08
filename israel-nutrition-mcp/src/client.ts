/**
 * API client for Israel's National Nutrition Database (Tzameret)
 * via the CKAN Datastore API on data.gov.il
 */

// Resource IDs for the three datasets
export const RESOURCE_IDS = {
  /** Foods with full nutritional breakdown per 100g (4,500+ items) */
  FOODS: "c3cb0630-0650-46c1-a068-82d575c094b2",
  /** Recipe ingredient compositions */
  RECIPES: "5c726506-5c1e-43a7-94f7-24845dbde9c3",
  /** Weight per unit per food item (serving sizes) */
  SERVING_SIZES: "755d28c0-75f7-40e1-9c8c-ecdd106f9b2d",
} as const;

const BASE_URL = "https://data.gov.il/api/3/action/datastore_search";

/** All nutritional fields available on a food record */
export const NUTRIENT_FIELDS = [
  "food_energy",
  "protein",
  "total_fat",
  "carbohydrates",
  "total_dietary_fiber",
  "moisture",
  "alcohol",
  "cholesterol",
  "saturated_fat",
  "oleic",
  "linoleic",
  "linolenic",
  "calcium",
  "iron",
  "magnesium",
  "phosphorus",
  "potassium",
  "sodium",
  "zinc",
  "copper",
  "vitamin_a_iu",
  "carotene",
  "vitamin_e",
  "vitamin_c",
  "thiamin",
  "riboflavin",
  "niacin",
  "vitamin_b6",
  "folate",
  "vitamin_b12",
  "butyric",
  "caproic",
  "caprylic",
  "capric",
  "lauric",
  "myristic",
  "palmitic",
  "stearic",
  "arachidonic",
  "docosahexanoic",
] as const;

export type NutrientField = (typeof NUTRIENT_FIELDS)[number];

/** Shape of a food record from the CKAN API */
export interface FoodRecord {
  _id: number;
  Code: number;
  smlmitzrach: number;
  shmmitzrach: string;
  makor: number;
  food_energy: number | null;
  protein: number | null;
  total_fat: number | null;
  carbohydrates: number | null;
  total_dietary_fiber: number | null;
  moisture: number | null;
  alcohol: number | null;
  cholesterol: number | null;
  saturated_fat: number | null;
  oleic: number | null;
  linoleic: number | null;
  linolenic: number | null;
  calcium: number | null;
  iron: number | null;
  magnesium: number | null;
  phosphorus: number | null;
  potassium: number | null;
  sodium: number | null;
  zinc: number | null;
  copper: number | null;
  vitamin_a_iu: number | null;
  carotene: number | null;
  vitamin_e: number | null;
  vitamin_c: number | null;
  thiamin: number | null;
  riboflavin: number | null;
  niacin: number | null;
  vitamin_b6: number | null;
  folate: number | null;
  vitamin_b12: number | null;
  butyric: number | null;
  caproic: number | null;
  caprylic: number | null;
  capric: number | null;
  lauric: number | null;
  myristic: number | null;
  palmitic: number | null;
  stearic: number | null;
  arachidonic: number | null;
  docosahexanoic: number | null;
  [key: string]: unknown;
}

/** Shape of a recipe ingredient record */
export interface RecipeRecord {
  _id: number;
  smlmitzrach: number;
  shmmitzrach: string;
  smlmarciv: number;
  shmmarciv: string;
  achuz_marciv: number;
  [key: string]: unknown;
}

/** CKAN Datastore API response wrapper */
interface DatastoreResponse<T> {
  success: boolean;
  result: {
    records: T[];
    total: number;
    fields: Array<{ id: string; type: string }>;
    _links: { start: string; next: string };
  };
}

// Simple rate limiter: max 10 requests per second
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 100; // 10 req/s = 100ms between requests

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Query the CKAN Datastore API
 */
async function datastoreSearch<T>(params: {
  resourceId: string;
  q?: string;
  filters?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<{ records: T[]; total: number }> {
  await rateLimit();

  const url = new URL(BASE_URL);
  url.searchParams.set("resource_id", params.resourceId);

  if (params.q) {
    url.searchParams.set("q", params.q);
  }
  if (params.filters) {
    url.searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params.sort) {
    url.searchParams.set("sort", params.sort);
  }
  if (params.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    url.searchParams.set("offset", String(params.offset));
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as DatastoreResponse<T>;

  if (!data.success) {
    throw new Error("API returned unsuccessful response");
  }

  return {
    records: data.result.records,
    total: data.result.total,
  };
}

/**
 * Search foods by name (Hebrew or English text search)
 */
export async function searchFoods(
  query: string,
  limit: number = 20
): Promise<{ records: FoodRecord[]; total: number }> {
  return datastoreSearch<FoodRecord>({
    resourceId: RESOURCE_IDS.FOODS,
    q: query,
    limit,
  });
}

/**
 * Get a single food by its smlmitzrach code
 */
export async function getFoodByCode(
  foodCode: number
): Promise<FoodRecord | null> {
  const result = await datastoreSearch<FoodRecord>({
    resourceId: RESOURCE_IDS.FOODS,
    filters: { smlmitzrach: foodCode },
    limit: 1,
  });
  return result.records[0] ?? null;
}

/**
 * Get multiple foods by their smlmitzrach codes
 */
export async function getFoodsByCodes(
  foodCodes: number[]
): Promise<FoodRecord[]> {
  const results: FoodRecord[] = [];
  for (const code of foodCodes) {
    const food = await getFoodByCode(code);
    if (food) {
      results.push(food);
    }
  }
  return results;
}

/**
 * Get recipe ingredients for a food item
 */
export async function getRecipeIngredients(
  foodCode: number
): Promise<RecipeRecord[]> {
  const result = await datastoreSearch<RecipeRecord>({
    resourceId: RESOURCE_IDS.RECIPES,
    filters: { smlmitzrach: foodCode },
    limit: 100,
  });
  return result.records;
}

/**
 * Search foods sorted by a specific nutrient value
 */
export async function searchByNutrient(
  nutrient: string,
  order: "high" | "low" = "high",
  limit: number = 20
): Promise<{ records: FoodRecord[]; total: number }> {
  const sortDirection = order === "high" ? "desc" : "asc";
  const result = await datastoreSearch<FoodRecord>({
    resourceId: RESOURCE_IDS.FOODS,
    sort: `${nutrient} ${sortDirection}`,
    limit,
  });
  result.records = result.records.filter(r => r[nutrient] != null && r[nutrient] !== '');
  return result;
}
