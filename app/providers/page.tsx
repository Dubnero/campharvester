import { ProviderImport } from "@/components/ProviderImport";
import { mockProviders } from "@/lib/mockData";

export default function ProvidersPage() {
  return <ProviderImport initialProviders={mockProviders} />;
}
