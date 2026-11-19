/* screens-lifecycle.js — D11 หน้าจอที่ปรับใช้จาก CMS มอ.
   S21 ติดตามการจัดทำหลักสูตร · S22 ตรวจสอบข้อมูล 2 ระยะ · S23 งดรับ/ปิด · S24 รายวิชากลาง · S25 เชื่อมรหัสทะเบียน
   แท็บหลักสูตร: ความครบถ้วน · ข้อมูลเชิงนโยบาย · ปรับปรุงแบบแยก/รวม · สมอ.08 ฟิลด์บังคับใช้ · เอกสารเพิ่ม 6 ฉบับ */
"use strict";

/* ---------- เมนู ---------- */
(function addNav() {
  const grp = name => NAV.find(g => g[0] === name)[1];
  grp("หลักสูตร").splice(2, 0, ["review", "ตรวจสอบข้อมูลหลักสูตร", "review.data|review.registrar", "review"]);
  grp("หลักสูตร").push(["closures", "งดรับ/ปิดหลักสูตร", "program.close|program.lifecycle|report.ops"]);
  grp("ข้อมูลวิชาการ").splice(1, 0, ["central", "รายวิชากลาง GE/วิชาบริการ", "course.view"], ["courselink", "เชื่อมรหัสรายวิชากับทะเบียน", "course.link"]);
  grp("ประชุมและติดตาม").splice(0, 0, ["progress", "ติดตามการจัดทำหลักสูตร", "report.ops|report.exec"]);
})();
const _renderNavBase = renderNav;
renderNav = function () {
  _renderNavBase();
  const n = D.life.reviews.filter(r => ["WAITING", "IN_REVIEW"].includes(r.status) && ((r.phase === 1 && can("review.data")) || (r.phase === 2 && can("review.registrar")))).length;
  const a = document.querySelector('#nav a[href="#review"]'); if (a && n && a.insertAdjacentHTML) a.insertAdjacentHTML("beforeend", `<span class="count">${n}</span>`);
};

/* ---------- หน้าหลักสูตร: แท็บใหม่ + แถบสถานะความครบถ้วน ---------- */
PTABS.splice(1, 0, ["complete", "ความครบถ้วน"], ["policy", "ข้อมูลเชิงนโยบาย"]);
const _programRender = ROUTES.program.render;
ROUTES.program.render = function (args) {
  const html = _programRender(args); const p = IDX.prog.get(Number(args[0])); if (!p || !inScope(p)) return html;
  const v = latestVer(p); const ls = lifeStatus(p);
  let bar = `<div class="lc-bar">${pill(ls[0], ls[1])}`;
  if (["DRAFT", "IN_REVIEW"].includes(v.state)) { const cp = completeness(p, v); bar += ` ${compPill(cp)} ${cp.pct < 1 ? `<span class="pill bad">ยังไม่สามารถส่งอนุมัติได้ — ขาด ${cp.missing.length} รายการ</span>` : pill("พร้อมส่งเข้าเส้นทางอนุมัติ", "good")} <a href="#program-${p.id}-complete" class="small">ดูรายการตรวจ</a>`; }
  const lin = D.life.lineage[v.id] || D.life.lineage[activeVer(p).id];
  if (lin) bar += ` <span class="muted small">${{ SPLIT: "แยกจาก", MERGE: "รวมจาก", ONE_TO_ONE: "ปรับปรุงจาก" }[lin.mode]} ${lin.parents.map(x => `<a href="#program-${x.prog}">${esc(progTitle(IDX.prog.get(x.prog), true))}</a>`).join(", ")}${lin.simulated ? " (จำลอง)" : ""}</span>`;
  return html.replace(`<nav class="tabs">`, bar + `</div><nav class="tabs">`);
};

PTAB.complete = p => {
  const v = latestVer(p); const cp = completeness(p, v); const inprog = ["DRAFT", "IN_REVIEW"].includes(v.state); const c = openCaseOf(p);
  const sub = !inprog ? pill("ฉบับอนุมัติแล้ว", "good") : c && c.status === "IN_PROGRESS" ? `<span class="btn" aria-disabled="true">✔ ส่งอนุมัติแล้ว</span>` : cp.pct >= 1 || settingVal("completeness.submit_gate", "BLOCK") !== "BLOCK"
    ? (c ? `<a class="btn primary" href="#case-${c.id}">➤ ส่งเข้าเส้นทางอนุมัติ</a>` : "") : `<span class="btn" aria-disabled="true" title="ต้องครบ 100% ก่อน">🔒 ส่งอนุมัติไม่ได้ (${Math.round(cp.pct * 100)}%)</span>`;
  const reviews = D.life.reviews.filter(r => r.prog === p.id).sort((a, b) => a.phase - b.phase || a.round - b.round);
  const pf = profileOf(v) || {}; const sg = pf.signed || {};
  return `<div class="note ${inprog ? "" : "info"}">${inprog ? `ฉบับ พ.ศ. ${v.year} (${esc(VSTATE[v.state][0])}) — นับรายการตรวจบังคับ ${cp.reqDone}/${cp.reqTotal} · ค่าตั้งค่า <span class="mono">completeness.submit_gate</span> = ${esc(settingVal("completeness.submit_gate", "BLOCK"))}` : `ฉบับที่อนุมัติแล้ว — ใช้ดูความครบของข้อมูลที่ย้ายจากระบบเดิม (ส่วนที่ขาดเติมได้เมื่อทำฉบับปรับปรุง)`}</div>
    <div class="actions">${compPill(cp)} ${sub} ${btn("รายงานผลตรวจสอบข้อมูล", "open-doc", { data: { code: "DOC-REVIEW", id: p.id }, perm: "doc.export" })}</div>
    <div class="meter" aria-label="ความครบถ้วน ${Math.round(cp.pct * 100)}%"><i style="width:${Math.round(cp.pct * 100)}%"></i></div>
    <div class="grid g2">${cp.sections.map(s => panel(`${s.th}`, `<ul class="list">${s.items.map(it => `<li><div class="grow">${dotHtml(it.state)} <b>${it.code}</b> ${esc(it.th)}${it.req ? ' <span class="req">*</span>' : ""}<br><span class="muted small">${esc(it.msg)}</span></div>${it.state !== "na" ? `<a class="btn sm" href="#${itemLink(p, v, it)}">${it.state === "done" ? "ดู" : "ไปกรอก"}</a>` : ""}</li>`).join("")}</ul>`, { flush: true, actions: dotHtml(s.state) })).join("")}</div>
    <p class="muted small">${dotHtml("done")} ครบ · ${dotHtml("partial")} ยังไม่ครบ · ${dotHtml("empty")} ยังไม่กรอก · <span class="req">*</span> นับในความครบถ้วน — หมวด 8 เอกสาร ไม่นับ (แนวทาง CMS มอ.)</p>
    ${panel("ผลตรวจสอบข้อมูล 2 ระยะ", reviews.length ? table([{ th: "ระยะ", val: r => r.phase === 1 ? "1 ก่อนสภาวิชาการ" : "2 เทียบทะเบียน" }, { th: "รอบ", num: true, val: r => r.round }, { th: "สถานะ", html: r => pillOf(REVIEW_STATUS, r.status) }, { th: "ส่งตรวจ", val: r => thDate(r.submitted) }, { th: "ตรวจเสร็จ", val: r => r.reviewed ? thDate(r.reviewed) : "—" }, { th: "หมวดไม่ผ่าน", wrap: true, val: r => Object.entries(r.items).filter(([, x]) => x.result === "FAIL").map(([k, x]) => `${k}: ${x.note}`).join(" · ") || "—" }, { th: "", html: r => `<a class="btn sm" href="#review-${r.id}">เปิด</a>` }], reviews) : `<div class="empty">ยังไม่เข้าสู่การตรวจสอบข้อมูล — ระยะ 1 เริ่มเมื่อผ่านกรรมการกลั่นกรองหลักสูตร</div>`, { flush: true })}
    ${v.state === "APPROVED" || v.state === "SUPERSEDED" ? panel("ไฟล์ฉบับลงนาม", `<ul class="list">${[["COUNCIL_DOCX", "ฉบับสภามหาวิทยาลัยอนุมัติ (DOCX)"], ["COUNCIL_PDF", "ฉบับสภามหาวิทยาลัยอนุมัติ (PDF)"], ["MHESI_PDF", "ฉบับที่ สป.อว. รับทราบ (PDF)"]].map(([k, t]) => `<li><span class="grow">${t}</span>${sg[k] ? pill("แนบแล้ว", "good") : pill("ยังไม่แนบ", "warn")} ${!sg[k] ? btn("แนบไฟล์ (จำลอง)", "signed-upload", { sm: true, data: { ver: v.id, kind: k }, perm: "cisa.record" }) : ""}</li>`).join("")}</ul>`, { flush: true }) : ""}`;
};
act("signed-upload", el => { const pf = ensureProfile(IDX.ver.get(Number(el.dataset.ver)).v); pf.signed[el.dataset.kind] = true; audit("แนบไฟล์ฉบับลงนาม", el.dataset.kind); persist(); toast("แนบไฟล์แล้ว (จำลอง — ระบบจริงเก็บใน object storage)"); rerender(); });

