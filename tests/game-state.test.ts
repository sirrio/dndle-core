import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MAX_GUESSES, nextGameStats, normalizeStats, resolveGuessLimit, roundOutcome } from "../src/game-state";

const sixMisses = ["A", "B", "C", "D", "E", "F"];

test("new rounds allow a seventh guess and finish on either seventh-guess outcome", () => {
  assert.equal(DEFAULT_MAX_GUESSES, 7);
  assert.deepEqual(roundOutcome(sixMisses, "Target"), { won: false, finished: false });
  assert.deepEqual(roundOutcome([...sixMisses, "Target"], "Target"), { won: true, finished: true });
  assert.deepEqual(roundOutcome([...sixMisses, "G"], "Target"), { won: false, finished: true });
  assert.deepEqual(roundOutcome(["Target"], "Target"), { won: true, finished: true });
});

test("recorded legacy rounds keep six attempts while ongoing rounds gain the seventh", () => {
  const legacyLimit = resolveGuessLimit(null, true);
  assert.equal(legacyLimit, 6);
  assert.deepEqual(roundOutcome(sixMisses, "Target", legacyLimit), { won: false, finished: true });
  assert.equal(resolveGuessLimit(undefined, false), 7);
  assert.equal(resolveGuessLimit(7, true), 7);
  assert.equal(resolveGuessLimit(6, true), 6);
  assert.equal(resolveGuessLimit(99, false), 7);
});

test("existing statistics gain an empty seventh bucket without losing history or mutating storage data", () => {
  const saved = { played: 25, wins: 21, totalGuesses: 91, streak: 4, lastWin: "2026-10-07", distribution: [1, 2, 3, 4, 5, 6] };
  const migrated = normalizeStats(saved);
  assert.deepEqual(migrated, { ...saved, distribution: [1, 2, 3, 4, 5, 6, 0] });
  assert.deepEqual(saved.distribution, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(normalizeStats(migrated), migrated);
});

test("a seventh-guess win increments its bucket and retains existing statistics", () => {
  const current = normalizeStats({ played: 3, wins: 2, totalGuesses: 8, streak: 2, lastWin: "2026-10-07", distribution: [0, 0, 1, 0, 1, 0] });
  const next = nextGameStats(current, { won: true, guessCount: 7, dayKey: "2026-10-08", yesterdayKey: "2026-10-07" });
  assert.deepEqual(next, { played: 4, wins: 3, totalGuesses: 15, streak: 3, lastWin: "2026-10-08", distribution: [0, 0, 1, 0, 1, 0, 1] });
  assert.equal(current.played, 3);
  assert.equal(current.distribution[6], 0);
});

test("a seventh-guess loss records a played round without inventing a win or distribution entry", () => {
  const current = normalizeStats({ played: 3, wins: 2, totalGuesses: 8, streak: 2, lastWin: "2026-10-07", distribution: [0, 0, 1, 0, 1, 0] });
  const next = nextGameStats(current, { won: false, guessCount: 7, dayKey: "2026-10-08", yesterdayKey: "2026-10-07" });
  assert.deepEqual(next, { ...current, played: 4, streak: 0 });
});

test("missing or malformed statistics produce independent valid defaults", () => {
  const empty = { played: 0, wins: 0, totalGuesses: 0, streak: 0, lastWin: "", distribution: [0, 0, 0, 0, 0, 0, 0] };
  assert.deepEqual(normalizeStats(), empty);
  assert.deepEqual(normalizeStats(null), empty);
  assert.deepEqual(normalizeStats({ played: -1, wins: "2", totalGuesses: Number.NaN, streak: 1.5, distribution: [null, -1, "3"] }), empty);
  const first = normalizeStats();
  first.distribution[0] = 5;
  assert.deepEqual(normalizeStats(), empty);
});
