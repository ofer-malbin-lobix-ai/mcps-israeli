/**
 * Tool definitions and handlers for the Tel Aviv City MCP server.
 *
 * Each tool queries one or more ArcGIS MapServer layers from the
 * Tel Aviv Municipality open data platform and returns human-readable
 * formatted text.
 */

import { z } from "zod";
import {
  queryLayer,
  LAYERS,
  bboxAroundPoint,
  haversineKm,
  type ArcGISFeature,
} from "./client.js";

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const LocationSchema = z.object({
  longitude: z
    .number()
    .min(34.74)
    .max(34.86)
    .describe("Longitude (WGS-84) within Tel Aviv area"),
  latitude: z
    .number()
    .min(32.02)
    .max(32.16)
    .describe("Latitude (WGS-84) within Tel Aviv area"),
});

const RadiusSchema = z
  .number()
  .min(0.1)
  .max(5)
  .default(1)
  .describe("Search radius in kilometers (0.1 to 5, default 1)");

const LimitSchema = z
  .number()
  .int()
  .min(1)
  .max(50)
  .default(10)
  .describe("Maximum number of results (1 to 50, default 10)");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function attr(feature: ArcGISFeature, key: string): string {
  const val = feature.attributes[key];
  if (val === null || val === undefined || val === "" || val === " ") return "";
  return String(val).trim();
}

function featureCoords(
  feature: ArcGISFeature
): { lon: number; lat: number } | null {
  const geom = feature.geometry;
  if (!geom) return null;
  if ("x" in geom && "y" in geom) {
    return { lon: geom.x, lat: geom.y };
  }
  // Centroid of first ring (polygon) or first path (line)
  const points =
    ("rings" in geom ? geom.rings[0] : undefined) ||
    ("paths" in geom ? geom.paths[0] : undefined);
  if (points && points.length > 0) {
    const sumX = points.reduce((s: number, p: number[]) => s + p[0], 0);
    const sumY = points.reduce((s: number, p: number[]) => s + p[1], 0);
    return { lon: sumX / points.length, lat: sumY / points.length };
  }
  return null;
}

