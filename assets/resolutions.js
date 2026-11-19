/* resolutions.js — G11 มติของคณะกรรมการ (คณะ/กลั่นกรอง/บัณฑิตศึกษา/สภาวิชาการ/สภามหาวิทยาลัย) ต่อฉบับหลักสูตร
   - หลักสูตรเดิม: บันทึกย้อนหลังได้ เว้นว่างได้ถ้าไม่มีข้อมูล (สถานะ "ไม่มีข้อมูล")
   - หลักสูตรใหม่/ฉบับปรับปรุงที่เดินเรื่องในระบบ: บังคับบันทึกครั้งที่ + วันที่ ทุกขั้น (ไม่มีจะบันทึกมติไม่ได้) */
"use strict";

const RES_SRC = { WORKFLOW: ["บันทึกผ่านระบบ", "good"], BACKFILL: ["บันทึกย้อนหลัง", "info"], TQF2_PDF: ["จากเล่ม มคอ.2", "info"], VERIFIED: ["CC ยืนยันแล้ว", "good"] };
function routeOfVersion(p, v) { const grad = ["MASTER", "DOCTOR", "GRAD_DIP"].includes(p.level); return D.meta.routes[v.kind === "NEW" && !grad ? "NEW" : grad ? "NEW_GRAD" : "REVISION"] || D.meta.routes.REVISION; }
function resolutionsOf(p, v) {
  const list = (v.resolutions || []).slice();
  D.workflow.cases.filter(c => c.ver === v.id).forEach(c => c.steps.filter(s => s.status === "DONE").forEach(s => {
    if (list.some(r => r.body === s.body)) return; const m = s.meeting ? IDX.meeting.get(s.meeting) : null;
    list.push({ body: s.body, no: s.meetingNo || (m ? m.no : ""), date: s.date, result: s.result, note: s.note, source: "WORKFLOW", sim: !s.meetingNo && !m });
  }));
  return list;
}
function resolutionGaps(p, v) { const have = new Set(resolutionsOf(p, v).filter(r => r.no && r.date).map(r => r.body)); return routeOfVersion(p, v).filter(b => !have.has(b)); }

/* ---------- บังคับครั้งที่/วันที่ เมื่อบันทึกมติในเส้นทางอนุมัติ ---------- */
act("case-resolve", el => {
  const c = IDX.case.get(Number(el.dataset.id)); const cur = currentStep(c); const m = cur.meeting ? IDX.meeting.get(cur.meeting) : null;
  openModal(`บันทึกมติ ${BODY_TH(cur.body)}`, `<form data-form="case-resolve" data-id="${c.id}"><p>${esc(c.title)}</p><div class="form-grid">
    ${field("no", "การประชุมครั้งที่", { value: m ? m.no : "", required: true, placeholder: "เช่น 11/2569" })}${field("date", "วันที่ประชุม/มีมติ", { type: "date", value: m ? m.date : today(), required: true })}
    ${field("result", "มติ", { type: "select", options: Object.entries(RESULT_TH).map(([k, v]) => [k, v[0]]), required: true, full: true })}
    ${field("note", "ข้อสังเกต/เงื่อนไข", { type: "textarea", full: true, hint: "จำเป็นเมื่อมติมีเงื่อนไข ส่งกลับ หรือไม่เห็นชอบ" })}${field("letter", "เลขที่หนังสือแจ้งมติ", { placeholder: "อว 0605.x/xxxx" })}</div>
    <div class="note">หลักสูตรใหม่/ฉบับปรับปรุง: <b>บังคับ</b>ครั้งที่และวันที่ทุกขั้น (G11) — ใช้ในทะเบียนการปรับปรุงและเอกสารเสนอ สป.อว.</div>
    <div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึกมติ</button></div></form>`);
});
const _caseResolveForm = FORMS["case-resolve"];
FORMS["case-resolve"] = (d, f) => {
  const errs = {}; if (!/^\d{1,3}\/\d{4}$/.test(d.no || "")) errs.no = "รูปแบบ ครั้งที่/ปี พ.ศ. เช่น 11/2569"; if (!d.date) errs.date = "ระบุวันที่";
  if (Object.keys(errs).length) { formErrors(f, errs); return; }
  const c = IDX.case.get(Number(f.dataset.id)); const cur = currentStep(c); const body = cur.body;
  cur.meetingNo = d.no;
  _caseResolveForm(d, f);
  const s = c.steps.find(x => x.body === body); if (s && s.status === "DONE") { s.date = d.date; s.meetingNo = d.no; }
  const { v } = IDX.ver.get(c.ver) || {}; if (v && s && s.status === "DONE") { v.resolutions = (v.resolutions || []).filter(r => r.body !== body); v.resolutions.push({ body, no: d.no, date: d.date, result: d.result, note: d.note, letter: d.letter, source: "WORKFLOW", by: S.user }); persist(); }
};

