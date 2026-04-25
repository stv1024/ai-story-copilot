<script setup>
import { computed, onMounted, onUnmounted, reactive } from "vue";

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

const state = reactive({
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
});

if (!state.story?.currentSession) {
  state.story = createStoryState();
}

const activeLine = computed(() => getActiveLine(state.story.currentSession));
const activeBeat = computed(() =>
  state.story.currentSession.activeBeatId
    ? state.story.currentSession.beatsById[state.story.currentSession.activeBeatId]
    : null,
);
const suggestions = computed(() => activeBeat.value?.suggestions || []);
const effectiveModelId = computed(() =>
  (state.settings.customModelId || state.settings.modelId || DEFAULT_MODEL_ID).trim(),
);
const settingsReady = computed(() => Boolean(state.settings.apiKey.trim()));
const pendingInput = computed(() => {
  const customInput = state.ui.composerInput.trim();
  if (customInput) {
    return customInput;
  }

  if (
    activeBeat.value &&
    Number.isInteger(state.ui.selectedSuggestionIndex) &&
    activeBeat.value.suggestions[state.ui.selectedSuggestionIndex]
  ) {
    return activeBeat.value.suggestions[state.ui.selectedSuggestionIndex];
  }

  return "";
});
const lastBeat = computed(() => activeLine.value[activeLine.value.length - 1] || null);

function getRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash === "/settings" ? "settings" : "story";
}

function setRoute(route) {
  window.location.hash = route === "settings" ? "/settings" : "/story";
  state.route = route;
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

function splitParagraphs(text) {
  return String(text || "")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split("\n"));
}

function getBranchLabel(beat) {
  const seed = beat.userInput || beat.content;
  const text = seed.trim().replace(/\s+/g, " ");
  const excerpt = Array.from(text).slice(0, 12).join("");
  return excerpt.length < text.length ? `${excerpt}...` : excerpt;
}

function getBranches(beat) {
  return getBeatBranchOptions(state.story.currentSession, beat.id);
}

function shouldShowBranches(beat) {
  const branches = getBranches(beat);
  return branches.length > 1 || (state.story.currentSession.activeBeatId === beat.id && branches.length === 1);
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
}

function updateSetting(key, value) {
  state.settings = {
    ...state.settings,
    [key]: value,
  };
  syncSettings();
}

function pickSuggestion(index) {
  state.ui.selectedSuggestionIndex = index;
  setError("");
}

async function handleSubmitTurn() {
  const userInput = pendingInput.value;

  if (!userInput) {
    setError("请先选择一个建议梗概，或者输入你自己的剧情走向。");
    return;
  }

  state.ui.generating = true;
  state.ui.error = "";
  state.ui.openMenuBeatId = null;

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
  }
}

function handleNewStory() {
  if (window.confirm("确定要开始一个新的故事吗？当前故事会被替换为新的空白会话。")) {
    resetStory();
  }
}

function handleClearStoryData() {
  if (window.confirm("确定清除所有故事数据吗？设置里的 API Key 和模型不会被删除。")) {
    clearStoryState();
    resetStory();
  }
}

function toggleMenu(beatId) {
  state.ui.openMenuBeatId = state.ui.openMenuBeatId === beatId ? null : beatId;
}

function rollback(beatId) {
  rollbackToBeat(state.story.currentSession, beatId);
  syncStory();
  state.ui.openMenuBeatId = null;
  resetComposer();
}

function chooseBranch(parentId, childId) {
  switchBranch(state.story.currentSession, parentId, childId);
  syncStory();
  resetComposer();
  state.ui.openMenuBeatId = null;
}

function handleGlobalClick(event) {
  if (!event.target.closest("[data-menu-scope]") && state.ui.openMenuBeatId) {
    state.ui.openMenuBeatId = null;
  }
}

function handleHashChange() {
  state.route = getRoute();
  state.ui.openMenuBeatId = null;
}

onMounted(() => {
  window.addEventListener("hashchange", handleHashChange);
  document.addEventListener("click", handleGlobalClick);
});

