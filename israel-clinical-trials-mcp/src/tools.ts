/**
 * Tool definitions and handlers for the Israel Clinical Trials MCP server.
 */

import { z } from "zod";
import { searchStudies, getStudyById, type Study, type Location } from "./client.js";

// ── Formatting helpers ──

function trialLink(nctId: string): string {
  return `https://clinicaltrials.gov/study/${nctId}`;
}

function formatStudySummary(study: Study): string {
  const id = study.protocolSection.identificationModule;
  const status = study.protocolSection.statusModule;
  const conditions = study.protocolSection.conditionsModule?.conditions ?? [];
  const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor;
  const phases = study.protocolSection.designModule?.phases ?? [];
  const startDate = status.startDateStruct?.date ?? "N/A";
  const completionDate =
    status.primaryCompletionDateStruct?.date ??
    status.completionDateStruct?.date ??
    "N/A";

  const lines = [
    `## ${id.briefTitle}`,
    "",
    `- **NCT ID**: [${id.nctId}](${trialLink(id.nctId)})`,
    `- **Status**: ${status.overallStatus}`,
    `- **Conditions**: ${conditions.length > 0 ? conditions.join(", ") : "N/A"}`,
    `- **Phases**: ${phases.length > 0 ? phases.join(", ") : "N/A"}`,
    `- **Sponsor**: ${sponsor ? `${sponsor.name} (${sponsor.class})` : "N/A"}`,
    `- **Start date**: ${startDate}`,
    `- **Est. completion**: ${completionDate}`,
  ];

  return lines.join("\n");
}

