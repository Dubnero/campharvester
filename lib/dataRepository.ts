import { prepareCampForSupabase } from "./campStorage";
import { prepareProviderForSupabase } from "./providerStorage";
import { supabase, getSupabaseConfigError } from "./supabase";
import type { Camp, Provider } from "./types";

export type DataSource = "supabase" | "localStorage" | "mock";
export type RepositoryResult<T> = { data: T; error: string | null };
export type CampImportSummary = { inserted: number; updated: number };
export type CampImportResult = RepositoryResult<Camp[]> & { summary: CampImportSummary };

const providerColumns = [
  "provider_id",
  "provider_name",
  "website",
  "source_url",
  "primary_email",
  "secondary_email",
  "primary_phone",
  "secondary_phone",
  "description",
  "primary_county",
  "activity_category",
  "provider_type",
  "status",
  "verified",
  "featured",
  "last_checked",
  "notes",
  "created_at",
] as const satisfies readonly (keyof Provider)[];

const campColumns = [
  "camp_id",
  "provider_id",
  "camp_name",
  "county",
  "town",
  "address",
  "eircode",
  "activity_type",
  "holiday_type",
  "age_min",
  "age_max",
  "start_date",
  "end_date",
  "start_time",
  "end_time",
  "half_day_or_full_day",
  "price",
  "booking_url",
  "status",
  "verified",
  "featured",
  "source_url",
  "last_checked",
  "created_at",
] as const satisfies readonly (keyof Camp)[];

const providerSelect = providerColumns.join(", ");
const campSelect = campColumns.join(", ");

type ProviderRow = Pick<Provider, (typeof providerColumns)[number]>;
type CampRow = Pick<Camp, (typeof campColumns)[number]>;

function configError() {
  return getSupabaseConfigError();
}

function toProviderRow(provider: Provider): ProviderRow {
  return {
    provider_id: provider.provider_id,
    provider_name: provider.provider_name,
    website: provider.website,
    source_url: provider.source_url,
    primary_email: provider.primary_email,
    secondary_email: provider.secondary_email,
    primary_phone: provider.primary_phone,
    secondary_phone: provider.secondary_phone,
    description: provider.description,
    primary_county: provider.primary_county,
    activity_category: provider.activity_category,
    provider_type: provider.provider_type,
    status: provider.status,
    verified: provider.verified,
    featured: provider.featured,
    last_checked: provider.last_checked,
    notes: provider.notes,
    created_at: provider.created_at,
  };
}

function toCampRow(camp: Camp): CampRow {
  return {
    camp_id: camp.camp_id,
    provider_id: camp.provider_id,
    camp_name: camp.camp_name,
    county: camp.county,
    town: camp.town,
    address: camp.address,
    eircode: camp.eircode,
    activity_type: camp.activity_type,
    holiday_type: camp.holiday_type,
    age_min: camp.age_min,
    age_max: camp.age_max,
    start_date: camp.start_date,
    end_date: camp.end_date,
    start_time: camp.start_time,
    end_time: camp.end_time,
    half_day_or_full_day: camp.half_day_or_full_day,
    price: camp.price,
    booking_url: camp.booking_url,
    status: camp.status,
    verified: camp.verified,
    featured: camp.featured,
    source_url: camp.source_url,
    last_checked: camp.last_checked,
    created_at: camp.created_at,
  };
}

export async function getProviders(): Promise<RepositoryResult<Provider[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };

  const { data, error } = await supabase
    .from("providers")
    .select(providerSelect)
    .order("provider_name", { ascending: true });
  return {
    data: (data ?? []) as unknown as Provider[],
    error: error?.message ?? null,
  };
}

export async function upsertProviders(
  providers: Provider[],
): Promise<RepositoryResult<Provider[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };

  const providerRows = providers.map((provider) =>
    toProviderRow(prepareProviderForSupabase(provider)),
  );
  const { data, error } = await supabase
    .from("providers")
    .upsert(providerRows, { onConflict: "provider_id" })
    .select(providerSelect);
  return {
    data: (data ?? []) as unknown as Provider[],
    error: error?.message ?? null,
  };
}