function sortByDistance(
  features: ArcGISFeature[],
  lon: number,
  lat: number
): (ArcGISFeature & { _distKm: number })[] {
  return features
    .map((f) => {
      const coords = featureCoords(f);
      const distKm = coords ? haversineKm(lon, lat, coords.lon, coords.lat) : Infinity;
      return { ...f, _distKm: distKm };
    })
    .sort((a, b) => a._distKm - b._distKm);
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

// ---------------------------------------------------------------------------
// Tool: find_parking
// ---------------------------------------------------------------------------

export const findParkingSchema = z.object({
  ...LocationSchema.shape,
  radius_km: RadiusSchema,
  limit: LimitSchema,
});

export type FindParkingInput = z.infer<typeof findParkingSchema>;

export async function findParking(input: FindParkingInput): Promise<string> {
  const { longitude, latitude, radius_km, limit } = input;
  const bbox = bboxAroundPoint(longitude, latitude, radius_km);

  // Query both public and Ahuzot HaHof parking lots
  const [publicLots, ahuzotLots] = await Promise.all([
    queryLayer({
      layerId: LAYERS.PUBLIC_PARKING,
      bbox,
      outFields: ["name", "address", "description", "num_vehicles", "num_disabled", "covered"],
      resultRecordCount: 50,
    }),
    queryLayer({
      layerId: LAYERS.AHUZOT_PARKING,
      bbox,
      outFields: [
        "shem_chenyon", "ktovet", "lon", "lat",
        "taarif_yom", "taarif_layla", "taarif_yomi",
        "mispar_mekomot_bchenyon", "status_chenyon",
        "chalon_zman_chenyon_patoach", "hearot_taarif",
      ],
      resultRecordCount: 50,
    }),
  ]);

  // Normalize and combine
  const all: ArcGISFeature[] = [...publicLots, ...ahuzotLots];

  if (all.length === 0) {
    return `No parking lots found within ${radius_km}km of (${latitude}, ${longitude}).`;
  }

  const sorted = sortByDistance(all, longitude, latitude).slice(0, limit);

  const lines: string[] = [
    `Parking lots near (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) within ${radius_km}km:`,
    "",
  ];

  for (const lot of sorted) {
    const name = attr(lot, "name") || attr(lot, "shem_chenyon") || "Unnamed";
    const address = attr(lot, "address") || attr(lot, "ktovet") || "No address";
    const dist = fmtDist(lot._distKm);

    lines.push(`  ${name}`);
    lines.push(`    Address: ${address}`);
    lines.push(`    Distance: ${dist}`);

    const capacity = attr(lot, "num_vehicles") || attr(lot, "mispar_mekomot_bchenyon");
    if (capacity && capacity !== "0") {
      lines.push(`    Capacity: ${capacity} spaces`);
    }

    const disabled = attr(lot, "num_disabled");
    if (disabled && disabled !== "0") {
      lines.push(`    Disabled spaces: ${disabled}`);
    }

    const covered = attr(lot, "covered");
    if (covered) lines.push(`    Covered: ${covered}`);

    const status = attr(lot, "status_chenyon");
    if (status) lines.push(`    Status: ${status}`);

    const dayRate = attr(lot, "taarif_yom");
    if (dayRate) lines.push(`    Day rate: ${dayRate}`);

    const nightRate = attr(lot, "taarif_layla");
    if (nightRate) lines.push(`    Night rate: ${nightRate}`);

    const dailyRate = attr(lot, "taarif_yomi");
    if (dailyRate) lines.push(`    Daily rate: ${dailyRate}`);

    const hours = attr(lot, "chalon_zman_chenyon_patoach");
    if (hours) lines.push(`    Hours: ${hours}`);

    const notes = attr(lot, "hearot_taarif");
    if (notes) lines.push(`    Notes: ${notes}`);

    lines.push("");
  }

  lines.push(`Showing ${sorted.length} of ${all.length} results.`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool: get_bike_stations
// ---------------------------------------------------------------------------

export const getBikeStationsSchema = z.object({
  ...LocationSchema.shape,
  radius_km: RadiusSchema,
  limit: LimitSchema,
});

export type GetBikeStationsInput = z.infer<typeof getBikeStationsSchema>;

export async function getBikeStations(
  input: GetBikeStationsInput
): Promise<string> {
  const { longitude, latitude, radius_km, limit } = input;
  const bbox = bboxAroundPoint(longitude, latitude, radius_km);

  const features = await queryLayer({
    layerId: LAYERS.BIKE_STATIONS,
    bbox,
    outFields: [
      "Shem_tachana", "Teur_tachana", "free_bikes", "free_bikesE",
      "free_amudim", "free_amudimE", "shabat", "lon", "lat",
    ],
    resultRecordCount: 50,
  });

  if (features.length === 0) {
    return `No Tel-O-Fun bike stations found within ${radius_km}km of (${latitude}, ${longitude}).`;
  }

  const sorted = sortByDistance(features, longitude, latitude).slice(0, limit);

  const lines: string[] = [
    `Tel-O-Fun bike stations near (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) within ${radius_km}km:`,
    "",
  ];

  for (const station of sorted) {
    const name = attr(station, "Shem_tachana") || "Unnamed station";
    const desc = attr(station, "Teur_tachana");
    const dist = fmtDist(station._distKm);

    const freeBikes = attr(station, "free_bikes");
    const freeBikesE = attr(station, "free_bikesE");
    const freeDocks = attr(station, "free_amudim");
    const freeDocksE = attr(station, "free_amudimE");
    const shabbat = attr(station, "shabat");

    lines.push(`  ${name}${desc && desc !== name ? ` (${desc})` : ""}`);
    lines.push(`    Distance: ${dist}`);

    if (freeBikes !== "-1" && freeBikes) {
      lines.push(`    Available bikes: ${freeBikes}`);
    } else {
      lines.push(`    Available bikes: data unavailable`);
    }

    if (freeBikesE !== "-1" && freeBikesE) {
      lines.push(`    Available e-bikes: ${freeBikesE}`);
    }

    if (freeDocks !== "-1" && freeDocks) {
      lines.push(`    Free docking spots: ${freeDocks}`);
    } else {
      lines.push(`    Free docking spots: data unavailable`);
    }

    if (freeDocksE !== "-1" && freeDocksE) {
      lines.push(`    Free e-bike docks: ${freeDocksE}`);
    }

    if (shabbat) lines.push(`    Shabbat operation: ${shabbat}`);

    const coords = featureCoords(station);
    if (coords) {
      lines.push(`    Location: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);
    }

    lines.push("");
  }

  lines.push(`Showing ${sorted.length} of ${features.length} results.`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool: get_road_closures
// ---------------------------------------------------------------------------

export const getRoadClosuresSchema = z.object({
  ...LocationSchema.shape,
  radius_km: z
    .number()
    .min(0.1)
    .max(10)
    .default(2)
    .describe("Search radius in km (default 2)"),
  limit: LimitSchema,
});

export type GetRoadClosuresInput = z.infer<typeof getRoadClosuresSchema>;

export async function getRoadClosures(
  input: GetRoadClosuresInput
): Promise<string> {
  const { longitude, latitude, radius_km, limit } = input;
  const bbox = bboxAroundPoint(longitude, latitude, radius_km);

  const [lineFeatures, pointFeatures] = await Promise.all([
    queryLayer({
      layerId: LAYERS.ROAD_WORKS,
      bbox,
      outFields: [
        "kablan_name", "kablan_type", "t_ktovet", "mahut_avoda",
        "sivug_yom_layla", "tzimtzum_netivim", "commnets",
        "time_start", "time_end", "date_start", "date_end",
        "avodot_ptuhot",
      ],
      resultRecordCount: 50,
      returnGeometry: true,
    }),
    queryLayer({
      layerId: LAYERS.ROAD_WORKS_POINT,
      bbox,
      outFields: ["*"],
      resultRecordCount: 50,
      returnGeometry: true,
    }),
  ]);

  const all = [...lineFeatures, ...pointFeatures];

  if (all.length === 0) {
    return `No road works or closures found within ${radius_km}km of (${latitude}, ${longitude}).`;
  }

  const limited = all.slice(0, limit);

  const lines: string[] = [
    `Road works and closures near (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) within ${radius_km}km:`,
    "",
  ];

  for (const work of limited) {
    const location = attr(work, "t_ktovet") || "Unknown location";
    const description = attr(work, "mahut_avoda") || "Road work";
    const contractor = attr(work, "kablan_name");
    const contractorType = attr(work, "kablan_type");
    const dayNight = attr(work, "sivug_yom_layla");
    const laneReduction = attr(work, "tzimtzum_netivim");
    const dateStart = attr(work, "date_start");
    const dateEnd = attr(work, "date_end");
    const timeStart = attr(work, "time_start");
    const timeEnd = attr(work, "time_end");
    const status = attr(work, "avodot_ptuhot");
    const comments = attr(work, "commnets");

    lines.push(`  ${location}`);
    lines.push(`    Work: ${description}`);

    if (contractor) {
      const cType = contractorType ? ` (${contractorType})` : "";
      lines.push(`    Contractor: ${contractor}${cType}`);
    }

    if (dateStart || dateEnd) {
      lines.push(`    Dates: ${dateStart || "?"} to ${dateEnd || "?"}`);
    }

    if (timeStart || timeEnd) {
      lines.push(`    Hours: ${timeStart || "?"} - ${timeEnd || "?"}`);
    }

    if (dayNight) lines.push(`    Schedule: ${dayNight}`);
    if (laneReduction) lines.push(`    Lane impact: ${laneReduction}`);
    if (status) lines.push(`    Status: ${status}`);
    if (comments) lines.push(`    Notes: ${comments}`);

    lines.push("");
  }

  lines.push(`Showing ${limited.length} of ${all.length} results.`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool: find_nearby_services
// ---------------------------------------------------------------------------

const ServiceTypeEnum = z.enum([
  "pharmacy",
  "school",
  "park",
  "community_center",
  "culture",
  "playground",
  "medical",
  "health_clinic",
]);

export const findNearbyServicesSchema = z.object({
  ...LocationSchema.shape,
  service_type: ServiceTypeEnum.describe(
    "Type of service to search for: pharmacy, school, park, community_center, culture, playground, medical, health_clinic"
  ),
  radius_km: RadiusSchema,
  limit: LimitSchema,
});

export type FindNearbyServicesInput = z.infer<typeof findNearbyServicesSchema>;

interface ServiceConfig {
  layerId: number;
  nameField: string;
  addressFields: string[];
  extraFields: string[];
  formatExtra: (f: ArcGISFeature) => string[];
}

const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  pharmacy: {
    layerId: LAYERS.PHARMACIES,
    nameField: "shem",
    addressFields: ["shem_rechov"],
    extraFields: [
      "ms_telephone", "open_hours", "activity_hours",
      "is_active", "is_open", "t_herum", "sug_esek",
    ],
    formatExtra: (f) => {
      const lines: string[] = [];
      const phone = attr(f, "ms_telephone");
      if (phone) lines.push(`    Phone: ${phone}`);
      const hours = attr(f, "open_hours") || attr(f, "activity_hours");
      if (hours) lines.push(`    Hours: ${hours}`);
      const isOpen = attr(f, "is_open");
      if (isOpen) lines.push(`    Open now: ${isOpen}`);
      const emergency = attr(f, "t_herum");
      if (emergency) lines.push(`    Emergency service: ${emergency}`);
      const type = attr(f, "sug_esek");
      if (type) lines.push(`    Type: ${type}`);
      return lines;
    },
  },
  school: {
    layerId: LAYERS.SCHOOLS,
    nameField: "shem_mosad",
    addressFields: ["shem_rechov", "ms_bait"],
    extraFields: [
      "t_peilut", "t_shlav_chinuch", "t_zerem", "t_sug_chinuch",
      "me_kita", "ad_kita", "telefon_mosad",
    ],
    formatExtra: (f) => {
      const lines: string[] = [];
      const activity = attr(f, "t_peilut");
      if (activity) lines.push(`    Activity: ${activity}`);
      const stage = attr(f, "t_shlav_chinuch");
      if (stage) lines.push(`    Education stage: ${stage}`);
      const stream = attr(f, "t_zerem");
      if (stream) lines.push(`    Stream: ${stream}`);
      const type = attr(f, "t_sug_chinuch");
      if (type) lines.push(`    Type: ${type}`);
      const fromGrade = attr(f, "me_kita");
      const toGrade = attr(f, "ad_kita");
      if (fromGrade || toGrade) {
        lines.push(`    Grades: ${fromGrade || "?"} to ${toGrade || "?"}`);
      }
      const phone = attr(f, "telefon_mosad");
      if (phone) lines.push(`    Phone: ${phone}`);
      return lines;
    },
  },
  park: {
    layerId: LAYERS.PARKS,
    nameField: "shem_gan",
    addressFields: [],
    extraFields: ["sug_gan", "shetach_gan", "sw_nagish"],
    formatExtra: (f) => {
      const lines: string[] = [];
      const type = attr(f, "sug_gan");
      if (type) lines.push(`    Type: ${type}`);
      const area = attr(f, "shetach_gan");
      if (area && area !== "0") lines.push(`    Area: ${area} sqm`);
      const accessible = attr(f, "sw_nagish");
      if (accessible === "1") lines.push(`    Accessible: Yes`);
      return lines;
    },
  },
  community_center: {
    layerId: LAYERS.COMMUNITY_CENTERS,
    nameField: "shem",
    addressFields: ["shem_rechov", "ms_bait"],
    extraFields: [
      "t_sug_rashi", "t_sug_mishni", "website",
      "Full_Address", "for_senior_citizens",
    ],
    formatExtra: (f) => {
      const lines: string[] = [];
      const mainType = attr(f, "t_sug_rashi");
      if (mainType) lines.push(`    Type: ${mainType}`);
      const subType = attr(f, "t_sug_mishni");
      if (subType) lines.push(`    Sub-type: ${subType}`);
      const website = attr(f, "website");
      if (website) lines.push(`    Website: ${website}`);
      const senior = attr(f, "for_senior_citizens");
      if (senior === "1") lines.push(`    Senior-friendly: Yes`);
      return lines;
    },
  },
  culture: {
    layerId: LAYERS.CULTURE,
    nameField: "NAME",
    addressFields: ["KTOVET"],
    extraFields: [
      "NAME_ENG", "MAIN_TARBOT", "SUG", "OWNER", "PHONE",
      "INTERNET_PAGE", "SAT_OP", "LATE", "status",
    ],
    formatExtra: (f) => {
      const lines: string[] = [];
      const engName = attr(f, "NAME_ENG");
      if (engName) lines.push(`    English name: ${engName}`);
      const domain = attr(f, "MAIN_TARBOT");
      if (domain) lines.push(`    Domain: ${domain}`);
      const venueType = attr(f, "SUG");
      if (venueType) lines.push(`    Venue type: ${venueType}`);
      const owner = attr(f, "OWNER");
      if (owner) lines.push(`    Ownership: ${owner}`);
      const phone = attr(f, "PHONE");
      if (phone) lines.push(`    Phone: ${phone}`);
      const web = attr(f, "INTERNET_PAGE");
      if (web) lines.push(`    Website: ${web}`);
      const shabbat = attr(f, "SAT_OP");
      if (shabbat) lines.push(`    Open Saturday: ${shabbat}`);
      const late = attr(f, "LATE");
      if (late) lines.push(`    Late hours: ${late}`);
      return lines;
    },
  },
  playground: {
    layerId: LAYERS.PLAYGROUNDS,
    nameField: "shem",
    addressFields: ["shem_rechov", "ms_bait"],
    extraFields: ["sug", "sw_nagish"],
    formatExtra: (f) => {
      const lines: string[] = [];
      const type = attr(f, "sug");
      if (type) lines.push(`    Type: ${type}`);
      const accessible = attr(f, "sw_nagish");
      if (accessible === "1") lines.push(`    Accessible: Yes`);
      return lines;
    },
  },
  medical: {
    layerId: LAYERS.MEDICAL,
    nameField: "shem",
    addressFields: ["shem_rechov", "ms_bait"],
    extraFields: ["ms_telephone", "t_sug"],
    formatExtra: (f) => {
      const lines: string[] = [];
      const phone = attr(f, "ms_telephone");
      if (phone) lines.push(`    Phone: ${phone}`);
      const type = attr(f, "t_sug");
      if (type) lines.push(`    Type: ${type}`);
      return lines;
    },
  },
  health_clinic: {
    layerId: LAYERS.HEALTH_CLINICS,
    nameField: "shem",
    addressFields: ["shem_rechov", "ms_bait"],
    extraFields: ["ms_telephone", "shem_kupat_holim"],
    formatExtra: (f) => {
      const lines: string[] = [];
      const phone = attr(f, "ms_telephone");
      if (phone) lines.push(`    Phone: ${phone}`);
      const hmo = attr(f, "shem_kupat_holim");
      if (hmo) lines.push(`    HMO: ${hmo}`);
      return lines;
    },
  },
};

export async function findNearbyServices(
  input: FindNearbyServicesInput
): Promise<string> {
  const { longitude, latitude, service_type, radius_km, limit } = input;
  const config = SERVICE_CONFIGS[service_type];
  const bbox = bboxAroundPoint(longitude, latitude, radius_km);

  const allFields = [
    config.nameField,
    ...config.addressFields,
    ...config.extraFields,
  ];

  const features = await queryLayer({
    layerId: config.layerId,
    bbox,
    outFields: allFields,
    resultRecordCount: 50,
  });

  if (features.length === 0) {
    return `No ${service_type.replace(/_/g, " ")} services found within ${radius_km}km of (${latitude}, ${longitude}).`;
  }

  const sorted = sortByDistance(features, longitude, latitude).slice(0, limit);

  const label = service_type.replace(/_/g, " ");
  const lines: string[] = [
    `${label.charAt(0).toUpperCase() + label.slice(1)} services near (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) within ${radius_km}km:`,
    "",
  ];

  for (const f of sorted) {
    const name = attr(f, config.nameField) || "Unnamed";
    const addressParts = config.addressFields
      .map((field) => attr(f, field))
      .filter(Boolean);
    const address = addressParts.join(" ") || "No address";
    const dist = fmtDist(f._distKm);

    lines.push(`  ${name}`);
    lines.push(`    Address: ${address}`);
    lines.push(`    Distance: ${dist}`);

    const extraLines = config.formatExtra(f);
    lines.push(...extraLines);

    const coords = featureCoords(f);
    if (coords) {
      lines.push(`    Location: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);
    }

    lines.push("");
  }

  lines.push(`Showing ${sorted.length} of ${features.length} results.`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool: get_city_events
// ---------------------------------------------------------------------------

export const getCityEventsSchema = z.object({
  ...LocationSchema.shape,
  radius_km: z
    .number()
    .min(0.5)
    .max(10)
    .default(3)
    .describe("Search radius in km (default 3)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(15)
    .describe("Maximum results (default 15)"),
});

export type GetCityEventsInput = z.infer<typeof getCityEventsSchema>;

export async function getCityEvents(
  input: GetCityEventsInput
): Promise<string> {
  const { longitude, latitude, radius_km, limit } = input;
  const bbox = bboxAroundPoint(longitude, latitude, radius_km);

  // Query culture institutions as event venues
  const venues = await queryLayer({
    layerId: LAYERS.CULTURE,
    bbox,
    outFields: [
      "NAME", "NAME_ENG", "MAIN_TARBOT", "SUG", "KTOVET", "PHONE",
      "INTERNET_PAGE", "SAT_OP", "LATE", "FACEBOOK", "IG",
      "MORE_FAC", "SUM_ALL_THOMIN", "status",
    ],
    resultRecordCount: 50,
  });

  if (venues.length === 0) {
    return `No cultural venues or event locations found within ${radius_km}km of (${latitude}, ${longitude}).`;
  }

  const sorted = sortByDistance(venues, longitude, latitude).slice(0, limit);

  const lines: string[] = [
    `Cultural venues and event locations near (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) within ${radius_km}km:`,
    "",
    "These are active cultural venues that host events, performances, and exhibitions.",
    "Visit their websites or social media pages for current event schedules.",
    "",
  ];

  for (const venue of sorted) {
    const name = attr(venue, "NAME") || "Unnamed venue";
    const engName = attr(venue, "NAME_ENG");
    const venueType = attr(venue, "SUG");
    const domain = attr(venue, "MAIN_TARBOT");
    const address = attr(venue, "KTOVET") || "No address";
    const phone = attr(venue, "PHONE");
    const website = attr(venue, "INTERNET_PAGE");
    const shabbat = attr(venue, "SAT_OP");
    const late = attr(venue, "LATE");
    const facebook = attr(venue, "FACEBOOK");
    const instagram = attr(venue, "IG");
    const facilities = attr(venue, "MORE_FAC");
    const allDomains = attr(venue, "SUM_ALL_THOMIN");
    const status = attr(venue, "status");
    const dist = fmtDist(venue._distKm);

    const displayName = engName ? `${name} (${engName})` : name;
    lines.push(`  ${displayName}`);
    lines.push(`    Address: ${address}`);
    lines.push(`    Distance: ${dist}`);

    if (venueType) lines.push(`    Venue type: ${venueType}`);
    if (domain) lines.push(`    Primary domain: ${domain}`);
    if (allDomains) lines.push(`    All domains: ${allDomains}`);
    if (status) lines.push(`    Status: ${status}`);
    if (phone) lines.push(`    Phone: ${phone}`);
    if (website) lines.push(`    Website: ${website}`);
    if (facebook) lines.push(`    Facebook: ${facebook}`);
    if (instagram) lines.push(`    Instagram: ${instagram}`);
    if (shabbat) lines.push(`    Open Saturday: ${shabbat}`);
    if (late) lines.push(`    Late-night hours: ${late}`);
    if (facilities) lines.push(`    Additional facilities: ${facilities}`);

    lines.push("");
  }

  lines.push(`Showing ${sorted.length} of ${venues.length} venues.`);
  lines.push("");
  lines.push(
    "Tip: Check each venue's website or social media for their current event calendar."
  );
  return lines.join("\n");
}
