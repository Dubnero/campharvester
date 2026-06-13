import type { Metadata } from "next";
import { PublicCampDetails } from "@/components/PublicCampDetails";
import { mockCamps, mockProviders } from "@/lib/mockData";

export const metadata: Metadata = {
  title: "Camp Details | CampHarvester",
  description: "View camp details including provider, location, dates, times, price and booking information.",
};

export default async function CampDetailsPage({ params }: { params: Promise<{ camp_id: string }> }) {
  const { camp_id } = await params;
  return <PublicCampDetails campId={camp_id} initialCamps={mockCamps} initialProviders={mockProviders} />;
}
