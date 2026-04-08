/**
 * Tool definitions and handlers for the Israel Mental Health MCP server.
 */

import { z } from "zod";
import {
  datastoreSearch,
  RESOURCE_IDS,
  QUALITY_METRIC_LABELS,
  type QualityMetric,
} from "./client.js";

// ---------- Helpers ----------

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "אין נתונים";
  return String(value);
}

function formatClinic(record: Record<string, unknown>, detailed = false): string {
  const lines: string[] = [
    `שם מרפאה: ${formatValue(record.clinic_name)}`,
    `קופת חולים: ${formatValue(record.HMO)}`,
    `עיר: ${formatValue(record.city)}`,
    `כתובת: ${formatValue(record.street)}`,
    `טלפון: ${formatValue(record.phone)}`,
    `קהל יעד: ${formatValue(record.audience)}`,
    "",
    "זמני המתנה:",
    `  אינטייק: ${formatValue(record.intake_wait)}`,
    `  מעקב פסיכיאטרי: ${formatValue(record.follow_up_wait)}`,
    `  טיפול פרטני: ${formatValue(record.individual_therapy_wait)}`,
    `  טיפול קבוצתי: ${formatValue(record.group_therapy_wait)}`,
  ];

  if (detailed) {
    lines.push(
      "",
      `בעלות: ${formatValue(record.ownership)}`,
      `סוגי התערבות: ${formatValue(record.intervention_type)}`,
      `התמחויות: ${formatValue(record.specialization)}`
    );
  }

  return lines.join("\n");
}

function formatClinicList(
  records: Record<string, unknown>[],
  total: number,
  detailed = false
): string {
  if (records.length === 0) {
    return "לא נמצאו מרפאות התואמות את החיפוש.";
  }

  const header = `נמצאו ${total} תוצאות (מוצגות ${records.length}):`;
  const clinics = records.map(
    (r, i) => `--- מרפאה ${i + 1} ---\n${formatClinic(r, detailed)}`
  );

  return [header, "", ...clinics].join("\n");
}

function formatQualityRecords(
  records: Record<string, unknown>[],
  metricLabel: string
): string {
  if (records.length === 0) {
    return `לא נמצאו נתוני איכות עבור: ${metricLabel}`;
  }

  const header = `מדד איכות: ${metricLabel}\nמספר רשומות: ${records.length}\n`;

  const rows = records.map((record, i) => {
    const fields = Object.entries(record)
      .filter(([key]) => key !== "_id")
      .map(([key, value]) => `  ${key}: ${formatValue(value)}`)
      .join("\n");
    return `--- רשומה ${i + 1} ---\n${fields}`;
  });

  return [header, ...rows].join("\n");
}

// ---------- Tool Definitions ----------

export const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

export const findClinicsSchema = z.object({
  city: z.string().optional().describe("City name in Hebrew (e.g. ירושלים, תל אביב)"),
  hmo: z.string().optional().describe("HMO name in Hebrew (e.g. כללית, מכבי, לאומית, מאוחדת)"),
  audience: z.string().optional().describe("Target audience (e.g. מבוגרים, ילדים ונוער)"),
  limit: z.number().min(1).max(100).default(20).describe("Max results to return (default 20)"),
});

export async function findClinics(
  params: z.infer<typeof findClinicsSchema>
): Promise<string> {
  const filters: Record<string, string> = {};
  if (params.city) filters.city = params.city;
  if (params.hmo) filters.HMO = params.hmo;
  if (params.audience) filters.audience = params.audience;

  const data = await datastoreSearch({
    resource_id: RESOURCE_IDS.clinics,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    limit: params.limit,
  });

  return formatClinicList(data.result.records, data.result.total);
}

export const getClinicDetailsSchema = z.object({
  clinic_name: z.string().describe("Clinic name in Hebrew"),
});

export async function getClinicDetails(
  params: z.infer<typeof getClinicDetailsSchema>
): Promise<string> {
  // Try exact filter first
  let data = await datastoreSearch({
    resource_id: RESOURCE_IDS.clinics,
    filters: { clinic_name: params.clinic_name },
    limit: 5,
  });

  // Fall back to full-text search if no exact match
  if (data.result.records.length === 0) {
    data = await datastoreSearch({
      resource_id: RESOURCE_IDS.clinics,
      q: params.clinic_name,
      limit: 5,
    });
  }

  if (data.result.records.length === 0) {
    return `לא נמצאה מרפאה בשם "${params.clinic_name}". נסה לחפש עם שם חלקי או לחפש לפי עיר.`;
  }

  return formatClinicList(data.result.records, data.result.total, true);
}

export const findByTherapySchema = z.object({
  therapy: z
    .string()
    .describe("Therapy type to search for (e.g. cbt, dbt, טראומה, פסיכודינמי)"),
  city: z.string().optional().describe("Optional city filter in Hebrew"),
});

export async function findByTherapy(
  params: z.infer<typeof findByTherapySchema>
): Promise<string> {
  const filters: Record<string, string> = {};
  if (params.city) filters.city = params.city;

  const data = await datastoreSearch({
    resource_id: RESOURCE_IDS.clinics,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    q: params.therapy,
    limit: 30,
  });

  // Post-filter: only include records where intervention_type mentions the therapy
  const therapyLower = params.therapy.toLowerCase();
  const filtered = data.result.records.filter((r) => {
    const interventionType = String(r.intervention_type ?? "").toLowerCase();
    return interventionType.includes(therapyLower);
  });

  if (filtered.length === 0) {
    return "No clinics found offering the specified therapy. Try broadening your search.";
  }

  return formatClinicList(filtered, filtered.length, true);
}

export const findBySpecializationSchema = z.object({
  specialization: z
    .string()
    .describe(
      "Specialization to search for (e.g. הפרעות אכילה, התמכרויות, PTSD, חרדה, דיכאון)"
    ),
  city: z.string().optional().describe("Optional city filter in Hebrew"),
});

export async function findBySpecialization(
  params: z.infer<typeof findBySpecializationSchema>
): Promise<string> {
  const filters: Record<string, string> = {};
  if (params.city) filters.city = params.city;

  const data = await datastoreSearch({
    resource_id: RESOURCE_IDS.clinics,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    q: params.specialization,
    limit: 30,
  });

  // Post-filter: only include records where specialization mentions the term
  const specLower = params.specialization.toLowerCase();
  const filtered = data.result.records.filter((r) => {
    const spec = String(r.specialization ?? "").toLowerCase();
    return spec.includes(specLower);
  });

  if (filtered.length === 0) {
    return "No clinics found offering the specified specialization. Try broadening your search.";
  }

  return formatClinicList(filtered, filtered.length, true);
}

export const getQualityMetricsSchema = z.object({
  metric: z
    .enum([
      "treatment_plan",
      "discharge_summary",
      "community_appointment",
      "long_term_plan",
      "lipid_profile",
    ])
    .describe(
      "Quality metric to retrieve: treatment_plan (documented plan within 5 days), " +
        "discharge_summary (detailed discharge summary), " +
        "community_appointment (community appointment for discharged patients), " +
        "long_term_plan (treatment plan in long-term hospitalization), " +
        "lipid_profile (lipid profile measurement)"
    ),
});

export async function getQualityMetrics(
  params: z.infer<typeof getQualityMetricsSchema>
): Promise<string> {
  const metric = params.metric as QualityMetric;
  const resourceId = RESOURCE_IDS.quality[metric];
  const label = QUALITY_METRIC_LABELS[metric];

  const data = await datastoreSearch({
    resource_id: resourceId,
    limit: 50,
  });

  return formatQualityRecords(data.result.records, label);
}
