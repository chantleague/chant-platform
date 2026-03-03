export type Club = {
  slug: string;
  name: string;
  description: string;
  fans: number;
};

export const mockClubs: Club[] = [
  {
    slug: "arsenal",
    name: "Arsenal FC",
    description: "North London club founded in 1886, known for its fluid attacking style.",
    fans: 9887123,
  },
  {
    slug: "man-utd",
    name: "Manchester United",
    description: "One of the most successful English clubs with a global fanbase.",
    fans: 13458902,
  },
  {
    slug: "liverpool",
    name: "Liverpool FC",
    description: "Historic Merseyside club famed for 'You'll Never Walk Alone'.",
    fans: 12034567,
  },
  {
    slug: "spurs",
    name: "Tottenham Hotspur",
    description: "North London side known for its dynamic attacking football.",
    fans: 6523891,
  },
  {
    slug: "barcelona",
    name: "FC Barcelona",
    description: "Catalan giants with a philosophy of stylish possession play.",
    fans: 21457890,
  },
  {
    slug: "real-madrid",
    name: "Real Madrid CF",
    description: "Record-breaking European champions from Spain's capital.",
    fans: 22145678,
  },
  {
    slug: "celtic",
    name: "Celtic FC",
    description: "Glasgow club with a passionate fanbase and rich history.",
    fans: 3745123,
  },
  {
    slug: "rangers",
    name: "Rangers FC",
    description: "Celtic's Old Firm rivals, boasting a huge following.",
    fans: 3981234,
  },
];
