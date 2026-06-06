import { Editor, Extension, getChangedRanges, mergeAttributes, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Fragment } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";

const defaultColor = "#8892a0";

function normalizeText(text) {
  return (text || "").replace(/\r\n?/g, "\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getTokenLabel(key) {
  return `{{${key}}}`;
}

function getTokenStorageLabel(field) {
  return getTokenLabel(field?.key || "");
}

function parseTokenLabel(label) {
  const source = String(label || "").trim();
  const content = source.startsWith("{{") && source.endsWith("}}")
    ? source.slice(2, -2).trim()
    : source;
  return {
    key: content,
    id: ""
  };
}

function getFieldByToken(fields, token) {
  const parsed = parseTokenLabel(token);
  return fields.find(field => field.key === parsed.key);
}

function createTokenNode(field, state, value = field?.value || "") {
  return {
    type: "token",
    attrs: {
      id: field?.id || "",
      key: field?.key || "",
      state,
      color: field?.color || defaultColor,
      value
    }
  };
}

function tokenizeLine(line, fields, tokenState = "saved") {
  const nodes = [];
  let cursor = 0;

  while (cursor < line.length) {
    let best = null;

    const tokenStart = line.indexOf("{{", cursor);
    if (tokenStart !== -1) {
      const tokenEnd = line.indexOf("}}", tokenStart + 2);
      if (tokenEnd !== -1) {
        best = {
          type: "token",
          start: tokenStart,
          end: tokenEnd + 2,
          text: line.slice(tokenStart, tokenEnd + 2),
          token: line.slice(tokenStart, tokenEnd + 2)
        };
      }
    }

    for (const field of fields) {
      if (!field.key || !field.value) {
        continue;
      }
      const index = line.indexOf(field.value, cursor);
      if (index === -1) {
        continue;
      }
      const candidate = {
        type: "value",
        start: index,
        end: index + field.value.length,
        field
      };
      if (
        !best ||
        candidate.start < best.start ||
        (candidate.start === best.start && candidate.end - candidate.start > best.end - best.start)
      ) {
        best = candidate;
      }
    }

    if (!best) {
      nodes.push({ type: "text", text: line.slice(cursor) });
      break;
    }

    if (best.start > cursor) {
      nodes.push({ type: "text", text: line.slice(cursor, best.start) });
    }

    if (best.type === "token") {
      const parsed = parseTokenLabel(best.token);
      const field = getFieldByToken(fields, best.token);
      nodes.push(
        createTokenNode(field || { key: parsed.key, id: parsed.id, color: defaultColor, value: "" }, tokenState, field?.value || "")
      );
    } else if (best.field) {
      nodes.push(createTokenNode(best.field, "provisional", best.field.value));
    }

    cursor = best.end;
  }

  return nodes;
}

function buildDoc(text, fields) {
  const lines = normalizeText(text).split("\n");
  return {
    type: "doc",
    content: lines.map(line => {
      const content = tokenizeLine(line, fields);
      return content.length
        ? { type: "paragraph", content }
        : { type: "paragraph" };
    })
  };
}

function serializeNode(node) {
  if (!node) {
    return "";
  }

  if (node.type === "text") {
    return node.text || "";
  }

  if (node.type === "token") {
    return getTokenStorageLabel(node.attrs || {});
  }

  if (!node.content) {
    return "";
  }

  const inner = node.content.map(serializeNode).join("");
  if (node.type === "paragraph") {
    return inner;
  }

  return inner;
}

function serializeDoc(doc) {
  const lines = doc.content?.map(serializeNode) || [];
  return lines.join("\n").replace(/\n$/, "");
}

function serializeResolvedNode(node, fields, revealValues = false) {
  if (!node) {
    return "";
  }

  if (node.type === "text") {
    return node.text || "";
  }

  if (node.type === "token") {
    const field = node.attrs?.id
      ? fields.find(item => item.id === node.attrs.id)
      : fields.find(item => item.key === node.attrs?.key);
    if (revealValues && field?.value) {
      return field.value;
    }
    return getTokenLabel(field?.key || node.attrs?.key || "");
  }

  if (!node.content) {
    return "";
  }

  const inner = node.content.map(child => serializeResolvedNode(child, fields, revealValues)).join("");
  if (node.type === "paragraph") {
    return inner;
  }

  return inner;
}

function serializeResolvedDoc(doc, fields, revealValues = false) {
  const lines = doc.content?.map(node => serializeResolvedNode(node, fields, revealValues)) || [];
  return lines.join("\n").replace(/\n$/, "");
}

function buildTokenNodeJSON(field, state, color, value) {
  return {
    type: "token",
    attrs: {
      id: field.id || "",
      key: field.key || "",
      state,
      color: color || field.color || defaultColor,
      value: value || field.value || ""
    }
  };
}

function buildTokenNodePM(schema, field, state, color, value) {
  return schema.nodes.token.create({
    id: field.id || "",
    key: field.key || "",
    state,
    color: color || field.color || defaultColor,
    value: value || field.value || ""
  });
}

function refreshTokenFields(editor, fields) {
  const tr = editor.state.tr;
  let changed = false;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "token") {
      return;
    }
    const field = node.attrs.id
      ? fields.find(item => item.id === node.attrs.id)
      : fields.find(item => item.key === node.attrs.key);
    if (!field) {
      return;
    }
    const attrs = {
      ...node.attrs,
      id: field.id || "",
      key: field.key || "",
      color: field.color || defaultColor,
      value: field.value || ""
    };
    if (
      attrs.id !== node.attrs.id ||
      attrs.key !== node.attrs.key ||
      attrs.color !== node.attrs.color ||
      attrs.value !== node.attrs.value
    ) {
      tr.setNodeMarkup(pos, undefined, attrs);
      changed = true;
    }
  });

  if (changed) {
    editor.view.dispatch(tr);
  }
}

