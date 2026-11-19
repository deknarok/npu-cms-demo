/* backfill.js — G30 ประวัติการปรับปรุงหลักสูตรย้อนหลัง
   บันทึกย้อนหลัง 3 แบบ: (1) มติของฉบับที่มีอยู่ (2) ฉบับเก่าที่ไม่อยู่ในระบบทะเบียน (3) การปรับปรุงเล็กน้อย (สมอ.08) ที่เคยยื่น
   กระบวนการ: คณะ (FC) บันทึก + หลักฐาน → เจ้าหน้าที่หลักสูตรส่วนกลาง (CC) ตรวจกับรายงานการประชุม/หนังสือแจ้งมติ → ยืนยัน = ปิดบันทึกเข้าทะเบียนการปรับปรุง (hash, D12)
   CC นำเข้ารายการมติจากสำนักงานสภามหาวิทยาลัยแบบวางได้ (ถือว่าตรวจแล้ว) · ส่งกลับได้พร้อมเหตุผล · ข้อมูลที่ยืนยันแล้วแก้ไม่ได้ ต้องบันทึกรายการแก้ไขใหม่ (append-only) */
"use strict";

HKIND.RETRO = ["ยืนยันมติย้อนหลัง", "info"];
HSTATUS.PENDING = ["รอตรวจหลักฐาน", "warn"];
const BF_ST = { SUBMITTED: ["รอส่วนกลางตรวจ", "info"], VERIFIED: ["ยืนยันแล้ว (ปิดบันทึก)", "good"], RETURNED: ["ส่งกลับแก้ไข", "warn"] };
const BF_KIND = { RESOLUTION: "มติของฉบับ", VERSION: "ฉบับเก่า (ไม่อยู่ในทะเบียน)", MINOR: "ปรับปรุงเล็กน้อย (สมอ.08)" };
const BF_BODIES = [["UNIVERSITY_COUNCIL", /สภามหาวิทยาลัย|council/i], ["ACADEMIC_SENATE", /สภาวิชาการ|senate/i], ["CURRICULUM_SCREENING", /กลั่นกรอง|screen/i], ["GRADUATE_SCHOOL", /บัณฑิต|grad/i], ["FACULTY_BOARD", /คณะ|faculty/i]];
function bfList() { D.hist.backfill = D.hist.backfill || []; return D.hist.backfill; }
function bfNew(o) { const L = bfList(); const x = Object.assign({ id: Math.max(0, ...L.map(y => y.id)) + 1, status: "SUBMITTED", by: S.user, at: today() }, o); L.push(x); notifyRole("CC", null, `ตรวจข้อมูลย้อนหลัง: ${BF_KIND[x.kind]} ${progTitle(IDX.prog.get(x.prog), true)}`, "backfill-queue"); return x; }
function canBf(p) { return can("program.edit") && (myFac(p) || me().scope.type === "UNIVERSITY"); }
function bfDate(s) { s = (s || "").trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return Number(m[1]) > 2400 ? `${Number(m[1]) - 543}-${m[2]}-${m[3]}` : s;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) { const y = Number(m[3]) > 2400 ? Number(m[3]) - 543 : Number(m[3]); return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; } return null; }
/* ยืนยันมติ → บันทึกรับรองต่อท้ายทะเบียน (ไม่แก้บันทึกที่ปิดแล้ว) */
function attestResolution(p, v, r) {
  if (D.hist.records.some(x => x.kind === "RETRO" && x.ver === v.id && x.body === r.body && x.no === r.no)) return;
  const rec = newRecord({ prog: p.id, ver: v.id, baseVer: null, kind: "RETRO", body: r.body, no: r.no, title: `ยืนยันมติ${BODY_TH(r.body)} ครั้งที่ ${r.no} (ฉบับ พ.ศ. ${v.year})`, issues: [], reasons: [], effTerm: null, effYear: v.year, cohort: v.year,
    council: ["UNIVERSITY_COUNCIL", "ACADEMIC_SENATE"].includes(r.body) ? { no: r.no, date: r.date } : null, ack: null, status: "APPROVED", at: r.date, evidence: r.ref || null, verifiedBy: S.user });
  seal(rec);
}

