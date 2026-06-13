import { Provider, ProviderImportResult } from "./types";
import { parseCsv } from "./campUtils";

export const providerFields: (keyof Provider)[] = [
  "provider_id",
  "provider_name",
  "website",
  "email",
  "phone",
  "description",
  "verified",
  "featured",
];

export const requiredProviderFields: (keyof Provider)[] = ["provider_id", "provider_name"];

export function getProviderStats(providers: Provider[]) {
  return {
    total: providers.length,
    verified: providers.filter((provider) => provider.verified).length,
    featured: providers.filter((provider) => provider.featured).length,
  };
}

export function filterProviders(providers: Provider[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return providers;

  return providers.filter((provider) =>
    [provider.provider_name, provider.provider_id, provider.website, provider.email, provider.phone, provider.description]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

export function validateProvider(provider: Provider, rowLabel = "Provider") {
  const errors: string[] = [];

  requiredProviderFields.forEach((field) => {
    if (!provider[field]) {
      errors.push(`${rowLabel}: ${field} is required.`);
    }
  });

  if (provider.email && !/^\S+@\S+\.\S+$/.test(provider.email)) {
    errors.push(`${rowLabel}: email must be a valid email address.`);
  }

  if (provider.website && !/^https?:\/\//.test(provider.website)) {
    errors.push(`${rowLabel}: website should start with http:// or https://.`);
  }

  return errors;
}

function parseBoolean(value: string) {
  return ["true", "1", "yes", "y"].includes(value.toLowerCase());
}

export function csvToProviders(text: string): ProviderImportResult {
  const rows = parseCsv(text);
  const errors: string[] = [];

  if (rows.length === 0) {
    return { providers: [], errors: ["CSV file is empty."] };
  }

  const headers = rows[0].map((header) => header.trim());
  const missingRequired = requiredProviderFields.filter((field) => !headers.includes(field));

  if (missingRequired.length > 0) {
    return {
      providers: [],
      errors: [`Missing required column${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.join(", ")}.`],
    };
  }

  const seenProviderIds = new Set<string>();
  const providers = rows.slice(1).map((row, index) => {
    const values = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""]));
    const provider: Provider = {
      provider_id: values.provider_id ?? "",
      provider_name: values.provider_name ?? "",
      website: values.website ?? "",
      email: values.email ?? "",
      phone: values.phone ?? "",
      description: values.description ?? "",
      verified: parseBoolean(values.verified ?? ""),
      featured: parseBoolean(values.featured ?? ""),
    };

    const rowLabel = `Row ${index + 2}`;
    errors.push(...validateProvider(provider, rowLabel));

    if (provider.provider_id) {
      if (seenProviderIds.has(provider.provider_id)) {
        errors.push(`${rowLabel}: provider_id must be unique within the CSV.`);
      }
      seenProviderIds.add(provider.provider_id);
    }

    return provider;
  });

  return { providers, errors };
}
