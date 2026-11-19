/* logic-lifecycle.js — D11 ปรับใช้แนวปฏิบัติ CMS มอ. (design/14-benchmark-psu-cms.md)
   ความครบถ้วนรายหมวด · สถานะหลักสูตร 6 แบบ · ตรวจสอบข้อมูล 2 ระยะ · งดรับ/ปิด · สายฉบับ · วันเฉลี่ยระหว่างขั้น · อาจารย์ใกล้ไม่ผ่าน */
"use strict";

LIFE.CLOSED = ["ปิดดำเนินการ", "neutral"];
LIFE.CANCELLED = ["ยกเลิก", "neutral"];
LIFE.CLOSING = ["ระหว่างขอปิด", "warn"];
const DIMS = [["NPU_STRATEGY", "ยุทธศาสตร์ มนพ."], ["NATIONAL_STRATEGY", "ยุทธศาสตร์ชาติ"], ["MANPOWER", "กำลังคน/อุตสาหกรรมเป้าหมาย"], ["SDG", "SDGs"]];
const REVIEW_STATUS = { WAITING: ["รอตรวจ", "warn"], IN_REVIEW: ["กำลังตรวจ", "info"], PASSED: ["ผ่าน", "good"], RETURNED: ["ส่งกลับแก้ไข", "bad"] };
const CLOSE_KIND = { SUSPEND_ADMISSION: "งดรับนักศึกษา", CLOSE: "ปิดดำเนินการ" };
const CREQ_KIND = { OPEN: "เปิดรายวิชาใหม่", EDIT: "แก้ไขข้อมูล", REVISE: "ปรับปรุงรายวิชา", DEACTIVATE: "ปิดใช้งาน", REACTIVATE: "เปิดใช้งานอีกครั้ง" };
const CREQ_STATUS = { PENDING: ["รออนุมัติ", "warn"], APPROVED: ["อนุมัติ", "good"], REJECTED: ["ไม่อนุมัติ", "bad"], CANCELLED: ["ยกเลิกคำขอ", "neutral"] };
const LINK_STATUS = { MATCHED: ["จับคู่แล้ว", "good"], DUPLICATE: ["รหัสทะเบียนซ้ำ", "bad"], NO_ID: ["ยังไม่ระบุรหัส", "warn"], NOT_FOUND: ["ไม่พบในทะเบียน", "bad"] };
const DOT = { done: ["ครบ", "good", "●"], partial: ["ยังไม่ครบ", "warn", "◐"], empty: ["ยังไม่กรอก", "neutral", "○"], na: ["ไม่ใช้กับระดับนี้", "neutral", "–"] };
function settingVal(key, def) { const s = IDX.setting && IDX.setting.get(key); if (!s || s.value == null || s.value === "") return def; return String(s.value).trim().split(/\s+/)[0]; }   // ค่าแรกของช่อง (ส่วนที่เหลือเป็นคำอธิบายจาก 09)

/* ---------- ดัชนีเพิ่ม: รายวิชาที่สร้างใน CMS + ฟอร์มฉบับร่าง ---------- */
const _buildIndexBase = buildIndex;
buildIndex = function () {
  _buildIndexBase();
  if (!D.life) return;
  IDX.regCodes = IDX.regCodes || new Set(D.courses.map(c => c.code));
  D.life.cmsCourses.forEach(c => { if (!IDX.course.has(c.code)) IDX.course.set(c.code, c); });
  D.programs.forEach(p => p.versions.forEach(v => { if (!v.form && D.life.forms[v.id]) v.form = JSON.parse(JSON.stringify(D.life.forms[v.id])); }));
  IDX.centralByCode = new Map(D.life.central.map(c => [c.code, c]));
};

