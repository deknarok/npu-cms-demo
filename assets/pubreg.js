/* pubreg.js — G10 ผลงานวิชาการของอาจารย์ (5 ปีย้อนหลัง) รายหลักสูตร
   ERP-HR ResearchWork ว่าง → CMS เป็นช่องทางบันทึก: คณะ (FC) บันทึกแทนอาจารย์พร้อมหลักฐาน → ผู้บริหารหน่วยงาน (UX) รับรอง
   → เข้าชุดข้อมูล "ส่ง ERP-HR" (outbox) → HR นำเข้า ResearchWork แล้วแจ้งรหัสกลับ → CMS กระทบยอดกับ ERP-HR (อ่านอย่างเดียว)
   CMS ไม่เขียนฐานข้อมูล HR ตรง (สิทธิ์ที่ได้รับ = อ่านอย่างเดียว schema erp_hr) — ERP-HR เป็นเจ้าของข้อมูลตาม D10 */
"use strict";

const PUB_ST = { DRAFT: ["ร่าง", "warn"], SUBMITTED: ["รอผู้บริหารหน่วยงานรับรอง", "info"], CERTIFIED: ["รับรองแล้ว", "good"], RETURNED: ["ส่งกลับแก้ไข", "warn"] };
const PUB_HR = { NONE: ["—", "neutral"], READY: ["รอส่ง HR", "warn"], SENT: ["ส่ง HR แล้ว รอนำเข้า", "info"], IN_HR: ["อยู่ใน ERP-HR แล้ว", "good"], REJECTED: ["HR ไม่รับ", "bad"] };
const PUB_TYPES = [["RESEARCH_ARTICLE", "บทความวิจัย"], ["ACADEMIC_ARTICLE", "บทความวิชาการ"], ["TEXTBOOK", "ตำรา"], ["BOOK", "หนังสือ"], ["CONFERENCE", "รายงานสืบเนื่องการประชุม (proceedings)"], ["PATENT", "สิทธิบัตร/อนุสิทธิบัตร"], ["CREATIVE", "งานสร้างสรรค์"], ["OTHER_WORK", "ผลงานรับใช้สังคม/อื่น ๆ"]];
const PUB_DB = ["TCI1", "TCI2", "Scopus Q1", "Scopus Q2", "Scopus Q3", "Scopus Q4", "Web of Science", "ERIC/PubMed", "ไม่อยู่ในฐาน", "-"];
function pubWindow() { const y = Number(today().slice(0, 4)) + 543; const n = Number(settingVal("publication.window_years", 5)) || 5; return [y - n + 1, y]; }
function pubsOf(staff) { return IDX.pubsByStaff.get(staff) || []; }
function pubHr(x) { return x.demo ? "NONE" : x.origin !== "CMS" ? "IN_HR" : (x.hr && x.hr.status) || (x.status === "CERTIFIED" ? "READY" : "NONE"); }
function progTeachers(p) { const seen = new Set(); return progResponsible(p).concat(progRegular(p)).filter(r => !seen.has(r.staff) && seen.add(r.staff)); }
/* ผู้บันทึกได้ 3 กลุ่ม (ผู้ใช้ 19 พ.ย. 2569): อาจารย์เจ้าของผลงาน · อาจารย์ผู้รับผิดชอบหลักสูตร (แทนอาจารย์ในหลักสูตรตน) · เจ้าหน้าที่หลักสูตรคณะ/วิทยาลัย */
function respProgsOfMe() { const u = me(); return u.staff ? (IDX.rolesByStaff.get(u.staff) || []).filter(r => r.role === "PROGRAM_RESPONSIBLE").map(r => r.prog) : []; }
function pubRecorderKind(staff) {
  const s = IDX.staff.get(staff); if (!s) return null; const u = me();
  if (can("publication.record") && (u.scope.type === "UNIVERSITY" || s.fac === u.scope.fac)) return "FC";
  if (u.staff && u.staff === staff && can("publication.own")) return "SELF";
  if (u.staff && respProgsOfMe().some(pid => progTeachers(IDX.prog.get(pid)).some(r => r.staff === staff))) return "RESP";
  return null;
}
function canPubRecord(staff) { return !!pubRecorderKind(staff); }
const REC_KIND = { FC: "เจ้าหน้าที่หลักสูตรคณะ", SELF: "อาจารย์เจ้าของผลงาน", RESP: "อาจารย์ผู้รับผิดชอบหลักสูตร" };
function pubSrc(x) { return x.demo ? "DEMO" : x.origin === "CMS" ? "CMS" : "HR"; }
const PUB_SRC = { HR: ["ERP-HR", "good"], CMS: ["บันทึกใน CMS", "info"], DEMO: ["จำลอง", "neutral"] };
function canPubCertify(staff) { const s = IDX.staff.get(staff); return can("publication.certify") && s && (me().scope.type === "UNIVERSITY" || s.fac === me().scope.fac); }
/* แหล่งผลงาน: ERP-HR จริง / CMS บันทึก / ตัวอย่างจำลอง */
const _bi3 = buildIndex;
buildIndex = function () { _bi3(); const P = D.staffData.publications; const real = P.filter(x => !x.demo).length; D.pubSource = real && real === P.length ? "REAL" : real ? "MIXED" : P.length ? "DEMO" : "NONE"; };

