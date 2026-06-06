import { colors, imageIconSvg } from "./data.js";
import { escapeHtml, fileToDataUrl, replaceTokenKey } from "./text.js";
import {
  createUniqueFieldKey,
  isPhotoField,
} from "./workspace-shared.js";

export function setupFieldController(state, api) {
  api.renderFields = function renderFields() {
    state.fieldList.innerHTML = "";
    const locked = !state.privateUnlocked;

    state.fields.forEach((field, index) => {
      const card = document.createElement("div");
      card.className = `field-card${isPhotoField(field) ? " is-photo" : ""}`;
      card.draggable = !locked;
      card.dataset.index = String(index);
      card.style.setProperty("--field-color", field.color);

      const isPhoto = isPhotoField(field);
      const hasPhotoValue = Boolean(isPhoto && field.value && field.value.startsWith("data:image/"));
      const photoPreview = locked
        ? `<span class="field-photo-empty">${imageIconSvg}<span>已锁定</span></span>`
        : hasPhotoValue
          ? `<img src="${escapeHtml(field.value)}" alt="图片预览">`
          : `<span class="field-photo-empty">${imageIconSvg}<span>未添加图片</span></span>`;

      card.innerHTML = `
        <div class="drag-handle" title="拖动排序">≡</div>
        <input class="field-key" value="${escapeHtml(field.key)}" aria-label="字段名" ${locked ? "disabled" : ""}>
        ${
          isPhoto
            ? `
              <button class="field-photo-trigger ${hasPhotoValue ? "has-image" : "is-empty"}" type="button" ${locked ? "disabled" : ""} aria-label="${locked ? "已锁定" : "选择图片"}">
                ${photoPreview}
              </button>
              <input class="field-photo-input" type="file" accept="image/*" aria-label="上传图片" ${locked ? "disabled" : ""}>
            `
            : `
              <input class="field-value" type="${locked ? "password" : "text"}" value="${escapeHtml(field.value)}" aria-label="字段值" placeholder="${locked ? "已锁定" : "请输入值"}" ${locked ? "disabled" : ""}>
            `
        }
        <button class="field-action" data-action="delete" title="删除">×</button>
      `;

      card.querySelector(".field-key").addEventListener("input", event => {
        if (locked) return;
        const previousKey = field.key;
        const nextKey = event.target.value.trim();
        state.fields[index].key = nextKey;
        state.publicDraftMarkdown = replaceTokenKey(state.publicDraftMarkdown, previousKey, nextKey);
        if (!state.aiEditorFocused) {
          api.renderAiEditor();
        }
        api.updateOutput();
        api.renderStatus();
      });

      if (isPhoto) {
        card.querySelector(".field-photo-trigger").addEventListener("click", () => {
          if (locked) return;
          card.querySelector(".field-photo-input")?.click();
        });

        card.querySelector(".field-photo-input").addEventListener("change", async event => {
          if (locked) return;
          const file = event.target.files && event.target.files[0];
          if (!file) {
            return;
          }
          if (!file.type.startsWith("image/")) {
            api.setStatus("请选择图片文件", "warning");
            return;
          }
          try {
            state.fields[index].value = await fileToDataUrl(file);
            event.target.value = "";
            api.renderFields();
            if (!state.aiEditorFocused) {
              api.renderAiEditor();
            }
            api.updateOutput();
            api.renderStatus();
          } catch {
            api.setStatus("图片读取失败", "warning");
          }
        });
      } else {
        card.querySelector(".field-value").addEventListener("input", event => {
          if (locked) return;
          state.fields[index].value = event.target.value;
          if (!state.aiEditorFocused) {
            api.renderAiEditor();
          }
          api.updateOutput();
          api.renderStatus();
        });
      }

      card.querySelector(".field-action").addEventListener("click", () => {
        if (locked) {
          api.setStatus("请先用密钥解锁隐私信息", "warning");
          return;
        }
        state.fields.splice(index, 1);
        api.renderFields();
        if (!state.aiEditorFocused) {
          api.renderAiEditor();
        }
        api.updateOutput();
        api.renderStatus();
      });

      card.addEventListener("dragstart", event => {
        if (locked) return;
        state.dragSourceIndex = index;
        api.clearDragPreview();
        event.dataTransfer.setData("text/plain", String(index));
        card.classList.add("dragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        state.dragSourceIndex = null;
        api.clearDragPreview();
      });

      card.addEventListener("dragover", event => {
        if (locked) return;
        event.preventDefault();
        const rect = card.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        api.setDragPreview(card, index, before);
      });

      card.addEventListener("drop", event => {
        if (locked) return;
        event.preventDefault();
        const fromIndex = state.dragSourceIndex ?? Number(event.dataTransfer.getData("text/plain"));
        const toIndex = state.dragTargetIndex ?? index;
        api.clearDragPreview();
        api.moveField(fromIndex, toIndex);
      });

      state.fieldList.appendChild(card);
    });
  };

  api.moveField = function moveField(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }
    const [field] = state.fields.splice(fromIndex, 1);
    state.fields.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, field);
    api.renderFields();
    api.updateOutput();
    api.renderStatus();
  };

  api.clearDragPreview = function clearDragPreview() {
    if (state.dragTargetCard) {
      state.dragTargetCard.classList.remove("drop-before", "drop-after");
    }
    state.dragTargetCard = null;
    state.dragTargetIndex = null;
    state.dragTargetPosition = null;
  };

  api.setDragPreview = function setDragPreview(card, index, before) {
    if (!card) return;
    if (state.dragTargetCard && state.dragTargetCard !== card) {
      state.dragTargetCard.classList.remove("drop-before", "drop-after");
    }
    state.dragTargetCard = card;
    state.dragTargetIndex = before ? index : index + 1;
    state.dragTargetPosition = before ? "before" : "after";
    card.classList.toggle("drop-before", before);
    card.classList.toggle("drop-after", !before);
  };

  api.addField = function addField() {
    if (!state.privateUnlocked) {
      api.setStatus("请先用密钥解锁隐私信息", "warning");
      return;
    }
    state.fields.push({
      key: "新字段",
      type: "text",
      value: "",
      color: colors[state.fields.length % colors.length]
    });
    api.renderFields();
    api.renderAiEditor();
    api.updateOutput();
    api.renderStatus();
  };

  api.addImage = function addImage() {
    if (!state.privateUnlocked) {
      api.setStatus("请先用密钥解锁隐私信息", "warning");
      return;
    }
    state.fields.push({
      key: createUniqueFieldKey(state, "图片"),
      type: "photo",
      value: "",
      color: colors[state.fields.length % colors.length]
    });
    api.renderFields();
    api.renderAiEditor();
    api.updateOutput();
    api.renderStatus();
  };
}
