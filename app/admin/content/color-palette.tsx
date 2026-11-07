"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, ChevronDown } from "lucide-react";

const RECENT_KEY = "admin-recent-colors";

const BASE_THEME = ["#FFFFFF", "#000000", "#E7E6E6", "#44546A", "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"];
const STANDARD = ["#C00000", "#FF0000", "#FFC000", "#FFFF00", "#92D050", "#00B050", "#00B0F0", "#0070C0", "#002060", "#7030A0"];

// Word's highlight palette (15 colors).
const HIGHLIGHT_COLORS = ["#FFFF00", "#00FF00", "#00FFFF", "#FF00FF", "#0000FF", "#FF0000", "#000080", "#008080", "#008000", "#800080", "#800000", "#808000", "#808080", "#C0C0C0", "#000000"];

export type PickOptions = {
  /** True while a native color picker is being dragged: apply the color but keep the picker open and do not steal focus. */
  live?: boolean;
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

function mix(hex: string, target: number, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const value = (n >> shift) & 255;
    return Math.round(value + (target - value) * amount);
  };
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

// Word-style theme grid: base color + 4 lighter/darker shades per column.
const THEME_ROWS: string[][] = [
  BASE_THEME,
  BASE_THEME.map((c) => mix(c, 255, 0.8)),
  BASE_THEME.map((c) => mix(c, 255, 0.6)),
  BASE_THEME.map((c) => mix(c, 255, 0.4)),
  BASE_THEME.map((c) => mix(c, 0, 0.25)),
  BASE_THEME.map((c) => mix(c, 0, 0.5)),
];

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

function pushRecent(color: string) {
  try {
    const next = [color, ...loadRecent().filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function Swatch({ color, onPick, active }: { color: string; onPick: (color: string) => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={color}
      aria-label={color}
      onClick={() => onPick(color)}
      className={`size-5 rounded-[4px] border transition hover:scale-110 hover:border-slate-900 ${active ? "ring-2 ring-blue-500 ring-offset-1" : ""} ${color.toUpperCase() === "#FFFFFF" ? "border-slate-300" : "border-slate-200"}`}
      style={{ backgroundColor: color }}
    />
  );
}

/** The palette itself (theme grid, standard colors, recent colors, custom color). */
export function ColorPaletteBody({
  value,
  onPick,
  onClear,
  clearLabel,
  keepSelection,
  palette = "text",
}: {
  value: string | null;
  onPick: (color: string, options?: PickOptions) => void;
  onClear?: () => void;
  clearLabel: string;
  /** Called with `true` while a native color picker/hex field is used. */
  keepSelection?: boolean;
  /** "text" = Word theme grid + standard colors, "highlight" = Word's 15 highlight colors. */
  palette?: "text" | "highlight";
}) {
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [hex, setHex] = useState(value ?? "#3548E6");

  const pick = (color: string, options?: PickOptions) => {
    pushRecent(color);
    setRecent(loadRecent());
    onPick(color, options);
  };

  const label = (text: string) => <p className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 first:mt-0">{text}</p>;

  return (
    <div
      className="w-[236px] select-none"
      // Keep the editor selection while clicking swatches.
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest("input")) event.preventDefault();
      }}
      data-keep={keepSelection ? "1" : undefined}
    >
      {onClear && (
        <button type="button" onClick={onClear} className="mb-2 flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Ban size={13} /> {clearLabel}
        </button>
      )}

      {palette === "highlight" ? (
        <>
          {label("Màu tô nền")}
          <div className="flex flex-wrap gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => <Swatch key={color} color={color} onPick={pick} active={value?.toUpperCase() === color} />)}
          </div>
        </>
      ) : (
        <>
          {label("Màu giao diện")}
          <div className="space-y-1">
            {THEME_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1">
                {row.map((color) => <Swatch key={color} color={color} onPick={pick} active={value?.toUpperCase() === color} />)}
              </div>
            ))}
          </div>

          {label("Màu chuẩn")}
          <div className="flex gap-1">{STANDARD.map((color) => <Swatch key={color} color={color} onPick={pick} active={value?.toUpperCase() === color} />)}</div>
        </>
      )}

      {recent.length > 0 && (
        <>
          {label("Màu gần đây")}
          <div className="flex flex-wrap gap-1">{recent.map((color) => <Swatch key={color} color={color} onPick={pick} active={value?.toLowerCase() === color.toLowerCase()} />)}</div>
        </>
      )}

      {label("Màu khác")}
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Chọn màu tùy ý"
          value={HEX_RE.test(hex) ? hex : "#3548e6"}
          onChange={(event) => {
            setHex(event.target.value.toUpperCase());
            onPick(event.target.value.toUpperCase(), { live: true });
          }}
          onBlur={(event) => pushRecent(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
        />
        <input
          value={hex}
          onChange={(event) => setHex(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && HEX_RE.test(hex)) {
              event.preventDefault();
              pick(hex.toUpperCase());
            }
          }}
          maxLength={7}
          placeholder="#RRGGBB"
          className="h-8 w-24 rounded border border-slate-200 px-2 font-mono text-xs uppercase outline-none focus:border-blue-400"
        />
        <button
          type="button"
          disabled={!HEX_RE.test(hex)}
          onClick={() => pick(hex.toUpperCase())}
          className="h-8 rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          OK
        </button>
      </div>
    </div>
  );
}

