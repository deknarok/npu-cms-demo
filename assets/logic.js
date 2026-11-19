/* logic.js — กฎทางธุรกิจ: เกณฑ์ 2565, จุดคุ้มทุน, pre-flight CISA, DS2004, งานค้าง, เส้นทางอนุมัติ */
"use strict";

const BODY_TH = code => (IDX.body.get(code) || { th: code }).th;
const RESULT_TH = { APPROVED: ["เห็นชอบ", "good"], APPROVED_WITH_CONDITIONS: ["เห็นชอบโดยมีเงื่อนไข", "warn"], REJECTED: ["ไม่เห็นชอบ", "bad"], RETURNED: ["ส่งกลับแก้ไข", "warn"] };
const CASE_TYPE = { NEW: "หลักสูตรใหม่", REVISION: "หลักสูตรปรับปรุง", CLOSE: "ปิดหลักสูตร", MINOR: "ปรับปรุงเล็กน้อย (สมอ.08)" };
const CASE_STATUS = { DRAFT: ["ร่าง ยังไม่ส่ง", "warn"], IN_PROGRESS: ["อยู่ระหว่างพิจารณา", "info"], RETURNED: ["ส่งกลับแก้ไข", "warn"], APPROVED: ["อนุมัติครบเส้นทาง", "good"], REJECTED: ["ไม่อนุมัติ", "bad"] };

/* ---------- ข้อมูลรวมต่อหลักสูตร ---------- */
function stat(p) { return D.stats[p.id] || D.stats[String(p.id)]; }
function latestVer(p) { return p.versions[p.versions.length - 1]; }
function activeVer(p) { return [...p.versions].reverse().find(v => v.state === "APPROVED") || latestVer(p); }
function cisaOf(p) { return D.workflow.cisa.find(c => c.prog === p.id); }
function openCaseOf(p) { return D.workflow.cases.find(c => c.prog === p.id && !["APPROVED", "REJECTED"].includes(c.status)); }
function currentStep(c) { return c.steps.find(s => s.status === "CURRENT"); }
function caseStageText(c) {
  if (c.status === "DRAFT") return "ร่าง (ยังไม่ส่งเข้าเส้นทาง)";
  if (c.status === "RETURNED") return "ส่งกลับแก้ไข";
  const s = currentStep(c); return s ? "รอ " + BODY_TH(s.body) : CASE_STATUS[c.status][0];
}
function cisaSla(c) {
  if (!c || c.step >= 12 || !c.submitted) return null;
  if (c.step < 6) return { phase: "สถาบัน", days: daysBetween(c.submitted, today()), left: null };
  const used = daysBetween(c.submitted, today()); return { phase: "สป.อว.", days: used, left: 90 - used };
}
function reviewDue(p) { return p.nextReview - 543 <= Number(today().slice(0, 4)) + 1; }
function lowIntake(p) { const s = stat(p); if (!s) return false; const lv = p.level; const min = ["MASTER", "DOCTOR", "GRAD_DIP"].includes(lv) ? 5 : 15; return s.intake.every(n => n < min); }
function progResponsible(p) { return (IDX.rolesByProg.get(p.id) || []).filter(r => r.role === "PROGRAM_RESPONSIBLE").sort((a, b) => a.seq - b.seq); }
function progRegular(p) { return (IDX.rolesByProg.get(p.id) || []).filter(r => r.role === "PROGRAM_REGULAR"); }
function structureOf(p) { return D.design.structures[p.id]; }
function obeOf(p) { return D.design.obe[p.id]; }
function treeCourses(n, out = []) { (n.courses || []).forEach(c => out.push(c)); (n.children || []).forEach(ch => treeCourses(ch, out)); return out; }
function treeCredits(n) { const own = (n.courses || []).reduce((a, c) => a + (IDX.course.get(c) ? IDX.course.get(c).c : 0), 0); return own + (n.children || []).reduce((a, ch) => a + Math.max(treeCredits(ch), ch.courses && ch.courses.length ? 0 : ch.min), 0); }