/* ---------- โปรไฟล์ต่อฉบับ (ข้อมูลเชิงนโยบาย ประชาสัมพันธ์ กรรมการ ตัวชี้วัด) ---------- */
function profileOf(v) { return D.life.profiles[v.id] || null; }
function ensureProfile(v) {
  if (D.life.profiles[v.id]) return D.life.profiles[v.id];
  const base = v.basedOn && D.life.profiles[v.basedOn];
  const blank = { response: { NPU_STRATEGY: [], NATIONAL_STRATEGY: [], MANPOWER: [], SDG: [] }, partners: [], pr: { highlightTh: "", highlightEn: "", careerTh: "", careerEn: "", attributes: [], kwTh: [], kwEn: [] },
    committee: [{ pos: "CHAIR", staff: null, phone: "" }, { pos: "COORDINATOR", staff: null, phone: "" }], qa: { cwie: "", indicators: {} }, ploCert: null, signed: {} };
  const pr = base ? Object.assign(JSON.parse(JSON.stringify(base)), { ploCert: null, signed: {} }) : blank;   // ฉบับปรับปรุงคัดลอกจากฉบับแม่ (แนวทาง มอ.)
  D.life.profiles[v.id] = pr; return pr;
}

/* ---------- B01 ความครบถ้วน ---------- */
function completeness(p, v = latestVer(p)) {
  const pf = profileOf(v) || {}; const f = v.form || {}; const o = obeOf(p); const s = structureOf(p); const sc = D.finance.scenarios[p.id];
  const tri = (n, total) => n >= total ? "done" : n > 0 ? "partial" : "empty";
  const R = {
    form: keys => { const n = keys.filter(k => f[k] !== undefined && String(f[k]).trim() !== "").length; return [tri(n, keys.length), `${n}/${keys.length} ช่อง`]; },
    response: () => { const r = pf.response || {}; const n = DIMS.filter(([k]) => (r[k] || []).length).length; return [tri(n, 4), `${n}/4 หัวข้อ`]; },
    partners: () => (pf.partners || []).length ? ["done", `${pf.partners.length} รายการ`] : ["empty", "ไม่มี (ไม่บังคับ)"],
    plo: () => { if (!o || !o.plos.length) return ["empty", "ยังไม่มี PLO"]; const ok = o.plos.filter(x => x.criteria && x.tool && x.domain).length; return [tri(ok, o.plos.length), `${ok}/${o.plos.length} PLO ครบ`]; },
    plocert: () => pf.ploCert ? ["done", `รับรอง ${thDate(pf.ploCert.date)}`] : o ? ["empty", "ยังไม่รับรอง"] : ["empty", "ยังไม่มี PLO"],
    structure: () => !s ? ["empty", "ยังไม่มีโครงสร้าง"] : s.source === "TEMPLATE" ? ["partial", "โครงสร้างร่างตามระเบียบ — รอรายวิชาจากทะเบียน (G05)"] : s.min >= v.credits ? ["done", `${s.min}/${v.credits} นก.`] : ["partial", `${s.min}/${v.credits} นก.`],
    studyplan: () => { const pl = D.design.studyPlans[p.id]; if (!pl) return ["empty", "ยังไม่มีแผนการเรียน"]; const inT = new Set(s ? treeCourses(s) : []); const bad = pl.flatMap(t => t.courses).filter(c => !inT.has(c)).length; return bad ? ["partial", `${bad} รายวิชาไม่อยู่ในโครงสร้าง`] : ["done", `${pl.length} ภาค`]; },
    mapping: () => { if (!o) return ["empty", "ยังไม่มี mapping"]; const rows = Object.entries(o.mapping); const okRow = rows.filter(([c, m]) => Object.keys(m).length && (o.clos[c] || []).length).length; const noM = o.plos.filter(x => !rows.some(([, m]) => m[x.code] === (o.framework === "TQF6" ? "●" : "M"))).length; return [okRow === rows.length && !noM ? "done" : "partial", `${okRow}/${rows.length} รายวิชา${noM ? ` · PLO ไม่มีระดับ M ${noM}` : ""}`]; },
    intake: () => sc && sc.intake.every(n => n > 0) ? ["done", sc.intake.join("/")] : f.intake ? ["partial", `แผนรับต่อปี ${f.intake} (ยังไม่ทำ 5 ปี)`] : ["empty", "ยังไม่มี"],
    standards: () => { const st = standardsCheck(p); if (!st.rs) return ["na", "ไม่มีชุดกฎ"]; if (!st.rows.length) return ["empty", "ยังไม่กำหนดอาจารย์"]; return st.ok ? ["done", "ผ่านทุกข้อ"] : ["partial", `ไม่ผ่าน ${st.fails} รายการ`]; },
    finance: () => !sc ? ["empty", "ยังไม่วิเคราะห์"] : sc.status !== "SIGNED" ? ["partial", "ร่าง — รอผู้บริหารหน่วยงานลงนาม"] : sc.uniReview && sc.uniReview.status === "APPROVED" ? ["done", "ลงนาม + แผนมหาวิทยาลัยรับรอง"] : ["partial", "ลงนามแล้ว — รอแผนมหาวิทยาลัยตรวจรับรอง"],
    indicators: () => { const q = pf.qa || {}; const n = Object.keys(q.indicators || {}).length; const tot = D.life.options.INDICATORS.length; return [n >= tot && q.cwie ? "done" : (n || q.cwie) ? "partial" : "empty", `${n}/${tot} ตัวชี้วัด${q.cwie ? "" : " · ยังไม่ระบุ CWIE"}`]; },
    council: () => ["na", "ไม่มี (ไม่บังคับ)"],
    committee: () => { const c = pf.committee || []; const ch = c.find(x => x.pos === "CHAIR" && x.staff); const co = c.find(x => x.pos === "COORDINATOR" && x.staff); const ph = co && co.phone; const n = [ch, co, ph].filter(Boolean).length; return [tri(n, 3), !co ? "ยังไม่มีผู้ประสานงาน" : !ph ? "ผู้ประสานงานยังไม่มีโทรศัพท์" : !ch ? "ยังไม่มีประธาน" : "ครบ"]; },
    pr: () => { const r = pf.pr || {}; const parts = [r.highlightTh, r.highlightEn, r.careerTh, r.careerEn, (r.attributes || []).length, (r.kwTh || []).length, (r.kwEn || []).length]; const n = parts.filter(Boolean).length; return [tri(n, 7), `${n}/7 ช่อง`]; },
  };
  let reqTotal = 0, reqDone = 0; const missing = [];
  const sections = D.life.sections.map(sec => {
    const items = sec.items.map(it => {
      let st, msg;
      if ((it.skipLevels || []).includes(p.level)) { st = "na"; msg = "ไม่ใช้กับระดับ " + levelAbbr(p.level); }
      else { const [rule, arg] = it.rule.split(":"); [st, msg] = R[rule](arg ? arg.split(",") : undefined); }
      const req = it.req && st !== "na";
      if (req) { reqTotal++; if (st === "done") reqDone++; else missing.push(Object.assign({ sec: sec.code, state: st, msg }, it)); }
      return Object.assign({ state: st, msg, reqEff: req }, it);
    });
    const reqs = items.filter(i => i.reqEff); const state = reqs.every(i => i.state === "done") ? "done" : reqs.some(i => i.state !== "empty") ? "partial" : "empty";
    return { code: sec.code, th: sec.th, items, state };
  });
  return { sections, reqTotal, reqDone, pct: reqTotal ? reqDone / reqTotal : 1, missing };
}
function itemLink(p, v, it) { const [k, h] = it.tab.split(":"); return k === "edit" ? `edit-${v.id}-${h}` : `program-${p.id}-${k}`; }
function compPill(c) { return pill(`ครบถ้วน ${Math.round(c.pct * 100)}%`, c.pct >= 1 ? "good" : c.pct >= .6 ? "warn" : "bad"); }
function dotHtml(st) { const d = DOT[st]; return `<span class="cdot ${d[1]}" role="img" aria-label="${d[0]}" title="${d[0]}">${d[2]}</span>`; }

