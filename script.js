const colors = [
  "#d1495b",
  "#0077b6",
  "#2a9d8f",
  "#f77f00",
  "#7b2cbf",
  "#457b9d",
  "#bc6c25",
  "#6a994e",
  "#d00000",
  "#5a189a"
];

const demoFields = [
  { key: "姓名", value: "张明远" },
  { key: "年龄", value: "29" },
  { key: "手机", value: "13812345678" },
  { key: "邮箱", value: "mingyuan.zhang@example.com" },
  { key: "城市", value: "上海" },
  { key: "公司", value: "云启科技" }
];

const demoMarkdown = `# 张明远

上海 | 13812345678 | mingyuan.zhang@example.com

## 求职目标

后端工程师，期望加入重视工程质量、系统稳定性和产品迭代效率的团队。

## 个人总结

29 岁，5 年后端开发经验，目前在云启科技负责订单系统和数据同步服务。熟悉 Java、Spring Boot、MySQL、Redis 和消息队列，关注高并发场景下的可观测性和故障恢复。

## 工作经历

### 云启科技｜后端工程师｜2021.06 - 至今

- 负责订单核心链路改造，将高峰期接口 P95 延迟从 680ms 降至 210ms。
- 设计库存同步任务的幂等机制，减少重复扣减和人工对账成本。
- 推动服务日志结构化，提升线上问题定位效率。

### 星河软件｜Java 开发工程师｜2019.07 - 2021.05

- 参与 CRM 客户画像模块开发，支持销售团队按行业、规模和活跃度筛选客户。
- 编写接口自动化测试，覆盖主要客户管理流程。

## 技能

- Java / Spring Boot / MySQL / Redis / Kafka
- REST API 设计、微服务治理、性能优化
- Git、Docker、Linux 基础运维`;

const demoSamples = [
  {
    publicMarkdown: demoMarkdown,
    fields: demoFields
  },
  {
    publicMarkdown: `# 李薇

杭州 | 18600001111 | liwei@example.com

## 求职目标

前端工程师，关注设计实现一致性、性能和可维护性。

## 个人总结

6 年前端开发经验，熟悉组件化架构、设计系统和复杂表单交互。

## 工作经历

### 星图科技｜前端工程师｜2020.03 - 至今

- 搭建统一组件库，覆盖业务后台核心交互。
- 优化首屏加载和表单响应速度。
- 推动设计稿交付标准化。

## 技能

- TypeScript / React / CSS / Node.js
- 组件设计、性能优化、工程化`,
    fields: [
      { key: "姓名", value: "李薇" },
      { key: "年龄", value: "31" },
      { key: "手机", value: "18600001111" },
      { key: "邮箱", value: "liwei@example.com" },
      { key: "城市", value: "杭州" },
      { key: "公司", value: "星图科技" }
    ]
  },
  {
    publicMarkdown: `# 王浩

深圳 | 13900002222 | wanghao@example.com

## 求职目标

全栈工程师，偏向业务交付与系统整合。

## 个人总结

8 年开发经验，熟悉前后端联调、接口设计和多角色后台系统。

## 工作经历

### 云脉信息｜全栈工程师｜2018.09 - 至今

- 负责客户运营平台和审批流系统。
- 协调前后端接口协议与上线节奏。
- 支持核心页面性能优化与问题排查。

## 技能

- JavaScript / TypeScript / Vue / Node.js / PostgreSQL
- 接口设计、业务建模、系统联调`,
    fields: [
      { key: "姓名", value: "王浩" },
      { key: "年龄", value: "34" },
      { key: "手机", value: "13900002222" },
      { key: "邮箱", value: "wanghao@example.com" },
      { key: "城市", value: "深圳" },
      { key: "公司", value: "云脉信息" }
    ]
  }
];

const defaultPrivateKeys = demoSamples[0].fields.map(field => field.key);

let fields = demoFields.map((field, index) => ({
  ...field,
  color: colors[index % colors.length]
}));

let publicDraftMarkdown = "";
let savedMaskedPublicMarkdown = "";
let savedPrivateValues = {};
let savedPrivateFingerprint = "";
let savedPrivateKeys = [];
let privateUnlocked = false;
let privateValuesResolved = false;
let hasEncryptedPrivate = false;
let appState = {};
let publicSampleIndex = 0;
let aiEditorFocused = false;
let aiNormalizeTimer = null;
let aiEditor = null;
let aiRenderSignature = "";

