import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampHarvester",
  description: "Internal admin tool for reviewing Irish kids' camp listings.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