/* ---------- (1) มติ: บังคับหลักฐาน · ยืนยันโดย CC → ปิดบันทึก ---------- */
const _resSave = FORMS["res-save"];
FORMS["res-save"] = (d, f) => {
  const errs = {}; if (!/^\d{1,3}\/\d{4}$/.test(d.no || "")) errs.no = "รูปแบบ ครั้งที่/ปี พ.ศ."; if (!d.date) errs.date = "ระบุวันที่"; if (!d.ref) errs.ref = "ระบุหลักฐาน (เลขที่หนังสือแจ้งมติ/หน้าในรายงานการประชุม)";
  if (!formErrors(f, errs)) return;
  _resSave(d, f); if (!$("#modal").hidden) return;
  const { p, v } = IDX.ver.get(Number(f.dataset.ver)); const body = f.dataset.body;
  bfList().filter(x => x.kind === "RESOLUTION" && x.ver === v.id && x.body === body && x.status !== "VERIFIED").forEach(x => { x.status = "REPLACED"; });
  bfNew({ kind: "RESOLUTION", prog: p.id, ver: v.id, body, data: { no: d.no, date: d.date, result: d.result }, evidence: d.ref }); persist();
};
const _resVerify = ACTIONS["res-verify"];
ACTIONS["res-verify"] = el => {
  _resVerify(el); const { p, v } = IDX.ver.get(Number(el.dataset.ver)); const r = (v.resolutions || []).find(x => x.body === el.dataset.body);
  if (r && r.verified) { attestResolution(p, v, r); bfList().filter(x => x.kind === "RESOLUTION" && x.ver === v.id && x.body === r.body && x.status === "SUBMITTED").forEach(x => { x.status = "VERIFIED"; x.verifiedBy = S.user; x.verifiedAt = today(); }); audit("ยืนยันมติย้อนหลัง", `${p.code} ${v.year} ${BODY_TH(r.body)} ${r.no}`); persist(); rerender(); }
};