/* ---------- เกณฑ์มาตรฐานหลักสูตร 2565 (กฎตั้งค่าได้) ---------- */
const POS_RANK = { LECTURER: 0, ASST_PROF: 1, ASSOC_PROF: 2, PROF: 3 };
const DEG_RANK = { BACHELOR: 0, MASTER: 1, DOCTOR: 2 };
function rulesetOf(p) { const lv = IDX.level.get(p.level); return D.settings.standards.find(s => s.set === (lv && lv.ruleset)); }
function pubs5(staffId, years = 5) { const y0 = Number(today().slice(0, 4)) + 543 - years; return (IDX.pubsByStaff.get(staffId) || []).filter(x => x.year > y0 && x.status === "CERTIFIED"); }
function checkStaff(s, p, rs) {
  const res = [];
  rs.rules.forEach(r => {
    if (r.type === "QUAL") {
      const ok = DEG_RANK[s.deg] >= DEG_RANK[r.deg] || (r.orPos && POS_RANK[s.pos] >= POS_RANK[r.orPos]);
      const iscedOk = !!s.isced;
      res.push({ no: r.no, ok: ok && iscedOk, warn: ok && !iscedOk, msg: !ok ? `คุณวุฒิ ${DEG_TH[s.deg]} / ${POS_TH[s.pos]} ไม่ถึงเกณฑ์` : !iscedOk ? "ไม่มีรหัส ISCED ใน ERP-HR — ต้องตรวจความตรง/สัมพันธ์ด้วยคน" : "ผ่าน" });
    } else if (r.type === "PUBS") {
      const list = pubs5(s.id, r.years); const research = list.filter(x => x.research).length;
      const ok = list.length >= r.min && (!r.research || research >= r.research);
      if (!ok && !D.staffData.publications.length) res.push({ no: r.no, ok: false, warn: true, msg: "ERP-HR ยังไม่มีข้อมูลผลงานวิชาการ — ตรวจด้วยคน (G10)" });
      else res.push({ no: r.no, ok, msg: `${list.length} รายการใน ${r.years} ปี${r.research ? ` (วิจัย ${research})` : ""}${D.staffData.publicationsAreDemo ? " · ผลงานจำลองเพื่อนำเสนอ (G10)" : ""}` });
    } else if (r.type === "UNIQUE") {
      const n = (IDX.rolesByStaff.get(s.id) || []).filter(x => x.role === "PROGRAM_RESPONSIBLE").length;
      res.push({ no: r.no, ok: n <= 1, msg: n <= 1 ? "ผ่าน" : `เป็นผู้รับผิดชอบ ${n} หลักสูตร` });
    } else if (r.type === "ACTIVE") {
      const ok = s.status === "ACTIVE";
      res.push({ no: r.no, ok, msg: ok ? "ปฏิบัติงาน" : ({ STUDY_LEAVE: "ลาศึกษาต่อเต็มเวลา", RETIRED: "เกษียณ", RESIGNED: "ลาออก" }[s.status] || s.status) });
    }
  });
  return res;
}
function standardsCheck(p) {
  const rs = rulesetOf(p); if (!rs) return { rs: null, ok: true, rows: [], prog: [] };
  const resp = progResponsible(p).map(r => IDX.staff.get(r.staff)).filter(Boolean);
  const rows = resp.map(s => ({ s, res: checkStaff(s, p, rs) }));
  const prog = rs.rules.filter(r => r.type === "COUNT").map(r => {
    const active = resp.filter(s => s.status === "ACTIVE").length;
    return { no: r.no, th: r.th, ok: active >= r.min, msg: `${active} คนที่ปฏิบัติงาน (ต้อง ≥ ${r.min})` };
  });
  const fails = rows.filter(x => x.res.some(r => !r.ok && !r.warn)).length + prog.filter(x => !x.ok).length;
  const warns = rows.filter(x => x.res.some(r => r.warn)).length;
  return { rs, rows, prog, ok: fails === 0, fails, warns };
}

/* ---------- จุดคุ้มทุน ---------- */
function breakeven(sc) {
  const allocKeep = 1 - sc.allocationPct;
  const revPerHeadYear = (sc.feePerTerm * 2) + (sc.subsidy || 0);           // ต่อคนต่อปี (2 ภาคปกติ)
  const netRevPerHead = revPerHeadYear * allocKeep;
  const vcPerHead = Object.values(sc.variablePerHead).reduce((a, b) => a + Number(b || 0), 0) * 2;
  const fc = Object.values(sc.fixed).reduce((a, b) => a + Number(b || 0), 0);
  const margin = netRevPerHead - vcPerHead;
  const beConcurrent = margin > 0 ? Math.ceil(fc / margin) : null;
  const years = Math.round(sc.terms / 2);
  const beCohort = beConcurrent ? Math.ceil(beConcurrent / years) : null;
  // ประมาณการ 5 ปีตามแผนรับ (คงอยู่ลดตาม dropout)
  const proj = []; const cohorts = [];
  for (let y = 0; y < 5; y++) {
    cohorts.push(sc.intake[y] || 0);
    let heads = 0; cohorts.forEach((n, i) => { const age = y - i; if (age < years) heads += n * Math.pow(1 - sc.dropout, age); });
    heads = Math.round(heads);
    const rev = heads * revPerHeadYear, alloc = rev * sc.allocationPct, vc = heads * vcPerHead;
    proj.push({ fy: 2571 + y, heads, rev, alloc, net: rev - alloc, vc, fc, profit: rev - alloc - vc - fc });
  }
  return { revPerHeadYear, netRevPerHead, vcPerHead, fc, margin, beConcurrent, beCohort, years, proj, allocKeep };
}

