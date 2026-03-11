import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import MainHeader from "@/components/MainHeader";
import { useBrand } from "./lib/getBrand";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://chantleague.com"),
  title: "Chant League — Football Fan Chant Battles",
  description:
    "Submit chants, vote for your club, and win the rivalry in football's biggest chant battles.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const brand = useBrand();

  return (
    <html lang="en" className="h-full">
      <body
        className="min-h-full bg-black text-zinc-50"
        style={{ backgroundColor: brand.secondary }}
      >
        <div className="flex min-h-screen flex-col">
          <MainHeader />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-6">{children}</main>
          <Footer />
          <Analytics />
        </div>
      </body>
    </html>
  );
}
