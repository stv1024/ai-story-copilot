import { DEFAULT_SETTINGS } from "./constants.js";
import { createStoryState, hydrateStoryState, serializeStoryState } from "./story-state.js";

const SETTINGS_KEY = "ai-story-copilot:settings:v1";
const STORY_KEY = "ai-story-copilot:story:v1";

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

export function loadSettings() {
  const storage = safeLocalStorage();
  if (!storage) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const rawValue = storage.getItem(SETTINGS_KEY);
    if (!rawValue) {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(rawValue),
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  const storage = safeLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadStoryState() {
  const storage = safeLocalStorage();
  if (!storage) {
    return createStoryState();
  }

  try {
    return hydrateStoryState(storage.getItem(STORY_KEY));
  } catch (error) {
    return createStoryState();
  }
}

export function saveStoryState(storyState) {
  const storage = safeLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(STORY_KEY, serializeStoryState(storyState));
}

export function clearStoryState() {
  const storage = safeLocalStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(STORY_KEY);
}

