/* regsync.js — D13 ส่งและจัดการข้อมูลหลักสูตรกับระบบบริการการศึกษา (REG) — design/16-reg-integration.md
   ชุดข้อมูลหลักสูตร (outbox) · รหัส 3 ระบบ (อว./REG/ERP org) · กระทบยอด · จำนวนนักศึกษาจาก REG */
"use strict";

const PKG_TYPE = { PROGRAM_VERSION: "หลักสูตรใหม่/ฉบับปรับปรุง", PROGRAM_AMENDMENT: "ปรับปรุงเล็กน้อย (สมอ.08)", CHE_CODE_ASSIGNED: "ผูกรหัส อว.", ADMISSION_STOP: "หยุดรับนักศึกษา", PROGRAM_CLOSE: "ปิดหลักสูตร" };
const PKG_STATUS = { BLOCKED: ["รอเงื่อนไข", "neutral"], READY: ["พร้อมส่ง", "warn"], SENT: ["ส่งแล้ว รอ REG ตอบ", "info"], ACKED: ["REG รับแล้ว", "good"], REJECTED: ["REG ปฏิเสธ", "bad"] };
const ISSUE_TH = { REG_NO_CMS: "REG มีนักศึกษา แต่ไม่มีหลักสูตรใน CMS", CHE_NO_CMS: "รหัส อว. ยังไม่ผูกหลักสูตร CMS", CMS_NO_CHE: "CMS เปิดรับแต่ไม่มีรหัส อว.", ACTIVE_NO_STUDENT: "เปิดรับแต่ REG ไม่มีนักศึกษา",
  REG_NO_ORG: "หลักสูตร REG ไม่มี org_code ERP", VOC_NO_CHE: "รหัส REG อาชีวะไม่มีรหัส อว.", MULTI_CHE: "หลักสูตรผูกหลายรหัส อว.", CLOSED_HAS_STUDENTS: "ปิดแล้วแต่ REG ยังมีนักศึกษา" };

/* ---------- นักศึกษาคงค้างรายรุ่นจาก REG (แทนค่าประมาณ) ---------- */
const _remainingBase = remainingOf;
remainingOf = function (p) {
  const s = stat(p);
  if (s && s.real && s.byAdmit) return Object.entries(s.byAdmit).sort().map(([y, n]) => ({ entry: Number(y), n, src: "REG" }));
  return _remainingBase(p);
};

