/* screens-work.js — S13 อนุมัติ · S14 ประชุม · S15 CISA · S16 สมอ.08 · S07 รายวิชา · S10 อาจารย์ · S11 ผลงาน · S12 รายการการเงิน */
"use strict";

/* ---------------- S13 การอนุมัติ ---------------- */
route("approvals", { perm: "approval.view", title: "การอนุมัติหลักสูตร", render() {
  const f = S.filters.case || {}; let rows = casesForMe();
  if (f.status) rows = rows.filter(c => c.status === f.status); if (f.body) rows = rows.filter(c => (currentStep(c) || {}).body === f.body); if (f.type) rows = rows.filter(c => c.type === f.type);
  const by = {}; casesForMe().forEach(c => { const k = c.status === "IN_PROGRESS" ? (currentStep(c) || {}).body : c.status; by[k] = (by[k] || 0) + 1; });
  return pageHead("การอนุมัติหลักสูตร", { lead: "เส้นทางตั้งค่าได้ (D6): คณะ → กลั่นกรองหลักสูตร → (บัณฑิตวิทยาลัย) → สภาวิชาการ → สภามหาวิทยาลัย · ค่าชั่วคราวรอยืนยันจากสำนักงานสภา (P08)" }) +
    `<div class="grid g4">${[["DRAFT", "ร่าง"], ["FACULTY_BOARD", "รอคณะ"], ["CURRICULUM_SCREENING", "รอกลั่นกรอง"], ["ACADEMIC_SENATE", "รอสภาวิชาการ"], ["UNIVERSITY_COUNCIL", "รอสภามหาวิทยาลัย"], ["GRADUATE_SCHOOL", "รอบัณฑิตวิทยาลัย"], ["APPROVED", "อนุมัติครบ"], ["RETURNED", "ส่งกลับแก้ไข"]].map(([k, t]) => `<div class="panel stat"><span class="label">${t}</span><span class="value">${by[k] || 0}</span></div>`).join("")}</div>` +
    `<section class="panel"><header><form class="filters" data-form="case-filter">${field("status", "สถานะ", { type: "select", options: Object.entries(CASE_STATUS).map(([k, v]) => [k, v[0]]), value: f.status })}${field("body", "ขั้นปัจจุบัน", { type: "select", options: D.meta.bodies.map(b => [b.code, b.th]), value: f.body })}${field("type", "ประเภท", { type: "select", options: Object.entries(CASE_TYPE).map(([k, v]) => [k, v]), value: f.type })}<div class="actions"><button class="btn primary" type="submit">กรอง</button>${btn("ล้าง", "case-clear")}</div></form></header>
    <div class="body flush">${table([{ th: "เลขที่", html: c => `<a class="mono" href="#case-${c.id}">${c.no}</a>` }, { th: "เรื่อง", wrap: true, html: c => `<a href="#case-${c.id}">${esc(c.title)}</a><br><span class="muted small">${esc(IDX.fac.get(IDX.prog.get(c.prog).fac).name)}</span>` }, { th: "ประเภท", val: c => CASE_TYPE[c.type] }, { th: "สถานะ / ขั้น", html: c => pillOf(CASE_STATUS, c.status) + "<br><span class='small'>" + esc(caseStageText(c)) + "</span>" }, { th: "ความคืบหน้า", html: c => { const d = c.steps.filter(s => s.status === "DONE").length; return `<div class="meter" style="width:90px"><i style="width:${d * 100 / c.steps.length}%"></i></div><span class="muted small">${d}/${c.steps.length}</span>`; } }, { th: "เริ่ม", val: c => thDate(c.created) }], rows.sort((a, b) => b.created.localeCompare(a.created)))}</div></section>`;
} });
form("case-filter", d => { S.filters.case = d; rerender(); });
act("case-clear", () => { S.filters.case = {}; rerender(); });

