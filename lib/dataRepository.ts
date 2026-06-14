import { supabase, getSupabaseConfigError } from "./supabase";
import type { Camp, Provider } from "./types";

export type DataSource = "supabase" | "localStorage" | "mock";
export type RepositoryResult<T> = { data: T; error: string | null };

function configError() {
  return getSupabaseConfigError();
}

export async function getProviders(): Promise<RepositoryResult<Provider[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };

  const { data, error } = await supabase.from("providers").select("*").order("provider_name", { ascending: true });
  return { data: (data ?? []) as Provider[], error: error?.message ?? null };
}

export async function upsertProviders(providers: Provider[]): Promise<RepositoryResult<Provider[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };

  const { data, error } = await supabase.from("providers").upsert(providers, { onConflict: "provider_id" }).select("*");
  return { data: (data ?? []) as Provider[], error: error?.message ?? null };
}

export async function getCamps(): Promise<RepositoryResult<Camp[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };

  const { data, error } = await supabase.from("camps").select("*").order("start_date", { ascending: true });
  return { data: (data ?? []) as Camp[], error: error?.message ?? null };
}

export async function upsertCamps(camps: Camp[]): Promise<RepositoryResult<Camp[]>> {
  const missingConfig = configError();
  if (!supabase || missingConfig) return { data: [], error: missingConfig };

  const { data, error } = await supabase.from("camps").upsert(camps, { onConflict: "id" }).select("*");
  return { data: (data ?? []) as Camp[], error: error?.message ?? null };
}