/* ---------- pre-flight CISA (กมอ. 5.1) ---------- */
function cisaPreflight(p) {
  const v = activeVer(p); const st = standardsCheck(p); const o = obeOf(p); const s = structureOf(p);
  const resp = progResponsible(p).map(r => IDX.staff.get(r.staff)).filter(Boolean);
  const ds = resp.filter(x => !x.ds2001).length;
  return [
    { no: 1, th: "มีมติสภามหาวิทยาลัยอนุมัติ (วันที่/ครั้งที่)", ok: !!v.senate, msg: v.senate ? `มติสภา ${thDate(v.senate)}` : "ยังไม่มีมติสภา" },
    { no: 2, th: "แนบเล่ม มคอ.2 ฉบับสภาอนุมัติ (PDF)", ok: v.state === "APPROVED", msg: v.state === "APPROVED" ? "มีไฟล์ในคลังเอกสาร" : "ฉบับยังไม่ล็อก" },
    { no: 3, th: "อาจารย์ผู้รับผิดชอบผ่านเกณฑ์ 2565", ok: st.ok, msg: st.ok ? `ผ่านครบ ${resp.length} คน` : `ไม่ผ่าน ${st.fails} รายการ` },
    { no: 4, th: "อาจารย์ทุกคนอยู่ใน DS2001 รอบล่าสุด (UNICON)", ok: ds === 0, msg: ds === 0 ? "พบครบทุกคน" : `${ds} คนไม่อยู่ใน DS2001 — CISA จะค้นไม่พบ` },
    { no: 5, th: "PLO/Sub-PLO ครบและมี mapping", ok: !!(o && o.plos.length), msg: o ? `${o.plos.length} PLO` : "ไม่มีข้อมูล OBE ในระบบ (ฉบับย้ายข้อมูล)" },
    { no: 6, th: "โครงสร้างหน่วยกิตครบตามเกณฑ์ (≤ 5 ระดับ)", ok: !!s || v.credits > 0, msg: s ? "มีโครงสร้างแบบต้นไม้" : `หน่วยกิตรวม ${v.credits} (ยังไม่มีรายหมวด — P20)` },
    { no: 7, th: "ชื่อปริญญา ISCED-F และรหัสอ้างอิงครบ", ok: !!p.degree, msg: p.degree },
    { no: 8, th: "แผนรับนักศึกษา 5 ปี", ok: !!stat(p), msg: stat(p) ? `${stat(p).plan} คน/ปี` : "ไม่มีแผนรับ" },
  ];
}

/* ---------- DS2004 (ชุดตั้งต้นให้ ERP-HR) ---------- */
function ds2004Rows(year = 2569, sem = 2) {
  const tt = { PROGRAM_RESPONSIBLE: "TT-1", PROGRAM_REGULAR: "TT-2" };
  const rows = [];
  D.roles.filter(r => !r.to).forEach(r => {
    const p = IDX.prog.get(r.prog); if (!p || !["BACH", "BACH_CONT", "MASTER", "DOCTOR", "GRAD_DIP"].includes(p.level) || p.life === "DRAFT") return;
    rows.push({ year, sem, staff: r.staff, fac: IDX.fac.get(p.fac).abbr, facName: IDX.fac.get(p.fac).name, curr: p.checoCode || "", prog: progTitle(p, true), tt: tt[r.role], role: ROLE_PROG[r.role], err: p.checoCode ? "" : "ไม่มี CURR_ID" });
  });
  return rows;
}

