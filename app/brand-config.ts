export type BrandKey = "chantleague" | "battlesleague";

export type Brand = {
  key: BrandKey;
  name: string;
  initials: string;
  tagline: string;
  theme: "football" | "pro";
  primary: string;
  secondary: string;
  domains: string[]; // used for host matching
};

export const brands: Record<BrandKey, Brand> = {
  chantleague: {
    key: "chantleague",
    name: "Chant League",
    initials: "CL",
    tagline: "Where fans turn banter into anthems.",
    theme: "football",
    primary: "#22c55e",
    secondary: "#020617",
    domains: ["chantleague.com", "www.chantleague.com", "chantleague.co.uk", "www.chantleague.co.uk"],
  },
  battlesleague: {
    key: "battlesleague",
    name: "Battles League",
    initials: "BL",
    tagline: "Battle-ready competitions and pro events.",
    theme: "pro",
    primary: "#38bdf8",
    secondary: "#020617",
    domains: ["battlesleague.com", "www.battlesleague.com"],
  },
};