/* ---------- หน้าบันทึกประวัติย้อนหลัง ---------- */
route("backfill", { perm: "program.view", title: "บันทึกประวัติย้อนหลัง", render(args) {
  const tab = args[0] || "progress"; const L = bfList().filter(x => x.status !== "REPLACED" && inScope(IDX.prog.get(x.prog)));
  const tabs = [["progress", "ความคืบหน้ารายหลักสูตร"], ["queue", `รอตรวจ (${L.filter(x => x.status === "SUBMITTED").length})`], ["returned", `ส่งกลับ (${L.filter(x => x.status === "RETURNED").length})`], ["done", "ยืนยันแล้ว"]].concat(can("approval.resolve") ? [["import", "นำเข้ารายการมติ (วาง)"]] : []);
  const dl = settingVal("history.backfill_deadline", "");
  return pageHead("บันทึกประวัติการปรับปรุงหลักสูตรย้อนหลัง (G30)", { lead: `มติสภามหาวิทยาลัย/สภาวิชาการของทุกฉบับ · ฉบับเก่าที่ไม่อยู่ในระบบทะเบียน · สมอ.08 ที่เคยยื่น — คณะบันทึกพร้อมหลักฐาน → ส่วนกลางตรวจกับรายงานการประชุม → ยืนยันแล้วปิดบันทึกเข้าทะเบียนการปรับปรุง (แก้ไม่ได้)${dl ? ` · กำหนดเสร็จ ${esc(dl)}` : ""}` }) +
    `<nav class="tabs">${tabs.map(([k, t]) => `<a href="#backfill-${k}"${k === tab ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>` +
    (tab === "progress" ? bfProgress() : tab === "import" ? bfImportForm() : bfQueue(L.filter(x => x.status === { queue: "SUBMITTED", returned: "RETURNED", done: "VERIFIED" }[tab])));
} });
function verResolved(p, v, body) { return resolutionsOf(p, v).find(r => r.body === body && r.no && !r.sim); }
function bfProgress() {
  const f = S.filters.bf || {}; const vs = p => p.versions.filter(v => ["APPROVED", "SUPERSEDED"].includes(v.state));
  const rows = D.programs.filter(inScope).filter(p => !f.fac || p.fac === f.fac).map(p => { const V = vs(p);
    const cnt = body => V.filter(v => { const r = verResolved(p, v, body); return r && r.verified; }).length; const any = body => V.filter(v => verResolved(p, v, body)).length;
    return { p, V, cv: cnt("UNIVERSITY_COUNCIL"), ca: any("UNIVERSITY_COUNCIL"), sv: cnt("ACADEMIC_SENATE"), sa: any("ACADEMIC_SENATE"), minors: D.hist.records.filter(r => r.prog === p.id && r.kind === "MINOR" && !r.sim).length, pend: bfList().filter(x => x.prog === p.id && x.status === "SUBMITTED").length }; })
    .filter(x => !f.only || (f.only === "gap" ? x.cv < x.V.length : x.cv === x.V.length));
  const byFac = D.meta.faculties.map(fc => { const R = rows.filter(x => x.p.fac === fc.id); const tv = R.reduce((a, x) => a + x.V.length, 0); return { fc, n: R.length, tv, cv: R.reduce((a, x) => a + x.cv, 0) }; }).filter(x => x.n);
  const tv = rows.reduce((a, x) => a + x.V.length, 0), cv = rows.reduce((a, x) => a + x.cv, 0); const pg = paged("bf", rows, 30);
  return `<div class="grid g4"><div class="panel stat"><span class="label">ฉบับที่อนุมัติ/ถูกแทนที่</span><span class="value">${fmt(tv)}</span><span class="sub">${fmt(rows.length)} หลักสูตร</span></div>
      <div class="panel stat"><span class="label">มีมติสภามหาวิทยาลัยที่ยืนยันแล้ว</span><span class="value">${fmt(cv)}</span><span class="sub">${tv ? pct(cv / tv) : "—"}</span></div>
      <div class="panel stat"><span class="label">รอส่วนกลางตรวจ</span><span class="value">${fmt(bfList().filter(x => x.status === "SUBMITTED").length)}</span></div>
      <div class="panel stat"><span class="label">ส่งกลับให้คณะแก้</span><span class="value">${fmt(bfList().filter(x => x.status === "RETURNED").length)}</span></div></div>` +
    panel("ความคืบหน้ารายคณะ/วิทยาลัย (มติสภามหาวิทยาลัยที่ยืนยันแล้ว ÷ ฉบับ)", table([{ th: "คณะ/วิทยาลัย", val: x => x.fc.name }, { th: "หลักสูตร", num: true, val: x => x.n }, { th: "ฉบับ", num: true, val: x => x.tv }, { th: "ยืนยันแล้ว", num: true, val: x => x.cv }, { th: "ร้อยละ", num: true, html: x => x.tv ? pill(pct(x.cv / x.tv), x.cv === x.tv ? "good" : x.cv ? "info" : "warn") : "—" }], byFac), { flush: true }) +
    `<section class="panel"><header><form class="filters" data-form="bf-filter" style="width:100%"><select name="fac" aria-label="คณะ"><option value="">ทุกคณะ/วิทยาลัย</option>${D.meta.faculties.map(x => `<option value="${x.id}"${f.fac === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><select name="only" aria-label="สถานะ"><option value="">ทั้งหมด</option><option value="gap"${f.only === "gap" ? " selected" : ""}>ยังไม่ครบ</option><option value="full"${f.only === "full" ? " selected" : ""}>ครบ</option></select><button class="btn primary" type="submit">กรอง</button></form></header></section>` +
    panel(`${fmt(rows.length)} หลักสูตร`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.p.id}-history">${esc(progTitle(x.p, true))}</a><br><span class="muted small">ฉบับ ${x.V.map(v => v.year + (v.source === "BACKFILL" ? "*" : "")).join(", ")}</span>` },
      { th: "สภามหาวิทยาลัย (ยืนยัน/บันทึก/ฉบับ)", num: true, html: x => `${x.cv}/${x.ca}/${x.V.length} ${x.cv === x.V.length ? pill("ครบ", "good") : ""}` }, { th: "สภาวิชาการ", num: true, val: x => `${x.sv}/${x.sa}/${x.V.length}` }, { th: "สมอ.08 ที่บันทึก", num: true, val: x => x.minors || "" }, { th: "รอตรวจ", num: true, val: x => x.pend || "" },
      { th: "", html: x => `<span class="actions"><a class="btn sm" href="#resolutions-${x.p.id}">มติ</a>${canBf(x.p) ? btn("+ ฉบับเก่า", "bf-ver", { sm: true, data: { id: x.p.id } }) + btn("+ สมอ.08", "bf-minor", { sm: true, data: { id: x.p.id } }) : ""}</span>` }], pg.rows), { flush: true }) + pg.pager +
    `<p class="muted small">* = ฉบับที่บันทึกย้อนหลัง (ไม่อยู่ในระบบทะเบียน) · ตัวเลข ยืนยัน/บันทึก/ฉบับ — "บันทึก" รวมที่รอตรวจ</p>`;
}
form("bf-filter", d => { S.filters.bf = d; S.ui["pg-bf"] = 1; rerender(); });
function bfDesc(x) { const p = IDX.prog.get(x.prog); const v = x.ver ? verOf(x.ver) : null; const d = x.data || {};
  if (x.kind === "RESOLUTION") return `ฉบับ พ.ศ. ${v ? v.year : "?"} · ${BODY_TH(x.body)} ครั้งที่ ${esc(d.no)} วันที่ ${thDate(d.date, true)}`;
  if (x.kind === "VERSION") return `ฉบับ พ.ศ. ${d.year} (${d.kind === "NEW" ? "หลักสูตรใหม่" : "ปรับปรุง"}) ${d.credits} หน่วยกิต · สภามหาวิทยาลัย ${esc(d.councilNo || "—")} ${d.councilDate ? thDate(d.councilDate, true) : ""} · สภาวิชาการ ${esc(d.senateNo || "—")}`;
  return `ฉบับ พ.ศ. ${v ? v.year : "?"} · ${esc(d.title)} · สภาวิชาการ ${esc(d.no)} ${thDate(d.date, true)} · มีผล ${esc(d.eff)}`; }
function bfQueue(L) {
  const ck = can("approval.resolve");
  return panel(`${L.length} รายการ`, table([{ th: "#", val: x => x.id }, { th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.prog}-history">${esc(progTitle(IDX.prog.get(x.prog), true))}</a>` }, { th: "ประเภท", val: x => BF_KIND[x.kind] }, { th: "รายละเอียด", wrap: true, html: bfDesc }, { th: "หลักฐาน", wrap: true, val: x => x.evidence || "" },
    { th: "บันทึกโดย", val: x => `${userName(x.by)} ${thDate(x.at)}` }, { th: "สถานะ", html: x => pillOf(BF_ST, x.status) + (x.note ? `<br><span class="muted small">${esc(x.note)}</span>` : "") },
    { th: "", html: x => `<span class="actions">${x.status === "SUBMITTED" && ck ? btn("ยืนยัน", "bf-ok", { sm: true, kind: "primary", data: { id: x.id } }) + btn("ส่งกลับ", "bf-ret", { sm: true, data: { id: x.id } }) : ""}${x.status === "RETURNED" && canBf(IDX.prog.get(x.prog)) ? (x.kind === "RESOLUTION" ? `<a class="btn sm" href="#resolutions-${x.prog}">แก้ที่หน้ามติ</a>` : btn("ยกเลิกรายการ", "bf-drop", { sm: true, data: { id: x.id } })) : ""}</span>` }], L, { empty: "ไม่มีรายการ" }), { flush: true });
}

/* ---------- (2) ฉบับเก่า ---------- */
act("bf-ver", el => { const p = IDX.prog.get(Number(el.dataset.id)); const first = Math.min(...p.versions.map(v => v.year).filter(Boolean));
  openModal(`เพิ่มฉบับเก่า — ${progTitle(p, true)}`, `<form data-form="bf-ver" data-id="${p.id}"><p class="small muted">ฉบับที่มีในระบบ: ${p.versions.map(v => v.year).join(", ")} — ใช้เมื่อฉบับเก่าไม่อยู่ในระบบทะเบียน</p><div class="form-grid">
    ${field("year", "ปีหลักสูตร (พ.ศ.)", { type: "number", value: first ? first - 5 : "", required: true })}${field("kind", "ประเภท", { type: "select", options: [["NEW", "หลักสูตรใหม่"], ["REVISION", "หลักสูตรปรับปรุง"]], blank: false })}
    ${field("credits", "หน่วยกิตรวม", { type: "number", min: 1, required: true })}${field("years", "ระยะเวลา (ปี)", { type: "number", min: 1, value: 4 })}${field("plans", "แผนการศึกษา (คั่นด้วย ,)", { value: "ปกติ", full: true })}
    ${field("councilNo", "สภามหาวิทยาลัย ครั้งที่", { required: true, placeholder: "เช่น 5/2554" })}${field("councilDate", "วันที่อนุมัติ", { type: "date", required: true })}
    ${field("senateNo", "สภาวิชาการ ครั้งที่", { placeholder: "เช่น 4/2554" })}${field("senateDate", "วันที่", { type: "date" })}${field("ack", "สกอ./สป.อว. รับทราบ (วันที่)", { type: "date" })}${field("endYear", "รับนักศึกษาถึงปีการศึกษา", { type: "number" })}
    ${field("issues", "สาระสำคัญของฉบับ/การปรับปรุง (หนึ่งบรรทัดต่อข้อ)", { type: "textarea", rows: 3, full: true })}${field("evidence", "หลักฐาน (เล่ม มคอ.2/หนังสือแจ้งมติ/รายงานการประชุม)", { required: true, full: true })}</div>
    <div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึกและส่งตรวจ</button></div></form>`, { wide: true }); });
form("bf-ver", (d, f) => {
  const p = IDX.prog.get(Number(f.dataset.id)); const y = Number(d.year); const errs = {}; const act0 = activeVer(p).year;
  if (!(y >= 2500 && y < act0)) errs.year = `ปีต้องน้อยกว่าฉบับปัจจุบัน (${act0})`; if (p.versions.some(v => v.year === y)) errs.year = "มีฉบับปีนี้แล้ว — บันทึกมติที่หน้ามติ";
  if (!(Number(d.credits) > 0)) errs.credits = "ระบุหน่วยกิต"; if (!/^\d{1,3}\/\d{4}$/.test(d.councilNo)) errs.councilNo = "รูปแบบ ครั้งที่/ปี พ.ศ."; if (!d.councilDate) errs.councilDate = "ระบุวันที่";
  if (d.senateNo && !/^\d{1,3}\/\d{4}$/.test(d.senateNo)) errs.senateNo = "รูปแบบ ครั้งที่/ปี พ.ศ."; if (!d.evidence) errs.evidence = "ระบุหลักฐาน";
  if (!formErrors(f, errs)) return;
  const id = Math.max(...D.programs.flatMap(x => x.versions.map(v => v.id))) + 1;
  const v = { id, year: y, credits: Number(d.credits), years: Number(d.years) || null, minGpa: "2.00", plans: d.plans.split(",").map(x => x.trim()).filter(Boolean).map(plan => ({ regId: null, plan, credits: Number(d.credits) })), state: "SUPERSEDED", kind: d.kind, senate: d.councilDate, ack: d.ack || null, source: "BACKFILL", pending: true, endYear: Number(d.endYear) || null,
    resolutions: [{ body: "UNIVERSITY_COUNCIL", no: d.councilNo, date: d.councilDate, result: "APPROVED", ref: d.evidence, source: "BACKFILL", by: S.user, at: today() }].concat(d.senateNo ? [{ body: "ACADEMIC_SENATE", no: d.senateNo, date: d.senateDate, result: "APPROVED", ref: d.evidence, source: "BACKFILL", by: S.user, at: today() }] : []) };
  p.versions.push(v); p.versions.sort((a, b) => a.year - b.year); buildIndex();
  const prev = p.versions[p.versions.indexOf(v) - 1]; const next = p.versions[p.versions.indexOf(v) + 1];
  const rec = newRecord({ prog: p.id, ver: id, baseVer: prev ? prev.id : null, kind: d.kind === "NEW" && !prev ? "NEW" : "MAJOR", seqMajor: D.hist.records.filter(r => r.prog === p.id && r.kind === "MAJOR" && verOf(r.ver) && verOf(r.ver).year < y).length + (d.kind === "NEW" && !prev ? 0 : 1), seqMinor: null,
    title: `${d.kind === "NEW" ? "หลักสูตรใหม่" : "หลักสูตรปรับปรุง"} พ.ศ. ${y} (บันทึกย้อนหลัง)`, reasons: [], issues: (d.issues || "").split(/\r?\n/).filter(Boolean).map(t => ({ area: "GENERAL", text: t.trim(), real: true })), effTerm: 1, effYear: y, cohort: y, council: { no: d.councilNo, date: d.councilDate }, ack: d.ack || null, case: null, amend: null, status: "PENDING", at: d.councilDate, backfill: true, evidence: d.evidence });
  if (next) { const nr = D.hist.records.find(r => r.ver === next.id && ["NEW", "MAJOR"].includes(r.kind)); if (nr && !nr.hash && !nr.baseVer) nr.baseVer = id; }
  bfNew({ kind: "VERSION", prog: p.id, ver: id, rec: rec.id, data: { year: y, kind: d.kind, credits: Number(d.credits), councilNo: d.councilNo, councilDate: d.councilDate, senateNo: d.senateNo }, evidence: d.evidence });
  audit("บันทึกฉบับเก่าย้อนหลัง", `${p.code} ${y}`); persist(); closeModal(); toast("บันทึกแล้ว — รอส่วนกลางตรวจ"); rerender();
});

/* ---------- (3) สมอ.08 ที่เคยยื่น ---------- */
act("bf-minor", el => { const p = IDX.prog.get(Number(el.dataset.id)); const areas = Object.entries(D.hist.areas).filter(([, v]) => v[1] === "MINOR").map(([k, v]) => [k, v[0]]);
  openModal(`บันทึกการปรับปรุงเล็กน้อยที่เคยยื่น — ${progTitle(p, true)}`, `<form data-form="bf-minor" data-id="${p.id}"><div class="form-grid">
    ${field("ver", "ฉบับหลักสูตร", { type: "select", options: p.versions.filter(v => ["APPROVED", "SUPERSEDED"].includes(v.state)).map(v => [v.id, `พ.ศ. ${v.year}`]), required: true })}${field("title", "เรื่อง", { required: true, full: true, placeholder: "เช่น เปลี่ยนแปลงอาจารย์ผู้รับผิดชอบหลักสูตร" })}
    ${field("area", "ด้านที่ปรับ", { type: "select", options: areas, required: true })}${field("eff", "มีผลภาค/ปีการศึกษา", { required: true, placeholder: "1/2566" })}
    ${field("before", "เดิม", { type: "textarea", rows: 2 })}${field("after", "ปรับเป็น", { type: "textarea", rows: 2 })}
    ${field("no", "สภาวิชาการ/สภามหาวิทยาลัย ครั้งที่", { required: true, placeholder: "3/2566" })}${field("date", "วันที่อนุมัติ", { type: "date", required: true })}
    ${field("retro", "ใช้กับนักศึกษา", { type: "select", options: [["0", "รุ่นที่เข้าตั้งแต่ภาคที่มีผล"], ["1", "ทุกรุ่นของฉบับนี้"]], blank: false })}${field("evidence", "หลักฐาน (แบบ สมอ.08/หนังสือแจ้ง สป.อว.)", { required: true, full: true })}</div>
    <div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึกและส่งตรวจ</button></div></form>`, { wide: true }); });
form("bf-minor", (d, f) => {
  const errs = {}; ["ver", "title", "area", "evidence"].forEach(k => { if (!d[k]) errs[k] = "จำเป็นต้องกรอก"; }); if (!/^[123]\/\d{4}$/.test(d.eff || "")) errs.eff = "รูปแบบ ภาค/ปี เช่น 1/2566"; if (!/^\d{1,3}\/\d{4}$/.test(d.no || "")) errs.no = "รูปแบบ ครั้งที่/ปี พ.ศ."; if (!d.date) errs.date = "ระบุวันที่";
  if (!formErrors(f, errs)) return;
  const p = IDX.prog.get(Number(f.dataset.id)); const vid = Number(d.ver); const [t, y] = d.eff.split("/").map(Number);
  const rec = newRecord({ prog: p.id, ver: vid, baseVer: vid, kind: "MINOR", seqMajor: null, seqMinor: D.hist.records.filter(r => r.ver === vid && r.kind === "MINOR").length + 1, title: `สมอ.08 ${d.title}`, reasons: [], issues: [], items: [{ area: d.area, before: d.before, after: d.after, note: "บันทึกย้อนหลัง" }],
    effTerm: t, effYear: y, cohort: y, retro: d.retro === "1", council: { no: d.no, date: d.date }, ack: null, case: null, amend: "สมอ.08 (ย้อนหลัง)", status: "PENDING", at: d.date, backfill: true, evidence: d.evidence });
  bfNew({ kind: "MINOR", prog: p.id, ver: vid, rec: rec.id, data: { title: d.title, no: d.no, date: d.date, eff: d.eff }, evidence: d.evidence });
  audit("บันทึก สมอ.08 ย้อนหลัง", `${p.code} ${d.title}`); persist(); closeModal(); toast("บันทึกแล้ว — รอส่วนกลางตรวจ"); rerender();
});

/* ---------- ตรวจ/ยืนยัน/ส่งกลับ ---------- */
act("bf-ok", el => {
  const x = bfList().find(y => y.id === Number(el.dataset.id)); const p = IDX.prog.get(x.prog);
  openModal(`ยืนยันข้อมูลย้อนหลัง #${x.id}`, `<form data-form="bf-ok" data-id="${x.id}"><p>${bfDesc(x)}</p><p class="small">หลักฐาน: ${esc(x.evidence || "—")}</p>
    <fieldset class="field full"><legend>ตรวจกับต้นฉบับ</legend><div class="checks"><label><input type="checkbox" name="chk" value="1"> ครั้งที่/วันที่ตรงกับรายงานการประชุมหรือหนังสือแจ้งมติ</label><label><input type="checkbox" name="chk" value="2"> ฉบับ/เรื่องตรงกับเล่มหรือแบบ สมอ.08</label></div><span class="err" data-err="chk"></span></fieldset>
    <div class="note warn">ยืนยันแล้วจะปิดบันทึกเข้าทะเบียนการปรับปรุง (hash) — แก้ไม่ได้ ต้องบันทึกรายการแก้ไขใหม่</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">ยืนยันและปิดบันทึก</button></div></form>`);
});
form("bf-ok", (d, f) => {
  if ($$('input[name="chk"]:checked', f).length < 2) { formErrors(f, { chk: "ตรวจให้ครบทั้ง 2 ข้อ" }); return; }
  const x = bfList().find(y => y.id === Number(f.dataset.id)); const p = IDX.prog.get(x.prog); const v = verOf(x.ver);
  if (x.kind === "RESOLUTION") { const r = (v.resolutions || []).find(y => y.body === x.body); if (r) { r.verified = true; r.verifiedBy = S.user; attestResolution(p, v, r); } }
  else { const rec = D.hist.records.find(r => r.id === x.rec); if (rec && !rec.hash) { rec.status = "APPROVED"; rec.verifiedBy = S.user; seal(rec); }
    if (x.kind === "VERSION") { v.pending = false; (v.resolutions || []).forEach(r => { r.verified = true; r.verifiedBy = S.user; }); } }
  x.status = "VERIFIED"; x.verifiedBy = S.user; x.verifiedAt = today();
  audit("ยืนยันข้อมูลย้อนหลัง", `${p.code} #${x.id} ${BF_KIND[x.kind]}`); persist(); closeModal(); toast("ยืนยันและปิดบันทึกแล้ว"); rerender();
});
act("bf-ret", el => openModal("ส่งกลับให้คณะแก้ไข", `<form data-form="bf-ret" data-id="${el.dataset.id}">${field("note", "สิ่งที่ต้องแก้", { type: "textarea", required: true, full: true })}<div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">ส่งกลับ</button></div></form>`));
form("bf-ret", (d, f) => { if (!formErrors(f, d.note ? {} : { note: "ระบุสิ่งที่ต้องแก้" })) return; const x = bfList().find(y => y.id === Number(f.dataset.id)); x.status = "RETURNED"; x.note = d.note;
  notifyRole("FC", IDX.prog.get(x.prog).fac, `ข้อมูลย้อนหลังถูกส่งกลับ: ${d.note}`, "backfill-returned"); persist(); closeModal(); rerender(); });
act("bf-drop", el => { const x = bfList().find(y => y.id === Number(el.dataset.id)); const p = IDX.prog.get(x.prog);
  if (x.rec) { const i = D.hist.records.findIndex(r => r.id === x.rec && !r.hash); if (i >= 0) D.hist.records.splice(i, 1); }
  if (x.kind === "VERSION") { const v = verOf(x.ver); if (v && v.pending) { p.versions.splice(p.versions.indexOf(v), 1); D.hist.records.forEach(r => { if (r.baseVer === v.id && !r.hash) r.baseVer = null; }); buildIndex(); } }
  x.status = "REPLACED"; audit("ยกเลิกข้อมูลย้อนหลัง", `${p.code} #${x.id}`); persist(); rerender(); });

/* ---------- นำเข้ารายการมติจากสำนักงานสภา (CC) ---------- */
function bfImportForm() {
  return panel("นำเข้ารายการมติแบบวาง (จากทะเบียนมติของสำนักงานสภามหาวิทยาลัย/สภาวิชาการ)", `<form data-form="bf-import"><p class="small">หนึ่งบรรทัดต่อหนึ่งมติ คั่นด้วยแท็บหรือ <code>|</code>: <b>รหัสหลักสูตร (CMS/REG/อว.) | ปีฉบับ | คณะกรรมการ | ครั้งที่ | วันที่ (ว/ด/ปี พ.ศ. หรือ ปปปป-ดด-วว) | หลักฐาน</b></p>
    ${field("rows", "ข้อมูล", { type: "textarea", rows: 10, full: true, required: true, placeholder: "NPU-01-0004 | 2565 | สภามหาวิทยาลัย | 3/2565 | 26/3/2565 | หนังสือแจ้งมติ อว 0605/123" })}
    <div class="note">ผู้นำเข้าเป็นผู้ตรวจ (เจ้าหน้าที่หลักสูตรส่วนกลาง) → มติที่นำเข้าถือว่ายืนยันแล้วและปิดบันทึกทันที · บรรทัดที่จับคู่ไม่ได้จะแสดงให้แก้ ไม่นำเข้าบางส่วน</div><div class="form-foot"><button class="btn primary" type="submit">ตรวจและนำเข้า</button></div></form>${S.ui.bfImportMsg ? `<div class="note">${S.ui.bfImportMsg}</div>` : ""}`);
}
function findProg(code) { code = code.trim(); return D.programs.find(p => p.code === code || p.checoCode === code || p.versions.some(v => v.plans.some(pl => pl.regId === code))); }
form("bf-import", (d, f) => {
  if (!can("approval.resolve")) return; const lines = (d.rows || "").split(/\r?\n/).filter(l => l.trim()); const ok = []; const bad = [];
  lines.forEach((l, i) => { const c = l.split(l.includes("\t") ? "\t" : "|").map(x => x.trim()); const p = findProg(c[0] || ""); const v = p && p.versions.find(x => x.year === Number(c[1])); const body = (BF_BODIES.find(([, re]) => re.test(c[2] || "")) || [])[0]; const date = bfDate(c[4]);
    const why = !p ? "ไม่พบหลักสูตร" : !v ? `ไม่พบฉบับ ${c[1]}` : !body ? "ไม่รู้จักคณะกรรมการ" : !/^\d{1,3}\/\d{4}$/.test(c[3] || "") ? "ครั้งที่ไม่ถูกต้อง" : !date ? "วันที่ไม่ถูกต้อง" : "";
    if (why) bad.push(`บรรทัด ${i + 1}: ${why}`); else ok.push({ p, v, body, no: c[3], date, ref: c[5] || "ทะเบียนมติสำนักงานสภา" }); });
  if (!lines.length || bad.length) { formErrors(f, { rows: bad.length ? bad.slice(0, 8).join(" · ") : "ไม่มีข้อมูล" }); return; }
  ok.forEach(x => { x.v.resolutions = (x.v.resolutions || []).filter(r => r.body !== x.body); const r = { body: x.body, no: x.no, date: x.date, result: "APPROVED", ref: x.ref, source: "COUNCIL_LIST", verified: true, verifiedBy: S.user, by: S.user, at: today() }; x.v.resolutions.push(r); attestResolution(x.p, x.v, r); });
  S.ui.bfImportMsg = `นำเข้าและปิดบันทึก ${ok.length} มติ (${new Set(ok.map(x => x.p.id)).size} หลักสูตร)`; audit("นำเข้ารายการมติ", `${ok.length} มติ`); persist(); rerender();
});
RES_SRC.COUNCIL_LIST = ["ทะเบียนมติสำนักงานสภา", "good"];
(function () { const g = NAV.find(x => x[0] === "หลักสูตร")[1]; const i = g.findIndex(x => x[0] === "resolutions"); g.splice(i + 1, 0, ["backfill", "บันทึกประวัติย้อนหลัง", "program.view"]); })();
