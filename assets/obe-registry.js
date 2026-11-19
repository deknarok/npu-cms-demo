/* obe-registry.js — G18 PLO/VOS/curriculum mapping ของหลักสูตรที่ใช้อยู่ (หน้าบันทึกและจัดการรายหลักสูตร)
   ข้อมูลอยู่ในเล่ม มคอ.2 PDF → คณะ (FC) สร้าง/นำเข้าแบบวาง/แก้ไข → ส่งตรวจ → เจ้าหน้าที่หลักสูตรส่วนกลาง (CC) ยืนยันว่าตรงกับเล่ม
   ยืนยันแล้วแก้ได้ แต่สถานะกลับเป็นร่างและต้องยืนยันใหม่ (เก็บประวัติ) · การเปลี่ยน PLO เชิงสาระของหลักสูตรต้องทำผ่านการปรับปรุงหลักสูตร (D12) */
"use strict";

const OBE_ST = { NONE: ["ยังไม่มีข้อมูล", "warn"], SIM: ["ตัวอย่าง (จำลอง)", "neutral"], DRAFT: ["ร่าง (คณะบันทึก)", "warn"], SUBMITTED: ["รอส่วนกลางตรวจ", "info"], VERIFIED: ["ยืนยันตรงกับเล่มแล้ว", "good"] };
const TQF6_DOM = [["E", "1 คุณธรรม จริยธรรม"], ["K", "2 ความรู้"], ["S", "3 ทักษะทางปัญญา"], ["C", "4 ความสัมพันธ์ระหว่างบุคคลและความรับผิดชอบ"], ["S", "5 การวิเคราะห์เชิงตัวเลข การสื่อสาร และเทคโนโลยีสารสนเทศ"], ["S", "6 ทักษะพิสัย"]];
function obeStatus(p) { const o = obeOf(p); if (!o) return "NONE"; if (o.dataStatus) return o.dataStatus; return o.source ? "DRAFT" : "SIM"; }
function canObe(p) { return can("obe.edit") && (myFac(p) || me().scope.type === "UNIVERSITY"); }
function obeLog(o, text) { o.log = (o.log || []).concat([{ at: today(), by: S.user, text }]); }
function obeTouched(o, what) { if (o.dataStatus === "VERIFIED") { o.dataStatus = "DRAFT"; obeLog(o, `แก้ไขหลังยืนยัน (${what}) → กลับเป็นร่าง ต้องยืนยันใหม่`); } else if (!o.dataStatus && o.source) o.dataStatus = "DRAFT"; }
function obeCoverage(p) {
  const o = obeOf(p); const s = structureOf(p); const sc = s ? [...new Set(treeCourses(s))] : []; if (!o) return { sc, mapped: 0, missing: sc, extra: [] };
  const mk = Object.keys(o.mapping); const mapped = mk.filter(c => Object.keys(o.mapping[c]).length).length;
  return { sc, mapped, missing: sc.filter(c => !mk.includes(c)), extra: s ? mk.filter(c => !sc.includes(c)) : [] };
}

