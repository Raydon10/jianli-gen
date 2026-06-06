import { colors, imageIconSvg } from "./data.js";
import { escapeHtml, fileToDataUrl, hasFieldToken, replaceFieldTokenWithValue } from "./text.js";
import {
  createUniqueFieldKey,
  createFieldId,
  isPhotoField,
} from "./workspace-shared.js";

export function setupFieldController(state, api) {
  api.renderFields = function renderFields() {
    state.fieldList.innerHTML = "";
    const locked = !state.privateUnlocked;
    const validation = api.getPrivateFieldValidation
      ? api.getPrivateFieldValidation()
      : { duplicateKeyIndexes: new Set(), duplicateValueIndexes: new Set(), emptyKeyIndexes: new Set() };

    state.fields.forEach((field, index) => {
      const card = document.createElement("div");
      card.className = `field-card${isPhotoField(field) ? " is-photo" : ""}`;
      card.draggable = !locked;
      card.dataset.index = String(index);
      card.style.setProperty("--field-color", field.color);

      const isPhoto = isPhotoField(field);
      const keyErrorText = validation.emptyKeyIndexes.has(index)
        ? "字段名必填"
        : validation.duplicateKeyIndexes.has(index)
          ? "字段名重复"
          : "";
      const keyHasError = Boolean(keyErrorText);
      const valueHasError = validation.duplicateValueIndexes.has(index);
      const hasPhotoValue = Boolean(isPhoto && field.value && field.value.startsWith("data:image/"));
      const photoPreview = locked
        ? `<span class="field-photo-empty">${imageIconSvg}<span>已锁定</span></span>`
        : hasPhotoValue
          ? `<img src="${escapeHtml(field.value)}" alt="图片预览">`
          : `<span class="field-photo-empty">${imageIconSvg}<span>未添加图片</span></span>`;

      card.innerHTML = `
        <div class="drag-handle" title="拖动排序">≡</div>
        <div class="field-cell">
          <input class="field-key${keyHasError ? " has-error" : ""}" value="${escapeHtml(field.key)}" aria-label="字段名" placeholder="字段名" ${keyHasError ? 'aria-invalid="true"' : ""} ${locked ? "disabled" : ""}>
          <div class="field-error" data-error-for="key" ${keyHasError ? "" : "hidden"}>${keyErrorText}</div>
        </div>
        ${
          isPhoto
            ? `
              <div class="field-cell">
                <button class="field-photo-trigger ${hasPhotoValue ? "has-image" : "is-empty"}${valueHasError ? " has-error" : ""}" type="button" ${valueHasError ? 'aria-invalid="true"' : ""} ${locked ? "disabled" : ""} aria-label="${locked ? "已锁定" : "选择图片"}">
                  ${photoPreview}
                </button>
                <input class="field-photo-input" type="file" accept="image/*" aria-label="上传图片" ${locked ? "disabled" : ""}>
                <div class="field-error" data-error-for="value" ${valueHasError ? "" : "hidden"}>${valueHasError ? "字段值重复" : ""}</div>
              </div>
            `
            : `
              <div class="field-cell">
                <input class="field-value${valueHasError ? " has-error" : ""}" type="${locked ? "password" : "text"}" value="${escapeHtml(field.value)}" aria-label="字段值" placeholder="${locked ? "已锁定" : "字段值"}" ${valueHasError ? 'aria-invalid="true"' : ""} ${locked ? "disabled" : ""}>
                <div class="field-error" data-error-for="value" ${valueHasError ? "" : "hidden"}>${valueHasError ? "字段值重复" : ""}</div>
              </div>
            `
        }
        <div class="field-actions-menu">
          <button class="field-action" type="button" title="字段操作" aria-label="字段操作">⋯</button>
          <div class="field-actions-popover">
            <button class="field-menu-item" data-action="clear-value" type="button">取消脱敏</button>
            <button class="field-menu-item danger" data-action="delete" type="button">删除</button>
          </div>
        </div>
      `;

      card.querySelector(".field-key").addEventListener("input", event => {
        if (locked) return;
        const nextKey = event.target.value.trim();
        state.fields[index].key = nextKey;
        if (!state.aiEditorFocused) {
          api.renderAiEditor();
        }
        if (state.aiEditor) {
          state.publicDraftMarkdown = state.aiEditor.serialize();
        }
        api.updateOutput();
        api.renderStatus();
        api.renderPrivateFieldValidation();
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
            api.renderPrivateFieldValidation();
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
          api.renderPrivateFieldValidation();
        });
      }

      card.querySelector("[data-action='clear-value']").addEventListener("click", event => {
        event.preventDefault();
        api.closeFieldActionsMenu(card);
        if (locked) {
          api.setStatus("请先用密钥解锁隐私信息", "warning");
          return;
        }
        if (!isPhotoField(state.fields[index])) {
          state.publicDraftMarkdown = replaceFieldTokenWithValue(state.publicDraftMarkdown, state.fields[index]);
        }
        state.fields[index].value = "";
        api.renderFields();
        api.renderAiEditor();
        api.updateOutput();
        api.renderStatus();
      });

      card.querySelector("[data-action='delete']").addEventListener("click", event => {
        event.preventDefault();
        api.closeFieldActionsMenu(card);
        if (locked) {
          api.setStatus("请先用密钥解锁隐私信息", "warning");
          return;
        }
        api.refreshPublicDraftFromEditor?.();
        if (hasFieldToken(state.publicDraftMarkdown, state.fields[index])) {
          api.setStatus("字段被使用，请在脱敏简历中删除或取消脱敏后再操作", "warning");
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

      const actionsMenu = card.querySelector(".field-actions-menu");
      actionsMenu?.addEventListener("mouseenter", () => api.positionFieldActionsMenu(actionsMenu));
      actionsMenu?.addEventListener("focusin", () => api.positionFieldActionsMenu(actionsMenu));

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

  api.renderPrivateFieldValidation = function renderPrivateFieldValidation() {
    if (!state.fieldList || !api.getPrivateFieldValidation) {
      return;
    }
    const validation = api.getPrivateFieldValidation();
    state.fieldList.querySelectorAll(".field-card").forEach((card, index) => {
      const keyInput = card.querySelector(".field-key");
      const valueInput = card.querySelector(".field-value");
      const photoTrigger = card.querySelector(".field-photo-trigger");
      const keyError = card.querySelector("[data-error-for='key']");
      const valueError = card.querySelector("[data-error-for='value']");
      const keyErrorText = validation.emptyKeyIndexes.has(index)
        ? "字段名必填"
        : validation.duplicateKeyIndexes.has(index)
          ? "字段名重复"
          : "";
      const keyHasError = Boolean(keyErrorText);
      const valueHasError = validation.duplicateValueIndexes.has(index);

      keyInput?.classList.toggle("has-error", keyHasError);
      if (keyInput) {
        keyInput.toggleAttribute("aria-invalid", keyHasError);
      }
      if (keyError) {
        keyError.textContent = keyErrorText;
        keyError.hidden = !keyHasError;
      }

      valueInput?.classList.toggle("has-error", valueHasError);
      if (valueInput) {
        valueInput.toggleAttribute("aria-invalid", valueHasError);
      }
      photoTrigger?.classList.toggle("has-error", valueHasError);
      if (photoTrigger) {
        photoTrigger.toggleAttribute("aria-invalid", valueHasError);
      }
      if (valueError) {
        valueError.textContent = valueHasError ? "字段值重复" : "";
        valueError.hidden = !valueHasError;
      }
    });
  };

  api.positionFieldActionsMenu = function positionFieldActionsMenu(menu) {
    if (!menu || !state.fieldList) {
      return;
    }
    const menuRect = menu.getBoundingClientRect();
    const listRect = state.fieldList.getBoundingClientRect();
    const estimatedMenuHeight = 72;
    const gap = 6;
    const spaceBelow = listRect.bottom - menuRect.bottom;
    const spaceAbove = menuRect.top - listRect.top;
    menu.classList.toggle("drop-up", spaceBelow < estimatedMenuHeight + gap && spaceAbove > estimatedMenuHeight + gap);
  };

  api.closeFieldActionsMenu = function closeFieldActionsMenu(card) {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && card?.contains(activeElement)) {
      activeElement.blur();
    }
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
      id: createFieldId(state.fields.map(field => field.id)),
      key: createUniqueFieldKey(state, "新字段"),
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
      id: createFieldId(state.fields.map(field => field.id)),
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
