import type { Provider } from "./types";

export const providerStorageKey = "campharvester.providers";

export type ProviderSource = "imported providers" | "mock providers";

export function loadStoredProviders(): Provider[] | null {
  if (typeof window === "undefined") return null;

  try {
    const storedProviders = window.localStorage.getItem(providerStorageKey);
    if (!storedProviders) return null;

    const parsed = JSON.parse(storedProviders);
    if (!Array.isArray(parsed)) return null;

    const providers = parsed.filter(isProviderRecord);
    return providers.length > 0 ? providers : null;
  } catch {
    return null;
  }
}

export function saveStoredProviders(providers: Provider[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(providerStorageKey, JSON.stringify(providers));
}

function isProviderRecord(value: unknown): value is Provider {
  if (!value || typeof value !== "object") return false;
  const provider = value as Partial<Provider>;

  return (
    typeof provider.provider_id === "string" &&
    provider.provider_id.trim().length > 0 &&
    typeof provider.provider_name === "string" &&
    provider.provider_name.trim().length > 0
  );
}
