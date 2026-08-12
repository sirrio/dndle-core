import assert from "node:assert/strict";
import test from "node:test";
import { buildShareText, compareList, compareNumber, compareText, dailyGameNumber, dailyTarget, entryOptionDisabled } from "../src/index";

const daily = { startUtc: [2026, 0, 1] as [number, number, number], multiplier: 17, offset: 5 };

test("UTC game numbers are stable across the day boundary", () => {
  assert.equal(dailyGameNumber(daily, new Date("2026-01-01T00:00:00Z")), 1);
  assert.equal(dailyGameNumber(daily, new Date("2026-08-12T23:59:59Z")), 224);
});

test("daily target selection is deterministic", () => {
  const entries = Array.from({ length: 72 }, (_, index) => ({ name: String(index) }));
  const date = new Date("2026-08-12T12:00:00Z");
  assert.equal(dailyTarget(entries, daily, date).name, dailyTarget(entries, daily, date).name);
});

test("comparison helpers encode exact, partial and ordered feedback", () => {
  assert.equal(compareText("A", "A"), "exact");
  assert.equal(compareText("A", "B"), "wrong");
  assert.equal(compareList(["V", "S"], ["V", "M"]), "partial");
  assert.equal(compareList(["S", "V"], ["V", "S"]), "exact");
  assert.equal(compareNumber(2, 3), "higher");
  assert.equal(compareNumber(4, 3), "lower");
});

test("share text links the current game and promotes its sibling game", () => {
  const text = buildShareText({
    brand: "CRITTERDLE",
    gameNumber: 224,
    score: "6/6",
    rows: ["🟩⬛", "🟩🟩"],
    question: "Can you track today's monster?",
    action: "Join the hunt!",
    url: "https://sirrio.github.io/critterdle/",
    relatedPrompt: "Or search the Arcane Archive for spells?",
    relatedUrl: "https://sirrio.github.io/spelldle/",
  });

  assert.match(text, /^\[CRITTERDLE\]\(https:\/\/sirrio\.github\.io\/critterdle\/\) #224 6\/6/);
  assert.match(text, /\[Join the hunt!\]\(https:\/\/sirrio\.github\.io\/critterdle\/\)/);
  assert.match(text, / · \[Or search the Arcane Archive for spells\?\]\(<https:\/\/sirrio\.github\.io\/spelldle\/>\)$/);
});

test("finished games keep entry buttons active for name tooltips", () => {
  assert.equal(entryOptionDisabled(true, false), true);
  assert.equal(entryOptionDisabled(true, true), false);
  assert.equal(entryOptionDisabled(false, true), false);
});