function getActiveFields(fields) {
  return fields
    .filter(field => field.key)
    .sort((a, b) => (b.value?.length || 0) - (a.value?.length || 0));
}

function findBestTokenMatch(text, cursor, fields) {
  let best = null;

  for (const field of fields) {
    const tokenLabels = [getTokenLabel(field.key)];
    for (const tokenLabel of tokenLabels) {
      const index = text.indexOf(tokenLabel, cursor);
      if (index === -1) {
        continue;
      }
      const candidate = {
        type: "token",
        start: index,
        end: index + tokenLabel.length,
        field
      };
      if (
        !best ||
        candidate.start < best.start ||
        (candidate.start === best.start && candidate.end - candidate.start > best.end - best.start)
      ) {
        best = candidate;
      }
    }

    if (field.value) {
      const index = text.indexOf(field.value, cursor);
      if (index === -1) {
        continue;
      }
      const candidate = {
        type: "value",
        start: index,
        end: index + field.value.length,
        field
      };
      if (
        !best ||
        candidate.start < best.start ||
        (candidate.start === best.start && candidate.end - candidate.start > best.end - best.start)
      ) {
        best = candidate;
      }
    }
  }

  return best;
}

function tokenizePlainText(text, fields, schema, tokenState = "provisional") {
  const nodes = [];
  const active = getActiveFields(fields);
  let cursor = 0;

  while (cursor < text.length) {
    const best = findBestTokenMatch(text, cursor, active);

    if (!best) {
      nodes.push(schema.text(text.slice(cursor)));
      break;
    }

    if (best.start > cursor) {
      nodes.push(schema.text(text.slice(cursor, best.start)));
    }

    nodes.push(
      buildTokenNodePM(
        schema,
        best.field,
        tokenState,
        best.field.color || defaultColor,
        best.field.value
      )
    );
    cursor = best.end;
  }

  return nodes;
}

const TokenNode = Node.create({
  name: "token",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,

  addOptions() {
    return {
      getFields: () => []
    };
  },

  addAttributes() {
    return {
      key: { default: "" },
      id: { default: "" },
      state: { default: "saved" },
      color: { default: defaultColor },
      value: { default: "" }
    };
  },

  parseHTML() {
    return [{ tag: "span[data-token-key]" }];
  },

  renderHTML({ node }) {
    return [
      "span",
      mergeAttributes({
        class: "token-chip",
        "data-token-id": node.attrs.id,
        "data-token-key": getTokenStorageLabel(node.attrs),
        "data-token-label": node.attrs.key,
        "data-token-state": node.attrs.state,
        "data-token-value": node.attrs.value,
        style: `--token-color:${node.attrs.color || defaultColor}`
      }),
      getTokenLabel(node.attrs.key)
    ];
  }
});

const autoTokenizePluginKey = new PluginKey("jianli-auto-tokenize");

function collectChangedRanges(transactions) {
  const ranges = [];

  transactions.forEach(transaction => {
    if (!transaction.docChanged) {
      return;
    }

    const changedRanges = getChangedRanges(transaction);
    changedRanges.forEach(change => {
      ranges.push(change.newRange);
    });
  });

  return ranges;
}

