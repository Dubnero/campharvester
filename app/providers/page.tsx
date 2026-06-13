import { ProviderImport } from "@/components/ProviderImport";
import { mockCamps, mockProviders } from "@/lib/mockData";

export default function ProvidersPage() {
  return <ProviderImport initialProviders={mockProviders} camps={mockCamps} />;
}