const LAST_KEY_PREFIX = "admin-last-color:";

function loadLast(key: string, fallback: string) {
  try {
    const value = localStorage.getItem(LAST_KEY_PREFIX + key);
    return value && HEX_RE.test(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Toolbar button + popover palette (rendered in a portal so the editor's
 * overflow-hidden container can't clip it).
 *
 * With `quickApply` it behaves like Word's font-color button: the left part applies the
 * last used color in one click, the arrow opens the full palette. Choosing a swatch applies
 * the color and closes the palette.
 */
export function ColorDropdown({
  title,
  current,
  onPick,
  onClear,
  clearLabel,
  onOpen,
  onMouseDown,
  children,
  quickApply,
  palette = "text",
}: {
  title: string;
  current: string | null;
  onPick: (color: string, options?: PickOptions) => void;
  onClear?: () => void;
  clearLabel: string;
  /** Called on toolbar button mousedown so the editor selection can be remembered before focus changes. */
  onMouseDown?: () => void;
  /** Called right before the palette opens or a quick color is applied (use it to remember the editor selection). */
  onOpen?: () => void;
  children: React.ReactNode;
  /** Enables the Word-style split button. `key` stores the last used color, `fallback` is the first one. */
  quickApply?: { key: string; fallback: string };
  palette?: "text" | "highlight";
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  // The toolbar only renders after the editor mounted in the browser, so reading localStorage here is safe.
  const [lastColor, setLastColor] = useState<string | null>(() => (quickApply ? loadLast(quickApply.key, quickApply.fallback) : null));
  const rootRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 260;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - 400)),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const remember = (color: string) => {
    if (!quickApply) return;
    setLastColor(color);
    try {
      localStorage.setItem(LAST_KEY_PREFIX + quickApply.key, color);
    } catch {
      /* ignore */
    }
  };

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen((v) => !v);
  };

  const barColor = quickApply ? lastColor : current;
  const baseButton = "inline-flex h-8 items-center border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <>
      <span ref={rootRef} className="inline-flex">
        <button
          type="button"
          title={quickApply ? `${title} (nhấn để dùng màu gần nhất)` : title}
          aria-label={title}
          // Do not let the click steal the editor selection.
          onMouseDown={(event) => {
            onMouseDown?.();
            event.preventDefault();
          }}
          onClick={() => {
            if (!quickApply || !lastColor) return toggle();
            onOpen?.();
            onPick(lastColor);
          }}
          className={`${baseButton} gap-0.5 px-2 ${quickApply ? "rounded-l-lg border-r-0" : "rounded-lg"}`}
        >
          <span className="flex flex-col items-center leading-none">
            <span>{children}</span>
            <span className="mt-0.5 h-[3px] w-4 rounded-sm border border-slate-200" style={{ backgroundColor: barColor ?? "transparent" }} />
          </span>
          {!quickApply && <ChevronDown size={12} />}
        </button>
        {quickApply && (
          <button
            type="button"
            title={`${title} – bảng màu`}
            aria-label={`${title} – bảng màu`}
            aria-expanded={open}
            onMouseDown={(event) => {
              onMouseDown?.();
              event.preventDefault();
            }}
            onClick={toggle}
            className={`${baseButton} rounded-r-lg px-1`}
          >
            <ChevronDown size={12} />
          </button>
        )}
      </span>
      {open && position && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={title}
            className="fixed z-[300] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
            style={{ left: position.left, top: position.top }}
          >
            <ColorPaletteBody
              value={current}
              palette={palette}
              clearLabel={clearLabel}
              onClear={onClear ? () => { onClear(); setOpen(false); } : undefined}
              onPick={(color, options) => {
                remember(color);
                onPick(color, options);
                // Close after a click on a swatch / OK (like Word); stay open while dragging the native picker.
                if (!options?.live) setOpen(false);
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