function expandRangesToTextblocks(doc, ranges) {
  const blocks = [];
  const seen = new Set();

  ranges.forEach(range => {
    const from = Math.max(0, range.from - 1);
    const to = Math.min(doc.content.size, range.to + 1);

    doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock || seen.has(pos)) {
        return;
      }
      seen.add(pos);
      blocks.push({ node, pos });
    });
  });

  return blocks;
}

function normalizeSlashQuery(query) {
  return normalizeText(query || "").trim().toLowerCase();
}

function createSlashMenuRoot(host) {
  const root = document.createElement("div");
  root.className = "slash-suggestion-menu";
  host.appendChild(root);
  return root;
}

function renderSlashSuggestionMenu(root, props, items, activeIndex, onSelect) {
  const rect = props.clientRect ? props.clientRect() : null;
  if (!rect) {
    root.style.opacity = "0";
    root.style.pointerEvents = "none";
    return;
  }

  root.style.opacity = "1";
  root.style.pointerEvents = "auto";
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - 332));
  const top = Math.min(rect.bottom + 8, window.innerHeight - 24);
  root.style.left = `${left}px`;
  root.style.top = `${top}px`;

  const content = items.length
    ? items
        .map((item, index) => {
          const valueText = item.value ? item.value : "***";
          const className = index === activeIndex ? "slash-item is-active" : "slash-item";
          return `
            <button type="button" class="${className}" data-index="${index}">
              <span class="slash-item-key">${escapeHtml(getTokenLabel(item.key))}</span>
              <span class="slash-item-value">${escapeHtml(valueText)}</span>
            </button>
          `;
        })
        .join("")
    : `<div class="slash-empty">没有匹配项</div>`;

  root.innerHTML = content;

  root.querySelectorAll("[data-index]").forEach(button => {
    button.addEventListener("mousedown", event => {
      event.preventDefault();
      const index = Number(button.getAttribute("data-index") || "0");
      onSelect(index);
    });
  });
}

const AutoTokenizeExtension = Extension.create({
  name: "auto-tokenize",

  addOptions() {
    return {
      getFields: () => []
    };
  },

  addProseMirrorPlugins() {
    const getFields = this.options.getFields || (() => []);

    return [
      new Plugin({
        key: autoTokenizePluginKey,
        appendTransaction(transactions, oldState, newState) {
          if (transactions.some(transaction => transaction.getMeta(autoTokenizePluginKey))) {
            return null;
          }

          const ranges = collectChangedRanges(transactions);
          if (!ranges.length) {
            return null;
          }

          const fields = getFields();
          const replacements = [];
          const changedBlocks = expandRangesToTextblocks(newState.doc, ranges);

          changedBlocks.forEach(block => {
            newState.doc.nodesBetween(block.pos + 1, block.pos + block.node.nodeSize - 1, (node, pos) => {
              if (!node.isText || !node.text) {
                return;
              }
              const nodes = tokenizePlainText(node.text, fields, newState.schema, "provisional");
              if (nodes.length === 1 && nodes[0].isText && nodes[0].text === node.text) {
                return;
              }

              replacements.push({
                from: pos,
                to: pos + node.nodeSize,
                fragment: Fragment.fromArray(nodes)
              });
            });
          });

          if (!replacements.length) {
            return null;
          }

          replacements.sort((a, b) => b.from - a.from || b.to - a.to);

          const tr = newState.tr;
          replacements.forEach(replacement => {
            tr.replaceWith(replacement.from, replacement.to, replacement.fragment);
          });
          tr.setMeta(autoTokenizePluginKey, true);
          return tr;
        }
      })
    ];
  }
});

