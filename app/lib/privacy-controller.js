import {
  colors,
  defaultPrivateKeys
} from "./data.js";
import {
  decryptPrivateFields,
  encryptPrivateFields
} from "./crypto.js";
import {
  extractTokenRefs
} from "./text.js";
import {
  createFieldId,
  createEmptyPrivateFields,
  getPrivateFieldValidation,
  getFieldColorMap,
  getTokenMappings,
  normalizeField,
  normalizeFieldType,
  privateDirty,
  privateFingerprint,
  publicDirty,
  applySample
} from "./workspace-shared.js";

export function setupPrivacyController(state, api) {
  api.setStatus = function setStatus(message, type = "info") {
    if (!state.toast) return;
    state.toast.className = `toast is-visible ${type}`;
    state.toast.textContent = message;
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    state.toastTimer = window.setTimeout(() => {
      state.toast.className = "toast";
      state.toast.textContent = "";
    }, 2400);
  };

  api.getPrivateFieldValidation = function validatePrivateFields() {
    return getPrivateFieldValidation(state);
  };

  api.validatePrivateFieldsForSave = function validatePrivateFieldsForSave() {
    const validation = api.getPrivateFieldValidation();
    if (!validation.valid) {
      api.renderPrivateFieldValidation?.();
      api.renderStatus();
      return false;
    }
    return true;
  };

  api.syncMissingPrivateFieldsFromPublic = function syncMissingPrivateFieldsFromPublic() {
    const existingIds = new Set(state.fields.map(field => field.id).filter(Boolean));
    const existingKeys = new Set(state.fields.map(field => field.key).filter(Boolean));
    const tokenRefs = extractTokenRefs(state.publicDraftMarkdown);
    const missingRefs = tokenRefs.filter(ref => {
      if (ref.id && existingIds.has(ref.id)) {
        return false;
      }
      return !existingKeys.has(ref.key);
    });

    if (!missingRefs.length) {
      return false;
    }

    missingRefs.forEach(ref => {
      const id = ref.id || createFieldId(existingIds);
      state.fields.push({
        id,
        key: ref.key,
        type: "text",
        value: "",
        color: colors[state.fields.length % colors.length]
      });
      existingKeys.add(ref.key);
      existingIds.add(id);
    });

    api.renderFields();
    api.renderAiEditor();
    api.updateOutput();
    api.renderStatus();
    return true;
  };

  api.setPrivateUnlockPopoverOpen = function setPrivateUnlockPopoverOpen(open) {
    state.privateUnlockPopoverOpen = open;
    if (!state.privateUnlockPopover) {
      return;
    }
    if (!open) {
      state.privateUnlockPopoverAnchor = null;
    }
    const showForPlainModeAction = state.privateMode === "plain" && state.privateUnlockAction !== "unlock";
    state.privateUnlockPopover.hidden = !open || (state.privateUnlocked && !showForPlainModeAction);
    if (open && (!state.privateUnlocked || showForPlainModeAction)) {
      api.positionPrivateUnlockPopover(state.privateUnlockPopoverAnchor || state.unlockPrivateButton);
      if (state.rememberUnlockCheckbox?.checked) {
        const rememberedPassword = sessionStorage.getItem(state.rememberedUnlockPasswordKey);
        if (rememberedPassword) {
          state.privateKeyInput.value = rememberedPassword;
        }
      }
      window.requestAnimationFrame(() => state.privateKeyInput?.focus());
    }
  };

  api.positionPrivateUnlockPopover = function positionPrivateUnlockPopover(anchor) {
    if (!state.privateUnlockPopover || !anchor) {
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = state.privateUnlockPopover.getBoundingClientRect();
    const viewportPadding = 12;
    const preferredLeft = anchorRect.left;
    const preferredTop = anchorRect.bottom + 8;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - popoverRect.width - viewportPadding);
    const maxTop = Math.max(viewportPadding, window.innerHeight - popoverRect.height - viewportPadding);

    state.privateUnlockPopover.style.position = "fixed";
    state.privateUnlockPopover.style.left = `${Math.min(Math.max(preferredLeft, viewportPadding), maxLeft)}px`;
    state.privateUnlockPopover.style.top = `${Math.min(Math.max(preferredTop, viewportPadding), maxTop)}px`;
  };

  api.setPrivateUnlockPopoverMode = function setPrivateUnlockPopoverMode(action) {
    state.privateUnlockAction = action;
    if (!state.privateUnlockNote || !state.unlockPrivateConfirmButton) {
      return;
    }

    const contentMap = {
      unlock: {
        note: "请输入密钥后解锁隐私信息，勾选记住密钥，可在本次会话内自动恢复。",
        button: "解锁"
      },
      save: {
        note:
          state.privateMode === "plain"
            ? "当前是无需密钥状态，请输入密钥后保存，保存后隐私信息将恢复为需要密钥的状态。"
            : "当前隐私区需要密钥，输入密钥后继续保存，勾选记住密钥可在本次会话内自动恢复。",
        button: "保存"
      }
    };
    const content = contentMap[action] || contentMap.unlock;

    state.privateUnlockNote.textContent = content.note;
    state.unlockPrivateConfirmButton.textContent = content.button;
    if (state.rememberUnlockCheckbox) {
      state.rememberUnlockCheckbox.checked = true;
    }
    if (state.rememberUnlockCheckbox?.closest) {
      const rememberRow = state.rememberUnlockCheckbox.closest(".private-unlock-remember");
      if (rememberRow) {
        rememberRow.hidden = false;
      }
    }
  };

  api.openPrivateCredentialPrompt = function openPrivateCredentialPrompt(action, anchor = null) {
    state.privateUnlockPopoverAnchor = anchor || (action === "save" ? state.saveAllButton : state.unlockPrivateButton);
    api.setPrivateUnlockPopoverMode(action);
    api.setPrivateUnlockPopoverOpen(true);
    if (action === "save") {
      api.setStatus(
        state.privateMode === "plain"
          ? "当前是无需密钥状态，请输入密钥后保存"
          : "当前隐私区需要密钥，请输入密钥后继续保存",
        "warning"
      );
    } else {
      api.setStatus("请输入密钥后解锁隐私信息", "warning");
    }
    api.renderStatus();
  };

  api.updateRememberedUnlockPassword = function updateRememberedUnlockPassword(password) {
    if (!state.rememberUnlockCheckbox?.checked || !password) {
      sessionStorage.removeItem(state.rememberedUnlockPasswordKey);
      return;
    }
    sessionStorage.setItem(state.rememberedUnlockPasswordKey, password);
  };

  api.getRememberedUnlockPassword = function getRememberedUnlockPassword() {
    if (!state.rememberUnlockCheckbox?.checked) {
      return "";
    }
    return sessionStorage.getItem(state.rememberedUnlockPasswordKey) || "";
  };

  api.getAvailablePrivatePassword = function getAvailablePrivatePassword() {
    return state.privateKeyInput?.value || api.getRememberedUnlockPassword();
  };

  api.clearRememberedPrivatePassword = function clearRememberedPrivatePassword() {
    sessionStorage.removeItem(state.rememberedUnlockPasswordKey);
    if (state.rememberUnlockCheckbox) {
      state.rememberUnlockCheckbox.checked = false;
    }
    if (state.privateKeyInput) {
      state.privateKeyInput.value = "";
    }
  };

  api.lockEncryptedPrivateData = function lockEncryptedPrivateData() {
    const keys = state.savedPrivateKeys.length
      ? state.savedPrivateKeys
      : state.fields.map(field => field.key).filter(Boolean);
    const types = state.savedPrivateTypes.length
      ? state.savedPrivateTypes
      : state.fields.map(field => normalizeFieldType(field.type));
    state.fields = createEmptyPrivateFields(state, keys.length ? keys : defaultPrivateKeys, types);
    state.savedPrivateValues = {};
    state.savedPrivateFingerprint = "";
    state.privateUnlocked = false;
    state.privateValuesResolved = false;
    api.clearRememberedPrivatePassword();
  };

  api.renderStatus = function renderStatus() {
    const fieldValidation = api.getPrivateFieldValidation();
    const publicHasUnsavedChanges = publicDirty(state);
    const privateHasIssue = privateDirty(state) || !fieldValidation.valid;
    const privateClass = privateHasIssue ? "warning" : "ok";
    const canEditPrivate = state.privateMode === "plain" || state.privateUnlocked;

    if (state.privateMode === "plain") {
      state.privateUnlocked = true;
      state.privateValuesResolved = true;
    }
    if (state.unlockPrivateButton) {
      state.unlockPrivateButton.textContent = state.privateUnlocked ? "锁定" : "解锁";
      state.unlockPrivateButton.hidden = false;
      state.unlockPrivateButton.disabled = false;
    }
    if (state.addFieldButton) {
      state.addFieldButton.disabled = !canEditPrivate;
    }
    if (state.addImageButton) {
      state.addImageButton.disabled = !canEditPrivate;
    }
    if (state.saveAllButton) {
      state.saveAllButton.disabled = false;
    }
    if (state.saveHint) {
      state.saveHint.hidden = !(publicHasUnsavedChanges || privateHasIssue);
    }
    if (state.privateUnlockPopover) {
      const showForPlainModeAction = state.privateMode === "plain" && state.privateUnlockAction === "save";
      state.privateUnlockPopover.hidden = !state.privateUnlockPopoverOpen || (state.privateUnlocked && !showForPlainModeAction);
      if (!state.privateUnlockPopover.hidden && state.privateUnlockPopoverAnchor) {
        api.positionPrivateUnlockPopover(state.privateUnlockPopoverAnchor);
      }
    }

    if (state.aiStatusBar) {
      state.aiStatusBar.innerHTML = `
        <span class="status-tag ${publicHasUnsavedChanges ? "warning" : "ok"}">${publicHasUnsavedChanges ? "未保存" : "已保存"}</span>
      `;
    }

    if (state.privateStatusBar) {
      state.privateStatusBar.innerHTML = `
        <span class="status-tag ${privateClass}">${!fieldValidation.valid ? "需修改" : privateDirty(state) ? "未保存" : "已保存"}</span>
      `;
    }
  };

  api.regeneratePublicExample = function regeneratePublicExample() {
    if (state.hasEncryptedPrivate && !state.privateUnlocked) {
      api.setStatus("请先用密钥解锁隐私信息", "warning");
      return;
    }
    state.publicSampleIndex = (state.publicSampleIndex + 1) % state.demoSamples.length;
    applySample(state, state.demoSamples[state.publicSampleIndex]);
    api.renderFields();
    api.renderAiEditor();
    api.updateOutput();
    api.renderStatus();
  };

  api.apiRead = async function apiRead(path) {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    return response;
  };

  api.buildPrivateFieldsSnapshot = function buildPrivateFieldsSnapshot() {
    return state.fields.map((field, index) => ({
      id: field.id,
      key: field.key,
      type: normalizeFieldType(field.type),
      value: field.value,
      color: field.color || colors[index % colors.length]
    }));
  };

  api.savePlainPrivateData = async function savePlainPrivateData() {
    api.refreshPublicDraftFromEditor?.();
    api.syncMissingPrivateFieldsFromPublic();
    if (!api.validatePrivateFieldsForSave()) {
      return false;
    }
    const plainFields = api.buildPrivateFieldsSnapshot();
    const response = await fetch("/api/private", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "plain",
        fields: plainFields,
        metadata: {
          fieldKeys: plainFields.map(field => field.key),
          fieldTypes: plainFields.map(field => field.type),
          fieldCount: plainFields.length
        }
      })
    });

    if (!response.ok) {
      throw new Error("隐私信息保存失败");
    }

    state.appState = await response.json();
    state.privateMode = "plain";
    state.hasEncryptedPrivate = false;
    state.privateUnlocked = true;
    state.privateValuesResolved = true;
    state.savedPrivateFingerprint = privateFingerprint(state);
    state.savedPrivateKeys = plainFields.map(field => field.key);
    state.savedPrivateTypes = plainFields.map(field => field.type);
    state.savedPrivateValues = Object.fromEntries(plainFields.map(field => [field.key, field.value]));
    if (state.privateKeyInput) {
      state.privateKeyInput.value = "";
    }
    api.clearRememberedPrivatePassword();
    return true;
  };

  api.saveMaskedPublicData = async function saveMaskedPublicData() {
    api.refreshPublicDraftFromEditor?.();
    const payload = state.maskText(state.publicDraftMarkdown, getTokenMappings(state), getFieldColorMap(state.fields));

    const response = await fetch("/api/public-masked", {
      method: "PUT",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: payload
    });

    if (!response.ok) {
      throw new Error(`AI 读取的脱敏简历保存失败：${response.status}`);
    }

    state.appState = await response.json();
    state.savedMaskedPublicMarkdown = payload;
    api.renderStatus();
  };

  api.savePrivateData = async function savePrivateData(password = state.privateKeyInput.value || api.getRememberedUnlockPassword(), options = {}) {
    const lockAfter = Boolean(options.lockAfter);
    if (!password) {
      api.setStatus("请先输入密钥后保存隐私信息", "warning");
      return false;
    }
    api.refreshPublicDraftFromEditor?.();
    api.syncMissingPrivateFieldsFromPublic();
    if (!api.validatePrivateFieldsForSave()) {
      return false;
    }

    const encrypted = await encryptPrivateFields(state.fields, password);
    const response = await fetch("/api/private", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encrypted,
        metadata: {
          fieldKeys: state.fields.map(field => field.key),
          fieldTypes: state.fields.map(field => normalizeFieldType(field.type)),
          fieldCount: state.fields.length
        }
      })
    });

    if (!response.ok) {
      throw new Error("隐私信息保存失败");
    }

    state.appState = await response.json();
    state.privateMode = "encrypted";
    state.hasEncryptedPrivate = true;
    state.privateUnlocked = !lockAfter;
    state.privateValuesResolved = true;
    state.savedPrivateFingerprint = privateFingerprint(state);
    state.savedPrivateKeys = state.fields.map(field => field.key);
    state.savedPrivateTypes = state.fields.map(field => normalizeFieldType(field.type));
    state.savedPrivateValues = Object.fromEntries(state.fields.map(field => [field.key, field.value]));
    api.updateRememberedUnlockPassword(password);
    try {
      await api.saveMaskedPublicData();
    } catch (error) {
      console.error(error);
      api.setStatus(
        lockAfter
          ? "隐私信息已保存，AI读取的脱敏简历未同步保存"
          : "隐私信息已保存，AI读取的脱敏简历未同步保存",
        "warning"
      );
    }
    api.renderStatus();
    return true;
  };

  api.clearPrivateData = async function clearPrivateData() {
    const previousFields = state.fields.map(field => ({
      ...field
    }));
    api.setStatus("正在清空隐私值并切换到无需密钥状态...", "info");
    state.fields = state.fields.map(field => ({
      ...field,
      value: ""
    }));
    if (state.privateKeyInput) {
      state.privateKeyInput.value = "";
    }
    try {
      await api.savePlainPrivateData();
      api.renderFields();
      api.renderAiEditor();
      api.generateResumePreview();
      api.renderStatus();
      api.setPrivateUnlockPopoverOpen(false);
      api.setStatus("隐私值已清空，已切换到无需密钥状态", "ok");
    } catch {
      state.fields = previousFields;
      api.renderFields();
      api.renderAiEditor();
      api.generateResumePreview();
      api.renderStatus();
      api.setStatus("清空失败，请确认本地服务已启动", "warning");
    }
  };

  api.unlockPrivateData = async function unlockPrivateData(password = state.privateKeyInput.value, options = {}) {
    const silent = Boolean(options.silent);
    if (state.privateMode === "plain") {
      state.privateUnlocked = true;
      state.privateValuesResolved = true;
      api.setPrivateUnlockPopoverOpen(false);
      api.renderFields();
      api.renderAiEditor();
      api.generateResumePreview();
      api.renderStatus();
      if (!silent) {
        api.setStatus("当前是无需密钥状态，可直接编辑隐私信息", "ok");
      }
      return true;
    }

    if (state.privateUnlocked) {
      api.lockEncryptedPrivateData();
      api.setPrivateUnlockPopoverOpen(false);
      api.renderFields();
      api.renderAiEditor();
      api.generateResumePreview();
      api.renderStatus();
      api.setStatus("隐私信息已锁定", "ok");
      return;
    }

    if (!password) {
      if (!silent) {
        api.setStatus("请先输入密钥", "warning");
      }
      return;
    }

    try {
      const response = await api.apiRead("/api/private");
      if (!response) {
        api.setStatus("没有已保存的隐私信息", "warning");
        return false;
      }
      state.fields = (await decryptPrivateFields(password, await response.json())).map((field, index) => normalizeField(field, index));
      state.savedPrivateFingerprint = privateFingerprint(state);
      state.savedPrivateKeys = state.fields.map(field => field.key);
      state.savedPrivateTypes = state.fields.map(field => normalizeFieldType(field.type));
      state.savedPrivateValues = Object.fromEntries(state.fields.map(field => [field.key, field.value]));
      state.privateUnlocked = true;
      state.privateValuesResolved = true;
      api.setPrivateUnlockPopoverOpen(false);
      api.updateRememberedUnlockPassword(password);
      api.renderFields();
      api.renderAiEditor();
      api.generateResumePreview();
      api.renderStatus();
      if (!silent) {
        api.setStatus("隐私信息已解锁", "ok");
      }
      return true;
    } catch {
      api.lockEncryptedPrivateData();
      api.renderFields();
      api.renderAiEditor();
      api.generateResumePreview();
      api.renderStatus();
      if (!silent) {
        api.setStatus("密钥不正确，无法解锁隐私信息", "warning");
      }
      return false;
    }
  };

  api.confirmPrivateCredentialAction = async function confirmPrivateCredentialAction() {
    const password = state.privateKeyInput.value || api.getRememberedUnlockPassword();
    if (!password) {
      api.setStatus(
        state.privateUnlockAction === "save"
          ? "请输入密钥后保存"
          : "请先输入密钥",
        "warning"
      );
      state.privateKeyInput?.focus();
      return;
    }

    if (state.privateUnlockAction === "save") {
      api.setStatus("正在保存隐私信息...", "info");
      try {
        const saved = await api.savePrivateData(password);
        if (saved !== false) {
          api.setPrivateUnlockPopoverOpen(false);
        }
      } catch {
        api.setStatus("隐私信息保存失败，请确认本地服务已启动", "warning");
      }
      return;
    }

    const unlocked = await api.unlockPrivateData(password, { silent: true });
    if (unlocked) {
      api.setPrivateUnlockPopoverOpen(false);
      api.setStatus("隐私信息已解锁", "ok");
    } else {
      api.clearRememberedPrivatePassword();
      api.setStatus("密钥不正确，无法解锁隐私信息", "warning");
    }
  };

  api.saveAllData = async function saveAllData() {
    api.refreshPublicDraftFromEditor?.();
    api.syncMissingPrivateFieldsFromPublic();
    const publicChanged = publicDirty(state);
    const privateChanged = privateDirty(state);
    if (!api.validatePrivateFieldsForSave()) {
      api.renderFields();
      api.renderStatus();
      return false;
    }
    if (!publicChanged && !privateChanged && state.privateMode !== "plain") {
      api.setStatus("没有需要保存的内容", "info");
      return;
    }

    if (state.privateMode === "plain") {
      const privatePassword = api.getAvailablePrivatePassword();
      if (!privatePassword) {
        api.setStatus("当前是无需密钥状态，请输入密钥后保存", "warning");
        api.openPrivateCredentialPrompt("save", state.saveAllButton);
        return;
      }

      let publicSaved = false;
      let publicFailed = "";
      try {
        if (publicChanged) {
          await api.saveMaskedPublicData();
          publicSaved = true;
        }
      } catch (error) {
        console.error(error);
        publicFailed = error instanceof Error ? error.message : "AI读取的脱敏简历保存失败";
      }

      try {
        const saved = await api.savePrivateData(privatePassword);
        if (publicSaved) {
          api.setStatus("AI读取的脱敏简历和隐私信息已保存", "ok");
          return;
        }
        if (saved) {
          api.setStatus("隐私信息已保存", "ok");
          return;
        }
      } catch (error) {
        console.error(error);
        if (publicSaved) {
          api.setStatus("AI读取的脱敏简历已保存，隐私信息保存失败", "warning");
        } else if (publicFailed) {
          api.setStatus(`${publicFailed}，隐私信息保存失败`, "warning");
        } else {
          api.setStatus("隐私信息保存失败，请确认本地服务已启动", "warning");
        }
        return;
      }

      if (publicSaved) {
        api.setStatus("AI读取的脱敏简历已保存", "ok");
      } else if (publicFailed) {
        api.setStatus(publicFailed, "warning");
      }
      return true;
    }

    let publicSaved = false;
    let privateSaved = false;
    let publicFailed = "";
    let privateFailed = false;
    let privateNeedsKey = false;

    if (publicChanged) {
      try {
        await api.saveMaskedPublicData();
        publicSaved = true;
      } catch (error) {
        console.error(error);
        publicFailed = error instanceof Error ? error.message : "AI读取的脱敏简历保存失败";
      }
    }

    if (privateChanged) {
      const privatePassword = api.getAvailablePrivatePassword();
      if (!privatePassword) {
        privateNeedsKey = true;
      } else {
        try {
          const saved = await api.savePrivateData(privatePassword);
          privateSaved = Boolean(saved);
        } catch (error) {
          console.error(error);
          privateFailed = true;
        }
      }
    }

    if (publicSaved && privateSaved) {
      api.setStatus("AI读取的脱敏简历和隐私信息已保存", "ok");
      return;
    }

    if (publicSaved && privateNeedsKey) {
      api.setStatus("AI读取的脱敏简历已保存，隐私信息未保存，请输入密钥后继续保存", "warning");
      api.openPrivateCredentialPrompt("save", state.saveAllButton);
      return;
    }

    if (publicSaved && privateFailed) {
      api.setStatus("AI读取的脱敏简历已保存，隐私信息保存失败", "warning");
      return;
    }

    if (publicSaved && !privateChanged) {
      api.setStatus("AI读取的脱敏简历已保存", "ok");
      return;
    }

    if (!publicChanged && privateSaved) {
      api.setStatus("隐私信息已保存", "ok");
      return;
    }

    if (!publicChanged && privateNeedsKey) {
      api.setStatus("隐私信息需要密钥，请输入后继续保存", "warning");
      api.openPrivateCredentialPrompt("save", state.saveAllButton);
      return;
    }

    if (!publicChanged && privateFailed) {
      api.setStatus("隐私信息保存失败，请确认本地服务已启动", "warning");
      return;
    }

    if (publicFailed && privateSaved) {
      api.setStatus(`${publicFailed}，隐私信息已保存`, "warning");
      return;
    }

    if (publicFailed && privateFailed) {
      api.setStatus(`${publicFailed}，隐私信息保存失败`, "warning");
      return;
    }

    if (publicFailed && privateNeedsKey) {
      api.setStatus(`${publicFailed}，隐私信息未保存，请先输入密钥后保存隐私信息`, "warning");
      return;
    }

    if (publicFailed && !privateChanged) {
      api.setStatus(publicFailed, "warning");
      return;
    }

    api.setStatus("保存失败，请确认本地服务已启动", "warning");
    return false;
  };

  api.loadSavedData = async function loadSavedData() {
    try {
      const stateResponse = await api.apiRead("/api/state");
      state.appState = stateResponse ? await stateResponse.json() : {};
      state.privateMode = state.appState.privateMode || (state.appState.privateEncrypted ? "encrypted" : "plain");
      state.hasEncryptedPrivate = state.privateMode === "encrypted";
      state.savedPrivateKeys = Array.isArray(state.appState.privateFieldKeys) ? state.appState.privateFieldKeys : [];
      state.savedPrivateTypes = Array.isArray(state.appState.privateFieldTypes) ? state.appState.privateFieldTypes : [];

      const maskedResponse = await api.apiRead("/api/public-masked");
      if (maskedResponse) {
        state.savedMaskedPublicMarkdown = await maskedResponse.text();
      } else {
        state.savedMaskedPublicMarkdown = "";
      }

      if (state.rememberUnlockCheckbox && sessionStorage.getItem(state.rememberedUnlockPasswordKey)) {
        state.rememberUnlockCheckbox.checked = true;
      }
      if (state.privateMode !== "encrypted") {
        sessionStorage.removeItem(state.rememberedUnlockPasswordKey);
        if (state.rememberUnlockCheckbox) {
          state.rememberUnlockCheckbox.checked = false;
        }
      }

      const privateResponse = await api.apiRead("/api/private");
      if (state.privateMode === "encrypted") {
        const encryptedPayload = privateResponse ? await privateResponse.json() : null;
        const hasEncryptedPayload = Boolean(encryptedPayload?.ciphertext && encryptedPayload?.salt && encryptedPayload?.iv);
        if (hasEncryptedPayload) {
          const keys = state.savedPrivateKeys.length
            ? state.savedPrivateKeys
            : Array.from({ length: state.appState.privateFieldCount || 0 }, (_, index) => `隐私字段${index + 1}`);
          state.fields = createEmptyPrivateFields(state, keys, state.savedPrivateTypes);
          state.privateUnlocked = false;
          state.privateValuesResolved = false;
          state.savedPrivateValues = {};
          state.savedPrivateFingerprint = "";
        } else {
          state.privateMode = "plain";
          state.hasEncryptedPrivate = false;
          state.fields = createEmptyPrivateFields(
            state,
            state.savedPrivateKeys.length ? state.savedPrivateKeys : defaultPrivateKeys,
            state.savedPrivateTypes
          );
          state.privateUnlocked = true;
          state.privateValuesResolved = true;
          state.savedPrivateValues = Object.fromEntries(state.fields.map(field => [field.key, field.value]));
          state.savedPrivateFingerprint = privateFingerprint(state);
        }
      } else {
        if (privateResponse) {
          const payload = await privateResponse.json();
          const plainFields = Array.isArray(payload.fields) ? payload.fields : [];
          if (plainFields.length) {
            state.fields = plainFields.map((field, index) => normalizeField(field, index));
          } else if (state.appState.privateMode === "plain" || state.appState.privateClearedAt) {
            state.fields = createEmptyPrivateFields(
              state,
              state.savedPrivateKeys.length ? state.savedPrivateKeys : defaultPrivateKeys,
              state.savedPrivateTypes
            );
          } else {
            state.fields = state.fields.map((field, index) => normalizeField(field, index));
          }
        } else if (state.appState.privateMode === "plain" || state.appState.privateClearedAt) {
          state.fields = createEmptyPrivateFields(
            state,
            state.savedPrivateKeys.length ? state.savedPrivateKeys : defaultPrivateKeys,
            state.savedPrivateTypes
          );
        } else {
          state.fields = state.fields.map((field, index) => normalizeField(field, index));
        }
        state.privateUnlocked = true;
        state.privateValuesResolved = true;
        state.savedPrivateValues = Object.fromEntries(state.fields.map(field => [field.key, field.value]));
        state.savedPrivateFingerprint = privateFingerprint(state);
        if (state.privateMode === "plain" && state.privateKeyInput) {
          state.privateKeyInput.value = "";
        }
        if (!state.savedMaskedPublicMarkdown) {
          applySample(state, state.demoSamples[0], { preservePrivateLock: true });
          state.savedMaskedPublicMarkdown = state.publicDraftMarkdown;
        }
      }

      state.publicDraftMarkdown = state.savedMaskedPublicMarkdown || state.publicDraftMarkdown || "";
    } catch {
      applySample(state, state.demoSamples[0], { preservePrivateLock: true });
      state.savedMaskedPublicMarkdown = state.publicDraftMarkdown;
      state.savedPrivateValues = Object.fromEntries(state.fields.map(field => [field.key, field.value]));
      state.savedPrivateFingerprint = privateFingerprint(state);
      state.privateMode = "plain";
      state.privateUnlocked = true;
      state.privateValuesResolved = true;
      if (state.privateKeyInput) {
        state.privateKeyInput.value = "";
      }
      api.setStatus("保存服务未启动，当前仅可预览", "warning");
    }

    api.renderFields();
    api.renderAiEditor();
    api.generateResumePreview();
    api.renderStatus();

    if (state.privateMode === "encrypted" && !state.privateUnlocked) {
      const rememberedPassword = api.getRememberedUnlockPassword();
      if (rememberedPassword) {
        await api.unlockPrivateData(rememberedPassword, { silent: true });
      }
    }
  };
}