route("case", { perm: "approval.view", title: "เรื่องเสนออนุมัติ", render(args) {
  const c = IDX.case.get(Number(args[0])); if (!c) return `<div class="note bad">ไม่พบเรื่อง</div>`;
  const p = IDX.prog.get(c.prog); const v = (IDX.ver.get(c.ver) || {}).v; const cur = currentStep(c); const u = me();
  const pf = cisaPreflight(p); const st = standardsCheck(p);
  const mine4 = u.role === "FC" && myFac(p);
  const acts = [];
  if (["DRAFT", "RETURNED"].includes(c.status) && mine4 && can("program.submit")) acts.push(btn(c.status === "DRAFT" ? "ส่งเข้าเส้นทางอนุมัติ" : "ส่งใหม่หลังแก้ไข", "case-submit", { kind: "primary", data: { id: c.id } }));
  if (cur && c.status === "IN_PROGRESS" && cur.body === "FACULTY_BOARD" && can("approval.faculty") && p.fac === u.scope.fac) acts.push(btn("บันทึกผลระดับคณะ", "case-resolve", { kind: "primary", data: { id: c.id } }));
  if (cur && c.status === "IN_PROGRESS" && cur.body !== "FACULTY_BOARD" && can("approval.schedule")) acts.push(btn(cur.meeting ? "เปลี่ยนวาระการประชุม" : "บรรจุวาระ", "case-schedule", { data: { id: c.id }, kind: cur.meeting ? "" : "primary" }));
  if (cur && c.status === "IN_PROGRESS" && cur.body !== "FACULTY_BOARD" && cur.meeting && can("approval.resolve")) acts.push(btn("บันทึกมติ", "case-resolve", { kind: "primary", data: { id: c.id } }));
  return pageHead(c.title, { crumbs: `<a href="#approvals">การอนุมัติหลักสูตร</a> › <span class="mono">${c.no}</span>`, lead: `${pillOf(CASE_STATUS, c.status)} ${esc(caseStageText(c))} · ผู้เสนอ ${esc(userName(c.by))} · เริ่ม ${thDate(c.created)} ${srcPill(false)}`,
    actions: acts.join("") + btn("แบบเสนอวาระ", "open-doc", { data: { code: "DOC-AGENDA", id: c.id } }) + `<a class="btn" href="#program-${p.id}">หน้าหลักสูตร</a>` }) +
    `<div class="grid g-side">${panel("เส้นทางอนุมัติ", stepsMini(c))}<div class="grid">
      ${panel("ฉบับที่เสนอ", kv([["หลักสูตร", `<a href="#program-${p.id}">${esc(progTitle(p))}</a>`], ["ฉบับ", v ? `พ.ศ. ${v.year} · ${pillOf(VSTATE, v.state)}` : "—"], ["หน่วยกิต", v ? v.credits : "—"], ["เส้นทาง", esc(c.route)]]) + (v && ["DRAFT", "IN_REVIEW"].includes(v.state) && canEditProg(p) ? `<p><a class="btn sm" href="#edit-${v.id}">แก้ไขฉบับ</a></p>` : ""))}
      ${panel("ตรวจความพร้อมก่อนเสนอ", `<ul class="list"><li><span>อาจารย์ผ่านเกณฑ์ 2565</span>${st.ok ? pill("ผ่าน", "good") : pill(`ไม่ผ่าน ${st.fails}`, "bad")}</li><li><span>มีโครงสร้างหลักสูตร</span>${structureOf(p) ? pill("มี", "good") : pill("ไม่มี", "warn")}</li><li><span>มี PLO/mapping</span>${obeOf(p) ? pill("มี", "good") : pill("ไม่มี", "warn")}</li><li><span>วิเคราะห์จุดคุ้มทุน</span>${D.finance.scenarios[p.id] ? pill(D.finance.scenarios[p.id].status === "SIGNED" ? "ลงนามแล้ว" : "ร่าง", D.finance.scenarios[p.id].status === "SIGNED" ? "good" : "warn") : pill("ไม่มี", "warn")}</li></ul>`, { flush: true })}
      ${panel("เอกสารประกอบวาระ", `<ul class="list">${[["DOC-TQF2", "ร่างเล่ม มคอ.2"], ["DOC-FINANCE", "ตารางต้นทุน/จุดคุ้มทุน"], ["DOC-STD2565", "ผลตรวจเกณฑ์ 2565"]].map(([k, t]) => `<li><span>${t}</span>${btn("เปิด", "open-doc", { sm: true, data: { code: k, id: p.id } })}</li>`).join("")}</ul>`, { flush: true })}
    </div></div>` + (c.status === "APPROVED" && IDX.level.get(p.level).channel === "CISA" ? `<div class="note info">อนุมัติครบเส้นทางแล้ว — ขั้นต่อไป: นายทะเบียนหลักสูตรเตรียมชุด CISA ภายใน 7 วัน (${pf.filter(x => !x.ok).length ? `pre-flight ยังไม่ผ่าน ${pf.filter(x => !x.ok).length} ข้อ` : "pre-flight ผ่านครบ"}) <a href="#cisa-${p.id}">ไปที่ CISA</a></div>` : "");
} });
act("case-submit", el => {
  const c = IDX.case.get(Number(el.dataset.id)); const p = IDX.prog.get(c.prog); const st = standardsCheck(p);
  if (!st.ok) { openModal("ยังส่งไม่ได้", `<div class="note bad">อาจารย์ผู้รับผิดชอบหลักสูตรยังไม่ผ่านเกณฑ์ 2565 (${st.fails} รายการ) — แก้ที่แท็บอาจารย์ก่อนส่ง</div><div class="form-foot">${btn("ปิด", "close-modal")}<a class="btn primary" href="#program-${p.id}-staff">ไปที่แท็บอาจารย์</a></div>`); return; }
  c.status = "IN_PROGRESS"; const s = c.steps.find(x => x.status === "CURRENT") || c.steps[0]; s.status = "CURRENT"; s.result = null;
  const v = (IDX.ver.get(c.ver) || {}).v; if (v) v.state = "IN_REVIEW";
  notifyRole("UX", p.fac, `มีเรื่องรอเห็นชอบระดับคณะ: ${c.title}`, "case-" + c.id); audit("ส่งเข้าเส้นทางอนุมัติ", c.no); persist(); toast("ส่งเรื่องแล้ว — แจ้งคณบดีเพื่อนำเข้าที่ประชุมคณะ"); rerender();
});
act("case-schedule", el => {
  const c = IDX.case.get(Number(el.dataset.id)); const cur = currentStep(c);
  const ms = D.workflow.meetings.filter(m => m.body === cur.body && m.status === "SCHEDULED");
  openModal(`บรรจุวาระ ${BODY_TH(cur.body)}`, ms.length ? `<form data-form="case-schedule" data-id="${c.id}">${field("meeting", "การประชุม", { type: "select", options: ms.map(m => [m.id, `ครั้งที่ ${m.no} · ${thDate(m.date, true)} · ปิดรับวาระ ${thDate(m.deadline)}`]), required: true, value: cur.meeting })}
    <div class="note">กฎปฏิทิน: ${esc((IDX.body.get(cur.body) || {}).rule)} · การประชุมที่เลยวันปิดรับวาระจะเตือน</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บรรจุวาระ</button></div></form>` : `<div class="empty">ยังไม่มีการประชุมที่กำหนดไว้ — เพิ่มที่ปฏิทินประชุม</div>`);
});
form("case-schedule", (d, f) => {
  if (!formErrors(f, d.meeting ? {} : { meeting: "เลือกการประชุม" })) return;
  const c = IDX.case.get(Number(f.dataset.id)); const m = IDX.meeting.get(Number(d.meeting)); currentStep(c).meeting = m.id;
  const late = m.deadline < today(); audit("บรรจุวาระ", `${c.no} → ${BODY_TH(m.body)} ${m.no}`); persist(); closeModal(); toast(late ? "บรรจุแล้ว — เลยวันปิดรับวาระ ต้องขออนุมัติเป็นวาระเพิ่มเติม" : "บรรจุวาระแล้ว"); rerender();
});
act("case-resolve", el => {
  const c = IDX.case.get(Number(el.dataset.id)); const cur = currentStep(c); const m = cur.meeting ? IDX.meeting.get(cur.meeting) : null;
  openModal(`บันทึกมติ ${BODY_TH(cur.body)}`, `<form data-form="case-resolve" data-id="${c.id}"><p>${esc(c.title)}</p>${m ? `<p class="muted">การประชุมครั้งที่ ${esc(m.no)} วันที่ ${thDate(m.date, true)}</p>` : ""}<div class="form-grid">
    ${field("result", "มติ", { type: "select", options: Object.entries(RESULT_TH).map(([k, v]) => [k, v[0]]), required: true, full: true })}
    ${field("note", "ข้อสังเกต/เงื่อนไข", { type: "textarea", full: true, hint: "จำเป็นเมื่อมติมีเงื่อนไข ส่งกลับ หรือไม่เห็นชอบ" })}${field("letter", "เลขที่หนังสือแจ้งมติ", { placeholder: "อว 0605.x/xxxx" })}${field("date", "วันที่มีมติ", { type: "date", value: today(), required: true })}</div>
    <div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึกมติ</button></div></form>`);
});
form("case-resolve", (d, f) => {
  const errs = {}; if (!d.result) errs.result = "เลือกมติ"; if (d.result && d.result !== "APPROVED" && !d.note) errs.note = "ระบุข้อสังเกต/เหตุผล"; if (!d.date) errs.date = "ระบุวันที่";
  if (!formErrors(f, errs)) return;
  const c = IDX.case.get(Number(f.dataset.id)); const body = currentStep(c).body; advanceCase(c, d.result, d.note + (d.letter ? ` (หนังสือ ${d.letter})` : ""));
  audit("บันทึกมติ", `${c.no} ${BODY_TH(body)} ${RESULT_TH[d.result][0]}`); persist(); closeModal();
  toast(c.status === "APPROVED" ? "อนุมัติครบเส้นทาง — ล็อกฉบับและส่ง program.version.approved แล้ว" : c.status === "RETURNED" ? "ส่งกลับให้คณะแก้ไข" : `บันทึกแล้ว — ไปขั้น ${BODY_TH((currentStep(c) || {}).body)}`); rerender();
});

