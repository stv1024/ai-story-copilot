import { DEFAULT_MODEL_ID } from "./constants.js";
import { loadPrompts } from "./prompt-loader.js";
import { buildStoryMessages } from "./prompt-builder.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function parseJsonPayload(rawContent) {
  if (!rawContent) {
    throw new Error("模型没有返回内容。");
  }

  const trimmed = rawContent.trim();
  const directStart = trimmed.indexOf("{");
  const directEnd = trimmed.lastIndexOf("}");

  if (directStart === -1 || directEnd === -1 || directEnd <= directStart) {
    throw new Error("模型返回格式不是有效 JSON。");
  }

  return JSON.parse(trimmed.slice(directStart, directEnd + 1));
}

function normalizeSuggestions(suggestions) {
  const normalized = Array.isArray(suggestions)
    ? suggestions.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return normalized.slice(0, 2);
}

function normalizeGeneration(parsedPayload, fallbackModelId) {
  const beat = String(parsedPayload.beat || "").trim();
  const storySummary = String(parsedPayload.storySummary || "").trim();
  const suggestions = normalizeSuggestions(parsedPayload.suggestions);

  if (!beat) {
    throw new Error("模型返回缺少故事节拍正文。");
  }

  if (suggestions.length !== 2) {
    throw new Error("模型返回的建议梗概数量不正确。");
  }

  if (!storySummary) {
    throw new Error("模型返回缺少滚动摘要。");
  }

  return {
    content: beat,
    suggestions,
    storySummary,
    modelId: fallbackModelId,
  };
}

export async function generateStoryBeat({ settings, session, userInput }) {
  const apiKey = settings.apiKey.trim();
  const modelId = (settings.customModelId || settings.modelId || DEFAULT_MODEL_ID).trim();

  if (!apiKey) {
    throw new Error("请先在设置页填写 OpenRouter API Key。");
  }

  if (!modelId) {
    throw new Error("请先选择或填写一个模型 ID。");
  }

  const prompts = await loadPrompts();
  const messages = buildStoryMessages({
    prompts,
    session,
    userInput,
  });

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "AI Story Copilot",
    },
    body: JSON.stringify({
      model: modelId,
      temperature: 0.9,
      messages,
    }),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiError = responseBody?.error?.message || response.statusText || "OpenRouter 请求失败。";
    throw new Error(apiError);
  }

  const content = responseBody?.choices?.[0]?.message?.content;
  const parsedPayload = parseJsonPayload(content);
  return normalizeGeneration(parsedPayload, responseBody?.model || modelId);
}