route("pubreg", { perm: "program.view", title: "ผลงานวิชาการรายหลักสูตร", render(args) {
  if (args[0] === "hr") return pubHrPage();
  if (args[0]) return pubProgPage(Number(args[0]));
  const [y0, y1] = pubWindow(); const f = S.filters.pubr || {};
  const mine = me().staff && !can("publication.record") && !can("publication.certify") && me().scope.type === "SELF";
  const rows = D.programs.filter(inScope).filter(p => p.life !== "CLOSED" && (!f.fac || p.fac === f.fac) && (!mine || progTeachers(p).some(r => r.staff === me().staff))).map(p => {
    const T = progTeachers(p); const resp = progResponsible(p); const inW = s => pubsOf(s).filter(x => x.year >= y0 && x.year <= y1);
    return { p, T, resp, respOk: resp.filter(r => inW(r.staff).some(x => x.status === "CERTIFIED")).length, total: T.reduce((a, r) => a + inW(r.staff).length, 0), wait: T.reduce((a, r) => a + pubsOf(r.staff).filter(x => x.status === "SUBMITTED").length, 0), hr: T.reduce((a, r) => a + pubsOf(r.staff).filter(x => ["READY", "SENT"].includes(pubHr(x))).length, 0) };
  }).filter(x => x.T.length && (!f.only || (f.only === "gap" ? x.respOk < x.resp.length : x.wait)));
  const pg = paged("pubr", rows, 30); const P = D.staffData.publications;
  return pageHead("ผลงานวิชาการของอาจารย์รายหลักสูตร (G10)", { lead: `ผลงานย้อนหลัง ${y1 - y0 + 1} ปี (พ.ศ. ${y0}–${y1}) ของอาจารย์ผู้รับผิดชอบ/ประจำหลักสูตร · <b>มีใน ERP-HR</b> → เลือกแสดงและบันทึกเข้า "รอบรายงาน/ประเมิน" ของหลักสูตร · <b>ยังไม่มีใน HR</b> → อาจารย์เจ้าตัว อาจารย์ผู้รับผิดชอบหลักสูตร หรือเจ้าหน้าที่หลักสูตรคณะบันทึก → ผู้บริหารหน่วยงานรับรอง → แสดงในระบบหลักสูตรและส่งเพิ่มใน ERP-HR (CMS ไม่เขียนฐาน HR โดยตรง)`, actions: `<a class="btn" href="#pubreg-hr">ชุดข้อมูลส่ง ERP-HR (${P.filter(x => ["READY", "SENT"].includes(pubHr(x))).length})</a>` }) +
    `<div class="grid g4"><div class="panel stat"><span class="label">ผลงานในระบบ</span><span class="value">${fmt(P.length)}</span><span class="sub">ERP-HR ${fmt(P.filter(x => pubSrc(x) === "HR").length)} · บันทึกใน CMS ${fmt(P.filter(x => !x.demo).length)} · จำลอง ${fmt(P.filter(x => x.demo).length)}</span></div>
      <div class="panel stat"><span class="label">รอรับรอง</span><span class="value">${fmt(P.filter(x => x.status === "SUBMITTED").length)}</span></div>
      <div class="panel stat"><span class="label">รอเข้า ERP-HR</span><span class="value">${fmt(P.filter(x => ["READY", "SENT"].includes(pubHr(x))).length)}</span></div>
      <div class="panel stat"><span class="label">หลักสูตรที่ผู้รับผิดชอบมีผลงานครบทุกคน</span><span class="value">${fmt(rows.filter(x => x.resp.length && x.respOk === x.resp.length).length)}/${fmt(rows.length)}</span></div></div>
    ${me().staff ? myPubsPanel() : ""}
    ${D.pubSource !== "REAL" ? `<div class="note warn">ผลงานที่มีป้าย "จำลอง" ใช้เพื่อนำเสนอต้นแบบเท่านั้น (publication.demo_mode) — ไม่ส่ง ERP-HR และถูกแทนเมื่อมีข้อมูลจริง</div>` : ""}
    <section class="panel"><header><form class="filters" data-form="pubr-filter" style="width:100%"><select name="fac" aria-label="คณะ"><option value="">ทุกคณะ/วิทยาลัย</option>${D.meta.faculties.map(x => `<option value="${x.id}"${f.fac === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><select name="only" aria-label="สถานะ"><option value="">ทั้งหมด</option><option value="gap"${f.only === "gap" ? " selected" : ""}>ผู้รับผิดชอบยังมีผลงานไม่ครบ</option><option value="wait"${f.only === "wait" ? " selected" : ""}>มีผลงานรอรับรอง</option></select><button class="btn primary" type="submit">กรอง</button></form></header></section>` +
    panel(`${fmt(rows.length)} หลักสูตร`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#pubreg-${x.p.id}">${esc(progTitle(x.p, true))}</a><br><span class="muted small">${esc(IDX.fac.get(x.p.fac).name)}</span>` },
      { th: "อาจารย์", num: true, val: x => x.T.length }, { th: "ผู้รับผิดชอบที่มีผลงาน (รับรอง)", num: true, html: x => `${x.respOk}/${x.resp.length} ${x.resp.length && x.respOk < x.resp.length ? pill("ขาด", "warn") : ""}` },
      { th: `ผลงาน ${y0}–${y1}`, num: true, val: x => x.total }, { th: "รอรับรอง", num: true, val: x => x.wait || "" }, { th: "รอเข้า HR", num: true, val: x => x.hr || "" }, { th: "", html: x => `<a class="btn sm" href="#pubreg-${x.p.id}">เปิด</a>` }], pg.rows, { empty: "ไม่มีหลักสูตรที่มีอาจารย์ในขอบเขต" }), { flush: true }) + pg.pager;
} });
form("pubr-filter", d => { S.filters.pubr = d; S.ui["pg-pubr"] = 1; rerender(); });

