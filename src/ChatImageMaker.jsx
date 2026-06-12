import { useState, useRef, useEffect, useCallback } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎭 캐릭터 목록 — 여기서 수정하세요
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CHARACTERS = [
  {
    id: "eden",
    name: "EDEN",
    emoji: "🔫",
    bgImg: "image/eden.png",
  },
  {
    id: "eden2",
    name: "EDEN",
    emoji: "🔫",
    bgImg: "image/eden(2).png",
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THEME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const T = {
  bg: "#fff5f7",
  panel: "#ffeef2",
  panel2: "#ffe4eb",
  accent: "#e8849a",
  accent2: "#d4607a",
  text: "#4a2030",
  text2: "#b87890",
  border: "#f5ccd8",
  white: "#ffffff",
};

const BG_COLORS = [
  { color: "#ffffff", label: "흰색" },
  { color: "#f8f4ef", label: "크림" },
  { color: "#fef8d4", label: "레몬" },
  { color: "#e4f2ff", label: "스카이" },
  { color: "#fde8f0", label: "로즈" },
  { color: "#e8f5e9", label: "민트" },
  { color: "#f3e8ff", label: "라벤더" },
  { color: "#1a1a2e", label: "네이비" },
  { color: "#0d0d0d", label: "블랙" },
  { color: "#2d1f3d", label: "다크퍼플" },
];

const TEXT_COLORS = [
  { color: "#4a2030", id: "dark", label: "다크" },
  { color: "#fff5f7", id: "light", label: "라이트" },
  { color: "#e8849a", id: "pink", label: "핑크" },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CANVAS HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EXPORT_SCALE = 3; // 저장 이미지 해상도 배율 (1800px 기준)

function getCanvasSize(ratio, scale = 1) {
  const BASE = 600 * scale;
  if (ratio === "1:1") return { w: BASE, h: BASE };
  if (ratio === "4:6") return { w: Math.round(BASE * 4 / 6), h: BASE };
  if (ratio === "3:4") return { w: BASE, h: Math.round(BASE * 4 / 3) };
  return { w: BASE, h: BASE };
}

function getExportSize(ratio) {
  const { w, h } = getCanvasSize(ratio);
  return { w: w * EXPORT_SCALE, h: h * EXPORT_SCALE };
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function extractLines(editor) {
  const out = [];
  function walk(n, isRoot) {
    if (n.nodeType === 3) {
      if (n.textContent) out.push({ text: n.textContent, hl: getHl(n) });
    } else if (n.nodeType === 1) {
      const tag = n.tagName.toLowerCase();
      if (tag === "br") { out.push({ br: true }); return; }
      if ((tag === "div" || tag === "p") && !isRoot) out.push({ br: true });
      n.childNodes.forEach(c => walk(c, false));
    }
  }
  function getHl(n) {
    let el = n.parentElement;
    while (el) {
      if (el.tagName === "MARK") {
        if (el.classList.contains("hl-y")) return "hl-y";
        if (el.classList.contains("hl-p")) return "hl-p";
        if (el.classList.contains("hl-c")) return "hl-c";
      }
      el = el.parentElement;
    }
    return null;
  }
  walk(editor, true);
  const rawLines = [[]];
  for (const item of out) {
    if (item.br) rawLines.push([]);
    else rawLines[rawLines.length - 1].push(item);
  }
  if (rawLines.length > 1 && rawLines[rawLines.length - 1].length === 0) rawLines.pop();
  return rawLines;
}

function parseMarkdown(chunks) {
  let plain = "";
  const hlMap = [];
  for (const c of chunks) {
    for (const ch of c.text) { plain += ch; hlMap.push(c.hl); }
  }
  const segs = [];
  const re = /(\*\*)([\s\S]+?)\*\*|(\*)([\s\S]+?)\*/g;
  let last = 0, m;
  while ((m = re.exec(plain)) !== null) {
    if (m.index > last) segs.push({ text: plain.slice(last, m.index), bold: false, italic: false, startIdx: last });
    if (m[1]) segs.push({ text: m[2], bold: true, italic: false, startIdx: m.index + 2 });
    else segs.push({ text: m[4], bold: false, italic: true, startIdx: m.index + 1 });
    last = m.index + m[0].length;
  }
  if (last < plain.length) segs.push({ text: plain.slice(last), bold: false, italic: false, startIdx: last });
  return segs.map(s => ({ ...s, hl: hlMap[s.startIdx] || null }));
}

function measureRichHeight(editor, fontSize, lineHeight, fontFamily, maxWidth) {
  const tmp = document.createElement("canvas");
  const tc = tmp.getContext("2d");
  const lh = fontSize * lineHeight;
  let total = 0;
  const rawLines = extractLines(editor);
  tc.font = `400 ${fontSize}px ${fontFamily}`;
  for (const line of rawLines) {
    if (!line.length) { total += lh; continue; }
    const plain = line.map(c => c.text).join("");
    const words = plain.split(/(\s+)/);
    let row = "", count = 1;
    for (const w of words) {
      const test = row ? row + w : w;
      if (tc.measureText(test).width > maxWidth && row) { count++; row = w; }
      else row = test;
    }
    total += count * lh;
  }
  return total;
}

function renderToCanvas(ctx, { w, h, title, editorEl, fontSize, lineHeight, fontFamily, padding, bgColor, overlayType, overlayOpacity, textColor, bgImageEl, selectedChar, charName, scale = 1 }) {
  const fs = fontSize * scale;
  const lh = fs * lineHeight;
  const pad = padding * scale;
  const maxW = w - pad * 2;
  const nameFontSize = Math.round(fs * 0.88);

  // BG
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);
  if (bgImageEl) ctx.drawImage(bgImageEl, 0, 0, w, h);
  if (overlayType !== "none") {
    ctx.fillStyle = overlayType === "white"
      ? `rgba(255,255,255,${overlayOpacity / 100})`
      : `rgba(0,0,0,${overlayOpacity / 100})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Measure total height for vertical centering
  let totalH = 0;
  if (title) {
    ctx.font = `700 ${Math.round(fontSize * 1.35)}px ${fontFamily}`;
    totalH += wrapText(ctx, title, maxW).length * Math.round(fontSize * 1.35 * 1.3) + 10 + 1 + 16;
  }
  totalH += measureRichHeight(editorEl, fontSize, lineHeight, fontFamily, maxW);
  if (charName && selectedChar) totalH += 10 + 1 + 10 + nameFontSize;

  let curY = Math.max(pad, (h - totalH) / 2);

  // Title
  if (title) {
    ctx.font = `700 ${Math.round(fontSize * 1.35)}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    wrapText(ctx, title, maxW).forEach(line => {
      ctx.fillText(line, pad, curY);
      curY += Math.round(fontSize * 1.35 * 1.3);
    });
    curY += 10;
    ctx.strokeStyle = textColor; ctx.globalAlpha = 0.2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, curY); ctx.lineTo(w - pad, curY); ctx.stroke();
    ctx.globalAlpha = 1; curY += 16;
  }

  // Body text
  const rawLines = extractLines(editorEl);
  function setFont(bold, italic) {
    ctx.font = `${italic ? "italic" : "normal"} ${bold ? "700" : "400"} ${fontSize}px ${fontFamily}`;
  }
  for (const rawLine of rawLines) {
    if (curY > h - pad) break;
    const segs = parseMarkdown(rawLine);
    const tokens = [];
    for (const seg of segs) {
      seg.text.split(/(\s+)/).forEach(p => { if (p !== "") tokens.push({ ...seg, text: p }); });
    }
    if (!tokens.length) { curY += lh; continue; }
    const wLines = [[]]; let lineW = 0;
    for (const tok of tokens) {
      setFont(tok.bold, tok.italic);
      const tw = ctx.measureText(tok.text).width;
      if (lineW + tw > maxW && wLines[wLines.length - 1].length > 0 && tok.text.trim()) {
        wLines.push([{ ...tok, _w: tw }]); lineW = tw;
      } else { wLines[wLines.length - 1].push({ ...tok, _w: tw }); lineW += tw; }
    }
    for (const wl of wLines) {
      if (curY > h - pad) break;
      let cx = pad;
      for (const tok of wl) {
        setFont(tok.bold, tok.italic);
        const tw = tok._w;
        if (tok.hl) {
          const hlC = { "hl-y": "rgba(255,230,0,0.45)", "hl-p": "rgba(255,100,180,0.4)", "hl-c": "rgba(0,220,255,0.35)" };
          ctx.fillStyle = hlC[tok.hl] || "rgba(255,230,0,0.4)";
          ctx.fillRect(cx - 1, curY - 1, tw + 2, fontSize + 4);
        }
        ctx.fillStyle = textColor;
        ctx.fillText(tok.text, cx, curY);
        cx += tw;
      }
      curY += lh;
    }
  }

  // Character name: ARCH | name
  if (charName && selectedChar) {
    const afterY = curY + 10;
    const archText = "ARCH", sepText = "  |  ";
    ctx.font = `700 ${nameFontSize}px ${fontFamily}`;
    const archW = ctx.measureText(archText).width;
    ctx.font = `400 ${nameFontSize}px ${fontFamily}`;
    const sepW = ctx.measureText(sepText).width;
    const nameW = ctx.measureText(charName).width;

    ctx.strokeStyle = textColor; ctx.globalAlpha = 0.2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, afterY); ctx.lineTo(pad + archW + sepW + nameW + 4, afterY); ctx.stroke();
    ctx.globalAlpha = 1;

    const nameY = afterY + 10;
    ctx.textBaseline = "top";
    ctx.font = `700 ${nameFontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor; ctx.globalAlpha = 1;
    ctx.fillText(archText, pad, nameY);
    ctx.font = `400 ${nameFontSize}px ${fontFamily}`;
    ctx.globalAlpha = 0.35;
    ctx.fillText(sepText, pad + archW, nameY);
    ctx.globalAlpha = 0.75;
    ctx.fillText(charName, pad + archW + sepW, nameY);
    ctx.globalAlpha = 1;
  }

  // Watermark
  const wmSize = Math.max(10, Math.round(fontSize * 0.72));
  ctx.font = `400 ${wmSize}px ${fontFamily}`;
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = textColor;
  ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  ctx.fillText("© CherryMango", w - pad, h - Math.round(pad * 0.6));
  ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "top";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLES (inline, no Tailwind deps)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const S = {
  app: { display: "flex", flexDirection: "column", minHeight: "100vh", background: T.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif", color: T.text },
  header: { background: T.panel, borderBottom: `1px solid ${T.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  logo: { fontSize: 17, fontWeight: 700, color: T.accent, letterSpacing: -0.3 },
  sub: { fontSize: 11, color: T.text2 },
  body: { display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 53px)" },
  sidebar: { width: 300, minWidth: 260, background: T.panel, borderRight: `1px solid ${T.border}`, overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column" },
  section: { borderBottom: `1px solid ${T.border}`, padding: 14 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: T.text2, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
  toolbar: { background: T.panel, borderBottom: `1px solid ${T.border}`, padding: "7px 12px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", flexShrink: 0 },
  workspace: { flex: 1, display: "flex", overflow: "hidden" },
  editorArea: { flex: 1, display: "flex", flexDirection: "column", padding: 14, gap: 8, overflowY: "auto", minWidth: 0 },
  editorLabel: { fontSize: 10, color: T.text2, letterSpacing: 0.5, fontWeight: 600 },
  previewArea: { width: 340, minWidth: 240, borderLeft: `1px solid ${T.border}`, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: 14, gap: 10, overflowY: "auto" },
};

function btn(active, onClick, children, extra = {}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? `rgba(232,132,154,0.12)` : T.white,
        border: `1.5px solid ${active ? T.accent : T.border}`,
        color: active ? T.accent : T.text2,
        borderRadius: 7, padding: "5px 11px", cursor: "pointer",
        fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4,
        transition: "all .15s", ...extra
      }}
    >
      {children}
    </button>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function ChatImageMaker() {
  const [ratio, setRatio] = useState("1:1");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [customBg, setCustomBg] = useState("#ffffff");
  const [overlayType, setOverlayType] = useState("none");
  const [overlayOpacity, setOverlayOpacity] = useState(40);
  const [selectedChar, setSelectedChar] = useState("");
  const [useBgImg, setUseBgImg] = useState(false);
  const [fontFamily, setFontFamily] = useState("'Pretendard','Apple SD Gothic Neo',sans-serif");
  const [fontSize, setFontSize] = useState(15);
  const [lineHeight, setLineHeight] = useState(1.75);
  const [padding, setPadding] = useState(28);
  const [textColor, setTextColor] = useState("#4a2030");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const editorRef = useRef(null);
  const canvasRef = useRef(null);
  const customColorRef = useRef(null);
  const rafRef = useRef(null);

  const char = CHARACTERS.find(c => c.id === selectedChar);
  const charName = char ? char.name : "";

  // ── Canvas render ──
  const drawCanvas = useCallback((bgImageEl = null) => {
    const canvas = canvasRef.current;
    const editor = editorRef.current;
    if (!canvas || !editor) return;
    const { w, h } = getCanvasSize(ratio);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    renderToCanvas(ctx, {
      w, h, title: "", editorEl: editor,
      fontSize, lineHeight, fontFamily, padding,
      bgColor, overlayType, overlayOpacity, textColor,
      bgImageEl, selectedChar, charName,
    });
  }, [ratio, bgColor, overlayType, overlayOpacity, fontFamily, fontSize, lineHeight, padding, textColor, title, selectedChar, charName]);

  const scheduleRender = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!char || !char.bgImg || !useBgImg) { drawCanvas(null); return; }
      const isRemote = /^https?:\/\//i.test(char.bgImg);
      const img = new Image();
      img.onload = () => drawCanvas(img);
      img.onerror = () => drawCanvas(null);
      img.src = isRemote ? "https://corsproxy.io/?" + encodeURIComponent(char.bgImg) : char.bgImg;
    });
  }, [drawCanvas, char, useBgImg]);

  useEffect(() => { scheduleRender(); }, [scheduleRender]);

  // ── Formatting ──
  function execFmt(cmd) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    scheduleRender();
  }

  function applyHighlight(cls) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    editorRef.current?.focus();
    const range = sel.getRangeAt(0);
    const parent = sel.anchorNode?.parentElement;
    if (parent?.tagName === "MARK" && parent.classList.contains(cls)) {
      parent.replaceWith(document.createTextNode(parent.textContent));
    } else {
      const mark = document.createElement("mark");
      mark.className = cls;
      try { range.surroundContents(mark); }
      catch { const f = range.extractContents(); mark.appendChild(f); range.insertNode(mark); }
    }
    sel.removeAllRanges();
    scheduleRender();
  }

  function removeHighlight() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const parent = sel.anchorNode?.parentElement;
    if (parent?.tagName === "MARK") parent.replaceWith(document.createTextNode(parent.textContent));
    scheduleRender();
  }

  // ── Save ──
  function saveImage() {
    const { w, h } = getCanvasSize(ratio, 2); // 2x 해상도
    const offscreen = document.createElement("canvas");
    offscreen.width = w; offscreen.height = h;
    const ctx2 = offscreen.getContext("2d");

    function doExport(bgImg) {
      const SCALE = 2;
      renderToCanvas(ctx2, {
        w, h, title: "", editorEl: editorRef.current,
        fontSize: fontSize * SCALE,
        lineHeight,
        fontFamily,
        padding: padding * SCALE,
        bgColor, overlayType, overlayOpacity, textColor,
        bgImageEl: bgImg, selectedChar, charName,
      });
      const dataUrl = offscreen.toDataURL("image/png");
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>이미지 저장</title><style>body{margin:0;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px}img{max-width:100%;border-radius:8px}p{color:#aaa;font-family:sans-serif;font-size:14px;text-align:center;padding:0 20px}</style></head><body><img src="${dataUrl}" alt="생성된 이미지"><p>이미지를 꾹 눌러서 사진 앨범에 저장하세요</p></body></html>`);
          win.document.close();
        }
      } else {
        const a = document.createElement("a");
        a.href = dataUrl; a.download = "chat-image.png"; a.click();
      }
    }

    if (char?.bgImg && useBgImg) {
      const isRemote = /^https?:\/\//i.test(char.bgImg);
      const img = new Image();
      img.onload = () => doExport(img);
      img.onerror = () => doExport(null);
      img.src = isRemote ? "https://corsproxy.io/?" + encodeURIComponent(char.bgImg) : char.bgImg;
    } else doExport(null);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); execFmt("bold"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); execFmt("italic"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Preview canvas size ──
  const { w: cw, h: ch } = getCanvasSize(ratio);
  const previewMaxW = 290;
  const previewScale = previewMaxW / cw;

  // ── Sidebar content ──
  const sidebarContent = (
    <div style={S.sidebar}>
      {/* Ratio */}
      <div style={S.section}>
        <div style={S.sectionTitle}>비율</div>
        <div style={{ display: "flex", gap: 7 }}>
          {[
            { r: "1:1",  w: 18, h: 18 },
            { r: "4:6",  w: 14, h: 22 },
            { r: "3:4",  w: 22, h: 28 },
          ].map(({ r, w: iw, h: ih }) => (
            <button key={r} onClick={() => setRatio(r)} style={{
              flex: 1, background: ratio === r ? `rgba(232,132,154,0.12)` : T.white,
              border: `1.5px solid ${ratio === r ? T.accent : T.border}`,
              color: ratio === r ? T.accent : T.text2,
              borderRadius: 8, padding: "9px 0", cursor: "pointer",
              fontSize: 12, fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <div style={{
                width: iw, height: ih,
                background: ratio === r ? T.accent : T.text2, borderRadius: 2,
              }} />
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div style={S.section}>
        <div style={S.sectionTitle}>배경색</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {BG_COLORS.map(({ color, label }) => (
            <div key={color} onClick={() => setBgColor(color)} title={label} style={{
              width: 30, height: 30, borderRadius: 7, background: color, cursor: "pointer",
              border: `2px solid ${bgColor === color ? T.accent : T.border}`,
              transform: bgColor === color ? "scale(1.12)" : "scale(1)",
              transition: "all .15s",
            }} />
          ))}
          <div onClick={() => customColorRef.current?.click()} title="직접 선택" style={{
            width: 30, height: 30, borderRadius: 7, background: T.white,
            border: `2px solid ${T.border}`, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: T.text2,
          }}>＋</div>
          <input ref={customColorRef} type="color" value={customBg} style={{ display: "none" }}
            onChange={e => { setCustomBg(e.target.value); setBgColor(e.target.value); }} />
        </div>
        {/* Overlay */}
        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          {[["none","없음"],["white","흰색"],["black","검정"]].map(([v, label]) => (
            <button key={v} onClick={() => setOverlayType(v)} style={{
              flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11,
              border: `1.5px solid ${overlayType === v ? T.accent : T.border}`,
              background: overlayType === v ? `rgba(232,132,154,0.1)` : T.white,
              color: overlayType === v ? T.accent : T.text2,
              cursor: "pointer", fontFamily: "inherit",
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: T.text2, flexShrink: 0 }}>불투명도</span>
          <input type="range" min={0} max={90} value={overlayOpacity}
            onChange={e => setOverlayOpacity(+e.target.value)}
            style={{ flex: 1, accentColor: T.accent }} />
          <span style={{ fontSize: 11, color: T.accent, width: 30 }}>{overlayOpacity}%</span>
        </div>
      </div>

      {/* Character */}
      <div style={S.section}>
        <div style={S.sectionTitle}>캐릭터 배경</div>
        <select value={selectedChar} onChange={e => { setSelectedChar(e.target.value); setUseBgImg(false); }}
          style={{ width: "100%", background: T.white, border: `1.5px solid ${T.border}`, color: T.text, borderRadius: 7, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, cursor: "pointer", outline: "none" }}>
          <option value="">— 캐릭터 없음 —</option>
          {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.emoji ? c.emoji + " " : ""}{c.name}</option>)}
        </select>
        {char?.bgImg && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer", userSelect: "none" }}>
            <div onClick={() => setUseBgImg(v => !v)} style={{
              width: 36, height: 20, borderRadius: 10, position: "relative",
              background: useBgImg ? T.accent2 : T.border, transition: "background .2s", flexShrink: 0,
            }}>
              <div style={{
                position: "absolute", top: 3, left: useBgImg ? 19 : 3,
                width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .2s",
              }} />
            </div>
            <span style={{ fontSize: 12, color: useBgImg ? T.accent : T.text2 }}>캐릭터 배경 이미지 사용</span>
          </label>
        )}
      </div>

      {/* Font */}
      <div style={S.section}>
        <div style={S.sectionTitle}>텍스트 설정</div>
        <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}
          style={{ width: "100%", background: T.white, border: `1.5px solid ${T.border}`, color: T.text, borderRadius: 7, padding: "7px 10px", fontFamily: "inherit", fontSize: 13, marginBottom: 8, cursor: "pointer", outline: "none" }}>
          <option value="'Pretendard','Apple SD Gothic Neo',sans-serif">Pretendard (기본)</option>
          <option value="'Noto Serif KR',Georgia,serif">Noto Serif KR</option>
          <option value="'Nanum Myeongjo',serif">나눔명조</option>
          <option value="'Nanum Gothic',sans-serif">나눔고딕</option>
          <option value="Georgia,serif">Georgia</option>
        </select>
        {[
          ["본문 크기", fontSize, setFontSize, 10, 28, v => v + "px"],
          ["줄 간격", Math.round(lineHeight * 100), v => setLineHeight(v / 100), 100, 250, v => (v / 100).toFixed(2)],
          ["여백", padding, setPadding, 16, 60, v => v + "px"],
        ].map(([label, val, setter, min, max, fmt]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: T.text2, width: 52, flexShrink: 0 }}>{label}</span>
            <input type="range" min={min} max={max} value={val}
              onChange={e => setter(+e.target.value)}
              style={{ flex: 1, accentColor: T.accent }} />
            <span style={{ fontSize: 11, color: T.accent, width: 32, textAlign: "right" }}>{fmt(val)}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 11, color: T.text2 }}>텍스트색</span>
          <div style={{ display: "flex", gap: 5 }}>
            {TEXT_COLORS.map(({ color, id }) => (
              <div key={id} onClick={() => setTextColor(color)} style={{
                width: 26, height: 26, borderRadius: 6, background: color, cursor: "pointer",
                border: `2px solid ${textColor === color ? T.accent : T.border}`,
                transition: "all .15s",
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      {/* Header */}
      <header style={S.header}>
        {/* Mobile menu toggle */}
        <button onClick={() => setSidebarOpen(v => !v)} style={{
          display: "none", background: "none", border: "none", cursor: "pointer",
          color: T.accent, fontSize: 20, padding: 0,
          // shown via CSS media query workaround — use inline for simplicity
        }} id="menu-toggle">☰</button>
        <div style={S.logo}>✦ 이미지 메이커</div>
        <div style={S.sub}>소설 · AI 채팅 로그 이미지 생성기</div>
      </header>

      <div style={S.body}>
        {/* Sidebar */}
        {sidebarContent}

        {/* Main */}
        <div style={S.main}>
          {/* Toolbar */}
          <div style={S.toolbar}>
            {btn(false, () => execFmt("bold"), <b>B</b>)}
            {btn(false, () => execFmt("italic"), <i>I</i>)}
            <div style={{ width: 1, height: 20, background: T.border, margin: "0 2px" }} />
            {[
              ["hl-y", "#ffd700", "노랑"],
              ["hl-p", "#ff64b4", "핑크"],
              ["hl-c", "#00dcff", "시안"],
            ].map(([cls, dot, label]) => btn(false, () => applyHighlight(cls),
              <><span style={{ width: 9, height: 9, borderRadius: "50%", background: dot, display: "inline-block" }} />{label}</>
            ))}
            {btn(false, removeHighlight, "✕ 형광펜")}
          </div>

          <div style={S.workspace}>
            {/* Editor */}
            <div style={S.editorArea}>
              <div style={S.editorLabel}>CONTENT</div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={scheduleRender}
                onKeyUp={scheduleRender}
                onMouseUp={scheduleRender}
                data-placeholder="여기에 소설이나 채팅 내용을 입력하세요."
                style={{
                  flex: 1, minHeight: 260, background: T.white,
                  border: `1.5px solid ${T.border}`, borderRadius: 9,
                  padding: 13, fontFamily: "inherit", fontSize: fontSize,
                  lineHeight: lineHeight, color: T.text, outline: "none",
                  overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  cursor: "text",
                }}
              />
              <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.6 }}>
                💡 <b>*텍스트*</b> → 이탤릭 · <b>**텍스트**</b> → 볼드 · 텍스트 선택 후 툴바로 서식 적용
              </div>
            </div>

            {/* Preview */}
            <div style={S.previewArea}>
              <div style={{ fontSize: 10, color: T.text2, letterSpacing: 0.5, fontWeight: 600, alignSelf: "flex-start" }}>PREVIEW</div>
              <canvas
                ref={canvasRef}
                style={{
                  width: Math.round(cw * previewScale),
                  height: Math.round(ch * previewScale),
                  borderRadius: 10,
                  boxShadow: "0 6px 24px rgba(200,80,110,0.15)",
                  maxWidth: "100%",
                }}
              />
              <button onClick={saveImage} style={{
                width: "100%", background: T.accent, color: "#fff",
                border: "none", borderRadius: 10, padding: 12,
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer", letterSpacing: 0.2,
              }}>
                이미지 저장
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          #menu-toggle { display: block !important; }
          .sidebar-wrap { position: fixed; top: 53px; left: 0; bottom: 0; z-index: 100; transform: translateX(-100%); transition: transform .25s; }
          .sidebar-wrap.open { transform: translateX(0); }
          .preview-area-wrap { width: 100% !important; border-left: none !important; border-top: 1px solid ${T.border}; }
          .workspace-wrap { flex-direction: column !important; }
        }
        [contenteditable]:empty::before {
          content: attr(data-placeholder);
          color: ${T.text2};
          pointer-events: none;
        }
        mark.hl-y { background: rgba(255,230,0,0.4); color: inherit; border-radius: 2px; }
        mark.hl-p { background: rgba(255,100,180,0.38); color: inherit; border-radius: 2px; }
        mark.hl-c { background: rgba(0,220,255,0.32); color: inherit; border-radius: 2px; }
        * { box-sizing: border-box; }
        input[type=range] { height: 4px; }
        select, input, button { transition: border-color .15s; }
        select:focus, input:focus { border-color: ${T.accent} !important; outline: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${T.panel}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
      `}</style>
    </div>
  );
}