/* ---------- แท็บข้อมูลเชิงนโยบาย (B12–B15, B02) ---------- */
PTAB.policy = p => {
  const v = latestVer(p); const pf = profileOf(v); const ed = editable(p);
  if (!pf && !ed) return `<div class="note">ฉบับนี้ย้ายจากระบบเดิม ยังไม่มีข้อมูลเชิงนโยบาย/ประชาสัมพันธ์ — เติมได้เมื่อสร้างฉบับปรับปรุง ${lockNote(p)}</div>`;
  const P0 = pf || ensureProfile(v); const O = D.life.options; const name = (dim, code) => (O[dim].find(o => o.code === code) || { th: code }).th;
  const e = (label, actn) => ed ? btn(label, actn, { sm: true, data: { ver: v.id } }) : "";
  const today0 = today();
  const cert = P0.ploCert;
  return lockNote(p) + `<div class="grid g2">
    ${panel("การตอบสนองยุทธศาสตร์ (หมวด 1.3)", `<ul class="list">${DIMS.map(([k, t]) => `<li><div class="grow"><b>${t}</b><br>${(P0.response[k] || []).length ? P0.response[k].map(c => `<span class="tag">${esc(name(k, c))}</span>`).join(" ") : `<span class="muted small">ยังไม่ระบุ</span>`}</div>${k === "NPU_STRATEGY" ? gapPill("G26") : ""}</li>`).join("")}</ul>`, { flush: true, actions: e("แก้ไข", "pol-response") })}
    ${panel("ข้อมูลประชาสัมพันธ์ (หมวด 7)", kv([["จุดเด่น (ไทย)", esc(P0.pr.highlightTh) || "—"], ["Highlight (EN)", esc(P0.pr.highlightEn) || "—"], ["อาชีพ (ไทย)", esc(P0.pr.careerTh) || "—"], ["Careers (EN)", esc(P0.pr.careerEn) || "—"],
      ["คุณลักษณะบัณฑิต", (P0.pr.attributes || []).map(a => `${a.kind === "GENERAL" ? "ทั่วไป" : "ตามวิชาชีพ"}: ${esc(a.text)}`).join("<br>") || "—"], ["Keyword", `${(P0.pr.kwTh || []).map(esc).join(", ") || "—"} / ${(P0.pr.kwEn || []).map(esc).join(", ") || "—"}`]]) +
      `<div class="actions">${btn("ฉบับเผยแพร่", "open-doc", { sm: true, data: { code: "DOC-PUBLIC", id: p.id } })}<span class="muted small">ส่งต่อเว็บไซต์รับสมัครผ่าน GET /programs/{id}/public</span></div>`, { actions: e("แก้ไข", "pol-pr") })}
    ${panel("กรรมการบริหารหลักสูตร (หมวด 6.1)", table([{ th: "ตำแหน่ง", val: x => ({ CHAIR: "ประธาน", COORDINATOR: "ผู้ประสานงาน", MEMBER: "กรรมการ", SECRETARY: "เลขานุการ" })[x.pos] }, { th: "ชื่อ (จาก ERP-HR)", html: x => x.staff ? `<a href="#" data-act="staff-open" data-id="${x.staff}">${esc(staffName(x.staff))}</a>` : `<span class="muted">ยังไม่ระบุ</span>` }, { th: "โทรศัพท์", html: x => x.phone ? esc(x.phone) : x.pos === "COORDINATOR" ? pill("ต้องระบุ", "warn") : "—" }], P0.committee), { flush: true, actions: e("แก้ไข", "pol-committee") })}
    ${panel("ตัวชี้วัดหลักสูตรและ CWIE (หมวด 5.2)", table([{ th: "ตัวชี้วัด", wrap: true, val: o => o.th }, { th: "ค่า", num: true, html: o => P0.qa.indicators[o.code] != null ? fmt(P0.qa.indicators[o.code], o.unit === "%" ? 1 : 2) : pill("ยังไม่ตอบ", "warn") }], O.INDICATORS) + `<div class="body">CWIE: <b>${esc((O.CWIE.find(x => x.code === P0.qa.cwie) || { th: "ยังไม่ระบุ" }).th)}</b> ${gapPill("G27")}</div>`, { flush: true, actions: e("แก้ไข", "pol-indicators") })}
    ${panel("ความร่วมมือ / MOU (หมวด 1.4)", table([{ th: "หน่วยงาน", wrap: true, val: m => m.name }, { th: "ประเภท", val: m => `${m.agreement} · ${(O.PARTNER_TYPE.find(x => x.code === m.type) || {}).th || ""}` }, { th: "ขอบเขต", wrap: true, val: m => m.scope }, { th: "หมดอายุ", html: m => m.end ? thDate(m.end) + (daysBetween(today0, m.end) <= 90 && daysBetween(today0, m.end) >= 0 ? " " + pill(`อีก ${daysBetween(today0, m.end)} วัน`, "warn") : daysBetween(today0, m.end) < 0 ? " " + pill("หมดอายุ", "bad") : "") : "—" }], P0.partners, { empty: "ไม่มีความร่วมมือ (ไม่บังคับ)" }), { flush: true, actions: e("+ เพิ่ม", "pol-partner") })}
    ${panel("การรับรอง PLO (หมวด 2.3)", (["VOC", "HVOC"].includes(p.level) ? `<div class="empty">ไม่ใช้กับระดับ ${esc(levelAbbr(p.level))}</div>` : cert ? kv([["วันที่รับรอง", thDate(cert.date, true)], ["การประชุม", esc(cert.meeting)], ["ประธาน", esc(cert.chair)]]) : `<div class="note warn">ยังไม่รับรอง PLO — ค่าตั้งค่า <span class="mono">plo.cert_required_before_detail</span> = ${esc(String(settingVal("plo.cert_required_before_detail", false)))} ${gapPill("G29")}</div>`) +
      `<div class="actions">${btn("ใบรับรอง PLO", "open-doc", { sm: true, data: { code: "DOC-PLO", id: p.id }, perm: "doc.export" })}${!cert && !["VOC", "HVOC"].includes(p.level) && obeOf(p) ? btn("บันทึกการรับรอง PLO", "plo-cert", { sm: true, kind: "primary", data: { ver: v.id }, perm: "plo.certify" }) : ""}</div>`)}
  </div>`;
};
function pfFrom(el) { const { p, v } = IDX.ver.get(Number(el.dataset.ver)); return { p, v, pf: ensureProfile(v) }; }
act("pol-response", el => {
  const { v, pf } = pfFrom(el); const O = D.life.options;
  openModal("การตอบสนองยุทธศาสตร์", `<form data-form="pol-response" data-ver="${v.id}">${DIMS.map(([k, t]) => `<fieldset class="field full"><legend>${t} (อย่างน้อย 1)</legend><div class="checks">${O[k].map(o => `<label><input type="checkbox" name="${k}" value="${o.code}"${(pf.response[k] || []).includes(o.code) ? " checked" : ""}> ${esc(o.th)}</label>`).join("")}</div><span class="err" data-err="${k}"></span></fieldset>`).join("")}<div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`, { wide: true });
});
form("pol-response", (d, f) => {
  const { pf } = pfFrom(f); const errs = {};
  DIMS.forEach(([k]) => { pf.response[k] = $$(`input[name="${k}"]:checked`, f).map(i => i.value); if (!pf.response[k].length) errs[k] = "เลือกอย่างน้อย 1 รายการ"; });
  persist(); if (!formErrors(f, errs)) { toast("บันทึกแล้ว — ยังไม่ครบทุกหัวข้อ (สถานะส้ม)"); return; }
  audit("บันทึกการตอบสนองยุทธศาสตร์", f.dataset.ver); closeModal(); toast("บันทึกแล้ว"); rerender();
});
act("pol-pr", el => {
  const { v, pf } = pfFrom(el); const r = pf.pr;
  openModal("ข้อมูลประชาสัมพันธ์", `<form data-form="pol-pr" data-ver="${v.id}"><div class="form-grid">${field("highlightTh", "จุดเด่นและเอกลักษณ์ (ไทย)", { type: "textarea", value: r.highlightTh, required: true, full: true, rows: 2 })}${field("highlightEn", "Highlights (English)", { type: "textarea", value: r.highlightEn, required: true, full: true, rows: 2 })}${field("careerTh", "อาชีพที่ประกอบได้ (ไทย)", { type: "textarea", value: r.careerTh, required: true, full: true, rows: 2 })}${field("careerEn", "Career opportunities (English)", { type: "textarea", value: r.careerEn, required: true, full: true, rows: 2 })}${field("attrs", "คุณลักษณะบัณฑิต (บรรทัดละ 1 ข้อ ขึ้นต้น ทั่วไป: หรือ วิชาชีพ:)", { type: "textarea", value: (r.attributes || []).map(a => (a.kind === "GENERAL" ? "ทั่วไป: " : "วิชาชีพ: ") + a.text).join("\n"), required: true, full: true, rows: 3 })}${field("kwTh", "Keyword ไทย (คั่นด้วย ,)", { value: (r.kwTh || []).join(", "), required: true })}${field("kwEn", "Keyword English (comma separated)", { value: (r.kwEn || []).join(", "), required: true })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`, { wide: true });
});
form("pol-pr", (d, f) => {
  const errs = {}; ["highlightTh", "highlightEn", "careerTh", "careerEn", "attrs", "kwTh", "kwEn"].forEach(k => { if (!d[k]) errs[k] = "จำเป็นต้องกรอก"; });
  if (d.highlightEn && /[฀-๿]/.test(d.highlightEn)) errs.highlightEn = "ข้อความภาษาอังกฤษต้องไม่มีอักษรไทย"; if (d.careerEn && /[฀-๿]/.test(d.careerEn)) errs.careerEn = "ข้อความภาษาอังกฤษต้องไม่มีอักษรไทย";
  const { pf } = pfFrom(f); const split = s => (s || "").split(",").map(x => x.trim()).filter(Boolean);
  Object.assign(pf.pr, { highlightTh: d.highlightTh, highlightEn: d.highlightEn, careerTh: d.careerTh, careerEn: d.careerEn, kwTh: split(d.kwTh), kwEn: split(d.kwEn),
    attributes: (d.attrs || "").split("\n").map(x => x.trim()).filter(Boolean).map(x => ({ kind: /^วิชาชีพ/.test(x) ? "PROFESSIONAL" : "GENERAL", text: x.replace(/^(ทั่วไป|วิชาชีพ)\s*:\s*/, "") })) });
  persist(); if (!formErrors(f, errs)) return; audit("บันทึกข้อมูลประชาสัมพันธ์", f.dataset.ver); closeModal(); toast("บันทึกข้อมูลประชาสัมพันธ์แล้ว"); rerender();
});
act("pol-committee", el => {
  const { p, v, pf } = pfFrom(el); const pool = D.staffData.staff.filter(s => s.fac === p.fac && s.status === "ACTIVE").map(s => [s.id, `${staffName(s.id)} (${s.id})`]);
  const get = pos => pf.committee.find(x => x.pos === pos) || {};
  openModal("กรรมการบริหารหลักสูตร", `<form data-form="pol-committee" data-ver="${v.id}"><div class="form-grid">${field("chair", "ประธานหลักสูตร", { type: "select", options: pool, value: get("CHAIR").staff, required: true, full: true })}${field("coord", "ผู้ประสานงานหลักสูตร", { type: "select", options: pool, value: get("COORDINATOR").staff, required: true, full: true })}${field("phone", "โทรศัพท์ผู้ประสานงาน", { value: get("COORDINATOR").phone, required: true, placeholder: "042-5xxxxx" })}</div><div class="note">รายชื่อจาก ERP-HR (D10) — CMS เก็บเฉพาะบทบาทในหลักสูตร</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`);
});
form("pol-committee", (d, f) => {
  const errs = {}; if (!d.chair) errs.chair = "เลือกประธาน"; if (!d.coord) errs.coord = "เลือกผู้ประสานงาน"; if (!/^0\d{1,2}-?\d{6,7}$/.test(d.phone || "")) errs.phone = "รูปแบบโทรศัพท์ เช่น 042-503777";
  if (!formErrors(f, errs)) return; const { pf } = pfFrom(f);
  pf.committee = [{ pos: "CHAIR", staff: d.chair, phone: "" }, { pos: "COORDINATOR", staff: d.coord, phone: d.phone }].concat(pf.committee.filter(x => !["CHAIR", "COORDINATOR"].includes(x.pos)));
  audit("บันทึกกรรมการบริหารหลักสูตร", f.dataset.ver); persist(); closeModal(); toast("บันทึกแล้ว"); rerender();
});
act("pol-indicators", el => {
  const { v, pf } = pfFrom(el); const O = D.life.options;
  openModal("ตัวชี้วัดหลักสูตรและ CWIE", `<form data-form="pol-indicators" data-ver="${v.id}"><div class="form-grid">${O.INDICATORS.map(o => field("i_" + o.code, `${o.th} (${o.unit})`, { type: "number", value: pf.qa.indicators[o.code], step: "any", min: 0, max: o.unit === "%" ? 100 : 5, required: true, full: true })).join("")}${field("cwie", "รูปแบบ CWIE", { type: "select", options: O.CWIE.map(x => [x.code, x.th]), value: pf.qa.cwie, required: true, full: true })}</div><div class="note">รายการตัวชี้วัดเป็นค่าตั้งค่า (รอข้อมูล G27)</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`);
});
form("pol-indicators", (d, f) => {
  const { pf } = pfFrom(f); const errs = {};
  D.life.options.INDICATORS.forEach(o => { const val = d["i_" + o.code]; if (val === "") { delete pf.qa.indicators[o.code]; errs["i_" + o.code] = "จำเป็นต้องกรอก"; } else if (o.unit === "%" && (Number(val) < 0 || Number(val) > 100)) errs["i_" + o.code] = "0–100"; else pf.qa.indicators[o.code] = Number(val); });
  pf.qa.cwie = d.cwie || ""; if (!d.cwie) errs.cwie = "เลือกรูปแบบ";
  persist(); if (!formErrors(f, errs)) return; audit("บันทึกตัวชี้วัดหลักสูตร", f.dataset.ver); closeModal(); toast("บันทึกแล้ว"); rerender();
});
act("pol-partner", el => {
  const { v } = pfFrom(el); const O = D.life.options;
  openModal("เพิ่มความร่วมมือ", `<form data-form="pol-partner" data-ver="${v.id}"><div class="form-grid">${field("name", "ชื่อสถาบัน/สถานประกอบการ", { required: true, full: true })}${field("type", "ประเภทหน่วยงาน", { type: "select", options: O.PARTNER_TYPE.map(x => [x.code, x.th]), required: true })}${field("agreement", "ประเภทข้อตกลง", { type: "select", options: ["MOU", "MOA", "CONTRACT"], required: true, blank: false })}${field("scope", "ขอบเขตความร่วมมือ", { full: true })}${field("start", "วันที่เริ่ม", { type: "date", required: true })}${field("end", "วันหมดอายุ", { type: "date" })}${field("degree", "การให้ปริญญา", { type: "select", options: [["NONE", "ไม่มี"], ["JOINT", "ปริญญาร่วม"], ["DOUBLE", "สองปริญญา"]], blank: false })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`);
});
form("pol-partner", (d, f) => {
  const errs = {}; if (!d.name) errs.name = "จำเป็นต้องกรอก"; if (!d.type) errs.type = "เลือกประเภท"; if (!d.start) errs.start = "ระบุวันที่เริ่ม"; if (d.end && d.start && d.end <= d.start) errs.end = "ต้องหลังวันที่เริ่ม";
  if (!formErrors(f, errs)) return; const { pf } = pfFrom(f); pf.partners.push({ name: d.name, type: d.type, agreement: d.agreement, scope: d.scope, degree: d.degree, start: d.start, end: d.end || null });
  audit("เพิ่มความร่วมมือ", d.name); persist(); closeModal(); toast("เพิ่มความร่วมมือแล้ว"); rerender();
});
act("plo-cert", el => openModal("บันทึกการรับรอง PLO", `<form data-form="plo-cert" data-ver="${el.dataset.ver}"><div class="form-grid">${field("date", "วันที่รับรอง", { type: "date", value: today(), required: true })}${field("meeting", "การประชุม", { value: "คณะกรรมการกลั่นกรองหลักสูตร ครั้งที่ 10/2569", required: true, full: true })}${field("chair", "ประธานที่ประชุม", { value: "รองอธิการบดีฝ่ายวิชาการ", required: true, full: true })}</div><div class="note">แนบไฟล์มติ PDF ≤ 20 MB ในระบบจริง · แก้ PLO หลังรับรองจะต้องรับรองใหม่</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`));
form("plo-cert", (d, f) => {
  if (!formErrors(f, Object.assign({}, !d.date ? { date: "ระบุวันที่" } : {}, !d.meeting ? { meeting: "ระบุการประชุม" } : {}))) return;
  const { pf } = pfFrom(f); pf.ploCert = { date: d.date, meeting: d.meeting, chair: d.chair }; audit("รับรอง PLO", f.dataset.ver); persist(); closeModal(); toast("บันทึกการรับรอง PLO แล้ว"); rerender();
});
// แก้ PLO หลังรับรอง → ยกเลิกการรับรอง
const _ploSave = FORMS["plo-save"];
FORMS["plo-save"] = (d, f) => { const p = IDX.prog.get(Number(f.dataset.id)); const pf = profileOf(latestVer(p)); const had = pf && pf.ploCert; _ploSave(d, f); if (had && $("#modal").hidden) { pf.ploCert = null; persist(); toast("แก้ PLO แล้ว — ต้องรับรอง PLO ใหม่"); rerender(); } };

