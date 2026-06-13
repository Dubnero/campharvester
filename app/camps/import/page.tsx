import { CampImportWizard } from "@/components/CampImportWizard";
import { mockCamps, mockProviders } from "@/lib/mockData";

export default function CampsImportPage() {
  return <CampImportWizard initialCamps={mockCamps} providers={mockProviders} />;
}