/* ---------- หน้ารวม ---------- */
route("obereg", { perm: "obe.view", title: "PLO และ curriculum mapping", render() {
  const f = S.filters.obe || {};
  const all = D.programs.filter(inScope).filter(p => p.life !== "CLOSED");
  const rows = all.filter(p => (!f.fac || p.fac === f.fac) && (!f.st || obeStatus(p) === f.st) && (!f.level || p.level === f.level)).map(p => ({ p, o: obeOf(p), st: obeStatus(p), cov: obeCoverage(p) }));
  const cnt = k => all.filter(p => obeStatus(p) === k).length; const pg = paged("obe", rows, 30);
  return pageHead("PLO / VOS / curriculum mapping รายหลักสูตร (G18)", { lead: `หลักสูตรที่ใช้อยู่มี PLO และแผนที่กระจายความรับผิดชอบอยู่ในเล่ม มคอ.2 (PDF) เท่านั้น → คณะบันทึก/นำเข้าแบบวางจากเล่ม แล้วส่งให้เจ้าหน้าที่หลักสูตรส่วนกลางตรวจยืนยันตรงกับเล่ม · ข้อมูลที่ยืนยันแล้วใช้ใน มคอ.2/3/5 และส่งโมดูล TQF` }) +
    `<div class="grid g4">${[["VERIFIED", "ยืนยันแล้ว"], ["SUBMITTED", "รอตรวจ"], ["DRAFT", "ร่าง/จากเล่ม"], ["NONE", "ยังไม่มีข้อมูล"]].map(([k, t]) => `<div class="panel stat"><span class="label">${t}</span><span class="value">${cnt(k)}</span>${k === "DRAFT" && cnt("SIM") ? `<span class="sub">+ ตัวอย่างจำลอง ${cnt("SIM")}</span>` : ""}</div>`).join("")}</div>
    <section class="panel"><header><form class="filters" data-form="obe-filter" style="width:100%"><select name="fac" aria-label="คณะ"><option value="">ทุกคณะ/วิทยาลัย</option>${D.meta.faculties.map(x => `<option value="${x.id}"${f.fac === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><select name="level" aria-label="ระดับ"><option value="">ทุกระดับ</option>${D.meta.levels.map(l => `<option value="${l.code}"${f.level === l.code ? " selected" : ""}>${esc(levelAbbr(l.code))}</option>`).join("")}</select><select name="st" aria-label="สถานะ"><option value="">ทุกสถานะ</option>${Object.entries(OBE_ST).map(([k, v]) => `<option value="${k}"${f.st === k ? " selected" : ""}>${v[0]}</option>`).join("")}</select><button class="btn primary" type="submit">กรอง</button></form></header></section>` +
    panel(`${fmt(rows.length)} หลักสูตร`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.p.id}-obe">${esc(progTitle(x.p, true))}</a><br><span class="muted small">${esc(IDX.fac.get(x.p.fac).name)}</span>` },
      { th: "กรอบ", val: x => x.o ? (x.o.framework === "TQF6" ? "TQF 6 ด้าน" : "OBE (KSEC)") : "—" }, { th: "PLO/LO", num: true, val: x => x.o ? x.o.plos.length : "—" }, { th: "VOS", num: true, val: x => x.o ? x.o.vos.length : "—" },
      { th: "mapping (รายวิชา)", num: true, html: x => x.o ? `${x.cov.mapped}${x.cov.sc.length ? "/" + x.cov.sc.length : ""}${x.cov.missing.length ? `<br><span class="muted small">ขาด ${x.cov.missing.length}</span>` : ""}` : "—" },
      { th: "แหล่ง", wrap: true, html: x => x.o ? (x.o.source ? esc(x.o.source) : srcPill(false)) : "—" }, { th: "สถานะ", html: x => pillOf(OBE_ST, x.st) },
      { th: "", html: x => `<span class="actions">${x.o ? `<a class="btn sm" href="#program-${x.p.id}-obe">${canObe(x.p) ? "จัดการ" : "ดู"}</a>` : canObe(x.p) ? btn("+ สร้าง", "obe-create", { sm: true, kind: "primary", data: { id: x.p.id } }) : ""}${x.st === "SUBMITTED" && can("review.data") ? btn("ตรวจ", "obe-verify", { sm: true, data: { id: x.p.id } }) : ""}</span>` }], pg.rows), { flush: true }) + pg.pager +
    `<p class="muted small">"ตัวอย่าง (จำลอง)" = ข้อมูลสาธิตที่ยังไม่มีเล่มจริง — แทนได้ด้วยการนำเข้าจากเล่ม · ข้อมูลจากเล่มจริง: ${D.programs.filter(p => (obeOf(p) || {}).source).map(p => esc(progTitle(p, true))).join(", ") || "—"} ${gapPill("G18")}</p>`;
} });
form("obe-filter", d => { S.filters.obe = d; S.ui["pg-obe"] = 1; rerender(); });

