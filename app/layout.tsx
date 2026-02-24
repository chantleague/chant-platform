import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { getBrand } from "./lib/getBrand";

export const metadata: Metadata = {
  title: "Chant Platform",
  description: "Multi-tenant chant and battle arena for clubs, students, and professionals.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const brand = await getBrand();

  return (
    <html lang="en" className="h-full">
      <body
        className="min-h-full bg-black text-zinc-50 antialiased"
        style={{ backgroundColor: brand.secondaryColor }}
      >
        <div
          className="flex min-h-screen flex-col"
          style={{
            backgroundImage: `radial-gradient(circle at top, ${brand.primaryColor}33, transparent 55%), radial-gradient(circle at bottom, ${brand.secondaryColor}, #000000)`,
          }}
        >
          <Navbar brand={brand} />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-10 pt-6 lg:px-6">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