/* ---------- สถานะหลักสูตรที่ผู้ใช้เห็น (B06) ---------- */
function lifeStatus(p) {
  const v = latestVer(p);
  if (["CLOSED", "CANCELLED", "ADMISSION_SUSPENDED", "CLOSING"].includes(p.life)) return LIFE[p.life];
  if (p.life === "DRAFT") return v.state === "IN_REVIEW" ? ["หลักสูตรใหม่ระหว่างอนุมัติ", "info"] : ["จัดเตรียมข้อมูล", "warn"];
  return v.state === "APPROVED" ? ["ฉบับปัจจุบัน", "good"] : ["ฉบับปัจจุบัน · มีฉบับปรับปรุงระหว่างจัดทำ", "info"];
}

/* ---------- B07 ตรวจสอบข้อมูล 2 ระยะ ---------- */
function reviewsOf(caseOrVer, phase) { return D.life.reviews.filter(r => (r.case === caseOrVer.id || r.ver === caseOrVer.ver) && (!phase || r.phase === phase)).sort((a, b) => a.round - b.round); }
function lastReview(c, phase) { const rs = D.life.reviews.filter(r => r.case === c.id && r.phase === phase); return rs.sort((a, b) => b.round - a.round)[0] || null; }
function newReview(c, phase, round = 1) {
  const id = Math.max(0, ...D.life.reviews.map(r => r.id)) + 1;
  const r = { id, case: c.id, prog: c.prog, ver: c.ver, phase, round, status: "WAITING", reviewer: ((usersOf(phase === 1 ? "CC" : "RG")[0]) || {}).id, submitted: today(), reviewed: null, items: {} };
  D.life.reviews.push(r); notifyRole(phase === 1 ? "CC" : "RG", null, `มีหลักสูตรรอตรวจสอบข้อมูลระยะ ${phase}: ${progTitle(IDX.prog.get(c.prog), true)}`, "review-" + id); return r;
}