function pubProgPage(pid) {
  const p = IDX.prog.get(pid); if (!p) return `<div class="note bad">ไม่พบหลักสูตร</div>`; const [y0, y1] = pubWindow(); const T = progTeachers(p);
  const rec = T.some(r => canPubRecord(r.staff));
  return pageHead(`ผลงานวิชาการ — ${progTitle(p, true)}`, { crumbs: `<a href="#pubreg">ผลงานวิชาการรายหลักสูตร</a>`, actions: (rec ? btn("+ บันทึกผลงาน", "pubr-new", { kind: "primary", data: { prog: p.id } }) : "") + `<a class="btn" href="#program-${p.id}-staff">ผลตรวจเกณฑ์ 2565</a>` + btn("CSV", "pubr-csv", { data: { prog: p.id } }) }) +
    pubRoundsPanel(p) + `<p class="muted small">ช่วงผลงาน พ.ศ. ${y0}–${y1} (ค่าตั้งค่า publication.window_years) · เกณฑ์ 2565: อาจารย์ผู้รับผิดชอบต้องมีผลงานอย่างน้อย 1 รายการใน 5 ปี · ใช้เฉพาะผลงานที่รับรองแล้ว</p>` +
    T.map(r => { const s = IDX.staff.get(r.staff); const L = pubsOf(r.staff).slice().sort((a, b) => b.year - a.year); const inW = L.filter(x => x.year >= y0 && x.year <= y1 && x.status === "CERTIFIED").length;
      return panel(`${staffName(r.staff)} — ${r.role === "PROGRAM_RESPONSIBLE" ? "ผู้รับผิดชอบหลักสูตร" : "อาจารย์ประจำหลักสูตร"}`, table([{ th: "ปี", val: x => x.year }, { th: "ผลงาน", wrap: true, html: x => `${esc(x.title)}<br><span class="muted small">${esc(x.venue)}${x.doi ? " · DOI " + esc(x.doi) : ""}${x.evidence ? " · หลักฐาน " + esc(x.evidence) : ""}</span>` },
        { th: "ประเภท", val: x => x.typeTh }, { th: "ฐาน", val: x => x.db }, { th: "แหล่ง", html: x => pillOf(PUB_SRC, pubSrc(x)) + (x.recBy ? `<br><span class="muted small">${esc(REC_KIND[x.recBy])}</span>` : "") }, { th: "สถานะ", html: x => pillOf(PUB_ST, x.status) + (x.year < y0 ? " " + pill("นอกช่วง", "neutral") : "") }, { th: "ERP-HR", html: x => pillOf(PUB_HR, pubHr(x)) },
        { th: "", html: x => `<span class="actions">${!x.demo && ["DRAFT", "RETURNED"].includes(x.status) && canPubRecord(x.staff) ? btn("แก้", "pubr-new", { sm: true, data: { prog: p.id, id: x.id } }) + btn("ส่งรับรอง", "pubr-submit", { sm: true, kind: "primary", data: { id: x.id } }) : ""}${x.status === "SUBMITTED" && canPubCertify(x.staff) ? btn("รับรอง", "pubr-cert", { sm: true, kind: "primary", data: { id: x.id, ok: 1 } }) + btn("ส่งกลับ", "pubr-cert", { sm: true, data: { id: x.id, ok: 0 } }) : ""}</span>` }], L, { empty: "ยังไม่มีผลงาน" }),
        { flush: true, actions: `<span class="muted small">${esc(s ? POS_TH[s.pos] || "" : "")} · รับรองในช่วง ${inW} รายการ</span> ${r.role === "PROGRAM_RESPONSIBLE" ? (inW ? pill("ผ่านข้อผลงาน", "good") : pill("ยังไม่มีผลงาน", "warn")) : ""}` }); }).join("");
}
act("pubr-new", el => {
  const p = IDX.prog.get(Number(el.dataset.prog)); const x = el.dataset.id ? D.staffData.publications.find(y => y.id === Number(el.dataset.id)) : {};
  const opts = progTeachers(p).filter(r => canPubRecord(r.staff)).map(r => [r.staff, staffName(r.staff)]);
  openModal(x.id ? "แก้ไขผลงานวิชาการ" : "บันทึกผลงานวิชาการที่ยังไม่มีใน ERP-HR", `<form data-form="pubr-save" data-prog="${p.id}" data-id="${x.id || ""}"><div class="form-grid">
    ${field("staff", "อาจารย์", { type: "select", options: opts, value: x.staff, required: true, full: true })}${field("title", "ชื่อผลงาน", { value: x.title, required: true, full: true })}
    ${field("authors", "ผู้แต่ง (ตามที่ตีพิมพ์)", { value: x.authors, full: true })}${field("role", "บทบาทของอาจารย์", { type: "select", options: [["FIRST", "ผู้แต่งหลัก/ชื่อแรก"], ["CORR", "ผู้ประพันธ์บรรณกิจ"], ["CO", "ผู้แต่งร่วม"]], value: x.role || "FIRST", blank: false })}
    ${field("type", "ประเภท (ก.พ.อ.)", { type: "select", options: PUB_TYPES, value: x.type, required: true })}${field("db", "ฐานข้อมูล", { type: "select", options: PUB_DB, value: x.db, required: true })}
    ${field("venue", "แหล่งเผยแพร่ (วารสาร/การประชุม/สำนักพิมพ์)", { value: x.venue, required: true, full: true })}${field("year", "ปีที่เผยแพร่ (พ.ศ.)", { type: "number", value: x.year || pubWindow()[1], required: true })}${field("doi", "DOI", { value: x.doi, placeholder: "10.xxxx/xxxx" })}
    ${field("evidence", "หลักฐาน (ลิงก์บทความ/เลขหน้า/ไฟล์)", { value: x.evidence, required: true, full: true })}</div>
    <div class="note">ใช้เฉพาะผลงานที่<b>ยังไม่มีใน ERP-HR</b> (ถ้ามีแล้ว ให้เลือกจากรายการ HR เข้ารอบรายงาน) · บันทึกเป็นร่าง → ส่งผู้บริหารหน่วยงานรับรอง → รับรองแล้วแสดงในระบบหลักสูตรทันทีและเข้าชุดข้อมูลส่งเพิ่มใน ERP-HR อัตโนมัติ</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึกเป็นร่าง</button></div></form>`, { wide: true });
});
form("pubr-save", (d, f) => {
  const errs = {}; ["staff", "title", "venue", "type", "db", "evidence"].forEach(k => { if (!d[k]) errs[k] = "จำเป็นต้องกรอก"; }); const [, y1] = pubWindow();
  if (!(Number(d.year) >= 2540 && Number(d.year) <= y1)) errs.year = `ปี พ.ศ. 2540–${y1}`; if (d.doi && !/^10\.\d{4,}\/\S+$/.test(d.doi)) errs.doi = "รูปแบบ DOI ไม่ถูกต้อง";
  if (d.staff && !canPubRecord(d.staff)) errs.staff = "ไม่มีสิทธิ์บันทึกผลงานของอาจารย์ท่านนี้";
  const dup = D.staffData.publications.find(x => !x.demo && x.id !== Number(f.dataset.id) && x.staff === d.staff && ((d.doi && x.doi === d.doi) || x.title.trim() === d.title.trim()));
  if (dup) errs.title = pubSrc(dup) === "HR" ? "ผลงานนี้มีใน ERP-HR แล้ว — ไม่ต้องบันทึกซ้ำ ให้เลือกเข้ารอบรายงาน/ประเมินแทน" : "มีผลงานนี้ของอาจารย์แล้ว (ชื่อ/DOI ซ้ำ)";
  if (!formErrors(f, errs)) return;
  const rec = { staff: d.staff, title: d.title, authors: d.authors, role: d.role, type: d.type, typeTh: (PUB_TYPES.find(t => t[0] === d.type) || [])[1], db: d.db, venue: d.venue, year: Number(d.year), doi: d.doi, evidence: d.evidence, research: d.type === "RESEARCH_ARTICLE", origin: "CMS", by: S.user, recBy: pubRecorderKind(d.staff), at: today() };
  const old = f.dataset.id ? D.staffData.publications.find(y => y.id === Number(f.dataset.id)) : null;
  if (old) Object.assign(old, rec, { status: "DRAFT" }); else D.staffData.publications.push(Object.assign({ id: Date.now(), status: "DRAFT", hr: null }, rec));
  buildIndex(); audit("บันทึกผลงานวิชาการ", `${d.staff} ${d.title}`); persist(); closeModal(); toast("บันทึกเป็นร่างแล้ว"); rerender();
});
act("pubr-submit", el => { const x = D.staffData.publications.find(y => y.id === Number(el.dataset.id)); x.status = "SUBMITTED"; notifyRole("UX", IDX.staff.get(x.staff).fac, `รับรองผลงาน ${staffName(x.staff)}: ${x.title}`, "pubreg"); persist(); toast("ส่งผู้บริหารหน่วยงานรับรองแล้ว"); rerender(); });
act("pubr-cert", el => { const x = D.staffData.publications.find(y => y.id === Number(el.dataset.id)); const ok = el.dataset.ok === "1";
  x.status = ok ? "CERTIFIED" : "RETURNED"; x.certBy = S.user; x.certAt = today(); if (ok && !x.demo) { x.hr = { status: "READY", at: today() }; hrHook("research-work.ready", x); }
  buildIndex(); audit(ok ? "รับรองผลงาน" : "ส่งกลับผลงาน", x.title); persist(); toast(ok ? "รับรองแล้ว — ใช้ตรวจเกณฑ์ได้ทันที และเข้าชุดข้อมูลส่ง ERP-HR" : "ส่งกลับให้คณะแก้ไข"); rerender(); });