/* ---------- คุมการส่ง (B01) และการบรรจุวาระสภาวิชาการ (B07) ---------- */
const _caseSubmit = ACTIONS["case-submit"];
ACTIONS["case-submit"] = el => {
  const c = IDX.case.get(Number(el.dataset.id)); const p = IDX.prog.get(c.prog); const v = (IDX.ver.get(c.ver) || {}).v;
  if (c.type !== "CLOSE" && v && settingVal("completeness.submit_gate", "BLOCK") === "BLOCK") {
    const cp = completeness(p, v);
    if (cp.pct < 1) { openModal("ยังไม่สามารถส่งอนุมัติได้", `<div class="note bad">ความครบถ้วน ${Math.round(cp.pct * 100)}% — ต้องครบ 100% (ค่าตั้งค่า completeness.submit_gate = BLOCK)</div><ul class="list">${cp.missing.map(it => `<li><div class="grow">${dotHtml(it.state)} <b>${it.code}</b> ${esc(it.th)}<br><span class="muted small">${esc(it.msg)}</span></div><a class="btn sm" href="#${itemLink(p, v, it)}" data-act="close-modal-go" data-to="${itemLink(p, v, it)}">ไปกรอก</a></li>`).join("")}</ul><div class="form-foot">${btn("ปิด", "close-modal")}</div>`); return; }
  }
  _caseSubmit(el);
};
act("close-modal-go", el => { closeModal(); go(el.dataset.to); });
const _caseSchedule = ACTIONS["case-schedule"];
ACTIONS["case-schedule"] = el => {
  const c = IDX.case.get(Number(el.dataset.id)); const cur = currentStep(c); const gate = settingVal("review.phase1_gate", "BLOCK");
  if (cur && cur.body !== "FACULTY_BOARD" && c.type !== "CLOSE" && gate !== "OFF") {
    const r = lastReview(c, 1);
    if (!r || r.status !== "PASSED") {
      if (gate === "BLOCK") { openModal("ยังบรรจุวาระไม่ได้", `<div class="note bad">ต้องผ่านการตรวจสอบข้อมูลระยะ 1 ทุกหมวดก่อนเข้ากรรมการระดับมหาวิทยาลัย (ตรวจครั้งเดียวก่อนกลั่นกรอง — review.phase1_gate = BLOCK)</div><p>สถานะ: ${r ? pillOf(REVIEW_STATUS, r.status) + " รอบ " + r.round : pill("ยังไม่ส่งตรวจ", "warn")}</p><div class="form-foot">${btn("ปิด", "close-modal")}${r ? `<a class="btn primary" href="#review-${r.id}" data-act="close-modal-go" data-to="review-${r.id}">ไปที่การตรวจสอบ</a>` : ""}</div>`); return; }
      toast("คำเตือน: ยังไม่ผ่านการตรวจสอบข้อมูลระยะ 1");
    }
  }
  _caseSchedule(el);
};
const _caseRender = ROUTES.case.render;
ROUTES.case.render = function (args) {
  const html = _caseRender(args); const c = IDX.case.get(Number(args[0])); if (!c) return html;
  const p = IDX.prog.get(c.prog); const v = (IDX.ver.get(c.ver) || {}).v; if (!v || c.type === "CLOSE") {
    const cl = D.life.closures.find(x => x.case === c.id);
    return cl ? html + panel("รายละเอียดการขอ" + CLOSE_KIND[cl.kind], kv([["เหตุผล", esc(cl.reason)], ["มีผล", `ภาค ${cl.term}/${cl.year}`], ["นักศึกษาคงค้าง", `${cl.remaining.reduce((a, r) => a + r.n, 0)} คน`], ["แผนดูแลนักศึกษา", esc(cl.carePlan) || "—"]]) + `<div class="actions">${btn("แบบเสนองดรับ/ปิด", "open-doc", { sm: true, data: { code: "DOC-CLOSE", id: p.id } })}</div>`) : html;
  }
  const cp = completeness(p, v); const r1 = lastReview(c, 1); const r2 = lastReview(c, 2);
  return html + `<div class="grid g2">${panel("ความครบถ้วนของฉบับที่เสนอ", `<p>${compPill(cp)} รายการบังคับ ${cp.reqDone}/${cp.reqTotal}</p>${cp.missing.length ? `<ul class="list">${cp.missing.slice(0, 8).map(it => `<li>${dotHtml(it.state)} ${it.code} ${esc(it.th)}</li>`).join("")}</ul>` : ""}<a class="btn sm" href="#program-${p.id}-complete">ดูทั้งหมด</a>`)}
    ${panel("ตรวจสอบข้อมูล 2 ระยะ", `<ul class="list"><li><span class="grow">ระยะ 1 ก่อนสภาวิชาการ (R1)</span>${r1 ? `<a href="#review-${r1.id}">${pillOf(REVIEW_STATUS, r1.status)} รอบ ${r1.round}</a>` : pill("ยังไม่ถึง", "neutral")}</li><li><span class="grow">ระยะ 2 เทียบทะเบียน (R2)</span>${r2 ? `<a href="#review-${r2.id}">${pillOf(REVIEW_STATUS, r2.status)} รอบ ${r2.round}</a>` : pill("หลังสภามหาวิทยาลัย", "neutral")}</li></ul>`, { flush: true })}</div>`;
};

/* ---------- S22 ตรวจสอบข้อมูลหลักสูตร ---------- */
route("review", { perm: null, title: "ตรวจสอบข้อมูลหลักสูตร", render(args) {
  if (args[0]) return reviewDetail(Number(args[0]));
  if (!canAny("review.data|review.registrar|program.edit|report.ops")) return `<div class="note bad">${esc(denyMsg("review.data"))}</div>`;
  const ph = Number(S.ui.revPhase || (can("review.registrar") && !can("review.data") ? 2 : 1));
  const rows = D.life.reviews.filter(r => r.phase === ph && inScope(IDX.prog.get(r.prog))).sort((a, b) => ({ WAITING: 0, IN_REVIEW: 1, RETURNED: 2, PASSED: 3 })[a.status] - ({ WAITING: 0, IN_REVIEW: 1, RETURNED: 2, PASSED: 3 })[b.status] || b.id - a.id);
  return pageHead("ตรวจสอบข้อมูลหลักสูตร", { lead: "ระยะ 1: กองบริการการศึกษาตรวจทุกหมวดก่อนบรรจุวาระสภาวิชาการ · ระยะ 2: นายทะเบียนหลักสูตรตรวจโครงสร้าง/แผน/รหัสวิชาเทียบระบบทะเบียนหลังสภามหาวิทยาลัยอนุมัติ (แนวทาง CMS มอ. · ผู้ตรวจเป็นค่าตั้งค่า P23)" }) +
    `<nav class="tabs">${[1, 2].map(n => `<a href="#review" data-act="rev-phase" data-n="${n}"${n === ph ? ' aria-current="page"' : ""}>ระยะ ${n} (${D.life.reviews.filter(r => r.phase === n && ["WAITING", "IN_REVIEW"].includes(r.status)).length} รอตรวจ)</a>`).join("")}</nav>` +
    panel(`${rows.length} รายการ`, table([{ th: "หลักสูตร", wrap: true, html: r => `<a href="#program-${r.prog}-complete">${esc(progTitle(IDX.prog.get(r.prog), true))}</a><br><span class="muted small">${esc(IDX.fac.get(IDX.prog.get(r.prog).fac).name)}</span>` }, { th: "เรื่อง", html: r => IDX.case.get(r.case) ? `<a href="#case-${r.case}" class="mono">${IDX.case.get(r.case).no}</a>` : "—" }, { th: "รอบ", num: true, val: r => r.round }, { th: "สถานะ", html: r => pillOf(REVIEW_STATUS, r.status) }, { th: "ส่งตรวจ", val: r => thDate(r.submitted) }, { th: "ผู้ตรวจ", val: r => userName(r.reviewer) }, { th: "", html: r => `<a class="btn sm ${["WAITING", "IN_REVIEW"].includes(r.status) ? "primary" : ""}" href="#review-${r.id}">${["WAITING", "IN_REVIEW"].includes(r.status) && can(r.phase === 1 ? "review.data" : "review.registrar") ? "ตรวจ" : "ดู"}</a>` }], rows, { empty: "ไม่มีรายการ" }), { flush: true });
} });
act("rev-phase", el => { S.ui.revPhase = Number(el.dataset.n); rerender(); });
function reviewDetail(id) {
  const r = D.life.reviews.find(x => x.id === id); if (!r) return `<div class="note bad">ไม่พบรายการตรวจ</div>`;
  const p = IDX.prog.get(r.prog); const v = (IDX.ver.get(r.ver) || {}).v || latestVer(p); const cp = completeness(p, v);
  const canDo = ["WAITING", "IN_REVIEW"].includes(r.status) && can(r.phase === 1 ? "review.data" : "review.registrar");
  const secs = r.phase === 1 ? cp.sections : [{ code: "S3", th: "โครงสร้าง แผนการเรียน และรหัสวิชา (เทียบระบบทะเบียน)", items: cp.sections.find(s => s.code === "S3").items, state: cp.sections.find(s => s.code === "S3").state }];
  const s = structureOf(p); const regCheck = s ? treeCourses(s).map(c => ({ c, ok: IDX.regCodes.has(c), link: D.life.courseLinks.find(x => x.code === c) })) : [];
  const later = D.life.reviews.some(y => y.case === r.case && y.phase === r.phase && y.round > r.round);
  const owner = me().role === "FC" && myFac(p);
  return pageHead(`ตรวจสอบข้อมูลระยะ ${r.phase}: ${p.name}`, { crumbs: `<a href="#review">ตรวจสอบข้อมูลหลักสูตร</a>`, lead: `${pillOf(REVIEW_STATUS, r.status)} รอบ ${r.round} · ฉบับ พ.ศ. ${v.year} · ส่งตรวจ ${thDate(r.submitted)} · ผู้ตรวจ ${esc(userName(r.reviewer))} ${srcPill(false)}`,
    actions: btn("รายงานผลตรวจ", "open-doc", { data: { code: "DOC-REVIEW", id: p.id }, perm: "doc.export" }) + `<a class="btn" href="#program-${p.id}-complete">หน้าหลักสูตร</a>` + (r.status === "RETURNED" && !later && owner ? btn("ส่งตรวจอีกครั้ง", "rev-resubmit", { kind: "primary", data: { id: r.id } }) : "") }) +
    (r.status === "RETURNED" && !later ? `<div class="note bad">ส่งกลับแก้ไข — คณะแก้เฉพาะหมวดที่ไม่ผ่านแล้วกด “ส่งตรวจอีกครั้ง” (รอบใหม่)</div>` : "") +
    `<form data-form="rev-save" data-id="${r.id}">${secs.map(sec => { const it = r.items[sec.code] || {};
      return panel(`${sec.th}`, `<ul class="list">${sec.items.map(i => `<li><div class="grow">${dotHtml(i.state)} ${i.code} ${esc(i.th)} <span class="muted small">— ${esc(i.msg)}</span></div></li>`).join("")}</ul>
        <div class="body">${canDo ? `<div class="form-grid">${field("r_" + sec.code, "ผลตรวจ", { type: "select", options: [["PASS", "ผ่าน"], ["FAIL", "ไม่ผ่าน"]], value: it.result || (sec.state === "done" ? "PASS" : ""), required: true })}${field("n_" + sec.code, "หมายเหตุถึงคณะ", { value: it.note, full: true })}</div>` : it.result ? `${pill(it.result === "PASS" ? "ผ่าน" : "ไม่ผ่าน", it.result === "PASS" ? "good" : "bad")} ${esc(it.note || "")}` : `<span class="muted">ยังไม่ตรวจ</span>`}</div>`, { flush: true, actions: dotHtml(sec.state) }); }).join("")}
      ${r.phase === 2 ? panel(`รหัสวิชาในโครงสร้างเทียบระบบทะเบียน (${regCheck.filter(x => !x.ok).length} รายการไม่พบ)`, regCheck.length ? table([{ th: "รหัส", html: x => `<span class="mono">${esc(x.c)}</span>` }, { th: "รายวิชา", val: x => (IDX.course.get(x.c) || {}).th || "" }, { th: "ทะเบียน", html: x => x.ok ? pill("พบ", "good") : pillOf(LINK_STATUS, x.link ? x.link.status : "NO_ID") }], regCheck, { maxH: 300 }) : `<div class="empty">ไม่มีโครงสร้าง ${gapPill("G05")}</div>`, { flush: true }) : ""}
      ${canDo ? `<div class="form-foot"><button class="btn primary" type="submit">บันทึกผลตรวจ</button></div>` : ""}</form>`;
}
form("rev-save", (d, f) => {
  const r = D.life.reviews.find(x => x.id === Number(f.dataset.id)); const errs = {}; const codes = Object.keys(d).filter(k => k.startsWith("r_")).map(k => k.slice(2));
  codes.forEach(k => { if (!d["r_" + k]) errs["r_" + k] = "เลือกผลตรวจ"; if (d["r_" + k] === "FAIL" && !d["n_" + k]) errs["n_" + k] = "ระบุสิ่งที่ต้องแก้"; });
  if (!formErrors(f, errs)) return;
  codes.forEach(k => { r.items[k] = { result: d["r_" + k], note: d["n_" + k] || "" }; });
  r.status = codes.every(k => d["r_" + k] === "PASS") ? "PASSED" : "RETURNED"; r.reviewed = today();
  const p = IDX.prog.get(r.prog);
  notifyRole("FC", p.fac, `ผลตรวจสอบข้อมูลระยะ ${r.phase} ${progTitle(p, true)}: ${REVIEW_STATUS[r.status][0]}`, "review-" + r.id);
  if (r.status === "PASSED" && r.phase === 2) D.integ.deliveries.unshift({ id: Date.now(), event: "program.version.verified", client: "c1", at: today() + "T" + new Date().toTimeString().slice(0, 5), status: "DELIVERED", code: 200, attempts: 1 });
  audit(`ตรวจสอบข้อมูลระยะ ${r.phase}`, `${p.code} ${r.status}`); persist(); toast(r.status === "PASSED" ? (r.phase === 1 ? "ผ่าน — บรรจุวาระสภาวิชาการได้" : "ผ่าน — ส่งข้อมูลให้ระบบทะเบียนเปิดรหัสหลักสูตร") : "ส่งกลับให้คณะแก้ไขแล้ว"); rerender();
});
act("rev-resubmit", el => { const r = D.life.reviews.find(x => x.id === Number(el.dataset.id)); const c = IDX.case.get(r.case); const nr = newReview(c, r.phase, r.round + 1); audit("ส่งตรวจข้อมูลอีกครั้ง", `${r.prog} รอบ ${nr.round}`); persist(); toast(`ส่งตรวจอีกครั้งแล้ว (รอบ ${nr.round})`); go("review-" + nr.id); });

