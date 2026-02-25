// app/brand-config.ts

export type BrandKey = "chantleague" | "battlesleague";

export type Brand = {
  key: BrandKey;
  name: string;
  theme: "football" | "professional";
  primary: string;
  secondary: string;
};

export const brands: Record<BrandKey, Brand> = {
  chantleague: {
    key: "chantleague",
    name: "Chant League",
    theme: "football",
    primary: "#00D1FF",
    secondary: "#061B2B",
  },
  battlesleague: {
    key: "battlesleague",
    name: "Battle League",
    theme: "professional",
    primary: "#B084FF",
    secondary: "#120B1F",
  },
};

