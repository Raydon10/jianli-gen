export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function htmlToText(value) {
  return String(value || "")
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

export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeAiText(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

export function getSharedTextBounds(current, saved) {
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

export function isSpanSaved(start, end, bounds, currentText, savedText) {
  if (!savedText) {
    return false;
  }

  if (normalizeAiText(currentText) === normalizeAiText(savedText)) {
    return true;
  }

  const savedSuffixStart = bounds.currentLength - bounds.suffix;
  return end <= bounds.prefix || start >= savedSuffixStart;
}

export function getTokenLabel(key) {
  return `{{${key}}}`;
}

export function getTokenStorageLabel(field) {
  if (!field?.id) {
    return getTokenLabel(field?.key || "");
  }
  return `{{${field.key}::${field.id}}}`;
}

export function parseTokenLabel(label) {
  const source = String(label || "").trim();
  const content = source.startsWith("{{") && source.endsWith("}}")
    ? source.slice(2, -2).trim()
    : source;
  const markerIndex = content.lastIndexOf("::");
  if (markerIndex === -1) {
    return {
      key: content,
      id: ""
    };
  }
  return {
    key: content.slice(0, markerIndex).trim(),
    id: content.slice(markerIndex + 2).trim()
  };
}

export function getDisplayTokenLabel(tokenOrKey) {
  return getTokenLabel(parseTokenLabel(tokenOrKey).key);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function maskText(text, mappings = [], colorByKey = new Map(), htmlMode = false) {
  let output = escapeHtml(text);

  mappings.forEach(mapping => {
    const token = mapping.token || getTokenStorageLabel(mapping);
    const replacement = htmlMode
      ? `<span class="token" style="--token-color:${colorByKey.get(mapping.id) || colorByKey.get(mapping.key) || "#8892a0"}">${escapeHtml(token)}</span>`
      : token;
    output = output.replace(new RegExp(escapeRegExp(escapeHtml(mapping.value)), "g"), replacement);
  });

  return output;
}

export function replaceTokenKey(text, oldKey, newKey) {
  if (!oldKey || oldKey === newKey) {
    return text;
  }

  return text.replace(new RegExp(escapeRegExp(getTokenLabel(oldKey)), "g"), getTokenLabel(newKey));
}

export function replaceTokenFieldKey(text, fieldId, oldKey, newKey) {
  if (!fieldId || !oldKey || oldKey === newKey) {
    return replaceTokenKey(text, oldKey, newKey);
  }
  return String(text || "").replace(
    new RegExp(escapeRegExp(`{{${oldKey}::${fieldId}}`), "g"),
    `{{${newKey}::${fieldId}}`
  );
}

export function unmaskText(text, mappings = []) {
  let output = String(text || "");

  mappings
    .filter(field => field.key && field.value && field.type !== "photo")
    .forEach(field => {
      if (field.id) {
        output = output.replace(new RegExp(escapeRegExp(getTokenStorageLabel(field)), "g"), field.value);
      }
    });

  mappings
    .filter(field => field.key && field.value && field.type !== "photo")
    .forEach(field => {
      output = output.replace(new RegExp(escapeRegExp(getTokenLabel(field.key)), "g"), field.value);
    });

  return output;
}

export function getPublicBullets(text = "") {
  return String(text || "")
    .split("\n")
    .map(line => line.trim())
    .filter(line => /^[-*]\s+/.test(line))
    .slice(0, 6)
    .map(line => line.replace(/^[-*]\s+/, ""));
}