/* ---------- S23 งดรับ/ปิดหลักสูตร (B05) ---------- */
route("closures", { perm: null, title: "งดรับ/ปิดหลักสูตร", render(args) {
  if (args[0] === "new") return closureForm(args[1] ? Number(args[1]) : null);
  const rows = D.life.closures.filter(x => inScope(IDX.prog.get(x.prog))).sort((a, b) => b.id - a.id);
  const ready = D.programs.filter(p => inScope(p) && p.life === "ADMISSION_SUSPENDED" && remainingTotal(p) === 0 && !openCaseOf(p));
  return pageHead("งดรับและปิดหลักสูตร", { lead: "2 ช่วงตามแนวทาง CMS มอ.: งดรับนักศึกษา (ยังมีนักศึกษาคงค้าง) → ปิดดำเนินการเมื่อไม่มีนักศึกษาคงค้าง · เส้นทาง คณะ → สภาวิชาการ → สภามหาวิทยาลัย", actions: btn("+ ยื่นงดรับ/ปิดหลักสูตร", "go", { kind: "primary", data: { to: "closures-new" }, perm: "program.close" }) }) +
    `<div class="grid g4">${[["งดรับอยู่", D.programs.filter(p => inScope(p) && p.life === "ADMISSION_SUSPENDED").length], ["ระหว่างขอปิด", D.programs.filter(p => inScope(p) && p.life === "CLOSING").length], ["ปิดดำเนินการแล้ว", D.programs.filter(p => inScope(p) && p.life === "CLOSED").length], ["งดรับและไม่มีนักศึกษาคงค้าง", ready.length]].map(([t, n]) => `<div class="panel stat"><span class="label">${t}</span><span class="value">${fmt(n)}</span></div>`).join("")}</div>` +
    (ready.length ? `<div class="note info">พร้อมยื่นปิด: ${ready.map(p => `<a href="#closures-new-${p.id}">${esc(progTitle(p, true))}</a>`).join(", ")}</div>` : "") +
    panel(`${rows.length} รายการ`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.prog}">${esc(progTitle(IDX.prog.get(x.prog), true))}</a>` }, { th: "ประเภท", val: x => CLOSE_KIND[x.kind] }, { th: "มีผล", val: x => `${x.term}/${x.year}` }, { th: "คงค้าง", num: true, val: x => x.remaining.reduce((a, r) => a + r.n, 0) }, { th: "สถานะหลักสูตร", html: x => pill(...lifeStatus(IDX.prog.get(x.prog))) }, { th: "เรื่อง", html: x => x.case && IDX.case.get(x.case) ? `<a href="#case-${x.case}">${esc(caseStageText(IDX.case.get(x.case)))}</a>` : `<span class="muted small">อนุมัติก่อนใช้ระบบ</span>` }, { th: "", html: x => btn("แบบเสนอ", "open-doc", { sm: true, data: { code: "DOC-CLOSE", id: x.prog } }) }], rows), { flush: true });
} });
function closureForm(pid) {
  if (!can("program.close")) return pageHead("ยื่นงดรับ/ปิดหลักสูตร") + `<div class="note bad">${esc(denyMsg("program.close"))}</div>`;
  const progs = D.programs.filter(p => inScope(p) && ["ACTIVE", "ADMISSION_SUSPENDED"].includes(p.life) && !openCaseOf(p) && (me().scope.type !== "FACULTY" || p.fac === me().scope.fac));
  const p = pid ? IDX.prog.get(pid) : null; const rem = p ? remainingOf(p) : []; const tot = rem.reduce((a, r) => a + r.n, 0); const O = D.life.options;
  return pageHead("ยื่นงดรับ/ปิดหลักสูตร (UC26)", { crumbs: `<a href="#closures">งดรับ/ปิดหลักสูตร</a>` }) +
    `<div class="grid g-side"><form class="panel" data-form="closure-new"><header><h2>แบบยื่น</h2></header><div class="body"><div class="form-grid">
      ${field("prog", "หลักสูตร", { type: "select", options: progs.map(x => [x.id, `${progTitle(x, true)} · ${lifeStatus(x)[0]}`]), value: pid, required: true, full: true })}
      ${p ? `${field("kind", "ประเภท", { type: "select", options: [["SUSPEND_ADMISSION", "งดรับนักศึกษา"], ["CLOSE", tot ? "ปิดดำเนินการ (ยังทำไม่ได้ — มีนักศึกษาคงค้าง)" : "ปิดดำเนินการ"]], value: p.life === "ADMISSION_SUSPENDED" && !tot ? "CLOSE" : "SUSPEND_ADMISSION", required: true, blank: false })}
      ${field("reasonCode", "เหตุผลหลัก", { type: "select", options: O.CLOSE_REASON.map(x => [x.code, x.th]), required: true })}${field("reason", "รายละเอียดเหตุผล", { type: "textarea", required: true, full: true, rows: 3 })}
      ${field("term", "ภาคการศึกษาที่มีผล", { type: "select", options: ["1", "2", "3"], value: "1", blank: false })}${field("year", "ปีการศึกษาที่มีผล (พ.ศ.)", { type: "number", value: 2570, min: 2569, max: 2580, required: true })}
      ${field("care", "แผนดูแลนักศึกษาคงค้าง", { type: "textarea", full: true, rows: 3, required: tot > 0, hint: tot ? `บังคับ — มีนักศึกษาคงค้าง ${tot} คน` : "ไม่มีนักศึกษาคงค้าง" })}
      ${field("transfer", "หลักสูตรรองรับการย้ายสาขา (ถ้ามี)", { type: "select", options: D.programs.filter(x => x.fac === p.fac && x.id !== p.id && x.life === "ACTIVE" && x.level === p.level).map(x => [x.id, progTitle(x, true)]), full: true })}
      ${field("typed", `พิมพ์รหัสหลักสูตร ${p.code} เพื่อยืนยัน`, { required: true, full: true, placeholder: p.code })}` : ""}
    </div>${p ? `<div class="form-foot"><a class="btn" href="#closures">ยกเลิก</a><button class="btn danger" type="submit">ยื่นเรื่อง</button></div>` : ""}</div></form>
    <div class="grid">${p ? panel("นักศึกษาคงค้างแยกตามปีที่เข้า", table([{ th: "ปีที่เข้า", val: r => r.entry }, { th: "จำนวน (คน)", num: true, val: r => r.n }], rem) + `<div class="body"><b>รวม ${tot} คน</b> ${srcPill(false)} <span class="muted small">ระบบจริงดึงจากแพลตฟอร์มทะเบียน ณ วันที่ยื่น ${gapPill("G13")}</span></div>`, { flush: true }) + panel("ข้อมูลหลักสูตร", kv([["ฉบับปัจจุบัน", `พ.ศ. ${activeVer(p).year}`], ["สถานะ", pill(...lifeStatus(p))], ["คณะ", esc(IDX.fac.get(p.fac).name)], ["รับเข้า 3 ปี", stat(p) ? stat(p).intake.join(" / ") : "—"]])) : `<div class="empty">เลือกหลักสูตรเพื่อดูนักศึกษาคงค้าง</div>`}</div></div>`;
}
document.addEventListener("change", e => { const s = e.target; if (s && s.name === "prog" && s.closest && s.closest('[data-form="closure-new"]')) go("closures-new-" + s.value); });
form("closure-new", (d, f) => {
  const p = IDX.prog.get(Number(d.prog)); if (!p) return; const tot = remainingTotal(p); const errs = {};
  if (!d.reasonCode) errs.reasonCode = "เลือกเหตุผล"; if (!d.reason || d.reason.length < 10) errs.reason = "อธิบายอย่างน้อย 10 ตัวอักษร";
  if (d.kind === "CLOSE" && tot > 0) errs.kind = `ยังมีนักศึกษาคงค้าง ${tot} คน — ต้องงดรับก่อน แล้วปิดเมื่อสำเร็จการศึกษาครบ`;
  if (tot > 0 && !d.care) errs.care = "ระบุแผนดูแลนักศึกษาคงค้าง"; if (d.typed !== p.code) errs.typed = "รหัสไม่ตรง";
  if (!formErrors(f, errs)) return;
  const cid = Math.max(...D.workflow.cases.map(c => c.id)) + 1; const v = activeVer(p);
  const c = { id: cid, no: `CMS-2569-${String(cid).padStart(4, "0")}`, prog: p.id, ver: v.id, type: "CLOSE", route: "CLOSE", title: `ขอ${CLOSE_KIND[d.kind]}หลักสูตร${p.degree} สาขาวิชา${p.name}`, status: "IN_PROGRESS", created: today(), by: S.user,
    steps: D.meta.routes.CLOSE.map((b, i) => ({ body: b, status: i === 0 ? "CURRENT" : "PENDING", meeting: null, date: null, result: null, note: "" })) };
  D.workflow.cases.push(c);
  D.life.closures.push({ id: Math.max(0, ...D.life.closures.map(x => x.id)) + 1, prog: p.id, kind: d.kind, reasonCode: d.reasonCode, reason: d.reason, term: Number(d.term), year: Number(d.year), remaining: remainingOf(p), carePlan: d.care || "", transfer: d.transfer ? Number(d.transfer) : null, case: cid, status: "IN_PROGRESS", date: today() });
  if (p.life === "ACTIVE" && d.kind === "CLOSE") p.life = "CLOSING";
  buildIndex(); notifyRole("UX", p.fac, `มีเรื่องขอ${CLOSE_KIND[d.kind]}รอเห็นชอบระดับคณะ: ${progTitle(p, true)}`, "case-" + cid); audit(`ยื่น${CLOSE_KIND[d.kind]}`, p.code); persist(); toast("ยื่นเรื่องแล้ว — เข้าเส้นทาง คณะ → สภาวิชาการ → สภามหาวิทยาลัย"); go("case-" + cid);
});