export async function getCamps(): Promise<RepositoryResult<Camp[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };

  const { data, error } = await supabase
    .from("camps")
    .select(campSelect)
    .order("start_date", { ascending: true });
  return {
    data: (data ?? []) as unknown as Camp[],
    error: error?.message ?? null,
  };
}

export function mergeCampForUpdate(existing: Camp, extracted: Camp): Camp {
  return {
    ...extracted,
    camp_id: existing.camp_id,
    status: existing.status,
    created_at: existing.created_at,
  };
}

export function splitCampsByExisting(
  camps: Camp[],
  existingCamps: Camp[],
): { insertRows: Camp[]; updateRows: Camp[] } {
  const existingById = new Map(existingCamps.map((camp) => [camp.camp_id, camp]));
  return camps.reduce<{ insertRows: Camp[]; updateRows: Camp[] }>((groups, camp) => {
    const existing = existingById.get(camp.camp_id);
    if (existing) groups.updateRows.push(mergeCampForUpdate(existing, camp));
    else groups.insertRows.push(camp);
    return groups;
  }, { insertRows: [], updateRows: [] });
}

export async function importCampsWithUpdates(
  camps: Camp[],
): Promise<CampImportResult> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig, summary: { inserted: 0, updated: 0 } };
  if (camps.length === 0) return { data: [], error: null, summary: { inserted: 0, updated: 0 } };

  const campIds = camps.map((camp) => camp.camp_id);
  const { data: existingData, error: lookupError } = await supabase
    .from("camps")
    .select(campSelect)
    .in("camp_id", campIds);
  if (lookupError) return { data: [], error: lookupError.message, summary: { inserted: 0, updated: 0 } };

  const { insertRows, updateRows } = splitCampsByExisting(
    camps.map((camp) => prepareCampForSupabase(camp) as Camp),
    (existingData ?? []) as unknown as Camp[],
  );
  const persisted: Camp[] = [];
  const errors: string[] = [];

  if (insertRows.length) {
    const { data, error } = await supabase
      .from("camps")
      .insert(insertRows.map(toCampRow))
      .select(campSelect);
    if (error) errors.push(error.message);
    persisted.push(...((data ?? []) as unknown as Camp[]));
  }

  for (const updateRow of updateRows) {
    const row = toCampRow(updateRow);
    const { data, error } = await supabase
      .from("camps")
      .update(row)
      .eq("camp_id", updateRow.camp_id)
      .select(campSelect);
    if (error) errors.push(error.message);
    persisted.push(...((data ?? []) as unknown as Camp[]));
  }

  return {
    data: persisted,
    error: errors.length ? errors.join(" ") : null,
    summary: { inserted: insertRows.length, updated: updateRows.length },
  };
}

export async function upsertCamps(
  camps: Camp[],
): Promise<RepositoryResult<Camp[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };

  const campRows = camps.map((camp) =>
    toCampRow(prepareCampForSupabase(camp) as Camp),
  );
  const { data, error } = await supabase
    .from("camps")
    .upsert(campRows, { onConflict: "camp_id" })
    .select(campSelect);
  return {
    data: (data ?? []) as unknown as Camp[],
    error: error?.message ?? null,
  };
}

export async function updateCamp(
  camp: Camp,
): Promise<RepositoryResult<Camp[]>> {
  return upsertCamps([camp]);
}

export async function updateCampStatuses(
  campIds: string[],
  status: Camp["status"],
): Promise<RepositoryResult<Camp[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };
  if (campIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from("camps")
    .update({ status })
    .in("camp_id", campIds)
    .select(campSelect);
  return {
    data: (data ?? []) as unknown as Camp[],
    error: error?.message ?? null,
  };
}
