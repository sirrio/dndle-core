import assert from "node:assert/strict";
import test from "node:test";
import { tryCopyText } from "../src/clipboard";

test("copies the complete share text unchanged and reports success after the write completes", async () => {
  const shareText = "SPELLDLE #282 3/7\n🟩⬜🟨🟩⬜⬜🟩\n🟩🟩🟩🟩🟩🟩🟩\nhttps://sirrio.github.io/spelldle/";
  let copiedText: string | undefined;
  let finishWrite!: () => void;
  const writeComplete = new Promise<void>((resolve) => { finishWrite = resolve; });
  let settled = false;
  const result = tryCopyText(shareText, {
    async writeText(text) {
      copiedText = text;
      await writeComplete;
    },
  }).then((success) => {
    settled = true;
    return success;
  });

  await Promise.resolve();
  assert.equal(copiedText, shareText);
  assert.equal(settled, false);
  finishWrite();
  assert.equal(await result, true);
});

test("returns false when the clipboard API is unavailable", async () => {
  assert.equal(await tryCopyText("Share text"), false);
});

test("returns false when clipboard permission is denied", async () => {
  assert.equal(await tryCopyText("Share text", {
    async writeText() {
      throw new DOMException("Clipboard access denied", "NotAllowedError");
    },
  }), false);
});

test("returns false when the clipboard implementation throws synchronously", async () => {
  assert.equal(await tryCopyText("Share text", {
    writeText() {
      throw new Error("Clipboard is unavailable");
    },
  }), false);
});