act("pubr-csv", el => { const p = IDX.prog.get(Number(el.dataset.prog)); const rows = progTeachers(p).flatMap(r => pubsOf(r.staff).map(x => Object.assign({ _role: r.role }, x)));
  saveFile(`ผลงาน-${p.code}.csv`, csv(rows, [{ th: "รหัสบุคลากร", val: x => x.staff }, { th: "ชื่อ", val: x => staffName(x.staff) }, { th: "บทบาท", val: x => x._role }, { th: "ปี", val: x => x.year }, { th: "ผลงาน", val: x => x.title }, { th: "ประเภท", val: x => x.typeTh }, { th: "ฐาน", val: x => x.db }, { th: "แหล่ง", val: x => x.venue }, { th: "DOI", val: x => x.doi || "" }, { th: "สถานะ", val: x => x.status }, { th: "ERP-HR", val: x => pubHr(x) }, { th: "จำลอง", val: x => x.demo ? "Y" : "" }])); });

/* ---------- ชุดข้อมูลส่ง ERP-HR ---------- */
/* แปลงเป็นคอลัมน์ของ erp_hr."ResearchWork" (ตามที่อ่านได้: research_id staff_id title work_type_level1 work_subtype_level2 database_type_level2_2 journal_name published_year doi) */
function hrRow(x) { return { research_id: (x.hr && x.hr.researchId) || null, staff_id: x.staff, title: x.title, work_type_level1: x.type, work_subtype_level2: x.typeTh, database_type_level2_2: x.db, journal_name: x.venue, published_year: x.year, doi: x.doi || null, cms_ref: "CMS-PUB-" + x.id, evidence: x.evidence || null }; }
function pubHrPage() {
  const tab = S.ui.pubhrTab || "READY"; const ed = can("integ.manage"); const L = D.staffData.publications.filter(x => !x.demo && pubHr(x) !== "NONE"); const T = L.filter(x => pubHr(x) === tab);
  const pk = (D.staffData.hrPackages = D.staffData.hrPackages || []);
  const mode = hrMode();
  return pageHead("ผลงานส่ง ERP-HR (API)", { crumbs: `<a href="#pubreg">ผลงานวิชาการรายหลักสูตร</a>`, lead: "ผลงานที่ผู้บริหารหน่วยงานรับรองแล้วเข้าคิวอัตโนมัติ → <b>CMS เปิด API ให้ ERP-HR ดึง</b> (GET /hr/research-works) + แจ้งเตือน webhook research-work.ready → HR นำเข้า ResearchWork แล้วตอบผล (POST /hr/research-works/{cms_ref}/ack พร้อม research_id) → กระทบยอดจาก ERP-HR (อ่านอย่างเดียว) · ไฟล์ JSON เป็นช่องทางสำรอง",
    actions: ed && mode !== "API_PULL" && L.some(x => pubHr(x) === "READY") ? btn("สร้างชุดข้อมูลส่ง HR", "pubhr-pack", { kind: "primary" }) : "" }) +
    `<div class="note">CMS มีสิทธิ์ <b>อ่านอย่างเดียว</b> schema erp_hr — ไม่เขียนตาราง ResearchWork เอง · ERP-HR เป็นเจ้าของข้อมูล (D10) · ช่องทาง <code>integration.hr_writeback_mode</code> = <b>${esc(mode)}</b> (API_PULL = HR ดึงจาก API ของ CMS · FILE = ส่งไฟล์ · API_PUSH = CMS เรียก API ของ HR เมื่อ HR เปิด)</div>
    ${hrApiPanel(L, ed)}
    <nav class="tabs">${["READY", "SENT", "IN_HR", "REJECTED"].map(k => `<a href="#pubreg-hr" data-act="pubhr-tab" data-tab="${k}"${k === tab ? ' aria-current="page"' : ""}>${PUB_HR[k][0]} (${L.filter(x => pubHr(x) === k).length})</a>`).join("")}</nav>` +
    panel(`${PUB_HR[tab][0]} ${T.length} รายการ`, table([{ th: "อาจารย์", val: x => staffName(x.staff) }, { th: "ผลงาน", wrap: true, val: x => x.title }, { th: "ปี", val: x => x.year }, { th: "ฐาน", val: x => x.db }, { th: "ชุดข้อมูล", val: x => (x.hr && x.hr.pack) || "—" }, { th: "research_id", val: x => (x.hr && x.hr.researchId) || "—" },
      { th: "", html: x => ed && pubHr(x) === "SENT" ? btn("บันทึกผล HR", "pubhr-ack", { sm: true, data: { id: x.id } }) : "" }], T, { empty: "ไม่มีรายการ" }), { flush: true }) +
    panel("ชุดข้อมูลที่สร้าง", table([{ th: "ชุด", val: x => x.id }, { th: "วันที่", val: x => thDate(x.at) }, { th: "จำนวน", num: true, val: x => x.ids.length }, { th: "ช่องทาง", val: x => x.mode }, { th: "", html: x => btn("ดาวน์โหลดอีกครั้ง", "pubhr-dl", { sm: true, data: { id: x.id } }) }], pk.slice().reverse(), { empty: "ยังไม่มีชุดข้อมูล" }), { flush: true }) +
    (ed ? `<div class="actions">${btn("กระทบยอดกับ ERP-HR", "pubhr-recon")}${mode === "API_PULL" && L.some(x => pubHr(x) === "READY") ? btn("ส่งออกไฟล์ (ช่องทางสำรอง)", "pubhr-pack") : ""}</div>` : "");
}
/* ---------- API สำหรับ ERP-HR (สเปก: design/openapi.yaml tag hr-research) ---------- */
function hrMode() { return settingVal("integration.hr_writeback_mode", "API_PULL"); }
function hrClient() { return D.integ.clients.find(c => /ERP-HR/.test(c.name)) || {}; }
function hrApiItem(x) { const s = IDX.staff.get(x.staff); return Object.assign(hrRow(x), { hr_status: pubHr(x), authors: x.authors || null, author_role: x.role || "FIRST", recorded_by_kind: x.recBy || "FC", certified_at: x.certAt || null, certified_by_unit: s ? IDX.fac.get(s.fac).name : null, fetched_at: (x.hr && x.hr.fetchedAt) || null, updated_at: (x.hr && (x.hr.ackAt || x.hr.fetchedAt || x.hr.at)) || x.at }); }
function hrHook(event, x) { const c = hrClient(); D.integ.deliveries.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), event, client: c.id || "c3", at: today() + "T" + new Date().toTimeString().slice(0, 5), status: c.status === "ACTIVE" ? "DELIVERED" : "QUEUED", code: c.status === "ACTIVE" ? 200 : null, attempts: c.status === "ACTIVE" ? 1 : 0, ref: "CMS-PUB-" + x.id }); }
function hrApiPanel(L, ed) {
  const c = hrClient(); const q = L.filter(x => ["READY", "SENT"].includes(pubHr(x)));
  const sample = JSON.stringify({ items: q.slice(0, 2).map(hrApiItem), next_cursor: null }, null, 2);
  return panel("API ให้ ERP-HR (OAuth2 client credentials · OpenAPI tag hr-research)", table([{ th: "เมธอด", html: r => `<span class="tag">${r[0]}</span>` }, { th: "เส้นทาง", html: r => `<code>${esc(r[1])}</code>` }, { th: "scope", val: r => r[2] }, { th: "ใช้ทำอะไร", wrap: true, val: r => r[3] }],
    [["GET", "/api/v1/hr/research-works?status=&updated_since=&cursor=", "research-work.read", "ดึงรายการรอนำเข้า (ค่าตั้งต้น READY+SENT) — ดึงครั้งแรก READY → SENT · ดึงซ้ำได้ · ETag/304"], ["GET", "/api/v1/hr/research-works/{cms_ref}", "research-work.read", "รายละเอียด 1 รายการ (ใช้หลังได้ webhook)"], ["POST", "/api/v1/hr/research-works/{cms_ref}/ack", "research-work.ack", "แจ้งผล IMPORTED + research_id / REJECTED + reason · Idempotency-Key"],
     ["WEBHOOK", "research-work.ready · research-work.withdrawn", "—", "แจ้ง HR เมื่อมีรายการใหม่/ถูกถอน (HMAC-SHA256)"]]) +
    `<p class="small">client: <b>${esc(c.name || "ERP-HR")}</b> ${pill(c.status === "ACTIVE" ? "ใช้งาน" : "รอ HR ลงทะเบียน/ทดสอบ", c.status === "ACTIVE" ? "good" : "warn")} · scope ${(c.scopes || []).map(x => `<span class="tag">${esc(x)}</span>`).join(" ")} · รอดึง ${q.filter(x => pubHr(x) === "READY").length} · ดึงแล้วรอ ack ${q.filter(x => pubHr(x) === "SENT").length}</p>
    <details><summary>ตัวอย่าง response ปัจจุบัน (GET /hr/research-works)</summary><pre class="code">${esc(sample)}</pre></details>
    ${ed ? `<div class="actions">${btn("จำลอง: ERP-HR เรียก GET", "pubhr-api-pull", { sm: true })}${btn("ดาวน์โหลดตัวอย่าง JSON", "pubhr-api-sample", { sm: true })}</div>` : ""}`, { flush: false });
}
act("pubhr-api-pull", () => {
  const L = D.staffData.publications.filter(x => !x.demo && ["READY", "SENT"].includes(pubHr(x))); const at = today() + "T" + new Date().toTimeString().slice(0, 8);
  L.filter(x => pubHr(x) === "READY").forEach(x => { x.hr = Object.assign(x.hr || {}, { status: "SENT", via: "API_PULL", fetchedAt: at }); });
  D.integ.deliveries.unshift({ id: Date.now(), event: "GET /hr/research-works", client: hrClient().id || "c3", at: at.slice(0, 16), status: "DELIVERED", code: 200, attempts: 1, rows: L.length });
  audit("ERP-HR ดึงผลงานผ่าน API (จำลอง)", `${L.length} รายการ`); persist(); toast(`ERP-HR ดึง ${L.length} รายการ — รอ ack`); rerender();
});
act("pubhr-api-sample", () => { const L = D.staffData.publications.filter(x => !x.demo && ["READY", "SENT"].includes(pubHr(x))); saveFile("hr-research-works-sample.json", JSON.stringify({ items: L.map(hrApiItem), next_cursor: null }, null, 2)); });
act("pubhr-tab", el => { S.ui.pubhrTab = el.dataset.tab; rerender(); });
act("pubhr-pack", () => {
  const L = D.staffData.publications.filter(x => !x.demo && pubHr(x) === "READY"); const pk = (D.staffData.hrPackages = D.staffData.hrPackages || []);
  const id = `HRPUB-${today().replace(/-/g, "")}-${String(pk.length + 1).padStart(2, "0")}`; const mode = settingVal("integration.hr_writeback_mode", "FILE");
  pk.push({ id, at: today(), by: S.user, ids: L.map(x => x.id), mode }); L.forEach(x => { x.hr = { status: "SENT", pack: id, at: today() }; });
  saveFile(`${id}.json`, JSON.stringify({ package: id, target: 'erp_hr."ResearchWork"', mode, rows: L.map(hrRow) }, null, 2));
  audit("ส่งชุดผลงานให้ ERP-HR", `${id} ${L.length} รายการ`); persist(); toast(`สร้าง ${id} (${L.length} รายการ) — ส่งกองบริหารงานบุคคลนำเข้า`); rerender();
});
act("pubhr-dl", el => { const k = D.staffData.hrPackages.find(x => x.id === el.dataset.id); saveFile(`${k.id}.json`, JSON.stringify({ package: k.id, target: 'erp_hr."ResearchWork"', mode: k.mode, rows: D.staffData.publications.filter(x => k.ids.includes(x.id)).map(hrRow) }, null, 2)); });
act("pubhr-ack", el => { const x = D.staffData.publications.find(y => y.id === Number(el.dataset.id));
  openModal("ผลการนำเข้าของ ERP-HR (POST /hr/research-works/{cms_ref}/ack — จำลอง)", `<form data-form="pubhr-ack" data-id="${x.id}"><p>${esc(x.title)}</p><div class="form-grid">${field("res", "ผล", { type: "select", options: [["OK", "นำเข้าแล้ว"], ["NO", "ไม่รับ"]], blank: false })}${field("rid", "research_id ใน ERP-HR", { placeholder: "เมื่อนำเข้าแล้ว" })}${field("note", "หมายเหตุ", { full: true })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`); });
