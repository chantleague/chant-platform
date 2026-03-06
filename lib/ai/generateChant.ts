function normalizeInput(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\n\r\t]+/g, "");
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function templateEverywhere(player: string) {
  return [
    "He's here",
    "He's there",
    "He's every single where",
    player,
    player,
  ];
}

function templateWeLove(player: string, club: string, rival: string) {
  return [
    `${club}, sing it loud`,
    `${player} leads the crowd`,
    `${rival} can't slow him down`,
    `${player}, own this town`,
    `${player}, ${player}`,
  ];
}

function templateRhythm(player: string, club: string, rival: string) {
  return [
    `${player} on the ball`,
    `${club} hear the call`,
    `${rival} backing away`,
    `${player} wins the day`,
    `${player}, ${player}`,
  ];
}

function pickTemplate(club: string, player: string, rival: string) {
  const seed = `${club}|${player}|${rival}`
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const templates = [templateEverywhere, templateWeLove, templateRhythm];
  return templates[seed % templates.length];
}

export function generateChant(club: string, player: string, rival: string): string {
  const normalizedClub = toTitleCase(normalizeInput(club)) || "The Club";
  const normalizedPlayer = toTitleCase(normalizeInput(player)) || "Our Star";
  const normalizedRival = toTitleCase(normalizeInput(rival)) || "The Rival";

  const template = pickTemplate(normalizedClub, normalizedPlayer, normalizedRival);
  const lines = template(normalizedPlayer, normalizedClub, normalizedRival)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  // Keep chant format between 4 and 8 lines for repeatable stadium rhythm.
  const boundedLines = lines.length < 4 ? [...lines, normalizedPlayer, normalizedPlayer] : lines;

  return boundedLines.slice(0, 8).join("\n");
}
