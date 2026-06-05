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

let rawPublicMarkdown = "";
let maskedMarkdown = "";
let savedPublicMarkdown = "";
let savedPrivateFingerprint = "";
let savedPrivateKeys = [];
let privateUnlocked = false;
let hasEncryptedPrivate = false;
let appState = {};
let publicSampleIndex = 0;

const fieldList = document.querySelector("#fieldList");
const maskedEditor = document.querySelector("#maskedEditor");
const maskedPreview = document.querySelector("#maskedPreview");
const resumePreview = document.querySelector("#resumePreview");
const addFieldButton = document.querySelector("#addField");
const printButton = document.querySelector("#printResume");
const regeneratePublicButton = document.querySelector("#regeneratePublic");
const sourceView = document.querySelector("#sourceView");
const previewView = document.querySelector("#previewView");
const showSourceButton = document.querySelector("#showSource");
const showPreviewButton = document.querySelector("#showPreview");
const privateKeyInput = document.querySelector("#privateKey");
const unlockPrivateButton = document.querySelector("#unlockPrivate");
const saveAllButton = document.querySelector("#saveAll");
const clearPrivateButton = document.querySelector("#clearPrivate");
const syncStatusBar = document.querySelector("#syncStatusBar");
const privateStatusBar = document.querySelector("#privateStatusBar");

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

function getActiveFields() {
  return fields
    .filter(field => field.key && field.value)
    .sort((a, b) => b.value.length - a.value.length);
}

function privateFingerprint() {
  return JSON.stringify(fields.map(({ key, value, color }) => ({ key, value, color })));
}

function privateKeyFingerprint() {
  return JSON.stringify(fields.map(({ key }) => ({ key })));
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
  rawPublicMarkdown = sample.publicMarkdown;
  maskedMarkdown = maskText(rawPublicMarkdown);
  if (!preservePrivateLock) {
    privateUnlocked = true;
    hasEncryptedPrivate = false;
    savedPrivateKeys = sample.fields.map(field => field.key);
  }
}

function publicDirty() {
  return rawPublicMarkdown !== savedPublicMarkdown;
}

function privateDirty() {
  if (!hasEncryptedPrivate) {
    return privateFingerprint() !== savedPrivateFingerprint;
  }

  if (privateUnlocked) {
    return privateFingerprint() !== savedPrivateFingerprint;
  }

  return privateKeyFingerprint() !== JSON.stringify(savedPrivateKeys.map(key => ({ key })));
}

function setStatus(message, type = "info") {
  renderStatus(message, type);
}

function renderStatus(message = "", messageType = "info") {
  const publicClass = publicDirty() ? "warning" : "ok";
  const privateClass = privateDirty() ? "warning" : "ok";
  const lockText = privateUnlocked
    ? "隐私信息：已解锁"
    : hasEncryptedPrivate
      ? "隐私信息：已加密保存，显示占位行"
      : "隐私信息：未保存";

  const hasKey = Boolean(privateKeyInput.value);
  unlockPrivateButton.disabled = !hasKey;
  saveAllButton.disabled = !hasKey;
  addFieldButton.disabled = hasEncryptedPrivate && !privateUnlocked;
  clearPrivateButton.disabled = false;

  syncStatusBar.innerHTML = `
    <span class="status-pill ${publicClass} ${privateClass}">保存状态：${publicDirty() || privateDirty() ? "未保存" : "已保存"}</span>
  `;

  privateStatusBar.innerHTML = `
    <span class="status-pill ${privateClass}">${privateDirty() ? "隐私信息：未保存" : lockText}</span>
    ${message ? `<span class="status-pill ${messageType}">${escapeHtml(message)}</span>` : ""}
  `;
}