/* ---------- ชุดข้อมูลที่ต้องส่ง REG (สร้างจากเหตุการณ์ที่อนุมัติแล้ว) ---------- */
function regPackages() {
  D.reg.packages = D.reg.packages || {}; const st = D.reg.packages; const out = [];
  const add = (id, o) => { const s = st[id] || {}; out.push(Object.assign({ id, status: o.blocked ? "BLOCKED" : "READY" }, o, s.status && !(o.blocked && s.status === "READY") ? { status: s.status, regIds: s.regIds, sentAt: s.sentAt, ackAt: s.ackAt, reason: s.reason } : {})); };
  D.workflow.cases.filter(c => c.status === "APPROVED" && c.type !== "CLOSE").forEach(c => {
    const p = IDX.prog.get(c.prog); const v = (IDX.ver.get(c.ver) || {}).v; if (!p || !v) return;
    const r2 = lastReview(c, 2);
    add(`PV-${v.id}`, { type: "PROGRAM_VERSION", p, v, case: c, blocked: !r2 || r2.status !== "PASSED", why: !r2 ? "ยังไม่ส่งตรวจระยะ 2" : r2.status !== "PASSED" ? `ตรวจระยะ 2: ${REVIEW_STATUS[r2.status][0]}` : "" });
    if (p.checoCode) add(`CC-${v.id}`, { type: "CHE_CODE_ASSIGNED", p, v, blocked: !(st[`PV-${v.id}`] && st[`PV-${v.id}`].status === "ACKED"), why: "รอ REG รับชุดหลักสูตรก่อน" });
    const prev = p.versions.find(x => x.state === "SUPERSEDED" && x.id === (v.basedOn || -1));
    if (prev) add(`AS-${prev.id}`, { type: "ADMISSION_STOP", p, v: prev, note: `ฉบับใหม่ พ.ศ. ${v.year} มีผล — รุ่นเดิมเรียนต่อจนจบ` });
  });
  D.workflow.amendments.filter(a => ["SENATE_APPROVED", "REPORTED"].includes(a.status)).forEach(a => { const p = IDX.prog.get(a.prog); if (p) add(`AM-${a.id}`, { type: "PROGRAM_AMENDMENT", p, v: activeVer(p), amend: a }); });
  D.life.closures.filter(c => c.status === "APPROVED" && c.case).forEach(c => { const p = IDX.prog.get(c.prog); if (!p) return;
    const rem = remainingTotal(p);
    add(`CL-${c.id}`, { type: c.kind === "CLOSE" ? "PROGRAM_CLOSE" : "ADMISSION_STOP", p, v: activeVer(p), closure: c, blocked: c.kind === "CLOSE" && rem > 0, why: `REG ยังมีนักศึกษา ${rem} คน` }); });
  return out;
}
function regPayload(k) {
  const p = k.p, v = k.v; const s = structureOf(p); const pf = profileOf(v) || {};
  const base = { package_id: k.id, type: k.type, program_code: p.code, che_code: p.checoCode || "PENDING", erp_org_code: p.orgCode || null, version_year: v.year,
    effective_term: 1, effective_year: v.year, cohort_from: v.year };
  if (k.type === "PROGRAM_VERSION") return Object.assign(base, {
    header: { level: p.level, degree_th: p.degree, program_th: p.name, program_en: (v.form || {}).nameEn || null, faculty: IDX.fac.get(p.fac).name, credits: v.credits, years: v.years, min_gpa: v.minGpa },
    plans: v.plans.map(x => ({ plan: x.plan, credits: x.credits, offering_units: [IDX.fac.get(p.fac).name], current_reg_id: x.regId || null })),
    structure: s ? { source: s.source || "CMS", nodes: (function f(n, d) { return [{ depth: d, title: n.title, min_credits: n.min, courses: (n.courses || []).length }].concat((n.children || []).flatMap(c => f(c, d + 1))); })(s, 0) } : null,
    courses: s ? treeCourses(s).map(c => ({ code: c, name_th: (IDX.course.get(c) || {}).th, credits: (IDX.course.get(c) || {}).cr, reg_link: IDX.regCodes.has(c) ? "MATCHED" : ((D.life.courseLinks.find(x => x.code === c) || {}).status || "NO_ID") })) : [],
    study_plan: (D.design.studyPlans[p.id] || []).map(t => ({ year: t.year, term: t.term, courses: t.courses })),
    graduation: { min_gpa: v.minGpa, regulation: v.year >= 2565 ? "ระเบียบ ป.ตรี 2566" : "ระเบียบเดิม" }, committee_coordinator: ((pf.committee || []).find(x => x.pos === "COORDINATOR") || {}).staff || null });
  if (k.type === "PROGRAM_AMENDMENT") { const a = k.amend; return Object.assign(base, { amendment_no: a.no, topics: a.topics || [a.kind], effective_term: a.term || 1, effective_year: a.effYear || v.year, cohort_from: a.cohort || v.year, applies_retro: !!a.retro, change: a.reason }); }
  if (k.type === "CHE_CODE_ASSIGNED") return Object.assign(base, { che_code: p.checoCode, all_che_codes: p.checoCodes || [p.checoCode] });
  if (k.type === "ADMISSION_STOP") return Object.assign(base, { admission_open: false, effective_year: k.closure ? k.closure.year : v.year + 5, note: k.note || (k.closure && k.closure.reason) });
  if (k.type === "PROGRAM_CLOSE") return Object.assign(base, { close_term: k.closure.term, close_year: k.closure.year, remaining_students: remainingTotal(p) });
  return base;
}