form("pubhr-ack", (d, f) => { if (d.res === "OK" && !d.rid) { formErrors(f, { rid: "ระบุรหัสที่ HR ตอบกลับ" }); return; } if (d.res === "NO" && !d.note) { formErrors(f, { note: "ระบุเหตุผล" }); return; }
  const x = D.staffData.publications.find(y => y.id === Number(f.dataset.id)); x.hr = Object.assign(x.hr || {}, { status: d.res === "OK" ? "IN_HR" : "REJECTED", researchId: d.rid || null, note: d.note, ackAt: today() });
  if (d.res === "NO") notifyRole("FC", IDX.staff.get(x.staff).fac, `ERP-HR ไม่รับผลงาน "${x.title}": ${d.note}`, "pubreg"); persist(); closeModal(); rerender(); });
/* กระทบยอด: ข้อมูล ResearchWork ที่อ่านจาก ERP-HR (D.staffData.hrResearch — ปัจจุบัน 0 แถว) จับคู่ด้วย DOI หรือ ชื่อ+ปี+staff */
act("pubhr-recon", () => {
  const H = D.staffData.hrResearch || []; let n = 0;
  D.staffData.publications.filter(x => !x.demo && pubHr(x) === "SENT").forEach(x => { const m = H.find(h => (x.doi && h.doi === x.doi) || (h.staff_id === x.staff && h.title === x.title && Number(h.published_year) === x.year)); if (m) { x.hr.status = "IN_HR"; x.hr.researchId = m.research_id; n++; } });
  persist(); toast(`ERP-HR ResearchWork ${H.length} แถว · จับคู่ได้ ${n} รายการ`); rerender();
});
(function () { const g = NAV.find(x => x[0] === "ข้อมูลวิชาการ")[1]; const i = g.findIndex(x => x[0] === "publications"); g.splice(i, 1, ["pubreg", "ผลงานวิชาการรายหลักสูตร", "program.view"]); })();

