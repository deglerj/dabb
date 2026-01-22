/**
 * Human-readable session code generator
 * Format: {adjective}-{noun}-{number}
 */

const ADJECTIVES = [
  'schnell', 'langsam', 'gross', 'klein', 'wild', 'zahm', 'hell', 'dunkel',
  'alt', 'jung', 'neu', 'frisch', 'warm', 'kalt', 'weich', 'hart',
  'blau', 'rot', 'gruen', 'gelb', 'schwarz', 'weiss', 'braun', 'grau',
  'stark', 'sanft', 'klug', 'schlau', 'mutig', 'stolz', 'flink', 'ruhig',
  'froh', 'lustig', 'still', 'laut', 'leicht', 'schwer', 'hoch', 'tief',
  'lang', 'kurz', 'breit', 'schmal', 'dick', 'duenn', 'reich', 'arm',
];

const NOUNS = [
  'fuchs', 'baer', 'wolf', 'adler', 'hase', 'hirsch', 'dachs', 'igel',
  'rabe', 'eule', 'falke', 'specht', 'fisch', 'frosch', 'otter', 'biber',
  'berg', 'tal', 'wald', 'see', 'fluss', 'bach', 'wiese', 'feld',
  'stein', 'fels', 'baum', 'blatt', 'blume', 'gras', 'moos', 'pilz',
  'stern', 'mond', 'sonne', 'wind', 'regen', 'schnee', 'nebel', 'wolke',
  'turm', 'burg', 'haus', 'hof', 'dorf', 'stadt', 'tor', 'weg',
];

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

export function generateSessionCode(): string {
  const adjective = randomItem(ADJECTIVES);
  const noun = randomItem(NOUNS);
  const number = randomNumber(99);

  return `${adjective}-${noun}-${number}`;
}

// ~200,000 unique combinations (48 * 48 * 99)
