/* protect.js — ฉบับนำเสนอ: ปิดการดาวน์โหลดข้อมูล/คัดลอก/บันทึกภาพ และใส่ลายน้ำ "บริษัท ไบต์เฟล็กซ์ จำกัด"
   ยกเว้น (ผู้ใช้ 19 พ.ย. 2569): ปุ่ม "บันทึกเป็น HTML (พิมพ์ได้)" ของเอกสาร/รายงาน ใช้ได้เหมือนเดิม — ฝังลายน้ำชื่อบริษัทในเอกสารทุกหน้า
   หมายเหตุ: เป็นการป้องกันระดับหน้าเว็บ (deterrent) — ไม่สามารถกันการจับภาพหน้าจอหรือเครื่องมือนักพัฒนาของเบราว์เซอร์ได้ 100%
   ค่าคงที่ในโค้ด (ไม่ใช่ค่าตั้งค่าที่ผู้ใช้แก้ได้) เพื่อไม่ให้ปิดการป้องกันจากหน้าค่าตั้งค่า */
"use strict";

const PROTECT = Object.freeze({ on: true, watermark: "บริษัท ไบต์เฟล็กซ์ จำกัด", note: "ต้นแบบเพื่อการนำเสนอ — ไม่อนุญาตให้ดาวน์โหลด คัดลอก หรือเผยแพร่" });
/* ปุ่มที่มีหน้าที่ส่งออกไฟล์อย่างเดียว → แสดงเป็นปุ่มปิดใช้งาน */
const EXPORT_ACTS = new Set(["doc-save-csv", "copy-area", "obe-csv", "pubr-csv", "pubround-csv", "pubhr-dl", "pubhr-api-sample", "sub-csv", "struct-csv", "plan-csv"]);   // จากการค้น saveFile ทุกจุด (pubhr-pack เป็นขั้นตอนงาน: เปลี่ยนสถานะได้ แต่ไม่มีไฟล์ออก)
const PROTECT_MSG = "ฉบับนำเสนอ: ปิดการดาวน์โหลด/ส่งออก/คัดลอกข้อมูล";