route("regsync", { perm: null, title: "เชื่อมระบบทะเบียน (REG)", render(args) {
  if (!canAny("integ.view|review.registrar|report.ops")) return `<div class="note bad">${esc(denyMsg("integ.view"))}</div>`;
  const tab = args[0] || "outbox"; const R = D.reg; const pk = regPackages(); const ed = can("review.registrar") || can("integ.manage");
  const tabs = [["outbox", `ชุดข้อมูลส่ง REG (${pk.filter(x => ["READY", "SENT"].includes(x.status)).length})`], ["codes", "รหัส 3 ระบบ"], ["issues", `กระทบยอด (${R.issues.filter(i => i.sev !== "info").length})`], ["students", "นักศึกษาจาก REG"]];
  const head = pageHead("เชื่อมระบบบริการการศึกษา (REG)", { lead: `CMS เป็นต้นทางข้อมูลหลักสูตร → REG สร้าง PROGRAMID และส่งจำนวนนักศึกษากลับ (D13) · ช่องทาง <span class="mono">reg.connector_mode</span> = ${esc(settingVal("reg.connector_mode", "MANUAL"))} · ข้อมูลรหัส/นักศึกษาจากไฟล์ระบบทะเบียน 19 พ.ย. 2569 ${srcPill(true)}`,
    actions: btn("รายงานกระทบยอด", "open-doc", { data: { code: "RPT-REGRECON" }, perm: "report.ops" }) });
  const nav = `<nav class="tabs">${tabs.map(([k, t]) => `<a href="#regsync-${k}"${k === tab ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>`;
  if (tab === "codes") {
    const q = (S.ui.regq || "").trim();
    const rows = R.che.filter(c => !q || c.code.includes(q) || c.name.includes(q));
    return head + nav + `<form class="filters" data-form="regq"><input name="q" type="search" value="${esc(q)}" placeholder="ค้นรหัส อว. หรือชื่อหลักสูตร" aria-label="ค้นหา"><button class="btn" type="submit">ค้นหา</button></form>` +
      panel(`รหัส อว. ${R.che.length} รหัส · ผูกหลักสูตร CMS ${R.che.filter(c => c.prog).length}`, table([{ th: "รหัส อว.", html: c => `<span class="mono">${c.code}</span>` }, { th: "ชื่อใน อว.", wrap: true, val: c => c.name }, { th: "ระดับ", val: c => c.level },
        { th: "หลักสูตร CMS", wrap: true, html: c => c.prog ? `<a href="#program-${c.prog}">${esc(progTitle(IDX.prog.get(c.prog), true))}</a>${(c.shared || []).length > 1 ? `<br><span class="muted small">ใช้ร่วม ${c.shared.length} คณะ/วิทยาลัย</span>` : ""}${c.score === "manual" ? " " + pill("จับคู่ด้วยมือ", "info") : ""}` : pill("ยังไม่ผูก", "warn") },
        { th: "REG PROGRAMID", wrap: true, html: c => c.prog ? [...new Set(IDX.prog.get(c.prog).versions.flatMap(v => v.plans.map(x => x.regId)).filter(Boolean))].map(x => `<span class="tag">${x}</span>`).join(" ") : "—" },
        { th: "ERP org", html: c => c.prog && IDX.prog.get(c.prog).orgCode ? `<span class="mono">${IDX.prog.get(c.prog).orgCode}</span>` : "—" }], rows, { maxH: 560 }), { flush: true }) +
      panel(`อาชีวศึกษา: รหัส REG 12 หลัก → รหัส อว. (${R.voc.length})`, table([{ th: "รหัส REG", html: x => `<span class="mono">${x.regCode}</span>` }, { th: "ปีหลักสูตร", val: x => x.currYear || "" }, { th: "คณะ/วิทยาลัย", val: x => x.fac }, { th: "ระดับ", val: x => x.level }, { th: "สาขา", val: x => x.major }, { th: "รหัส อว.", html: x => x.che ? `<span class="mono">${x.che}</span>` : pill("ไม่มี", "warn") }, { th: "หมายเหตุ", wrap: true, val: x => x.note }], R.voc, { maxH: 420 }), { flush: true }) +
      `<p class="muted small">REG สร้างรหัสใหม่ต่อ คณะ/วิทยาลัย × สาขา × ปีหลักสูตร (3 หลักท้าย) — 1 รหัส อว. ใช้ได้หลายรหัส REG</p>`;
  }
  if (tab === "issues") {
    const by = {}; R.issues.forEach(i => { (by[i.type] = by[i.type] || []).push(i); });
    return head + nav + `<div class="grid g4">${Object.entries(by).map(([k, l]) => `<div class="panel stat"><span class="label">${esc(ISSUE_TH[k] || k)}</span><span class="value">${l.length}</span></div>`).join("")}</div>` +
      Object.entries(by).map(([k, l]) => panel(`${ISSUE_TH[k] || k} (${l.length})`, `<ul class="list">${l.slice(0, 60).map(i => `<li>${pill(i.sev === "bad" ? "สำคัญ" : i.sev === "warn" ? "ควรแก้" : "ข้อมูล", i.sev === "bad" ? "bad" : i.sev === "warn" ? "warn" : "neutral")} ${typeof i.ref === "number" ? `<a href="#program-${i.ref}">${esc(i.text)}</a>` : esc(i.text)}</li>`).join("")}${l.length > 60 ? `<li class="muted">… อีก ${l.length - 60} รายการ (ดูในรายงาน)</li>` : ""}</ul>`, { flush: true })).join("");
  }
  if (tab === "students") {
    const rows = Object.entries(R.students).map(([pid, s]) => ({ p: IDX.prog.get(Number(pid)), s })).filter(x => x.p).sort((a, b) => b.s.total - a.s.total);
    const years = ["2563", "2564", "2565", "2566", "2567", "2568", "2569"];
    const byLv = {}; rows.forEach(x => { byLv[x.p.level] = (byLv[x.p.level] || 0) + x.s.total; });
    return head + nav + `<div class="grid g4"><div class="panel stat"><span class="label">นักศึกษาที่ผูกหลักสูตร CMS</span><span class="value">${fmt(R.studentTotal)}</span><span class="sub">${rows.length} หลักสูตร</span></div><div class="panel stat"><span class="label">ไม่พบหลักสูตรใน CMS</span><span class="value">${fmt(R.unmatchedStudents)}</span><span class="sub">ดูแท็บกระทบยอด</span></div><div class="panel stat"><span class="label">โรงเรียนสาธิต (ไม่อยู่ใน CMS)</span><span class="value">${fmt(R.nonHigherEd)}</span></div><div class="panel stat"><span class="label">ปีที่เข้าล่าสุด 2569</span><span class="value">${fmt(rows.reduce((a, x) => a + (x.s.byAdmit["2569"] || 0), 0))}</span><span class="sub">ชั้นปีที่ 1 ปัจจุบัน</span></div></div>` +
      panel("แยกตามระดับ", barChart(Object.entries(byLv).sort((a, b) => b[1] - a[1]).map(([l, n]) => ({ label: levelAbbr(l), v: n, tip: `${levelAbbr(l)}: ${fmt(n)} คน` })), { aria: "นักศึกษาตามระดับ", padL: 90 })) +
      panel("นักศึกษาคงอยู่ตามปีที่เข้า (REG)", table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.p.id}-performance">${esc(progTitle(x.p, true))}</a>` }, { th: "ระดับ", val: x => levelAbbr(x.p.level) }].concat(years.map(y => ({ th: y, num: true, val: x => x.s.byAdmit[y] || "" }))).concat([{ th: "รวม", num: true, val: x => fmt(x.s.total) }, { th: "สถานะ CMS", html: x => pill(...lifeStatus(x.p)) }]), rows, { maxH: 600 }), { flush: true });
  }
  const cnt = k => pk.filter(x => x.status === k).length;
  return head + nav + `<div class="grid g4">${["READY", "SENT", "ACKED", "BLOCKED"].map(k => `<div class="panel stat"><span class="label">${PKG_STATUS[k][0]}</span><span class="value">${cnt(k)}</span></div>`).join("")}</div>
    <div class="note">ชุดข้อมูลสร้างอัตโนมัติจากเรื่องที่อนุมัติแล้ว: หลักสูตร/ฉบับใหม่ต้องผ่าน<b>ตรวจระยะ 2</b>ก่อน · ปิดหลักสูตรต้องให้ REG ยืนยันนักศึกษาคงค้าง = 0 · REG ตอบ PROGRAMID กลับมาเก็บในรหัสเทียบ</div>` +
    panel(`${pk.length} ชุดข้อมูล`, table([{ th: "ชุดข้อมูล", html: k => `<span class="mono">${k.id}</span>` }, { th: "ประเภท", val: k => PKG_TYPE[k.type] }, { th: "หลักสูตร", wrap: true, html: k => `<a href="#program-${k.p.id}">${esc(progTitle(k.p, true))}</a><br><span class="muted small">ฉบับ พ.ศ. ${k.v.year} · อว. ${esc(k.p.checoCode || "PENDING")}</span>` },
      { th: "สถานะ", html: k => pillOf(PKG_STATUS, k.status) + (k.status === "BLOCKED" ? `<br><span class="muted small">${esc(k.why || "")}</span>` : "") + (k.regIds ? `<br><span class="muted small">REG: ${k.regIds.join(", ")}</span>` : "") + (k.reason ? `<br><span class="muted small">${esc(k.reason)}</span>` : "") },
      { th: "", html: k => `<span class="actions">${btn("payload", "reg-payload", { sm: true, data: { id: k.id } })}${ed && k.status === "READY" ? btn("ส่ง REG", "reg-send", { sm: true, kind: "primary", data: { id: k.id } }) : ""}${ed && k.status === "SENT" ? btn("REG ตอบรับ (จำลอง)", "reg-ack", { sm: true, data: { id: k.id } }) + btn("ปฏิเสธ", "reg-reject", { sm: true, data: { id: k.id } }) : ""}${ed && k.status === "REJECTED" ? btn("ส่งใหม่", "reg-send", { sm: true, data: { id: k.id } }) : ""}</span>` }], pk, { empty: "ยังไม่มีเรื่องที่อนุมัติ" }), { flush: true });
} });
form("regq", d => { S.ui.regq = d.q; rerender(); });
function pkgById(id) { return regPackages().find(k => k.id === id); }
act("reg-payload", el => { const k = pkgById(el.dataset.id); openModal(`ชุดข้อมูล ${k.id} — ${PKG_TYPE[k.type]}`, `<p class="muted small">ส่งผ่าน ${esc(settingVal("reg.connector_mode", "MANUAL"))} · รูปแบบตาม design/16 §4</p><pre class="code">${esc(JSON.stringify(regPayload(k), null, 2))}</pre>`, { wide: true }); });
act("reg-send", el => { const k = pkgById(el.dataset.id); D.reg.packages[k.id] = { status: "SENT", sentAt: today() }; audit("ส่งชุดข้อมูลให้ REG", k.id); persist(); toast(`ส่ง ${k.id} แล้ว — รอ REG ตอบรับ`); rerender(); });
act("reg-ack", el => {
  const k = pkgById(el.dataset.id); const ids = k.type === "PROGRAM_VERSION" ? k.v.plans.map((x, i) => x.regId || `NEW-${k.v.year}-${i + 1}`) : null;
  if (ids) k.v.plans.forEach((x, i) => { if (!x.regId) x.regId = ids[i]; });
  D.reg.packages[k.id] = { status: "ACKED", sentAt: (D.reg.packages[k.id] || {}).sentAt, ackAt: today(), regIds: ids };
  audit("REG ตอบรับชุดข้อมูล", k.id); persist(); toast(ids ? `REG ตอบรับ — ผูก PROGRAMID ${ids.join(", ")} (จำลอง)` : "REG ตอบรับแล้ว"); rerender();
});
act("reg-reject", el => { const k = pkgById(el.dataset.id); D.reg.packages[k.id] = { status: "REJECTED", reason: "REG: รหัสวิชาบางรายการยังไม่มีในระบบ (จำลอง)" }; persist(); rerender(); });