/* ---------------- S14 ปฏิทินประชุม ---------------- */
route("meetings", { perm: null, title: "ปฏิทินประชุม", render() {
  if (!canAny("approval.schedule|approval.resolve|approval.faculty|approval.view")) return `<div class="note bad">${esc(denyMsg("approval.view"))}</div>`;
  const ms = [...D.workflow.meetings].sort((a, b) => a.date.localeCompare(b.date));
  const months = {}; ms.forEach(m => { const k = m.date.slice(0, 7); (months[k] = months[k] || []).push(m); });
  return pageHead("ปฏิทินประชุม", { lead: "กฎปฏิทินเป็นค่าตั้งค่า (สภาวิชาการ ศุกร์ที่ 2 ของเดือน · กลั่นกรอง ≥ 20 วันก่อนสภาวิชาการ) — PROVISIONAL (P08)", actions: btn("+ เพิ่มการประชุม", "meeting-add", { kind: "primary", perm: "approval.schedule" }) }) +
    Object.entries(months).map(([k, list]) => { const [y, mo] = k.split("-").map(Number);
      return panel(`${TH_MONTH_FULL[mo - 1]} ${y + 543}`, table([{ th: "วันที่", val: m => thDate(m.date) }, { th: "คณะกรรมการ", html: m => `<a href="#meeting-${m.id}">${esc(BODY_TH(m.body))}</a>${m.fac ? ` <span class="muted small">${esc(IDX.fac.get(m.fac).abbr)}</span>` : ""}` }, { th: "ครั้งที่", val: m => m.no }, { th: "ปิดรับวาระ", val: m => thDate(m.deadline) }, { th: "วาระหลักสูตร", num: true, val: m => D.workflow.cases.filter(c => c.steps.some(s => s.meeting === m.id)).length }, { th: "สถานะ", html: m => m.status === "DONE" ? pill("ประชุมแล้ว", "neutral") : pill("กำหนดการ", "info") }], list), { flush: true }); }).join("");
} });
route("meeting", { perm: null, title: "การประชุม", render(args) {
  const m = IDX.meeting.get(Number(args[0])); if (!m) return `<div class="note bad">ไม่พบการประชุม</div>`;
  const items = D.workflow.cases.filter(c => c.steps.some(s => s.meeting === m.id));
  return pageHead(`${BODY_TH(m.body)} ครั้งที่ ${m.no}`, { crumbs: `<a href="#meetings">ปฏิทินประชุม</a>`, lead: `${thDate(m.date, true)} · ปิดรับวาระ ${thDate(m.deadline)} · ${m.status === "DONE" ? "ประชุมแล้ว" : "กำหนดการ"} ${srcPill(false)}`, actions: btn("รายงานการประชุม (วาระหลักสูตร)", "open-doc", { data: { code: "DOC-RESOLUTION", id: m.id }, perm: "approval.resolve" }) }) +
    panel(`วาระเกี่ยวกับหลักสูตร (${items.length})`, table([{ th: "ลำดับ", val: c => "4." + (items.indexOf(c) + 1) }, { th: "เรื่อง", wrap: true, html: c => `<a href="#case-${c.id}">${esc(c.title)}</a>` }, { th: "มติ", html: c => { const s = c.steps.find(x => x.meeting === m.id); return s && s.result ? pillOf(RESULT_TH, s.result) : pill("รอมติ", "warn"); } }, { th: "", html: c => { const s = currentStep(c); return s && s.meeting === m.id && can("approval.resolve") ? btn("บันทึกมติ", "case-resolve", { sm: true, data: { id: c.id } }) : btn("แบบเสนอวาระ", "open-doc", { sm: true, data: { code: "DOC-AGENDA", id: c.id } }); } }], items, { empty: "ยังไม่มีวาระหลักสูตร" }), { flush: true });
} });
act("meeting-add", () => openModal("เพิ่มการประชุม", `<form data-form="meeting-add"><div class="form-grid">${field("body", "คณะกรรมการ", { type: "select", options: D.meta.bodies.map(b => [b.code, b.th]), required: true, full: true })}${field("no", "ครั้งที่", { required: true, placeholder: "เช่น 12/2569" })}${field("date", "วันที่ประชุม", { type: "date", required: true })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`));
form("meeting-add", (d, f) => {
  const errs = {}; if (!d.body) errs.body = "เลือกคณะกรรมการ"; if (!/^\d+\/\d{4}$/.test(d.no)) errs.no = "รูปแบบ ครั้งที่/ปี เช่น 12/2569"; if (!d.date) errs.date = "ระบุวันที่"; else if (d.date < today()) errs.date = "วันที่ต้องไม่ย้อนหลัง";
  if (!formErrors(f, errs)) return; const lead = d.body === "CURRICULUM_SCREENING" ? 20 : 10;
  const m = { id: Math.max(...D.workflow.meetings.map(x => x.id)) + 1, body: d.body, no: d.no, date: d.date, fac: null, status: "SCHEDULED", deadline: addDays(d.date, -lead) };
  D.workflow.meetings.push(m); IDX.meeting.set(m.id, m); audit("เพิ่มการประชุม", `${BODY_TH(d.body)} ${d.no}`); persist(); closeModal(); toast(`เพิ่มการประชุมแล้ว — ปิดรับวาระ ${thDate(m.deadline)}`); rerender();
});