/* ---------- นักศึกษาคงค้างรายรุ่น ---------- */
function remainingOf(p) {
  if (D.life.remaining[p.id]) return D.life.remaining[p.id];
  const s = stat(p); if (!s) return [];
  const older = Math.max(0, s.total - s.intake.reduce((a, n) => a + Math.round(n * s.retention), 0));
  return [{ entry: s.years[0] - 1, n: older }].concat(s.years.map((y, i) => ({ entry: y, n: Math.round(s.intake[i] * s.retention) })));
}
function remainingTotal(p) { return remainingOf(p).reduce((a, r) => a + r.n, 0); }

/* ---------- อาจารย์ใกล้ไม่ผ่าน (ผลงานจะหลุดกรอบ 5 ปีภายใน N ปี) ---------- */
function aboutToFail(p) {
  const rs = rulesetOf(p); if (!rs) return [];
  const rule = rs.rules.find(r => r.type === "PUBS"); if (!rule) return [];
  const w = Number(settingVal("staff.about_to_fail_window", 1)); const yNow = Number(today().slice(0, 4)) + 543;
  return progResponsible(p).map(r => r.staff).filter(id => {
    const now = pubs5(id, rule.years).length;
    const next = (IDX.pubsByStaff.get(id) || []).filter(x => x.status === "CERTIFIED" && x.year > yNow - rule.years + w).length;
    return now >= rule.min && next < rule.min;
  });
}

/* ---------- วันระหว่างขั้นอนุมัติ ---------- */
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
function approvalDurations(cases) {
  const map = new Map();
  cases.forEach(c => {
    const done = c.steps.filter(s => s.status === "DONE" && s.date);
    const pts = [{ body: "SUBMIT", date: c.created }].concat(done.map(s => ({ body: s.body, date: s.date })));
    for (let i = 1; i < pts.length; i++) {
      const k = pts[i - 1].body + ">" + pts[i].body; const d = daysBetween(pts[i - 1].date, pts[i].date);
      if (!map.has(k)) map.set(k, { from: pts[i - 1].body, to: pts[i].body, days: [], cases: [] });
      map.get(k).days.push(d); map.get(k).cases.push(c.id);
    }
  });
  return [...map.values()].map(x => ({ ...x, n: x.days.length, avg: x.days.reduce((a, b) => a + b, 0) / x.days.length, min: Math.min(...x.days), max: Math.max(...x.days) }));
}
const BODY_SHORT = { SUBMIT: "ยื่นเรื่อง", FACULTY_BOARD: "คณะ", CURRICULUM_SCREENING: "กลั่นกรอง", GRADUATE_SCHOOL: "บัณฑิตวิทยาลัย", ACADEMIC_SENATE: "สภาวิชาการ", EXECUTIVE_BOARD: "บริหาร", UNIVERSITY_COUNCIL: "สภามหาวิทยาลัย" };

