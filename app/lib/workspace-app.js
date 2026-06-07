import { createWorkspaceState } from "./workspace-shared.js";
import { setupFieldController } from "./field-controller.js";
import { setupAiController } from "./ai-controller.js";
import { setupPrivacyController } from "./privacy-controller.js";

export function initJianliApp() {
  const state = createWorkspaceState();
  const api = {};

  Object.assign(state, {
    fieldList: document.querySelector("#fieldList"),
    maskedPreview: document.querySelector("#maskedPreview"),
    tutorialDrawer: document.querySelector("#tutorialDrawer"),
    tutorialDrawerToggle: document.querySelector("#tutorialDrawerToggle"),
    tutorialDrawerToggleText: document.querySelector("#tutorialDrawerToggleText"),
    tutorialDrawerBody: document.querySelector("#tutorialDrawerBody"),
    resumePreview: document.querySelector("#resumePreview"),
    templateList: document.querySelector("#templateList"),
    templateScrollLeftButton: document.querySelector("#templateScrollLeft"),
    templateScrollRightButton: document.querySelector("#templateScrollRight"),
    addFieldButton: document.querySelector("#addField"),
    printButton: document.querySelector("#printResume"),
    viewLatestResumeButton: document.querySelector("#viewLatestResume"),
    regeneratePublicButton: document.querySelector("#regeneratePublic"),
    privateKeyInput: document.querySelector("#privateKey"),
    unlockPrivateButton: document.querySelector("#unlockPrivate"),
    unlockPrivateConfirmButton: document.querySelector("#unlockPrivateConfirm"),
    rememberUnlockCheckbox: document.querySelector("#rememberUnlock"),
    saveAllButton: document.querySelector("#saveAll"),
    saveHint: document.querySelector("#saveHint"),
    clearPrivateButton: document.querySelector("#clearPrivate"),
    addImageButton: document.querySelector("#addImage"),
    aiStatusBar: document.querySelector("#aiStatusBar"),
    privateStatusBar: document.querySelector("#privateStatusBar"),
    privateUnlockPopover: document.querySelector("#privateUnlockPopover"),
    privateUnlockNote: document.querySelector("#privateUnlockNote"),
    privateUnlockHint: document.querySelector("#privateUnlockHint"),
    toast: document.querySelector("#toast")
  });

  if (state.maskedPreview) {
    state.maskedPreview.innerHTML = "";
  }
  if (state.resumePreview) {
    state.resumePreview.innerHTML = "";
  }

  setupFieldController(state, api);
  setupAiController(state, api);
  setupPrivacyController(state, api);

  state.addFieldButton.addEventListener("click", () => api.addField());
  state.addImageButton.addEventListener("click", () => api.addImage());
  state.regeneratePublicButton.addEventListener("click", () => api.regeneratePublicExample());
  state.tutorialDrawerToggle?.addEventListener("click", () => {
    api.setTutorialDrawerOpen?.(!state.tutorialDrawerOpen);
  });
  state.printButton.addEventListener("click", () => {
    api.printCurrentResume?.();
  });
  state.viewLatestResumeButton?.addEventListener("click", () => {
    api.viewLatestAiOutput?.();
  });
  state.unlockPrivateButton.addEventListener("click", () => {
    if (state.privateMode === "plain") {
      api.setStatus("当前是无需密钥状态，可直接编辑隐私信息", "info");
      api.renderStatus();
      return;
    }
    if (state.privateUnlocked) {
      const password = api.getAvailablePrivatePassword();
      if (!password && !state.hasEncryptedPrivate) {
        api.openPrivateCredentialPrompt("unlock");
        return;
      }
      api.unlockPrivateData(password || state.privateKeyInput.value || api.getRememberedUnlockPassword());
      return;
    }
    api.openPrivateCredentialPrompt("unlock", state.unlockPrivateButton);
  });
  state.unlockPrivateConfirmButton.addEventListener("click", () => api.confirmPrivateCredentialAction());
  state.rememberUnlockCheckbox?.addEventListener("change", () => {
    if (!state.rememberUnlockCheckbox.checked) {
      sessionStorage.removeItem(state.rememberedUnlockPasswordKey);
      return;
    }
    api.updateRememberedUnlockPassword(state.privateKeyInput.value);
  });
  state.saveAllButton.addEventListener("click", event => {
    event.stopPropagation();
    api.saveAllData();
  });
  state.templateScrollLeftButton?.addEventListener("click", () => api.scrollTemplateList?.(-1));
  state.templateScrollRightButton?.addEventListener("click", () => api.scrollTemplateList?.(1));
  state.privateUnlockPopover?.addEventListener("click", event => {
    const target = event.target;
    if (target instanceof HTMLElement && target.id === "clearPrivate") {
      api.clearPrivateData();
    }
  });
  state.privateKeyInput.addEventListener("input", () => api.renderStatus());
  state.privateKeyInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      api.confirmPrivateCredentialAction();
    } else if (event.key === "Escape") {
      api.setPrivateUnlockPopoverOpen(false);
      api.renderStatus();
    }
  });
  state.maskedPreview.addEventListener("input", event => {
    api.syncMaskedPublicText();
    if (!event.isComposing) {
      api.scheduleAiNormalization();
    }
  });
  state.maskedPreview.addEventListener("pointerdown", event => {
    if (event.target !== state.maskedPreview) {
      return;
    }
    state.aiEditor?.focus?.();
  });
  window.addEventListener("resize", () => {
    api.updateResumePreviewScale?.();
    api.updateTemplateScrollControls?.();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      api.startAiOutputPolling?.();
      return;
    }
    api.stopAiOutputPolling?.();
  });
  state.maskedPreview.addEventListener("focusin", () => {
    state.aiEditorFocused = true;
    if (state.tutorialDrawerOpen) {
      api.setTutorialDrawerOpen?.(false);
    }
  });
  state.maskedPreview.addEventListener("focusout", () => {
    state.aiEditorFocused = false;
    if (state.aiNormalizeTimer) {
      clearTimeout(state.aiNormalizeTimer);
      state.aiNormalizeTimer = null;
    }
    api.normalizeAndRenderAiEditor(true);
    api.renderStatus();
  });

  document.addEventListener("click", event => {
    if (!state.privateUnlockPopoverOpen) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (state.privateUnlockPopover?.contains(target) || state.unlockPrivateButton.contains(target)) {
      return;
    }
    api.setPrivateUnlockPopoverOpen(false);
    api.renderStatus();
  });

  state.publicSampleIndex = 0;
  api.renderFields();
  api.renderAiEditor();
  api.generateResumePreview();
  api.renderStatus();
  api.loadResumeTemplates?.();
  api.loadSavedData().finally(() => {
    api.startAiOutputPolling?.();
  });
}