/* ---------------- S15 CISA ---------------- */
route("cisa", { perm: "cisa.view", title: "CISA และการรับรอง", render(args) {
  if (args[0]) return cisaDetail(IDX.prog.get(Number(args[0])));
  const rows = D.workflow.cisa.map(c => ({ c, p: IDX.prog.get(c.prog), sla: cisaSla(c) })).filter(r => r.p && inScope(r.p));
  const inprog = rows.filter(r => r.c.step < 12); const pending = D.workflow.cases.filter(c => c.status === "APPROVED" && !D.workflow.cisa.find(x => x.ver === c.ver) && IDX.level.get(IDX.prog.get(c.prog).level).channel === "CISA");
  return pageHead("CISA และการรับรองหลักสูตร", { lead: "CISA ไม่มี API ให้สถาบัน (D7) — CMS ทำชุดเตรียมกรอก ตรวจ pre-flight และให้นายทะเบียนหลักสูตรบันทึกสถานะกลับ · SLA สป.อว. 90 วัน (กมอ. 2568)", actions: btn("รายงานสถานะ CISA", "open-doc", { data: { code: "RPT-CISA-SLA" }, perm: "cisa.view" }) }) +
    `<div class="grid g4"><div class="panel stat"><span class="label">รอเตรียมส่ง (มติสภาแล้ว)</span><span class="value">${pending.length}</span></div><div class="panel stat"><span class="label">อยู่ระหว่างดำเนินการ</span><span class="value">${inprog.length}</span></div><div class="panel stat"><span class="label">ใกล้ครบ 90 วัน (&lt; 30 วัน)</span><span class="value">${inprog.filter(r => r.sla && r.sla.left != null && r.sla.left < 30).length}</span></div><div class="panel stat"><span class="label">สป.อว. รับทราบแล้ว</span><span class="value">${rows.length - inprog.length}</span></div></div>` +
    (pending.length ? panel("รอเตรียมชุด CISA", table([{ th: "หลักสูตร", html: c => `<a href="#cisa-${c.prog}">${esc(progTitle(IDX.prog.get(c.prog), true))}</a>` }, { th: "อนุมัติเมื่อ", val: c => thDate(c.steps[c.steps.length - 1].date) }], pending), { flush: true }) : "") +
    panel("อยู่ระหว่างดำเนินการ", table([{ th: "หลักสูตร", html: r => `<a href="#cisa-${r.p.id}">${esc(progTitle(r.p, true))}</a>` }, { th: "ขั้น", html: r => `${r.c.step}/12 · ${esc(D.meta.cisaSteps[r.c.step - 1])}` }, { th: "ส่งเมื่อ", val: r => thDate(r.c.submitted) }, { th: "SLA", html: r => r.sla && r.sla.left != null ? pill(`เหลือ ${r.sla.left} วัน`, r.sla.left < 15 ? "bad" : r.sla.left < 45 ? "warn" : "good") : pill(r.sla ? "ช่วงสถาบัน " + r.sla.days + " วัน" : "—", "neutral") }, { th: "", html: r => r.c.returned ? pill("ส่งกลับแก้ไข", "bad") : "" }], inprog, { empty: "ไม่มี" }), { flush: true });
} });
function cisaDetail(p) {
  if (!p) return `<div class="note bad">ไม่พบหลักสูตร</div>`;
  let c = cisaOf(p); const pf = cisaPreflight(p); const sla = cisaSla(c);
  return pageHead(`CISA: ${progTitle(p, true)}`, { crumbs: `<a href="#cisa">CISA</a>`, lead: `รหัสหลักสูตร ${p.checoCode ? `<span class="mono">${p.checoCode}</span>` : "ยังไม่มี"} · ${c ? `ขั้น ${c.step}/12` : "ยังไม่ส่ง"}${sla && sla.left != null ? ` · SLA เหลือ ${sla.left} วัน` : ""} ${srcPill(false)}`,
    actions: btn("ชุดเตรียมกรอก CISA", "open-doc", { kind: "primary", data: { code: "DOC-CISA", id: p.id }, perm: "cisa.prepare" }) + btn("บันทึกสถานะ", "cisa-record", { data: { id: p.id }, perm: "cisa.record" }) + `<a class="btn" href="#program-${p.id}">หน้าหลักสูตร</a>` }) +
    `<div class="grid g2">${panel("Pre-flight 8 ข้อ (กมอ. ข้อ 5.1)", `<ul class="list">${pf.map(x => `<li><div class="grow"><b>${x.no}.</b> ${esc(x.th)}<br><span class="muted small">${esc(x.msg)}</span></div>${x.ok ? pill("ผ่าน", "good") : pill("ไม่ผ่าน", "bad")}</li>`).join("")}</ul>`, { flush: true })}
    ${panel("ขั้นตอนใน CISA", c ? cisaSteps(c) : `<div class="empty">ยังไม่ส่ง — กด “บันทึกสถานะ” เมื่อยื่นในเว็บ CISA แล้ว</div>`)}</div>`;
}
act("cisa-record", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const c = cisaOf(p) || {};
  openModal("บันทึกสถานะจากเว็บ CISA", `<form data-form="cisa-record" data-id="${p.id}"><div class="form-grid">${field("step", "ขั้นปัจจุบันใน CISA", { type: "select", options: D.meta.cisaSteps.map((t, i) => [i + 1, `${i + 1}. ${t}`]), value: c.step, required: true, full: true })}${field("submitted", "วันที่ยื่นจากสถาบัน", { type: "date", value: c.submitted || today(), required: true })}${field("returned", "สป.อว. ส่งกลับแก้ไข", { type: "select", options: [["0", "ไม่"], ["1", "ใช่"]], value: c.returned ? "1" : "0", blank: false })}${field("curCode", "รหัสหลักสูตรที่ได้รับ (14 หลัก)", { value: p.checoCode || "", hint: "กรอกเมื่อ สป.อว. รับทราบ (ขั้น 12)" })}${field("note", "ข้อเสนอแนะจาก สป.อว.", { type: "textarea", full: true })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`);
});
form("cisa-record", (d, f) => {
  const errs = {}; if (Number(d.step) === 12 && !/^\d{14}$/.test(d.curCode || "")) errs.curCode = "ขั้นรับทราบต้องมีรหัสหลักสูตร 14 หลัก"; if (!formErrors(f, errs)) return;
  const p = IDX.prog.get(Number(f.dataset.id)); let c = cisaOf(p);
  if (!c) { c = { prog: p.id, ver: activeVer(p).id }; D.workflow.cisa.push(c); }
  Object.assign(c, { step: Number(d.step), submitted: d.submitted, returned: d.returned === "1", ackDate: Number(d.step) === 12 ? today() : null });
  if (d.curCode) p.checoCode = d.curCode; if (Number(d.step) === 12) activeVer(p).ack = today();
  D.integ.deliveries.unshift({ id: Date.now(), event: "cisa.status.changed", client: "c5", at: today() + "T" + new Date().toTimeString().slice(0, 5), status: "DELIVERED", code: 200, attempts: 1 });
  audit("บันทึกสถานะ CISA", `${p.code} ขั้น ${d.step}`); persist(); closeModal(); toast("บันทึกสถานะ CISA แล้ว"); rerender();
});