/* ---------- สร้าง ---------- */
act("obe-create", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const v = activeVer(p);
  openModal(`สร้างข้อมูล PLO/mapping — ${progTitle(p, true)}`, `<form data-form="obe-create" data-id="${p.id}"><div class="form-grid">
    ${field("framework", "กรอบผลการเรียนรู้ตามเล่ม", { type: "select", options: [["OBE", "OBE — PLO (K S E C) + I/R/M"], ["TQF6", "TQF 6 ด้าน (เล่มเดิมก่อน OBE) + ● ○"]], value: v.year >= 2565 ? "OBE" : "TQF6", blank: false })}
    ${field("source", "แหล่ง (เล่ม มคอ.2 ฉบับ)", { value: `เล่ม มคอ.2 ${p.name} ${v.year}`, required: true })}${field("url", "ลิงก์ไฟล์เล่ม (ถ้ามี)", { full: true, placeholder: "https://..." })}
    ${field("seed", "รายวิชาตั้งต้นของ mapping", { type: "select", options: [["STRUCT", "รายวิชาทั้งหมดในโครงสร้างหลักสูตร"], ["NONE", "ว่าง (นำเข้าจากตารางภายหลัง)"]], blank: false })}</div>
    <div class="note">ขั้นถัดไป: นำเข้า PLO และ mapping แบบวางจากเล่ม (Excel/Word) → ตรวจกฎ → ส่งส่วนกลางยืนยัน</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">สร้าง</button></div></form>`);
});
form("obe-create", (d, f) => {
  if (!formErrors(f, d.source ? {} : { source: "ระบุเล่มที่ใช้อ้างอิง" })) return;
  const p = IDX.prog.get(Number(f.dataset.id)); const s = structureOf(p); const mapping = {};
  if (d.seed === "STRUCT" && s) [...new Set(treeCourses(s))].forEach(c => { mapping[c] = {}; });
  D.design.obe[p.id] = { framework: d.framework === "TQF6" ? "TQF6" : undefined, source: d.source, sourceUrl: d.url || "", objectives: [], plos: [], ylo: [], vos: [], mapping, clos: {}, attain: {}, published: false, publishedAt: null, dataStatus: "DRAFT", origin: "CMS", log: [] };
  obeLog(D.design.obe[p.id], `สร้างจาก ${d.source}`); audit("สร้างข้อมูล OBE", p.code); persist(); closeModal(); go(`program-${p.id}-obe`);
});

/* ---------- แถบจัดการบนแท็บ OBE ---------- */
const _ptabObe = PTAB.obe;
PTAB.obe = p => {
  const o = obeOf(p); const ed = canObe(p);
  if (!o) return `<div class="note warn">หลักสูตรนี้ยังไม่มี PLO/mapping ในระบบ — ข้อมูลอยู่ในเล่ม มคอ.2 PDF ${gapPill("G18")}</div>${ed ? `<div class="actions">${btn("+ สร้างข้อมูล PLO/mapping จากเล่ม", "obe-create", { kind: "primary", data: { id: p.id } })}</div>` : ""}`;
  const st = obeStatus(p); const cov = obeCoverage(p);
  const bar = `<section class="panel"><header><h2>บันทึกข้อมูลจากเล่ม ${pillOf(OBE_ST, st)}</h2><div class="actions">${btn("CSV mapping", "obe-csv", { sm: true, data: { id: p.id } })}</div></header><div class="body">
    ${kv([["แหล่ง", o.source ? `${esc(o.source)}${o.sourceUrl ? ` · <a href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">เปิดเล่ม</a>` : ""}` : srcPill(false) + " ข้อมูลตัวอย่าง — แทนด้วยการนำเข้าจากเล่ม"],
      ["ความครบ", `PLO ${o.plos.length} · วัตถุประสงค์ ${(o.objectives || []).length} · YLO ${o.ylo.length} · VOS ${o.vos.length} · mapping ${cov.mapped}/${cov.sc.length || Object.keys(o.mapping).length} รายวิชา${cov.missing.length ? ` · ${pill(`ขาด ${cov.missing.length} วิชาในโครงสร้าง`, "warn")}` : ""}${cov.extra.length ? ` · ${pill(`${cov.extra.length} วิชาไม่อยู่ในโครงสร้าง`, "neutral")}` : ""}`],
      o.verifiedBy ? ["ยืนยันล่าสุด", `${esc(userName(o.verifiedBy))} ${thDate(o.verifiedAt)}`] : null,
      (o.log || []).length ? ["ประวัติ", `<ul class="bul small">${o.log.slice(-4).reverse().map(l => `<li>${thDate(l.at)} ${esc(userName(l.by))}: ${esc(l.text)}</li>`).join("")}</ul>`] : null])}
    ${ed ? `<div class="actions">${btn("นำเข้า PLO (วาง)", "obe-paste-plo", { sm: true, data: { id: p.id } })}${btn("นำเข้า mapping (วาง)", "obe-paste-map", { sm: true, data: { id: p.id } })}${btn("วัตถุประสงค์", "obe-obj", { sm: true, data: { id: p.id } })}${btn("YLO รายชั้นปี", "obe-ylo", { sm: true, data: { id: p.id } })}${cov.missing.length ? btn(`เติม ${cov.missing.length} วิชาจากโครงสร้าง`, "obe-fill", { sm: true, data: { id: p.id } }) : ""}${cov.extra.length ? btn("นำวิชานอกโครงสร้างออก", "obe-trim", { sm: true, data: { id: p.id } }) : ""}${["DRAFT", "SIM"].includes(st) ? btn("ส่งส่วนกลางตรวจ", "obe-submit", { sm: true, kind: "primary", data: { id: p.id } }) : ""}</div>` : ""}
    ${st === "SUBMITTED" && can("review.data") ? `<div class="actions">${btn("ตรวจกับเล่มและยืนยัน", "obe-verify", { kind: "primary", data: { id: p.id } })}</div>` : ""}</div></section>`;
  return bar + _ptabObe(p);
};

