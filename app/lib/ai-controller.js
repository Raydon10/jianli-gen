import {
  escapeHtml,
  normalizeAiText,
  getSharedTextBounds,
  isSpanSaved,
  getTokenLabel,
  getDisplayTokenLabel,
  getTokenStorageLabel,
  parseTokenLabel,
  maskText,
  unmaskText,
  getPublicBullets
} from "./text.js";
import {
  getFieldColorMap,
  getTokenMappings,
  privateFingerprint
} from "./workspace-shared.js";

function normalizePlainTextSegment(text, caretIndex = null) {
  const normalized = normalizeAiText(text || "");
  return {
    text: normalized,
    caretIndex
  };
}

export function setupAiController(state, api) {
  function prepareResumePreviewHtml(html) {
    const previewStyle = `<style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box !important; }
      html, body {
        width: 794px !important;
        min-width: 794px !important;
        max-width: 794px !important;
        min-height: 1123px !important;
        margin: 0 !important;
        overflow: hidden !important;
        background: #fff !important;
      }
      .resume {
        width: 794px !important;
        min-width: 794px !important;
        max-width: 794px !important;
        min-height: 1123px !important;
        margin: 0 !important;
      }
    </style>`;
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `${previewStyle}</head>`);
    }
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${previewStyle}</head><body>${html}</body></html>`;
  }

  function renderResumeFrame(html, title = "简历预览") {
    if (!state.resumePreview) {
      return;
    }
    const previewHtml = prepareResumePreviewHtml(html);
    state.currentResumeHtml = previewHtml;
    state.resumePreview.innerHTML = `
      <div class="resume-paper">
        <iframe class="resume-frame" title="${escapeHtml(title)}" sandbox srcdoc="${escapeHtml(previewHtml)}"></iframe>
      </div>
    `;
    api.updateResumePreviewScale?.();
  }

  function buildDefaultResumeHtml(body) {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #20242a; font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif; }
    .resume { width: 794px; min-height: 1123px; padding: 42px 48px; background: #fff; line-height: 1.5; }
    .resume-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 22px; }
    .resume-name { font-size: 28px; font-weight: 800; }
    .resume-title { margin-top: 5px; color: #4b5563; font-size: 14px; }
    .resume-contact { color: #4b5563; font-size: 12px; line-height: 1.65; text-align: right; }
    .entry-heading { display: flex; justify-content: space-between; gap: 16px; margin: 12px 0 5px; }
    .entry-main { font-weight: 760; }
    .entry-meta { color: #5f6875; font-size: 12px; white-space: nowrap; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #b8c0cc; font-size: 16px; }
    h3 { margin: 14px 0 6px; font-size: 14px; }
    p { margin: 7px 0; }
    ul { margin: 7px 0 12px 20px; padding: 0; }
    li { margin: 4px 0; }
    strong { font-weight: 750; }
    a { color: inherit; }
  </style>
</head>
<body>
  <article class="resume">${body}</article>
</body>
</html>`;
  }

  function clearTemplateSelection() {
    state.selectedTemplateId = "";
    state.templateList?.querySelectorAll(".template-card").forEach(card => {
      card.classList.remove("is-selected");
    });
  }

  function serializedNodeLength(node) {
    if (!node) {
      return 0;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.length || 0;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return 0;
    }
    const element = node;
    if (element.classList.contains("token-chip")) {
      return getDisplayTokenLabel(element.dataset.tokenKey || "").length;
    }
    if (element.tagName === "BR") {
      return 1;
    }
    let total = 0;
    element.childNodes.forEach(child => {
      total += serializedNodeLength(child);
    });
    if (element.tagName === "DIV" || element.tagName === "P") {
      total += 1;
    }
    return total;
  }

  function getSerializedCaretIndex(root, range) {
    let index = 0;
    let found = false;

    const visit = node => {
      if (found || !node) {
        return;
      }

      if (node === range.startContainer) {
        found = true;
        if (node.nodeType === Node.TEXT_NODE) {
          index += range.startOffset;
          return;
        }
        const element = node;
        for (let i = 0; i < range.startOffset; i += 1) {
          index += serializedNodeLength(element.childNodes[i]);
        }
        return;
      }

      if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
        index += serializedNodeLength(node);
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        node.childNodes.forEach(visit);
      }
    };

    visit(root);
    return index;
  }

  function resolveSerializedPosition(root, targetIndex) {
    let index = 0;

    const walk = node => {
      if (!node) {
        return null;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const length = node.textContent?.length || 0;
        if (targetIndex <= index + length) {
          return {
            node,
            offset: Math.max(0, targetIndex - index)
          };
        }
        index += length;
        return null;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }
      const element = node;
      if (element.classList.contains("token-chip")) {
        const tokenLength = getDisplayTokenLabel(element.dataset.tokenKey || "").length;
        const parent = element.parentNode;
        const childIndex = parent ? Array.prototype.indexOf.call(parent.childNodes, element) : 0;
        if (targetIndex <= index) {
          return {
            node: parent || root,
            offset: childIndex
          };
        }
        if (targetIndex <= index + tokenLength) {
          return {
            node: parent || root,
            offset: childIndex + 1
          };
        }
        index += tokenLength;
        return null;
      }

      for (const child of element.childNodes) {
        const resolved = walk(child);
        if (resolved) {
          return resolved;
        }
      }

      if (node === root) {
        return {
          node: root,
          offset: root.childNodes.length
        };
      }

      return null;
    };

    return walk(root) || {
      node: root,
      offset: root.childNodes.length
    };
  }

  function resolveTokenField(token) {
    const parsed = parseTokenLabel(token);
    return parsed.id
      ? state.fields.find(item => item.id === parsed.id) || state.fields.find(item => item.key === parsed.key)
      : state.fields.find(item => item.key === parsed.key);
  }

  function buildTokenChip(fieldOrKey, options = {}) {
    const {
      tokenValue = "",
      tokenState = "saved",
      tokenSource = "literal-token"
    } = options;
    const field = typeof fieldOrKey === "object" ? fieldOrKey : resolveTokenField(fieldOrKey);
    const key = field?.key || parseTokenLabel(fieldOrKey).key;
    const token = field ? getTokenStorageLabel(field) : getTokenLabel(key);
    const span = document.createElement("span");
    span.className = "token-chip";
    span.dataset.tokenState = tokenState;
    span.dataset.tokenSource = tokenSource;
    span.contentEditable = "false";
    span.dataset.tokenKey = token;
    if (field?.id) {
      span.dataset.tokenId = field.id;
    }
    span.dataset.tokenValue = tokenValue;
    if (field?.color) {
      span.style.setProperty("--token-color", field.color);
    }
    span.textContent = getTokenLabel(key);
    return span;
  }

  function appendValueMatches(fragment, text) {
    const active = getTokenMappings(state);
    let cursor = 0;

    while (cursor < text.length) {
      let bestField = null;
      let bestIndex = -1;

      for (const field of active) {
        if (!field.value) {
          continue;
        }
        const index = text.indexOf(field.value, cursor);
        if (index === -1) {
          continue;
        }
        if (bestIndex === -1 || index < bestIndex || (index === bestIndex && field.value.length > (bestField?.value?.length || 0))) {
          bestField = field;
          bestIndex = index;
        }
      }

      if (!bestField) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
        return;
      }

      if (bestIndex > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, bestIndex)));
      }

      fragment.appendChild(buildTokenChip(bestField, {
        tokenValue: bestField.value,
        tokenState: isSpanSaved(bestIndex, bestIndex + bestField.value.length, getSharedTextBounds(text, state.savedMaskedPublicMarkdown || ""), text, state.savedMaskedPublicMarkdown || "")
          ? "saved"
          : "provisional",
        tokenSource: bestField.source === "saved" ? "saved-value" : "value-match"
      }));
      cursor = bestIndex + bestField.value.length;
    }
  }

  function buildAiEditorFragment(text) {
    const source = normalizeAiText(text || "");
    const fragment = document.createDocumentFragment();
    const tokenPattern = /\{\{([^{}]+)\}\}/g;
    let cursor = 0;
    let match = tokenPattern.exec(source);

    while (match) {
      if (match.index > cursor) {
        appendValueMatches(fragment, source.slice(cursor, match.index));
      }

      const parsed = parseTokenLabel(match[0]);
      const field = parsed.id
        ? state.fields.find(item => item.id === parsed.id)
        : state.fields.find(item => item.key === parsed.key);
      if (field) {
        fragment.appendChild(buildTokenChip(field, {
          tokenValue: field.value,
          tokenState: "saved",
          tokenSource: "saved-token"
        }));
      } else {
        fragment.appendChild(document.createTextNode(match[0]));
      }

      cursor = match.index + match[0].length;
      match = tokenPattern.exec(source);
    }

    if (cursor < source.length) {
      appendValueMatches(fragment, source.slice(cursor));
    }

    return fragment;
  }

  function serializeAiEditor(root = state.maskedPreview) {
    if (state.aiEditor) {
      return state.aiEditor.getSourceText();
    }

    const walk = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }
      const element = node;
      if (element.classList.contains("token-chip")) {
        return element.dataset.tokenKey || getTokenLabel(element.textContent || "");
      }
      if (element.tagName === "BR") {
        return "\n";
      }
      let output = "";
      element.childNodes.forEach(child => {
        output += walk(child);
      });
      if (element.tagName === "DIV" || element.tagName === "P") {
        output += "\n";
      }
      return output;
    };

    return walk(root).replace(/\n$/, "");
  }

  api.serializeAiEditor = serializeAiEditor;

  api.renderAiEditor = function renderAiEditor() {
    api.mountAiEditor();
    if (state.aiEditor) {
      const nextText = state.publicDraftMarkdown || "";
      const nextSignature = `${normalizeAiText(nextText)}\u0000${privateFingerprint(state)}`;
      if (state.aiEditor.getSourceText() !== nextText) {
        state.aiEditor.setSourceText(nextText);
        state.aiRenderSignature = nextSignature;
      } else if (state.aiRenderSignature !== nextSignature) {
        state.aiEditor.refreshFields?.();
        state.aiRenderSignature = nextSignature;
      }
      return;
    }

    if (!state.maskedPreview) {
      return;
    }

    state.maskedPreview.innerHTML = "";
    if (state.publicDraftMarkdown) {
      state.maskedPreview.appendChild(buildAiEditorFragment(state.publicDraftMarkdown));
    }
  };

  api.normalizeAndRenderAiEditor = function normalizeAndRenderAiEditor(forceRender = false) {
    api.mountAiEditor();
    if (state.aiEditor) {
      return true;
    }

    if (!state.maskedPreview) {
      return;
    }

    const selection = window.getSelection();
    const activeRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const hasCaret = Boolean(activeRange && state.maskedPreview.contains(activeRange.commonAncestorContainer));
    const caretIndex = hasCaret ? getSerializedCaretIndex(state.maskedPreview, activeRange) : null;
    const currentText = serializeAiEditor();
    const normalized = normalizePlainTextSegment(currentText, caretIndex);
    state.publicDraftMarkdown = normalized.text;
    if (!forceRender && normalized.text === currentText) {
      return false;
    }

    api.renderAiEditor();

    if (hasCaret && normalized.caretIndex != null) {
      const resolved = resolveSerializedPosition(state.maskedPreview, normalized.caretIndex);
      window.requestAnimationFrame(() => {
        const currentSelection = window.getSelection();
        if (!currentSelection) {
          return;
        }
        const nextRange = document.createRange();
        nextRange.setStart(resolved.node, resolved.offset);
        nextRange.collapse(true);
        currentSelection.removeAllRanges();
        currentSelection.addRange(nextRange);
      });
    }

    return true;
  };

  api.syncMaskedPublicText = function syncMaskedPublicText() {
    state.publicDraftMarkdown = normalizeAiText(serializeAiEditor());
    api.updateOutput();
    api.renderStatus();
  };

  api.refreshPublicDraftFromEditor = function refreshPublicDraftFromEditor() {
    state.publicDraftMarkdown = normalizeAiText(serializeAiEditor());
    return state.publicDraftMarkdown;
  };

  api.mountAiEditor = function mountAiEditor() {
    if (state.aiEditor || typeof window.createJianliEditor !== "function" || !state.maskedPreview) {
      return;
    }

    state.aiEditor = window.createJianliEditor(state.maskedPreview, {
      initialText: state.publicDraftMarkdown || state.savedMaskedPublicMarkdown || "",
      getFields: () => state.fields,
      placeholder: "AI 读取的脱敏简历会在这里显示",
      onChange: text => {
        state.publicDraftMarkdown = text;
        state.aiRenderSignature = `${normalizeAiText(text)}\u0000${privateFingerprint(state)}`;
        api.updateOutput();
        api.renderStatus();
      },
      onFocusChange: focused => {
        state.aiEditorFocused = focused;
      }
    });
    state.aiRenderSignature = `${normalizeAiText(state.aiEditor.getSourceText() || state.publicDraftMarkdown || "")}\u0000${privateFingerprint(state)}`;
  };

  api.scheduleAiNormalization = function scheduleAiNormalization() {
    if (state.aiNormalizeTimer) {
      clearTimeout(state.aiNormalizeTimer);
    }

    state.aiNormalizeTimer = window.setTimeout(() => {
      state.aiNormalizeTimer = null;
      api.normalizeAndRenderAiEditor(false);
      api.updateOutput();
      api.renderStatus();
    }, 260);
  };

  api.updateOutput = function updateOutput() {
    api.generateResumePreview();
  };

  api.updateResumePreviewScale = function updateResumePreviewScale() {
    const paper = state.resumePreview?.querySelector(".resume-paper");
    if (!paper || !state.resumePreview) {
      return;
    }
    const previewStyle = getComputedStyle(state.resumePreview);
    const horizontalPadding = parseFloat(previewStyle.paddingLeft || "0") + parseFloat(previewStyle.paddingRight || "0");
    const availableWidth = Math.max(0, state.resumePreview.clientWidth - horizontalPadding);
    const scale = Math.min(1, availableWidth / 794);
    paper.style.setProperty("--paper-scale", String(scale || 1));
  };

  api.readPrivateValue = function readPrivateValue(key, fallback = "") {
    return state.fields.find(field => field.key === key)?.value || fallback;
  };

  api.generateResumePreview = function generateResumePreview() {
    clearTemplateSelection();
    const previewText = state.aiEditor
      ? state.aiEditor.serializeResolved?.(state.privateUnlocked && state.privateValuesResolved) || state.publicDraftMarkdown
      : state.privateUnlocked && state.privateValuesResolved
        ? unmaskText(state.publicDraftMarkdown, state.fields)
        : maskText(state.publicDraftMarkdown, getTokenMappings(state), getFieldColorMap(state.fields));
    const bullets = getPublicBullets(previewText || state.savedMaskedPublicMarkdown || "");
    const name = api.readPrivateValue("姓名", "候选人");
    const city = api.readPrivateValue("城市", "城市");
    const phone = api.readPrivateValue("手机", "手机");
    const email = api.readPrivateValue("邮箱", "邮箱");
    const company = api.readPrivateValue("公司", "公司");
    const bulletHtml = bullets.map(item => `<li>${escapeHtml(item)}</li>`).join("");

    const body = `
      <header class="resume-header">
        <div>
          <div class="resume-name">${escapeHtml(name)}</div>
          <div class="resume-title">后端工程师</div>
        </div>
        <div class="resume-contact">
          <div>${escapeHtml(city)}</div>
          <div>${escapeHtml(phone)}</div>
          <div>${escapeHtml(email)}</div>
        </div>
      </header>

      <section>
        <h2>个人总结</h2>
        <p>具备后端系统设计、性能优化和业务交付经验，能够围绕稳定性、可维护性和产品目标推进工程实现。</p>
      </section>

      <section>
        <h2>工作经历</h2>
        <div class="entry-heading">
          <div>
            <div class="entry-main">${escapeHtml(company)}｜后端工程师</div>
            <div>核心业务系统与数据服务</div>
          </div>
          <div class="entry-meta">2021.06 - 至今</div>
        </div>
        <ul>${bulletHtml}</ul>
      </section>

      <section>
        <h2>技能</h2>
        <p>Java / Spring Boot / MySQL / Redis / Kafka / REST API / Docker / Linux</p>
      </section>
    `;
    renderResumeFrame(buildDefaultResumeHtml(body), "简历预览");
  };

  api.renderTemplateList = function renderTemplateList(templates = []) {
    if (!state.templateList) {
      return;
    }
    if (!templates.length) {
      state.templateList.innerHTML = `<div class="empty-hint">暂无简历模版</div>`;
      return;
    }
    state.templateList.innerHTML = templates.map(template => `
      <button class="template-card" type="button" data-template-id="${escapeHtml(template.id)}">
        <span class="template-thumb" aria-hidden="true">
          <iframe class="template-thumb-frame" tabindex="-1" sandbox srcdoc="${escapeHtml(template.previewHtml || "")}"></iframe>
          <span class="template-name">${escapeHtml(template.name)}</span>
        </span>
      </button>
    `).join("");
    state.templateList.querySelectorAll("[data-template-id]").forEach(button => {
      button.addEventListener("click", () => api.previewResumeTemplate(button.dataset.templateId || ""));
    });
    requestAnimationFrame(() => api.updateTemplateScrollControls?.());
  };

  api.updateTemplateScrollControls = function updateTemplateScrollControls() {
    if (!state.templateList) {
      return;
    }
    const hasOverflow = state.templateList.scrollWidth > state.templateList.clientWidth + 1;
    state.templateList.classList.toggle("has-overflow", hasOverflow);
    if (state.templateScrollLeftButton) {
      state.templateScrollLeftButton.hidden = !hasOverflow;
    }
    if (state.templateScrollRightButton) {
      state.templateScrollRightButton.hidden = !hasOverflow;
    }
  };

  api.scrollTemplateList = function scrollTemplateList(direction) {
    if (!state.templateList) {
      return;
    }
    const card = state.templateList.querySelector(".template-card");
    const distance = card ? card.getBoundingClientRect().width + 12 : 132;
    state.templateList.scrollBy({
      left: direction * distance,
      behavior: "smooth"
    });
  };

  api.loadResumeTemplates = async function loadResumeTemplates() {
    if (!state.templateList) {
      return;
    }
    try {
      const response = await fetch("/api/resume-templates");
      if (!response.ok) {
        throw new Error("简历模版读取失败");
      }
      const payload = await response.json();
      const templates = Array.isArray(payload.templates) ? payload.templates : [];
      const templatesWithPreview = await Promise.all(templates.map(async template => {
        try {
          const templateResponse = await fetch(`/api/resume-templates/${encodeURIComponent(template.id)}`);
          if (!templateResponse.ok) {
            throw new Error("简历模版读取失败");
          }
          return {
            ...template,
            previewHtml: prepareResumePreviewHtml(await templateResponse.text())
          };
        } catch {
          return {
            ...template,
            previewHtml: ""
          };
        }
      }));
      api.renderTemplateList(templatesWithPreview);
    } catch {
      state.templateList.innerHTML = `<div class="empty-hint">简历模版读取失败</div>`;
    }
  };

  api.previewResumeTemplate = async function previewResumeTemplate(templateId) {
    if (!templateId || !state.resumePreview) {
      return;
    }
    if (state.selectedTemplateId === templateId) {
      clearTemplateSelection();
      api.generateResumePreview();
      return;
    }
    try {
      const response = await fetch(`/api/resume-templates/${encodeURIComponent(templateId)}`);
      if (!response.ok) {
        throw new Error("简历模版读取失败");
      }
      const html = await response.text();
      state.selectedTemplateId = templateId;
      renderResumeFrame(html, "简历模版预览");
      state.templateList?.querySelectorAll(".template-card").forEach(card => {
        card.classList.toggle("is-selected", card.dataset.templateId === templateId);
      });
    } catch {
      api.setStatus("简历模版读取失败", "warning");
    }
  };
}