/* ---------------- S16 สมอ.08 ---------------- */
route("amendments", { perm: null, title: "สมอ.08", render() {
  if (!canAny("amend.submit|amend.approve")) return `<div class="note bad">${esc(denyMsg("amend.submit"))}</div>`;
  const rows = D.workflow.amendments.filter(a => inScope(IDX.prog.get(a.prog)));
  return pageHead("สมอ.08 การปรับปรุงหลักสูตรเล็กน้อย", { lead: "เปลี่ยนอาจารย์ รายวิชา แผนรับ หรือแผนการเรียน ผูกกับฉบับที่อนุมัติแล้ว — เส้นทาง: คณะ → กลั่นกรอง → สภาวิชาการ (ตัดสิน) → แจ้งสภาเพื่อทราบ", actions: btn("+ ยื่น สมอ.08", "amend-new", { kind: "primary", perm: "amend.submit" }) }) +
    panel(`${rows.length} รายการ`, table([{ th: "เลขที่", html: a => `<span class="mono">${a.no}</span>` }, { th: "หลักสูตร", html: a => `<a href="#program-${a.prog}">${esc(progTitle(IDX.prog.get(a.prog), true))}</a>` }, { th: "ประเภท", val: a => AMEND_KIND[a.kind] }, { th: "รายละเอียด", wrap: true, html: a => esc(a.reason) + (a.kind === "CHANGE_STAFF" ? `<br><span class="muted small">ออก: ${esc(staffName(a.out))} → เข้า: ${esc(staffName(a.in))}</span>` : "") }, { th: "สถานะ", html: a => pillOf(AMEND_STATUS, a.status) }, { th: "", html: a => `<span class="actions">${amendAction(a)}${btn("แบบ สมอ.08", "open-doc", { sm: true, data: { code: "DOC-SMO08", id: a.id } })}</span>` }], rows), { flush: true });
} });
function amendAction(a) {
  const p = IDX.prog.get(a.prog); const u = me();
  if (a.status === "DRAFT" && can("approval.faculty") && p.fac === u.scope.fac) return btn("คณะเห็นชอบ", "amend-step", { sm: true, kind: "primary", data: { id: a.id, to: "FACULTY_APPROVED" } });
  if (a.status === "FACULTY_APPROVED" && can("amend.approve")) return btn("สภาวิชาการอนุมัติ", "amend-step", { sm: true, kind: "primary", data: { id: a.id, to: "SENATE_APPROVED" } });
  if (a.status === "SENATE_APPROVED" && can("amend.approve")) return btn("แจ้งสภา/สป.อว.", "amend-step", { sm: true, data: { id: a.id, to: "REPORTED" } });
  return "";
}
act("amend-step", el => {
  const a = D.workflow.amendments.find(x => x.id === Number(el.dataset.id)); a.status = el.dataset.to;
  if (a.status === "SENATE_APPROVED" && a.kind === "CHANGE_STAFF") {
    const r = D.roles.find(x => x.prog === a.prog && x.staff === a.out && !x.to); if (r) r.to = "1/2569";
    D.roles.push({ prog: a.prog, staff: a.in, role: "PROGRAM_RESPONSIBLE", seq: 9, from: "2/2569", to: null, amend: a.no }); buildIndex();
    D.integ.deliveries.unshift({ id: Date.now(), event: "staff-assignment.changed", client: "c1", at: today() + "T" + new Date().toTimeString().slice(0, 5), status: "DELIVERED", code: 200, attempts: 1 });
  }
  audit("พิจารณา สมอ.08", `${a.no} → ${AMEND_STATUS[a.status][0]}`); persist(); toast(`${a.no}: ${AMEND_STATUS[a.status][0]}`); rerender();
});
act("amend-new", () => {
  const progs = D.programs.filter(p => inScope(p) && (canEditProg(p) || can("amend.submit")) && latestVer(p).state === "APPROVED");
  openModal("ยื่น สมอ.08", `<form data-form="amend-new"><div class="form-grid">${field("prog", "หลักสูตร (ฉบับที่อนุมัติแล้ว)", { type: "select", options: progs.map(p => [p.id, `${progTitle(p, true)} (${p.latestYear})`]), required: true, full: true })}${field("kind", "ประเภทการปรับปรุง", { type: "select", options: Object.entries(AMEND_KIND), required: true, full: true })}${field("reason", "เหตุผลและรายละเอียด", { type: "textarea", required: true, full: true })}<div class="field full"><label for="f-out">กรณีเปลี่ยนอาจารย์: ออก / เข้า (รหัสบุคลากร)</label><div class="form-grid"><input id="f-out" name="out" type="text" placeholder="รหัสอาจารย์ที่ออก"><input id="f-in" name="in" type="text" placeholder="รหัสอาจารย์ที่เข้า"></div><span class="err" data-err="out"></span></div></div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">ยื่น สมอ.08</button></div></form>`);
});
form("amend-new", (d, f) => {
  const errs = {}; if (!d.prog) errs.prog = "เลือกหลักสูตร"; if (!d.kind) errs.kind = "เลือกประเภท"; if (!d.reason || d.reason.length < 10) errs.reason = "อธิบายอย่างน้อย 10 ตัวอักษร";
  if (d.kind === "CHANGE_STAFF") { const p = IDX.prog.get(Number(d.prog)); if (!progResponsible(p).some(r => r.staff === d.out)) errs.out = "รหัสอาจารย์ที่ออกไม่อยู่ในหลักสูตรนี้"; else if (!IDX.staff.has(d.in)) errs.out = "ไม่พบรหัสอาจารย์ที่เข้าใน ERP-HR"; }
  if (!formErrors(f, errs)) return; const id = Math.max(0, ...D.workflow.amendments.map(a => a.id)) + 1;
  D.workflow.amendments.unshift({ id, no: `สมอ.08-2569-${String(id).padStart(3, "0")}`, prog: Number(d.prog), kind: d.kind, reason: d.reason, out: d.out || null, in: d.in || null, status: "DRAFT", date: today() });
  audit("ยื่น สมอ.08", d.prog); persist(); closeModal(); toast("ยื่น สมอ.08 แล้ว — รอคณะเห็นชอบ"); rerender();
});