const fieldList = document.querySelector("#fieldList");
const maskedPreview = document.querySelector("#maskedPreview");
const resumePreview = document.querySelector("#resumePreview");
const addFieldButton = document.querySelector("#addField");
const printButton = document.querySelector("#printResume");
const regeneratePublicButton = document.querySelector("#regeneratePublic");
const privateKeyInput = document.querySelector("#privateKey");
const unlockPrivateButton = document.querySelector("#unlockPrivate");
const saveAllButton = document.querySelector("#saveAll");
const clearPrivateButton = document.querySelector("#clearPrivate");
const aiStatusBar = document.querySelector("#aiStatusBar");
const privateStatusBar = document.querySelector("#privateStatusBar");
const toast = document.querySelector("#toast");
let toastTimer = null;

if (maskedPreview) {
  maskedPreview.innerHTML = "";
}
if (resumePreview) {
  resumePreview.innerHTML = "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlToText(value) {
  return value
    .replaceAll("&nbsp;", " ")
    .replace(/<div><br><\/div>/g, "\n")
    .replace(/<div>/g, "\n")
    .replace(/<\/div>/g, "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAiText(text) {
  return (text || "").replace(/\r\n?/g, "\n");
}

function getSharedTextBounds(current, saved) {
  const currentText = normalizeAiText(current || "");
  const savedText = normalizeAiText(saved || "");

  if (!savedText) {
    return {
      prefix: 0,
      suffix: 0,
      currentLength: currentText.length,
      savedLength: 0
    };
  }

  const limit = Math.min(currentText.length, savedText.length);
  let prefix = 0;
  while (prefix < limit && currentText[prefix] === savedText[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  const currentRemain = currentText.length - prefix;
  const savedRemain = savedText.length - prefix;
  while (
    suffix < currentRemain &&
    suffix < savedRemain &&
    currentText[currentText.length - 1 - suffix] === savedText[savedText.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    prefix,
    suffix,
    currentLength: currentText.length,
    savedLength: savedText.length
  };
}

function isSpanSaved(start, end, bounds, currentText, savedText) {
  if (!savedText) {
    return false;
  }

  if (normalizeAiText(currentText) === normalizeAiText(savedText)) {
    return true;
  }

  const savedSuffixStart = bounds.currentLength - bounds.suffix;
  return end <= bounds.prefix || start >= savedSuffixStart;
}

function getActiveFields() {
  return fields
    .filter(field => field.key && field.value)
    .sort((a, b) => b.value.length - a.value.length);
}

function getTokenMappings() {
  const mappings = [];
  const currentValuesByKey = new Map(fields.map(field => [field.key, field.value]));

  fields.forEach(field => {
    if (field.key && field.value) {
      mappings.push({
        key: field.key,
        value: field.value,
        source: "current"
      });
    }
  });

  Object.entries(savedPrivateValues).forEach(([key, value]) => {
    if (!key || !value) {
      return;
    }
    if (currentValuesByKey.get(key) === value) {
      return;
    }
    mappings.push({
      key,
      value,
      source: "saved"
    });
  });

  return mappings.sort((a, b) => {
    if (b.value.length !== a.value.length) {
      return b.value.length - a.value.length;
    }
    if (a.source === b.source) {
      return 0;
    }
    return a.source === "current" ? -1 : 1;
  });
}

function getFieldByKey(key) {
  return fields.find(field => field.key === key);
}

function getTokenLabel(key) {
  return `{{${key}}}`;
}

function normalizePlainTextSegment(segment, offset = 0, caretIndex = null) {
  const active = getActiveFields();
  let output = "";
  let cursor = 0;
  let nextCaret = caretIndex;
  let caretLocked = false;

  while (cursor < segment.length) {
    let bestField = null;
    let bestIndex = -1;

    for (const field of active) {
      const index = segment.indexOf(field.value, cursor);
      if (index === -1) {
        continue;
      }
      if (bestIndex === -1 || index < bestIndex || (index === bestIndex && field.value.length > (bestField?.value?.length || 0))) {
        bestField = field;
        bestIndex = index;
      }
    }

    if (!bestField) {
      output += segment.slice(cursor);
      break;
    }

    if (bestIndex > cursor) {
      output += segment.slice(cursor, bestIndex);
    }

    const token = getTokenLabel(bestField.key);
    const matchStart = offset + bestIndex;
    const matchEnd = matchStart + bestField.value.length;
    if (caretIndex != null && !caretLocked) {
      if (caretIndex > matchStart && caretIndex < matchEnd) {
        nextCaret = output.length + token.length;
        caretLocked = true;
      } else if (caretIndex >= matchEnd) {
        nextCaret += token.length - bestField.value.length;
      }
    }

    output += token;
    cursor = bestIndex + bestField.value.length;
  }

  return {
    text: output,
    caretIndex: nextCaret
  };
}

function privateFingerprint() {
  return JSON.stringify(fields.map(({ key, value, color }) => ({ key, value, color })));
}

function createEmptyPrivateFields(keys = defaultPrivateKeys) {
  return keys.map((key, index) => ({
    key,
    value: "",
    color: colors[index % colors.length]
  }));
}

function cloneFields(sourceFields) {
  return sourceFields.map((field, index) => ({
    key: field.key,
    value: field.value,
    color: colors[index % colors.length]
  }));
}

function applySample(sample, options = {}) {
  const { preservePrivateLock = false } = options;
  fields = cloneFields(sample.fields);
  publicDraftMarkdown = maskText(sample.publicMarkdown);
  savedMaskedPublicMarkdown = publicDraftMarkdown;
  savedPrivateValues = Object.fromEntries(sample.fields.map(field => [field.key, field.value]));
  if (!preservePrivateLock) {
    privateUnlocked = true;
    hasEncryptedPrivate = false;
    savedPrivateKeys = sample.fields.map(field => field.key);
    privateValuesResolved = true;
  }
}

function publicDirty() {
  return maskText(publicDraftMarkdown) !== savedMaskedPublicMarkdown;
}

function privateDirty() {
  if (hasEncryptedPrivate && !privateUnlocked && savedPrivateFingerprint === "") {
    return false;
  }

  if (!hasEncryptedPrivate) {
    return privateFingerprint() !== savedPrivateFingerprint;
  }

  return privateFingerprint() !== savedPrivateFingerprint;
}

function setStatus(message, type = "info") {
  if (!toast) return;
  toast.className = `toast is-visible ${type}`;
  toast.textContent = message;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toast.className = "toast";
    toast.textContent = "";
  }, 2400);
}

function renderStatus() {
  const privateClass = privateDirty() ? "warning" : "ok";

  unlockPrivateButton.textContent = privateUnlocked ? "锁定" : "解锁";
  unlockPrivateButton.disabled = false;
  saveAllButton.disabled = !(publicDirty() || privateDirty());

  aiStatusBar.innerHTML = `
    <span class="status-pill ${publicDirty() ? "warning" : "ok"}">${publicDirty() ? "未保存" : "已保存"}</span>
  `;

  privateStatusBar.innerHTML = `
    <span class="status-pill ${privateClass}">${privateDirty() ? "未保存" : "已保存"}</span>
  `;
}

function renderFields() {
  fieldList.innerHTML = "";
  const locked = !privateUnlocked;

  fields.forEach((field, index) => {
    const card = document.createElement("div");
    card.className = "field-card";
    card.draggable = !locked;
    card.dataset.index = String(index);
    card.style.setProperty("--field-color", field.color);

    card.innerHTML = `
      <div class="drag-handle" title="拖动排序">≡</div>
      <input class="field-key" value="${escapeHtml(field.key)}" aria-label="字段名" ${locked ? "disabled" : ""}>
      <input class="field-value" value="${escapeHtml(field.value)}" aria-label="字段值" placeholder="${locked ? "已锁定" : "请输入值"}" ${locked ? "disabled" : ""}>
      <button class="field-action" data-action="delete" title="删除">×</button>
    `;

    card.querySelector(".field-key").addEventListener("input", event => {
      if (locked) return;
      const previousKey = field.key;
      const nextKey = event.target.value.trim();
      fields[index].key = nextKey;
      publicDraftMarkdown = replaceTokenKey(publicDraftMarkdown, previousKey, nextKey);
      if (!aiEditorFocused) {
        renderAiEditor();
      }
      updateOutput();
      renderStatus();
    });

    card.querySelector(".field-value").addEventListener("input", event => {
      if (locked) return;
      fields[index].value = event.target.value;
      if (!aiEditorFocused) {
        renderAiEditor();
      }
      updateOutput();
      renderStatus();
    });

    card.querySelector(".field-action").addEventListener("click", () => {
      if (locked) {
        setStatus("请先用密钥解锁隐私信息", "warning");
        return;
      }
      fields.splice(index, 1);
      renderFields();
      if (!aiEditorFocused) {
        renderAiEditor();
      }
      updateOutput();
      renderStatus();
    });

    card.addEventListener("dragstart", event => {
      if (locked) return;
      event.dataTransfer.setData("text/plain", String(index));
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => card.classList.remove("dragging"));

    card.addEventListener("dragover", event => event.preventDefault());

    card.addEventListener("drop", event => {
      if (locked) return;
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData("text/plain"));
      moveField(fromIndex, index);
    });

    fieldList.appendChild(card);
  });
}

function moveField(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return;
  }

  const [field] = fields.splice(fromIndex, 1);
  fields.splice(toIndex, 0, field);
  renderFields();
  updateOutput();
  renderStatus();
}

function maskText(text, htmlMode = false) {
  let output = escapeHtml(text);

  getTokenMappings().forEach(mapping => {
    const token = getTokenLabel(mapping.key);
    const replacement = htmlMode
      ? `<span class="token" style="--token-color:${fields.find(field => field.key === mapping.key)?.color || "#8892a0"}">${escapeHtml(token)}</span>`
      : token;
    output = output.replace(new RegExp(escapeRegExp(escapeHtml(mapping.value)), "g"), replacement);
  });

  return output;
}

function replaceTokenKey(text, oldKey, newKey) {
  if (!oldKey || oldKey === newKey) {
    return text;
  }

  return text.replace(new RegExp(escapeRegExp(getTokenLabel(oldKey)), "g"), getTokenLabel(newKey));
}

function unmaskText(text) {
  let output = text;

  fields
    .filter(field => field.key && field.value)
    .forEach(field => {
      output = output.replace(new RegExp(escapeRegExp(getTokenLabel(field.key)), "g"), field.value);
    });

  return output;
}

function updateOutput() {
  generateResumePreview();
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
    return getTokenLabel(element.dataset.tokenKey || "").length;
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
      const tokenLength = getTokenLabel(element.dataset.tokenKey || "").length;
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

function normalizeAiSourceTextWithCaret(text, caretIndex = null) {
  const plain = normalizePlainTextSegment(normalizeAiText(text || ""), 0, caretIndex);
  return plain;
}

function buildTokenChip(key, options = {}) {
  const {
    tokenValue = "",
    tokenState = "saved",
    tokenSource = "literal-token"
  } = options;
  const span = document.createElement("span");
  span.className = "token-chip";
  span.dataset.tokenState = tokenState;
  span.dataset.tokenSource = tokenSource;
  span.contentEditable = "false";
  span.dataset.tokenKey = key;
  span.dataset.tokenValue = tokenValue;
  const field = fields.find(item => item.key === key);
  if (field?.color) {
    span.style.setProperty("--token-color", field.color);
  }
  span.textContent = getTokenLabel(key);
  return span;
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

    const key = match[1].trim();
    const field = fields.find(item => item.key === key);
    if (field) {
      fragment.appendChild(buildTokenChip(field.key, {
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

function appendValueMatches(fragment, text) {
  const active = getTokenMappings();
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

    fragment.appendChild(buildTokenChip(bestField.key, {
      tokenValue: bestField.value,
      tokenState: isSpanSaved(bestIndex, bestIndex + bestField.value.length, getSharedTextBounds(text, savedMaskedPublicMarkdown || ""), text, savedMaskedPublicMarkdown || "")
        ? "saved"
        : "provisional",
      tokenSource: bestField.source === "saved" ? "saved-value" : "value-match"
    }));
    cursor = bestIndex + bestField.value.length;
  }
}

function serializeAiEditor(root = maskedPreview) {
  if (aiEditor) {
    return aiEditor.getSourceText();
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
      const key = element.dataset.tokenKey || "";
      return getTokenLabel(key);
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

function renderAiEditor() {
  mountAiEditor();
  if (aiEditor) {
    const nextText = publicDraftMarkdown || "";
    const nextSignature = `${normalizeAiText(nextText)}\u0000${privateFingerprint()}`;
    if (aiEditor.getSourceText() !== nextText || aiRenderSignature !== nextSignature) {
      aiEditor.setSourceText(nextText);
      aiRenderSignature = nextSignature;
    }
    return;
  }

  if (!maskedPreview) {
    return;
  }

  maskedPreview.innerHTML = "";
  if (publicDraftMarkdown) {
    maskedPreview.appendChild(buildAiEditorFragment(publicDraftMarkdown));
  }
}

function normalizeAndRenderAiEditor(forceRender = false) {
  mountAiEditor();
  if (aiEditor) {
    return true;
  }

  if (!maskedPreview) {
    return;
  }

  const selection = window.getSelection();
  const activeRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const hasCaret = Boolean(activeRange && maskedPreview.contains(activeRange.commonAncestorContainer));
  const caretIndex = hasCaret ? getSerializedCaretIndex(maskedPreview, activeRange) : null;
  const currentText = serializeAiEditor();
  const normalized = normalizeAiSourceTextWithCaret(currentText, caretIndex);
  publicDraftMarkdown = normalized.text;
  if (!forceRender && normalized.text === currentText) {
    return false;
  }

  renderAiEditor();

  if (hasCaret && normalized.caretIndex != null) {
    const resolved = resolveSerializedPosition(maskedPreview, normalized.caretIndex);
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
}

function syncMaskedPublicText() {
  publicDraftMarkdown = normalizeAiText(serializeAiEditor());
  updateOutput();
  renderStatus();
}

function mountAiEditor() {
  if (aiEditor || typeof window.createJianliEditor !== "function" || !maskedPreview) {
    return;
  }

  aiEditor = window.createJianliEditor(maskedPreview, {
    initialText: publicDraftMarkdown || savedMaskedPublicMarkdown || "",
    getFields: () => fields,
    placeholder: "AI 读取的内容会在这里显示",
    onChange: text => {
      publicDraftMarkdown = text;
      aiRenderSignature = `${normalizeAiText(text)}\u0000${privateFingerprint()}`;
      updateOutput();
      renderStatus();
    },
    onFocusChange: focused => {
      aiEditorFocused = focused;
    }
  });
  aiRenderSignature = `${normalizeAiText(aiEditor.getSourceText() || publicDraftMarkdown || "")}\u0000${privateFingerprint()}`;
}

function scheduleAiNormalization() {
  if (aiNormalizeTimer) {
    clearTimeout(aiNormalizeTimer);
  }

  aiNormalizeTimer = window.setTimeout(() => {
    aiNormalizeTimer = null;
    normalizeAndRenderAiEditor(false);
    updateOutput();
    renderStatus();
  }, 260);
}

function readPrivateValue(key, fallback = "") {
  return fields.find(field => field.key === key)?.value || fallback;
}

function getPublicBullets(text = "") {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => /^[-*]\s+/.test(line))
    .slice(0, 6)
    .map(line => line.replace(/^[-*]\s+/, ""));
}

function generateResumePreview() {
  const previewText = privateUnlocked && privateValuesResolved ? unmaskText(publicDraftMarkdown) : maskText(publicDraftMarkdown);
  const bullets = getPublicBullets(previewText || savedMaskedPublicMarkdown || "");
  const name = readPrivateValue("姓名", "候选人");
  const city = readPrivateValue("城市", "城市");
  const phone = readPrivateValue("手机", "手机");
  const email = readPrivateValue("邮箱", "邮箱");
  const company = readPrivateValue("公司", "公司");
  const bulletHtml = bullets.map(item => `<li>${escapeHtml(item)}</li>`).join("");

  resumePreview.innerHTML = `
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
}

function regeneratePublicExample() {
  if (hasEncryptedPrivate && !privateUnlocked) {
    setStatus("请先用密钥解锁隐私信息", "warning");
    return;
  }
  publicSampleIndex = (publicSampleIndex + 1) % demoSamples.length;
  applySample(demoSamples[publicSampleIndex]);
  renderFields();
  renderAiEditor();
  updateOutput();
  renderStatus();
}

async function apiRead(path) {
  const response = await fetch(path);
  if (!response.ok) {
    return null;
  }
  return response;
}

async function loadSavedData() {
  try {
    const stateResponse = await apiRead("/api/state");
    appState = stateResponse ? await stateResponse.json() : {};
    hasEncryptedPrivate = Boolean(appState.privateEncrypted);
    savedPrivateKeys = Array.isArray(appState.privateFieldKeys) ? appState.privateFieldKeys : [];

    const maskedResponse = await apiRead("/api/public-masked");
    if (maskedResponse) {
      savedMaskedPublicMarkdown = await maskedResponse.text();
    } else {
      savedMaskedPublicMarkdown = "";
    }

    if (hasEncryptedPrivate) {
      const keys = savedPrivateKeys.length
        ? savedPrivateKeys
        : Array.from({ length: appState.privateFieldCount || 0 }, (_, index) => `隐私字段${index + 1}`);
      fields = createEmptyPrivateFields(keys);
      privateUnlocked = false;
      privateValuesResolved = false;
      savedPrivateValues = {};
      savedPrivateFingerprint = "";
    } else if (appState.privateClearedAt) {
      fields = createEmptyPrivateFields(savedPrivateKeys.length ? savedPrivateKeys : defaultPrivateKeys);
      privateUnlocked = false;
      privateValuesResolved = false;
      savedPrivateValues = Object.fromEntries(fields.map(field => [field.key, field.value]));
      savedPrivateFingerprint = privateFingerprint();
    } else {
      if (!savedMaskedPublicMarkdown) {
        applySample(demoSamples[0], { preservePrivateLock: true });
        savedMaskedPublicMarkdown = publicDraftMarkdown;
      }
      savedPrivateValues = Object.fromEntries(fields.map(field => [field.key, field.value]));
      savedPrivateFingerprint = privateFingerprint();
      privateUnlocked = true;
      privateValuesResolved = true;
    }

    publicDraftMarkdown = savedMaskedPublicMarkdown || publicDraftMarkdown || "";
  } catch {
  applySample(demoSamples[0], { preservePrivateLock: true });
    savedMaskedPublicMarkdown = publicDraftMarkdown;
    savedPrivateValues = Object.fromEntries(fields.map(field => [field.key, field.value]));
    savedPrivateFingerprint = privateFingerprint();
    privateUnlocked = true;
    privateValuesResolved = true;
    setStatus("保存服务未启动，当前仅可预览", "warning");
  }

  renderFields();
  renderAiEditor();
  generateResumePreview();
  renderStatus();
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPrivateFields(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify({ fields }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 250000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext)
  };
}

async function decryptPrivateFields(password, payload) {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveKey(password, salt);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)).fields || [];
}

async function savePrivateData() {
  const password = privateKeyInput.value;
  if (!password) {
    setStatus("请先输入密钥后保存隐私信息", "warning");
    return false;
  }

  const encrypted = await encryptPrivateFields(password);
  const response = await fetch("/api/private", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      encrypted,
      metadata: {
        fieldKeys: fields.map(field => field.key),
        fieldCount: fields.length
      }
    })
  });

  if (!response.ok) {
    throw new Error("隐私信息保存失败");
  }

  appState = await response.json();
  hasEncryptedPrivate = true;
  privateUnlocked = true;
  privateValuesResolved = true;
  savedPrivateFingerprint = privateFingerprint();
  savedPrivateKeys = fields.map(field => field.key);
  savedPrivateValues = Object.fromEntries(fields.map(field => [field.key, field.value]));
  await saveMaskedPublicData();
  return true;
}

async function clearPrivateData() {
  if (!window.confirm("将清空当前隐私值并保留字段名，继续吗？")) {
    return;
  }

  fields = fields.map(field => ({
    ...field,
    value: ""
  }));
  privateUnlocked = true;
  privateValuesResolved = false;
  renderFields();
  renderAiEditor();
  generateResumePreview();
  renderStatus();
  setStatus("隐私值已清空，可重新填写", "ok");
}

async function unlockPrivateData() {
  if (privateUnlocked) {
    privateUnlocked = false;
    renderFields();
    renderAiEditor();
    generateResumePreview();
    renderStatus();
    setStatus("隐私信息已锁定", "ok");
    return;
  }

  const password = privateKeyInput.value;
  if (!password) {
    setStatus("请先输入密钥", "warning");
    return;
  }

  try {
    if (hasEncryptedPrivate && savedPrivateFingerprint === "") {
      const response = await apiRead("/api/private");
      if (!response) {
        setStatus("没有已保存的隐私信息", "warning");
        return;
      }
      fields = await decryptPrivateFields(password, await response.json());
      savedPrivateFingerprint = privateFingerprint();
      savedPrivateKeys = fields.map(field => field.key);
      savedPrivateValues = Object.fromEntries(fields.map(field => [field.key, field.value]));
    }
    privateUnlocked = true;
    privateValuesResolved = true;
    renderFields();
    renderAiEditor();
    generateResumePreview();
    renderStatus();
    setStatus("隐私信息已解锁", "ok");
  } catch {
    setStatus("密钥不正确，无法解锁隐私信息", "warning");
  }
}

async function saveAllData() {
  const publicChanged = publicDirty();
  const privateChanged = privateDirty();
  if (!publicChanged && !privateChanged) {
    setStatus("没有需要保存的内容", "info");
    return;
  }

  let publicSaved = false;
  let privateSaved = false;
  let publicFailed = false;
  let privateFailed = false;
  let privateNeedsKey = false;

  if (publicChanged) {
    try {
      await saveMaskedPublicData();
      publicSaved = true;
    } catch {
      publicFailed = true;
    }
  }

  if (privateChanged) {
    if (!privateKeyInput.value) {
      privateNeedsKey = true;
    } else {
      try {
        const saved = await savePrivateData();
        privateSaved = Boolean(saved);
      } catch {
        privateFailed = true;
      }
    }
  }

  if (publicSaved && privateSaved) {
    setStatus("AI读取的内容和隐私信息已保存", "ok");
    return;
  }

  if (publicSaved && privateNeedsKey) {
    setStatus("AI读取的内容已保存，隐私信息未保存，请先输入密钥后保存隐私信息", "warning");
    return;
  }

  if (publicSaved && privateFailed) {
    setStatus("AI读取的内容已保存，隐私信息保存失败", "warning");
    return;
  }

  if (publicSaved && !privateChanged) {
    setStatus("AI读取的内容已保存", "ok");
    return;
  }

  if (!publicChanged && privateSaved) {
    setStatus("隐私信息已保存", "ok");
    return;
  }

  if (!publicChanged && privateNeedsKey) {
    setStatus("请先输入密钥后保存隐私信息", "warning");
    return;
  }

  if (!publicChanged && privateFailed) {
    setStatus("隐私信息保存失败，请确认本地服务已启动", "warning");
    return;
  }

  if (publicFailed && privateSaved) {
    setStatus("AI读取的内容保存失败，隐私信息已保存", "warning");
    return;
  }

  if (publicFailed && privateNeedsKey) {
    setStatus("AI读取的内容保存失败，隐私信息未保存，请先输入密钥后保存隐私信息", "warning");
    return;
  }

  setStatus("保存失败，请确认本地服务已启动", "warning");
}

async function saveMaskedPublicData() {
  const payload = maskText(publicDraftMarkdown);
  if (!payload) {
    return;
  }

  const response = await fetch("/api/public-masked", {
    method: "PUT",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: payload
  });

  if (!response.ok) {
    throw new Error("AI 读取的内容保存失败");
  }

  appState = await response.json();
  savedMaskedPublicMarkdown = payload;
}

addFieldButton.addEventListener("click", () => {
  if (hasEncryptedPrivate && !privateUnlocked) {
    setStatus("请先用密钥解锁隐私信息", "warning");
    return;
  }
  fields.push({
    key: "新字段",
    value: "",
    color: colors[fields.length % colors.length]
  });
  renderFields();
  renderAiEditor();
  updateOutput();
  renderStatus();
});
regeneratePublicButton.addEventListener("click", regeneratePublicExample);

printButton.addEventListener("click", () => {
  generateResumePreview();
  window.print();
});
unlockPrivateButton.addEventListener("click", unlockPrivateData);
saveAllButton.addEventListener("click", saveAllData);
clearPrivateButton.addEventListener("click", clearPrivateData);
clearPrivateButton.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    clearPrivateData();
  }
});
privateKeyInput.addEventListener("input", () => renderStatus());
maskedPreview.addEventListener("input", event => {
  publicDraftMarkdown = normalizeAiText(serializeAiEditor());
  updateOutput();
  renderStatus();
  if (!event.isComposing) {
    scheduleAiNormalization();
  }
});
maskedPreview.addEventListener("focusin", () => {
  aiEditorFocused = true;
});
maskedPreview.addEventListener("focusout", () => {
  aiEditorFocused = false;
  if (aiNormalizeTimer) {
    clearTimeout(aiNormalizeTimer);
    aiNormalizeTimer = null;
  }
  normalizeAndRenderAiEditor(true);
  updateOutput();
  renderStatus();
});

publicSampleIndex = 0;
renderFields();
renderAiEditor();
generateResumePreview();
renderStatus();
loadSavedData();
