import { use } from "react";
import { headers } from "next/headers";
import { brands, type Brand, type BrandKey } from "../brand-config";

export function getBrand(): Brand {
  const requestHeaders = use(headers());
  const key = (requestHeaders.get("x-brand") || "chantleague").toLowerCase() as BrandKey;

  if (key === "battlesleague") {
    return brands.battlesleague;
  }

  return brands.chantleague;
}
