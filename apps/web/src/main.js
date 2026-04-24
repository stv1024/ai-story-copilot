import { APP_TITLE, DEFAULT_MODEL_ID, MODEL_OPTIONS } from "./constants.js";
import { generateStoryBeat } from "./openrouter.js";
import { clearStoryState, loadSettings, loadStoryState, saveSettings, saveStoryState } from "./storage.js";
import {
  addStoryBeat,
  createStoryState,
  getActiveLine,
  getBeatBranchOptions,
  rollbackToBeat,
  switchBranch,
} from "./story-state.js";

const appElement = document.querySelector("#app");

const state = {
  route: getRoute(),
  settings: loadSettings(),
  story: loadStoryState(),
  ui: {
    composerInput: "",
    selectedSuggestionIndex: null,
    generating: false,
    error: "",
    openMenuBeatId: null,
    revealApiKey: false,
  },
};

if (!state.story?.currentSession) {
  state.story = createStoryState();
}

function getRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "/settings" ? "settings" : "story";
}

function setRoute(route) {
  window.location.hash = route === "settings" ? "/settings" : "/story";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nl2p(text) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getEffectiveModelId() {
  return (state.settings.customModelId || state.settings.modelId || DEFAULT_MODEL_ID).trim();
}

function getDraftInputValue() {
  return state.ui.composerInput.trim();
}

function getPendingInput() {
  const customInput = getDraftInputValue();
  if (customInput) {
    return customInput;
  }

  const lastBeat = state.story.currentSession.activeBeatId
    ? state.story.currentSession.beatsById[state.story.currentSession.activeBeatId]
    : null;

  if (
    lastBeat &&
    Number.isInteger(state.ui.selectedSuggestionIndex) &&
    lastBeat.suggestions[state.ui.selectedSuggestionIndex]
  ) {
    return lastBeat.suggestions[state.ui.selectedSuggestionIndex];
  }

  return "";
}

function updateSubmitButtonState() {
  const submitButton = document.querySelector('[data-action="submit-turn"]');
  if (!(submitButton instanceof HTMLButtonElement)) {
    return;
  }

  const settingsReady = Boolean(state.settings.apiKey.trim());
  submitButton.disabled = state.ui.generating || !getPendingInput() || !settingsReady;
}

function getBranchLabel(beat) {
  const seed = beat.userInput || beat.content;
  const text = seed.trim().replace(/\s+/g, " ");
  const excerpt = Array.from(text).slice(0, 12).join("");
  return excerpt.length < text.length ? `${excerpt}...` : excerpt;
}

function syncSettings() {
  saveSettings(state.settings);
}

function syncStory() {
  saveStoryState(state.story);
}

function setError(message) {
  state.ui.error = message || "";
}

function resetComposer() {
  state.ui.composerInput = "";
  state.ui.selectedSuggestionIndex = null;
}

function resetStory() {
  state.story = createStoryState();
  syncStory();
  resetComposer();
  setError("");
  state.ui.openMenuBeatId = null;
  render();
}

function renderNav(route) {
  return `
    <nav class="nav-tabs" aria-label="主导航">
      <button class="nav-tab ${route === "story" ? "is-active" : ""}" data-action="go-story">故事创作</button>
      <button class="nav-tab ${route === "settings" ? "is-active" : ""}" data-action="go-settings">设置</button>
    </nav>
  `;
}

function renderStoryHero() {
  const activeLine = getActiveLine(state.story.currentSession);
  const beatCount = activeLine.length;
  const lastBeat = activeLine[activeLine.length - 1];
  const effectiveModelId = getEffectiveModelId();
  const settingsReady = Boolean(state.settings.apiKey.trim());

  return `
    <section class="hero-card">
      <h2 class="hero-title">一轮一轮，把故事推进下去</h2>
      <p class="hero-copy">每次只生成一个新的故事节拍。你可以选建议梗概，也可以自己决定剧情走向；中途回退后，旧后续会保留为分支。</p>
      <div class="action-row" style="margin-top: 14px;">
        <span class="status-chip">${settingsReady ? "OpenRouter 已配置" : "请先配置 OpenRouter"}</span>
        <span class="status-chip mono">${escapeHtml(effectiveModelId || DEFAULT_MODEL_ID)}</span>
        <span class="status-chip">${beatCount ? `当前主线 ${beatCount} 个节拍` : "故事尚未开始"}</span>
        ${
          lastBeat
            ? `<span class="status-chip">最新更新 ${escapeHtml(formatTime(lastBeat.createdAt))}</span>`
            : ""
        }
      </div>
      <div class="action-row" style="margin-top: 16px;">
        <button class="secondary-button" data-action="new-story">新建故事</button>
        <button class="secondary-button" data-action="go-settings">打开设置</button>
      </div>
    </section>
  `;
}

function renderBranchChooser(beat) {
  const branchOptions = getBeatBranchOptions(state.story.currentSession, beat.id);
  const shouldShowSingleResume =
    state.story.currentSession.activeBeatId === beat.id && branchOptions.length === 1;

  if (branchOptions.length <= 1 && !shouldShowSingleResume) {
    return "";
  }

  const selectedChildId = state.story.currentSession.selectedChildByParent[beat.id];
  return `
    <section class="branch-card">
      <div class="branch-header">
        <h3>${branchOptions.length > 1 ? "后续版本" : "现有后续"}</h3>
        <p class="muted-text">${branchOptions.length > 1 ? "回退后保留的分支可以在这里切换。" : "你回退后，原来的后续还保留着，可以一键接回。"}</p>
      </div>
      <div class="branch-grid">
        ${branchOptions
          .map(
            (option, index) => `
              <button
                class="branch-pill ${selectedChildId === option.id ? "is-active" : ""}"
                data-action="switch-branch"
                data-parent-id="${beat.id}"
                data-child-id="${option.id}"
              >
                ${branchOptions.length > 1 ? `版本 ${index + 1} · ` : "继续 · "}${escapeHtml(getBranchLabel(option))}
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderConnector(beat) {
  const isOpen = state.ui.openMenuBeatId === beat.id;
  return `
    <div class="connector${isOpen ? " is-open" : ""}">
      <button class="overflow-button" data-action="toggle-menu" data-beat-id="${beat.id}" aria-expanded="${isOpen ? "true" : "false"}" aria-label="更多操作">
        <span>&#8942;</span>
      </button>
      ${
        isOpen
          ? `
            <div class="overflow-menu" role="menu">
              <button class="menu-button" data-action="rollback" data-beat-id="${beat.id}" role="menuitem">回退到这里</button>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderStoryStream() {
  const activeLine = getActiveLine(state.story.currentSession);
  if (!activeLine.length) {
    return `
      <section class="empty-card">
        <h2>从第一个故事节拍开始</h2>
        <p class="section-copy">先输入世界观、角色、冲突，或者直接写出第一步剧情。生成完成后，界面会同时给你两个下一步梗概建议。</p>
      </section>
    `;
  }

  return `
    <section class="story-stream" aria-label="故事主线">
      ${activeLine
        .map((beat, index) => {
          const isLast = index === activeLine.length - 1;
          return `
            <div class="beat-shell">
              <article class="beat-card" id="beat-${beat.id}">
                <div class="beat-meta">
                  <span class="beat-index">Story Beat ${index + 1}</span>
                  <span class="beat-user-input">由你的输入触发：${escapeHtml(beat.userInput)}</span>
                </div>
                <div class="beat-content">${nl2p(beat.content)}</div>
              </article>
              ${renderBranchChooser(beat)}
              ${!isLast ? renderConnector(beat) : ""}
            </div>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderComposer() {
  const activeBeat = state.story.currentSession.activeBeatId
    ? state.story.currentSession.beatsById[state.story.currentSession.activeBeatId]
    : null;
  const suggestions = activeBeat?.suggestions || [];
  const settingsReady = Boolean(state.settings.apiKey.trim());
  const pendingInput = getPendingInput();

  return `
    <section class="composer-card">
      <div class="composer-header">
        <div>
          <h2>下一轮输入</h2>
          <p class="section-copy">先选择建议梗概，或直接输入你想要的剧情走向。确认按钮是第二步，避免误操作。</p>
        </div>
        <span class="status-chip">${state.ui.generating ? "正在生成中" : "等待你的选择"}</span>
      </div>

      <div class="composer-section">
        <span class="composer-label">建议梗概</span>
        <div class="toggle-group" role="radiogroup" aria-label="下一步建议">
          ${
            suggestions.length
              ? suggestions
                  .map(
                    (suggestion, index) => `
                      <button
                        class="toggle-pill ${state.ui.selectedSuggestionIndex === index ? "is-active" : ""}"
                        data-action="pick-suggestion"
                        data-index="${index}"
                        aria-pressed="${state.ui.selectedSuggestionIndex === index ? "true" : "false"}"
                      >
                        ${escapeHtml(suggestion)}
                      </button>
                    `,
                  )
                  .join("")
              : `<p class="muted-text">第一轮还没有建议梗概。先输入你的开场设定。</p>`
          }
        </div>
      </div>

      <div class="composer-section">
        <label class="field-label" for="free-input">自由输入</label>
        <textarea
          id="free-input"
          class="free-input"
          name="composerInput"
          placeholder="例如：让主角在废弃剧院里发现一封来自未来的来信。"
        >${escapeHtml(state.ui.composerInput)}</textarea>
        <p class="field-help">若这里有内容，将优先使用你的自由输入；否则使用你选中的建议梗概。</p>
      </div>

      <div class="action-row">
        <button class="primary-button" data-action="submit-turn" ${state.ui.generating || !pendingInput || !settingsReady ? "disabled" : ""}>确认并生成下一节拍</button>
        <button class="secondary-button" data-action="reset-selection">清空本轮选择</button>
      </div>

      ${
        !settingsReady
          ? `<p class="field-help">生成前请先到设置页填写 OpenRouter API Key。</p>`
          : ""
      }
    </section>
  `;
}

function renderStoryPage() {
  return `
    <div class="page">
      ${state.ui.error ? `<section class="notice-card"><strong>出错了</strong><p class="section-copy">${escapeHtml(state.ui.error)}</p></section>` : ""}
      ${renderStoryHero()}
      <div class="story-layout">
        ${renderStoryStream()}
        ${renderComposer()}
      </div>
      <p class="footer-note">提示词模板已拆到 <span class="mono">/prompts/*.txt</span>，方便后续持续调优。</p>
    </div>
  `;
}

function renderModelOptions() {
  return MODEL_OPTIONS.map(
    (option) =>
      `<option value="${option.id}" ${state.settings.modelId === option.id ? "selected" : ""}>${escapeHtml(option.label)} · ${escapeHtml(option.note)}</option>`,
  ).join("");
}

function renderSettingsPage() {
  return `
    <div class="page">
      <section class="settings-card">
        <div>
          <h2>OpenRouter 设置</h2>
          <p class="section-copy">设置会自动保存在浏览器本地。首版默认前端直连 OpenRouter，后续可切到 Node.js 或 serverless 代理，不改页面形态。</p>
        </div>

        <div class="field-grid">
          <label>
            <span class="field-label">API Key</span>
            <input
              class="text-input mono"
              type="${state.ui.revealApiKey ? "text" : "password"}"
              name="apiKey"
              value="${escapeHtml(state.settings.apiKey)}"
              placeholder="sk-or-v1-..."
              autocomplete="off"
              spellcheck="false"
            />
          </label>

          <label>
            <span class="field-label">推荐模型</span>
            <select class="select-input" name="modelId">
              ${renderModelOptions()}
            </select>
          </label>

          <label>
            <span class="field-label">自定义模型 ID</span>
            <input
              class="text-input mono"
              type="text"
              name="customModelId"
              value="${escapeHtml(state.settings.customModelId)}"
              placeholder="留空则使用上面的推荐模型"
              spellcheck="false"
            />
          </label>
        </div>

        <div class="settings-actions">
          <button class="secondary-button" data-action="toggle-api-visibility">${state.ui.revealApiKey ? "隐藏 API Key" : "显示 API Key"}</button>
          <button class="danger-button" data-action="clear-story-data">清除故事数据</button>
        </div>

        <div class="notice-card">
          <strong>当前生效模型</strong>
          <p class="section-copy mono">${escapeHtml(getEffectiveModelId())}</p>
        </div>

        <p class="footer-note">默认推荐名单包含 <span class="mono">DeepSeek V3.2</span>、<span class="mono">Claude Sonnet 4.5</span>、<span class="mono">Qwen3 32B</span> 和 <span class="mono">openrouter/auto</span>。</p>
      </section>
    </div>
  `;
}

function render() {
  const route = state.route;
  appElement.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand">
          <h1>${APP_TITLE}</h1>
          <p>Story Beat 驱动的移动端故事共创器</p>
        </div>
        ${renderNav(route)}
      </header>
      ${route === "settings" ? renderSettingsPage() : renderStoryPage()}
    </main>
  `;
}

async function handleSubmitTurn() {
  const userInput = getPendingInput();

  if (!userInput) {
    setError("请先选择一个建议梗概，或者输入你自己的剧情走向。");
    render();
    return;
  }

  state.ui.generating = true;
  state.ui.error = "";
  state.ui.openMenuBeatId = null;
  render();

  try {
    const result = await generateStoryBeat({
      settings: state.settings,
      session: state.story.currentSession,
      userInput,
    });

    addStoryBeat(state.story.currentSession, {
      parentBeatId: state.story.currentSession.activeBeatId,
      userInput,
      content: result.content,
      suggestions: result.suggestions,
      storySummary: result.storySummary,
      modelId: result.modelId,
    });
    syncStory();
    resetComposer();
  } catch (error) {
    setError(error instanceof Error ? error.message : "生成失败。");
  } finally {
    state.ui.generating = false;
    render();
  }
}

window.addEventListener("hashchange", () => {
  state.route = getRoute();
  state.ui.openMenuBeatId = null;
  render();
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    if (state.ui.openMenuBeatId) {
      state.ui.openMenuBeatId = null;
      render();
    }
    return;
  }

  const action = target.dataset.action;

  if (action === "go-settings") {
    setRoute("settings");
    return;
  }

  if (action === "go-story") {
    setRoute("story");
    return;
  }

  if (action === "toggle-api-visibility") {
    state.ui.revealApiKey = !state.ui.revealApiKey;
    render();
    return;
  }

  if (action === "new-story") {
    if (window.confirm("确定要开始一个新的故事吗？当前故事会被替换为新的空白会话。")) {
      resetStory();
    }
    return;
  }

  if (action === "clear-story-data") {
    if (window.confirm("确定清除所有故事数据吗？设置里的 API Key 和模型不会被删除。")) {
      clearStoryState();
      state.story = createStoryState();
      resetComposer();
      setError("");
      render();
    }
    return;
  }

  if (action === "pick-suggestion") {
    state.ui.selectedSuggestionIndex = Number(target.dataset.index);
    state.ui.error = "";
    render();
    return;
  }

  if (action === "reset-selection") {
    resetComposer();
    setError("");
    render();
    return;
  }

  if (action === "submit-turn") {
    await handleSubmitTurn();
    return;
  }

  if (action === "toggle-menu") {
    const beatId = target.dataset.beatId;
    state.ui.openMenuBeatId = state.ui.openMenuBeatId === beatId ? null : beatId;
    render();
    return;
  }

  if (action === "rollback") {
    const beatId = target.dataset.beatId;
    rollbackToBeat(state.story.currentSession, beatId);
    syncStory();
    state.ui.openMenuBeatId = null;
    resetComposer();
    render();
    return;
  }

  if (action === "switch-branch") {
    switchBranch(state.story.currentSession, target.dataset.parentId, target.dataset.childId);
    syncStory();
    resetComposer();
    state.ui.openMenuBeatId = null;
    render();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }

  if (target.name === "composerInput") {
    state.ui.composerInput = target.value;
    setError("");
    updateSubmitButtonState();
    return;
  }

  if (target.name === "apiKey" || target.name === "modelId" || target.name === "customModelId") {
    state.settings = {
      ...state.settings,
      [target.name]: target.value,
    };
    syncSettings();
    if (target.name !== "apiKey") {
      render();
    }
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  if (target.name === "modelId") {
    state.settings = {
      ...state.settings,
      modelId: target.value,
    };
    syncSettings();
    render();
  }
});

render();