/* ---------- งานค้างของผู้ใช้ ---------- */
function casesForMe() {
  return D.workflow.cases.filter(c => { const p = IDX.prog.get(c.prog); return p && inScope(p); });
}
function myTasks() {
  /* D14: งานค้างตาม 7 บทบาท — แต่ละเรื่องมีผู้ทำคนเดียวต่อขั้น */
  const u = me(); const r = u.role; const t = []; const scoped = D.programs.filter(inScope);
  const push = (kind, sev, text, link) => t.push({ kind, sev, text, link });
  D.workflow.cases.forEach(c => {
    const p = IDX.prog.get(c.prog); if (!p || !inScope(p)) return; const cur = currentStep(c);
    if (r === "FC" && myFac(p)) {
      if (c.status === "DRAFT") push("ร่างรอส่ง", "warn", `ส่ง “${c.title}” ให้ผู้บริหารหน่วยงานเห็นชอบ`, "case-" + c.id);
      if (c.status === "RETURNED") push("แก้ไข", "bad", `แก้ไขตามมติและส่งใหม่: ${progTitle(p, true)}`, "case-" + c.id);
    }
    if (!cur || c.status !== "IN_PROGRESS") return;
    if (r === "UX" && cur.body === "FACULTY_BOARD" && myFac(p)) push("เห็นชอบระดับคณะ", "info", `เห็นชอบเสนอ (บันทึกมติกรรมการประจำคณะ): ${c.title}`, "case-" + c.id);
    if (r === "CC" && cur.body !== "FACULTY_BOARD") push(cur.meeting ? "บันทึกมติ" : "บรรจุวาระ", cur.meeting ? "info" : "warn", `${cur.meeting ? "บันทึกมติ" : "บรรจุวาระ"} ${BODY_TH(cur.body)}: ${progTitle(p, true)}`, "case-" + c.id);
  });
  if (r === "FP") scoped.filter(p => myFac(p)).forEach(p => {
    const v = latestVer(p); const sc = D.finance.scenarios[p.id];
    if (["DRAFT", "IN_REVIEW"].includes(v.state) && (!sc || sc.status !== "SIGNED")) push("ต้นทุน/จุดคุ้มทุน", "warn", `${sc ? "ทำให้ครบแล้วเสนอผู้บริหารลงนาม" : "เริ่มวิเคราะห์ต้นทุน"}: ${progTitle(p, true)}`, `program-${p.id}-finance`);
    if (sc && sc.uniReview && sc.uniReview.status === "RETURNED") push("แผนมหาวิทยาลัยส่งกลับ", "bad", `${progTitle(p, true)}: ${sc.uniReview.note}`, `program-${p.id}-finance`);
  });
  if (r === "UX") {
    scoped.filter(p => myFac(p)).forEach(p => { const sc = D.finance.scenarios[p.id]; if (sc && sc.status !== "SIGNED" && ["DRAFT", "IN_REVIEW"].includes(latestVer(p).state)) push("ลงนามต้นทุน", "info", `ลงนามรับรองตารางต้นทุน/จุดคุ้มทุน: ${progTitle(p, true)}`, `program-${p.id}-finance`); });
    D.workflow.amendments.filter(a => a.status === "DRAFT" && myFac(IDX.prog.get(a.prog))).forEach(a => push("สมอ.08", "warn", `${a.no} รอเห็นชอบระดับคณะ`, "amendments"));
  }
  if (r === "UP") Object.entries(D.finance.scenarios).forEach(([pid, sc]) => { const p = IDX.prog.get(Number(pid)); if (p && sc.status === "SIGNED" && !(sc.uniReview && sc.uniReview.status === "APPROVED")) push("ตรวจต้นทุน", "warn", `ตรวจรับรองการวิเคราะห์ต้นทุน: ${progTitle(p, true)}`, `program-${p.id}-finance`); });
  if (r === "CC") {
    D.workflow.amendments.filter(a => a.status === "FACULTY_APPROVED").forEach(a => push("สมอ.08", "info", `${a.no} บรรจุวาระ/บันทึกมติสภาวิชาการ`, "amendments"));
    const n = scoped.filter(p => p.life === "ACTIVE" && progResponsible(p).length && !standardsCheck(p).ok).length;
    if (n) push("เกณฑ์ 2565", "bad", `หลักสูตรที่อาจารย์ไม่ผ่านเกณฑ์ ${n} หลักสูตร — แจ้งคณะดำเนินการ`, "dashboard");
  }
  if (r === "FC") scoped.filter(p => myFac(p) && p.life === "ACTIVE").forEach(p => {
    const st = standardsCheck(p); if (st.rows.length && !st.ok) push("เกณฑ์ 2565", "bad", `${progTitle(p, true)}: อาจารย์ไม่ผ่านเกณฑ์ ${st.fails} รายการ`, `program-${p.id}-staff`);
    if (reviewDue(p) && !openCaseOf(p)) push("ครบรอบปรับปรุง", "warn", `${progTitle(p, true)} ครบรอบปรับปรุงปี ${p.nextReview}`, "program-" + p.id);
  });
  if (r === "RG") {
    D.workflow.cisa.forEach(c => { const sla = cisaSla(c); const p = IDX.prog.get(c.prog);
      if (sla && sla.left != null && sla.left < 45) push("CISA SLA", sla.left < 15 ? "bad" : "warn", `${progTitle(p, true)} — เหลือ ${sla.left} วันจาก 90 วัน (ขั้น ${c.step})`, "cisa-" + p.id);
      if (c.returned) push("CISA ส่งกลับ", "bad", `สป.อว. ส่งกลับแก้ไข: ${progTitle(p, true)}`, "cisa-" + p.id); });
    D.workflow.cases.filter(c => c.status === "APPROVED" && !D.workflow.cisa.find(x => x.prog === c.prog && x.ver === c.ver) && !["VOC", "HVOC"].includes(IDX.prog.get(c.prog).level)).forEach(c =>
      { const due = Number((typeof settingVal === "function" && settingVal("sla_rule.MHESI_SUBMIT_DAYS", 30)) || 30); const cs = c.steps.find(x => x.body === "UNIVERSITY_COUNCIL" && x.date); const left = cs ? due - daysBetween(cs.date, today()) : null;
        push("เสนอ สป.อว.", left != null && left < 7 ? "bad" : "warn", `เตรียมชุด CISA: ${progTitle(IDX.prog.get(c.prog), true)} — เสนอ สป.อว. ภายใน ${due} วันนับจากมติสภามหาวิทยาลัย${left != null ? ` (เหลือ ${left} วัน)` : ""}`, "cisa-" + c.prog); });
  }
  if (["CC", "RG", "UP", "SA"].includes(r)) {
    const req = D.settings.settings.filter(s => s.status === "REQUIRED_INPUT" && settingOwner(s.key) === r);
    if (req.length) push("ค่าตั้งค่า", "bad", `ค่าตั้งค่าในความรับผิดชอบที่ต้องกรอก ${req.length} รายการ`, "settings");
  }
  if (r === "SA") { const fail = D.integ.deliveries.filter(x => x.status === "FAILED").length; if (fail) push("webhook", "bad", `ส่ง webhook ไม่สำเร็จ ${fail} ครั้ง`, "integration"); }
  if (r === "EX") { const low = scoped.filter(lowIntake).length; if (low) push("ภาพรวม", "info", `หลักสูตรนักศึกษาน้อยต่อเนื่อง ${low} หลักสูตร`, "dashboard"); }
  return t;
}