/* ---------- นำเข้าแบบวาง ---------- */
act("obe-paste-plo", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const tqf = o.framework === "TQF6";
  openModal("นำเข้า PLO / ผลการเรียนรู้แบบวาง", `<form data-form="obe-paste-plo" data-id="${p.id}"><p class="small">หนึ่งบรรทัดต่อหนึ่งข้อ คั่นคอลัมน์ด้วยแท็บ (วางจาก Excel/Word) หรือ <code>|</code>: <b>รหัส | ข้อความ | ด้าน</b>${tqf ? " (ด้าน 1–6 ตาม TQF)" : " (K/S/E/C)"} | เกณฑ์วัด | เครื่องมือ — คอลัมน์ 3–5 ไม่บังคับ</p>
    ${field("rows", "ข้อมูล", { type: "textarea", rows: 10, full: true, required: true, placeholder: tqf ? "LO1.1\tมีวินัย ตรงต่อเวลา\t1\nLO2.1\tอธิบายหลักภาษาจีนได้\t2" : "PLO1\tอธิบายหลักการ...ได้\tK\tร้อยละ 70 ผ่าน rubric ระดับ 3\tข้อสอบ" })}
    ${field("mode", "วิธีนำเข้า", { type: "select", options: [["MERGE", "เพิ่ม/แทนที่ตามรหัส"], ["REPLACE", "แทนที่ทั้งหมด (ลบ PLO เดิมและคอลัมน์ mapping ที่ไม่มีแล้ว)"]], blank: false })}
    <div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">นำเข้า</button></div></form>`, { wide: true });
});
function splitRow(l) { return l.split(l.includes("\t") ? "\t" : l.includes("|") ? "|" : ",").map(x => x.trim()); }
form("obe-paste-plo", (d, f) => {
  const p = IDX.prog.get(Number(f.dataset.id)); const o = obeOf(p); const tqf = o.framework === "TQF6";
  const lines = (d.rows || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean); const out = []; const bad = [];
  lines.forEach((l, i) => { const c = splitRow(l); let [code, text, dom, crit, tool] = c.length === 1 ? [`${tqf ? "LO" : "PLO"}${i + 1}`, c[0]] : c;
    if (!text || text.length < 5) { bad.push(i + 1); return; }
    let domain = (dom || "").toUpperCase(), domainTh = "";
    if (tqf && /^[1-6]$/.test(dom || "")) { [domain, domainTh] = TQF6_DOM[Number(dom) - 1]; domainTh = domainTh.replace(/^\d /, ""); }
    if (!["K", "S", "E", "C"].includes(domain)) domain = "K";
    out.push({ code: code.replace(/\s+/g, ""), text, domain, domainTh: domainTh || undefined, type: domain === "K" || domain === "S" ? "Specific" : "Generic", level: "", criteria: crit || "", tool: tool || "", subs: [] }); });
  if (!out.length || bad.length) { formErrors(f, { rows: bad.length ? `บรรทัด ${bad.join(", ")} ไม่มีข้อความ (อย่างน้อย 5 ตัวอักษร)` : "ไม่มีข้อมูล" }); return; }
  const dup = out.map(x => x.code).filter((c, i, a) => a.indexOf(c) !== i); if (dup.length) { formErrors(f, { rows: `รหัสซ้ำ: ${[...new Set(dup)].join(", ")}` }); return; }
  if (d.mode === "REPLACE") { o.plos = out; const keep = new Set(out.map(x => x.code)); Object.values(o.mapping).forEach(m => Object.keys(m).forEach(k => { if (!keep.has(k)) delete m[k]; })); o.attain = {}; }
  else out.forEach(x => { const i = o.plos.findIndex(y => y.code === x.code); if (i >= 0) o.plos[i] = Object.assign(o.plos[i], x); else o.plos.push(x); });
  obeTouched(o, "PLO"); obeLog(o, `นำเข้า PLO ${out.length} ข้อ (${d.mode === "REPLACE" ? "แทนที่ทั้งหมด" : "เพิ่ม/แทนที่"})`); o.published = false;
  audit("นำเข้า PLO", `${p.code} ${out.length} ข้อ`); persist(); closeModal(); toast(`นำเข้า ${out.length} ข้อแล้ว`); rerender();
});
act("obe-paste-map", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const tqf = o.framework === "TQF6";
  openModal("นำเข้า curriculum mapping แบบวาง", `<form data-form="obe-paste-map" data-id="${p.id}"><p class="small">บรรทัดแรกเป็นหัวตาราง: <b>รหัสวิชา</b> ตามด้วยรหัส PLO แต่ละคอลัมน์ · ช่องใช้ ${tqf ? "● (หรือ 1/x = หลัก) และ ○ (หรือ 2/o = รอง)" : "I / R / M"} · เว้นว่าง = ไม่เกี่ยวข้อง</p>
    ${field("rows", "ตาราง", { type: "textarea", rows: 12, full: true, required: true, placeholder: `รหัสวิชา\t${o.plos.slice(0, 3).map(x => x.code).join("\t") || "PLO1\tPLO2"}\n30004104\t${tqf ? "●\t○" : "I\tR"}` })}
    ${field("mode", "วิธีนำเข้า", { type: "select", options: [["MERGE", "แทนที่เฉพาะรายวิชาที่อยู่ในตาราง"], ["REPLACE", "แทนที่ mapping ทั้งหมด"]], blank: false })}
    <div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">นำเข้า</button></div></form>`, { wide: true });
});
form("obe-paste-map", (d, f) => {
  const p = IDX.prog.get(Number(f.dataset.id)); const o = obeOf(p); const tqf = o.framework === "TQF6";
  const lines = (d.rows || "").split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) { formErrors(f, { rows: "ต้องมีหัวตารางและอย่างน้อย 1 รายวิชา" }); return; }
  const head = splitRow(lines[0]).slice(1); const known = new Set(o.plos.map(x => x.code)); const unk = head.filter(h => !known.has(h));
  if (unk.length) { formErrors(f, { rows: `ไม่พบ PLO ${unk.join(", ")} — นำเข้า PLO ก่อน` }); return; }
  const norm = v => { v = (v || "").trim(); if (!v) return ""; if (tqf) return /^(●|1|x|X|หลัก)$/.test(v) ? "●" : /^(○|2|o|O|รอง)$/.test(v) ? "○" : null; v = v.toUpperCase(); return ["I", "R", "M"].includes(v) ? v : null; };
  const res = {}; const bad = [];
  lines.slice(1).forEach((l, i) => { const c = splitRow(l); const code = (c[0] || "").replace(/\s+/g, ""); if (!/^\w{4,12}$/.test(code)) { bad.push(`บรรทัด ${i + 2} รหัสวิชา`); return; } const m = {};
    head.forEach((h, j) => { const v = norm(c[j + 1]); if (v === null) bad.push(`${code}/${h} "${c[j + 1]}"`); else if (v) m[h] = v; }); res[code] = m; });
  if (bad.length) { formErrors(f, { rows: `ค่าไม่ถูกต้อง: ${bad.slice(0, 6).join(", ")}${bad.length > 6 ? " …" : ""}` }); return; }
  if (d.mode === "REPLACE") o.mapping = {}; Object.assign(o.mapping, res);
  const unknownCourses = Object.keys(res).filter(c => !IDX.course.get(c));
  obeTouched(o, "mapping"); obeLog(o, `นำเข้า mapping ${Object.keys(res).length} รายวิชา`); o.published = false;
  audit("นำเข้า mapping", `${p.code} ${Object.keys(res).length} วิชา`); persist(); closeModal(); toast(`นำเข้า ${Object.keys(res).length} รายวิชา${unknownCourses.length ? ` · ไม่พบในคลังรายวิชา ${unknownCourses.length} รหัส` : ""}`); rerender();
});
act("obe-obj", el => { const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p);
  openModal("วัตถุประสงค์ของหลักสูตร", `<form data-form="obe-obj" data-id="${p.id}">${field("rows", "หนึ่งบรรทัดต่อหนึ่งข้อ", { type: "textarea", rows: 8, full: true, value: (o.objectives || []).join("\n") })}<div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`, { wide: true }); });
