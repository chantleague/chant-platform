export const brands = {
  chantleague: {
    name: "Chant League",
    theme: "football",
    primaryColor: "#00c2ff",
    secondaryColor: "#001a2b",
  },
  battleleague: {
    name: "Battle League",
    theme: "professional",
    primaryColor: "#7c3aed",
    secondaryColor: "#0f172a",
  },
} as const;

export type BrandKey = keyof typeof brands;
export type Brand = (typeof brands)[BrandKey];