/* ---------- เปลี่ยนสถานะเส้นทางอนุมัติ ---------- */
function advanceCase(c, result, note, meetingId) {
  const cur = currentStep(c); if (!cur) return;
  cur.status = "DONE"; cur.result = result; cur.note = note || ""; cur.date = today(); if (meetingId) cur.meeting = Number(meetingId);
  if (result === "REJECTED") { c.status = "REJECTED"; cur.status = "REJECTED"; return; }
  if (result === "RETURNED") { c.status = "RETURNED"; cur.status = "CURRENT"; cur.result = "RETURNED"; return; }
  const i = c.steps.indexOf(cur); const nx = c.steps[i + 1];
  if (nx) { nx.status = "CURRENT"; c.status = "IN_PROGRESS"; }
  else {
    c.status = "APPROVED";
    const { p, v } = IDX.ver.get(c.ver) || {};
    if (v) {
      if (c.type === "CLOSE") { p.life = "CLOSING"; }
      else {
        p.versions.forEach(x => { if (x.state === "APPROVED" && x.id !== v.id) x.state = "SUPERSEDED"; });
        v.state = "APPROVED"; v.senate = today(); p.latestYear = v.year; p.nextReview = v.year + 5; p.accredExpiry = v.year + 5;
        if (p.life === "DRAFT") p.life = "ACTIVE";
        D.integ.deliveries.unshift({ id: Date.now(), event: "program.version.approved", client: "c1", at: today() + "T" + new Date().toTimeString().slice(0, 5), status: "DELIVERED", code: 200, attempts: 1 });
      }
    }
  }
}