function renderFields() {
  fieldList.innerHTML = "";
  const locked = hasEncryptedPrivate && !privateUnlocked;

  fields.forEach((field, index) => {
    const card = document.createElement("div");
    card.className = "field-card";
    card.draggable = !locked;
    card.dataset.index = String(index);
    card.style.setProperty("--field-color", field.color);

    card.innerHTML = `
      <div class="drag-handle" title="拖动排序">≡</div>
      <input class="field-key" value="${escapeHtml(field.key)}" aria-label="字段名" ${locked ? "disabled" : ""}>
      <input class="field-value" value="${escapeHtml(field.value)}" aria-label="字段值" placeholder="${locked ? "已加密保存" : "请输入值"}" ${locked ? "disabled" : ""}>
      <button class="field-action" data-action="delete" title="删除" ${locked ? "disabled" : ""}>×</button>
    `;

    card.querySelector(".field-key").addEventListener("input", event => {
      if (locked) return;
      const previousKey = fields[index].key;
      const nextKey = event.target.value.trim();
      fields[index].key = nextKey;
      if (previousKey && nextKey) {
        rawPublicMarkdown = rawPublicMarkdown.replace(new RegExp(escapeRegExp(`{{${previousKey}}}`), "g"), `{{${nextKey}}}`);
      }
      syncMaskedPublicText();
      renderStatus();
    });

    card.querySelector(".field-value").addEventListener("input", event => {
      if (locked) return;
      fields[index].value = event.target.value;
      syncMaskedPublicText();
      renderStatus();
    });

    card.querySelector(".field-action").addEventListener("click", () => {
      if (locked) return;
      fields.splice(index, 1);
      renderFields();
      syncMaskedPublicText();
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

  getActiveFields().forEach(field => {
    const token = `{{${field.key}}}`;
    const replacement = htmlMode
      ? `<span class="token" style="--token-color:${field.color}">${escapeHtml(token)}</span>`
      : token;
    output = output.replace(new RegExp(escapeRegExp(escapeHtml(field.value)), "g"), replacement);
  });

  return output;
}

function getMaskedPublicText() {
  return maskText(rawPublicMarkdown);
}

function unmaskText(text) {
  let output = text;

  fields
    .filter(field => field.key && field.value)
    .forEach(field => {
      output = output.replace(new RegExp(escapeRegExp(`{{${field.key}}}`), "g"), field.value);
    });

  return output;
}

function colorizeTokens(text) {
  let output = escapeHtml(text);

  fields
    .filter(field => field.key)
    .forEach(field => {
      const token = `{{${field.key}}}`;
      const replacement = `<span class="token" style="--token-color:${field.color}">${escapeHtml(token)}</span>`;
      output = output.replace(new RegExp(escapeRegExp(escapeHtml(token)), "g"), replacement);
    });

  return output;
}

function updateOutput() {
  if (!resumePreview.innerHTML.trim()) {
    generateResumePreview();
  }
}

function renderMaskedEditor() {
  maskedEditor.value = rawPublicMarkdown;
}

function renderMaskedPreview() {
  maskedMarkdown = getMaskedPublicText();
  maskedPreview.innerHTML = colorizeTokens(maskedMarkdown);
}

function syncMaskedPublicText() {
  renderMaskedPreview();
  updateOutput();
}

function readPrivateValue(key, fallback = "") {
  return fields.find(field => field.key === key)?.value || fallback;
}

function getPublicBullets() {
  return unmaskText(getMaskedPublicText())
    .split("\n")
    .map(line => line.trim())
    .filter(line => /^[-*]\s+/.test(line))
    .slice(0, 6)
    .map(line => line.replace(/^[-*]\s+/, ""));
}

function generateResumePreview() {
  const bullets = getPublicBullets();
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
    setStatus("请先解锁隐私信息，再生成联动示例", "warning");
    return;
  }
  publicSampleIndex = (publicSampleIndex + 1) % demoSamples.length;
  applySample(demoSamples[publicSampleIndex]);
  renderFields();
  renderMaskedEditor();
  syncMaskedPublicText();
  renderStatus();
}

function setWorkspaceView(view) {
  const isSource = view === "source";
  sourceView.classList.toggle("is-active", isSource);
  previewView.classList.toggle("is-active", !isSource);
  showSourceButton.classList.toggle("is-active", isSource);
  showPreviewButton.classList.toggle("is-active", !isSource);
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

    const publicResponse = await apiRead("/api/public");
    if (publicResponse) {
      rawPublicMarkdown = await publicResponse.text();
      savedPublicMarkdown = rawPublicMarkdown;
    } else {
      applySample(demoSamples[0], { preservePrivateLock: true });
      savedPublicMarkdown = "";
    }

    if (hasEncryptedPrivate) {
      const keys = savedPrivateKeys.length
        ? savedPrivateKeys
        : Array.from({ length: appState.privateFieldCount || 0 }, (_, index) => `隐私字段${index + 1}`);
      fields = createEmptyPrivateFields(keys);
      privateUnlocked = false;
      savedPrivateFingerprint = "";
    } else if (appState.privateClearedAt) {
      fields = createEmptyPrivateFields(savedPrivateKeys.length ? savedPrivateKeys : defaultPrivateKeys);
      privateUnlocked = false;
      savedPrivateFingerprint = privateFingerprint();
    } else {
      savedPrivateFingerprint = privateFingerprint();
      privateUnlocked = true;
    }
  } catch {
    applySample(demoSamples[0], { preservePrivateLock: true });
    savedPublicMarkdown = "";
    savedPrivateFingerprint = privateFingerprint();
    privateUnlocked = true;
    setStatus("保存服务未启动，当前仅可预览", "warning");
  }

  renderFields();
  renderMaskedEditor();
  renderMaskedPreview();
  generateResumePreview();
  renderStatus();
}

async function savePublicData() {
  const response = await fetch("/api/public", {
    method: "PUT",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: rawPublicMarkdown
  });

  if (!response.ok) {
    throw new Error("公开信息保存失败");
  }

  appState = await response.json();
  savedPublicMarkdown = rawPublicMarkdown;
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
    setStatus("请输入隐私密钥后再保存", "warning");
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
  savedPrivateFingerprint = privateFingerprint();
  savedPrivateKeys = fields.map(field => field.key);
  return true;
}

async function clearPrivateData() {
  if (!window.confirm("将清除本地隐私信息、加密文件和状态，继续吗？")) {
    return;
  }

  try {
    const response = await fetch("/api/private", { method: "DELETE" });
    if (!response.ok) {
      throw new Error("隐私信息清除失败");
    }

    appState = await response.json();
    hasEncryptedPrivate = false;
    privateUnlocked = false;
  savedPrivateKeys = appState.privateFieldKeys || defaultPrivateKeys;
  fields = createEmptyPrivateFields(savedPrivateKeys);
  savedPrivateFingerprint = privateFingerprint();
  privateKeyInput.value = "";
  renderFields();
  renderMaskedEditor();
  renderMaskedPreview();
  generateResumePreview();
  renderStatus("隐私信息已清除", "ok");
  } catch {
    setStatus("清除隐私信息失败，请确认本地服务已启动", "warning");
  }
}

async function unlockPrivateData() {
  const password = privateKeyInput.value;
  if (!password) {
    setStatus("请输入隐私密钥", "warning");
    return;
  }

  const response = await apiRead("/api/private");
  if (!response) {
    setStatus("没有已保存的隐私信息", "warning");
    return;
  }

  try {
    fields = await decryptPrivateFields(password, await response.json());
    privateUnlocked = true;
    hasEncryptedPrivate = true;
    savedPrivateFingerprint = privateFingerprint();
    savedPrivateKeys = fields.map(field => field.key);
    renderFields();
    renderMaskedPreview();
    generateResumePreview();
    setStatus("隐私信息已解锁", "ok");
  } catch {
    setStatus("密钥不正确，无法解锁", "warning");
  }
}

async function saveAllData() {
  try {
    if (!privateKeyInput.value) {
      setStatus("请输入隐私密钥后再保存", "warning");
      return;
    }
    if (publicDirty()) {
      await savePublicData();
    }
    if (privateDirty() || !hasEncryptedPrivate) {
      const saved = await savePrivateData();
      if (!saved) {
        renderStatus();
        return;
      }
    }
    setStatus("已保存", "ok");
  } catch {
    setStatus("保存失败，请确认本地服务已启动", "warning");
  }
}

addFieldButton.addEventListener("click", () => {
  if (hasEncryptedPrivate && !privateUnlocked) {
    setStatus("请先解锁隐私信息后再编辑字段", "warning");
    return;
  }
  fields.push({
    key: "新字段",
    value: "",
    color: colors[fields.length % colors.length]
  });
  renderFields();
  syncMaskedPublicText();
  renderStatus();
});
regeneratePublicButton.addEventListener("click", regeneratePublicExample);

printButton.addEventListener("click", () => {
  generateResumePreview();
  window.print();
});
showSourceButton.addEventListener("click", () => setWorkspaceView("source"));
showPreviewButton.addEventListener("click", () => setWorkspaceView("preview"));
unlockPrivateButton.addEventListener("click", unlockPrivateData);
saveAllButton.addEventListener("click", saveAllData);
clearPrivateButton.addEventListener("click", clearPrivateData);
privateKeyInput.addEventListener("input", () => renderStatus());
maskedEditor.addEventListener("input", () => {
  rawPublicMarkdown = maskedEditor.value;
  syncMaskedPublicText();
  renderStatus();
});

publicSampleIndex = 0;
applySample(demoSamples[0]);
renderFields();
renderMaskedEditor();
renderMaskedPreview();
generateResumePreview();
renderStatus();
loadSavedData();
