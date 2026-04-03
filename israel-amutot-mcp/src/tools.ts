import { z } from "zod";
import { datastoreSearch } from "./client.js";

// Field name constants (Hebrew column names from data.gov.il)
const FIELDS = {
  regNumber: "מספר עמותה",
  regDate: "תאריך רישום עמותה",
  nameHe: "שם עמותה בעברית",
  nameEn: "שם עמותה באנגלית",
  statusDate: "תאריך עדכון סטטוס",
  status: "סטטוס עמותה",
  activityClass: "סיווג פעילות ענפי",
  secondaryActivity: "תחום פעילות משני",
  lastFinancialYear: "שנת דיווח דוח כספי אחרון",
  revenue: "מחזור כספי (הכנסות)",
  totalExpenses: "סך הוצאות העמותה",
  volunteers: "כמות מתנדבים",
  employees: "כמות עובדים",
  members: "מספר חברי עמותה",
  activityRegions: "איזורי פעילות",
  lastReportYear: "שנת דיווח אחרונה",
  city: "כתובת - ישוב",
  street: "כתובת - רחוב",
  zipCode: "כתובת - מיקוד",
  goals: "מטרות עמותה",
} as const;

// Summary fields returned for search results
const SUMMARY_FIELDS = [
  FIELDS.regNumber,
  FIELDS.nameHe,
  FIELDS.nameEn,
  FIELDS.status,
  FIELDS.activityClass,
  FIELDS.city,
  FIELDS.regDate,
];

function formatRecord(record: Record<string, unknown>): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "_id") continue;
    if (value !== null && value !== undefined && value !== "") {
      formatted[key] = value;
    }
  }
  return formatted;
}

function formatResults(
  records: Record<string, unknown>[],
  total: number
): string {
  if (records.length === 0) {
    return `No results found. Total matching: ${total}`;
  }

  const formatted = records.map(formatRecord);
  return JSON.stringify({ total, count: formatted.length, records: formatted }, null, 2);
}

// --- Tool Definitions ---

export const searchAmutaSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Search text (Hebrew or English name)"),
  number: z
    .number()
    .int()
    .optional()
    .describe("Registration number (starts with 58)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Max results to return (default 10, max 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default 0)"),
});

export async function searchAmuta(
  args: z.infer<typeof searchAmutaSchema>
): Promise<string> {
  if (!args.query && !args.number) {
    return "Error: Provide either a search query (text) or a registration number.";
  }

  if (args.number) {
    const result = await datastoreSearch({
      filters: { [FIELDS.regNumber]: args.number },
      limit: 1,
    });
    return formatResults(result.result.records, result.result.total);
  }

  const result = await datastoreSearch({
    q: args.query,
    fields: SUMMARY_FIELDS,
    limit: args.limit,
    offset: args.offset,
  });
  return formatResults(result.result.records, result.result.total);
}

export const getAmutaDetailsSchema = z.object({
  registration_number: z
    .number()
    .int()
    .describe("Amuta registration number (starts with 58)"),
});

export async function getAmutaDetails(
  args: z.infer<typeof getAmutaDetailsSchema>
): Promise<string> {
  const result = await datastoreSearch({
    filters: { [FIELDS.regNumber]: args.registration_number },
    limit: 1,
  });

  if (result.result.records.length === 0) {
    return `No amuta found with registration number ${args.registration_number}`;
  }

  const record = formatRecord(result.result.records[0]);
  return JSON.stringify(record, null, 2);
}

export const searchByActivitySchema = z.object({
  activity_type: z
    .string()
    .describe("Activity classification in Hebrew (e.g. 'חינוך', 'בריאות')"),
  city: z
    .string()
    .optional()
    .describe("Filter by city name in Hebrew (optional)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Max results to return (default 10, max 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default 0)"),
});

export async function searchByActivity(
  args: z.infer<typeof searchByActivitySchema>
): Promise<string> {
  const filters: Record<string, string> = {
    [FIELDS.activityClass]: args.activity_type,
  };
  if (args.city) {
    filters[FIELDS.city] = args.city;
  }

  const result = await datastoreSearch({
    filters,
    fields: SUMMARY_FIELDS,
    limit: args.limit,
    offset: args.offset,
  });
  return formatResults(result.result.records, result.result.total);
}

export const getFinancialInfoSchema = z.object({
  registration_number: z
    .number()
    .int()
    .describe("Amuta registration number (starts with 58)"),
});

export async function getFinancialInfo(
  args: z.infer<typeof getFinancialInfoSchema>
): Promise<string> {
  const financialFields = [
    FIELDS.regNumber,
    FIELDS.nameHe,
    FIELDS.nameEn,
    FIELDS.lastFinancialYear,
    FIELDS.revenue,
    FIELDS.totalExpenses,
    FIELDS.volunteers,
    FIELDS.employees,
    FIELDS.members,
    FIELDS.lastReportYear,
  ];

  const result = await datastoreSearch({
    filters: { [FIELDS.regNumber]: args.registration_number },
    fields: financialFields,
    limit: 1,
  });

  if (result.result.records.length === 0) {
    return `No amuta found with registration number ${args.registration_number}`;
  }

  const record = formatRecord(result.result.records[0]);
  return JSON.stringify(record, null, 2);
}

export const countAmutotSchema = z.object({
  status: z
    .string()
    .optional()
    .describe("Filter by status in Hebrew (e.g. 'רשומה', 'מחוסלת')"),
  activity_type: z
    .string()
    .optional()
    .describe("Filter by activity classification in Hebrew"),
  city: z
    .string()
    .optional()
    .describe("Filter by city name in Hebrew"),
});

export async function countAmutot(
  args: z.infer<typeof countAmutotSchema>
): Promise<string> {
  const filters: Record<string, string> = {};
  if (args.status) {
    filters[FIELDS.status] = args.status;
  }
  if (args.activity_type) {
    filters[FIELDS.activityClass] = args.activity_type;
  }
  if (args.city) {
    filters[FIELDS.city] = args.city;
  }

  const result = await datastoreSearch({
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    limit: 0,
  });

  const response: Record<string, unknown> = {
    total: result.result.total,
  };
  if (Object.keys(filters).length > 0) {
    response.filters = filters;
  }

  return JSON.stringify(response, null, 2);
}