const SlashSuggestionExtension = Extension.create({
  name: "slash-suggestion",

  addOptions() {
    return {
      getFields: () => [],
      menuHost: null
    };
  },

  addProseMirrorPlugins() {
    const getFields = this.options.getFields || (() => []);
    const menuHost = this.options.menuHost || document.body;
    const editor = this.editor;
    let menuRoot = null;
    let activeItems = [];
    let activeIndex = 0;
    let activeProps = null;

    const destroyMenu = () => {
      if (menuRoot) {
        menuRoot.remove();
        menuRoot = null;
      }
      activeItems = [];
      activeIndex = 0;
      activeProps = null;
    };

    const ensureMenu = () => {
      if (menuRoot) {
        return menuRoot;
      }
      menuRoot = createSlashMenuRoot(menuHost);
      return menuRoot;
    };

    const selectItem = (props, item) => {
      if (!item) {
        return;
      }
      props.command({
        id: item.id,
        key: item.key,
        value: item.value,
        color: item.color || defaultColor
      });
      destroyMenu();
    };

    const updateMenu = props => {
      if (!activeProps || activeProps.query !== props.query) {
        activeIndex = 0;
      }
      activeProps = props;
      const normalizedQuery = normalizeSlashQuery(props.query || "");
      const items = (getFields() || [])
        .filter(field => field.key && (!normalizedQuery || field.key.toLowerCase().includes(normalizedQuery)))
        .slice(0, 8);
      activeItems = items;
      if (!items.length) {
        destroyMenu();
        return;
      }
      activeIndex = Math.min(activeIndex, items.length - 1);
      const root = ensureMenu();
      renderSlashSuggestionMenu(root, props, items, activeIndex, index => selectItem(props, activeItems[index]));
    };

    return [
      Suggestion({
        pluginKey: new PluginKey("jianli-slash-suggestion"),
        editor,
        char: "/",
        allowSpaces: false,
        allowedPrefixes: null,
        startOfLine: false,
        command: ({ editor, range, props }) => {
          const field = getFields().find(item => item.id === props.id) || getFields().find(item => item.key === props.key);
          if (!field) {
            return;
          }
          editor
            .chain()
            .focus()
            .insertContentAt(range, buildTokenNodeJSON(field, "provisional", field.color || defaultColor, field.value))
            .run();
        },
        items: ({ query }) => {
          const normalizedQuery = normalizeSlashQuery(query || "");
          return (getFields() || [])
            .filter(field => field.key && (!normalizedQuery || field.key.toLowerCase().includes(normalizedQuery)))
            .slice(0, 8);
        },
        render: () => ({
          onStart: props => updateMenu(props),
          onUpdate: props => updateMenu(props),
          onExit: () => destroyMenu(),
          onKeyDown: ({ event }) => {
            if (!menuRoot || !activeItems.length) {
              return false;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              activeIndex = (activeIndex + 1) % activeItems.length;
              updateMenu(activeProps);
              return true;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              activeIndex = (activeIndex - 1 + activeItems.length) % activeItems.length;
              updateMenu(activeProps);
              return true;
            }

            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              selectItem(activeProps, activeItems[activeIndex]);
              return true;
            }

            if (event.key === "Escape") {
              destroyMenu();
              return true;
            }

            return false;
          }
        })
      })
    ];
  }
});

export function createJianliEditor(root, options = {}) {
  const getFields = options.getFields || (() => []);
  const onChange = options.onChange || (() => {});
  const onFocusChange = options.onFocusChange || (() => {});

  let suppressChange = false;
  let currentSourceText = "";

  const editor = new Editor({
    element: root,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        code: false,
        strike: false,
        hardBreak: true
      }),
      Placeholder.configure({
        placeholder: options.placeholder || "AI 读取的内容会在这里显示"
      }),
      TokenNode.configure({ getFields }),
      AutoTokenizeExtension.configure({ getFields }),
      SlashSuggestionExtension.configure({
        getFields,
        menuHost: document.body
      })
    ],
    editorProps: {
      attributes: {
        class: "ai-editor",
        spellcheck: "false"
      }
    },
    content: buildDoc("", getFields()),
    onCreate: ({ editor }) => {
      suppressChange = true;
      editor.commands.setContent(buildDoc(options.initialText || "", getFields()));
      currentSourceText = options.initialText || "";
      suppressChange = false;
    },
    onUpdate: ({ editor }) => {
      if (suppressChange) {
        return;
      }
      currentSourceText = serializeDoc(editor.getJSON());
      onChange(currentSourceText, editor);
    },
    onFocus: () => onFocusChange(true),
    onBlur: () => onFocusChange(false)
  });

  return {
    editor,
    getSourceText() {
      return currentSourceText || serializeDoc(editor.getJSON());
    },
    setSourceText(text) {
      const nextText = normalizeText(text || "");
      currentSourceText = nextText;
      suppressChange = true;
      editor.commands.setContent(buildDoc(nextText, getFields()), false);
      suppressChange = false;
    },
    refreshFields() {
      suppressChange = true;
      refreshTokenFields(editor, getFields());
      suppressChange = false;
    },
    serialize() {
      return serializeDoc(editor.getJSON());
    },
    serializeResolved(revealValues = false) {
      return serializeResolvedDoc(editor.getJSON(), getFields(), revealValues);
    },
    focus() {
      editor.commands.focus("end");
    },
    destroy() {
      editor.destroy();
    }
  };
}

window.createJianliEditor = createJianliEditor;