/* ---------- S24 รายวิชากลาง GE/วิชาบริการ (B08) ---------- */
function courseUsage(code) { return Object.entries(D.design.structures).filter(([, t]) => treeCourses(t).includes(code)).map(([id]) => IDX.prog.get(Number(id))).filter(Boolean); }
route("central", { perm: "course.view", title: "รายวิชากลาง", render(args) {
  const tab = args[0] || "list"; const k = S.ui.creqKind || "ALL";
  const tabs = `<nav class="tabs"><a href="#central"${tab === "list" ? ' aria-current="page"' : ""}>รายวิชากลาง (${D.life.central.length})</a><a href="#central-requests"${tab === "requests" ? ' aria-current="page"' : ""}>คำขอ (${D.life.centralRequests.filter(x => x.status === "PENDING").length} รออนุมัติ)</a></nav>`;
  const head = pageHead("รายวิชากลาง GE และวิชาบริการ", { lead: "รายวิชาที่หลายหลักสูตรใช้ร่วม — การเปิด แก้ไข ปรับปรุง ปิด/เปิดใช้ ต้องยื่นคำขอและผ่านการอนุมัติ (แนวทาง CMS มอ.) · ผู้อนุมัติตั้งค่าได้ (course.central_approver) · หมวดศึกษาทั่วไปฉบับล่าสุดรอข้อมูล G04",
    actions: canAny("course.edit|course.propose") ? btn("+ ยื่นคำขอ", "creq-new", { kind: "primary" }) : "" });
  if (tab === "requests") {
    const rows = D.life.centralRequests.filter(x => k === "ALL" || x.kind === k).sort((a, b) => (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1) || b.id - a.id);
    return head + tabs + `<div class="actions">${["ALL", ...Object.keys(CREQ_KIND)].map(x => btn(x === "ALL" ? "ทั้งหมด" : CREQ_KIND[x], "creq-kind", { sm: true, kind: x === k ? "primary" : "", data: { k: x } })).join("")}</div>` +
      panel(`${rows.length} คำขอ`, table([{ th: "#", num: true, val: x => x.id }, { th: "ประเภทคำขอ", val: x => CREQ_KIND[x.kind] }, { th: "รายวิชา", wrap: true, html: x => `<span class="mono">${esc(x.code)}</span> ${esc((x.after || {}).th || "")}` }, { th: "กลุ่ม", val: x => x.central === "GE" ? "ศึกษาทั่วไป" : "วิชาบริการ" }, { th: "ผู้ยื่น", val: x => userName(x.by) }, { th: "วันที่", val: x => thDate(x.at) }, { th: "สถานะ", html: x => pillOf(CREQ_STATUS, x.status) + (x.rejectReason ? `<br><span class="muted small">${esc(x.rejectReason)}</span>` : "") }, { th: "", html: x => btn(x.status === "PENDING" && can("course.central") ? "พิจารณา" : "ดู", "creq-open", { sm: true, kind: x.status === "PENDING" && can("course.central") ? "primary" : "", data: { id: x.id } }) }], rows), { flush: true });
  }
  const q = (S.ui.cq || "").trim();
  const rows = D.life.central.filter(c => !q || c.code.includes(q) || ((IDX.course.get(c.code) || {}).th || "").includes(q));
  return head + tabs + `<form class="filters" data-form="central-q"><input name="q" type="search" placeholder="ค้นหารหัสหรือชื่อวิชา" value="${esc(q)}" aria-label="ค้นหา"><button class="btn" type="submit">ค้นหา</button></form>` +
    panel(`${rows.length} รายวิชา`, table([{ th: "รหัส", html: c => `<span class="mono">${c.code}</span>` }, { th: "ชื่อวิชา", wrap: true, html: c => `<a href="#" data-act="course-open" data-id="${c.code}">${esc((IDX.course.get(c.code) || {}).th || "")}</a>` }, { th: "นก.", val: c => (IDX.course.get(c.code) || {}).cr || "" }, { th: "กลุ่ม", val: c => c.kind === "GE" ? "ศึกษาทั่วไป" : "วิชาบริการ" }, { th: "เจ้าของ", wrap: true, val: c => c.owner }, { th: "ใช้ในหลักสูตร", num: true, html: c => { const u = courseUsage(c.code); return u.length ? `<a href="#" data-act="creq-usage" data-code="${c.code}">${u.length}</a>` : "0"; } }, { th: "สถานะ", html: c => c.active ? pill("ใช้งาน", "good") : pill("ปิดใช้งาน", "neutral") }, { th: "", html: c => D.life.centralRequests.some(x => x.code === c.code && x.status === "PENDING") ? pill("มีคำขอค้าง", "warn") : "" }], rows, { maxH: 640 }), { flush: true }) +
    `<p class="muted small">รหัส/ชื่อ/คำอธิบายเป็นข้อมูลจริงจากระบบทะเบียน · การจัดเป็นรายวิชากลางและคำขอเป็นข้อมูลจำลอง · "ใช้ในหลักสูตร" นับจากโครงสร้างที่มีใน CMS (${Object.keys(D.design.structures).length} หลักสูตร) ${gapPill("G05")}</p>`;
} });
form("central-q", d => { S.ui.cq = d.q; rerender(); });
act("creq-kind", el => { S.ui.creqKind = el.dataset.k; rerender(); });
act("creq-usage", el => { const u = courseUsage(el.dataset.code); openModal(`หลักสูตรที่ใช้ ${el.dataset.code}`, `<ul class="list">${u.map(p => `<li><a href="#program-${p.id}-structure">${esc(progTitle(p, true))}</a></li>`).join("")}</ul><p class="muted small">การแก้รหัส ชื่อ หรือหน่วยกิตของรายวิชากลางกระทบทุกหลักสูตรในรายการนี้</p>`); });
act("creq-open", el => {
  const x = D.life.centralRequests.find(r => r.id === Number(el.dataset.id)); const u = courseUsage(x.code);
  const keys = [["th", "ชื่อวิชา (ไทย)"], ["en", "ชื่อวิชา (อังกฤษ)"], ["cr", "หน่วยกิต"], ["d", "คำอธิบายรายวิชา"]];
  const cmp = `<div class="table-wrap"><table class="t"><thead><tr><th>ข้อมูล</th><th>เดิม</th><th>ใหม่</th></tr></thead><tbody>${keys.map(([k, t]) => { const a = x.before ? x.before[k] : ""; const b = x.after ? x.after[k] : ""; const ch = a !== b; return `<tr${ch ? ' class="changed"' : ""}><td>${t}${ch ? " " + pill("เปลี่ยน", "warn") : ""}</td><td class="wrap">${esc(a || "—")}</td><td class="wrap">${esc(b || "—")}</td></tr>`; }).join("")}</tbody></table></div>`;
  openModal(`${CREQ_KIND[x.kind]} ${x.code}`, `<p>${pillOf(CREQ_STATUS, x.status)} ยื่นโดย ${esc(userName(x.by))} ${thDate(x.at)}</p>${["DEACTIVATE", "REACTIVATE"].includes(x.kind) ? "" : cmp}
    <div class="note ${u.length ? "warn" : ""}">หลักสูตรที่ใช้รายวิชานี้: ${u.length ? u.map(p => esc(progTitle(p, true))).join(", ") : "ไม่พบในโครงสร้างที่มีใน CMS"}</div>
    ${x.status === "PENDING" && can("course.central") ? `<form data-form="creq-decide" data-id="${x.id}">${field("reason", "เหตุผล (บังคับเมื่อไม่อนุมัติ)", { type: "textarea", full: true, rows: 2 })}<div class="form-foot">${btn("ปิด", "close-modal")}<button class="btn danger" type="submit" name="decision" value="REJECTED">ไม่อนุมัติ</button><button class="btn primary" type="submit" name="decision" value="APPROVED">อนุมัติ</button></div></form>` :
      x.status === "PENDING" && x.by === S.user ? `<div class="form-foot">${btn("ยกเลิกคำขอ", "creq-cancel", { data: { id: x.id } })}</div>` : ""}`, { wide: true });
});
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest('[data-form="creq-decide"] button[name="decision"]'); if (b) b.form.dataset.decision = b.value; });
form("creq-decide", (d, f) => {
  const x = D.life.centralRequests.find(r => r.id === Number(f.dataset.id)); const dec = f.dataset.decision || "APPROVED";
  if (dec === "REJECTED" && !d.reason) { formErrors(f, { reason: "ระบุเหตุผลที่ไม่อนุมัติ" }); return; }
  x.status = dec; x.decidedBy = S.user; x.rejectReason = dec === "REJECTED" ? d.reason : null;
  if (dec === "APPROVED") {
    const cen = IDX.centralByCode.get(x.code);
    if (x.kind === "OPEN") { D.newCourses.push(Object.assign({ code: x.code, c: 3, fac: "ส่วนกลาง", grp: "ศึกษาทั่วไป", type: "LECTURE" }, x.after)); D.life.central.push({ code: x.code, kind: x.central, owner: "คณะกรรมการบริหารหมวดวิชาศึกษาทั่วไป (G04)", active: true }); }
    if (["EDIT", "REVISE"].includes(x.kind)) D.courseEdits[x.code] = Object.assign({}, D.courseEdits[x.code] || {}, x.after);
    if (cen && x.kind === "DEACTIVATE") cen.active = false; if (cen && x.kind === "REACTIVATE") cen.active = true;
    D.integ.deliveries.unshift({ id: Date.now(), event: "course.updated", client: "c1", at: today() + "T" + new Date().toTimeString().slice(0, 5), status: "DELIVERED", code: 200, attempts: 1 });
  }
  notify(x.by, `คำขอ${CREQ_KIND[x.kind]} ${x.code}: ${CREQ_STATUS[dec][0]}`, "central-requests");
  buildIndex(); audit(`พิจารณาคำขอรายวิชากลาง`, `${x.code} ${dec}`); persist(); closeModal(); toast(`${CREQ_STATUS[dec][0]}แล้ว`); rerender();
});
act("creq-cancel", el => { const x = D.life.centralRequests.find(r => r.id === Number(el.dataset.id)); x.status = "CANCELLED"; persist(); closeModal(); rerender(); });
act("creq-new", () => {
  openModal("ยื่นคำขอรายวิชากลาง", `<form data-form="creq-new"><div class="form-grid">${field("kind", "ประเภทคำขอ", { type: "select", options: Object.entries(CREQ_KIND), required: true })}${field("central", "กลุ่ม", { type: "select", options: [["GE", "ศึกษาทั่วไป"], ["SERVICE", "วิชาบริการ"]], blank: false })}${field("code", "รหัสวิชา (คำขออื่นนอกจากเปิดใหม่ต้องเป็นรายวิชากลางที่มีอยู่)", { required: true, full: true })}${field("th", "ชื่อวิชา (ไทย)", { full: true })}${field("en", "ชื่อวิชา (อังกฤษ)", { full: true })}${field("cr", "หน่วยกิต เช่น 3 (2-2-5)")}${field("d", "คำอธิบายรายวิชา", { type: "textarea", full: true, rows: 3 })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">ยื่นคำขอ</button></div></form>`, { wide: true });
});
form("creq-new", (d, f) => {
  const errs = {}; const cen = IDX.centralByCode.get(d.code); const base = IDX.course.get(d.code);
  if (!d.kind) errs.kind = "เลือกประเภท";
  if (d.kind === "OPEN") { if (IDX.course.has(d.code)) errs.code = "รหัสนี้มีในระบบแล้ว"; if (!/^\d{8}$/.test(d.code || "")) errs.code = "รหัส 8 หลักตามระบบทะเบียน (course.code_format)"; if (!d.th) errs.th = "จำเป็น"; if (!/^\d+\s*\(\d+-\d+-\d+\)$/.test(d.cr || "")) errs.cr = "รูปแบบ 3 (2-2-5)"; if (!d.d) errs.d = "จำเป็น"; }
  else if (d.kind && !cen) errs.code = "ไม่ใช่รายวิชากลาง";
  if (d.en && /[฀-๿]/.test(d.en)) errs.en = "ชื่อภาษาอังกฤษต้องไม่มีอักษรไทย"; if (d.th && !/[฀-๿]/.test(d.th)) errs.th = "ต้องมีอักษรไทยอย่างน้อย 1 ตัว";
  if (D.life.centralRequests.some(x => x.code === d.code && x.status === "PENDING")) errs.code = "มีคำขอค้างของรายวิชานี้แล้ว";
  if (!formErrors(f, errs)) return;
  const before = base ? { th: base.th, en: base.en, cr: base.cr, d: (base.d || "").slice(0, 400) } : null;
  const after = Object.assign({}, before || {}, Object.fromEntries(["th", "en", "cr", "d"].filter(k => d[k]).map(k => [k, d[k]])));
  D.life.centralRequests.push({ id: Math.max(0, ...D.life.centralRequests.map(x => x.id)) + 1, code: d.code, central: d.central, kind: d.kind, before: d.kind === "OPEN" ? null : before, after, status: "PENDING", rejectReason: null, by: S.user, at: today(), decidedBy: null });
  notifyRole("CC", null, `คำขอ${CREQ_KIND[d.kind]} ${d.code} รออนุมัติ`, "central-requests"); audit("ยื่นคำขอรายวิชากลาง", d.code); persist(); closeModal(); toast("ยื่นคำขอแล้ว — รอผู้อนุมัติ"); go("central-requests");
});

/* ---------- S25 เชื่อมรหัสรายวิชากับระบบทะเบียน (B09) ---------- */
route("courselink", { perm: "course.view", title: "เชื่อมรหัสรายวิชากับทะเบียน", render() {
  const L = D.life.courseLinks; const cnt = k => L.filter(x => x.status === k).length;
  return pageHead("เชื่อมรหัสรายวิชากับระบบทะเบียน", { lead: "รายวิชาที่สร้างใน CMS ต้องผูกรหัสในระบบทะเบียนก่อนเปิดสอน — สถานะ 4 แบบตามแนวทาง CMS มอ.", actions: btn("โหลดข้อมูลทะเบียนใหม่", "link-reload", { perm: "course.link" }) }) +
    `<div class="grid g4"><div class="panel stat"><span class="label">จับคู่แล้ว</span><span class="value">${fmt(D.courses.length + cnt("MATCHED"))}</span><span class="sub">รายวิชาจากระบบทะเบียน ${fmt(D.courses.length)} ${srcPill(true)}</span></div>${["NO_ID", "NOT_FOUND", "DUPLICATE"].map(k => `<div class="panel stat"><span class="label">${LINK_STATUS[k][0]}</span><span class="value">${cnt(k)}</span></div>`).join("")}</div>` +
    panel("รายวิชาที่ต้องดำเนินการ", table([{ th: "รหัส CMS", html: x => `<span class="mono">${x.code}</span>` }, { th: "ชื่อวิชา", wrap: true, val: x => (IDX.course.get(x.code) || {}).th || "" }, { th: "รหัสทะเบียน", html: x => x.regId ? `<span class="mono">${x.regId}</span>` : "—" }, { th: "สถานะ", html: x => pillOf(LINK_STATUS, x.status) + (x.status === "DUPLICATE" ? `<br><span class="muted small">ผูกกับ ${L.filter(y => y.regId === x.regId && y.code !== x.code).map(y => y.code).join(", ")}</span>` : "") }, { th: "", html: x => btn("แก้รหัส", "link-edit", { sm: true, data: { code: x.code }, perm: "course.link" }) }], L.filter(x => x.status !== "MATCHED").concat(L.filter(x => x.status === "MATCHED")), { empty: "จับคู่ครบแล้ว" }), { flush: true }) +
    `<p class="muted small">รายวิชาใน CMS เป็นข้อมูลจำลองของร่างหลักสูตรวิทยาการข้อมูลเพื่อธุรกิจ · การตรวจเทียบกับรายการรหัสจริง ${fmt(D.courses.length)} รหัสจากระบบทะเบียน</p>`;
} });
function relink() { const L = D.life.courseLinks; L.forEach(x => { x.status = !x.regId ? "NO_ID" : !IDX.regCodes.has(x.regId) ? "NOT_FOUND" : L.some(y => y !== x && y.regId === x.regId) ? "DUPLICATE" : "MATCHED"; }); }
act("link-reload", () => { relink(); persist(); toast("ตรวจเทียบกับระบบทะเบียนแล้ว (จำลองการเรียก class_info)"); rerender(); });
act("link-edit", el => { const x = D.life.courseLinks.find(y => y.code === el.dataset.code); openModal(`ผูกรหัสทะเบียน ${x.code}`, `<form data-form="link-edit" data-code="${x.code}">${field("regId", "รหัสวิชาในระบบทะเบียน", { value: x.regId, required: true, placeholder: "8 หลัก" })}<div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`); });
form("link-edit", (d, f) => {
  if (!/^\d{8}$/.test(d.regId || "")) { formErrors(f, { regId: "รหัส 8 หลัก" }); return; }
  const x = D.life.courseLinks.find(y => y.code === f.dataset.code); x.regId = d.regId; relink();
  audit("ผูกรหัสรายวิชากับทะเบียน", `${x.code} → ${d.regId}`); persist(); closeModal(); toast(`สถานะ: ${LINK_STATUS[x.status][0]}`); rerender();
});

