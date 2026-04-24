const ROOT_BRANCH_KEY = "root";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getParentKey(parentBeatId) {
  return parentBeatId || ROOT_BRANCH_KEY;
}

export function createStorySession() {
  const timestamp = nowIso();
  return {
    id: createId("session"),
    createdAt: timestamp,
    updatedAt: timestamp,
    activeBeatId: null,
    beatsById: {},
    branchChildren: {
      [ROOT_BRANCH_KEY]: [],
    },
    selectedChildByParent: {},
  };
}

export function createStoryState() {
  return {
    currentSession: createStorySession(),
  };
}

export function cloneSession(session) {
  return JSON.parse(JSON.stringify(session));
}

export function getBeatById(session, beatId) {
  return beatId ? session.beatsById[beatId] || null : null;
}

export function getChildBeatIds(session, parentBeatId = null) {
  return session.branchChildren[getParentKey(parentBeatId)] || [];
}

export function getLineageToBeat(session, beatId) {
  if (!beatId || !session.beatsById[beatId]) {
    return [];
  }

  const lineage = [];
  let cursor = session.beatsById[beatId];

  while (cursor) {
    lineage.push(cursor.id);
    cursor = cursor.parentBeatId ? session.beatsById[cursor.parentBeatId] : null;
  }

  return lineage.reverse();
}

export function getActiveLine(session) {
  return getLineageToBeat(session, session.activeBeatId).map((beatId) => session.beatsById[beatId]);
}

export function getDeepestSelectedDescendant(session, startBeatId) {
  let cursorId = startBeatId;

  while (cursorId) {
    const childId = session.selectedChildByParent[cursorId];
    if (!childId || !session.beatsById[childId]) {
      return cursorId;
    }
    cursorId = childId;
  }

  return startBeatId;
}

export function addStoryBeat(session, payload) {
  const parentBeatId = payload.parentBeatId || null;
  const beatId = createId("beat");
  const timestamp = nowIso();
  const branchKey = getParentKey(parentBeatId);
  const childIds = session.branchChildren[branchKey] || [];

  const beat = {
    id: beatId,
    createdAt: timestamp,
    parentBeatId,
    branchIndex: childIds.length,
    userInput: payload.userInput,
    content: payload.content,
    suggestions: payload.suggestions,
    storySummary: payload.storySummary,
    modelId: payload.modelId || "",
  };

  session.beatsById[beatId] = beat;
  session.branchChildren[branchKey] = [...childIds, beatId];
  session.branchChildren[beatId] = session.branchChildren[beatId] || [];
  session.selectedChildByParent[branchKey] = beatId;
  session.activeBeatId = beatId;
  session.updatedAt = timestamp;

  return beat;
}

export function rollbackToBeat(session, beatId) {
  if (!session.beatsById[beatId]) {
    throw new Error("Cannot rollback to a missing beat.");
  }

  session.activeBeatId = beatId;
  session.updatedAt = nowIso();
  return session;
}

export function switchBranch(session, parentBeatId, childBeatId) {
  const branchKey = getParentKey(parentBeatId);
  const childIds = session.branchChildren[branchKey] || [];

  if (!childIds.includes(childBeatId)) {
    throw new Error("Cannot switch to a branch that does not belong to the target parent.");
  }

  session.selectedChildByParent[branchKey] = childBeatId;
  session.activeBeatId = getDeepestSelectedDescendant(session, childBeatId);
  session.updatedAt = nowIso();
  return session;
}

export function getBeatBranchOptions(session, parentBeatId) {
  return getChildBeatIds(session, parentBeatId).map((childId) => session.beatsById[childId]).filter(Boolean);
}

export function getStorySummary(session) {
  const activeBeat = getBeatById(session, session.activeBeatId);
  return activeBeat?.storySummary || "";
}

export function serializeStoryState(storyState) {
  return JSON.stringify(storyState);
}

export function hydrateStoryState(rawValue) {
  if (!rawValue) {
    return createStoryState();
  }

  const parsedValue = JSON.parse(rawValue);
  if (!parsedValue?.currentSession?.beatsById) {
    return createStoryState();
  }

  return parsedValue;
}

export { ROOT_BRANCH_KEY };

