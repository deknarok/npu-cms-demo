/* structure.js — G05: CMS เป็นเจ้าของโครงสร้างรายหมวดและแผนการเรียน (ระบบทะเบียนรับจาก CMS — D13)
   หน้า "โครงสร้างและแผนการเรียน" · แก้ไขโครงสร้างฉบับปัจจุบันได้ในโหมดบันทึกข้อมูล (ไม่ใช่การปรับปรุงหลักสูตร) · แผนการเรียนรายภาค · นำเข้าแบบวาง · ยืนยันเพื่อส่ง REG */
"use strict";

const STRUCT_SRC = { TEMPLATE: ["ร่างตามระเบียบ (ยังไม่มีรายวิชา)", "warn"], TQF2_PDF: ["จากเล่ม มคอ.2", "info"], CMS: ["ยืนยันใน CMS", "good"] };
/* ใครแก้ได้: FC ของคณะ (หรือ CC) — ร่างฉบับใหม่ หรือฉบับปัจจุบันที่ยังไม่ยืนยันโครงสร้าง (บันทึกข้อมูลเข้าระบบ) */
function canStruct(p) {
  if (!can("structure.edit") || !(myFac(p) || me().scope.type === "UNIVERSITY")) return false;
  const s = structureOf(p); return editable(p) || !s || s.source !== "CMS";
}
function structStatus(p) { const s = structureOf(p); return s ? (s.source || "CMS") : null; }

/* ---------- หน้าจัดการรวม ---------- */
route("structures", { perm: "program.view", title: "โครงสร้างและแผนการเรียน", render() {
  const f = S.filters.st || {};
  const rows = D.programs.filter(inScope).filter(p => p.life !== "CLOSED" && (!f.fac || p.fac === f.fac) && (!f.src || (structStatus(p) || "NONE") === f.src))
    .map(p => { const s = structureOf(p); const pl = D.design.studyPlans[p.id] || []; const v = activeVer(p); return { p, s, v, pl, n: s ? new Set(treeCourses(s)).size : 0, inPlan: new Set(pl.flatMap(t => t.courses)).size }; });
  const cnt = k => rows.filter(x => (structStatus(x.p) || "NONE") === k).length; const pg = paged("st", rows, 30);
  return pageHead("โครงสร้างหลักสูตรและแผนการเรียน", { lead: "CMS เป็นต้นทางของโครงสร้างรายหมวด รายวิชา และแผนการเรียน → ส่งให้ระบบทะเบียนผ่านชุดข้อมูลหลักสูตร (D13) · หลักสูตรเดิมให้เจ้าหน้าที่หลักสูตรคณะ/วิทยาลัยบันทึกจากเล่มแล้วกด “ยืนยันโครงสร้าง” (G05)" }) +
    `<div class="grid g4">${[["CMS", "ยืนยันแล้ว"], ["TQF2_PDF", "จากเล่ม มคอ.2"], ["TEMPLATE", "ร่างตามระเบียบ"], ["NONE", "ยังไม่มี"]].map(([k, t]) => `<div class="panel stat"><span class="label">${t}</span><span class="value">${cnt(k)}</span></div>`).join("")}</div>
    <section class="panel"><header><form class="filters" data-form="st-filter" style="width:100%"><select name="fac" aria-label="คณะ"><option value="">ทุกคณะ</option>${D.meta.faculties.map(x => `<option value="${x.id}"${f.fac === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <select name="src" aria-label="สถานะ"><option value="">ทุกสถานะ</option>${Object.entries(STRUCT_SRC).map(([k, v]) => `<option value="${k}"${f.src === k ? " selected" : ""}>${v[0]}</option>`).join("")}<option value="NONE"${f.src === "NONE" ? " selected" : ""}>ยังไม่มี</option></select><button class="btn primary" type="submit">กรอง</button></form></header></section>` +
    panel(`${fmt(rows.length)} หลักสูตร`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.p.id}-structure">${esc(progTitle(x.p, true))}</a><br><span class="muted small">ฉบับ พ.ศ. ${x.v.year} · ${x.v.credits} นก.</span>` },
      { th: "โครงสร้าง", html: x => x.s ? pillOf(STRUCT_SRC, x.s.source || "CMS") : pill("ยังไม่มี", "bad") }, { th: "หน่วยกิตขั้นต่ำ", num: true, html: x => x.s ? `${x.s.min}${x.s.min < x.v.credits ? " " + pill("ต่ำกว่าฉบับ", "warn") : ""}` : "—" },
      { th: "รายวิชาในโครงสร้าง", num: true, val: x => x.n || "—" }, { th: "แผนการเรียน", html: x => x.pl.length ? `${x.pl.length} ภาค · ${x.inPlan} วิชา` : pill("ยังไม่มี", "warn") },
      { th: "REG", html: x => { const k = D.reg && D.reg.packages && D.reg.packages[`PV-${x.v.id}`]; return k ? pillOf(PKG_STATUS, k.status) : `<span class="muted small">—</span>`; } },
      { th: "", html: x => `<span class="actions"><a class="btn sm" href="#program-${x.p.id}-structure">โครงสร้าง</a><a class="btn sm" href="#program-${x.p.id}-plan">แผน</a></span>` }], pg.rows), { flush: true }) + pg.pager;
} });
form("st-filter", d => { S.filters.st = d; S.ui["pg-st"] = 1; rerender(); });
(function () { const g = NAV.find(x => x[0] === "หลักสูตร")[1]; g.splice(1, 0, ["structures", "โครงสร้างและแผนการเรียน", "program.view"]); })();

