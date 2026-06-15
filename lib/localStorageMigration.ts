import { loadStoredCamps } from "./campStorage";
import { getCamps, getProviders, upsertCamps, upsertProviders } from "./dataRepository";
import { loadStoredProviders } from "./providerStorage";

export type MigrationResult = {
  migratedProviders: number;
  migratedCamps: number;
  errors: string[];
};

export async function migrateLocalStorageToSupabaseIfEmpty(): Promise<MigrationResult> {
  const errors: string[] = [];
  let migratedProviders = 0;
  let migratedCamps = 0;

  const [remoteProviders, remoteCamps] = await Promise.all([getProviders(), getCamps()]);
  if (remoteProviders.error) errors.push(remoteProviders.error);
  if (remoteCamps.error) errors.push(remoteCamps.error);

  if (!remoteProviders.error && remoteProviders.data.length === 0) {
    const storedProviders = loadStoredProviders() ?? [];
    if (storedProviders.length > 0) {
      const result = await upsertProviders(storedProviders);
      if (result.error) errors.push(result.error);
      else migratedProviders = storedProviders.length;
    }
  }

  if (!remoteCamps.error && remoteCamps.data.length === 0) {
    const storedCamps = loadStoredCamps() ?? [];
    if (storedCamps.length > 0) {
      const result = await upsertCamps(storedCamps);
      if (result.error) errors.push(result.error);
      else migratedCamps = storedCamps.length;
    }
  }

  return { migratedProviders, migratedCamps, errors };
}