/* ---------- ผลงานของฉัน (อาจารย์) ---------- */
function myPubsPanel() {
  const u = me(); const L = pubsOf(u.staff).slice().sort((a, b) => b.year - a.year); const prog = D.programs.find(p => progTeachers(p).some(r => r.staff === u.staff));
  const resp = respProgsOfMe();
  return panel(`ผลงานของฉัน (${L.length}) — ${staffName(u.staff)}`, table([{ th: "ปี", val: x => x.year }, { th: "ผลงาน", wrap: true, val: x => x.title }, { th: "แหล่ง", html: x => pillOf(PUB_SRC, pubSrc(x)) }, { th: "สถานะ", html: x => pillOf(PUB_ST, x.status) }, { th: "ERP-HR", html: x => pillOf(PUB_HR, pubHr(x)) },
    { th: "", html: x => !x.demo && ["DRAFT", "RETURNED"].includes(x.status) && prog ? btn("แก้", "pubr-new", { sm: true, data: { prog: prog.id, id: x.id } }) + btn("ส่งรับรอง", "pubr-submit", { sm: true, kind: "primary", data: { id: x.id } }) : "" }], L, { empty: "ยังไม่มีผลงานใน ERP-HR และ CMS" }),
    { flush: true, actions: (prog && can("publication.own") ? btn("+ เพิ่มผลงานที่ยังไม่มีใน HR", "pubr-new", { sm: true, kind: "primary", data: { prog: prog.id } }) : "") + (resp.length ? ` <span class="muted small">ผู้รับผิดชอบหลักสูตร: ${resp.map(pid => `<a href="#pubreg-${pid}">${esc(progTitle(IDX.prog.get(pid), true))}</a>`).join(", ")}</span>` : "") });
}

