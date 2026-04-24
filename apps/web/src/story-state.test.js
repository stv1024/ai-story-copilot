import test from "node:test";
import assert from "node:assert/strict";

import {
  addStoryBeat,
  createStorySession,
  createStoryState,
  getActiveLine,
  getChildBeatIds,
  switchBranch,
  rollbackToBeat,
} from "./story-state.js";
import { buildLengthGuidance } from "./prompt-builder.js";

test("story session keeps alternate branches after rollback", () => {
  const session = createStorySession();

  const beatA = addStoryBeat(session, {
    parentBeatId: null,
    userInput: "第一幕",
    content: "A",
    suggestions: ["a1", "a2"],
    storySummary: "summary A",
    modelId: "demo",
  });

  const beatB = addStoryBeat(session, {
    parentBeatId: beatA.id,
    userInput: "第二幕",
    content: "B",
    suggestions: ["b1", "b2"],
    storySummary: "summary B",
    modelId: "demo",
  });

  rollbackToBeat(session, beatA.id);

  const beatC = addStoryBeat(session, {
    parentBeatId: beatA.id,
    userInput: "岔开去写",
    content: "C",
    suggestions: ["c1", "c2"],
    storySummary: "summary C",
    modelId: "demo",
  });

  assert.equal(getChildBeatIds(session, beatA.id).length, 2);
  assert.deepEqual(
    getActiveLine(session).map((beat) => beat.id),
    [beatA.id, beatC.id],
  );

  switchBranch(session, beatA.id, beatB.id);
  assert.deepEqual(
    getActiveLine(session).map((beat) => beat.id),
    [beatA.id, beatB.id],
  );
});

test("story state factory returns an empty current session", () => {
  const storyState = createStoryState();
  assert.ok(storyState.currentSession);
  assert.equal(getActiveLine(storyState.currentSession).length, 0);
});

test("long user input adds eighty percent length guidance", () => {
  const longInput = "设定".repeat(80);
  const guidance = buildLengthGuidance(longInput);
  assert.match(guidance, /至少约/);
  assert.match(guidance, /128/);
});