/* ---------- แท็บโครงสร้าง: ยืนยัน + โหมดบันทึกข้อมูล ---------- */
const _ptabStructure = PTAB.structure;
PTAB.structure = p => {
  const s = structureOf(p); const html = _ptabStructure(p);
  if (!s) return html;
  const v = latestVer(p); const n = new Set(treeCourses(s)).size;
  const bar = `<div class="note ${s.source === "CMS" ? "" : "warn"}">${pillOf(STRUCT_SRC, s.source || "CMS")} ${s.source !== "CMS" && !editable(p) && canStruct(p) ? "โหมด<b>บันทึกข้อมูลฉบับปัจจุบัน</b> — เพิ่มรายวิชาตามเล่มที่อนุมัติแล้ว ไม่ถือเป็นการปรับปรุงหลักสูตร" : ""}
    ${s.confirmedBy ? ` · ยืนยันโดย ${esc(userName(s.confirmedBy))} ${thDate(s.confirmedAt)}` : ""}
    <span class="actions">${canStruct(p) && s.source !== "CMS" ? btn("ยืนยันโครงสร้าง (ใช้ส่งระบบทะเบียน)", "struct-confirm", { sm: true, kind: "primary", data: { id: p.id } }) : ""}${canStruct(p) ? btn("นำเข้ารายวิชา (วางข้อมูล)", "struct-paste", { sm: true, data: { id: p.id } }) : ""}${btn("ส่งออก CSV", "struct-csv", { sm: true, data: { id: p.id } })}</span></div>`;
  return bar + html.replace(lockNote(p), s.source !== "CMS" && canStruct(p) ? "" : lockNote(p));
};
act("struct-confirm", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const s = structureOf(p); const v = activeVer(p); const n = treeCourses(s).length;
  const errs = []; if (!n) errs.push("ยังไม่มีรายวิชาในโครงสร้าง"); if (s.min < v.credits) errs.push(`หน่วยกิตขั้นต่ำรวม ${s.min} น้อยกว่าฉบับ (${v.credits})`);
  const miss = treeCourses(s).filter(c => !IDX.course.has(c)); if (miss.length) errs.push(`รหัสวิชาไม่อยู่ในคลัง: ${miss.slice(0, 5).join(", ")}`);
  if (errs.length) { openModal("ยังยืนยันไม่ได้", `<ul class="bul">${errs.map(x => `<li>${esc(x)}</li>`).join("")}</ul><div class="form-foot">${btn("ปิด", "close-modal")}</div>`); return; }
  confirmTyped("ยืนยันโครงสร้างหลักสูตร", `ยืนยันโครงสร้าง ${esc(progTitle(p, true))} (${n} รายวิชา) — ระบบจะสร้างชุดข้อมูลส่งระบบทะเบียน และล็อกโครงสร้าง (แก้ต่อผ่าน สมอ.08/ฉบับปรับปรุง)`, p.code, () => {
    Object.assign(s, { source: "CMS", confirmedBy: S.user, confirmedAt: today() }); audit("ยืนยันโครงสร้างหลักสูตร", p.code);
    notifyRole("RG", null, `โครงสร้างหลักสูตรยืนยันแล้ว รอส่งระบบทะเบียน: ${progTitle(p, true)}`, "regsync"); persist(); toast("ยืนยันโครงสร้างแล้ว — แจ้งนายทะเบียนส่งระบบทะเบียน"); rerender();
  });
});
function flatNodes(n, path = [], out = []) { out.push({ path: path.join("."), title: n.title, depth: path.length }); (n.children || []).forEach((c, i) => flatNodes(c, path.concat(i), out)); return out; }
act("struct-paste", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const nodes = flatNodes(structureOf(p));
  openModal("นำเข้ารายวิชาเข้าโครงสร้าง", `<form data-form="struct-paste" data-id="${p.id}">${field("node", "หมวด/กลุ่มที่จะใส่", { type: "select", options: nodes.map(x => [x.path, "— ".repeat(x.depth) + x.title]), required: true, full: true })}
    ${field("codes", "รหัสวิชา (บรรทัดละรหัส หรือคั่นด้วยจุลภาค/ช่องว่าง — คัดลอกจากเล่ม/Excel ได้)", { type: "textarea", required: true, full: true, rows: 6 })}
    <div class="note">ตรวจกับคลังรายวิชา (ระบบทะเบียน + รายวิชาใหม่ใน CMS) — รหัสที่ไม่พบจะแสดงให้แก้ ไม่ถูกนำเข้า</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">นำเข้า</button></div></form>`, { wide: true });
});
form("struct-paste", (d, f) => {
  const p = IDX.prog.get(Number(f.dataset.id)); const codes = [...new Set((d.codes || "").replace(/[๐-๙]/g, ch => "๐๑๒๓๔๕๖๗๘๙".indexOf(ch)).match(/\d{8}/g) || [])];
  if (!codes.length) { formErrors(f, { codes: "ไม่พบรหัสวิชา 8 หลัก" }); return; }
  const ok = codes.filter(c => IDX.course.has(c)); const bad = codes.filter(c => !IDX.course.has(c));
  const n = nodeAt(p, d.node); n.courses = n.courses || []; const before = new Set(treeCourses(structureOf(p)));
  ok.forEach(c => { if (!before.has(c)) n.courses.push(c); });
  audit("นำเข้ารายวิชาเข้าโครงสร้าง", `${p.code} ${ok.length}`); persist(); closeModal();
  toast(`นำเข้า ${ok.filter(c => !before.has(c)).length} วิชา${bad.length ? ` · ไม่พบในคลัง ${bad.length} รหัส: ${bad.slice(0, 4).join(", ")}` : ""}${ok.length - ok.filter(c => !before.has(c)).length ? ` · ซ้ำ ${ok.length - ok.filter(c => !before.has(c)).length}` : ""}`); rerender();
});
act("struct-csv", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const rows = [];
  (function walk(n, path) { (n.courses || []).forEach(c => rows.push({ path: path.concat(n.title).join(" > "), min: n.min, code: c })); (n.children || []).forEach(ch => walk(ch, path.concat(n.title))); })(structureOf(p), []);
  saveFile(`โครงสร้าง-${p.code}.csv`, csv(rows, [{ th: "หมวด/กลุ่ม", val: r => r.path }, { th: "หน่วยกิตขั้นต่ำกลุ่ม", val: r => r.min }, { th: "รหัสวิชา", val: r => r.code }, { th: "ชื่อวิชา", val: r => (IDX.course.get(r.code) || {}).th }, { th: "หน่วยกิต", val: r => (IDX.course.get(r.code) || {}).cr }]));
});