/* ---------- รอบรายงาน/ประเมิน: เลือกผลงาน (จาก ERP-HR หรือ CMS) บันทึกเป็นภาพ ณ รอบ ---------- */
const ROUND_KIND = { QA: "ประเมินคุณภาพการศึกษาภายในระดับหลักสูตร (ปีการศึกษา)", PROPOSAL: "เสนอหลักสูตรใหม่/ปรับปรุง (เอกสารแนบ มคอ.2)", CHE: "รายงาน สป.อว./CHECO", OTHER: "อื่น ๆ" };
const ROUND_ST = { OPEN: ["เปิดเลือกผลงาน", "info"], CLOSED: ["ปิดรอบแล้ว (ล็อก)", "good"] };
function roundsOf(p) { D.staffData.pubRounds = D.staffData.pubRounds || []; return D.staffData.pubRounds.filter(r => r.prog === p.id).sort((a, b) => b.id - a.id); }
function canRoundManage(p) { return (can("publication.record") && (myFac(p) || me().scope.type === "UNIVERSITY")) || respProgsOfMe().includes(p.id); }
function pickable(x, r) { return x.year >= r.from && x.year <= r.to && (pubSrc(x) !== "CMS" || x.status === "CERTIFIED"); }
function pubRoundsPanel(p) {
  const R = roundsOf(p); const cur = R.find(r => r.id === Number(S.ui["pubround-" + p.id])) || R[0]; const man = canRoundManage(p);
  const head = `<div class="actions">${R.map(r => `<button type="button" class="btn sm ${cur && r.id === cur.id ? "primary" : ""}" data-act="pubround-pick-tab" data-prog="${p.id}" data-id="${r.id}">${esc(r.name)}</button>`).join("")}${man ? btn("+ เปิดรอบรายงาน/ประเมิน", "pubround-new", { sm: true, data: { prog: p.id } }) : ""}</div>`;
  if (!cur) return panel("รอบรายงาน/ประเมิน", head + `<div class="empty">ยังไม่มีรอบ — เปิดรอบเพื่อเลือกผลงานที่ใช้รายงาน (ผลงานใน ERP-HR เลือกได้ทันที · ผลงานบันทึกใน CMS ต้องรับรองก่อน)</div>`);
  const open = cur.status === "OPEN"; const T = progTeachers(p); const picked = id => cur.picks.find(k => k.pub === id);
  const body = T.map(t => { const av = pubsOf(t.staff).filter(x => pickable(x, cur)); const P = cur.picks.filter(k => k.staff === t.staff); const can2 = open && canPubRecord(t.staff);
    return `<tr><td class="wrap"><b>${esc(staffName(t.staff))}</b><br><span class="muted small">${t.role === "PROGRAM_RESPONSIBLE" ? "ผู้รับผิดชอบ" : "ประจำหลักสูตร"}</span></td><td class="wrap">${open ? (av.length ? av.map(x => `<div>${can2 ? `<button type="button" class="btn sm ${picked(x.id) ? "primary" : ""}" data-act="pubround-toggle" data-round="${cur.id}" data-pub="${x.id}" aria-pressed="${!!picked(x.id)}">${picked(x.id) ? "✓ เลือกแล้ว" : "เลือก"}</button>` : picked(x.id) ? "✓" : ""} ${x.year} ${esc(x.title)} ${pillOf(PUB_SRC, pubSrc(x))}${pubSrc(x) === "CMS" && pubHr(x) !== "IN_HR" ? " " + pill("รอเข้า HR", "warn") : ""}</div>`).join("") : `<span class="muted">ไม่มีผลงานในช่วง ${cur.from}–${cur.to}</span>`)
      : P.length ? P.map(k => `<div>${k.snap.year} ${esc(k.snap.title)} ${pillOf(PUB_SRC, k.snap.source)}</div>`).join("") : `<span class="muted">—</span>`}</td><td class="num">${P.length} ${t.role === "PROGRAM_RESPONSIBLE" ? (P.length ? pill("ผ่าน", "good") : pill("ไม่มี", "warn")) : ""}</td></tr>`; }).join("");
  const resp = progResponsible(p); const ok = resp.filter(r => cur.picks.some(k => k.staff === r.staff)).length;
  return panel(`รอบ: ${cur.name}`, head + kv([["ประเภท", esc(ROUND_KIND[cur.kind])], ["ช่วงผลงาน", `พ.ศ. ${cur.from}–${cur.to}`], ["สถานะ", pillOf(ROUND_ST, cur.status) + (cur.hash ? ` <span class="mono small" title="${cur.hash}">🔒 ${cur.hash.slice(0, 8)}</span>` : "") + (cur.closedAt ? ` ${thDate(cur.closedAt)}` : "")], ["ผู้รับผิดชอบที่มีผลงานในรอบ", `${ok}/${resp.length}`]]) +
    `<div class="table-wrap"><table class="t"><thead><tr><th>อาจารย์</th><th>${open ? "ผลงานที่เลือกได้ (ERP-HR / CMS ที่รับรองแล้ว)" : "ผลงานที่บันทึกในรอบ (ภาพ ณ วันปิดรอบ)"}</th><th class="num">เลือก</th></tr></thead><tbody>${body}</tbody></table></div>
    <div class="actions">${btn("CSV รอบนี้", "pubround-csv", { sm: true, data: { id: cur.id } })}${open && man ? btn("ปิดรอบ (ล็อกรายการ)", "pubround-close", { sm: true, kind: "primary", data: { id: cur.id } }) : ""}</div>
    <p class="muted small">เลือกแล้วระบบบันทึกข้อมูลผลงาน ณ ขณะนั้นไว้ในรอบ (ไม่เปลี่ยนตามการแก้ใน HR ภายหลัง) · ปิดรอบแล้วแก้ไม่ได้ · ใช้ในรายงานประเมินคุณภาพ/เอกสารแนบ มคอ.2</p>`, { id: "rounds" });
}
act("pubround-pick-tab", el => { S.ui["pubround-" + el.dataset.prog] = Number(el.dataset.id); rerender(); });
act("pubround-new", el => { const p = IDX.prog.get(Number(el.dataset.prog)); const [y0, y1] = pubWindow();
  openModal("เปิดรอบรายงาน/ประเมิน", `<form data-form="pubround-new" data-prog="${p.id}"><div class="form-grid">${field("kind", "ประเภท", { type: "select", options: Object.entries(ROUND_KIND), blank: false, full: true })}${field("name", "ชื่อรอบ", { value: `ประเมินคุณภาพ ปีการศึกษา ${y1 - 1}`, required: true, full: true })}${field("from", "ผลงานตั้งแต่ พ.ศ.", { type: "number", value: y0, required: true })}${field("to", "ถึง พ.ศ.", { type: "number", value: y1, required: true })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">เปิดรอบ</button></div></form>`); });