function formatStudyDetails(study: Study): string {
  const ps = study.protocolSection;
  const id = ps.identificationModule;
  const status = ps.statusModule;
  const desc = ps.descriptionModule;
  const conditions = ps.conditionsModule;
  const eligibility = ps.eligibilityModule;
  const design = ps.designModule;
  const interventions = ps.armsInterventionsModule?.interventions ?? [];
  const sponsor = ps.sponsorCollaboratorsModule;
  const locations = ps.contactsLocationsModule?.locations ?? [];
  const israelLocations = locations.filter(
    (loc) => loc.country?.toLowerCase() === "israel"
  );

  const sections: string[] = [];

  // Header
  sections.push(`# ${id.briefTitle}`);
  sections.push("");
  if (id.officialTitle && id.officialTitle !== id.briefTitle) {
    sections.push(`**Official title**: ${id.officialTitle}`);
    sections.push("");
  }
  sections.push(`**NCT ID**: [${id.nctId}](${trialLink(id.nctId)})`);
  sections.push(`**Status**: ${status.overallStatus}`);
  sections.push(
    `**Start date**: ${status.startDateStruct?.date ?? "N/A"}`
  );
  sections.push(
    `**Est. completion**: ${status.primaryCompletionDateStruct?.date ?? status.completionDateStruct?.date ?? "N/A"}`
  );
  sections.push("");

  // Sponsor
  if (sponsor?.leadSponsor) {
    sections.push(`## Sponsor`);
    sections.push(
      `${sponsor.leadSponsor.name} (${sponsor.leadSponsor.class})`
    );
    if (sponsor.collaborators && sponsor.collaborators.length > 0) {
      sections.push(
        `**Collaborators**: ${sponsor.collaborators.map((c) => c.name).join(", ")}`
      );
    }
    sections.push("");
  }

  // Design
  if (design) {
    sections.push(`## Study Design`);
    sections.push(`- **Type**: ${design.studyType ?? "N/A"}`);
    sections.push(
      `- **Phases**: ${design.phases?.join(", ") ?? "N/A"}`
    );
    if (design.enrollmentInfo?.count) {
      sections.push(
        `- **Enrollment**: ${design.enrollmentInfo.count} (${design.enrollmentInfo.type ?? ""})`
      );
    }
    if (design.designInfo) {
      const di = design.designInfo;
      if (di.allocation) sections.push(`- **Allocation**: ${di.allocation}`);
      if (di.interventionModel)
        sections.push(`- **Model**: ${di.interventionModel}`);
      if (di.primaryPurpose)
        sections.push(`- **Purpose**: ${di.primaryPurpose}`);
      if (di.maskingInfo?.masking)
        sections.push(`- **Masking**: ${di.maskingInfo.masking}`);
    }
    sections.push("");
  }

  // Conditions
  if (conditions?.conditions && conditions.conditions.length > 0) {
    sections.push(`## Conditions`);
    sections.push(conditions.conditions.join(", "));
    sections.push("");
  }

  // Description
  if (desc?.briefSummary) {
    sections.push(`## Summary`);
    sections.push(desc.briefSummary);
    sections.push("");
  }
  if (desc?.detailedDescription) {
    sections.push(`## Detailed Description`);
    sections.push(desc.detailedDescription);
    sections.push("");
  }

  // Interventions
  if (interventions.length > 0) {
    sections.push(`## Interventions`);
    for (const intv of interventions) {
      sections.push(
        `- **${intv.name ?? "Unnamed"}** (${intv.type ?? "N/A"}): ${intv.description ?? "No description"}`
      );
    }
    sections.push("");
  }

  // Eligibility
  if (eligibility) {
    sections.push(`## Eligibility`);
    sections.push(`- **Sex**: ${eligibility.sex ?? "ALL"}`);
    if (eligibility.minimumAge)
      sections.push(`- **Min age**: ${eligibility.minimumAge}`);
    if (eligibility.maximumAge)
      sections.push(`- **Max age**: ${eligibility.maximumAge}`);
    if (eligibility.healthyVolunteers)
      sections.push(
        `- **Healthy volunteers**: ${eligibility.healthyVolunteers}`
      );
    if (eligibility.eligibilityCriteria) {
      sections.push("");
      sections.push("### Criteria");
      sections.push(eligibility.eligibilityCriteria);
    }
    sections.push("");
  }

  // Israeli locations
  if (israelLocations.length > 0) {
    sections.push(`## Israeli Sites (${israelLocations.length})`);
    for (const loc of israelLocations) {
      const contact = loc.contacts?.[0];
      const contactStr = contact
        ? ` | Contact: ${contact.name ?? ""}${contact.email ? ` (${contact.email})` : ""}${contact.phone ? ` ${contact.phone}` : ""}`
        : "";
      sections.push(
        `- **${loc.facility ?? "Unknown facility"}**, ${loc.city ?? "Unknown city"}${loc.status ? ` [${loc.status}]` : ""}${contactStr}`
      );
    }
    sections.push("");
  }

  return sections.join("\n");
}

