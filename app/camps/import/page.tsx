import { CampImportWizard } from "@/components/CampImportWizard";
import { mockProviders } from "@/lib/mockData";

export default function CampsImportPage() {
  return <CampImportWizard initialProviders={mockProviders} />;
}