/* ---------- หน้าจัดการมติ ---------- */
route("resolutions", { perm: "program.view", title: "มติหลักสูตร", render(args) {
  if (args[0]) return resolutionDetail(Number(args[0]));
  const f = S.filters.res || {}; const canEd = canAny("program.edit|approval.resolve");
  const rows = D.programs.filter(inScope).filter(p => !f.fac || p.fac === f.fac).map(p => { const v = activeVer(p); return { p, v, gaps: resolutionGaps(p, v), list: resolutionsOf(p, v) }; })
    .filter(x => !f.only || (f.only === "gap" ? x.gaps.length : !x.gaps.length));
  const pg = paged("res", rows, 30); const bodies = ["FACULTY_BOARD", "CURRICULUM_SCREENING", "GRADUATE_SCHOOL", "ACADEMIC_SENATE", "UNIVERSITY_COUNCIL"];
  const full = rows.filter(x => !x.gaps.length).length;
  return pageHead("มติหลักสูตร (คณะ · กลั่นกรอง · บัณฑิตศึกษา · สภาวิชาการ · สภามหาวิทยาลัย)", { lead: "ฉบับปัจจุบันของทุกหลักสูตร — หลักสูตรเดิมบันทึกย้อนหลังได้ (เว้นว่างได้ถ้าไม่มีข้อมูล) · หลักสูตรใหม่/ปรับปรุงที่เดินเรื่องในระบบบันทึกอัตโนมัติและบังคับครั้งที่/วันที่ (G11)" }) +
    `<div class="grid g4"><div class="panel stat"><span class="label">ฉบับปัจจุบัน</span><span class="value">${fmt(rows.length)}</span></div><div class="panel stat"><span class="label">มติครบทุกขั้น</span><span class="value">${fmt(full)}</span></div><div class="panel stat"><span class="label">ยังขาดบางขั้น</span><span class="value">${fmt(rows.length - full)}</span><span class="sub">บันทึกย้อนหลังได้</span></div><div class="panel stat"><span class="label">ข้อมูลจริงจากเล่ม/ระบบ</span><span class="value">${fmt(rows.filter(x => x.list.some(r => !r.sim)).length)}</span></div></div>
    <section class="panel"><header><form class="filters" data-form="res-filter" style="width:100%"><select name="fac" aria-label="คณะ"><option value="">ทุกคณะ</option>${D.meta.faculties.map(x => `<option value="${x.id}"${f.fac === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><select name="only" aria-label="สถานะ"><option value="">ทั้งหมด</option><option value="gap"${f.only === "gap" ? " selected" : ""}>ยังขาดมติ</option><option value="full"${f.only === "full" ? " selected" : ""}>ครบ</option></select><button class="btn primary" type="submit">กรอง</button></form></header></section>` +
    panel(`${fmt(rows.length)} ฉบับ`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#resolutions-${x.p.id}">${esc(progTitle(x.p, true))}</a><br><span class="muted small">ฉบับ พ.ศ. ${x.v.year}</span>` }]
      .concat(bodies.map(b => ({ th: BODY_SHORT[b] || b, html: x => { if (!routeOfVersion(x.p, x.v).includes(b)) return `<span class="muted">—</span>`; const r = x.list.find(y => y.body === b && y.no); return r ? `<span class="small">${esc(r.no)}<br>${thDate(r.date)}</span> ${r.sim ? pill("จำลอง", "neutral") : ""}` : pill("ไม่มีข้อมูล", "warn"); } })))
      .concat([{ th: "", html: x => `<a class="btn sm" href="#resolutions-${x.p.id}">${canEd ? "บันทึก" : "ดู"}</a>` }]), pg.rows), { flush: true }) + pg.pager;
} });
form("res-filter", d => { S.filters.res = d; S.ui["pg-res"] = 1; rerender(); });
function resolutionDetail(pid) {
  const p = IDX.prog.get(pid); if (!p) return `<div class="note bad">ไม่พบหลักสูตร</div>`;
  const vs = [...p.versions].sort((a, b) => b.year - a.year); const canEd = (can("program.edit") && (myFac(p) || me().scope.type === "UNIVERSITY")) || can("approval.resolve");
  return pageHead(`มติของ ${progTitle(p, true)}`, { crumbs: `<a href="#resolutions">มติหลักสูตร</a>`, actions: `<a class="btn" href="#program-${p.id}-history">ประวัติการปรับปรุง</a>` }) +
    vs.map(v => { const list = resolutionsOf(p, v); const route = routeOfVersion(p, v); const inSystem = D.workflow.cases.some(c => c.ver === v.id);
      return panel(`ฉบับ พ.ศ. ${v.year} (${VSTATE[v.state][0]})${inSystem ? " — เดินเรื่องในระบบ: บังคับบันทึก" : " — บันทึกย้อนหลังได้"}`, table([{ th: "คณะกรรมการ", val: b => BODY_TH(b) }, { th: "ครั้งที่", val: b => (list.find(r => r.body === b) || {}).no || "—" }, { th: "วันที่", val: b => { const r = list.find(x => x.body === b); return r && r.date ? thDate(r.date, true) : "—"; } },
        { th: "มติ", val: b => { const r = list.find(x => x.body === b); return r && r.result ? (RESULT_TH[r.result] || [r.result])[0] : "—"; } }, { th: "ที่มา", html: b => { const r = list.find(x => x.body === b); return r ? pillOf(RES_SRC, r.verified ? "VERIFIED" : r.source) + (r.sim ? " " + pill("จำลอง", "neutral") : "") : pill(inSystem && v.state !== "APPROVED" ? "รอขั้นนี้" : "ไม่มีข้อมูล", "warn"); } },
        { th: "", html: b => { const r = list.find(x => x.body === b); return `<span class="actions">${canEd && (!r || r.source !== "WORKFLOW" || r.sim) && !(inSystem && v.state !== "APPROVED") ? btn(r && !r.sim ? "แก้" : "บันทึกย้อนหลัง", "res-edit", { sm: true, data: { ver: v.id, body: b } }) : ""}${r && !r.verified && !r.sim && can("approval.resolve") ? btn("ยืนยัน", "res-verify", { sm: true, data: { ver: v.id, body: b } }) : ""}</span>`; } }], route), { flush: true }); }).join("") +
    `<p class="muted small">ข้อมูลที่ระบบจำลองไว้ (ป้าย "จำลอง") ถูกแทนเมื่อบันทึกจริง · การบันทึกย้อนหลังเข้าทะเบียนการปรับปรุง (D12) และ audit</p>`;
}
act("res-edit", el => {
  const { p, v } = IDX.ver.get(Number(el.dataset.ver)); const r = (v.resolutions || []).find(x => x.body === el.dataset.body) || {};
  openModal(`บันทึกมติย้อนหลัง — ${BODY_TH(el.dataset.body)} (ฉบับ พ.ศ. ${v.year})`, `<form data-form="res-save" data-ver="${v.id}" data-body="${el.dataset.body}"><div class="form-grid">
    ${field("no", "การประชุมครั้งที่", { value: r.no, required: true, placeholder: "เช่น 3/2565" })}${field("date", "วันที่", { type: "date", value: r.date, required: true })}
    ${field("result", "มติ", { type: "select", options: Object.entries(RESULT_TH).map(([k, x]) => [k, x[0]]), value: r.result || "APPROVED", blank: false })}${field("ref", "หลักฐาน (เลขที่หนังสือ/หน้าในรายงานการประชุม)", { value: r.ref, full: true })}
    ${field("note", "หมายเหตุ", { type: "textarea", value: r.note, full: true, rows: 2 })}</div>
    <div class="note">ไม่ทราบข้อมูล → ไม่ต้องบันทึก (สถานะ "ไม่มีข้อมูล") · บันทึกแล้วรอเจ้าหน้าที่หลักสูตรส่วนกลางยืนยัน</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`);
});
form("res-save", (d, f) => {
  const errs = {}; if (!/^\d{1,3}\/\d{4}$/.test(d.no || "")) errs.no = "รูปแบบ ครั้งที่/ปี พ.ศ."; if (!d.date) errs.date = "ระบุวันที่"; if (!formErrors(f, errs)) return;
  const { p, v } = IDX.ver.get(Number(f.dataset.ver)); const body = f.dataset.body;
  v.resolutions = (v.resolutions || []).filter(r => r.body !== body); v.resolutions.push({ body, no: d.no, date: d.date, result: d.result, ref: d.ref, note: d.note, source: "BACKFILL", by: S.user, at: today() });
  if (body === "UNIVERSITY_COUNCIL") { v.senate = d.date; const rec = (D.hist.records || []).find(r => r.ver === v.id && ["NEW", "MAJOR"].includes(r.kind)); if (rec && !rec.hash) rec.council = { no: d.no, date: d.date }; }
  audit("บันทึกมติย้อนหลัง", `${p.code} ${v.year} ${BODY_TH(body)} ${d.no}`); persist(); closeModal(); toast("บันทึกแล้ว — รอยืนยัน"); rerender();
});
act("res-verify", el => { const { v } = IDX.ver.get(Number(el.dataset.ver)); const r = (v.resolutions || []).find(x => x.body === el.dataset.body); if (r) { r.verified = true; r.verifiedBy = S.user; } else { const w = resolutionsOf(IDX.ver.get(Number(el.dataset.ver)).p, v).find(x => x.body === el.dataset.body); if (w) { v.resolutions = (v.resolutions || []).concat([Object.assign({}, w, { verified: true, verifiedBy: S.user })]); } } persist(); rerender(); });
(function () { const g = NAV.find(x => x[0] === "หลักสูตร")[1]; g.splice(2, 0, ["resolutions", "มติหลักสูตร (ย้อนหลัง)", "program.view"]); })();