function formatLocations(nctId: string, locations: Location[]): string {
  if (locations.length === 0) {
    return `No Israeli sites found for trial ${nctId}.`;
  }

  const lines = [
    `# Israeli Sites for [${nctId}](${trialLink(nctId)})`,
    "",
    `**${locations.length} site(s) in Israel**`,
    "",
  ];

  for (const loc of locations) {
    lines.push(`## ${loc.facility ?? "Unknown facility"}`);
    lines.push(`- **City**: ${loc.city ?? "Unknown"}`);
    if (loc.status) lines.push(`- **Status**: ${loc.status}`);
    if (loc.contacts && loc.contacts.length > 0) {
      for (const contact of loc.contacts) {
        const parts: string[] = [];
        if (contact.name) parts.push(contact.name);
        if (contact.role) parts.push(`(${contact.role})`);
        if (contact.email) parts.push(contact.email);
        if (contact.phone) parts.push(contact.phone);
        lines.push(`- **Contact**: ${parts.join(" ")}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Tool schemas ──

export const searchTrialsSchema = z.object({
  query: z.string().optional().describe("General search term"),
  condition: z.string().optional().describe("Medical condition (e.g. cancer, diabetes)"),
  intervention: z
    .string()
    .optional()
    .describe("Drug or treatment name (e.g. pembrolizumab)"),
  status: z
    .enum([
      "RECRUITING",
      "ACTIVE_NOT_RECRUITING",
      "COMPLETED",
      "NOT_YET_RECRUITING",
    ])
    .optional()
    .describe("Trial status filter"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of results (default 10, max 50)"),
});

export const getTrialDetailsSchema = z.object({
  nct_id: z
    .string()
    .describe('NCT identifier (e.g. "NCT05659901")'),
});

export const findTrialsByHospitalSchema = z.object({
  facility: z
    .string()
    .describe(
      'Hospital or institution name (e.g. "Sheba", "Hadassah", "Ichilov", "Rambam")'
    ),
  status: z
    .enum([
      "RECRUITING",
      "ACTIVE_NOT_RECRUITING",
      "COMPLETED",
      "NOT_YET_RECRUITING",
    ])
    .optional()
    .describe("Trial status filter"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of results (default 10, max 50)"),
});

export const listRecruitingTrialsSchema = z.object({
  condition: z
    .string()
    .optional()
    .describe("Filter by medical condition"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Number of results (default 20, max 50)"),
});

export const getTrialLocationsSchema = z.object({
  nct_id: z
    .string()
    .describe('NCT identifier (e.g. "NCT05659901")'),
});

// ── Tool handlers ──

export async function handleSearchTrials(
  args: z.infer<typeof searchTrialsSchema>
): Promise<string> {
  const data = await searchStudies({
    query: args.query,
    condition: args.condition,
    intervention: args.intervention,
    status: args.status,
    limit: args.limit,
  });

  if (!data.studies || data.studies.length === 0) {
    return "No clinical trials found matching your search criteria in Israel.";
  }

  const header = `# Clinical Trials in Israel (${data.studies.length} result${data.studies.length !== 1 ? "s" : ""})\n`;
  const results = data.studies.map(formatStudySummary).join("\n\n---\n\n");
  return header + "\n" + results;
}

export async function handleGetTrialDetails(
  args: z.infer<typeof getTrialDetailsSchema>
): Promise<string> {
  const study = await getStudyById(args.nct_id);
  return formatStudyDetails(study);
}

export async function handleFindTrialsByHospital(
  args: z.infer<typeof findTrialsByHospitalSchema>
): Promise<string> {
  const data = await searchStudies({
    facility: args.facility,
    status: args.status,
    limit: args.limit,
  });

  if (!data.studies || data.studies.length === 0) {
    return `No clinical trials found at "${args.facility}" in Israel.`;
  }

  const header = `# Clinical Trials at ${args.facility}, Israel (${data.studies.length} result${data.studies.length !== 1 ? "s" : ""})\n`;
  const results = data.studies.map(formatStudySummary).join("\n\n---\n\n");
  return header + "\n" + results;
}

export async function handleListRecruitingTrials(
  args: z.infer<typeof listRecruitingTrialsSchema>
): Promise<string> {
  const data = await searchStudies({
    condition: args.condition,
    status: "RECRUITING",
    limit: args.limit,
    sort: "LastUpdatePostDate:desc",
  });

  if (!data.studies || data.studies.length === 0) {
    const condStr = args.condition ? ` for "${args.condition}"` : "";
    return `No currently recruiting trials found${condStr} in Israel.`;
  }

  const condStr = args.condition ? ` for "${args.condition}"` : "";
  const header = `# Currently Recruiting Trials in Israel${condStr} (${data.studies.length} result${data.studies.length !== 1 ? "s" : ""})\n\nSorted by most recently updated.\n`;
  const results = data.studies.map(formatStudySummary).join("\n\n---\n\n");
  return header + "\n" + results;
}

export async function handleGetTrialLocations(
  args: z.infer<typeof getTrialLocationsSchema>
): Promise<string> {
  const study = await getStudyById(args.nct_id);
  const allLocations =
    study.protocolSection.contactsLocationsModule?.locations ?? [];
  const israelLocations = allLocations.filter(
    (loc) => loc.country?.toLowerCase() === "israel"
  );

  return formatLocations(args.nct_id, israelLocations);
}
