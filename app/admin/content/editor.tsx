"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Mark } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";

import type { MediaAsset } from "@/lib/content-types";
import { optimizedVideoUrl } from "@/lib/media";
import { ColorDropdown, type PickOptions } from "./color-palette";

const TextColorMark = Mark.create({
  name: "textColor",
  inclusive: true,
  excludes: "",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => {
          const color = (element as HTMLElement).style.color?.trim();
          return color || null;
        },
        renderHTML: (attributes) =>
          attributes.color ? { style: `color: ${attributes.color};` } : {},
      },
    };
  },
  parseHTML() {
    // Keep this mark compatible with fontSize/fontFamily marks that can share
    // the same <span>. `consuming:false` lets each mark read its own style.
    return [
      {
        tag: "span",
        consuming: false,
        getAttrs: (element) =>
          (element as HTMLElement).style.color?.trim() ? {} : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

const HighlightMark = Mark.create({
  name: "highlight",
  addAttributes() {
    return { color: { default: "#fff59d", parseHTML: element => element.style.backgroundColor || "#fff59d", renderHTML: attributes => ({ style: `background-color: ${attributes.color}` }) } };
  },
  parseHTML() {
    return [{ tag: "mark" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["mark", HTMLAttributes, 0];
  },
});

const FontSizeMark = Mark.create({
  name: "fontSize",
  addAttributes() {
    return { size: { default: null, parseHTML: element => element.style.fontSize || null, renderHTML: attributes => attributes.size ? { style: `font-size: ${attributes.size}` } : {} } };
  },
  parseHTML() {
    return [{ tag: "span", consuming: false, getAttrs: element => (element as HTMLElement).style.fontSize ? {} : false }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

/** Fonts offered in the editor toolbar. All support Vietnamese and are loaded in app/layout.tsx. */
const FONT_FAMILIES: { label: string; stack: string }[] = [
  { label: "Be Vietnam Pro", stack: '"Be Vietnam Pro", Arial, sans-serif' },
  { label: "Playfair Display", stack: '"Playfair Display", Georgia, serif' },
  { label: "Inter", stack: '"Inter", Arial, sans-serif' },
  { label: "Roboto", stack: '"Roboto", Arial, sans-serif' },
  { label: "Open Sans", stack: '"Open Sans", Arial, sans-serif' },
  { label: "Montserrat", stack: '"Montserrat", Arial, sans-serif' },
  { label: "Nunito", stack: '"Nunito", Arial, sans-serif' },
  { label: "Quicksand", stack: '"Quicksand", Arial, sans-serif' },
  { label: "Lora", stack: '"Lora", Georgia, serif' },
  { label: "Merriweather", stack: '"Merriweather", Georgia, serif' },
];

const fontLabelOf = (family: string) => {
  const first = family.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
  return FONT_FAMILIES.find((font) => font.label.toLowerCase() === first)?.label ?? "";
};

const FontFamilyMark = Mark.create({
  name: "fontFamily",
  addAttributes() {
    return { family: { default: null, parseHTML: element => element.style.fontFamily || null, renderHTML: attributes => attributes.family ? { style: `font-family: ${attributes.family}` } : {} } };
  },
  parseHTML() {
    return [{ tag: "span", consuming: false, getAttrs: element => (element as HTMLElement).style.fontFamily ? {} : false }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

const normalizeNewlinesInDoc = (doc: JSONContent): JSONContent => {
  const normalizeNode = (node: JSONContent): JSONContent => {
    if (!node.content) return node;

    // A legacy rich-text value could store multiple lines inside one text node.
    // HTML collapses those newline characters, so convert them to explicit
    // hardBreak nodes. This keeps existing content readable without requiring
    // users to retype it.
    const content: JSONContent[] = [];
    for (const child of node.content) {
      if (child.type === "text" && typeof child.text === "string" && child.text.includes("\n")) {
        const parts = child.text.replace(/\r\n/g, "\n").split("\n");
        parts.forEach((part, index) => {
          if (part) content.push({ ...child, text: part });
          if (index < parts.length - 1) content.push({ type: "hardBreak" });
        });
      } else {
        content.push(normalizeNode(child));
      }
    }
    return { ...node, content };
  };

  return normalizeNode(doc);
};

const emptyDoc: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

export type RichEditorValue = {
  json: JSONContent;
  html: string;
};

type RichEditorProps = {
  value: RichEditorValue;
  onChange: (value: RichEditorValue) => void;
  /** Style of the text "package" (background, radius, padding) so the editor shows the box live. */
  boxStyle?: CSSProperties;
};

type CloudinarySignatureResponse = {
  error?: string;
  apiKey?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  cloudName?: string;
};

type CloudinaryUploadResponse = {
  asset_id?: string;
  secure_url?: string;
  public_id?: string;
  resource_type?: string;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  error?: {
    message?: string;
  };
};

type TableAction = "insert" | "row+" | "row-" | "col+" | "col-" | "delete";

export function RichEditor({ value, onChange, boxStyle }: RichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,

    extensions: [
      // StarterKit 3 already ships Link + Underline; registering them again made duplicates.
      StarterKit.configure({
        link: false,
        underline: false,
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),

      Underline,
      TextColorMark,
      HighlightMark,
      FontSizeMark,
      FontFamilyMark,

      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),

      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),

      Table.configure({
        resizable: true,
      }),

      TableRow,
      TableHeader,
      TableCell,
    ],

    content: normalizeNewlinesInDoc(value.json ?? emptyDoc),

    editorProps: {
      attributes: { class: "rich-editor-content" },
      // No drag & drop inside the text box: dragging with the mouse only selects text.
      // (Blocks are re-ordered with their own grip handle, never from inside the text.)
      handleDOMEvents: {
        dragstart: (_view, event) => {
          event.preventDefault();
          return true;
        },
      },
      handleDrop: () => true,
    },

    onUpdate({ editor: instance }) {
      onChange({
        json: instance.getJSON(),
        html: instance.getHTML(),
      });
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextContent = value.json ?? emptyDoc;

    const incoming = JSON.stringify(nextContent);
    const current = JSON.stringify(editor.getJSON());

    if (current !== incoming) {
      editor.commands.setContent(normalizeNewlinesInDoc(nextContent));
    }
  }, [editor, value.json]);

  // Re-render the toolbar whenever the selection / marks change so the font-size
  // box and color swatches always show the formatting of the current selection.
  const toolbarStateRaw = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      if (!instance) return { from: 0, to: 0, size: "", family: "", shownSize: null as number | null, color: "", highlight: "" };
      const { from, to } = instance.state.selection;
      const size = (instance.getAttributes("fontSize").size as string | undefined) ?? "";
      const family = fontLabelOf((instance.getAttributes("fontFamily").family as string | undefined) ?? "");
      let shownSize: number | null = size ? parseFloat(size) : null;
      if (shownSize === null || !Number.isFinite(shownSize)) {
        // No explicit size: show the size the text really renders at (paragraph, heading…).
        shownSize = null;
        try {
          if (!instance.isDestroyed && instance.view.dom.isConnected) {
            const { node } = instance.view.domAtPos(from);
            const element = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
            if (element) shownSize = Math.round(parseFloat(window.getComputedStyle(element).fontSize) * 10) / 10;
          }
        } catch {
          shownSize = null;
        }
      }
      return {
        from,
        to,
        size,
        family,
        shownSize: shownSize !== null && Number.isFinite(shownSize) ? shownSize : null,
        color: (instance.getAttributes("textColor").color as string | undefined) ?? "",
        highlight: instance.isActive("highlight") ? ((instance.getAttributes("highlight").color as string | undefined) ?? "") : "",
      };
    },
  });
  const toolbarState = toolbarStateRaw ?? { from: 0, to: 0, size: "", family: "", shownSize: null as number | null, color: "", highlight: "" };
  const savedSelection = useRef<{ from: number; to: number } | null>(null);

  if (!editor) {
    return (
      <div className="min-h-[300px] rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Đang tải trình soạn thảo…
      </div>
    );
  }

  const buttonClass = (active = false) =>
    [
      "rounded-lg",
      "border",
      "px-2.5",
      "py-1.5",
      "text-xs",
      "font-semibold",
      "transition",
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
      active
        ? "border-blue-300 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ].join(" ");

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;

    const url = window.prompt("Nhập URL", previousUrl ?? "https://");

    if (url === null) {
      return;
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href: trimmedUrl,
      })
      .run();
  };

  const rememberSelection = () => {
    const { from, to } = editor.state.selection;
    savedSelection.current = { from, to };
  };

  const chainWithSelection = (focus = true) => {
    const chain = editor.chain();
    const saved = savedSelection.current;
    if (saved) {
      const max = editor.state.doc.content.size;
      chain.setTextSelection({ from: Math.min(saved.from, max), to: Math.min(saved.to, max) });
    }
    return focus ? chain.focus() : chain;
  };

  const applyMark = (name: "textColor" | "highlight", color: string | null, options?: PickOptions) => {
    // The palette lives in a portal, so clicking it can move focus away from
    // ProseMirror. Always restore the exact selection captured before opening
    // the palette. This makes swatches, custom colors and the quick-apply
    // button behave consistently.
    const saved = savedSelection.current;
    const max = editor.state.doc.content.size;
    const from = saved ? Math.min(saved.from, max) : editor.state.selection.from;
    const to = saved ? Math.min(saved.to, max) : editor.state.selection.to;

    const chain = editor.chain().setTextSelection({ from, to });

    // While dragging the native color picker, do not focus the editor because
    // that would immediately close the native picker. For normal swatches we
    // focus again after restoring the selection.
    if (!options?.live) chain.focus();

    if (color) {
      chain.setMark(name, { color: color.trim().toUpperCase() }).run();
    } else {
      chain.unsetMark(name).run();
    }
  };

  /** `useSaved`: the size box (a real <input>) took focus, so restore the selection remembered when it was focused. */
  const applyFontSize = (size: number | null, useSaved = false) => {
    const chain = useSaved ? chainWithSelection() : editor.chain().focus();
    if (size) chain.setMark("fontSize", { size: `${size}px` }).run();
    else chain.unsetMark("fontSize").run();
  };

  const applyFontFamily = (label: string) => {
    const font = FONT_FAMILIES.find((item) => item.label === label);
    const chain = editor.chain().focus();
    if (font) chain.setMark("fontFamily", { family: font.stack }).run();
    else chain.unsetMark("fontFamily").run();
  };

  const handleTableAction = (action: TableAction) => {
    const chain = editor.chain().focus();

    switch (action) {
      case "insert":
        chain
          .insertTable({
            rows: 3,
            cols: 3,
            withHeaderRow: true,
          })
          .run();
        break;

      case "row+":
        if (editor.can().addRowAfter()) {
          chain.addRowAfter().run();
        }
        break;

      case "row-":
        if (editor.can().deleteRow()) {
          chain.deleteRow().run();
        }
        break;

      case "col+":
        if (editor.can().addColumnAfter()) {
          chain.addColumnAfter().run();
        }
        break;

      case "col-":
        if (editor.can().deleteColumn()) {
          chain.deleteColumn().run();
        }
        break;

      case "delete":
        if (editor.can().deleteTable()) {
          chain.deleteTable().run();
        }
        break;

      default:
        break;
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
        {/* Bold */}
        <button
          type="button"
          aria-label="Bold"
          title="Bold"
          className={buttonClass(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </button>

        {/* Italic */}
        <button
          type="button"
          aria-label="Italic"
          title="Italic"
          className={buttonClass(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </button>

        {/* Strike */}
        <button
          type="button"
          aria-label="Strike"
          title="Gạch ngang"
          className={buttonClass(editor.isActive("strike"))}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </button>

        {/* Underline */}
        <button
          type="button"
          aria-label="Underline"
          title="Underline"
          className={buttonClass(editor.isActive("underline"))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </button>

        {/* Font family */}
        <select
          title="Font chữ"
          aria-label="Font chữ"
          value={toolbarState.family}
          onChange={(e) => applyFontFamily(e.target.value)}
          className="h-8 max-w-[150px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300"
        >
          <option value="">Font mặc định</option>
          {FONT_FAMILIES.map((font) => (
            <option key={font.label} value={font.label} style={{ fontFamily: font.stack }}>{font.label}</option>
          ))}
        </select>

        {/* Font size: typeable box + / - + presets, always shows the size of the selection */}
        <FontSizeControl
          shown={toolbarState.shownSize}
          explicit={Boolean(toolbarState.size)}
          onApply={applyFontSize}
          onFocusBox={rememberSelection}
        />

        {/* Text color (click = last used color, arrow = Word-style palette) */}
        <ColorDropdown
          title="Màu chữ"
          current={toolbarState.color || null}
          clearLabel="Màu chữ tự động"
          quickApply={{ key: "text", fallback: "#FF0000" }}
          onMouseDown={() => rememberSelection()}
          onOpen={rememberSelection}
          onPick={(color, options) => applyMark("textColor", color, options)}
          onClear={() => applyMark("textColor", null)}
        >
          <span className="font-bold">A</span>
        </ColorDropdown>

        {/* Highlight */}
        <ColorDropdown
          title="Màu nền chữ"
          current={toolbarState.highlight || null}
          clearLabel="Không tô nền"
          palette="highlight"
          quickApply={{ key: "highlight", fallback: "#FFFF00" }}
          onMouseDown={() => rememberSelection()}
          onOpen={rememberSelection}
          onPick={(color, options) => applyMark("highlight", color, options)}
          onClear={() => applyMark("highlight", null)}
        >
          <span className="rounded-sm bg-yellow-200 px-0.5 font-bold">ab</span>
        </ColorDropdown>

        <button
          type="button"
          title="Xóa định dạng"
          className={buttonClass()}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          Clear
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        {/* Heading 2 */}
        <button
          type="button"
          aria-label="Heading 2"
          title="Heading 2"
          className={buttonClass(editor.isActive("heading", { level: 2 }))}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </button>

        {/* Heading 3 */}
        <button
          type="button"
          aria-label="Heading 3"
          title="Heading 3"
          className={buttonClass(editor.isActive("heading", { level: 3 }))}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </button>

        {/* Bullet list */}
        <button
          type="button"
          aria-label="Bullet list"
          title="Bullet list"
          className={buttonClass(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </button>

        {/* Ordered list */}
        <button
          type="button"
          aria-label="Ordered list"
          title="Ordered list"
          className={buttonClass(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>

        {/* Blockquote */}
        <button
          type="button"
          aria-label="Blockquote"
          title="Blockquote"
          className={buttonClass(editor.isActive("blockquote"))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </button>

        {/* Code block */}
        <button
          type="button"
          aria-label="Code block"
          title="Code block"
          className={buttonClass(editor.isActive("codeBlock"))}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          Code
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        {/* Align left */}
        <button
          type="button"
          aria-label="Align left"
          title="Align left"
          className={buttonClass(editor.isActive({ textAlign: "left" }))}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          ←
        </button>

        {/* Align center */}
        <button
          type="button"
          aria-label="Align center"
          title="Align center"
          className={buttonClass(editor.isActive({ textAlign: "center" }))}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          ↔
        </button>

        {/* Align right */}
        <button
          type="button"
          aria-label="Align right"
          title="Align right"
          className={buttonClass(editor.isActive({ textAlign: "right" }))}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          →
        </button>

        {/* Link */}
        <button
          type="button"
          aria-label="Insert link"
          title="Insert link"
          className={buttonClass(editor.isActive("link"))}
          onClick={setLink}
        >
          Link
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        {/* Table */}
        <select
          aria-label="Table"
          title="Table"
          defaultValue=""
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300"
          onChange={(event) => {
            const action = event.target.value as "" | TableAction;

            event.currentTarget.value = "";

            if (!action) {
              return;
            }

            handleTableAction(action);
          }}
        >
          <option value="">Table ▾</option>
          <option value="insert">Chèn bảng 3×3</option>
          <option value="row+">Thêm hàng</option>
          <option value="row-">Xóa hàng</option>
          <option value="col+">Thêm cột</option>
          <option value="col-">Xóa cột</option>
          <option value="delete">Xóa bảng</option>
        </select>
      </div>

      {/* Editor (shows the text box live when a background/radius is chosen) */}
      <div className={boxStyle ? "bg-slate-100/70 p-3" : undefined}>
      <EditorContent
        editor={editor}
        style={boxStyle ? { ...boxStyle, minHeight: 120 } : undefined}
        className={[
          "min-h-[300px]",
          "px-5",
          "py-4",
          "prose",
          "prose-sm",
          "max-w-none",
          "prose-headings:text-slate-900",
          "prose-p:text-slate-700",
          "prose-li:text-slate-700",
          "prose-a:text-blue-600",
          "prose-a:underline",
          "prose-blockquote:border-l-blue-400",
          "prose-blockquote:text-slate-600",
          "prose-table:w-full",
          "prose-table:border-collapse",
          "prose-th:border",
          "prose-th:border-slate-200",
          "prose-th:bg-slate-50",
          "prose-th:p-2",
          "prose-td:border",
          "prose-td:border-slate-200",
          "prose-td:p-2",
        ].join(" ")}
      />
      </div>
    </div>
  );
}

const SIZE_PRESETS = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72];
const MIN_SIZE = 8;
const MAX_SIZE = 200;

/**
 * Word-style font size box. Shows the size of the current selection (the real rendered size
 * when no custom size was set), updates as soon as a size is chosen, and accepts any typed number.
 */
function FontSizeControl({ shown, explicit, onApply, onFocusBox }: {
  shown: number | null;
  explicit: boolean;
  onApply: (size: number | null, useSaved?: boolean) => void;
  onFocusBox: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const display = shown === null ? "" : String(Math.round(shown * 10) / 10);
  const clamp = (value: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value * 10) / 10));

  const commit = () => {
    const raw = (draft ?? "").trim().replace(",", ".");
    setDraft(null);
    if (!raw) return;
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) onApply(clamp(parsed), true);
  };

  const step = (delta: number) => onApply(clamp((shown ?? 16) + delta));
  const stepButton = "inline-flex h-8 w-6 items-center justify-center border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50";

  return (
    <span ref={rootRef} className="relative inline-flex items-stretch" title="Cỡ chữ">
      <button type="button" aria-label="Giảm cỡ chữ" className={`${stepButton} rounded-l-lg`} onMouseDown={(e) => e.preventDefault()} onClick={() => step(-1)}>−</button>
      <input
        aria-label="Cỡ chữ"
        inputMode="decimal"
        value={draft ?? display}
        placeholder="—"
        onFocus={(event) => { onFocusBox(); setDraft(display); event.currentTarget.select(); }}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9.,]/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          else if (event.key === "Escape") { setDraft(null); event.currentTarget.blur(); }
          else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const base = parseFloat((draft ?? display).replace(",", ".")) || shown || 16;
            setDraft(String(clamp(base + (event.key === "ArrowUp" ? 1 : -1))));
          }
        }}
        className={`h-8 w-11 border-y border-slate-200 bg-white px-1 text-center text-xs font-semibold outline-none focus:border-blue-300 ${explicit ? "text-slate-900" : "text-slate-500"}`}
      />
      <button type="button" aria-label="Tăng cỡ chữ" className={stepButton} onMouseDown={(e) => e.preventDefault()} onClick={() => step(1)}>+</button>
      <button type="button" aria-label="Chọn cỡ chữ có sẵn" aria-expanded={open} className={`${stepButton} -ml-px w-5 rounded-r-lg`} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)}>▾</button>
      {open && (
        <div role="listbox" aria-label="Cỡ chữ" className="absolute left-0 top-9 z-30 max-h-56 w-32 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onApply(null); setOpen(false); }} className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50">Mặc định</button>
          {SIZE_PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              role="option"
              aria-selected={shown === size}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onApply(size); setOpen(false); }}
              className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold hover:bg-slate-50 ${shown === size ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // Cloudinary free-plan upload limit

/** Longest side kept for photos. 2200px is sharp on retina laptops; the site serves smaller sizes anyway. */
const MAX_IMAGE_EDGE = 2200;
/** Pictures that are already light are uploaded untouched (no needless re-compression). */
const SKIP_BELOW_BYTES = 400 * 1024;
/** Stop lowering quality once the file is at or below this size. */
const TARGET_BYTES = 1.5 * 1024 * 1024;
/** Only use the compressed file if it is at least this much smaller (otherwise keep the original). */
const MIN_SAVING = 0.12;
/**
 * Quality steps, highest first. Deliberately high and with a floor: this is a light trim, not a
 * "make it tiny" squeeze, so edges, text and gradients in designs stay clean.
 */
const JPEG_QUALITY_STEPS = [0.9, 0.85, 0.8];
const WEBP_QUALITY_STEPS = [0.92, 0.87, 0.82];

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Lightly compresses photos in the browser before they go to Cloudinary (saves storage and upload time).
 *
 * - Long edge is capped at 2200px (high-quality resampling, EXIF rotation applied).
 * - JPEG stays JPEG; PNG/WebP become high-quality WebP (keeps transparency).
 * - Quality starts high and only steps down while the file is still large, never below a safe floor.
 * - Small files, GIFs (animation) and anything that would not get clearly smaller are left as they are.
 * - Any error falls back to the original file, so an upload is never blocked by compression.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longest = Math.max(bitmap.width, bitmap.height);
    const needsResize = longest > MAX_IMAGE_EDGE;

    if (!needsResize && file.size <= SKIP_BELOW_BYTES) {
      bitmap.close();
      return file;
    }

    const scale = needsResize ? MAX_IMAGE_EDGE / longest : 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const isJpeg = file.type === "image/jpeg";
    const targetType = isJpeg ? "image/jpeg" : "image/webp";
    const steps = isJpeg ? JPEG_QUALITY_STEPS : WEBP_QUALITY_STEPS;

    let best: Blob | null = null;
    for (const quality of steps) {
      const blob = await canvasToBlob(canvas, targetType, quality);
      // Older Safari cannot encode WebP and silently returns PNG.
      if (!blob || blob.type !== targetType) break;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }

    // Browser cannot write WebP: a resized PNG is still lossless and much smaller than a huge original.
    if (!best && !isJpeg && needsResize) best = await canvasToBlob(canvas, "image/png");
    if (!best) return file;

    // A resize is worth keeping whenever it is smaller; otherwise require a real saving.
    const smallEnough = needsResize ? best.size < file.size : best.size <= file.size * (1 - MIN_SAVING);
    if (!smallEnough) return file;

    const extension = best.type === "image/jpeg" ? "jpg" : best.type === "image/png" ? "png" : "webp";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([best], `${baseName}.${extension}`, { type: best.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Upload image / video / GIF to Cloudinary.
 *
 * Browser
 *   ↓
 * /api/cloudinary/signature
 *   ↓
 * signed upload data
 *   ↓
 * Cloudinary
 *   ↓
 * MediaAsset
 */
export async function uploadToCloudinary(file: File, folder = "thom-portfolio/content"): Promise<MediaAsset> {
  if (!file) {
    throw new Error("Không có file để upload.");
  }

  /**
   * Client-side validation.
   */
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Định dạng file không được hỗ trợ: ${file.type}`);
  }

  if (file.type.startsWith("video/") && file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video quá nặng (${Math.round(file.size / 1024 / 1024)}MB). Vui lòng chọn video dưới 100MB.`,
    );
  }

  // Compress photos in the browser; videos are optimized by Cloudinary on delivery.
  file = await compressImage(file);

  /**
   * Ask our server for a Cloudinary signature.
   */
  const signatureResponse = await fetch("/api/cloudinary/signature", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      folder,
    }),
  });

  /**
   * Read as text first.
   *
   * This prevents:
   *
   * Unexpected end of JSON input
   */
  const signatureText = await signatureResponse.text();

  let signed: CloudinarySignatureResponse = {};

  if (signatureText.trim()) {
    try {
      signed = JSON.parse(signatureText) as CloudinarySignatureResponse;
    } catch {
      throw new Error(
        `Cloudinary signature API không trả JSON hợp lệ. HTTP ${signatureResponse.status}. Response: ${signatureText.slice(
          0,
          500,
        )}`,
      );
    }
  }

  /**
   * API returned HTTP error.
   */
  if (!signatureResponse.ok) {
    throw new Error(
      signed.error ??
        `Cloudinary signature API lỗi HTTP ${signatureResponse.status}.`,
    );
  }

  /**
   * Validate signature payload.
   */
  if (
    !signed.apiKey ||
    !signed.timestamp ||
    !signed.signature ||
    !signed.folder ||
    !signed.cloudName
  ) {
    throw new Error(
      "Cloudinary signature API thiếu apiKey, timestamp, signature, folder hoặc cloudName.",
    );
  }

  /**
   * Prepare multipart upload.
   */
  const form = new FormData();

  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);

  /**
   * Cloudinary:
   *
   * image/*
   *   -> image/upload
   *
   * video/*
   *   -> video/upload
   */
  const resourceType = file.type.startsWith("video/") ? "video" : "image";

  const uploadUrl =
    `https://api.cloudinary.com/v1_1/` +
    `${encodeURIComponent(signed.cloudName)}` +
    `/${resourceType}/upload`;

  /**
   * Upload directly from browser to Cloudinary.
   */
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: form,
  });

  /**
   * Read text first to prevent JSON parsing errors.
   */
  const responseText = await response.text();

  let data: CloudinaryUploadResponse = {};

  if (responseText.trim()) {
    try {
      data = JSON.parse(responseText) as CloudinaryUploadResponse;
    } catch {
      throw new Error(
        `Cloudinary upload không trả JSON hợp lệ. HTTP ${response.status}. Response: ${responseText.slice(
          0,
          500,
        )}`,
      );
    }
  }

  /**
   * Cloudinary HTTP error.
   */
  if (!response.ok) {
    throw new Error(
      data.error?.message ??
        `Cloudinary upload thất bại. HTTP ${response.status}.`,
    );
  }

  /**
   * Validate returned asset.
   */
  if (!data.asset_id || !data.secure_url || !data.public_id || !data.format) {
    throw new Error("Cloudinary trả về dữ liệu upload không đầy đủ.");
  }

  /**
   * Return normalized media object.
   */
  return {
    id: data.asset_id,
    url: resourceType === "video" ? optimizedVideoUrl(data.secure_url) : data.secure_url,
    publicId: data.public_id,
    resourceType,
    format: data.format,
    width: data.width,
    height: data.height,
    duration: data.duration,
  };
}