/* ---------------- S07 คลังรายวิชา ---------------- */
route("courses", { perm: "course.view", title: "คลังรายวิชา", render() {
  const f = S.filters.course || {}; const q = (f.q || "").trim();
  let rows = [...IDX.course.values()].filter(c => (!f.fac || c.fac === f.fac) && (!q || c.code.includes(q) || c.th.includes(q) || (c.en || "").toLowerCase().includes(q.toLowerCase())) && (!f.tqf || D.tqf[c.code]));
  const pg = paged("course", rows, 30); const facs = [...new Set([...IDX.course.values()].map(c => c.fac).filter(Boolean))].sort();
  return pageHead("คลังรายวิชา", { lead: `${fmt(IDX.course.size)} รายวิชาจากระบบทะเบียน (class_info) พร้อมคำอธิบายจริง · บุพวิชายังไม่มีข้อมูล ${gapPill("G06")}`, actions: btn("ส่งออก CSV", "open-doc", { data: { code: "EXP-COURSES" } }) + btn("+ เสนอรายวิชาใหม่", "course-new", { kind: "primary", perm: "course.edit" }) }) +
    `<section class="panel"><header><form class="filters" data-form="course-filter">${field("q", "ค้นหา", { value: f.q, placeholder: "รหัส ชื่อไทย/อังกฤษ" })}${field("fac", "คณะเจ้าของ", { type: "select", options: facs, value: f.fac })}${field("tqf", "มีตัวอย่าง มคอ.3/5", { type: "select", options: [["1", "เฉพาะที่มี"]], value: f.tqf })}<div class="actions"><button class="btn primary" type="submit">กรอง</button>${btn("ล้าง", "course-clear")}</div></form></header>
    <div class="body flush">${table([{ th: "รหัส", html: c => `<span class="mono">${esc(c.code)}</span>` }, { th: "ชื่อวิชา", wrap: true, html: c => `<a href="#" data-act="course-open" data-id="${esc(c.code)}">${esc(c.th)}</a><br><span class="muted small">${esc(c.en)}</span>` }, { th: "หน่วยกิต", val: c => c.cr }, { th: "คณะ / กลุ่ม", wrap: true, html: c => `${esc(c.fac)}<br><span class="muted small">${esc(c.grp)}</span>` }, { th: "กลุ่มเรียน 2569", num: true, val: c => c.sec }, { th: "ที่มา", html: c => c.isNew ? srcPill(false) : `<span class="pill real">ทะเบียน</span>` }], pg.rows)}${pg.pager}</div></section>`;
} });
form("course-filter", d => { S.filters.course = d; S.ui["pg-course"] = 1; rerender(); });
act("course-clear", () => { S.filters.course = {}; rerender(); });
act("course-open", el => {
  const c = IDX.course.get(el.dataset.id); if (!c) { toast("ไม่พบรายวิชา"); return; }
  const used = D.programs.filter(p => structureOf(p) && treeCourses(structureOf(p)).includes(c.code));
  const clos = D.programs.map(p => obeOf(p) && obeOf(p).clos[c.code]).find(Boolean) || [];
  openModal(`${c.code} ${c.th}`, kv([["ชื่อภาษาอังกฤษ", esc(c.en)], ["หน่วยกิต", `${esc(c.cr)} · บรรยาย ${c.l} ปฏิบัติ ${c.p} ศึกษาด้วยตนเอง ${c.s}`], ["คณะเจ้าของ", esc(c.fac)], ["กลุ่ม/หลักสูตร (ทะเบียน)", esc(c.grp)], ["บุพวิชา", gapPill("G06")], ["กลุ่มเรียนภาค 2569", c.sec], ["ใช้ในโครงสร้างหลักสูตร", used.map(p => `<a href="#program-${p.id}-structure">${esc(progTitle(p, true))}</a>`).join("<br>") || "—"]]) +
    `<h3>คำอธิบายรายวิชา</h3><p>${esc(c.d || "—")}</p>${clos.length ? `<h3>CLO ตั้งต้น</h3>${table([{ th: "CLO", val: x => x.code }, { th: "ข้อความ", wrap: true, val: x => x.text }, { th: "PLO", val: x => x.plo }], clos)}` : ""}
    <div class="form-foot">${D.tqf[c.code] ? btn("มคอ.3", "open-doc", { data: { code: "DOC-TQF3", id: c.code } }) + btn("มคอ.5", "open-doc", { data: { code: "DOC-TQF5", id: c.code } }) : `<span class="muted small">มคอ.3/5 ของรายวิชานี้อยู่ในโมดูล TQF</span>`}${btn("เสนอแก้คำอธิบาย", "course-propose", { kind: "primary", data: { id: c.code }, perm: "course.propose" })}</div>`, { wide: true });
});
act("course-propose", el => {
  const c = IDX.course.get(el.dataset.id);
  openModal(`เสนอแก้ไข ${c.code}`, `<form data-form="course-propose" data-id="${esc(c.code)}"><div class="form-grid">${field("th", "ชื่อไทย", { value: c.th, required: true })}${field("en", "ชื่ออังกฤษ", { value: c.en, required: true })}${field("cr", "หน่วยกิต n(l-p-s)", { value: c.cr, required: true, hint: "เช่น 3(2-2-5)" })}${field("d", "คำอธิบายรายวิชา", { type: "textarea", value: c.d, required: true, full: true, rows: 6 })}</div><div class="note">การแก้คำอธิบายในฉบับที่อนุมัติแล้วต้องผ่าน สมอ.08 · ข้อเสนอนี้บันทึกเป็นฉบับร่างของรายวิชา</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึกข้อเสนอ</button></div></form>`, { wide: true });
});
form("course-propose", (d, f) => {
  const errs = {}; if (!/^\d+\s?\(\d+-\d+-\d+\)$/.test(d.cr)) errs.cr = "รูปแบบ n(l-p-s) เช่น 3(2-2-5)"; if (d.d.length < 30) errs.d = "คำอธิบายสั้นเกินไป"; if (!formErrors(f, errs)) return;
  const code = f.dataset.id; D.courseEdits[code] = { th: d.th, en: d.en, cr: d.cr, d: d.d }; Object.assign(IDX.course.get(code), D.courseEdits[code]);
  audit("เสนอแก้ไขรายวิชา", code); persist(); closeModal(); toast("บันทึกข้อเสนอแก้ไขรายวิชาแล้ว");
});
act("course-new", () => openModal("เสนอรายวิชาใหม่", `<form data-form="course-new"><div class="form-grid">${field("code", "รหัสวิชา", { required: true, hint: "8 หลักตามระบบรหัสของคณะ" })}${field("cr", "หน่วยกิต n(l-p-s)", { required: true, placeholder: "3(3-0-6)" })}${field("th", "ชื่อไทย", { required: true })}${field("en", "ชื่ออังกฤษ", { required: true })}${field("d", "คำอธิบายรายวิชา", { type: "textarea", required: true, full: true })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`, { wide: true }));
form("course-new", (d, f) => {
  const errs = {}; if (!/^\d{8,9}$/.test(d.code)) errs.code = "รหัสวิชา 8–9 หลัก"; else if (IDX.course.has(d.code)) errs.code = "รหัสนี้มีอยู่แล้ว"; if (!/^\d+\s?\(\d+-\d+-\d+\)$/.test(d.cr)) errs.cr = "รูปแบบ n(l-p-s)"; ["th", "en", "d"].forEach(k => { if (!d[k]) errs[k] = "จำเป็นต้องกรอก"; });
  if (!formErrors(f, errs)) return; const m = d.cr.match(/^(\d+)\s?\((\d+)-(\d+)-(\d+)\)$/);
  const c = { id: Date.now(), code: d.code, th: d.th, en: d.en, cr: d.cr, c: Number(m[1]), l: m[2], p: m[3], s: m[4], fac: IDX.fac.get(me().scope.fac || "1").name, grp: "เสนอใหม่", d: d.d, sec: 0, isNew: true };
  D.newCourses.push(c); IDX.course.set(c.code, c); audit("เสนอรายวิชาใหม่", c.code); persist(); closeModal(); toast("เพิ่มรายวิชาในคลังแล้ว"); rerender();
});

