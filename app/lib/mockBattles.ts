export type Battle = {
  slug: string;
  title: string;
  description: string;
  stats: {
    chants: number;
    voters: number;
    peakDb: number;
    fansJoined: number; // added for UI counting
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
      fansJoined: 3421,
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
      fansJoined: 5987,
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
      fansJoined: 4123,
    },
  },
  {
    slug: "barcelona-vs-real-madrid",
    title: "Barcelona vs Real Madrid Chant Battle",
    description:
      "El Clásico returns to the battle arena. Two Spanish titans face off in arguably the biggest club rivalry in world football.",
    stats: {
      chants: 4021,
      voters: 11023,
      peakDb: 122,
      fansJoined: 7500,
    },
  },
  {
    slug: "celtic-vs-rangers",
    title: "Celtic vs Rangers Chant Battle",
    description:
      "The Old Firm rivalry sparks again as the Scottish giants go battle-to-battle in one of football's fiercest derbies.",
    stats: {
      chants: 1789,
      voters: 4321,
      peakDb: 115,
      fansJoined: 2890,
    },
  },
];