/* ---------- S21 ติดตามการจัดทำหลักสูตร (B17) ---------- */
route("progress", { perm: null, title: "ติดตามการจัดทำหลักสูตร", render() {
  if (!canAny("report.ops|report.exec")) return `<div class="note bad">${esc(denyMsg("report.ops"))}</div>`;
  const progs = D.programs.filter(inScope); const sel = S.ui.progSel || null;
  const inprog = progs.filter(p => ["DRAFT", "IN_REVIEW"].includes(latestVer(p).state)).map(p => ({ p, v: latestVer(p), cp: completeness(p) }));
  const current = progs.filter(p => p.life === "ACTIVE").map(p => ({ p, v: activeVer(p), cp: completeness(p, activeVer(p)) }));
  const stage = x => { const pf = profileOf(x.v); const c = openCaseOf(x.p); if (c && c.status === "IN_PROGRESS") return 3; if (x.cp.pct >= 1) return 2; if (!["VOC", "HVOC"].includes(x.p.level) && !(pf && pf.ploCert)) return 0; return 1; };
  const approvedYear = D.workflow.cases.filter(c => c.status === "APPROVED" && c.type !== "CLOSE" && inScope(IDX.prog.get(c.prog)));
  const stages = [["รอรับรอง PLO", inprog.filter(x => stage(x) === 0)], ["จัดเตรียมข้อมูล (< 100%)", inprog.filter(x => stage(x) === 1)], ["ครบ 100% รอส่ง", inprog.filter(x => stage(x) === 2)], ["ระหว่างอนุมัติ", inprog.filter(x => stage(x) === 3)]];
  const buckets = [["100%", x => x.cp.pct >= 1], ["80–99%", x => x.cp.pct >= .8 && x.cp.pct < 1], ["50–79%", x => x.cp.pct >= .5 && x.cp.pct < .8], ["< 50%", x => x.cp.pct < .5]];
  const lvls = [...new Set(current.map(x => x.p.level))];
  const bucketTable = (list, key) => `<div class="table-wrap"><table class="t"><thead><tr><th>ระดับ</th>${buckets.map(b => `<th class="num">${b[0]}</th>`).join("")}<th class="num">รวม</th></tr></thead><tbody>${lvls.map(l => { const rows = list.filter(x => x.p.level === l); if (!rows.length) return ""; return `<tr><td>${esc(levelAbbr(l))}</td>${buckets.map((b, i) => { const n = rows.filter(b[1]).length; return `<td class="num">${n ? `<a href="#" data-act="prog-sel" data-k="${key}|${l}|${i}">${n}</a>` : "0"}</td>`; }).join("")}<td class="num">${rows.length}</td></tr>`; }).join("")}</tbody></table></div>`;
  const missBy = D.life.sections.map(s => ({ s, n: inprog.filter(x => x.cp.sections.find(y => y.code === s.code).state !== "done").length }));
  const durs = approvalDurations(D.workflow.cases.filter(c => c.type !== "CLOSE" && inScope(IDX.prog.get(c.prog))));
  const order = ["SUBMIT", "FACULTY_BOARD", "CURRICULUM_SCREENING", "GRADUATE_SCHOOL", "ACADEMIC_SENATE", "UNIVERSITY_COUNCIL"]; durs.sort((a, b) => order.indexOf(a.from) - order.indexOf(b.from));
  const atBody = {}; D.workflow.cases.filter(c => c.status === "IN_PROGRESS" && inScope(IDX.prog.get(c.prog))).forEach(c => { const b = currentStep(c).body; atBody[b] = (atBody[b] || 0) + 1; });
  const stdFail = current.filter(x => !standardsCheck(x.p).ok).length; const atf = current.map(x => ({ p: x.p, ids: aboutToFail(x.p) })).filter(x => x.ids.length);
  const noFin = inprog.filter(x => !D.finance.scenarios[x.p.id]).length;
  const due = progs.filter(p => p.life === "ACTIVE" && reviewDue(p) && !openCaseOf(p)); const ready = progs.filter(p => p.life === "ADMISSION_SUSPENDED" && remainingTotal(p) === 0);
  const changes = D.workflow.cases.filter(c => inScope(IDX.prog.get(c.prog))).map(c => ({ date: c.status === "APPROVED" ? (c.steps[c.steps.length - 1].date || c.created) : c.created, type: c.type === "CLOSE" ? (D.life.closures.find(x => x.case === c.id) || {}).kind === "SUSPEND_ADMISSION" ? "งดรับ" : "ปิด" : CASE_TYPE[c.type], p: IDX.prog.get(c.prog), st: pillOf(CASE_STATUS, c.status), link: "case-" + c.id }))
    .concat(D.workflow.amendments.filter(a => inScope(IDX.prog.get(a.prog))).map(a => ({ date: a.date, type: "สมอ.08", p: IDX.prog.get(a.prog), st: pillOf(AMEND_STATUS, a.status), link: "amendments" })))
    .concat(D.life.closures.filter(x => !x.case && inScope(IDX.prog.get(x.prog))).map(x => ({ date: x.date, type: CLOSE_KIND[x.kind] === "งดรับนักศึกษา" ? "งดรับ" : "ปิด", p: IDX.prog.get(x.prog), st: pill("อนุมัติ", "good"), link: "closures" })))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const cntType = t => changes.filter(x => x.type === t).length;
  let selList = "";
  if (sel) { const [key, l, i] = sel.split("|"); const src = key === "cur" ? current : inprog; const list = src.filter(x => x.p.level === l && buckets[Number(i)][1](x));
    selList = panel(`รายการ: ${key === "cur" ? "ฉบับปัจจุบัน" : "ฉบับระหว่างจัดทำ"} ระดับ ${levelAbbr(l)} ช่วง ${buckets[Number(i)][0]} (${list.length})`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.p.id}-complete">${esc(progTitle(x.p, true))}</a>` }, { th: "ความครบถ้วน", html: x => compPill(x.cp) }, { th: "ขาด", wrap: true, val: x => x.cp.missing.map(m => m.code).join(", ") || "—" }], list), { flush: true, actions: btn("ปิด", "prog-sel", { sm: true, data: { k: "" } }) }); }
  return pageHead("ติดตามการจัดทำหลักสูตร", { lead: `ภาพรวม ${progs.length} หลักสูตรในขอบเขต · ความครบถ้วนนับตามรายการตรวจบังคับ (D11) · ข้อมูลสถานะ/วันที่เป็นข้อมูลจำลอง`, actions: btn("รายงานความครบถ้วน", "open-doc", { data: { code: "RPT-PROGRESS" }, perm: "report.ops" }) }) +
    `<h2 class="sec">1. การจัดทำ</h2><div class="grid g4">${stages.map(([t, l], i) => `<div class="panel stat"><span class="label">${i + 1}. ${t}</span><span class="value">${l.length}</span><span class="sub">${l.slice(0, 3).map(x => esc(progTitle(x.p, true))).join(", ")}${l.length > 3 ? " …" : ""}</span></div>`).join("")}</div>
    <p class="muted small">อนุมัติแล้ว (มติสภามหาวิทยาลัย) ${approvedYear.length} เรื่อง · ฉบับระหว่างจัดทำ ${inprog.length} ฉบับ</p>
    <div class="grid g2">${panel("ความครบถ้วน: ฉบับระหว่างจัดทำ", bucketTable(inprog, "inp"), { flush: true })}${panel("ยังขาดข้อมูลหมวดใด (ฉบับระหว่างจัดทำ)", barChart(missBy.map(x => ({ label: x.s.th.replace(/^หมวด \d /, ""), v: x.n, tip: `${x.s.th}: ขาด ${x.n} ฉบับ` })), { aria: "จำนวนฉบับที่ยังขาดข้อมูลรายหมวด", padL: 170 }))}</div>
    ${panel("ความครบถ้วน: ฉบับปัจจุบันที่ย้ายจากระบบเดิม (งานค้างการย้ายข้อมูล)", bucketTable(current, "cur") + `<div class="body muted small">ฉบับที่อนุมัติก่อนมี CMS ไม่มีข้อมูล PLO โครงสร้าง ข้อมูลเชิงนโยบาย — เติมเมื่อทำฉบับปรับปรุงหรือตามแผนย้ายข้อมูล (05) ${gapPill("G18")}</div>`, { flush: true })}
    ${selList}
    <h2 class="sec">2. การอนุมัติ</h2><div class="grid g2">${panel("เรื่องที่อยู่แต่ละขั้น", `<ul class="list">${order.slice(1).map(b => `<li><span class="grow">${esc(BODY_TH(b))}</span><b>${atBody[b] || 0}</b></li>`).join("")}</ul>`, { flush: true })}
      ${panel("จำนวนวันระหว่างขั้น (เฉลี่ย · ต่ำสุด–สูงสุด)", table([{ th: "จาก → ถึง", val: x => `${BODY_SHORT[x.from]} → ${BODY_SHORT[x.to]}` }, { th: "เรื่อง", num: true, val: x => x.n }, { th: "เฉลี่ย (วัน)", num: true, val: x => fmt(x.avg, 1) }, { th: "ต่ำสุด–สูงสุด", num: true, html: x => `${x.min < 0 ? pill(String(x.min), "bad") : x.min}–${x.max}` }], durs), { flush: true })}</div>
    ${panel("เส้นเวลารายเรื่อง", table([{ th: "เรื่อง", wrap: true, html: c => `<a href="#case-${c.id}">${esc(progTitle(IDX.prog.get(c.prog), true))}</a><br><span class="muted small">${CASE_TYPE[c.type]}</span>` }, { th: "ขั้นตอน", wrap: true, html: c => { let prev = c.created; return `<span class="tl">${pill("ยื่น " + thDate(c.created), "neutral")}${c.steps.map(s => { if (s.status !== "DONE") return pill(BODY_SHORT[s.body], s.status === "CURRENT" ? "info" : "neutral"); const dd = daysBetween(prev, s.date); prev = s.date; return `${pill(`${BODY_SHORT[s.body]} ${thDate(s.date)}`, "good")}<span class="dd ${dd < 0 ? "neg" : ""}">+${dd} วัน</span>`.replace("+-", "−"); }).join(" › ")}</span>`; } }],
      D.workflow.cases.filter(c => c.type !== "CLOSE" && inScope(IDX.prog.get(c.prog))).sort((a, b) => b.created.localeCompare(a.created)), { maxH: 420 }), { flush: true })}
    <h2 class="sec">3. ความพร้อม</h2><div class="grid g4">
      <a class="panel stat" href="#dashboard"><span class="label">ฉบับปัจจุบัน อาจารย์ไม่ผ่านเกณฑ์</span><span class="value">${stdFail}</span></a>
      <div class="panel stat"><span class="label">อาจารย์ใกล้ไม่ผ่านปีหน้า</span><span class="value">${atf.reduce((a, x) => a + x.ids.length, 0)}</span><span class="sub">${atf.length} หลักสูตร · ผลงานจะหลุดกรอบ 5 ปี</span></div>
      <a class="panel stat" href="#central-requests"><span class="label">คำขอรายวิชากลางรออนุมัติ</span><span class="value">${D.life.centralRequests.filter(x => x.status === "PENDING").length}</span></a>
      <a class="panel stat" href="#courselink"><span class="label">รายวิชายังไม่จับคู่ทะเบียน</span><span class="value">${D.life.courseLinks.filter(x => x.status !== "MATCHED").length}</span><span class="sub">ฉบับระหว่างจัดทำไม่มีจุดคุ้มทุน ${noFin}</span></a></div>
    ${atf.length ? panel("อาจารย์ผู้รับผิดชอบที่ใกล้ไม่ผ่านเกณฑ์ในปีหน้า", table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.p.id}-staff">${esc(progTitle(x.p, true))}</a>` }, { th: "อาจารย์", wrap: true, html: x => x.ids.map(id => `<a href="#" data-act="staff-open" data-id="${id}">${esc(staffName(id))}</a>`).join(", ") }, { th: "คณะ", val: x => IDX.fac.get(x.p.fac).name }], atf, { maxH: 300 }), { flush: true }) : ""}
    <h2 class="sec">4. การเปลี่ยนแปลง</h2><div class="grid g4">${[["หลักสูตรใหม่", "หลักสูตรใหม่"], ["ปรับปรุง", "หลักสูตรปรับปรุง"], ["สมอ.08", "สมอ.08"], ["งดรับ/ปิด", null]].map(([t, k]) => `<div class="panel stat"><span class="label">${t}</span><span class="value">${k ? cntType(k) : cntType("งดรับ") + cntType("ปิด")}</span></div>`).join("")}</div>
    <div class="grid g2">${panel(`ครบรอบปรับปรุงภายใน 1 ปีที่ยังไม่เริ่ม (${due.length})`, table([{ th: "หลักสูตร", wrap: true, html: p => `<a href="#program-${p.id}">${esc(progTitle(p, true))}</a>` }, { th: "ฉบับ", val: p => p.latestYear }, { th: "ครบรอบ", val: p => p.nextReview }], due, { maxH: 320 }), { flush: true })}
      ${panel(`งดรับและไม่มีนักศึกษาคงค้าง (${ready.length})`, table([{ th: "หลักสูตร", wrap: true, html: p => `<a href="#closures-new-${p.id}">${esc(progTitle(p, true))}</a>` }, { th: "", html: p => openCaseOf(p) ? pill("มีเรื่องเปิดอยู่", "info") : pill("ยื่นปิดได้", "good") }], ready, { empty: "ไม่มี" }), { flush: true })}</div>
    ${panel("บันทึกการเปลี่ยนแปลงหลักสูตร (ล่าสุดก่อน)", table([{ th: "วันที่", val: x => thDate(x.date) }, { th: "ประเภท", val: x => x.type }, { th: "หลักสูตร", wrap: true, html: x => `<a href="#${x.link}">${esc(progTitle(x.p, true))}</a>` }, { th: "สถานะ", html: x => x.st }], changes, { maxH: 380 }), { flush: true })}`;
} });
act("prog-sel", el => { S.ui.progSel = el.dataset.k || null; rerender(); });

/* ---------- ปรับปรุงแบบแยก/รวม (B03) ---------- */
const _newprogRender = ROUTES.newprog.render;
ROUTES.newprog.render = function (args) {
  const mine = D.programs.filter(p => canEditProg(p) && p.life === "ACTIVE" && latestVer(p).state === "APPROVED");
  return _newprogRender(args) + `<form class="panel" data-form="new-lineage"><header><h2>แยกหรือรวมหลักสูตร (UC32)</h2><span class="muted small">แนวทาง CMS มอ.: 1:1 · แยก 1:N · รวม N:1 — หลักสูตรแม่เปลี่ยนเป็นฉบับเดิม/งดรับเมื่อสภามหาวิทยาลัยอนุมัติ</span></header><div class="body">${mine.length ? `<div class="form-grid">
    ${field("mode", "รูปแบบ", { type: "select", options: [["SPLIT", "แยกหลักสูตร (1 → หลายหลักสูตร)"], ["MERGE", "รวมหลักสูตร (หลายหลักสูตร → 1)"]], required: true, full: true })}
    <fieldset class="field full"><legend>หลักสูตรแม่ (แยก: เลือก 1 · รวม: เลือก ≥ 2 ตัวแรกเป็นตัวหลัก)</legend><div class="checks" style="max-height:220px;overflow:auto">${mine.map(p => `<label><input type="checkbox" name="parents" value="${p.id}"> ${esc(progTitle(p, true))} (พ.ศ. ${p.latestYear})</label>`).join("")}</div><span class="err" data-err="parents"></span></fieldset>
    ${field("names", "ชื่อสาขาวิชาของหลักสูตรใหม่ (บรรทัดละ 1 — แยกต้อง ≥ 2, รวมใส่ 1)", { type: "textarea", required: true, full: true, rows: 3 })}
    ${field("year", "ปีหลักสูตร (พ.ศ.)", { type: "number", value: 2571, min: 2570, max: 2580, required: true })}${field("reason", "เหตุผล", { type: "textarea", required: true, full: true, rows: 2 })}</div>
    <div class="form-foot"><button class="btn primary" type="submit">สร้างร่างหลักสูตร</button></div>` : `<div class="empty">ไม่มีหลักสูตรที่คุณแก้ไขได้และอนุมัติแล้ว</div>`}</div></form>`;
};
form("new-lineage", (d, f) => {
  const parents = $$('input[name="parents"]:checked', f).map(i => Number(i.value)); const names = (d.names || "").split("\n").map(x => x.trim()).filter(Boolean); const errs = {};
  if (d.mode === "SPLIT" && parents.length !== 1) errs.parents = "แยกหลักสูตร: เลือกหลักสูตรแม่ 1 หลักสูตร"; if (d.mode === "MERGE" && parents.length < 2) errs.parents = "รวมหลักสูตร: เลือกอย่างน้อย 2 หลักสูตร";
  if (d.mode === "SPLIT" && names.length < 2) errs.names = "ระบุชื่อหลักสูตรใหม่อย่างน้อย 2 ชื่อ"; if (d.mode === "MERGE" && names.length !== 1) errs.names = "รวมหลักสูตร: ระบุชื่อ 1 ชื่อ";
  if (parents.some(id => openCaseOf(IDX.prog.get(id)))) errs.parents = "มีหลักสูตรแม่ที่มีเรื่องเปิดอยู่แล้ว"; if (!d.reason) errs.reason = "ระบุเหตุผล";
  if (parents.length > 1 && new Set(parents.map(id => IDX.prog.get(id).level)).size > 1) errs.parents = "หลักสูตรแม่ต้องเป็นระดับเดียวกัน";
  if (!formErrors(f, errs)) return;
  const prim = IDX.prog.get(parents[0]); const created = [];
  names.forEach(name => {
    const id = Math.max(...D.programs.map(p => p.id)) + 1; const vid = id * 100 + 1; const base = JSON.parse(JSON.stringify(activeVer(prim)));
    Object.assign(base, { id: vid, year: Number(d.year), state: "DRAFT", kind: "REVISION", senate: null, ack: null, source: "SIM", basedOn: activeVer(prim).id, form: Object.assign({}, base.form || {}, { rationale: d.reason }) }); base.plans.forEach(x => { x.regId = null; });
    const p = { id, code: `NPU-${prim.fac.padStart(2, "0")}-${id}`, fac: prim.fac, level: prim.level, name, degree: prim.degree, life: "DRAFT", latestYear: Number(d.year), nextReview: Number(d.year) + 5, accredExpiry: Number(d.year) + 5, checoCode: null, simulated: true, versions: [base] };
    D.programs.push(p); D.stats[id] = { plan: (stat(prim) || { plan: 30 }).plan, intake: [0, 0, 0], years: [2567, 2568, 2569], total: 0, grad: 0, retention: 0, tqf3: 0, tqf5: 0, tqf7: false };
    ["structures", "studyPlans", "obe"].forEach(k => { if (D.design[k][prim.id]) D.design[k][id] = JSON.parse(JSON.stringify(D.design[k][prim.id])); });
    if (D.life.profiles[activeVer(prim).id]) D.life.profiles[vid] = Object.assign(JSON.parse(JSON.stringify(D.life.profiles[activeVer(prim).id])), { ploCert: null, signed: {} });
    D.life.lineage[vid] = { mode: d.mode, parents: parents.map((pid, i) => ({ prog: pid, ver: activeVer(IDX.prog.get(pid)).id, primary: i === 0 })) };
    const rk = ["MASTER", "DOCTOR", "GRAD_DIP"].includes(prim.level) ? "NEW_GRAD" : "REVISION"; const cid = Math.max(...D.workflow.cases.map(c => c.id)) + 1;
    D.workflow.cases.push({ id: cid, no: `CMS-2569-${String(cid).padStart(4, "0")}`, prog: id, ver: vid, type: "REVISION", route: rk, title: `ขอความเห็นชอบหลักสูตร${prim.degree} สาขาวิชา${name} (${d.mode === "SPLIT" ? "แยกจาก" : "รวมจาก"}${parents.map(x => IDX.prog.get(x).name).join(", ")} พ.ศ. ${d.year})`, status: "DRAFT", created: today(), by: S.user,
      steps: D.meta.routes[rk].map((b, i) => ({ body: b, status: i === 0 ? "CURRENT" : "PENDING", meeting: null, date: null, result: null, note: "" })) });
    const u = me(); if (u.scope.type === "PROGRAM") u.scope.progs.push(id); created.push(id);
  });
  buildIndex(); audit(d.mode === "SPLIT" ? "แยกหลักสูตร" : "รวมหลักสูตร", parents.join(",")); persist(); toast(`สร้างร่าง ${created.length} หลักสูตรแล้ว (คัดลอกโครงสร้าง OBE ข้อมูลเชิงนโยบายจากหลักสูตรแม่ตัวหลัก)`); go(`program-${created[0]}-complete`);
});

/* ---------- สมอ.08: หลายเรื่อง ภาค/ปี/รุ่นที่บังคับใช้ ย้อนหลังเล่มต้นฉบับ (B04) ---------- */
const AMEND_TOPIC = [["COURSE", "รายวิชาในหลักสูตร", "CHANGE_COURSE"], ["PLAN", "แผนและโครงสร้างหลักสูตร (ไม่เปลี่ยนหน่วยกิตรวม)", "CHANGE_PLAN"], ["STAFF", "อาจารย์ในหลักสูตร", "CHANGE_STAFF"], ["INTAKE", "แผนรับนักศึกษา", "CHANGE_INTAKE"]];
act("amend-new", () => {
  const progs = D.programs.filter(p => inScope(p) && (canEditProg(p) || can("amend.submit")) && latestVer(p).state === "APPROVED");
  openModal("ยื่น สมอ.08 ปรับปรุงหลักสูตรเล็กน้อย", `<form data-form="amend-new"><div class="form-grid">${field("prog", "หลักสูตร (ฉบับที่อนุมัติแล้ว)", { type: "select", options: progs.map(p => [p.id, `${progTitle(p, true)} (${p.latestYear})`]), required: true, full: true })}
    <fieldset class="field full"><legend>เรื่องที่ปรับปรุง (เลือกได้มากกว่า 1)</legend><div class="checks">${AMEND_TOPIC.map(([k, t]) => `<label><input type="checkbox" name="topics" value="${k}"> ${t}</label>`).join("")}</div><span class="err" data-err="topics"></span></fieldset>
    ${field("reason", "เหตุผลและรายละเอียด", { type: "textarea", required: true, full: true })}
    ${field("term", "ภาคการศึกษาที่บังคับใช้", { type: "select", options: ["1", "2", "3"], value: "1", blank: false })}${field("year", "ปีการศึกษาที่บังคับใช้ (พ.ศ.)", { type: "number", value: 2570, min: 2569, max: 2580, required: true })}
    ${field("cohort", "บังคับใช้กับนักศึกษาที่เข้าปี (พ.ศ.)", { type: "number", value: 2570, min: 2560, max: 2580, required: true })}${field("retro", "ปรับย้อนหลังเล่มต้นฉบับด้วย", { type: "select", options: [["0", "ไม่"], ["1", "ใช่ — ฉบับก่อนหน้าได้รับการปรับเดียวกัน"]], blank: false })}
    <div class="field full"><label for="f-out">กรณีเปลี่ยนอาจารย์: ออก / เข้า (รหัสบุคลากร)</label><div class="form-grid"><input id="f-out" name="out" type="text" placeholder="รหัสอาจารย์ที่ออก"><input id="f-in" name="in" type="text" placeholder="รหัสอาจารย์ที่เข้า"></div><span class="err" data-err="out"></span></div></div>
    <div class="note">ห้ามใช้ สมอ.08 กับการเปลี่ยนหน่วยกิตรวมหรือ PLO — ใช้ฉบับปรับปรุง · เปิดค้างได้ทีละเรื่องต่อหลักสูตร</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">ยื่น สมอ.08</button></div></form>`, { wide: true });
});
form("amend-new", (d, f) => {
  const topics = $$('input[name="topics"]:checked', f).map(i => i.value); const errs = {}; const p = IDX.prog.get(Number(d.prog));
  if (!d.prog) errs.prog = "เลือกหลักสูตร"; if (!topics.length) errs.topics = "เลือกอย่างน้อย 1 เรื่อง"; if (!d.reason || d.reason.length < 10) errs.reason = "อธิบายอย่างน้อย 10 ตัวอักษร";
  if (p && D.workflow.amendments.some(a => a.prog === p.id && ["DRAFT", "FACULTY_APPROVED"].includes(a.status))) errs.prog = "หลักสูตรนี้มี สมอ.08 ที่ยังไม่เสร็จ — เปิดค้างได้ทีละเรื่อง";
  if (Number(d.cohort) > Number(d.year)) errs.cohort = "ต้องไม่หลังปีที่บังคับใช้";
  if (/หน่วยกิตรวม|PLO/.test(d.reason || "")) errs.reason = "การเปลี่ยนหน่วยกิตรวมหรือ PLO ต้องทำเป็นฉบับปรับปรุง";
  if (topics.includes("STAFF") && p) { if (!progResponsible(p).some(r => r.staff === d.out)) errs.out = "รหัสอาจารย์ที่ออกไม่อยู่ในหลักสูตรนี้"; else if (!IDX.staff.has(d.in)) errs.out = "ไม่พบรหัสอาจารย์ที่เข้าใน ERP-HR"; }
  if (!formErrors(f, errs)) return;
  const id = Math.max(0, ...D.workflow.amendments.map(a => a.id)) + 1; const seq = D.workflow.amendments.filter(a => a.prog === p.id).length + 1;
  D.workflow.amendments.unshift({ id, no: `สมอ.08-2569-${String(id).padStart(3, "0")}`, prog: p.id, kind: (AMEND_TOPIC.find(t => t[0] === (topics.includes("STAFF") ? "STAFF" : topics[0])) || [])[2], topics, seq, term: Number(d.term), effYear: Number(d.year), cohort: Number(d.cohort), retro: d.retro === "1",
    reason: d.reason, out: d.out || null, in: d.in || null, status: "DRAFT", date: today() });
  audit("ยื่น สมอ.08", p.code); persist(); closeModal(); toast(`ยื่น สมอ.08 ครั้งที่ ${seq} แล้ว — รอคณะเห็นชอบ`); rerender();
});
const _amendRender = ROUTES.amendments.render;
ROUTES.amendments.render = function (args) {
  const html = _amendRender(args); const rows = D.workflow.amendments.filter(a => inScope(IDX.prog.get(a.prog)));
  return html + panel("การบังคับใช้ (ฟิลด์ตามแนวทาง CMS มอ.)", table([{ th: "เลขที่", html: a => `<span class="mono">${a.no}</span>` }, { th: "ครั้งที่", num: true, val: a => a.seq || 1 }, { th: "เรื่อง", wrap: true, val: a => (a.topics || [Object.keys(AMEND_KIND).find(k => k === a.kind)]).map(t => (AMEND_TOPIC.find(x => x[0] === t || x[2] === t) || [, AMEND_KIND[t] || t])[1]).join(", ") }, { th: "บังคับใช้", val: a => a.effYear ? `ภาค ${a.term}/${a.effYear}` : "—" }, { th: "รุ่นนักศึกษา", val: a => a.cohort ? `เข้าปี ${a.cohort} เป็นต้นไป` : "—" }, { th: "ย้อนหลังเล่มต้นฉบับ", val: a => a.retro ? "ใช่" : "ไม่" }], rows), { flush: true });
};

