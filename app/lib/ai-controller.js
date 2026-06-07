import {
  escapeHtml,
  normalizeAiText,
  escapeRegExp,
  getSharedTextBounds,
  isSpanSaved,
  getTokenLabel,
  getDisplayTokenLabel,
  getTokenStorageLabel,
  parseTokenLabel
} from "./text.js";
import {
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
      * {
        box-sizing: border-box !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }
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
      .resume-private-image {
        display: block;
        max-width: 100%;
        height: auto;
        object-fit: contain;
      }
    </style>`;
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `${previewStyle}</head>`);
    }
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${previewStyle}</head><body>${html}</body></html>`;
  }

  function renderResumeFrame(html, title = "简历预览", options = {}) {
    if (!state.resumePreview) {
      return;
    }
    const previewHtml = prepareResumePreviewHtml(html);
    state.currentResumeHtml = previewHtml;
    state.currentResumeResolved = Boolean(options.privateResolved);
    state.currentResumeRenderedValues = options.privateResolved
      ? Object.fromEntries(state.fields.map(field => [field.id || field.key, String(field.value || "")]))
      : {};
    state.resumePreview.innerHTML = `
      ${options.privateLockedHint ? '<div class="resume-private-hint">解锁隐私信息以显示敏感内容</div>' : ""}
      <div class="resume-paper">
        <iframe class="resume-frame" title="${escapeHtml(title)}" srcdoc="${escapeHtml(previewHtml)}"></iframe>
      </div>
      ${options.templatePreview ? '<button class="template-preview-close" type="button">关闭模板预览</button>' : ""}
    `;
    state.resumePreview.querySelector(".template-preview-close")?.addEventListener("click", () => {
      api.restoreResumePreview?.();
    });
    api.updateResumePreviewScale?.();
  }

  function updateResumeFrameValues() {
    const iframe = state.resumePreview?.querySelector(".resume-frame");
    const doc = iframe?.contentDocument;
    if (!doc) {
      return false;
    }

    const currentByKey = new Map(state.fields.map(field => [String(field.key || "").trim(), field]));
    const renderedById = new Map(Object.entries(state.currentResumeRenderedValues || {}));
    const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let changed = false;

    while (node) {
      const source = node.nodeValue || "";
      let nextValue = source;
      for (const currentField of currentByKey.values()) {
        const fieldId = currentField.id || currentField.key;
        const previousValue = String(renderedById.get(fieldId) || "");
        const nextFieldValue = String(currentField?.value || "");
        if (!previousValue || previousValue === nextFieldValue) {
          continue;
        }
        if (currentField?.type === "photo" && nextFieldValue.startsWith("data:image/")) {
          continue;
        }
        if (nextValue.includes(previousValue)) {
          nextValue = nextValue.replace(new RegExp(escapeRegExp(previousValue), "g"), nextFieldValue);
          changed = true;
        }
      }
      if (nextValue !== source) {
        node.nodeValue = nextValue;
        changed = true;
      }
      node = walker.nextNode();
    }

    const imageNodes = doc.querySelectorAll?.("img.resume-private-image[alt]");
    imageNodes?.forEach(img => {
      const key = String(img.getAttribute("alt") || "").trim();
      const field = currentByKey.get(key);
      if (field?.type === "photo" && field.value?.startsWith("data:image/")) {
        if (img.getAttribute("src") !== field.value) {
          img.setAttribute("src", field.value);
          changed = true;
        }
      }
    });

    state.currentResumeRenderedValues = Object.fromEntries(
      state.fields.map(field => [field.id || field.key, String(field.value || "")])
    );
    return changed;
  }

  api.printCurrentResume = function printCurrentResume() {
    if (!state.currentResumeHtml) {
      api.setStatus("请先用 Skill 生成简历", "warning");
      return;
    }
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.left = "-10000px";
    printFrame.style.top = "0";
    printFrame.style.width = "794px";
    printFrame.style.height = "1123px";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);
    const printDocument = printFrame.contentDocument;
    if (!printDocument) {
      printFrame.remove();
      api.setStatus("导出 PDF 失败", "warning");
      return;
    }
    printDocument.open();
    printDocument.write(state.currentResumeHtml);
    printDocument.close();
    window.setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      window.setTimeout(() => printFrame.remove(), 1000);
    }, 120);
  };

  function resolvePrivateTokens(html) {
    if (!state.privateUnlocked || !state.privateValuesResolved) {
      return html;
    }
    return String(html || "").replace(/\{\{([^{}]+)\}\}/g, (token, key) => {
      const field = state.fields.find(item => item.key === String(key).trim());
      if (field?.type === "photo" && field.value?.startsWith("data:image/")) {
        return `<img class="resume-private-image" src="${escapeHtml(field.value)}" alt="${escapeHtml(field.key)}">`;
      }
      return field?.value || token;
    });
  }

  function renderResumeEmptyState() {
    if (!state.resumePreview || state.aiOutputVersion) {
      return;
    }
    state.currentResumeHtml = "";
    state.resumePreview.innerHTML = `<div class="resume-empty-state">请用 Skill 生成简历</div>`;
  }

  function clearTemplateSelection() {
    state.selectedTemplateId = "";
    state.templateList?.querySelectorAll(".template-card").forEach(card => {
      card.classList.remove("is-selected");
    });
  }

  function renderAiOutputPreview() {
    if (state.aiOutputSourceHtml) {
      if (state.privateUnlocked && state.privateValuesResolved) {
        if (state.currentResumeResolved && state.resumePreview?.querySelector(".resume-frame")?.contentDocument && state.currentResumeHtml) {
          updateResumeFrameValues();
          return;
        }
        renderResumeFrame(resolvePrivateTokens(state.aiOutputSourceHtml), "Skill 生成简历预览", {
          privateLockedHint: false,
          privateResolved: true
        });
        return;
      }
      renderResumeFrame(resolvePrivateTokens(state.aiOutputSourceHtml), "Skill 生成简历预览", {
        privateLockedHint: !state.privateUnlocked,
        privateResolved: false
      });
    } else if (!state.aiOutputVersion) {
      renderResumeEmptyState();
    }
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

  api.renderTutorialContent = function renderTutorialContent() {
    if (!state.tutorialDrawerBody) {
      return;
    }
    state.tutorialDrawerBody.innerHTML = "";
    state.tutorialDrawerBody.appendChild(buildAiEditorFragment(state.tutorialMarkdown));
  };

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
      api.renderTutorialContent?.();
      return;
    }

    if (!state.maskedPreview) {
      return;
    }

    state.maskedPreview.innerHTML = "";
    if (state.publicDraftMarkdown) {
      state.maskedPreview.appendChild(buildAiEditorFragment(state.publicDraftMarkdown));
    }
    api.renderTutorialContent?.();
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
      placeholder: "请输入或粘贴 Skill 要参考的简历，并在隐私信息模块进行脱敏",
      onChange: text => {
        state.publicDraftMarkdown = text;
        state.aiRenderSignature = `${normalizeAiText(text)}\u0000${privateFingerprint(state)}`;
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
      api.renderStatus();
    }, 260);
  };

  api.updateOutput = function updateOutput() {
    renderAiOutputPreview();
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

  api.generateResumePreview = function generateResumePreview() {
    clearTemplateSelection();
    renderResumeEmptyState();
  };

  api.restoreResumePreview = function restoreResumePreview() {
    clearTemplateSelection();
    if (state.aiOutputSourceHtml) {
      renderAiOutputPreview();
      return;
    }
    if (state.aiOutputVersion) {
      api.loadAiOutput(state.aiOutputVersion);
      return;
    }
    renderResumeEmptyState();
  };

  api.renderTemplateList = function renderTemplateList(templates = []) {
    if (!state.templateList) {
      return;
    }
    if (!templates.length) {
      state.templateList.innerHTML = `<div class="empty-hint">暂无简历模版</div>`;
      api.updateTemplateScrollControls?.();
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
    const hasCards = Boolean(state.templateList.querySelector(".template-card"));
    const hasOverflow = hasCards && state.templateList.scrollWidth > state.templateList.clientWidth + 1;
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
      api.updateTemplateScrollControls?.();
    }
  };

  api.previewResumeTemplate = async function previewResumeTemplate(templateId) {
    if (!templateId || !state.resumePreview) {
      return;
    }
    if (state.selectedTemplateId === templateId) {
      clearTemplateSelection();
      if (state.aiOutputVersion) {
        api.loadAiOutput(state.aiOutputVersion);
      } else {
        api.generateResumePreview();
      }
      return;
    }
    try {
      const response = await fetch(`/api/resume-templates/${encodeURIComponent(templateId)}`);
      if (!response.ok) {
        throw new Error("简历模版读取失败");
      }
      const html = await response.text();
      state.selectedTemplateId = templateId;
      renderResumeFrame(html, "简历模版预览", { templatePreview: true });
      state.templateList?.querySelectorAll(".template-card").forEach(card => {
        card.classList.toggle("is-selected", card.dataset.templateId === templateId);
      });
    } catch {
      api.setStatus("简历模版读取失败", "warning");
    }
  };

  api.loadAiOutput = async function loadAiOutput(version = "") {
    const response = await fetch("/api/skill-output");
    if (!response.ok) {
      throw new Error("Skill 生成简历读取失败");
    }
    const html = await response.text();
    clearTemplateSelection();
    state.aiOutputVersion = version || state.aiOutputVersion;
    state.pendingAiOutputVersion = "";
    state.aiOutputSourceHtml = html;
    api.updateLatestResumeButton?.();
    renderAiOutputPreview();
  };

  api.updateLatestResumeButton = function updateLatestResumeButton() {
    if (!state.viewLatestResumeButton) {
      return;
    }
    state.viewLatestResumeButton.hidden = !state.pendingAiOutputVersion;
  };

  api.viewLatestAiOutput = async function viewLatestAiOutput() {
    if (!state.pendingAiOutputVersion) {
      return;
    }
    await api.loadAiOutput(state.pendingAiOutputVersion);
    api.setStatus("已显示最新 Skill 生成简历", "ok");
  };

  api.checkAiOutputUpdate = async function checkAiOutputUpdate({ initial = false } = {}) {
    try {
      const response = await fetch("/api/skill-output/meta");
      if (!response.ok) {
        return;
      }
      const meta = await response.json();
      if (!meta.exists || !meta.version) {
        return;
      }
      if (!state.aiOutputVersion) {
        state.aiOutputVersion = meta.version;
        if (initial) {
          await api.loadAiOutput(meta.version);
        }
        return;
      }
      if (meta.version !== state.aiOutputVersion) {
        state.pendingAiOutputVersion = meta.version;
        api.updateLatestResumeButton?.();
        api.setStatus("Skill 生成简历已更新，可查看最新", "ok");
      }
    } catch {
      // 外部 Skill 可能尚未生成 Skill生成的简历.html，静默等待下一次轮询。
    }
  };

  api.startAiOutputPolling = function startAiOutputPolling() {
    if (state.aiOutputPollTimer) {
      clearInterval(state.aiOutputPollTimer);
      state.aiOutputPollTimer = null;
    }
    if (document.visibilityState !== "visible") {
      return;
    }
    api.checkAiOutputUpdate({ initial: true });
    state.aiOutputPollTimer = window.setInterval(() => {
      api.checkAiOutputUpdate();
    }, 1000);
  };

  api.stopAiOutputPolling = function stopAiOutputPolling() {
    if (!state.aiOutputPollTimer) {
      return;
    }
    clearInterval(state.aiOutputPollTimer);
    state.aiOutputPollTimer = null;
  };
}
