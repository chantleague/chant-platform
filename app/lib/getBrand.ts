import { headers } from "next/headers";
import { brands } from "../brand-config";

export function getBrand() {

  const h = headers();

  const brandHeader = h.get("x-brand");

  console.log("Detected brand:", brandHeader);

  if (brandHeader && brands[brandHeader]) {
    return brands[brandHeader];
  }

  return brands["chantleague"];

}