/* ---------- หลังบันทึกมติ: ตรวจระยะ 1/2 · ปิด/งดรับ · สายฉบับ · แจ้งเตือน ---------- */
const _advanceCaseBase = advanceCase;
advanceCase = function (c, result, note, meetingId) {
  const p = IDX.prog.get(c.prog); const before = lifeStatus(p)[0]; const prevBody = (currentStep(c) || {}).body; const mt = meetingId ? IDX.meeting.get(Number(meetingId)) : (currentStep(c) || {}).meeting ? IDX.meeting.get((currentStep(c) || {}).meeting) : null;
  _advanceCaseBase(c, result, note, meetingId);
  const cur = currentStep(c); const gateBody = settingVal("review.phase1_at", "CURRICULUM_SCREENING");
  if (c.status === "IN_PROGRESS" && cur && (cur.body === gateBody || (gateBody === "CURRICULUM_SCREENING" && prevBody === "FACULTY_BOARD" && cur.body !== "FACULTY_BOARD")) && c.type !== "CLOSE" && !lastReview(c, 1)) newReview(c, 1);
  if (prevBody === "CURRICULUM_SCREENING" && ["APPROVED", "APPROVED_WITH_CONDITIONS"].includes(result) && c.type !== "CLOSE" && !["VOC", "HVOC"].includes(p.level)) {   // D14: มติกลั่นกรอง = รับรอง PLO (ไม่ต้องบันทึกแยก)
    const v = (IDX.ver.get(c.ver) || {}).v; if (v) { const pf = ensureProfile(v); if (!pf.ploCert) pf.ploCert = { date: today(), meeting: "คณะกรรมการกลั่นกรองหลักสูตร" + (mt ? " ครั้งที่ " + mt.no : ""), chair: "ประธานคณะกรรมการกลั่นกรองหลักสูตร", auto: true }; }
  }
  if (c.status === "APPROVED") {
    if (c.type === "CLOSE") {
      const cl = D.life.closures.find(x => x.case === c.id);
      p.life = cl && cl.kind === "SUSPEND_ADMISSION" ? "ADMISSION_SUSPENDED" : "CLOSED"; if (cl) cl.status = "APPROVED";
    } else {
      const lin = D.life.lineage[c.ver];
      if (lin) lin.parents.forEach(par => { const pp = IDX.prog.get(par.prog); if (!pp || pp.id === p.id) return;
        pp.versions.forEach(x => { if (x.state === "APPROVED") x.state = "SUPERSEDED"; }); if (pp.life === "ACTIVE") pp.life = "ADMISSION_SUSPENDED"; });
      if (!lastReview(c, 2)) newReview(c, 2);
    }
    D.integ.deliveries.unshift({ id: Date.now() + 1, event: "program.lifecycle.changed", client: "c1", at: today() + "T" + new Date().toTimeString().slice(0, 5), status: "DELIVERED", code: 200, attempts: 1 });
  }
  const after = lifeStatus(p)[0];
  if (before !== after && settingVal("notify.status_change", "IN_APP")) {
    usersOf("CC").concat(usersOf("FC", p.fac), usersOf("UX", p.fac), usersOf("RG")).map(u => u.id)
      .forEach(u => notify(u, `สถานะหลักสูตร ${progTitle(p, true)}: ${before} → ${after} (แจ้งในระบบ + อีเมล)`, "program-" + p.id));
  }
};