form("pubround-new", (d, f) => { const errs = {}; if (!d.name) errs.name = "ระบุชื่อรอบ"; if (!(Number(d.from) <= Number(d.to))) errs.to = "ช่วงปีไม่ถูกต้อง"; if (!formErrors(f, errs)) return;
  const p = IDX.prog.get(Number(f.dataset.prog)); D.staffData.pubRounds = D.staffData.pubRounds || []; const id = Math.max(0, ...D.staffData.pubRounds.map(r => r.id)) + 1;
  D.staffData.pubRounds.push({ id, prog: p.id, kind: d.kind, name: d.name, from: Number(d.from), to: Number(d.to), status: "OPEN", picks: [], by: S.user, at: today() }); S.ui["pubround-" + p.id] = id;
  progTeachers(p).forEach(t => { const u = D.security.users.find(x => x.staff === t.staff); if (u) notify(u.id, `เลือกผลงานเข้ารอบ "${d.name}"`, `pubreg-${p.id}`); });
  audit("เปิดรอบรายงานผลงาน", `${p.code} ${d.name}`); persist(); closeModal(); rerender(); });
act("pubround-toggle", el => { const r = D.staffData.pubRounds.find(x => x.id === Number(el.dataset.round)); const x = D.staffData.publications.find(y => y.id === Number(el.dataset.pub));
  if (r.status !== "OPEN" || !canPubRecord(x.staff) || !pickable(x, r)) return; const i = r.picks.findIndex(k => k.pub === x.id);
  if (i >= 0) r.picks.splice(i, 1); else r.picks.push({ pub: x.id, staff: x.staff, by: S.user, at: today(), snap: { title: x.title, venue: x.venue, year: x.year, type: x.typeTh, db: x.db, doi: x.doi || "", source: pubSrc(x), researchId: x.hr && x.hr.researchId || (pubSrc(x) === "HR" ? x.id : null), hr: pubHr(x) } });
  persist(); rerender(); });
act("pubround-close", el => { const r = D.staffData.pubRounds.find(x => x.id === Number(el.dataset.id));
  confirmTyped("ปิดรอบรายงาน/ประเมิน", `ปิดรอบ "${esc(r.name)}" — รายการผลงาน ${r.picks.length} รายการจะถูกล็อก`, "ปิดรอบ", () => { r.status = "CLOSED"; r.closedAt = today(); r.closedBy = S.user; r.hash = fnv(stable(r.picks)); audit("ปิดรอบรายงานผลงาน", `${r.name} ${r.picks.length}`); persist(); rerender(); }); });
act("pubround-csv", el => { const r = D.staffData.pubRounds.find(x => x.id === Number(el.dataset.id));
  saveFile(`ผลงาน-${r.name}.csv`, csv(r.picks, [{ th: "รหัสบุคลากร", val: k => k.staff }, { th: "ชื่อ", val: k => staffName(k.staff) }, { th: "ปี", val: k => k.snap.year }, { th: "ผลงาน", val: k => k.snap.title }, { th: "แหล่งเผยแพร่", val: k => k.snap.venue }, { th: "ประเภท", val: k => k.snap.type }, { th: "ฐาน", val: k => k.snap.db }, { th: "DOI", val: k => k.snap.doi }, { th: "แหล่งข้อมูล", val: k => k.snap.source }, { th: "ERP-HR", val: k => k.snap.hr }])); });

/* ลิงก์เดิม #publications → หน้าใหม่รายหลักสูตร (G10) */
ROUTES.publications = ROUTES.pubreg;
