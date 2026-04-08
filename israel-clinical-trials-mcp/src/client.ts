/**
 * ClinicalTrials.gov v2 API client filtered to Israel.
 */

const BASE_URL = "https://clinicaltrials.gov/api/v2";

// Simple rate limiter: max 5 requests per second
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 200; // 1000ms / 5 = 200ms between requests

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ── Type definitions for the ClinicalTrials.gov v2 API response ──

export interface StudyResponse {
  studies: Study[];
  nextPageToken?: string;
}

export interface Study {
  protocolSection: ProtocolSection;
}

export interface ProtocolSection {
  identificationModule: IdentificationModule;
  statusModule: StatusModule;
  descriptionModule?: DescriptionModule;
  conditionsModule?: ConditionsModule;
  contactsLocationsModule?: ContactsLocationsModule;
  eligibilityModule?: EligibilityModule;
  designModule?: DesignModule;
  armsInterventionsModule?: ArmsInterventionsModule;
  sponsorCollaboratorsModule?: SponsorCollaboratorsModule;
}

export interface IdentificationModule {
  nctId: string;
  orgStudyIdInfo?: { id: string };
  organization?: { fullName: string; class: string };
  briefTitle: string;
  officialTitle?: string;
}

export interface StatusModule {
  overallStatus: string;
  startDateStruct?: DateStruct;
  primaryCompletionDateStruct?: DateStruct;
  completionDateStruct?: DateStruct;
  lastUpdatePostDateStruct?: DateStruct;
}

export interface DateStruct {
  date: string;
  type?: string;
}

export interface DescriptionModule {
  briefSummary?: string;
  detailedDescription?: string;
}

export interface ConditionsModule {
  conditions?: string[];
  keywords?: string[];
}

export interface ContactsLocationsModule {
  centralContacts?: Contact[];
  overallOfficials?: Official[];
  locations?: Location[];
}

export interface Contact {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface Official {
  name?: string;
  affiliation?: string;
  role?: string;
}

export interface Location {
  facility?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  status?: string;
  contacts?: Contact[];
  geoPoint?: { lat: number; lon: number };
}

export interface EligibilityModule {
  eligibilityCriteria?: string;
  sex?: string;
  minimumAge?: string;
  maximumAge?: string;
  healthyVolunteers?: string;
}

export interface DesignModule {
  studyType?: string;
  phases?: string[];
  designInfo?: {
    allocation?: string;
    interventionModel?: string;
    primaryPurpose?: string;
    maskingInfo?: { masking?: string };
  };
  enrollmentInfo?: { count?: number; type?: string };
}

export interface ArmsInterventionsModule {
  armGroups?: ArmGroup[];
  interventions?: Intervention[];
}

export interface ArmGroup {
  label?: string;
  type?: string;
  description?: string;
}

export interface Intervention {
  type?: string;
  name?: string;
  description?: string;
  armGroupLabels?: string[];
}

export interface SponsorCollaboratorsModule {
  leadSponsor?: { name: string; class: string };
  collaborators?: { name: string; class: string }[];
}

// ── API functions ──

export interface SearchParams {
  query?: string;
  condition?: string;
  intervention?: string;
  status?: string;
  facility?: string;
  limit?: number;
  sort?: string;
}

export async function searchStudies(params: SearchParams): Promise<StudyResponse> {
  await rateLimit();

  const url = new URL(`${BASE_URL}/studies`);

  // Always filter to Israel
  if (params.facility) {
    url.searchParams.set("query.locn", `${params.facility} Israel`);
  } else {
    url.searchParams.set("query.locn", "Israel");
  }

  if (params.query) {
    url.searchParams.set("query.term", params.query);
  }
  if (params.condition) {
    url.searchParams.set("query.cond", params.condition);
  }
  if (params.intervention) {
    url.searchParams.set("query.intr", params.intervention);
  }
  if (params.status) {
    url.searchParams.set("filter.overallStatus", params.status);
  }

  const limit = Math.min(params.limit ?? 10, 50);
  url.searchParams.set("pageSize", String(limit));

  if (params.sort) {
    url.searchParams.set("sort", params.sort);
  }

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`ClinicalTrials.gov API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as StudyResponse;
}

export async function getStudyById(nctId: string): Promise<Study> {
  await rateLimit();

  const url = `${BASE_URL}/studies/${encodeURIComponent(nctId)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`ClinicalTrials.gov API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as Study;
}
