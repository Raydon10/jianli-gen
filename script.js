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

let fields = demoFields.map((field, index) => ({
  ...field,
  color: colors[index % colors.length]
}));

let maskedMarkdown = "";

const fieldList = document.querySelector("#fieldList");
const maskedEditor = document.querySelector("#maskedEditor");
const resumePreview = document.querySelector("#resumePreview");
const addFieldButton = document.querySelector("#addField");
const resetDemoButton = document.querySelector("#resetDemo");
const printButton = document.querySelector("#printResume");
const generateButton = document.querySelector("#generateResume");
const sourceView = document.querySelector("#sourceView");
const previewView = document.querySelector("#previewView");
const showSourceButton = document.querySelector("#showSource");
const showPreviewButton = document.querySelector("#showPreview");
const workspaceTitle = document.querySelector("#workspaceTitle");

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

function renderFields() {
  fieldList.innerHTML = "";

  fields.forEach((field, index) => {
    const card = document.createElement("div");
    card.className = "field-card";
    card.draggable = true;
    card.dataset.index = String(index);
    card.style.setProperty("--field-color", field.color);

    card.innerHTML = `
      <div class="drag-handle" title="拖动排序">≡</div>
      <input class="field-key" value="${escapeHtml(field.key)}" aria-label="字段名">
      <input class="field-value" value="${escapeHtml(field.value)}" aria-label="字段值">
      <button class="field-action" data-action="delete" title="删除">×</button>
    `;

    card.querySelector(".field-key").addEventListener("input", event => {
      const previousKey = fields[index].key;
      const nextKey = event.target.value.trim();
      fields[index].key = nextKey;
      if (previousKey && nextKey) {
        maskedMarkdown = maskedMarkdown.replace(new RegExp(escapeRegExp(`{{${previousKey}}}`), "g"), `{{${nextKey}}}`);
        renderMaskedEditor();
      }
      updateOutput();
    });

    card.querySelector(".field-value").addEventListener("input", event => {
      fields[index].value = event.target.value;
      updateOutput();
    });

    card.querySelector(".field-action").addEventListener("click", () => {
      fields.splice(index, 1);
      renderFields();
      renderMaskedEditor();
      updateOutput();
    });

    card.addEventListener("dragstart", event => {
      event.dataTransfer.setData("text/plain", String(index));
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => card.classList.remove("dragging"));

    card.addEventListener("dragover", event => event.preventDefault());

    card.addEventListener("drop", event => {
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
  maskedEditor.innerHTML = colorizeTokens(maskedMarkdown);
}

function readPrivateValue(key, fallback = "") {
  return fields.find(field => field.key === key)?.value || fallback;
}

function getPublicBullets() {
  return unmaskText(maskedMarkdown)
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

function setWorkspaceView(view) {
  const isSource = view === "source";
  sourceView.classList.toggle("is-active", isSource);
  previewView.classList.toggle("is-active", !isSource);
  showSourceButton.classList.toggle("is-active", isSource);
  showPreviewButton.classList.toggle("is-active", !isSource);
  workspaceTitle.textContent = isSource ? "公开信息" : "简历预览";
}

addFieldButton.addEventListener("click", () => {
  fields.push({
    key: "新字段",
    value: "",
    color: colors[fields.length % colors.length]
  });
  renderFields();
});

resetDemoButton.addEventListener("click", () => {
  fields = demoFields.map((field, index) => ({
    ...field,
    color: colors[index % colors.length]
  }));
  maskedMarkdown = maskText(demoMarkdown);
  renderFields();
  renderMaskedEditor();
  generateResumePreview();
  updateOutput();
});

printButton.addEventListener("click", () => {
  generateResumePreview();
  window.print();
});
generateButton.addEventListener("click", () => {
  generateResumePreview();
  setWorkspaceView("preview");
});
showSourceButton.addEventListener("click", () => setWorkspaceView("source"));
showPreviewButton.addEventListener("click", () => setWorkspaceView("preview"));
maskedEditor.addEventListener("input", () => {
  maskedMarkdown = htmlToText(maskedEditor.innerHTML);
  updateOutput();
});

maskedEditor.addEventListener("blur", renderMaskedEditor);

maskedMarkdown = maskText(demoMarkdown);
renderFields();
renderMaskedEditor();
generateResumePreview();
updateOutput();