/* ---------------- S10 อาจารย์ (ทั้งหมด) ---------------- */
route("staff", { perm: "staff.view", title: "อาจารย์และเกณฑ์ 2565", render() {
  const u = me(); const f = S.filters.staff || {}; const q = (f.q || "").trim();
  let rows = D.staffData.staff.filter(s => (u.scope.type === "UNIVERSITY" || s.fac === (u.scope.fac || (u.scope.progs && IDX.prog.get(u.scope.progs[0]).fac))) && (!f.fac || s.fac === f.fac) && (!f.pos || s.pos === f.pos) && (!f.status || s.status === f.status) && (!q || (s.fn + " " + s.ln).includes(q) || s.id.includes(q)) && (!f.role || (IDX.rolesByStaff.get(s.id) || []).length));
  const pg = paged("staff", rows, 30);
  return pageHead("อาจารย์และเกณฑ์ 2565", { lead: `ข้อมูลบุคลากรอ่านอย่างเดียวจาก ERP-HR (D10) · ซิงก์รายคืน 02:00 · ในต้นแบบเป็นชื่อสมมติ ${gapPill("G09")}`, actions: btn("ดึงข้อมูลจาก ERP-HR ตอนนี้", "hr-sync", { perm: "integ.manage" }) }) +
    `<section class="panel"><header><form class="filters" data-form="staff-filter">${field("q", "ชื่อหรือรหัส", { value: f.q })}${u.scope.type === "UNIVERSITY" ? field("fac", "สังกัด", { type: "select", options: D.meta.faculties.map(x => [x.id, x.name]), value: f.fac }) : ""}${field("pos", "ตำแหน่งวิชาการ", { type: "select", options: Object.entries(POS_TH), value: f.pos })}${field("status", "สถานภาพ", { type: "select", options: [["ACTIVE", "ปฏิบัติงาน"], ["STUDY_LEAVE", "ลาศึกษา"], ["RETIRED", "เกษียณ"], ["RESIGNED", "ลาออก"]], value: f.status })}${field("role", "มีบทบาทในหลักสูตร", { type: "select", options: [["1", "เฉพาะที่มี"]], value: f.role })}<div class="actions"><button class="btn primary" type="submit">กรอง</button></div></form></header>
    <div class="body flush">${table([{ th: "รหัส", html: s => `<span class="mono">${s.id}</span>` }, { th: "ชื่อ–สกุล", html: s => `<a href="#" data-act="staff-open" data-id="${s.id}">${esc(staffName(s.id))}</a>` }, { th: "สังกัด", val: s => IDX.fac.get(s.fac).abbr || IDX.fac.get(s.fac).name }, { th: "ตำแหน่ง/คุณวุฒิ", html: s => `${esc(POS_TH[s.pos])}<br><span class="muted small">${esc(DEG_TH[s.deg])} · ISCED ${esc(s.isced || "—")}</span>` }, { th: "บทบาทในหลักสูตร", html: s => (IDX.rolesByStaff.get(s.id) || []).map(r => `<a href="#program-${r.prog}-staff">${esc(progTitle(IDX.prog.get(r.prog), true))}</a> <span class="muted small">${r.role === "PROGRAM_RESPONSIBLE" ? "ผู้รับผิดชอบ" : "ประจำ"}</span>`).join("<br>") || "—" }, { th: "ผลงาน 5 ปี", num: true, val: s => pubs5(s.id).length }, { th: "สถานภาพ", html: s => s.status === "ACTIVE" ? pill("ปฏิบัติงาน", "good") : pill({ STUDY_LEAVE: "ลาศึกษา", RETIRED: "เกษียณ", RESIGNED: "ลาออก" }[s.status], "warn") }], pg.rows)}${pg.pager}</div></section>`;
} });
form("staff-filter", d => { S.filters.staff = d; S.ui["pg-staff"] = 1; rerender(); });
act("staff-open", el => {
  const s = IDX.staff.get(el.dataset.id); const adm = IDX.adminByStaff.get(s.id); const lv = IDX.leaveByStaff.get(s.id);
  const pos = D.staffData.positions.filter(x => x.staff === s.id);
  openModal(staffName(s.id), `<div class="note">อ่านอย่างเดียวจาก ERP-HR · แก้ไขที่ระบบบุคลากร · ${srcPill(!s.simulated)}${s.facHr ? " · สังกัดใน ERP-HR: " + esc(s.facHr) : ""}</div>` + kv([["รหัสบุคลากร", `<span class="mono">${s.id}</span>`], ["ประเภทบุคลากร", esc(s.type)], ["สังกัด", esc(IDX.fac.get(s.fac).name)], ["ตำแหน่งวิชาการ", esc(POS_TH[s.pos]) + (s.posDate ? ` (มีผล ${thDate(s.posDate)})` : "")], ["ตำแหน่งบริหาร", adm ? esc(adm.name) + " → สิทธิ์ " + (adm.code === "DEAN" ? "UX ผู้บริหารหน่วยงาน" : ["PRESIDENT", "VP"].includes(adm.code) ? "EX ผู้บริหารมหาวิทยาลัย" : "—") : "—"], ["สถานภาพ", esc(s.status) + (lv ? ` · ลาศึกษา${lv.type} ${thDate(lv.from)}–${thDate(lv.to)}` : "")], ["วันบรรจุ / เกษียณ", `${thDate(s.hire)} / ${thDate(s.retire)}`], ["DS2001 รอบล่าสุด", s.ds2001 || pill("ไม่พบใน UNICON", "bad")], ["อีเมล", esc(s.email)]]) +
    `<h3>ประวัติการศึกษา</h3>${table([{ th: "ระดับ", val: e => DEG_TH[e.level] }, { th: "วุฒิ/สาขา", val: e => e.degree }, { th: "ISCED", val: e => e.isced || "—" }, { th: "สถาบัน", val: e => e.inst }, { th: "ปี (ค.ศ.)", val: e => e.year }], [...s.edu].reverse())}
    ${pos.length ? `<h3>ประวัติตำแหน่งทางวิชาการ</h3>${table([{ th: "ตำแหน่ง", val: x => POS_TH[x.pos] }, { th: "วันที่มีผล", val: x => thDate(x.date) }, { th: "สาขา", val: x => x.field }, { th: "คำสั่ง", val: x => x.order }], pos)}` : ""}
    <h3>ผลงานวิชาการ</h3>${table([{ th: "ปี", val: x => x.year }, { th: "ผลงาน", wrap: true, val: x => `${x.title} · ${x.venue}` }, { th: "ประเภท", val: x => x.typeTh }, { th: "ฐาน", val: x => x.db }, { th: "สถานะ", html: x => pill({ CERTIFIED: "รับรองแล้ว", SUBMITTED: "รอรับรอง", DRAFT: "ร่าง" }[x.status], x.status === "CERTIFIED" ? "good" : "warn") }], IDX.pubsByStaff.get(s.id) || [], { empty: "ไม่มีผลงานในระบบ" })}`, { wide: true });
});
act("hr-sync", () => {
  const n = 3 + Math.floor(Math.random() * 8); D.integ.imports.unshift({ id: Date.now(), source: "ERP_STAFF", at: today() + "T" + new Date().toTimeString().slice(0, 5), rows: n, status: "SUCCESS", note: "ดึงด้วยมือจากหน้าอาจารย์ (จำลอง)" });
  audit("ดึงข้อมูล ERP-HR", n + " ระเบียน"); persist(); toast(`ดึงข้อมูลจาก ERP-HR แล้ว ${n} ระเบียนที่เปลี่ยน · ตรวจเกณฑ์ใหม่อัตโนมัติ`);
});

