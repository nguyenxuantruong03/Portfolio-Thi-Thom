"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Columns2, GripVertical, ImagePlus, LayoutTemplate, Quote, Table2, Trash2, Type, Video } from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import type { MediaAsset } from "@/lib/content-types";
import { RichEditor, type RichEditorValue, uploadToCloudinary } from "@/app/admin/content/editor";
import { ColorDropdown } from "@/app/admin/content/color-palette";
import { optimizedVideoUrl } from "@/lib/media";
import { ProjectMediaLightbox } from "@/components/project-media-lightbox";

type BoxStyle = { enabled: boolean; bg: string; radius: number; padding: number };

type ColumnSide = {
  mode: "text" | "media";
  rich: RichEditorValue;
  media?: MediaAsset;
  box?: BoxStyle;
};

const BOX_PRESETS = ["#FFFFFF", "#F8F7FF", "#FFFAF3", "#E8F7FD", "#FDE8EF", "#E9F8EC", "#FFF6D6", "#17215F"];
const defaultBox = (enabled = true): BoxStyle => ({ enabled, bg: "#F8F7FF", radius: 20, padding: 24 });
function normalizeBox(raw: unknown): BoxStyle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const box = raw as Partial<BoxStyle>;
  const clamp = (value: unknown, min: number, max: number, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
  return {
    enabled: box.enabled === true,
    bg: typeof box.bg === "string" && /^#[0-9a-f]{3,8}$/i.test(box.bg) ? box.bg : "#F8F7FF",
    radius: clamp(box.radius, 0, 80, 20),
    padding: clamp(box.padding, 0, 80, 24),
  };
}
const boxCss = (box?: BoxStyle) => (box?.enabled ? { backgroundColor: box.bg, borderRadius: box.radius, padding: box.padding } : undefined);

type Block =
  | { id: string; type: "text"; rich: RichEditorValue; width?: "full" | "half"; box?: BoxStyle }
  | { id: string; type: "image"; image?: MediaAsset; caption?: string; width?: "full" | "half"; align?: "left" | "center" | "right" }
  | { id: string; type: "quote"; text: string; author?: string; width?: "full" | "half" }
  | { id: string; type: "table"; title?: string; rows: string[][]; width?: "full" | "half" }
  | { id: string; type: "columns"; leftTitle?: string; rightTitle?: string; left: ColumnSide; right: ColumnSide; width?: "full" | "half" };

const id = () => crypto.randomUUID();
const emptyRich = (text = "") : RichEditorValue => {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const content = lines.map(line => line
    ? { type: "paragraph", content: [{ type: "text", text: line }] }
    : { type: "paragraph" });
  return {
    json: { type: "doc", content: content.length ? content : [{ type: "paragraph" }] },
    html: content.map(node => node.content?.length ? `<p>${escapeHtml(String(node.content[0].text ?? ""))}</p>` : "<p></p>").join(""),
  };
};
const escapeHtml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const textFromRich = (value: RichEditorValue | undefined) => (value?.json.content ?? []).flatMap(node => node.content ?? []).map(node => node.text ?? "").join("");
const asRich = (value: unknown, fallback = "") => {
  if (value && typeof value === "object" && "json" in value) return value as RichEditorValue;
  return emptyRich(typeof value === "string" ? value : fallback);
};
const starter = (): Block[] => [{ id: id(), type: "text", rich: emptyRich("Bắt đầu kể câu chuyện của dự án tại đây…") }];

function normalizeSide(value: unknown, fallback: string): ColumnSide {
  if (value && typeof value === "object") {
    const side = value as Partial<ColumnSide> & { text?: string };
    return {
      mode: side.mode === "media" ? "media" : "text",
      rich: asRich(side.rich ?? side.text, fallback),
      media: side.media,
      box: normalizeBox(side.box),
    };
  }
  return { mode: "text", rich: emptyRich(typeof value === "string" ? value : fallback) };
}

function normalizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const block = raw as Record<string, unknown>;
  const type = block.type;
  if (typeof block.id !== "string" || typeof type !== "string") return null;
  if (type === "text") return { id: block.id, type, rich: asRich(block.rich ?? block.text, "Nhập nội dung…"), width: block.width === "half" ? "half" : "full", box: normalizeBox(block.box) };
  if (type === "image") return { id: block.id, type, image: block.image as MediaAsset | undefined, caption: typeof block.caption === "string" ? block.caption : "", width: block.width === "half" ? "half" : "full", align: block.align === "left" || block.align === "right" ? block.align : "center" };
  if (type === "quote") return { id: block.id, type, text: typeof block.text === "string" ? block.text : "Trích dẫn nổi bật…", author: typeof block.author === "string" ? block.author : "" };
  if (type === "table") return { id: block.id, type, title: typeof block.title === "string" ? block.title : "", rows: Array.isArray(block.rows) ? block.rows.map(row => Array.isArray(row) ? row.map(cell => String(cell ?? "")) : [""]) : [["Hạng mục", "Mô tả"], ["", ""]] };
  if (type === "columns") {
    return {
      id: block.id,
      type,
      leftTitle: typeof block.leftTitle === "string" ? block.leftTitle : "",
      rightTitle: typeof block.rightTitle === "string" ? block.rightTitle : "",
      left: normalizeSide(block.left ?? block.leftRich, "Nội dung cột trái…"),
      right: normalizeSide(block.right ?? block.rightRich, "Nội dung cột phải…"),
      width: block.width === "half" ? "half" : "full",
    };
  }
  return null;
}

const fromContent = (content: JSONContent, media: MediaAsset[] = []): Block[] => {
  const raw = content?.content?.find((node) => node.type === "projectLayout")?.attrs?.blocks;
  if (Array.isArray(raw)) {
    const normalized = raw.map(normalizeBlock).filter((block): block is Block => Boolean(block));
    if (normalized.length) return normalized;
  }
  const legacyText = (content?.content ?? []).map((node) => node.content?.map((child) => child.text ?? "").join("") ?? "").filter(Boolean).join("\n\n");
  const migrated: Block[] = legacyText ? [{ id: id(), type: "text", rich: emptyRich(legacyText) }] : [];
  for (const asset of media) if (asset.resourceType === "image" || asset.resourceType === "video") migrated.push({ id: id(), type: "image", image: asset, caption: asset.alt ?? "", width: "full", align: "center" });
  return migrated.length ? migrated : starter();
};

const toContent = (blocks: Block[]): JSONContent => ({ type: "doc", content: [{ type: "projectLayout", attrs: { blocks } }] });

function MediaPreview({ asset, className = "" }: { asset?: MediaAsset; className?: string }) {
  if (!asset) return <div className={`grid aspect-video place-items-center rounded-xl bg-slate-100 text-xs text-slate-400 ${className}`}>Chưa chọn media</div>;
  if (asset.resourceType === "video") {
    // Delivered as H.264 MP4 so phone (HEVC) videos show picture, not just sound.
    const src = optimizedVideoUrl(asset.url);
    return <video key={src} playsInline controls preload="metadata" className={`w-full rounded-xl bg-black/5 ${className}`}><source src={src} type="video/mp4" /></video>;
  }
  return <img src={asset.url} alt={asset.alt ?? ""} className={`w-full rounded-xl object-cover ${className}`} />;
}

