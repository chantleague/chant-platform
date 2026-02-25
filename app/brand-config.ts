export type BrandKey = "chantleague" | "battleleague";

export type Brand = {
  key: BrandKey;
  name: string;
  theme: "football" | "pro";
  primary: string;
  secondary: string;
};

export const brands: Record<BrandKey, Brand> = {
  chantleague: {
    key: "chantleague",
    name: "Chant League",
    theme: "football",
    primary: "#00E5FF",
    secondary: "#001A2B",
  },
  battleleague: {
    key: "battleleague",
    name: "Battle League",
    theme: "pro",
    primary: "#FFB020",
    secondary: "#1A0F00",
  },
};