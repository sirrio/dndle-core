export const DEFAULT_MAX_GUESSES = 7;
const LEGACY_MAX_GUESSES = 6;

export type GameStats = {
  played: number;
  wins: number;
  totalGuesses: number;
  streak: number;
  lastWin: string;
  distribution: number[];
};

// A recorded pre-upgrade round must keep its original result and share score.
// New rounds persist their limit separately before their result is recorded.
export function resolveGuessLimit(savedLimit: unknown, alreadyRecorded: boolean) {
  if (savedLimit === LEGACY_MAX_GUESSES || savedLimit === DEFAULT_MAX_GUESSES) return savedLimit;
  return alreadyRecorded ? LEGACY_MAX_GUESSES : DEFAULT_MAX_GUESSES;
}

export function roundOutcome(guessNames: readonly string[], targetName: string, guessLimit = DEFAULT_MAX_GUESSES) {
  const won = guessNames.includes(targetName);
  return { won, finished: won || guessNames.length >= guessLimit };
}

function count(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function normalizeStats(saved?: unknown): GameStats {
  const source = saved && typeof saved === "object" ? saved as Record<string, unknown> : {};
  const distribution = Array.isArray(source.distribution) ? source.distribution : [];
  return {
    played: count(source.played),
    wins: count(source.wins),
    totalGuesses: count(source.totalGuesses),
    streak: count(source.streak),
    lastWin: typeof source.lastWin === "string" ? source.lastWin : "",
    distribution: Array.from({ length: DEFAULT_MAX_GUESSES }, (_, index) => count(distribution[index])),
  };
}

export function nextGameStats(current: GameStats, result: {
  won: boolean;
  guessCount: number;
  dayKey: string;
  yesterdayKey: string;
}): GameStats {
  const { won, guessCount, dayKey, yesterdayKey } = result;
  const stats = normalizeStats(current);
  return {
    ...stats,
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    totalGuesses: stats.totalGuesses + (won ? guessCount : 0),
    streak: won ? (stats.lastWin === yesterdayKey ? stats.streak + 1 : 1) : 0,
    lastWin: won ? dayKey : stats.lastWin,
    distribution: stats.distribution.map((value, index) => value + (won && index === guessCount - 1 ? 1 : 0)),
  };
}