export function ProjectLayoutBuilder({ value, onChange, cardImage, detailMedia, title, eyebrow, description, tags, onCardImageChange }: {
  value: JSONContent;
  onChange: (content: JSONContent) => void;
  cardImage: MediaAsset | null;
  detailMedia: MediaAsset[];
  title: string;
  eyebrow: string;
  description: string;
  tags: string[];
  onCardImageChange: (asset: MediaAsset | null) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => fromContent(value, detailMedia));
  const [dragging, setDragging] = useState<string | null>(null);
  const [preview, setPreview] = useState<"detail" | "card" | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [template, setTemplate] = useState("editorial");

  useEffect(() => {
    if (!value?.content?.some((node) => node.type === "projectLayout")) onChange(toContent(blocks));
  }, [value, blocks, onChange]);

  const update = (next: Block[]) => { setBlocks(next); onChange(toContent(next)); };
  const patch = (blockId: string, changes: Partial<Block>) => update(blocks.map(block => block.id === blockId ? ({ ...block, ...changes } as Block) : block));

  const add = (type: Block["type"]) => {
    const block: Block = type === "text"
      ? { id: id(), type, rich: emptyRich("Nhập nội dung…") }
      : type === "image"
        ? { id: id(), type, caption: "", width: "full", align: "center" }
        : type === "quote"
          ? { id: id(), type, text: "Trích dẫn nổi bật…", author: "" }
          : type === "table"
            ? { id: id(), type, title: "", rows: [["Hạng mục", "Mô tả"], ["", ""], ["", ""]] }
            : { id: id(), type, leftTitle: "", rightTitle: "", left: { mode: "text", rich: emptyRich("Nội dung cột trái…") }, right: { mode: "media" , rich: emptyRich(""), media: undefined } };
    update([...blocks, block]);
  };

  const uploadMedia = async (key: string, file: File, callback: (asset: MediaAsset) => void) => {
    setUploading(key);
    try {
      const asset = await uploadToCloudinary(file, "thom-portfolio/projects/detail");
      callback(asset);
    } catch (error) { window.alert(error instanceof Error ? error.message : "Upload thất bại"); }
    finally { setUploading(null); }
  };

  const applyTemplate = (name: string) => {
    setTemplate(name);
    const presets: Record<string, Block[]> = {
      editorial: [
        { id:id(), type:"text", rich:emptyRich("Giới thiệu dự án\n\nBối cảnh, mục tiêu và ý tưởng chính của dự án.") },
        { id:id(), type:"image", caption:"Hình ảnh tổng quan", width:"full", align:"center" },
        { id:id(), type:"columns", leftTitle:"Vai trò", left:{mode:"text",rich:emptyRich("Nghiên cứu insight\nLên ý tưởng nội dung")}, rightTitle:"Visual", right:{mode:"media",rich:emptyRich("")} },
        { id:id(), type:"quote", text:"Ý tưởng sáng tạo cần bắt đầu từ insight của người xem.", author:"Project note" },
        { id:id(), type:"text", rich:emptyRich("Kết quả & bài học\n\nMô tả kết quả đạt được và những điều rút ra.") },
      ],
      showcase: [
        { id:id(), type:"image", caption:"Ảnh cover nội dung", width:"full", align:"center" },
        { id:id(), type:"columns", leftTitle:"Tổng quan", left:{mode:"text",rich:emptyRich("Mục tiêu, đối tượng và định hướng triển khai.")}, rightTitle:"Video", right:{mode:"media",rich:emptyRich("")} },
        { id:id(), type:"table", title:"Thông tin dự án", rows:[["Hạng mục","Chi tiết"],["Vai trò","Content Creator"],["Nền tảng","TikTok / Social Media"],["Đầu ra","Video ngắn"]] },
      ],
      caseStudy: [
        { id:id(), type:"text", rich:emptyRich("01 — The challenge\n\nMô tả vấn đề cần giải quyết.") },
        { id:id(), type:"columns", leftTitle:"Challenge", left:{mode:"text",rich:emptyRich("Thách thức và insight.")}, rightTitle:"Solution video", right:{mode:"media",rich:emptyRich("")} },
        { id:id(), type:"image", caption:"Visual / kết quả triển khai", width:"full", align:"center" },
        { id:id(), type:"table", title:"Kết quả", rows:[["Chỉ số","Kết quả"],["Reach","—"],["Engagement","—"]] },
      ],
    };
    update(presets[name] ?? presets.editorial);
  };

  const moveDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const from = blocks.findIndex(block => block.id === dragging); const to = blocks.findIndex(block => block.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...blocks]; const [item] = next.splice(from, 1); next.splice(to, 0, item); update(next); setDragging(null);
  };

  const move = (from: number, to: number) => { if (to < 0 || to >= blocks.length) return; const next=[...blocks]; const [item]=next.splice(from,1); next.splice(to,0,item); update(next); };

  return <div className="space-y-5">
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-slate-900">Media hiển thị trên project card</p><p className="mt-1 text-xs text-slate-600">Ảnh, GIF hoặc video đều được hỗ trợ.</p></div><label className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">{uploading === "card" ? "Đang upload…" : "Upload media card"}<input type="file" accept="image/*,video/*" className="hidden" disabled={!!uploading} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value="";if(file)void uploadMedia("card",file,onCardImageChange);}} /></label></div>
      {cardImage && <div className="mt-3 flex flex-wrap items-start gap-3"><div className="h-20 w-32 overflow-hidden rounded-lg bg-slate-100"><MediaPreview asset={cardImage} className="h-full" /></div><div className="min-w-[280px] flex-1"><div className="text-xs text-slate-600">{cardImage.resourceType === "video" ? "Video card đã chọn" : "Ảnh card đã chọn"}<button type="button" onClick={()=>onCardImageChange(null)} className="ml-2 font-bold text-red-600">Gỡ media</button></div><input value={cardImage.link ?? ""} onChange={e=>onCardImageChange({...cardImage, link:e.target.value})} placeholder="Link của media card (tuỳ chọn) — có link thì redirect, bỏ trống thì mở media" className="mt-2 w-full rounded-lg border p-2.5 text-sm" type="url"/><p className="mt-1 text-[11px] text-slate-500">Link này chỉ áp dụng cho ảnh/video trên project card. Không ảnh hưởng Story & Details.</p></div></div>}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Thiết kế nội dung chi tiết</h3><p className="mt-1 text-xs text-slate-500">Text dùng editor kiểu Word. Columns cho phép mỗi bên là text hoặc ảnh/video/GIF.</p></div><div className="flex gap-2"><button type="button" onClick={()=>setPreview("card")} className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700">Preview card</button><button type="button" onClick={()=>setPreview("detail")} className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700">Preview trang chi tiết</button></div></div>

    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3"><span className="mr-1 self-center text-xs font-bold text-slate-500">Thêm block</span>{([{type:"text",label:"Text",icon:<Type size={14}/>},{type:"image",label:"Image / Video",icon:<ImagePlus size={14}/>},{type:"table",label:"Table",icon:<Table2 size={14}/>},{type:"columns",label:"2 columns",icon:<Columns2 size={14}/>},{type:"quote",label:"Quote",icon:<Quote size={14}/>} ] as const).map(item=><button type="button" key={item.type} onClick={()=>add(item.type)} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">{item.icon}{item.label}</button>)}</div>

    <div className="space-y-3">{blocks.map((block,index)=><section key={block.id} onDragOver={e=>{if(dragging)e.preventDefault();}} onDrop={e=>{if(dragging){e.preventDefault();moveDrop(block.id);}}} className={`rounded-2xl border bg-white p-4 shadow-sm ${dragging===block.id?"border-indigo-400 opacity-50":"border-slate-200"}`}>
      <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><span draggable title="Giữ và kéo icon này để sắp xếp block" aria-label="Kéo để sắp xếp block" onDragStart={e=>{setDragging(block.id);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",block.id);const card=e.currentTarget.closest("section");if(card)e.dataTransfer.setDragImage(card,24,24);}} onDragEnd={()=>setDragging(null)} className="inline-flex cursor-grab items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"><GripVertical size={16}/></span>{index+1}. {block.type === "columns" ? "Columns" : block.type}</div><div className="flex gap-1"><button type="button" onClick={()=>move(index,index-1)} disabled={index===0} className="rounded-lg border p-2 disabled:opacity-30"><ArrowUp size={14}/></button><button type="button" onClick={()=>move(index,index+1)} disabled={index===blocks.length-1} className="rounded-lg border p-2 disabled:opacity-30"><ArrowDown size={14}/></button><button type="button" onClick={()=>update(blocks.filter(item=>item.id!==block.id))} className="rounded-lg border border-red-100 p-2 text-red-600"><Trash2 size={14}/></button></div></div>

      {block.type === "text" && <><BoxControls value={block.box} onChange={box=>patch(block.id,{box})}/><RichEditor value={block.rich} boxStyle={boxCss(block.box)} onChange={rich=>patch(block.id,{rich})}/><div className="mt-2 flex items-center gap-2 text-xs"><span className="text-slate-500">Độ rộng</span><select value={block.width??"full"} onChange={e=>patch(block.id,{width:e.target.value as "full"|"half"})} className="rounded-lg border p-2"><option value="full">Toàn chiều rộng</option><option value="half">Nửa chiều rộng</option></select></div></>}

      {block.type === "image" && <><div className="flex flex-wrap items-center gap-3"><label className="cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold">{uploading===block.id?"Đang upload…":"Upload ảnh / video / GIF"}<input type="file" accept="image/*,video/*" className="hidden" disabled={!!uploading} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value="";if(file)void uploadMedia(block.id,file,asset=>patch(block.id,{image:asset}));}}/></label>{block.image&&<div className="h-20 w-28 overflow-hidden rounded-lg"><MediaPreview asset={block.image} className="h-full"/></div>}</div><input value={block.caption??""} onChange={e=>patch(block.id,{caption:e.target.value})} placeholder="Caption / mô tả media" className="mt-3 w-full rounded-lg border p-2.5 text-sm"/><div className="mt-2 flex flex-wrap gap-3 text-xs"><label>Chiều rộng <select value={block.width??"full"} onChange={e=>patch(block.id,{width:e.target.value as "full"|"half"})} className="ml-1 rounded border p-1.5"><option value="full">Full</option><option value="half">Half</option></select></label><label>Căn media <select value={block.align??"center"} onChange={e=>patch(block.id,{align:e.target.value as "left"|"center"|"right"})} className="ml-1 rounded border p-1.5"><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select></label></div></>}

      {block.type === "quote" && <><textarea value={block.text} onChange={e=>patch(block.id,{text:e.target.value})} rows={3} className="w-full rounded-xl border p-3 text-sm"/><input value={block.author??""} onChange={e=>patch(block.id,{author:e.target.value})} placeholder="Nguồn / tác giả" className="mt-2 w-full rounded-lg border p-2.5 text-sm"/></>}

      {block.type === "table" && <><input value={block.title??""} onChange={e=>patch(block.id,{title:e.target.value})} placeholder="Tiêu đề bảng" className="mb-2 w-full rounded-lg border p-2.5 text-sm"/><div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><tbody>{block.rows.map((row,r)=><tr key={r}>{row.map((cell,c)=><td key={c} className="border p-1"><input value={cell} onChange={e=>{const rows=block.rows.map(x=>[...x]);rows[r][c]=e.target.value;patch(block.id,{rows});}} className="w-full min-w-24 p-2 outline-none"/></td>)}</tr>)}</tbody></table></div><div className="mt-2 flex gap-2"><button type="button" onClick={()=>patch(block.id,{rows:[...block.rows,Array(block.rows[0]?.length??2).fill("")]})} className="rounded-lg border px-3 py-1.5 text-xs">+ Hàng</button><button type="button" onClick={()=>patch(block.id,{rows:block.rows.map(row=>[...row,""])})} className="rounded-lg border px-3 py-1.5 text-xs">+ Cột</button></div></>}

      {block.type === "columns" && <div className="grid gap-4 md:grid-cols-2"><ColumnEditor side="left" title={block.leftTitle??""} sideValue={block.left} onTitleChange={leftTitle=>patch(block.id,{leftTitle})} onChange={left=>patch(block.id,{left})} uploading={uploading} uploadMedia={uploadMedia}/><ColumnEditor side="right" title={block.rightTitle??""} sideValue={block.right} onTitleChange={rightTitle=>patch(block.id,{rightTitle})} onChange={right=>patch(block.id,{right})} uploading={uploading} uploadMedia={uploadMedia}/></div>}
    </section>)}</div>

    <div className="rounded-2xl border border-dashed border-slate-300 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><LayoutTemplate size={16}/> Templates nhanh</div><div className="flex flex-wrap gap-2">{[{id:"editorial",name:"Editorial Story"},{id:"showcase",name:"Project Showcase"},{id:"caseStudy",name:"Case Study"}].map(t=><button type="button" key={t.id} onClick={()=>applyTemplate(t.id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${template===t.id?"border-indigo-400 bg-indigo-50 text-indigo-700":"bg-white text-slate-600"}`}>{t.name}</button>)}</div></div>

    {preview&&<div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 p-3 sm:p-8"><div className="mx-auto max-w-5xl rounded-3xl bg-[#fffaf3] p-4 shadow-2xl sm:p-8"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Live preview</p><h2 className="text-xl font-bold text-slate-900">{preview==="card"?"Project card preview":"Project detail preview"}</h2></div><button type="button" onClick={()=>setPreview(null)} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">Đóng preview</button></div>{preview==="card"?<div className="mx-auto max-w-sm overflow-hidden rounded-3xl border bg-white shadow-xl"><div className="aspect-[16/10] bg-slate-100">{cardImage?<MediaPreview asset={cardImage} className="h-full"/>:<div className="grid h-full place-items-center text-sm text-slate-400">Chưa chọn media card</div>}</div><div className="p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">{eyebrow||"Personal Project"}</p><h3 className="mt-2 text-xl font-bold text-slate-900">{title||"Tên dự án"}</h3><p className="mt-2 text-sm text-slate-500">{description||"Mô tả ngắn của dự án sẽ hiển thị ở đây."}</p><div className="mt-4 flex flex-wrap gap-2">{tags.slice(0,3).map(tag=><span key={tag} className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">#{tag}</span>)}</div><p className="mt-5 text-sm font-bold text-indigo-700">View Project ↗</p></div></div>:<div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-lg"><div className="p-6 sm:p-10"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Project story</p><h1 className="mt-3 text-3xl font-bold text-slate-900">{title||"Tên dự án"}</h1><p className="mt-2 text-sm text-slate-500">{description}</p><BlockList blocks={blocks}/></div></div>}</div></div>}
  </div>;
}

const RADIUS_PRESETS = [{ label: "Vuông", value: 0 }, { label: "Nhẹ", value: 8 }, { label: "Vừa", value: 16 }, { label: "Tròn", value: 28 }, { label: "Rất tròn", value: 48 }];

function BoxControls({ value, onChange }: { value?: BoxStyle; onChange: (box: BoxStyle) => void }) {
  const box = value ?? defaultBox(false);
  const set = (changes: Partial<BoxStyle>) => onChange({ ...box, ...changes });
  const chip = (active: boolean) => `rounded-lg border px-2.5 py-1 font-semibold transition ${active ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"}`;
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <label className="flex cursor-pointer items-center gap-2 font-semibold">
        <input type="checkbox" checked={box.enabled} onChange={e=>set({ enabled: e.target.checked })} className="size-4 accent-indigo-600"/>
        Hiển thị cả đoạn text này trong 1 box (màu nền + bo góc)
      </label>
      {box.enabled && (
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 font-semibold text-slate-500">Màu nền</span>
            {BOX_PRESETS.map(color=><button key={color} type="button" title={color} aria-label={color} onClick={()=>set({ bg: color })} className={`size-6 rounded-md border ${box.bg.toUpperCase()===color?"ring-2 ring-indigo-500 ring-offset-1":""} ${color==="#FFFFFF"?"border-slate-300":"border-slate-200"}`} style={{ backgroundColor: color }}/>)}
            <ColorDropdown title="Chọn màu nền box" current={box.bg} clearLabel="" onPick={color=>set({ bg: color })}><span>Màu khác</span></ColorDropdown>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 font-semibold text-slate-500">Độ bo góc</span>
            {RADIUS_PRESETS.map(preset=><button key={preset.value} type="button" onClick={()=>set({ radius: preset.value })} className={chip(box.radius===preset.value)}>{preset.label}</button>)}
          </div>
          <label className="flex items-center gap-2">
            <span className="w-20 font-semibold text-slate-500">Tinh chỉnh</span>
            <input type="range" min={0} max={80} step={1} value={box.radius} onChange={e=>set({ radius: Number(e.target.value) })} className="w-48 accent-indigo-600"/>
            <span className="w-12 tabular-nums">{box.radius}px</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 font-semibold text-slate-500">Khoảng đệm</span>
            <input type="range" min={0} max={64} step={2} value={box.padding} onChange={e=>set({ padding: Number(e.target.value) })} className="w-48 accent-indigo-600"/>
            <span className="w-12 tabular-nums">{box.padding}px</span>
          </label>
          <p className="text-[11px] text-slate-500">Khung xám bên dưới là vùng soạn thảo; box màu bên trong chính là kết quả hiển thị trên trang.</p>
        </div>
      )}
    </div>
  );
}

