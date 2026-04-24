const PROMPT_FILES = {
  systemRole: "/prompts/system-role.txt",
  storyBeatRequest: "/prompts/story-beat-request.txt",
  windowSummary: "/prompts/window-summary.txt",
};

const promptCache = new Map();

async function fetchPrompt(pathname) {
  if (promptCache.has(pathname)) {
    return promptCache.get(pathname);
  }

  const response = await fetch(pathname, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load prompt template: ${pathname}`);
  }

  const text = await response.text();
  promptCache.set(pathname, text);
  return text;
}

export async function loadPrompts() {
  const entries = await Promise.all(
    Object.entries(PROMPT_FILES).map(async ([key, pathname]) => [key, await fetchPrompt(pathname)]),
  );

  return Object.fromEntries(entries);
}