/* ---------- งานค้างเพิ่ม ---------- */
const _myTasksBase = myTasks;
myTasks = function () {
  const t = _myTasksBase(); const u = me(); const r = u.role;
  if (can("review.data")) D.life.reviews.filter(x => x.phase === 1 && ["WAITING", "IN_REVIEW"].includes(x.status)).forEach(x => t.push({ kind: "ตรวจสอบข้อมูล ระยะ 1", sev: "warn", text: `ตรวจข้อมูลก่อนเข้าสภาวิชาการ: ${progTitle(IDX.prog.get(x.prog), true)} (รอบ ${x.round})`, link: "review-" + x.id }));
  if (can("review.registrar")) D.life.reviews.filter(x => x.phase === 2 && ["WAITING", "IN_REVIEW"].includes(x.status)).forEach(x => t.push({ kind: "ตรวจสอบข้อมูล ระยะ 2", sev: "warn", text: `เทียบโครงสร้างกับระบบทะเบียน: ${progTitle(IDX.prog.get(x.prog), true)}`, link: "review-" + x.id }));
  if (can("course.central")) { const n = D.life.centralRequests.filter(x => x.status === "PENDING").length; if (n) t.push({ kind: "รายวิชากลาง", sev: "info", text: `คำขอรายวิชากลาง GE/วิชาบริการ รออนุมัติ ${n} รายการ`, link: "central-requests" }); }
  if (can("course.link")) { const n = D.life.courseLinks.filter(x => x.status !== "MATCHED").length; if (n) t.push({ kind: "เชื่อมทะเบียน", sev: "warn", text: `รายวิชาใน CMS ที่ยังไม่จับคู่รหัสทะเบียน ${n} รายการ`, link: "courselink" }); }
  if (r === "FC") {
    D.life.reviews.filter(x => x.status === "RETURNED").forEach(x => { const p = IDX.prog.get(x.prog); const c = IDX.case.get(x.case);
      const mine = p.fac === u.scope.fac;
      if (mine && !D.life.reviews.some(y => y.case === x.case && y.phase === x.phase && y.round > x.round)) t.push({ kind: "แก้ตามผลตรวจ", sev: "bad", text: `ผลตรวจสอบข้อมูลระยะ ${x.phase} ไม่ผ่าน: ${progTitle(p, true)} — แก้แล้วส่งตรวจอีกครั้ง`, link: "review-" + x.id }); if (!c) return; });
    D.programs.filter(p => inScope(p)).forEach(p => {
      const v = latestVer(p); const pf = profileOf(v);
      (pf && pf.partners || []).forEach(m => { if (m.end && daysBetween(today(), m.end) <= 90 && daysBetween(today(), m.end) >= 0) t.push({ kind: "MOU ใกล้หมดอายุ", sev: "warn", text: `${m.name} หมดอายุ ${thDate(m.end)} (${progTitle(p, true)})`, link: `program-${p.id}-policy` }); });
      if (["DRAFT", "IN_REVIEW"].includes(v.state)) { const cp = completeness(p, v); if (cp.pct < 1) t.push({ kind: "ความครบถ้วน", sev: "warn", text: `${progTitle(p, true)} ครบถ้วน ${Math.round(cp.pct * 100)}% — ขาด ${cp.missing.length} รายการ`, link: `program-${p.id}-complete` }); }
      const at = aboutToFail(p); if (at.length && p.life === "ACTIVE") t.push({ kind: "ใกล้ไม่ผ่านเกณฑ์", sev: "warn", text: `${progTitle(p, true)}: อาจารย์ ${at.length} คนผลงานจะหลุดกรอบ 5 ปีในปีหน้า`, link: `program-${p.id}-staff` });
    });
  }
  if (can("program.close") || r === "CC") D.programs.filter(p => inScope(p) && p.life === "ADMISSION_SUSPENDED" && remainingTotal(p) === 0 && !openCaseOf(p))
    .forEach(p => t.push({ kind: "พร้อมปิด", sev: "info", text: `${progTitle(p, true)} งดรับแล้วและไม่มีนักศึกษาคงค้าง — ยื่นปิดดำเนินการได้`, link: "closures-new-" + p.id }));
  return t;
};

/* ---------- ยืนยันการกระทำที่ทำลายข้อมูลด้วยการพิมพ์รหัส (B18) ---------- */
let TYPED_CB = null;
function confirmTyped(title, message, code, cb) {
  TYPED_CB = cb;
  openModal(title, `<form data-form="typed-confirm" data-code="${esc(code)}"><div class="note warn">${message}</div>${field("typed", `พิมพ์รหัส ${code} เพื่อยืนยัน`, { required: true, placeholder: code })}<div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn danger" type="submit">ยืนยัน</button></div></form>`);
}
form("typed-confirm", (d, f) => {
  if (d.typed !== f.dataset.code) { formErrors(f, { typed: "รหัสไม่ตรง — ไม่ได้ดำเนินการ" }); return; }
  const cb = TYPED_CB; TYPED_CB = null; closeModal(); if (cb) cb();
});
