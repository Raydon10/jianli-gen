import {
  colors,
  demoFields,
  demoSamples,
  defaultPrivateKeys,
  imageIconSvg
} from "./data.js";
import {
  escapeHtml,
  htmlToText,
  escapeRegExp,
  normalizeAiText,
  getSharedTextBounds,
  isSpanSaved,
  getTokenLabel,
  fileToDataUrl,
  maskText,
  replaceTokenKey,
  unmaskText,
  getPublicBullets
} from "./text.js";

export function createWorkspaceState() {
  return {
    colors,
    demoFields,
    demoSamples,
    defaultPrivateKeys,
    imageIconSvg,
    escapeHtml,
    htmlToText,
    escapeRegExp,
    normalizeAiText,
    getSharedTextBounds,
    isSpanSaved,
    getTokenLabel,
    fileToDataUrl,
    maskText,
    replaceTokenKey,
    unmaskText,
    getPublicBullets,
    fields: demoFields.map((field, index) => ({
      ...field,
      color: colors[index % colors.length]
    })),
    publicDraftMarkdown: "",
    savedMaskedPublicMarkdown: "",
    savedPrivateValues: {},
    savedPrivateFingerprint: "",
    savedPrivateKeys: [],
    savedPrivateTypes: [],
    privateMode: "plain",
    privateUnlocked: false,
    privateValuesResolved: false,
    hasEncryptedPrivate: false,
    appState: {},
    publicSampleIndex: 0,
    aiEditorFocused: false,
    aiNormalizeTimer: null,
    aiEditor: null,
    aiRenderSignature: "",
    dragSourceIndex: null,
    dragTargetIndex: null,
    dragTargetCard: null,
    dragTargetPosition: null,
    toastTimer: null,
    privateUnlockPopoverOpen: false,
    privateUnlockAction: "unlock",
    privateUnlockPopoverAnchor: null,
    rememberedUnlockPasswordKey: "jianli-gen.remembered-unlock-password"
  };
}

export function getTokenMappings(state) {
  const mappings = [];
  const currentValuesByKey = new Map(state.fields.map(field => [field.key, field.value]));

  state.fields.forEach(field => {
    if (field.key && field.value && field.type !== "photo") {
      mappings.push({
        key: field.key,
        value: field.value,
        source: "current"
      });
    }
  });

  Object.entries(state.savedPrivateValues).forEach(([key, value]) => {
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

export function getFieldByKey(state, key) {
  return state.fields.find(field => field.key === key);
}

export function isPhotoField(field) {
  return field?.type === "photo";
}

export function normalizeFieldType(type) {
  return type === "photo" ? "photo" : "text";
}

export function createUniqueFieldKey(state, base) {
  const existing = new Set(state.fields.map(field => field.key));
  if (!existing.has(base)) {
    return base;
  }

  let index = 2;
  while (existing.has(`${base}${index}`)) {
    index += 1;
  }

  return `${base}${index}`;
}

export function privateFingerprint(state) {
  return JSON.stringify(state.fields.map(({ key, type, value, color }) => ({
    key,
    type: normalizeFieldType(type),
    value,
    color
  })));
}

export function createEmptyPrivateFields(state, keys = defaultPrivateKeys, types = []) {
  return keys.map((key, index) => ({
    key,
    type: normalizeFieldType(types[index]),
    value: "",
    color: colors[index % colors.length]
  }));
}

export function cloneFields(sourceFields) {
  return sourceFields.map((field, index) => ({
    key: field.key,
    type: normalizeFieldType(field.type),
    value: field.value,
    color: colors[index % colors.length]
  }));
}

export function buildTokenMappings(sourceFields) {
  return sourceFields
    .filter(field => field.key && field.value && field.type !== "photo")
    .sort((a, b) => b.value.length - a.value.length)
    .map(field => ({
      key: field.key,
      value: field.value
    }));
}

export function getFieldColorMap(sourceFields) {
  return new Map(sourceFields.map(field => [field.key, field.color || "#8892a0"]));
}

export function applySample(state, sample, options = {}) {
  const { preservePrivateLock = false } = options;
  state.fields = cloneFields(sample.fields);
  state.publicDraftMarkdown = maskText(sample.publicMarkdown, buildTokenMappings(sample.fields), getFieldColorMap(sample.fields));
  state.savedMaskedPublicMarkdown = state.publicDraftMarkdown;
  state.savedPrivateValues = Object.fromEntries(sample.fields.map(field => [field.key, field.value]));
  state.savedPrivateTypes = sample.fields.map(field => normalizeFieldType(field.type));
  if (!preservePrivateLock) {
    state.privateUnlocked = true;
    state.hasEncryptedPrivate = false;
    state.savedPrivateKeys = sample.fields.map(field => field.key);
    state.privateValuesResolved = true;
  }
}

export function publicDirty(state) {
  return maskText(state.publicDraftMarkdown, getTokenMappings(state), getFieldColorMap(state.fields)) !== state.savedMaskedPublicMarkdown;
}

export function privateDirty(state) {
  if (state.hasEncryptedPrivate && !state.privateUnlocked && state.savedPrivateFingerprint === "") {
    return false;
  }
  return privateFingerprint(state) !== state.savedPrivateFingerprint;
}
