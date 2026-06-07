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
  unmaskText,
  getPublicBullets,
  getTokenStorageLabel
} from "./text.js";

export function createFieldId(existingIds = []) {
  const usedIds = new Set(existingIds);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomPart = globalThis.crypto?.getRandomValues
      ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)), byte => byte.toString(36).padStart(2, "0")).join("").slice(0, 8)
      : Math.random().toString(36).slice(2, 10).padEnd(8, "0");
    const id = `fld_${randomPart}`;
    if (!usedIds.has(id)) {
      return id;
    }
  }

  return `fld_${Date.now().toString(36).slice(-8)}`;
}

export function normalizeField(field, index = 0) {
  return {
    id: field.id || createFieldId(),
    key: field.key || "",
    type: normalizeFieldType(field.type),
    value: field.value || "",
    color: field.color || colors[index % colors.length]
  };
}

export function isFixedPrivateField(field) {
  return field?.key === "姓名";
}

export function createInitialPrivateFields(state) {
  return createEmptyPrivateFields(state, defaultPrivateKeys, ["text", "photo", "text", "text", "text"]);
}

export function ensureInitialPrivateFields(state, fields) {
  const normalizedFields = Array.isArray(fields)
    ? fields.map((field, index) => normalizeField(field, index)).filter(field => field.key)
    : [];
  const nameField = normalizedFields.find(field => field.key === "姓名");
  const otherFields = normalizedFields.filter(field => field.key !== "姓名");

  return [
    nameField || createEmptyPrivateFields(state, ["姓名"])[0],
    ...otherFields
  ];
}

export function createWorkspaceState() {
  return {
    colors,
    demoFields,
    demoSamples,
    tutorialMarkdown: demoSamples[0].publicMarkdown,
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
    unmaskText,
    getPublicBullets,
    fields: demoFields.map((field, index) => normalizeField(field, index)),
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
    tutorialDrawerOpen: true,
    aiEditorFocused: false,
    aiNormalizeTimer: null,
    aiEditor: null,
    aiRenderSignature: "",
    aiOutputVersion: "",
    pendingAiOutputVersion: "",
    aiOutputPollTimer: null,
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
        id: field.id,
        key: field.key,
        value: field.value,
        token: getTokenStorageLabel(field),
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

export function getFieldById(state, id) {
  return state.fields.find(field => field.id === id);
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

export function getPrivateFieldValidation(state) {
  const emptyKeyIndexes = new Set();
  const duplicateKeyIndexes = new Set();
  const duplicateValueIndexes = new Set();
  const keyIndexes = new Map();
  const valueIndexes = new Map();

  state.fields.forEach((field, index) => {
    const key = String(field.key || "").trim();
    const value = String(field.value || "").trim();
    if (!key) {
      emptyKeyIndexes.add(index);
    } else {
      keyIndexes.set(key, [...(keyIndexes.get(key) || []), index]);
    }
    if (value) {
      valueIndexes.set(value, [...(valueIndexes.get(value) || []), index]);
    }
  });

  keyIndexes.forEach(indexes => {
    if (indexes.length > 1) {
      indexes.forEach(index => duplicateKeyIndexes.add(index));
    }
  });
  valueIndexes.forEach(indexes => {
    if (indexes.length > 1) {
      indexes.forEach(index => duplicateValueIndexes.add(index));
    }
  });

  const messages = [];
  if (emptyKeyIndexes.size) {
    messages.push("字段名不能为空");
  }
  if (duplicateKeyIndexes.size) {
    messages.push("字段名不能重复");
  }
  if (duplicateValueIndexes.size) {
    messages.push("字段值不能重复");
  }

  return {
    duplicateKeyIndexes,
    duplicateValueIndexes,
    emptyKeyIndexes,
    valid: messages.length === 0,
    message: messages.join("，")
  };
}

export function privateFingerprint(state) {
  return JSON.stringify(state.fields.map(({ id, key, type, value, color }) => ({
    id,
    key,
    type: normalizeFieldType(type),
    value,
    color
  })));
}

export function createEmptyPrivateFields(state, keys = defaultPrivateKeys, types = []) {
  return keys.map((key, index) => ({
    id: createFieldId(),
    key,
    type: normalizeFieldType(types[index]),
    value: "",
    color: colors[index % colors.length]
  }));
}

export function cloneFields(sourceFields) {
  return sourceFields.map((field, index) => normalizeField(field, index));
}

export function buildTokenMappings(sourceFields) {
  return sourceFields
    .filter(field => field.key && field.value && field.type !== "photo")
    .sort((a, b) => b.value.length - a.value.length)
    .map(field => ({
      id: field.id,
      key: field.key,
      value: field.value,
      token: getTokenStorageLabel(field)
    }));
}

export function getFieldColorMap(sourceFields) {
  return new Map(sourceFields.flatMap(field => [
    [field.id || field.key, field.color || "#8892a0"],
    [field.key, field.color || "#8892a0"]
  ]));
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
