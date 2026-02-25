import type { ReactNode } from "react";
import "./globals.css";

import { getBrand } from "./lib/getBrand";
import Navbar from "./components/Navbar";
import { Footer } from "./components/Footer";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brand = getBrand(); // ✅ auto-detect by domain

  return (
    <html lang="en" className="h-full">
      <body
        className="min-h-full bg-black text-zinc-50"
        style={{ backgroundColor: brand.secondary }}
      >
        <div className="flex min-h-screen flex-col">
          <Navbar brand={brand} />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-6">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}