/* ---------------- S11 ผลงานวิชาการ ---------------- */
route("publications", { perm: null, title: "ผลงานวิชาการ", render() {
  if (!canAny("publication.own|publication.certify")) return `<div class="note bad">${esc(denyMsg("publication.own"))}</div>`;
  const u = me(); const mine = u.staff ? (IDX.pubsByStaff.get(u.staff) || []) : [];
  const queue = can("publication.certify") ? D.staffData.publications.filter(x => x.status === "SUBMITTED" && (u.scope.type === "UNIVERSITY" || IDX.staff.get(x.staff).fac === u.scope.fac)) : [];
  const cols = [{ th: "ปี", val: x => x.year }, { th: "ผลงาน", wrap: true, html: x => `${esc(x.title)}<br><span class="muted small">${esc(x.venue)}${x.doi ? " · DOI " + esc(x.doi) : ""}</span>` }, { th: "ประเภท (ก.พ.อ. 2564)", val: x => x.typeTh }, { th: "ฐานข้อมูล", val: x => x.db }];
  return pageHead("ผลงานวิชาการ (M6b)", { lead: `ทะเบียนผลงานแบบเบา ใช้ตรวจเกณฑ์ 2565 ข้อ 2–3 · ย้ายเจ้าของไประบบวิจัยได้ภายหลัง (D3) ${gapPill("G10")}`, actions: can("publication.own") && u.staff ? btn("+ บันทึกผลงาน", "pub-new", { kind: "primary" }) : "" }) +
    (can("publication.own") ? panel(`ผลงานของฉัน (${mine.length})`, u.staff ? table([...cols, { th: "สถานะ", html: x => pill({ CERTIFIED: "รับรองแล้ว", SUBMITTED: "รอรับรอง", DRAFT: "ร่าง" }[x.status], x.status === "CERTIFIED" ? "good" : x.status === "SUBMITTED" ? "info" : "warn") }, { th: "", html: x => x.status === "DRAFT" ? btn("ส่งรับรอง", "pub-submit", { sm: true, data: { id: x.id } }) : "" }], mine, { empty: "ยังไม่มีผลงาน" }) : `<div class="empty">บัญชีนี้ไม่ผูกกับรหัสบุคลากร</div>`, { flush: true }) : "") +
    (can("publication.certify") ? panel(`รอรับรอง (${queue.length})`, table([{ th: "อาจารย์", val: x => staffName(x.staff) }, ...cols, { th: "", html: x => `<span class="actions">${btn("รับรอง", "pub-cert", { sm: true, kind: "primary", data: { id: x.id, ok: 1 } })}${btn("ส่งกลับ", "pub-cert", { sm: true, data: { id: x.id, ok: 0 } })}</span>` }], queue, { empty: "ไม่มีผลงานรอรับรอง" }), { flush: true }) : "");
} });
act("pub-new", () => openModal("บันทึกผลงานวิชาการ", `<form data-form="pub-new"><div class="form-grid">${field("title", "ชื่อผลงาน", { required: true, full: true })}${field("venue", "แหล่งเผยแพร่", { required: true, full: true })}${field("type", "ประเภท", { type: "select", options: [["RESEARCH_ARTICLE", "บทความวิจัย"], ["ACADEMIC_ARTICLE", "บทความวิชาการ"], ["TEXTBOOK", "ตำรา"], ["CONFERENCE", "รายงานสืบเนื่องการประชุม"], ["OTHER_WORK", "ผลงานรับใช้สังคม"]], required: true })}${field("db", "ฐานข้อมูล", { type: "select", options: ["TCI1", "TCI2", "Scopus Q1", "Scopus Q2", "Scopus Q3", "Scopus Q4", "Web of Science", "-"], required: true })}${field("year", "ปีที่เผยแพร่ (พ.ศ.)", { type: "number", required: true, value: 2569 })}${field("doi", "DOI", { placeholder: "10.xxxx/xxxx" })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึกเป็นร่าง</button></div></form>`));
form("pub-new", (d, f) => {
  const errs = {}; ["title", "venue", "type", "db"].forEach(k => { if (!d[k]) errs[k] = "จำเป็นต้องกรอก"; }); if (!(Number(d.year) >= 2540 && Number(d.year) <= 2570)) errs.year = "ปี พ.ศ. 2540–2570"; if (d.doi && !/^10\.\d{4,}\/\S+$/.test(d.doi)) errs.doi = "รูปแบบ DOI ไม่ถูกต้อง";
  if (!formErrors(f, errs)) return; const tth = { RESEARCH_ARTICLE: "บทความวิจัย", ACADEMIC_ARTICLE: "บทความวิชาการ", TEXTBOOK: "ตำรา", CONFERENCE: "รายงานสืบเนื่องการประชุม", OTHER_WORK: "ผลงานรับใช้สังคม" };
  D.staffData.publications.push({ id: Date.now(), staff: me().staff, type: d.type, typeTh: tth[d.type], year: Number(d.year), title: d.title, venue: d.venue, db: d.db, research: d.type === "RESEARCH_ARTICLE", status: "DRAFT", doi: d.doi });
  buildIndex(); audit("บันทึกผลงาน", d.title); persist(); closeModal(); toast("บันทึกผลงานแล้ว"); rerender();
});
act("pub-submit", el => { const x = D.staffData.publications.find(y => y.id === Number(el.dataset.id)); x.status = "SUBMITTED"; persist(); toast("ส่งให้คณะรับรองแล้ว"); rerender(); });
act("pub-cert", el => { const x = D.staffData.publications.find(y => y.id === Number(el.dataset.id)); x.status = el.dataset.ok === "1" ? "CERTIFIED" : "DRAFT"; buildIndex(); audit(el.dataset.ok === "1" ? "รับรองผลงาน" : "ส่งกลับผลงาน", x.title); persist(); toast(el.dataset.ok === "1" ? "รับรองแล้ว — ใช้ตรวจเกณฑ์ได้ทันที" : "ส่งกลับให้อาจารย์แก้ไข"); rerender(); });

/* ---------------- S12 รายการการเงิน ---------------- */
route("finance", { perm: "finance.view", title: "ต้นทุนและจุดคุ้มทุน", render() {
  const rows = Object.entries(D.finance.scenarios).map(([id, sc]) => ({ p: IDX.prog.get(Number(id)), sc, be: breakeven(sc) })).filter(r => r.p && inScope(r.p));
  return pageHead("ต้นทุนและจุดคุ้มทุน (กระบวนการ 2.2B)", { lead: "ทุกระดับ ปวช.–เอก · ค่าธรรมเนียมจริงจาก ERP ปีงบ 2570 เมื่อจับคู่หลักสูตรได้ · หักจัดสรรเงินรายได้ 42% (ประกาศปีงบ 2568/2570 ยืนยันแล้ว)" }) +
    `<div class="grid g2">${panel("โปรไฟล์ระดับการศึกษา", table([{ th: "ระดับ", val: x => levelAbbr(x.level) }, { th: "ภาค", num: true, val: x => x.terms }, { th: "ฐานค่าธรรมเนียม", wrap: true, val: x => x.feeBasis }, { th: "สถานะ", html: x => pillOf(DS, x.status) }], D.finance.levelProfiles), { flush: true })}
    ${panel("รายการต้นทุน (หมวดงบประมาณ มนพ.)", table([{ th: "รายการ", wrap: true, val: x => x.th }, { th: "หมวด", val: x => x.cat }, { th: "ชนิด", val: x => x.kind }, { th: "อัตรา", num: true, val: x => x.rate != null ? fmt(x.rate, x.rate < 1 ? 2 : 0) : "" }, { th: "สถานะ", html: x => pillOf(DS, x.status) }], D.finance.costItems), { flush: true })}</div>` +
    panel("การวิเคราะห์ของหลักสูตร", table([{ th: "หลักสูตร", html: r => `<a href="#program-${r.p.id}-finance">${esc(progTitle(r.p, true))}</a>` }, { th: "ค่าธรรมเนียม/ภาค", num: true, val: r => baht(r.sc.feePerTerm) }, { th: "แหล่งอัตรา", wrap: true, val: r => r.sc.feeSource }, { th: "จุดคุ้มทุน/รุ่น", num: true, val: r => r.be.beCohort ? fmt(r.be.beCohort) : "ไม่คุ้มทุน" }, { th: "แผนรับ", num: true, val: r => r.sc.intake[0] }, { th: "สถานะ", html: r => pill(r.sc.status === "SIGNED" ? "ลงนามแล้ว" : "ร่าง", r.sc.status === "SIGNED" ? "good" : "warn") }], rows), { flush: true }) +
    panel("อัตราค่าธรรมเนียมจาก ERP (ภาค 1/2570 ชั้นปี 1 ภาคปกติ)", (() => { const fees = D.erp.fees.filter(x => x.sem === "1/2570"); const pg = paged("fee", fees, 15);
      return table([{ th: "คณะ", val: x => x.fac }, { th: "หลักสูตร", val: x => x.prog }, { th: "ระดับ", val: x => x.lvl }, { th: "ค่าธรรมเนียม", num: true, val: x => baht(x.fee) }, { th: "ค่าหน่วยกิต", num: true, html: x => baht(x.credit) + (x.credit >= 10000 ? " " + pill("ผิดปกติ P21", "bad") : "") }, { th: "ที่มา", html: () => `<span class="pill real">ERP</span>` }], pg.rows) + pg.pager; })(), { flush: true });
} });
