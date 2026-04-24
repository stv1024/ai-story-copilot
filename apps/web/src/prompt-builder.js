import { RECENT_BEAT_LIMIT } from "./constants.js";

function formatRecentBeats(recentBeats) {
  if (!recentBeats.length) {
    return "（这是第一轮故事节拍，暂无历史正文）";
  }

  return recentBeats
    .map((beat, index) => {
      const cleanedContent = beat.content.trim();
      return `第 ${index + 1} 个最近故事节拍：\n${cleanedContent}`;
    })
    .join("\n\n");
}

function fillTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (_fullMatch, key) => variables[key] ?? "");
}

export function buildLengthGuidance(userInput) {
  const normalizedLength = Array.from((userInput || "").trim()).length;
  if (normalizedLength >= 150) {
    return `本轮用户输入约 ${normalizedLength} 字，请把新的故事节拍拉长到至少约 ${Math.floor(normalizedLength * 0.8)} 字，并保持完整叙事。`;
  }

  return "默认把新的故事节拍控制在约 300~400 个汉字，允许自然分段。";
}

export function getRecentContextBeats(session) {
  const activeLine = session.activeBeatId
    ? session.activeBeatId
    : null;

  if (!activeLine) {
    return [];
  }

  const lineage = [];
  let cursor = session.beatsById[activeLine];

  while (cursor) {
    lineage.push(cursor);
    cursor = cursor.parentBeatId ? session.beatsById[cursor.parentBeatId] : null;
  }

  return lineage.reverse().slice(-RECENT_BEAT_LIMIT);
}

export function buildStoryMessages({ prompts, session, userInput }) {
  const recentBeats = getRecentContextBeats(session);
  const userMessage = fillTemplate(prompts.storyBeatRequest, {
    storySummary: session.activeBeatId ? session.beatsById[session.activeBeatId].storySummary || "（暂无摘要）" : "（暂无摘要）",
    recentBeats: formatRecentBeats(recentBeats),
    userInput: userInput.trim(),
    lengthGuidance: buildLengthGuidance(userInput),
  });

  return [
    {
      role: "system",
      content: `${prompts.systemRole.trim()}\n\n${prompts.windowSummary.trim()}`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
}

