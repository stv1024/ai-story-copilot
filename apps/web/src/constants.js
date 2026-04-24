export const APP_TITLE = "AI Story Copilot";
export const DEFAULT_MODEL_ID = "openrouter/auto";
export const RECENT_BEAT_LIMIT = 4;

export const MODEL_OPTIONS = [
  {
    id: "openrouter/auto",
    label: "自动路由",
    note: "通用推荐，适合先跑通创作流程",
  },
  {
    id: "deepseek/deepseek-v3.2",
    label: "DeepSeek V3.2",
    note: "常用强模型，默认推荐名单保留它",
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    note: "长上下文和稳定表达较强",
  },
  {
    id: "qwen/qwen3-32b",
    label: "Qwen3 32B",
    note: "中文与创作任务表现均衡，成本相对友好",
  },
];

export const DEFAULT_SETTINGS = {
  apiKey: "",
  modelId: DEFAULT_MODEL_ID,
  customModelId: "",
};