function ColumnEditor({ side, title, sideValue, onTitleChange, onChange, uploading, uploadMedia }: { side: "left"|"right"; title: string; sideValue: ColumnSide; onTitleChange: (value:string)=>void; onChange:(value:ColumnSide)=>void; uploading:string|null; uploadMedia:(key:string,file:File,callback:(asset:MediaAsset)=>void)=>Promise<void> }) {
  const key = `column-${side}`;
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between gap-2"><input value={title} onChange={e=>onTitleChange(e.target.value)} placeholder={`Tiêu đề cột ${side === "left" ? "trái" : "phải"}`} className="w-full rounded border p-2 text-xs"/><select value={sideValue.mode} onChange={e=>onChange({...sideValue,mode:e.target.value as "text"|"media"})} className="ml-2 rounded border bg-white p-2 text-xs font-semibold"><option value="text">Text</option><option value="media">Ảnh / Video</option></select></div>{sideValue.mode === "text" ? <><BoxControls value={sideValue.box} onChange={box=>onChange({...sideValue,box})}/><RichEditor value={sideValue.rich} boxStyle={boxCss(sideValue.box)} onChange={rich=>onChange({...sideValue,rich})}/></> : <div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-white px-4 py-8 text-xs font-bold text-indigo-700">{uploading===key?"Đang upload…":<><Video size={16}/> Upload ảnh / video / GIF</>}<input type="file" accept="image/*,video/*" className="hidden" disabled={!!uploading} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value="";if(file)void uploadMedia(key,file,asset=>onChange({...sideValue,media:asset}));}}/></label><div className="mt-3">{sideValue.media?<MediaPreview asset={sideValue.media}/>:<div className="rounded-xl bg-white p-6 text-center text-xs text-slate-400">Chưa có media. Bạn có thể chọn video hoặc ảnh.</div>}</div></div>}</div>;
}

