export type BrandKey = "chantleague" | "battlesleague";

export type Brand = {
  key: BrandKey;
  name: string;
  primary: string;
  secondary: string;
};

export const brands: Record<BrandKey, Brand> = {
  chantleague: {
    key: "chantleague",
    name: "Chant League",
    primary: "#22c55e",
    secondary: "#06202b",
  },
  battlesleague: {
    key: "battlesleague",
    name: "Battles League",
    primary: "#60a5fa",
    secondary: "#0b1020",
  },
};
