// src/core.js
var BOOK_NAME = "Docs Tutor";
var TARGET_DOCS = [
  "getting-started/first-steps.md",
  "getting-started/interface-overview.md",
  "connections/setting-up.md",
  "characters/index.md",
  "characters/creating-characters.md",
  "personas/index.md",
  "chatting/starting-a-chat.md",
  "chatting/messages-and-swipes.md",
  "chatting/guided-generation.md",
  "world-books/index.md",
  "world-books/creating-entries.md",
  "world-books/keywords-and-activation.md",
  "world-books/importing-exporting.md",
  "presets/index.md",
  "presets/understanding-presets.md",
  "presets/macros-reference.md",
  "reference/troubleshooting.md"
];

// src/ui.js
function mountTutor(ctx, adapter, run) {
  const LOREBOOK_NAME = BOOK_NAME;
  let disposed = false;
  const cleanups = [];
  const alive = () => !disposed;
  const marinara = {
    addStyle(css) {
      const off = ctx.dom.addStyle(css);
      cleanups.push(off);
    },
    addElement(parent, tag, attrs) {
      const el = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "innerHTML")
          el.innerHTML = value;
        else if (key === "textContent")
          el.textContent = value;
        else
          el.setAttribute(key, value);
      }
      parent.appendChild(el);
      cleanups.push(() => el.remove());
      return el;
    },
    on(target, event, handler) {
      const wrapped = (...args) => {
        if (alive())
          Promise.resolve(handler(...args)).catch(() => {});
      };
      target.addEventListener(event, wrapped);
      cleanups.push(() => target.removeEventListener(event, wrapped));
    },
    storage: {
      get: async () => ({ buttonPos: JSON.parse(localStorage.getItem("lv-docstutor-position") || "null") }),
      patch: async (value) => {
        if (value.buttonPos)
          localStorage.setItem("lv-docstutor-position", JSON.stringify(value.buttonPos));
      }
    }
  };
  const mdtlAdapter = { ...adapter, getVersion: async () => null, versionWarning: () => null };
  const mdtlRun = async (ids, progress) => {
    const result = await run(ids, progress);
    if (disposed)
      throw Error("확장이 비활성화되었습니다.");
    return { ...result, lorebookId: result.bookId, links: result.links.map((l) => ({ ...l, characterId: l.id })) };
  };
  marinara.addStyle(`
  .mdtl-layer, .mdtl-layer *, .mdtl-button { box-sizing: border-box; }
  .mdtl-button {
    position: fixed;
    right: max(16px, env(safe-area-inset-right));
    bottom: calc(152px + env(safe-area-inset-bottom));
    z-index: 9998;
    display: grid;
    width: 48px;
    height: 48px;
    place-items: center;
    border: 1px solid var(--lumiverse-border);
    border-radius: 9999px;
    background: var(--lumiverse-bg-hover);
    color: var(--lumiverse-text);
    cursor: grab;
    font: inherit;
    font-size: 22px;
    touch-action: none;
    user-select: none;
  }
  .mdtl-button[data-dragging="true"] { cursor: grabbing; opacity: 0.85; }
  .mdtl-layer[hidden] { display: none; }
  .mdtl-layer {
    position: fixed; inset: 0; z-index: 9999;
    display: grid; place-items: center; padding: 20px;
    background: color-mix(in srgb, var(--lumiverse-bg) 72%, transparent);
  }
  .mdtl-modal {
    width: min(100%, 480px);
    max-height: min(640px, calc(100dvh - 40px));
    overflow: auto;
    border: 1px solid var(--lumiverse-border);
    border-radius: 12px;
    background: var(--lumiverse-bg-elevated);
    color: var(--lumiverse-text);
    padding: 20px;
    display: grid;
    gap: 12px;
  }
  .mdtl-modal h2 { margin: 0; font-size: 1.125rem; }
  .mdtl-modal p { margin: 0; color: var(--lumiverse-text-muted); font-size: 0.8125rem; line-height: 1.5; }
  .mdtl-modal button.mdtl-run {
    width: 100%;
    min-height: 40px;
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    background: var(--lumiverse-bg);
    color: var(--lumiverse-text);
    padding: 8px 10px;
    font: inherit;
    font-size: 0.8125rem;
  }
  .mdtl-charlist {
    max-height: 180px;
    overflow: auto;
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    background: var(--lumiverse-bg);
    color: var(--lumiverse-text);
    padding: 4px;
    display: grid;
    gap: 2px;
    font-size: 0.8125rem;
  }
  .mdtl-charlist label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
  }
  .mdtl-charlist label:hover { background: var(--lumiverse-bg-hover); }
  .mdtl-charlist input[type="checkbox"] { accent-color: var(--lumiverse-primary); flex: none; }
  .mdtl-charlist .mdtl-charlist-empty {
    padding: 8px;
    color: var(--lumiverse-text-muted);
  }
  .mdtl-modal button.mdtl-run {
    background: var(--lumiverse-primary);
    color: var(--lumiverse-text);
    border-color: var(--lumiverse-primary);
    cursor: pointer;
    font-weight: 700;
  }
  .mdtl-modal button.mdtl-run:disabled { cursor: wait; opacity: 0.6; }
  .mdtl-log {
    margin: 0;
    min-height: 60px;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    border: 1px solid var(--lumiverse-border);
    border-radius: 8px;
    background: var(--lumiverse-bg);
    padding: 8px 10px;
    font-size: 0.75rem;
    line-height: 1.6;
  }
  .mdtl-log[data-kind="error"] { color: var(--lumiverse-danger); }
  .mdtl-close { justify-self: end; background: none; border: none; color: var(--lumiverse-text-muted); cursor: pointer; font-size: 20px; }
`);
  const mdtlButton = marinara.addElement(document.body, "button", {
    type: "button",
    class: "mdtl-button",
    title: "Docs Tutor 로어북 생성·장착 — 드래그로 이동",
    "aria-label": "Docs Tutor 로어북 생성·장착",
    textContent: "\uD83D\uDCDA"
  });
  const MDTL_LOCAL_POS_KEY = "mdtl-button-pos";
  async function mdtlLoadOwnedLorebookId() {
    try {
      const value = await marinara.storage.get();
      return typeof value?.lorebookId === "string" && value.lorebookId ? value.lorebookId : null;
    } catch {
      return null;
    }
  }
  async function mdtlSaveOwnedLorebookId(id) {
    try {
      await marinara.storage.patch({ lorebookId: id });
    } catch {}
  }
  function mdtlNormalizePos(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const x = Number(value.xPercent);
    const y = Number(value.yPercent);
    if (!Number.isFinite(x) || !Number.isFinite(y))
      return null;
    return { xPercent: Math.min(100, Math.max(0, x)), yPercent: Math.min(100, Math.max(0, y)) };
  }
  async function mdtlLoadButtonPos() {
    try {
      const value = await marinara.storage.get();
      return mdtlNormalizePos(value?.buttonPos);
    } catch {
      try {
        const raw = localStorage.getItem(MDTL_LOCAL_POS_KEY);
        return raw ? mdtlNormalizePos(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    }
  }
  async function mdtlSaveButtonPos(pos) {
    try {
      await marinara.storage.patch({ buttonPos: pos });
      try {
        localStorage.removeItem(MDTL_LOCAL_POS_KEY);
      } catch {}
    } catch {
      try {
        localStorage.setItem(MDTL_LOCAL_POS_KEY, JSON.stringify(pos));
      } catch {}
    }
  }
  let mdtlButtonPos = null;
  function mdtlApplyButtonPos() {
    if (!mdtlButtonPos)
      return;
    const maxX = Math.max(0, window.innerWidth - mdtlButton.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - mdtlButton.offsetHeight);
    const x = Math.min(maxX, Math.max(0, mdtlButtonPos.xPercent / 100 * window.innerWidth));
    const y = Math.min(maxY, Math.max(0, mdtlButtonPos.yPercent / 100 * window.innerHeight));
    mdtlButton.style.left = `${x}px`;
    mdtlButton.style.top = `${y}px`;
    mdtlButton.style.right = "auto";
    mdtlButton.style.bottom = "auto";
  }
  let mdtlDrag = null;
  marinara.on(mdtlButton, "pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse")
      return;
    const rect = mdtlButton.getBoundingClientRect();
    mdtlDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    try {
      mdtlButton.setPointerCapture(event.pointerId);
    } catch {}
  });
  marinara.on(mdtlButton, "pointermove", (event) => {
    if (!mdtlDrag || event.pointerId !== mdtlDrag.pointerId)
      return;
    if (!mdtlDrag.moved) {
      if (Math.hypot(event.clientX - mdtlDrag.startX, event.clientY - mdtlDrag.startY) < 6)
        return;
      mdtlDrag.moved = true;
      mdtlButton.dataset.dragging = "true";
    }
    const maxX = Math.max(0, window.innerWidth - mdtlButton.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - mdtlButton.offsetHeight);
    const x = Math.min(maxX, Math.max(0, event.clientX - mdtlDrag.offsetX));
    const y = Math.min(maxY, Math.max(0, event.clientY - mdtlDrag.offsetY));
    mdtlButton.style.left = `${x}px`;
    mdtlButton.style.top = `${y}px`;
    mdtlButton.style.right = "auto";
    mdtlButton.style.bottom = "auto";
  });
  function mdtlEndDrag(event) {
    if (!mdtlDrag || event.pointerId !== mdtlDrag.pointerId)
      return;
    const drag = mdtlDrag;
    mdtlDrag = null;
    delete mdtlButton.dataset.dragging;
    try {
      mdtlButton.releasePointerCapture(event.pointerId);
    } catch {}
    if (!drag.moved) {
      mdtlOpenModal();
      return;
    }
    const rect = mdtlButton.getBoundingClientRect();
    mdtlButtonPos = {
      xPercent: window.innerWidth ? rect.left / window.innerWidth * 100 : 0,
      yPercent: window.innerHeight ? rect.top / window.innerHeight * 100 : 0
    };
    mdtlSaveButtonPos(mdtlButtonPos);
  }
  marinara.on(mdtlButton, "pointerup", mdtlEndDrag);
  marinara.on(mdtlButton, "pointercancel", mdtlEndDrag);
  marinara.on(window, "resize", mdtlApplyButtonPos);
  mdtlLoadButtonPos().then((pos) => {
    if (pos) {
      mdtlButtonPos = pos;
      mdtlApplyButtonPos();
    }
  });
  const mdtlLayer = marinara.addElement(document.body, "div", {
    class: "mdtl-layer",
    hidden: "",
    innerHTML: `
    <section class="mdtl-modal" role="dialog" aria-modal="true">
      <button class="mdtl-close" type="button" data-mdtl-close aria-label="닫기">×</button>
      <h2>\uD83D\uDCDA Docs Tutor 로어북</h2>
      <p>설치된 공식 가이드 영어 원문을 읽어 "${LOREBOOK_NAME}" 로어북을 생성(또는 갱신)하고 선택한 캐릭터들에 장착합니다. docs 원본은 수정하지 않으며, 재실행 시 항목만 교체됩니다.</p>
      <div class="mdtl-charlist" data-mdtl-characters role="group" aria-label="캐릭터 선택 (다중)">
        <p class="mdtl-charlist-empty">캐릭터 불러오는 중...</p>
      </div>
      <button class="mdtl-run" type="button" data-mdtl-run>로어북 생성 + 장착</button>
      <pre class="mdtl-log" data-mdtl-log>대기 중</pre>
    </section>
  `
  });
  if (!mdtlButton || !mdtlLayer) {
    throw new Error("Docs Tutor 로어북 UI를 만들 수 없습니다.");
  }
  const mdtlCharList = mdtlLayer.querySelector("[data-mdtl-characters]");
  const mdtlRunButton = mdtlLayer.querySelector("[data-mdtl-run]");
  const mdtlLog = mdtlLayer.querySelector("[data-mdtl-log]");
  const mdtlCharNames = new Map;
  function mdtlSetLog(text, kind = "info") {
    mdtlLog.textContent = text;
    mdtlLog.dataset.kind = kind;
    mdtlLog.scrollTop = mdtlLog.scrollHeight;
  }
  function mdtlEscapeHtml(text) {
    return String(text).replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch]);
  }
  function mdtlSelectedCharacterIds() {
    return [...mdtlCharList.querySelectorAll("input[type=checkbox]:checked")].map((input) => input.value);
  }
  async function mdtlPopulateCharacters() {
    try {
      const characters = await mdtlAdapter.listCharacters();
      const checked = new Set(mdtlSelectedCharacterIds());
      mdtlCharNames.clear();
      for (const c of characters)
        mdtlCharNames.set(c.id, c.name);
      mdtlCharList.innerHTML = characters.length ? characters.map((c) => `<label><input type="checkbox" value="${mdtlEscapeHtml(c.id)}"${checked.has(c.id) ? " checked" : ""}><span>${mdtlEscapeHtml(c.name)}</span></label>`).join("") : `<p class="mdtl-charlist-empty">캐릭터가 없습니다 — 먼저 캐릭터를 만드세요</p>`;
    } catch (error) {
      mdtlCharList.innerHTML = `<p class="mdtl-charlist-empty">캐릭터 목록을 불러오지 못했습니다</p>`;
      mdtlSetLog(`캐릭터 목록 오류: ${error instanceof Error ? error.message : error}`, "error");
    }
  }
  function mdtlOpenModal() {
    mdtlLayer.hidden = false;
    mdtlPopulateCharacters();
    mdtlAdapter.getVersion().then((version) => {
      const warning = mdtlAdapter.versionWarning(version);
      if (warning)
        mdtlSetLog(`⚠ ${warning}`);
    });
  }
  marinara.on(mdtlLayer.querySelector("[data-mdtl-close]"), "click", () => {
    mdtlLayer.hidden = true;
  });
  marinara.on(mdtlLayer, "click", (event) => {
    if (event.target === mdtlLayer)
      mdtlLayer.hidden = true;
  });
  marinara.on(mdtlRunButton, "click", async () => {
    const characterIds = mdtlSelectedCharacterIds();
    if (characterIds.length === 0) {
      mdtlSetLog("캐릭터를 최소 1개 선택하세요.", "error");
      return;
    }
    mdtlRunButton.disabled = true;
    mdtlRunButton.textContent = "실행 중...";
    try {
      const result = await mdtlRun(characterIds, (progress) => mdtlSetLog(progress));
      const nameOf = (id) => mdtlCharNames.get(id) ?? id;
      const linkLines = result.links.map((link) => {
        if (link.status === "linked")
          return `  ✅ ${nameOf(link.characterId)} — 링크 완료`;
        if (link.status === "already-linked")
          return `  ⏭ ${nameOf(link.characterId)} — 이미 연결됨 (변경 없음)`;
        return `  ❌ ${nameOf(link.characterId)} — 실패: ${link.error ?? "원인 불명"}`;
      });
      const failedCount = result.links.filter((l) => l.status === "failed").length;
      mdtlSetLog(`${mdtlLog.textContent}

${failedCount > 0 ? "⚠ 일부 완료" : "✅ 완료"}
` + `로어북: ${LOREBOOK_NAME} (ID ${result.lorebookId})
항목 수: ${result.total}
문서 기준: 현재 서버 가이드
` + `캐릭터별 링크 결과:
${linkLines.join(`
`)}` + (failedCount > 0 ? `

실패한 캐릭터가 있습니다. 재실행하면 실패한 캐릭터만 마저 링크됩니다 (이미 연결된 캐릭터는 건드리지 않음).` : ""), failedCount > 0 ? "error" : "info");
    } catch (error) {
      mdtlSetLog(`${mdtlLog.textContent}

❌ 실패: ${error instanceof Error ? error.message : error}
` + `다음 행동: 서버 연결·권한·공식 가이드 제공 여부를 확인한 뒤 다시 실행하세요.`, "error");
    } finally {
      mdtlRunButton.disabled = false;
      mdtlRunButton.textContent = "로어북 생성 + 장착";
    }
  });
  marinara.on(mdtlButton, "keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      mdtlOpenModal();
      mdtlLayer.querySelector("button").focus();
    }
  });
  marinara.on(mdtlLayer, "keydown", (event) => {
    if (event.key === "Escape") {
      mdtlLayer.hidden = true;
      mdtlButton.focus();
    }
    if (event.key === "Tab") {
      const focusable = [...mdtlLayer.querySelectorAll("button:not(:disabled),input")];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  return () => {
    disposed = true;
    cleanups.reverse().forEach((off) => off());
  };
}

// src/documents.js
async function readDocuments(fetcher = fetch) {
  const response = await fetcher("/api/v1/docs/catalog");
  if (!response.ok)
    throw Error(`docs를 읽지 못했습니다 (HTTP ${response.status}).`);
  const catalog = await response.json();
  if (!Array.isArray(catalog) || TARGET_DOCS.some((path) => !catalog.some((row) => row.path === path)))
    throw Error("문서 구조가 바뀌었습니다. 필요한 가이드가 없습니다.");
  const docs = [];
  for (const path of TARGET_DOCS) {
    const encoded = btoa(path).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const file = await fetcher(`/api/v1/docs/file/${encoded}`);
    if (!file.ok)
      throw Error(`docs/${path} 읽기 실패 (HTTP ${file.status}).`);
    const content = await file.text();
    if (!content.trim() || content.length > 150000 || /^\s*<!doctype html/i.test(content))
      throw Error(`docs/${path} 응답을 확인할 수 없습니다.`);
    docs.push({ path, content });
  }
  return docs;
}
function discoverLocaleModules(source, sourceUrl) {
  const regex = /["']\.\/locales\/(en|ko)\/([\w-]+)\.json["']\s*:\s*\(\)\s*=>[^;]{0,80}?import\([`"'](\.\/i18n\/(?:en|ko)-[\w-]+\.js)[`"']\)\.then\((\w+)\s*=>\s*\4\.(\w+)\)/g;
  return [...source.matchAll(regex)].map((m) => ({ language: m[1], namespace: m[2], url: new URL(m[3], sourceUrl).href, exportName: m[5] }));
}
async function loadInstalledLocales(refs, loader = (url) => import(url)) {
  const result = { en: {}, ko: {} };
  if (!refs.some((r) => r.language === "ko"))
    return result;
  const cache = new Map;
  for (const ref of refs) {
    if (!cache.has(ref.url))
      cache.set(ref.url, await loader(ref.url));
    const value = cache.get(ref.url)?.[ref.exportName]?.default;
    if (value && typeof value === "object")
      result[ref.language][ref.namespace] = value;
  }
  return result;
}
async function hostLocales(document2, fetcher = fetch) {
  const sources = [...document2.querySelectorAll('script[src],link[rel="modulepreload"][href]')].map((el) => new URL(el.src || el.href, document2.baseURI)).filter((url) => url.origin === location.origin && /^\/assets\/[\w-]+\.js$/.test(url.pathname));
  for (const url of sources.slice(0, 8)) {
    const response = await fetcher(url.href);
    if (!response.ok)
      continue;
    const refs = discoverLocaleModules(await response.text(), url.href);
    if (refs.some((r) => r.language === "ko"))
      return loadInstalledLocales(refs);
  }
  return { en: {}, ko: {} };
}

// src/ids.js
var hex = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function uuid() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function")
    return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function")
    c.getRandomValues(b);
  else
    for (let i = 0;i < 16; i++)
      b[i] = Math.floor(Math.random() * 256);
  b[6] = 64 | b[6] & 15;
  b[8] = 128 | b[8] & 63;
  const h = [...b].map((n) => hex[n]);
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}

// src/frontend.js
function setup(ctx) {
  let alive = true;
  const controller = new AbortController, pending = new Map;
  const rpc = (op, args = {}) => new Promise((resolve, reject) => {
    if (!alive)
      return reject(Error("확장이 비활성화되었습니다."));
    const id = uuid();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error("응답 시간 초과. 서버 변경이 일부 완료되었을 수 있습니다. 상태를 확인한 뒤 재실행하세요."));
    }, 300000);
    pending.set(id, { resolve, reject, timer });
    ctx.sendToBackend({ id, op, args });
  });
  const off = ctx.onBackendMessage((message) => {
    const item = pending.get(message?.id);
    if (!item)
      return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error)
      item.reject(Error(message.error));
    else
      item.resolve(message.result);
  });
  const fetcher = (url) => fetch(url, { credentials: "same-origin", signal: controller.signal });
  const unmount = mountTutor(ctx, { listCharacters: () => rpc("characters") }, async (characterIds, progress) => {
    progress("공식 가이드 영어 원문 읽는 중... (번역·모델 호출 없음)");
    const docs = await readDocuments(fetcher);
    progress("설치된 한국어 UI 단어집 확인 중...");
    let locales;
    try {
      locales = await hostLocales(document, fetcher);
    } catch {
      locales = { en: {}, ko: {} };
    }
    if (!alive)
      throw Error("확장이 비활성화되었습니다.");
    progress(`docs ${docs.length}편 읽기 완료. 로어북 항목 갱신·장착 중...`);
    const result = await rpc("run", { docs, locales, characterIds });
    progress(`항목 ${result.total}개 · 상시 지시문+단어집 ${result.constantCharacters}자 · 설치 UI 대응 ${result.localeTerms}개`);
    return result;
  });
  return () => {
    alive = false;
    controller.abort();
    unmount();
    off();
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(Error("확장이 비활성화되었습니다."));
    }
    pending.clear();
  };
}
export {
  setup
};
