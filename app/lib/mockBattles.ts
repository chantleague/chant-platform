export type Battle = {
  slug: string;
  title: string;
  description: string;
  stats: {
    chants: number;
    voters: number;
    peakDb: number;
  };
};

export const mockBattles: Battle[] = [
  {
    slug: "arsenal-vs-spurs",
    title: "Arsenal vs Spurs Chant Battle",
    description:
      "North London rivalry ignites before matchday. Two of England's most passionate supporter bases go head-to-head in this legendary fixture.",
    stats: {
      chants: 1842,
      voters: 5234,
      peakDb: 118,
    },
  },
  {
    slug: "man-utd-vs-liverpool",
    title: "Man United vs Liverpool Chant Battle",
    description:
      "England's biggest rivalry goes head-to-head. The Reds and the Red Devils clash in one of football's most historic matchups.",
    stats: {
      chants: 3241,
      voters: 9804,
      peakDb: 116,
    },
  },
  {
    slug: "england-vs-brazil",
    title: "England vs Brazil Chant Battle",
    description:
      "World Cup rivalry begins. Two footballing giants battle it out for supremacy on the world stage.",
    stats: {
      chants: 2156,
      voters: 6782,
      peakDb: 120,
    },
  },
];