/* ---------- นำอาจารย์ออก: ยืนยันด้วยการพิมพ์รหัส (B18) ---------- */
const _unassign = ACTIONS["staff-unassign"];
ACTIONS["staff-unassign"] = el => { const p = IDX.prog.get(Number(el.dataset.prog)); confirmTyped("นำอาจารย์ออกจากหลักสูตร", `นำ <b>${esc(staffName(el.dataset.staff))}</b> ออกจาก ${esc(progTitle(p, true))} — ระบบจะตรวจเกณฑ์ 2565 ใหม่ทันที`, p.code, () => _unassign(el)); };

/* ---------- เอกสารเพิ่ม (B16) ---------- */
function docProgHead(code, title, p, v) { return `${docHead(code)}<h1>${esc(title)}</h1><p class="center">หลักสูตร${esc(p.degree)} สาขาวิชา${esc(p.name)} (ฉบับ พ.ศ. ${v.year})<br>${esc(IDX.fac.get(p.fac).name)} มหาวิทยาลัยนครพนม</p>`; }
DOCS["DOC-PLO"] = p => {
  const v = latestVer(p); const o = obeOf(p); const pf = profileOf(v) || {}; const c = pf.ploCert;
  const rows = o ? o.plos.map(x => `<tr><td>${x.code}</td><td>${esc(x.text)}${(x.subs || []).map(s => `<br>&nbsp;&nbsp;${s.code} ${esc(s.text)}`).join("")}</td><td class="center">${x.domain}</td><td>${x.type}</td><td>${x.level}</td><td>${esc(x.criteria)}<br><i>${esc(x.tool)}</i></td></tr>`).join("") : `<tr><td colspan="6">ยังไม่มี PLO [รอข้อมูล G18]</td></tr>`;
  const h = `<div class="a4 land">${docProgHead("DOC-PLO", "ผลลัพธ์การเรียนรู้ที่คาดหวังของหลักสูตร (PLOs)", p, v)}<table><thead><tr><th>PLO</th><th>ข้อความ / Sub-PLO</th><th>KSEC</th><th>ประเภท</th><th>ระดับ taxonomy</th><th>เกณฑ์วัด / เครื่องมือ</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>การรับรอง</h2><p>${c ? `คณะกรรมการกลั่นกรองหลักสูตร ${esc(c.meeting)} เมื่อวันที่ ${thDate(c.date, true)} มีมติรับรองผลลัพธ์การเรียนรู้ข้างต้น` : "ยังไม่ผ่านการรับรอง — เอกสารนี้เป็นร่างสำหรับเสนอคณะกรรมการกลั่นกรองหลักสูตร"}</p>${sigBlock([c ? c.chair : "ประธานคณะกรรมการกลั่นกรองหลักสูตร", "ประธานที่ประชุม"], ["", "เลขานุการคณะกรรมการ"])}</div>`;
  return { title: `PLO ${progTitle(p, true)}`, html: h, file: `PLO-${p.code}-${v.year}` };
};
DOCS["DOC-PUBLIC"] = p => {
  const v = activeVer(p); const pf = profileOf(latestVer(p)) || profileOf(v) || { pr: {}, committee: [] }; const r = pf.pr || {}; const s = structureOf(p); const sc = D.finance.scenarios[p.id];
  const co = (pf.committee || []).find(x => x.pos === "COORDINATOR");
  const h = `<div class="a4">${docHead("DOC-PUBLIC")}<h1>หลักสูตร${esc(p.degree)} สาขาวิชา${esc(p.name)}</h1><p class="center">${esc((v.form || {}).nameEn || "[รอข้อมูล G20]")}<br>${esc(IDX.fac.get(p.fac).name)} มหาวิทยาลัยนครพนม</p>
    <h2>จุดเด่นของหลักสูตร</h2><p class="ind">${esc(r.highlightTh || "[ยังไม่กรอกข้อมูลประชาสัมพันธ์]")}</p>${r.highlightEn ? `<p class="ind"><i>${esc(r.highlightEn)}</i></p>` : ""}
    <h2>อาชีพหลังสำเร็จการศึกษา</h2><p class="ind">${esc(r.careerTh || (v.form || {}).careers || "—")}</p>
    <h2>คุณลักษณะบัณฑิต</h2><ul>${(r.attributes || []).map(a => `<li>${esc(a.text)}</li>`).join("") || "<li>—</li>"}</ul>
    <h2>ข้อมูลการศึกษา</h2><table><tbody><tr><th>ระดับ</th><td>${esc(IDX.level.get(p.level).th)}</td></tr><tr><th>หน่วยกิตรวม</th><td>${v.credits} หน่วยกิต · ${v.years} ปี</td></tr><tr><th>ค่าธรรมเนียมการศึกษา</th><td>${sc ? `${baht(sc.feePerTerm)} บาท/ภาคการศึกษา (${esc(sc.feeSource)})` : "ตามประกาศมหาวิทยาลัย"}</td></tr><tr><th>แผนรับ</th><td>${(stat(p) || {}).plan || "—"} คน/ปี</td></tr></tbody></table>
    ${s ? `<h2>โครงสร้างหลักสูตร</h2><table><tbody>${treeRows(s)}</tbody></table>` : ""}
    <h2>ติดต่อ</h2><p>${co && co.staff ? `${esc(staffName(co.staff))} ผู้ประสานงานหลักสูตร โทร ${esc(co.phone || "—")}` : "งานวิชาการคณะ"}</p><p class="small">คำสำคัญ: ${(r.kwTh || []).map(esc).join(", ")} ${(r.kwEn || []).length ? "· " + r.kwEn.map(esc).join(", ") : ""}</p></div>`;
  return { title: `ข้อมูลหลักสูตรฉบับเผยแพร่ ${progTitle(p, true)}`, html: h, file: `เผยแพร่-${p.code}` };
};
DOCS["DOC-HANDBOOK"] = p => {
  const v = activeVer(p); const o = obeOf(p); const s = structureOf(p); const pl = D.design.studyPlans[p.id] || [];
  const codes = s ? [...new Set(treeCourses(s))] : [...new Set(pl.flatMap(t => t.courses))];
  const h = `<div class="a4">${docProgHead("DOC-HANDBOOK", "คู่มือนักศึกษา", p, v)}<h2>1. ผลลัพธ์การเรียนรู้ของหลักสูตร</h2>${o ? `<table><thead><tr><th>PLO</th><th>ข้อความ</th></tr></thead><tbody>${o.plos.map(x => `<tr><td>${x.code}</td><td>${esc(x.text)}</td></tr>`).join("")}</tbody></table>
    <h3>ผลลัพธ์รายชั้นปี (YLO)</h3><table><tbody>${o.ylo.map(y => `<tr><td>ปีที่ ${y.year}</td><td>${esc(y.text)}</td></tr>`).join("")}</tbody></table>` : "<p>[รอข้อมูล G18]</p>"}
    <h2>2. โครงสร้างหลักสูตร</h2>${s ? `<table><tbody>${treeRows(s)}</tbody></table>` : `<p>หน่วยกิตรวมไม่น้อยกว่า ${v.credits} หน่วยกิต [รอข้อมูล G05]</p>`}
    <h2>3. แผนการศึกษา</h2>${pl.length ? pl.map(t => `<h3>ปีที่ ${t.year} ภาคการศึกษาที่ ${t.term}</h3><table><tbody>${t.courses.map(c => `<tr><td style="width:90px">${c}</td><td>${esc((IDX.course.get(c) || {}).th || "")}</td><td style="width:90px">${esc((IDX.course.get(c) || {}).cr || "")}</td></tr>`).join("")}</tbody></table>`).join("") : "<p>[รอข้อมูล G05]</p>"}
    <h2>4. คำอธิบายรายวิชา</h2>${codes.map(c => { const x = IDX.course.get(c) || {}; return `<p><b>${c} ${esc(x.th || "")}</b> ${esc(x.cr || "")}<br><i>${esc(x.en || "")}</i><br>${esc(x.d || "—")}</p>`; }).join("")}</div>`;
  return { title: `คู่มือนักศึกษา ${progTitle(p, true)}`, html: h, file: `คู่มือนักศึกษา-${p.code}` };
};
DOCS["DOC-CLOSE"] = p => {
  const v = activeVer(p); const cl = [...D.life.closures].reverse().find(x => x.prog === p.id); const rem = cl ? cl.remaining : remainingOf(p); const tot = rem.reduce((a, r) => a + r.n, 0);
  const O = D.life.options.CLOSE_REASON;
  const h = `<div class="a4">${docProgHead("DOC-CLOSE", `แบบเสนอขอ${cl ? CLOSE_KIND[cl.kind] : "งดรับนักศึกษา/ปิด"}หลักสูตร`, p, v)}
    <h2>1. ข้อมูลหลักสูตร</h2><table><tbody><tr><th>ฉบับปัจจุบัน</th><td>พ.ศ. ${v.year} · ${v.credits} หน่วยกิต</td></tr><tr><th>สภามหาวิทยาลัยอนุมัติ</th><td>${v.senate ? thDate(v.senate, true) : "—"}</td></tr><tr><th>สถานะ</th><td>${esc(lifeStatus(p)[0])}</td></tr></tbody></table>
    <h2>2. เหตุผล</h2><p>${cl ? `<b>${esc((O.find(x => x.code === cl.reasonCode) || {}).th || "")}</b> — ${esc(cl.reason)}` : "........................................................................"}</p>
    <h2>3. ภาค/ปีการศึกษาที่มีผล</h2><p>${cl ? `ภาคการศึกษาที่ ${cl.term} ปีการศึกษา ${cl.year}` : "ภาคการศึกษาที่ ...... ปีการศึกษา ........"}</p>
    <h2>4. นักศึกษาคงค้าง ณ วันที่ยื่น</h2><table><thead><tr><th>ปีที่เข้าศึกษา</th><th>จำนวน (คน)</th></tr></thead><tbody>${rem.map(r => `<tr><td>${r.entry}</td><td class="n">${r.n}</td></tr>`).join("")}<tr><th>รวม</th><th class="n">${tot}</th></tr></tbody></table>
    <h2>5. แผนดูแลนักศึกษาคงค้าง</h2><p class="ind">${esc(cl && cl.carePlan || (tot ? "........................................................................" : "ไม่มีนักศึกษาคงค้าง"))}</p>
    ${cl && cl.transfer ? `<p>หลักสูตรรองรับการย้ายสาขา: ${esc(progTitle(IDX.prog.get(cl.transfer), true))}</p>` : ""}${sigBlock(["ประธานหลักสูตร", "ผู้เสนอ"], ["คณบดี", "ผู้รับรอง"])}</div>`;
  return { title: `แบบเสนองดรับ/ปิด ${progTitle(p, true)}`, html: h, file: `ปิดหลักสูตร-${p.code}` };
};
DOCS["DOC-REVIEW"] = p => {
  const v = latestVer(p); const rs = D.life.reviews.filter(r => r.prog === p.id).sort((a, b) => a.phase - b.phase || a.round - b.round); const secTh = c => (D.life.sections.find(s => s.code === c) || { th: c }).th;
  const h = `<div class="a4">${docProgHead("DOC-REVIEW", "ผลการตรวจสอบข้อมูลหลักสูตร", p, v)}${rs.length ? rs.map(r => `<h2>ระยะ ${r.phase} ${r.phase === 1 ? "(ก่อนเสนอสภาวิชาการ)" : "(เทียบระบบทะเบียน หลังสภามหาวิทยาลัยอนุมัติ)"} รอบที่ ${r.round}</h2><p>สถานะ: <b>${REVIEW_STATUS[r.status][0]}</b> · ส่งตรวจ ${thDate(r.submitted, true)}${r.reviewed ? ` · ตรวจเสร็จ ${thDate(r.reviewed, true)}` : ""} · ผู้ตรวจ ${esc(userName(r.reviewer))}</p>
    <table><thead><tr><th>หมวด</th><th>ผล</th><th>หมายเหตุ</th></tr></thead><tbody>${Object.entries(r.items).map(([k, x]) => `<tr><td>${esc(secTh(k))}</td><td>${x.result === "PASS" ? "ผ่าน" : "ไม่ผ่าน"}</td><td>${esc(x.note || "")}</td></tr>`).join("") || `<tr><td colspan="3">ยังไม่ตรวจ</td></tr>`}</tbody></table>`).join("") : "<p>ยังไม่เข้าสู่การตรวจสอบข้อมูล</p>"}
    <h2>ความครบถ้วน ณ วันที่พิมพ์</h2><table><thead><tr><th>รายการ</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>${completeness(p, v).sections.flatMap(s => s.items).map(i => `<tr><td>${i.code} ${esc(i.th)}</td><td>${DOT[i.state][0]}</td><td>${esc(i.msg)}</td></tr>`).join("")}</tbody></table>${sigBlock(["ผู้ตรวจสอบข้อมูล", "กองบริการการศึกษา"], ["นายทะเบียนหลักสูตร", ""])}</div>`;
  return { title: `ผลตรวจสอบข้อมูล ${progTitle(p, true)}`, html: h, file: `ผลตรวจสอบ-${p.code}` };
};
DOCS["RPT-PROGRESS"] = () => {
  const list = D.programs.filter(inScope).map(p => ({ p, v: latestVer(p), cp: completeness(p) })).sort((a, b) => a.cp.pct - b.cp.pct);
  const secs = D.life.sections;
  const cols = [{ th: "รหัส", val: x => x.p.code }, { th: "หลักสูตร", val: x => progTitle(x.p, true) }, { th: "คณะ", val: x => IDX.fac.get(x.p.fac).name }, { th: "ฉบับ", val: x => `${x.v.year} ${VSTATE[x.v.state][0]}` }, { th: "ครบถ้วน %", val: x => Math.round(x.cp.pct * 100) }]
    .concat(secs.map(s => ({ th: s.code, val: x => DOT[x.cp.sections.find(y => y.code === s.code).state][0] })));
  const top = list.filter(x => ["DRAFT", "IN_REVIEW"].includes(x.v.state));
  const h = `<div class="a4 land">${docHead("RPT-PROGRESS")}<h1>รายงานความครบถ้วนการจัดทำหลักสูตร</h1><p class="center">ฉบับระหว่างจัดทำ ${top.length} ฉบับ · ทั้งหมด ${list.length} หลักสูตร</p><table><thead><tr>${cols.map(c => `<th>${c.th}</th>`).join("")}</tr></thead><tbody>${top.concat(list.filter(x => !top.includes(x)).slice(0, 40)).map(x => `<tr>${cols.map(c => `<td>${esc(c.val(x))}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="small">${secs.map(s => `${s.code} = ${s.th}`).join(" · ")} · ไฟล์ CSV มีครบทุกหลักสูตร</p></div>`;
  return { title: "รายงานความครบถ้วนการจัดทำหลักสูตร", html: h, file: "ความครบถ้วนหลักสูตร", csv: csv(list, cols) };
};