(function () { const g = NAV.find(x => x[0] === "ระบบ")[1]; g.splice(1, 0, ["regsync", "เชื่อมระบบทะเบียน (REG)", "integ.view|review.registrar|report.ops"]); })();

DOCS["RPT-REGRECON"] = () => {
  const R = D.reg; const cols = [{ th: "ประเภท", val: i => ISSUE_TH[i.type] || i.type }, { th: "ระดับ", val: i => i.sev }, { th: "อ้างอิง", val: i => i.ref }, { th: "รายละเอียด", val: i => i.text }];
  const h = `<div class="a4 land">${docHead("RPT-REGRECON")}<h1>รายงานกระทบยอดข้อมูลหลักสูตร CMS – REG – อว. – ERP</h1><p class="center">รหัส อว. ${R.che.length} · ผูก CMS ${R.che.filter(c => c.prog).length} · นักศึกษาผูกหลักสูตร ${fmt(R.studentTotal)} คน · ไม่พบหลักสูตร ${fmt(R.unmatchedStudents)} คน</p>
    <table><thead><tr>${cols.map(c => `<th>${c.th}</th>`).join("")}</tr></thead><tbody>${R.issues.filter(i => i.sev !== "info").map(i => `<tr>${cols.map(c => `<td>${esc(c.val(i))}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="small">รายการระดับข้อมูล (info) อยู่ในไฟล์ CSV</p></div>`;
  return { title: "รายงานกระทบยอด CMS–REG", html: h, file: "กระทบยอด-REG", csv: csv(R.issues, cols) };
};