onUnmounted(() => {
  window.removeEventListener("hashchange", handleHashChange);
  document.removeEventListener("click", handleGlobalClick);
});
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <h1>{{ APP_TITLE }}</h1>
        <p>Story Beat 驱动的移动端故事共创器</p>
      </div>
      <nav class="nav-tabs" aria-label="主导航">
        <button class="nav-tab" :class="{ 'is-active': state.route === 'story' }" type="button" @click="setRoute('story')">
          故事创作
        </button>
        <button class="nav-tab" :class="{ 'is-active': state.route === 'settings' }" type="button" @click="setRoute('settings')">
          设置
        </button>
      </nav>
    </header>

    <div v-if="state.route === 'story'" class="page">
      <section v-if="state.ui.error" class="notice-card">
        <strong>出错了</strong>
        <p class="section-copy">{{ state.ui.error }}</p>
      </section>

      <section class="hero-card">
        <h2 class="hero-title">一轮一轮，把故事推进下去</h2>
        <p class="hero-copy">每次只生成一个新的故事节拍。你可以选建议梗概，也可以自己决定剧情走向；中途回退后，旧后续会保留为分支。</p>
        <div class="action-row hero-status-row">
          <span class="status-chip">{{ settingsReady ? "OpenRouter 已配置" : "请先配置 OpenRouter" }}</span>
          <span class="status-chip mono">{{ effectiveModelId || DEFAULT_MODEL_ID }}</span>
          <span class="status-chip">{{ activeLine.length ? `当前主线 ${activeLine.length} 个节拍` : "故事尚未开始" }}</span>
          <span v-if="lastBeat" class="status-chip">最新更新 {{ formatTime(lastBeat.createdAt) }}</span>
        </div>
        <div class="action-row hero-action-row">
          <button class="secondary-button" type="button" @click="handleNewStory">新建故事</button>
          <button class="secondary-button" type="button" @click="setRoute('settings')">打开设置</button>
        </div>
      </section>

      <div class="story-layout">
        <section v-if="!activeLine.length" class="empty-card">
          <h2>从第一个故事节拍开始</h2>
          <p class="section-copy">先输入世界观、角色、冲突，或者直接写出第一步剧情。生成完成后，界面会同时给你两个下一步梗概建议。</p>
        </section>

        <section v-else class="story-stream" aria-label="故事主线">
          <div v-for="(beat, index) in activeLine" :key="beat.id" class="beat-shell">
            <article class="beat-card" :id="`beat-${beat.id}`">
              <div class="beat-meta">
                <span class="beat-index">Story Beat {{ index + 1 }}</span>
                <span class="beat-user-input">由你的输入触发：{{ beat.userInput }}</span>
              </div>
              <div class="beat-content">
                <p v-for="(paragraph, paragraphIndex) in splitParagraphs(beat.content)" :key="paragraphIndex">
                  <template v-for="(line, lineIndex) in paragraph" :key="lineIndex">
                    <br v-if="lineIndex > 0" />
                    {{ line }}
                  </template>
                </p>
              </div>
            </article>

            <section v-if="shouldShowBranches(beat)" class="branch-card">
              <div class="branch-header">
                <h3>{{ getBranches(beat).length > 1 ? "后续版本" : "现有后续" }}</h3>
                <p class="muted-text">
                  {{ getBranches(beat).length > 1 ? "回退后保留的分支可以在这里切换。" : "你回退后，原来的后续还保留着，可以一键接回。" }}
                </p>
              </div>
              <div class="branch-grid">
                <button
                  v-for="(option, optionIndex) in getBranches(beat)"
                  :key="option.id"
                  class="branch-pill"
                  :class="{ 'is-active': state.story.currentSession.selectedChildByParent[beat.id] === option.id }"
                  type="button"
                  @click="chooseBranch(beat.id, option.id)"
                >
                  {{ getBranches(beat).length > 1 ? `版本 ${optionIndex + 1} · ` : "继续 · " }}{{ getBranchLabel(option) }}
                </button>
              </div>
            </section>

            <div
              v-if="index < activeLine.length - 1"
              class="connector"
              :class="{ 'is-open': state.ui.openMenuBeatId === beat.id }"
              data-menu-scope
            >
              <button
                class="overflow-button"
                type="button"
                :aria-expanded="state.ui.openMenuBeatId === beat.id ? 'true' : 'false'"
                aria-label="更多操作"
                @click.stop="toggleMenu(beat.id)"
              >
                <span>&#8942;</span>
              </button>
              <div v-if="state.ui.openMenuBeatId === beat.id" class="overflow-menu" role="menu">
                <button class="menu-button" type="button" role="menuitem" @click="rollback(beat.id)">回退到这里</button>
              </div>
            </div>
          </div>
        </section>

        <section class="composer-card">
          <div class="composer-header">
            <div>
              <h2>下一轮输入</h2>
              <p class="section-copy">先选择建议梗概，或直接输入你想要的剧情走向。确认按钮是第二步，避免误操作。</p>
            </div>
            <span class="status-chip">{{ state.ui.generating ? "正在生成中" : "等待你的选择" }}</span>
          </div>

          <div class="composer-section">
            <span class="composer-label">建议梗概</span>
            <div class="toggle-group" role="radiogroup" aria-label="下一步建议">
              <button
                v-for="(suggestion, index) in suggestions"
                :key="`${index}-${suggestion}`"
                class="toggle-pill"
                :class="{ 'is-active': state.ui.selectedSuggestionIndex === index }"
                type="button"
                :aria-pressed="state.ui.selectedSuggestionIndex === index ? 'true' : 'false'"
                @click="pickSuggestion(index)"
              >
                {{ suggestion }}
              </button>
              <p v-if="!suggestions.length" class="muted-text">第一轮还没有建议梗概。先输入你的开场设定。</p>
            </div>
          </div>

          <div class="composer-section">
            <label class="field-label" for="free-input">自由输入</label>
            <textarea
              id="free-input"
              v-model="state.ui.composerInput"
              class="free-input"
              name="composerInput"
              placeholder="例如：让主角在废弃剧院里发现一封来自未来的来信。"
              @input="setError('')"
            />
            <p class="field-help">若这里有内容，将优先使用你的自由输入；否则使用你选中的建议梗概。</p>
          </div>

          <div class="action-row">
            <button class="primary-button" type="button" :disabled="state.ui.generating || !pendingInput || !settingsReady" @click="handleSubmitTurn">
              确认并生成下一节拍
            </button>
            <button class="secondary-button" type="button" @click="resetComposer(); setError('')">清空本轮选择</button>
          </div>

          <p v-if="!settingsReady" class="field-help">生成前请先到设置页填写 OpenRouter API Key。</p>
        </section>
      </div>

      <p class="footer-note">提示词模板已拆到 <span class="mono">/prompts/*.txt</span>，方便后续持续调优。</p>
    </div>

    <div v-else class="page">
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
              :type="state.ui.revealApiKey ? 'text' : 'password'"
              :value="state.settings.apiKey"
              placeholder="sk-or-v1-..."
              autocomplete="off"
              spellcheck="false"
              @input="updateSetting('apiKey', $event.target.value)"
            />
          </label>

          <label>
            <span class="field-label">推荐模型</span>
            <select class="select-input" :value="state.settings.modelId" @change="updateSetting('modelId', $event.target.value)">
              <option v-for="option in MODEL_OPTIONS" :key="option.id" :value="option.id">{{ option.label }} · {{ option.note }}</option>
            </select>
          </label>

          <label>
            <span class="field-label">自定义模型 ID</span>
            <input
              class="text-input mono"
              type="text"
              :value="state.settings.customModelId"
              placeholder="留空则使用上面的推荐模型"
              spellcheck="false"
              @input="updateSetting('customModelId', $event.target.value)"
            />
          </label>
        </div>

        <div class="settings-actions">
          <button class="secondary-button" type="button" @click="state.ui.revealApiKey = !state.ui.revealApiKey">
            {{ state.ui.revealApiKey ? "隐藏 API Key" : "显示 API Key" }}
          </button>
          <button class="danger-button" type="button" @click="handleClearStoryData">清除故事数据</button>
        </div>

        <div class="notice-card">
          <strong>当前生效模型</strong>
          <p class="section-copy mono">{{ effectiveModelId }}</p>
        </div>

        <p class="footer-note">
          默认推荐名单包含 <span class="mono">DeepSeek V3.2</span>、<span class="mono">Claude Sonnet 4.5</span>、<span class="mono">Qwen3 32B</span> 和
          <span class="mono">openrouter/auto</span>。
        </p>
      </section>
    </div>
  </main>
</template>
