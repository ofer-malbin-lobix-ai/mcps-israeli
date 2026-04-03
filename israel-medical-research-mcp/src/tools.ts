import { z } from "zod";
import { pubmedSearch, pubmedSummary } from "./client.js";

// ─── Shared types ────────────────────────────────────────────────────────────

interface ESearchResult {
  esearchresult?: {
    idlist?: string[];
    count?: string;
  };
}

interface AuthorEntry {
  name?: string;
}

interface ArticleSummary {
  uid?: string;
  title?: string;
  authors?: AuthorEntry[];
  source?: string;
  fulljournalname?: string;
  pubdate?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  elocationid?: string;
}

interface ESummaryResult {
  result?: Record<string, unknown> & {
    uids?: string[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildIsraelQuery(parts: {
  query?: string;
  institution?: string;
}): string {
  const terms: string[] = [];

  if (parts.query) {
    terms.push(`(${parts.query}[Title/Abstract])`);
  }

  if (parts.institution) {
    terms.push(`(${parts.institution}[affiliation])`);
  }

  terms.push("(israel[affiliation])");

  return terms.join(" AND ");
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

async function searchAndSummarize(
  term: string,
  maxResults: number,
  searchOptions?: { mindate?: string; maxdate?: string; datetype?: string }
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const searchResult = (await pubmedSearch(term, maxResults, searchOptions)) as ESearchResult;
  const ids = searchResult.esearchresult?.idlist ?? [];

  if (ids.length === 0) {
    return {
      content: [{ type: "text", text: JSON.stringify({ total: 0, papers: [] }, null, 2) }],
    };
  }

  const summaryResult = (await pubmedSummary(ids)) as ESummaryResult;
  const result = summaryResult.result ?? {};

  const papers = ids.map((id) => {
    const article = result[id] as ArticleSummary | undefined;
    if (!article) {
      return { pmid: id, title: "Unknown" };
    }
    return {
      pmid: id,
      title: article.title ?? "Unknown",
      authors: (article.authors ?? []).map((a) => a.name).filter(Boolean),
      journal: article.fulljournalname ?? article.source ?? "Unknown",
      pubdate: article.pubdate ?? "Unknown",
      doi: article.elocationid ?? null,
    };
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ total: ids.length, papers }, null, 2),
      },
    ],
  };
}

// ─── Tool definitions ────────────────────────────────────────────────────────

export const searchPapersSchema = z.object({
  query: z.string().describe("Search query text, e.g. 'diabetes treatment'"),
  institution: z
    .string()
    .optional()
    .describe("Optional Israeli institution, e.g. 'Hadassah', 'Sheba', 'Weizmann'"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return (default 20)"),
});

export async function searchPapers(
  args: z.infer<typeof searchPapersSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const term = buildIsraelQuery({ query: args.query, institution: args.institution });
  return searchAndSummarize(term, args.max_results);
}

export const getPaperDetailsSchema = z.object({
  pmid: z.union([z.string(), z.number()]).describe("PubMed ID of the paper"),
});

export async function getPaperDetails(
  args: z.infer<typeof getPaperDetailsSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const id = String(args.pmid);
  const summaryResult = (await pubmedSummary([id])) as ESummaryResult;
  const result = summaryResult.result ?? {};
  const article = result[id] as ArticleSummary | undefined;

  if (!article) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: `No paper found for PMID ${id}` }) }],
    };
  }

  const details = {
    pmid: id,
    title: article.title ?? "Unknown",
    authors: (article.authors ?? []).map((a) => a.name).filter(Boolean),
    journal: article.fulljournalname ?? article.source ?? "Unknown",
    pubdate: article.pubdate ?? "Unknown",
    volume: article.volume ?? null,
    issue: article.issue ?? null,
    pages: article.pages ?? null,
    doi: article.elocationid ?? null,
    pubmed_url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
  };
}

export const searchByInstitutionSchema = z.object({
  institution: z
    .string()
    .describe(
      "Israeli institution name, e.g. 'Hadassah Medical Center', 'Technion', 'Tel Aviv University'"
    ),
  topic: z.string().optional().describe("Optional topic to filter by"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return (default 20)"),
});

export async function searchByInstitution(
  args: z.infer<typeof searchByInstitutionSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const term = buildIsraelQuery({ query: args.topic, institution: args.institution });
  return searchAndSummarize(term, args.max_results);
}

export const getRecentPapersSchema = z.object({
  days_back: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Number of days to look back (default 30)"),
  topic: z.string().optional().describe("Optional topic to filter by"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return (default 20)"),
});

export async function getRecentPapers(
  args: z.infer<typeof getRecentPapersSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const now = new Date();
  const past = new Date(now.getTime() - args.days_back * 24 * 60 * 60 * 1000);

  const term = buildIsraelQuery({ query: args.topic });

  return searchAndSummarize(term, args.max_results, {
    mindate: formatDate(past),
    maxdate: formatDate(now),
    datetype: "pdat",
  });
}

export const countPapersSchema = z.object({
  query: z.string().optional().describe("Optional search query text"),
  institution: z
    .string()
    .optional()
    .describe("Optional Israeli institution name"),
});

export async function countPapers(
  args: z.infer<typeof countPapersSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const term = buildIsraelQuery({ query: args.query, institution: args.institution });

  const searchResult = (await pubmedSearch(term, 0, { rettype: "count" })) as ESearchResult;
  const count = searchResult.esearchresult?.count ?? "0";

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            query: term,
            total_count: parseInt(count, 10),
          },
          null,
          2
        ),
      },
    ],
  };
}