/* ---------- แผนการเรียน: แก้ไขได้ ---------- */
PTAB.plan = p => {
  const ed = canStruct(p); const s = structureOf(p); const inTree = new Set(s ? treeCourses(s) : []);
  const plan = D.design.studyPlans[p.id];
  if (!plan) return `<div class="note warn">ยังไม่มีแผนการเรียน ${gapPill("G05")}</div>` + (ed ? `<div class="actions">${btn("สร้างแผนการเรียนว่าง (ตามระยะเวลาหลักสูตร)", "plan-new", { kind: "primary", data: { id: p.id } })}</div>` : "");
  const used = new Set(plan.flatMap(t => t.courses)); const notIn = [...used].filter(c => !inTree.has(c)); const left = [...inTree].filter(c => !used.has(c));
  return (ed ? "" : lockNote(p)) + `<div class="actions">${ed ? btn("+ ภาคการศึกษา", "plan-term", { sm: true, data: { id: p.id } }) + btn("นำเข้าแผน (วางข้อมูล)", "plan-paste", { sm: true, data: { id: p.id } }) : ""}${btn("ส่งออก CSV", "plan-csv", { sm: true, data: { id: p.id } })}</div>` +
    (notIn.length ? `<div class="note bad">รายวิชาในแผนที่ไม่อยู่ในโครงสร้าง: ${notIn.join(", ")}</div>` : `<div class="note">ทุกรายวิชาในแผนอยู่ในโครงสร้าง${left.length ? ` · รายวิชาในโครงสร้างที่ยังไม่ลงแผน ${left.length} วิชา (เช่น วิชาเลือก)` : ""}</div>`) +
    `<div class="grid g2">${plan.map((t, i) => { const cr = t.courses.reduce((a, c) => a + ((IDX.course.get(c) || {}).c || 0), 0);
      return panel(`ปีที่ ${t.year} ภาคการศึกษาที่ ${t.term}`, table([{ th: "รหัส", html: c => `<span class="mono">${esc(c)}</span>` }, { th: "รายวิชา", html: c => `<a href="#" data-act="course-open" data-id="${esc(c)}">${esc((IDX.course.get(c) || {}).th || "")}</a>` }, { th: "นก.", val: c => (IDX.course.get(c) || {}).cr || "" },
        { th: "", html: c => ed ? `<button class="link-btn" data-act="plan-remove" data-id="${p.id}" data-i="${i}" data-code="${esc(c)}">นำออก</button>` : "" }], t.courses, { empty: "ยังไม่มีรายวิชา" }) + (ed ? `<div class="body">${btn("+ รายวิชา", "plan-add", { sm: true, data: { id: p.id, i } })}</div>` : ""),
        { flush: true, actions: `<span class="muted small">รวม ${cr} หน่วยกิต ${cr > 22 ? pill("เกิน 22 (ระเบียบ ข้อ 33.2)", "warn") : ""}</span>` }); }).join("")}</div>`;
};
act("plan-new", el => { const p = IDX.prog.get(Number(el.dataset.id)); const yrs = activeVer(p).years || 4; D.design.studyPlans[p.id] = []; for (let y = 1; y <= yrs; y++) for (let t = 1; t <= 2; t++) D.design.studyPlans[p.id].push({ year: y, term: t, courses: [] }); persist(); rerender(); });
act("plan-term", el => { const pl = D.design.studyPlans[el.dataset.id]; const last = pl[pl.length - 1] || { year: 0, term: 2 }; pl.push(last.term >= 2 ? { year: last.year + 1, term: 1, courses: [] } : { year: last.year, term: last.term + 1, courses: [] }); persist(); rerender(); });
act("plan-remove", el => { const t = D.design.studyPlans[el.dataset.id][Number(el.dataset.i)]; t.courses = t.courses.filter(c => c !== el.dataset.code); persist(); rerender(); });
act("plan-add", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const s = structureOf(p); const used = new Set(D.design.studyPlans[p.id].flatMap(t => t.courses));
  const opts = s ? [...new Set(treeCourses(s))].filter(c => !used.has(c)) : [];
  openModal("เพิ่มรายวิชาในภาคการศึกษา", opts.length ? `<form data-form="plan-add" data-id="${p.id}" data-i="${el.dataset.i}">${field("code", "รายวิชาจากโครงสร้าง (ยังไม่ลงแผน)", { type: "select", options: opts.map(c => [c, `${c} ${(IDX.course.get(c) || {}).th || ""} ${(IDX.course.get(c) || {}).cr || ""}`]), required: true, full: true })}<div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">เพิ่ม</button></div></form>` : `<div class="empty">ทุกรายวิชาในโครงสร้างลงแผนแล้ว หรือยังไม่มีรายวิชาในโครงสร้าง</div>`);
});
form("plan-add", (d, f) => { if (!d.code) { formErrors(f, { code: "เลือกรายวิชา" }); return; } D.design.studyPlans[f.dataset.id][Number(f.dataset.i)].courses.push(d.code); persist(); closeModal(); rerender(); });
act("plan-paste", el => openModal("นำเข้าแผนการเรียน", `<form data-form="plan-paste" data-id="${el.dataset.id}">${field("rows", "บรรทัดละ: รหัสวิชา, ปี, ภาค (เช่น 30119306,3,1) — คัดลอกจาก Excel ได้", { type: "textarea", required: true, full: true, rows: 8 })}<div class="note">แทนที่แผนเดิมของรายวิชาที่ระบุ · ตรวจว่าอยู่ในโครงสร้าง</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">นำเข้า</button></div></form>`, { wide: true }));
form("plan-paste", (d, f) => {
  const p = IDX.prog.get(Number(f.dataset.id)); const s = structureOf(p); const inTree = new Set(s ? treeCourses(s) : []); const pl = D.design.studyPlans[p.id]; let n = 0; const bad = [];
  (d.rows || "").split(/\n/).map(l => l.split(/[,\t;]/).map(x => x.trim())).filter(r => r.length >= 3 && /^\d{8}$/.test(r[0])).forEach(([c, y, t]) => {
    if (!inTree.has(c)) { bad.push(c); return; } pl.forEach(x => { x.courses = x.courses.filter(z => z !== c); });
    let term = pl.find(x => x.year === Number(y) && x.term === Number(t)); if (!term) { term = { year: Number(y), term: Number(t), courses: [] }; pl.push(term); pl.sort((a, b) => a.year - b.year || a.term - b.term); }
    term.courses.push(c); n++; });
  audit("นำเข้าแผนการเรียน", `${p.code} ${n}`); persist(); closeModal(); toast(`นำเข้า ${n} รายการ${bad.length ? ` · ไม่อยู่ในโครงสร้าง ${bad.length}: ${bad.slice(0, 4).join(", ")}` : ""}`); rerender();
});
act("plan-csv", el => { const p = IDX.prog.get(Number(el.dataset.id)); const rows = (D.design.studyPlans[p.id] || []).flatMap(t => t.courses.map(c => ({ c, y: t.year, t: t.term })));
  saveFile(`แผนการเรียน-${p.code}.csv`, csv(rows, [{ th: "รหัสวิชา", val: r => r.c }, { th: "ปี", val: r => r.y }, { th: "ภาค", val: r => r.t }, { th: "ชื่อวิชา", val: r => (IDX.course.get(r.c) || {}).th }, { th: "หน่วยกิต", val: r => (IDX.course.get(r.c) || {}).cr }])); });