form("obe-obj", (d, f) => { const o = obeOf(IDX.prog.get(Number(f.dataset.id))); o.objectives = (d.rows || "").split(/\r?\n/).map(x => x.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean); obeTouched(o, "วัตถุประสงค์"); obeLog(o, `บันทึกวัตถุประสงค์ ${o.objectives.length} ข้อ`); persist(); closeModal(); rerender(); });
act("obe-ylo", el => { const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p);
  openModal("YLO รายชั้นปี", `<form data-form="obe-ylo" data-id="${p.id}"><p class="small">หนึ่งบรรทัดต่อชั้นปี: <b>ชั้นปี | ข้อความ | PLO ที่เกี่ยวข้อง (คั่นด้วย ,)</b></p>${field("rows", "YLO", { type: "textarea", rows: 6, full: true, value: o.ylo.map(y => `${y.year} | ${y.text} | ${(y.plos || []).join(",")}`).join("\n") })}<div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`, { wide: true }); });
form("obe-ylo", (d, f) => {
  const o = obeOf(IDX.prog.get(Number(f.dataset.id))); const known = new Set(o.plos.map(x => x.code)); const bad = [];
  const ylo = (d.rows || "").split(/\r?\n/).filter(l => l.trim()).map((l, i) => { const [y, t, ps] = l.split("|").map(x => (x || "").trim()); if (!/^[1-8]$/.test(y) || !t) bad.push(i + 1); const plos = (ps || "").split(/[,\s]+/).filter(Boolean); plos.filter(x => !known.has(x)).forEach(x => bad.push(`${i + 1}:${x}`)); return { year: Number(y), text: t, plos }; });
  if (!formErrors(f, bad.length ? { rows: `บรรทัดไม่ถูกต้อง: ${bad.join(", ")}` } : {})) return;
  o.ylo = ylo; obeTouched(o, "YLO"); obeLog(o, `บันทึก YLO ${ylo.length} ชั้นปี`); persist(); closeModal(); rerender();
});
act("obe-fill", el => { const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const c = obeCoverage(p); c.missing.forEach(x => { o.mapping[x] = {}; }); obeTouched(o, "รายวิชา"); obeLog(o, `เติมรายวิชาจากโครงสร้าง ${c.missing.length} วิชา`); persist(); toast(`เติม ${c.missing.length} วิชา — กำหนดระดับในตาราง`); rerender(); });
act("obe-trim", el => { const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const c = obeCoverage(p); c.extra.forEach(x => { delete o.mapping[x]; }); obeTouched(o, "รายวิชา"); obeLog(o, `นำวิชานอกโครงสร้างออก ${c.extra.length} วิชา`); persist(); rerender(); });
act("obe-csv", el => { const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const pc = o.plos.map(x => x.code);
  saveFile(`mapping-${p.code}.csv`, csv(Object.entries(o.mapping), [{ th: "รหัสวิชา", val: x => x[0] }, { th: "ชื่อวิชา", val: x => (IDX.course.get(x[0]) || {}).th || "" }].concat(pc.map(c => ({ th: c, val: x => x[1][c] || "" }))))); });

