import type { Metadata } from "next";
import { PublicDirectory } from "@/components/PublicDirectory";
import { mockCamps, mockProviders } from "@/lib/mockData";

export const metadata: Metadata = {
  title: "Kids' Camps Directory | CampHarvester",
  description: "Search Irish kids' camps by county, town, activity, holiday and age.",
};

export default function CampsPage() {
  return <PublicDirectory initialCamps={mockCamps} initialProviders={mockProviders} />;
}
