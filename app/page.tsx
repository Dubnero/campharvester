import { CampAdmin } from "@/components/CampAdmin";
import { mockCamps, mockProviders } from "@/lib/mockData";

export default function Home() {
  return <CampAdmin initialCamps={mockCamps} initialProviders={mockProviders} />;
}