/* ---------- ส่งตรวจ / ยืนยัน ---------- */
act("obe-submit", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const errs = [];
  if (!o.source) errs.push("ระบุเล่มที่ใช้อ้างอิง (ข้อมูลตัวอย่างต้องนำเข้าจากเล่มจริงก่อน)"); if (!o.plos.length) errs.push("ยังไม่มี PLO"); if (!Object.values(o.mapping).some(m => Object.keys(m).length)) errs.push("ยังไม่มี mapping");
  if (errs.length) { openModal("ยังส่งตรวจไม่ได้", `<ul class="bul">${errs.map(e => `<li>${esc(e)}</li>`).join("")}</ul><div class="form-foot">${btn("ปิด", "close-modal")}</div>`); return; }
  o.dataStatus = "SUBMITTED"; obeLog(o, "ส่งส่วนกลางตรวจ"); notifyRole("CC", null, `ตรวจ PLO/mapping ${progTitle(p, true)} กับเล่ม มคอ.2`, `program-${p.id}-obe`); audit("ส่งตรวจ OBE", p.code); persist(); toast("ส่งเจ้าหน้าที่หลักสูตรส่วนกลางแล้ว"); rerender();
});
act("obe-verify", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const cov = obeCoverage(p);
  openModal(`ตรวจ PLO/mapping กับเล่ม — ${progTitle(p, true)}`, `<form data-form="obe-verify" data-id="${p.id}">${kv([["เล่มอ้างอิง", esc(o.source || "—") + (o.sourceUrl ? ` · <a href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">เปิด</a>` : "")], ["PLO", o.plos.length], ["mapping", `${cov.mapped} วิชา${cov.missing.length ? ` (ขาด ${cov.missing.length} วิชาในโครงสร้าง)` : ""}`]])}
    <fieldset class="field full"><legend>รายการตรวจ</legend><div class="checks">${["ข้อความ PLO ตรงกับเล่ม", "รายวิชาและระดับใน mapping ตรงกับเล่ม", "YLO/วัตถุประสงค์ตรงกับเล่ม (ถ้ามี)"].map((t, i) => `<label><input type="checkbox" name="chk" value="${i}"> ${t}</label>`).join("")}</div><span class="err" data-err="chk"></span></fieldset>
    ${field("result", "ผล", { type: "select", options: [["OK", "ยืนยันตรงกับเล่ม"], ["RETURN", "ส่งกลับให้คณะแก้"]], blank: false })}${field("note", "ข้อสังเกต (จำเป็นเมื่อส่งกลับ)", { type: "textarea", rows: 2, full: true })}
    <div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึกผล</button></div></form>`);
});
form("obe-verify", (d, f) => {
  const p = IDX.prog.get(Number(f.dataset.id)); const o = obeOf(p); const chk = $$('input[name="chk"]:checked', f).map(i => i.value);
  if (d.result === "OK" && chk.length < 3) { formErrors(f, { chk: "ตรวจให้ครบทุกข้อก่อนยืนยัน" }); return; } if (d.result === "RETURN" && !d.note) { formErrors(f, { note: "ระบุสิ่งที่ต้องแก้" }); return; }
  if (d.result === "OK") { o.dataStatus = "VERIFIED"; o.verifiedBy = S.user; o.verifiedAt = today(); obeLog(o, "ส่วนกลางยืนยันตรงกับเล่ม" + (d.note ? ` (${d.note})` : "")); }
  else { o.dataStatus = "DRAFT"; obeLog(o, `ส่งกลับ: ${d.note}`); notifyRole("FC", p.fac, `PLO/mapping ${progTitle(p, true)} ถูกส่งกลับ: ${d.note}`, `program-${p.id}-obe`); }
  audit(d.result === "OK" ? "ยืนยัน OBE" : "ส่งกลับ OBE", p.code); persist(); closeModal(); toast(d.result === "OK" ? "ยืนยันแล้ว" : "ส่งกลับคณะแล้ว"); rerender();
});
/* แก้ไขในตาราง/แบบฟอร์มเดิม → สถานะกลับเป็นร่างเมื่อยืนยันแล้ว */
["map-cycle"].forEach(k => { const a = ACTIONS[k]; ACTIONS[k] = el => { const o = obeOf(IDX.prog.get(Number(el.dataset.id))); a(el); if (o) { obeTouched(o, "mapping"); persist(); } }; });
["plo-save", "vos-save"].forEach(k => { const a = FORMS[k]; FORMS[k] = (d, f) => { const o = obeOf(IDX.prog.get(Number(f.dataset.id))); const before = o && o.dataStatus; a(d, f); if (o && $("#modal").hidden) { obeTouched(o, k === "plo-save" ? "PLO" : "VOS"); if (before !== o.dataStatus) persist(); } }; });
(function () { const g = NAV.find(x => x[0] === "ข้อมูลวิชาการ")[1]; g.splice(1, 0, ["obereg", "PLO และ curriculum mapping", "obe.view"]); })();