function PreviewRich({ value, box }: { value: RichEditorValue; box?: BoxStyle }) { return <div className="prose prose-slate max-w-none" style={boxCss(box)} dangerouslySetInnerHTML={{ __html: value.html }} />; }

function MediaAction({ asset, link, alt }: { asset: MediaAsset; link?: string; alt: string }) {
  const validLink = typeof link === "string" && /^https?:\/\//i.test(link);
  if (validLink) {
    return <a href={link} target="_blank" rel="noopener noreferrer" className="block cursor-pointer" aria-label={`Open ${alt}`}><MediaPreview asset={asset}/></a>;
  }
  return <div className="relative">
    <MediaPreview asset={asset}/>
    <ProjectMediaLightbox src={asset.url} alt={alt} videoSrc={asset.resourceType === "video" ? optimizedVideoUrl(asset.url) : undefined}/>
  </div>;
}

function PreviewBlock({block}:{block:Block}) {
  if(block.type==="text") return <div className="mt-8"><PreviewRich value={block.rich} box={block.box}/></div>;
  if(block.type==="image") return <figure className={`relative mt-8 w-full ${block.align==="right"?"ml-auto":block.align==="center"?"mx-auto":""}`}>{block.image ? <MediaAction asset={block.image} alt={block.caption || "Project media"}/> : <MediaPreview asset={block.image}/>} {block.caption&&<figcaption className="mt-2 text-center text-xs text-slate-500">{block.caption}</figcaption>}</figure>;
  if(block.type==="quote") return <blockquote className="my-8 border-l-4 border-indigo-500 bg-indigo-50 px-6 py-5 text-lg italic text-slate-700">“{block.text}”{block.author&&<footer className="mt-2 text-xs not-italic text-slate-500">— {block.author}</footer>}</blockquote>;
  if(block.type==="table") return <div className="my-8 overflow-x-auto">{block.title&&<h3 className="mb-3 font-bold">{block.title}</h3>}<table className="w-full border-collapse text-sm"><tbody>{block.rows.map((row,r)=><tr key={r}>{row.map((cell,c)=>r===0?<th key={c} className="border bg-slate-50 p-3 text-left">{cell}</th>:<td key={c} className="border p-3">{cell}</td>)}</tr>)}</tbody></table></div>;
  return <div className="my-8 grid gap-5 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2"><div><h3 className="font-bold">{block.leftTitle}</h3>{block.left.mode==="text"?<div className="mt-2"><PreviewRich value={block.left.rich} box={block.left.box}/></div>:<div className="relative mt-2">{block.left.media?<MediaAction asset={block.left.media} alt={block.leftTitle || "Project media"}/>:<MediaPreview asset={block.left.media}/>}</div>}</div><div><h3 className="font-bold">{block.rightTitle}</h3>{block.right.mode==="text"?<div className="mt-2"><PreviewRich value={block.right.rich} box={block.right.box}/></div>:<div className="relative mt-2">{block.right.media?<MediaAction asset={block.right.media} alt={block.rightTitle || "Project media"}/>:<MediaPreview asset={block.right.media}/>}</div>}</div></div>;
}

function BlockList({ blocks }: { blocks: Block[] }) {
  const output: import("react").ReactNode[] = [];
  for (let index=0; index<blocks.length; index+=1) {
    const current=blocks[index];
    if(current.width==="half") { const pair:Block[]=[current]; if(blocks[index+1]?.width==="half"){pair.push(blocks[index+1]);index+=1;} output.push(<div key={`row-${current.id}`} className="my-6 grid items-start gap-6 md:grid-cols-2">{pair.map(block=><div key={block.id} className="min-w-0"><PreviewBlock block={block}/></div>)}{pair.length===1&&<div aria-hidden="true"/>}</div>); }
    else output.push(<PreviewBlock key={current.id} block={current}/>);
  }
  return <>{output}</>;
}

export function ProjectLayoutContent({ content }: { content?: JSONContent }) { const blocks=useMemo(()=>fromContent(content??{type:"doc",content:[]}),[content]); return <div className="project-article"><BlockList blocks={blocks}/></div>; }