/* 1) ปิดการบันทึกไฟล์ทุกช่องทาง (ไฟล์/คัดลอกสำรอง) — ขั้นตอนงานยังเดินต่อได้ แต่ไม่มีไฟล์ออกจากหน้า */
const _saveFileOrig = saveFile;
saveFile = async function (filename) { toast(PROTECT_MSG); try { audit("พยายามส่งออกไฟล์ (ถูกปิด)", filename); } catch (e) { /* ไม่มี audit */ } };
copyFallback = function () { toast(PROTECT_MSG); };
/* เอกสาร/รายงานสำหรับพิมพ์: อนุญาตเฉพาะ HTML ที่ฝังลายน้ำแล้ว (ลายน้ำเป็น SVG ในเนื้อเอกสาร — พิมพ์ติดทุกหน้า ไม่ขึ้นกับตัวเลือก "พิมพ์ภาพพื้นหลัง") */
function docWatermarkHtml() {
  const t = PROTECT.watermark;
  return `<style>.npu-wm{position:fixed;inset:0;width:100%;height:100%;z-index:2147483000;pointer-events:none}.npu-wm-foot{position:fixed;right:8mm;bottom:4mm;z-index:2147483001;font:10px Sarabun,sans-serif;color:#777}@media print{.npu-wm,.npu-wm-foot{position:fixed}}</style>` +
    `<svg class="npu-wm" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="npu-wm-p" width="420" height="260" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><text x="210" y="120" font-family="Sarabun, sans-serif" font-size="26" font-weight="700" text-anchor="middle" fill="#808080" fill-opacity="0.18">${t}</text><text x="210" y="150" font-family="Sarabun, sans-serif" font-size="12" text-anchor="middle" fill="#808080" fill-opacity="0.18">เอกสารจากต้นแบบระบบบริหารจัดการหลักสูตร</text></pattern></defs><rect width="100%" height="100%" fill="url(#npu-wm-p)"/></svg>` +
    `<div class="npu-wm-foot">© ${t}</div>`;
}
function watermarkDocHtml(html) { return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, docWatermarkHtml() + "</body>") : html + docWatermarkHtml(); }
ACTIONS["doc-save-html"] = () => { const d = CURRENT_DOC; if (!d) return;
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(d.title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap"><style>${DOC_CSS}</style></head><body>${d.html}</body></html>`;
  return _saveFileOrig(d.file + ".html", watermarkDocHtml(html)); };
const _btnP = btn;
btn = function (label, act, opt = {}) { return EXPORT_ACTS.has(act) || /-(csv|dl|download|export)$/.test(act) ? _btnP(label, act, Object.assign({}, opt, { disabled: true, title: PROTECT_MSG })) : _btnP(label, act, opt); };
EXPORT_ACTS.forEach(a => { if (ACTIONS[a]) ACTIONS[a] = () => toast(PROTECT_MSG); });
Object.keys(ACTIONS).filter(a => /-(csv|dl|download|export)$/.test(a)).forEach(a => { ACTIONS[a] = () => toast(PROTECT_MSG); });

/* 2) กันคัดลอก/ตัด/ลาก/คลิกขวา/เลือกข้อความ/คีย์ลัด/พิมพ์ — ยกเว้นการพิมพ์และวางในช่องกรอกข้อมูล */
function isEditable(t) { return t && t.closest && t.closest("input:not([readonly]), textarea:not([readonly]), select, [contenteditable=true]"); }
function block(e) { if (isEditable(e.target) && e.type !== "copy" && e.type !== "cut") return; e.preventDefault(); if (e.type === "copy" || e.type === "cut" || e.type === "contextmenu") toast(PROTECT_MSG); }
if (PROTECT.on && typeof document !== "undefined" && document.addEventListener) {
  ["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach(ev => document.addEventListener(ev, block, true));
  document.addEventListener("keydown", e => {
    const k = (e.key || "").toLowerCase(); const mod = e.ctrlKey || e.metaKey; const ed = isEditable(e.target);
    const deny = (mod && ["c", "x", "s", "p", "u"].includes(k))          // คัดลอก ตัด บันทึกหน้า พิมพ์ ดูซอร์ส (รวมในช่องกรอก — วางได้ตามปกติ)
      || (mod && k === "a" && !ed)                                         // เลือกทั้งหน้า
      || (mod && e.shiftKey && ["i", "j", "c", "s"].includes(k))           // เครื่องมือนักพัฒนา / จับภาพ
      || k === "f12" || k === "printscreen";
    if (deny) { e.preventDefault(); e.stopPropagation(); toast(PROTECT_MSG); }
  }, true);
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("beforeprint", () => toast(PROTECT_MSG));
}

/* 3) ลายน้ำทั่วทั้งจอ (อยู่เหนือทุกชั้นรวมหน้าต่างเอกสาร ไม่รับการคลิก) + สร้างใหม่ถ้าถูกลบ */
function watermarkSvg() {
  const t = PROTECT.watermark;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260"><g transform="rotate(-28 210 130)" font-family="IBM Plex Sans Thai, Sarabun, sans-serif" fill="rgb(128,128,128)" fill-opacity="0.16"><text x="210" y="120" font-size="26" font-weight="600" text-anchor="middle">${t}</text><text x="210" y="152" font-size="13" text-anchor="middle">ต้นแบบเพื่อการนำเสนอ · ห้ามเผยแพร่</text></g></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
function mountWatermark() {
  if (typeof document === "undefined" || !document.body) return;
  let w = document.getElementById("npu-watermark");
  if (!w || !w.isConnected) { w = document.createElement("div"); w.id = "npu-watermark"; w.setAttribute("aria-hidden", "true"); document.body.appendChild(w); }
  w.className = "watermark"; w.textContent = ""; w.style.backgroundImage = watermarkSvg();
  const foot = document.getElementById("npu-protect-note") || document.createElement("div");
  foot.id = "npu-protect-note"; foot.className = "protect-note"; foot.textContent = `© ${PROTECT.watermark} · ${PROTECT.note}`; if (!foot.isConnected) document.body.appendChild(foot);
}
if (PROTECT.on) {
  mountWatermark();
  if (typeof document !== "undefined" && document.documentElement && document.documentElement.classList) document.documentElement.classList.add("protected");
  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.body) {
    new MutationObserver(() => { const w = document.getElementById("npu-watermark"); if (!w || !w.isConnected || w.style.display === "none" || !w.style.backgroundImage) mountWatermark(); }).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ["style", "class"] });
    if (typeof setInterval === "function") setInterval(mountWatermark, 4000);
  }
}
