/* core.js — โหลดข้อมูล JSON, สถานะ, สิทธิ์, router, ตัวช่วย UI */
"use strict";

const DATA_FILES = [
  ["meta", "data/meta.json", "ข้อมูลอ้างอิง ระดับ เส้นทางอนุมัติ"],
  ["security", "data/security.json", "บทบาท สิทธิ์ ผู้ใช้"],
  ["programs", "data/programs.json", "หลักสูตร (ระบบทะเบียน)"],
  ["courses", "data/courses.json", "รายวิชา (ระบบทะเบียน)"],
  ["staffData", "data/staff.json", "บุคลากร (ERP-HR จำลอง)"],
  ["roles", "data/program-roles.json", "บทบาทอาจารย์ในหลักสูตร"],
  ["stats", "data/stats.json", "สถิตินักศึกษา"],
  ["design", "data/curriculum-design.json", "โครงสร้าง แผนการเรียน OBE"],
  ["workflow", "data/workflow.json", "การอนุมัติ การประชุม CISA สมอ.08"],
  ["finance", "data/finance.json", "ต้นทุนและจุดคุ้มทุน"],
  ["erp", "data/erp.json", "หน่วยงาน/ค่าธรรมเนียม ERP"],
  ["settings", "data/settings.json", "ค่าตั้งค่า ประเด็นค้าง เกณฑ์"],
  ["integ", "data/integration.json", "ศูนย์เชื่อมโยง log"],
  ["documents", "data/documents.json", "แคตตาล็อกเอกสาร"],
  ["tqf", "data/tqf-samples.json", "ตัวอย่าง มคอ.3/มคอ.5"],
  ["gaps", "data/data-gaps.json", "ข้อมูลที่ยังขาด"],
  ["life", "data/lifecycle.json", "วงจรหลักสูตร ความครบถ้วน การตรวจสอบ (D11)"],
  ["hist", "data/history.json", "ทะเบียนการปรับปรุงหลักสูตร (D12)"],
  ["reg", "data/regsync.json", "รหัส อว./REG/ERP และนักศึกษาจากระบบทะเบียน (D13)"],
];
// ส่วนที่ผู้ใช้แก้ได้ในต้นแบบ — เก็บใน localStorage ของผู้ชมแต่ละคน
const MUTABLE = ["programs", "roles", "design", "workflow", "finance", "settings", "integ", "staffData", "stats", "life", "hist", "reg"];
const STORE_KEY = "npu-cms-proto-v6";

const D = {};             // ข้อมูลทั้งหมด
const S = { user: null, page: "home", args: [], filters: {}, ui: {} };   // สถานะหน้า
const IDX = {};           // ดัชนีค้นหา

async function loadAll() {
  const list = document.getElementById("load-list");
  list.innerHTML = DATA_FILES.map(([k, , th]) => `<li id="ld-${k}">${th}</li>`).join("");
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { saved = null; }
  await Promise.all(DATA_FILES.map(async ([k, url]) => {
    if (saved && saved.data && saved.data[k] !== undefined) { D[k] = saved.data[k]; }
    else {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`โหลด ${url} ไม่สำเร็จ (${r.status})`);
      D[k] = await r.json();
    }
    const li = document.getElementById("ld-" + k); if (li) { li.className = "ok"; li.textContent += " ✓"; }
  }));
  // courses ไม่ได้อยู่ใน MUTABLE แต่เก็บรายวิชาที่แก้/เพิ่มไว้แยก
  D.courseEdits = (saved && saved.courseEdits) || {};
  D.newCourses = (saved && saved.newCourses) || [];
  D.auditAdds = (saved && saved.auditAdds) || [];
  D.notifications = (saved && saved.notifications) || [];
  S.user = (saved && saved.user) || "u3";
  buildIndex();
}

function persist() {
  try {
    const data = {};
    MUTABLE.forEach(k => { data[k] = D[k]; });
    localStorage.setItem(STORE_KEY, JSON.stringify({ data, user: S.user, courseEdits: D.courseEdits, newCourses: D.newCourses, auditAdds: D.auditAdds, notifications: D.notifications }));
  } catch (e) { /* โหมดส่วนตัว/พื้นที่เต็ม: ทำงานต่อได้โดยไม่บันทึก */ }
}
function resetData() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} location.hash = "#home"; location.reload(); }

function buildIndex() {
  IDX.prog = new Map(D.programs.map(p => [p.id, p]));
  IDX.ver = new Map(); D.programs.forEach(p => p.versions.forEach(v => IDX.ver.set(v.id, { p, v })));
  IDX.fac = new Map(D.meta.faculties.map(f => [f.id, f]));
  const facOther = { id: null, name: "หน่วยงานอื่น (นอกคณะในทะเบียนหลักสูตร)", abbr: "อื่น" }; const _fg = IDX.fac.get.bind(IDX.fac); IDX.fac.get = id => _fg(id) || facOther;
  IDX.level = new Map(D.meta.levels.map(l => [l.code, l]));
  IDX.staff = new Map(D.staffData.staff.map(s => [s.id, s]));
  IDX.course = new Map(D.courses.map(c => [c.code, c]));
  D.newCourses.forEach(c => IDX.course.set(c.code, c));
  Object.entries(D.courseEdits).forEach(([code, e]) => { const c = IDX.course.get(code); if (c) Object.assign(c, e); });
  IDX.user = new Map(D.security.users.map(u => [u.id, u]));
  IDX.body = new Map(D.meta.bodies.map(b => [b.code, b]));
  IDX.meeting = new Map(D.workflow.meetings.map(m => [m.id, m]));
  IDX.case = new Map(D.workflow.cases.map(c => [c.id, c]));
  const demoSet = (D.settings.settings.find(s => s.key === "publication.demo_mode") || {}).value; const demo = !D.staffData.publications.length && D.staffData.demoPublications && !/^false/.test(String(demoSet || "true"));
  D.pubSource = D.staffData.publications.length ? "REAL" : demo ? "DEMO" : "NONE"; if (demo) D.staffData.publications = D.staffData.demoPublications.slice(), D.staffData.publicationsAreDemo = true;
  IDX.pubsByStaff = new Map(); D.staffData.publications.forEach(p => { if (!IDX.pubsByStaff.has(p.staff)) IDX.pubsByStaff.set(p.staff, []); IDX.pubsByStaff.get(p.staff).push(p); });
  IDX.rolesByProg = new Map(); IDX.rolesByStaff = new Map();
  D.roles.forEach(r => {
    if (r.to) return;
    if (!IDX.rolesByProg.has(r.prog)) IDX.rolesByProg.set(r.prog, []); IDX.rolesByProg.get(r.prog).push(r);
    if (!IDX.rolesByStaff.has(r.staff)) IDX.rolesByStaff.set(r.staff, []); IDX.rolesByStaff.get(r.staff).push(r);
  });
  IDX.adminByStaff = new Map(D.staffData.admin.map(a => [a.staff, a]));
  IDX.leaveByStaff = new Map(D.staffData.studyLeave.map(a => [a.staff, a]));
  IDX.setting = new Map(D.settings.settings.map(s => [s.key, s]));
}

/* ---------------- ผู้ใช้ สิทธิ์ ขอบเขต ---------------- */
function me() { return IDX.user.get(S.user); }
/* D14 ตัวช่วยตามบทบาท 7 แบบ */
function usersOf(role, fac) { return D.security.users.filter(u => u.role === role && (!fac || u.scope.type !== "FACULTY" || u.scope.fac === fac)); }
function notifyRole(role, fac, text, link) { usersOf(role, fac).forEach(u => notify(u.id, text, link)); }
function myFac(p) { const u = me(); return u.scope.type === "FACULTY" && p && p.fac === u.scope.fac; }
function headOf(fac) { const u = usersOf("UX", fac)[0]; return u ? u.name : "คณบดี/ผู้อำนวยการ"; }
function settingOwner(key) {
  if (/^(reg\.|uoc\.|ds2004\.|cisa\.|course\.code|review\.phase2|registration\.|grade\.|graduation\.|honors\.|attendance\.|ref\.)/.test(key)) return "RG";
  if (/^(finance\.|allocation|fee)/.test(key)) return "UP";
  if (/^(integration\.|sso\.|hr\.|tqf\.integration|notify\.)/.test(key)) return "SA";
  return "CC";
}
function roleOf(u = me()) { return D.security.roles.find(r => r.code === u.role); }
function can(perm) { return roleOf().perms.includes(perm); }
function inScope(p) {
  const u = me();
  if (can("program.view_all")) return true;
  if (u.scope.type === "UNIVERSITY") return true;
  if (u.scope.type === "FACULTY") return p.fac === u.scope.fac;
  if (u.scope.type === "PROGRAM") return u.scope.progs.includes(p.id) || p.fac === IDX.prog.get(u.scope.progs[0]).fac;
  if (u.scope.type === "SELF") return p.fac === u.scope.fac;
  return false;
}
function canEditProg(p) {
  const u = me();
  if (!can("program.edit")) return false;
  if (u.scope.type === "PROGRAM") return u.scope.progs.includes(p.id);
  if (u.scope.type === "FACULTY") return p.fac === u.scope.fac;
  return u.scope.type === "UNIVERSITY";
}
function denyMsg(perm) {
  const pm = D.security.permissions.find(x => x.code === perm);
  return `บทบาท ${roleOf().code} ไม่มีสิทธิ์ “${pm ? pm.th : perm}”`;
}
function scopeText(u = me()) {
  const s = u.scope;
  if (s.type === "UNIVERSITY") return "ทั้งมหาวิทยาลัย";
  if (s.type === "FACULTY") return IDX.fac.get(s.fac).name;
  if (s.type === "PROGRAM") return s.progs.map(id => progTitle(IDX.prog.get(id), true)).join(", ");
  if (s.type === "SELF") return "ข้อมูลของตนเอง · " + IDX.fac.get(s.fac).name;
  return "";
}

/* ---------------- บันทึกการใช้งาน ---------------- */
function audit(action, target) {
  const now = new Date(); const iso = D.meta.today + "T" + now.toTimeString().slice(0, 5);
  D.integ.audit.unshift({ at: iso, user: S.user, action, target, ip: "10.10.1.20" });
  persist();
}
function notify(to, text, link) { D.notifications.unshift({ to, text, link, at: D.meta.today, read: false }); }

/* ---------------- ตัวช่วยข้อความ/วันที่/ตัวเลข ---------------- */
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function thDate(iso, full) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${(full ? TH_MONTH_FULL : TH_MONTH)[m - 1]} ${y + 543}`;
}
function thDateTime(iso) { return iso ? `${thDate(iso)} ${iso.slice(11, 16)} น.` : "—"; }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
function today() { return D.meta.today; }
function addDays(iso, n) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function fmt(n, dg = 0) { return n == null || isNaN(n) ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: dg, maximumFractionDigits: dg }); }
function baht(n) { return fmt(n, 0); }
function pct(x, dg = 0) { return x == null ? "—" : fmt(x * 100, dg) + "%"; }
function levelAbbr(code) { const l = IDX.level.get(code); return l ? l.abbr : code; }
function progTitle(p, short) {
  if (!p) return "—";
  return short ? `${levelAbbr(p.level)} ${p.name}` : `${p.degree} สาขาวิชา${p.name}`;
}
function staffName(id) { const s = IDX.staff.get(id); return s ? `${s.pre}${s.fn} ${s.ln}` : id; }
function userName(id) { const u = IDX.user.get(id); return u ? u.name : id; }
const POS_TH = { LECTURER: "อาจารย์", ASST_PROF: "ผู้ช่วยศาสตราจารย์", ASSOC_PROF: "รองศาสตราจารย์", PROF: "ศาสตราจารย์" };
const DEG_TH = { BACHELOR: "ปริญญาตรี", MASTER: "ปริญญาโท", DOCTOR: "ปริญญาเอก" };
const LIFE = { ACTIVE: ["เปิดรับ", "good"], ADMISSION_SUSPENDED: ["งดรับ", "warn"], CLOSING: ["ปิด/รอปิด", "neutral"], DRAFT: ["ร่างหลักสูตรใหม่", "info"] };
const VSTATE = { APPROVED: ["อนุมัติแล้ว (ล็อก)", "good"], SUPERSEDED: ["ถูกแทนที่", "neutral"], IN_REVIEW: ["ระหว่างพิจารณา", "info"], DRAFT: ["ร่าง", "warn"] };
const ROLE_PROG = { PROGRAM_RESPONSIBLE: "อาจารย์ผู้รับผิดชอบหลักสูตร", PROGRAM_REGULAR: "อาจารย์ประจำหลักสูตร", PROGRAM_FACULTY: "อาจารย์ประจำ (DS2004)", SPECIAL_LECTURER: "อาจารย์พิเศษ", COURSE_COORDINATOR: "ผู้รับผิดชอบรายวิชา" };
const ROLE_SHORT = { FC: "หลักสูตรคณะ", FP: "แผนคณะ", UX: "ผู้บริหารหน่วยงาน", CC: "หลักสูตรส่วนกลาง", RG: "นายทะเบียน", UP: "แผนมหาวิทยาลัย", EX: "ผู้บริหารมหาวิทยาลัย", SA: "ผู้ดูแลระบบ", TC: "อาจารย์" };
const DS = { CONFIRMED: ["ยืนยันแล้ว", "good"], PROVISIONAL: ["ค่าชั่วคราว", "warn"], MSU_REFERENCE: ["อ้างอิง มมส.", "info"], REQUIRED_INPUT: ["ต้องกรอก", "bad"] };
function pill(text, kind = "neutral") { return `<span class="pill ${kind}">${esc(text)}</span>`; }
function pillOf(map, key) { const v = map[key] || [key, "neutral"]; return pill(v[0], v[1]); }
function srcPill(real) { return real ? `<span class="pill real" title="ข้อมูลจริงจากระบบต้นทาง">ข้อมูลจริง</span>` : `<span class="pill sim" title="ข้อมูลจำลองเพื่อสาธิต">จำลอง</span>`; }

/* ---------------- UI ---------------- */
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3200);
}
function openModal(title, html, opt = {}) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  $(".modal-card").classList.toggle("wide", !!opt.wide);
  $("#modal").hidden = false;
  setTimeout(() => { const f = $("#modal-body input:not([readonly]), #modal-body select, #modal-body textarea, #modal-body button"); if (f) f.focus(); }, 30);
}
function closeModal() { $("#modal").hidden = true; $("#modal-body").innerHTML = ""; }
function btn(label, act, opt = {}) {
  const perm = opt.perm; const allowed = perm ? can(perm) : true; const dis = opt.disabled || !allowed;
  const title = !allowed ? denyMsg(perm) : (opt.title || "");
  const data = Object.entries(opt.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  return `<button type="button" class="btn ${opt.kind || ""} ${opt.sm ? "sm" : ""}" data-act="${act}"${data}${dis ? ' aria-disabled="true"' : ""} title="${esc(title)}">${esc(label)}</button>`;
}
function field(name, label, opt = {}) {
  const id = "f-" + name.replace(/[^\w-]/g, "_");
  const req = opt.required ? ' <span class="req">*</span>' : "";
  const val = opt.value == null ? "" : opt.value;
  let input;
  if (opt.type === "select") {
    input = `<select id="${id}" name="${name}"${opt.required ? " required" : ""}${opt.disabled ? " disabled" : ""}>${opt.blank !== false ? '<option value="">— เลือก —</option>' : ""}${opt.options.map(o => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select>`;
  } else if (opt.type === "textarea") {
    input = `<textarea id="${id}" name="${name}"${opt.required ? " required" : ""}${opt.readonly ? " readonly" : ""} rows="${opt.rows || 4}">${esc(val)}</textarea>`;
  } else {
    input = `<input id="${id}" name="${name}" type="${opt.type || "text"}" value="${esc(val)}"${opt.required ? " required" : ""}${opt.readonly ? " readonly" : ""}${opt.min != null ? ` min="${opt.min}"` : ""}${opt.max != null ? ` max="${opt.max}"` : ""}${opt.step ? ` step="${opt.step}"` : ""}${opt.placeholder ? ` placeholder="${esc(opt.placeholder)}"` : ""}>`;
  }
  return `<div class="field ${opt.full ? "full" : ""}"><label for="${id}">${esc(label)}${req}</label>${input}${opt.hint ? `<span class="hint">${esc(opt.hint)}</span>` : ""}<span class="err" data-err="${name}"></span></div>`;
}
function formData(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === "string" ? v.trim() : v; }); return o; }
function formErrors(form, errs) {
  $$("[data-err]", form).forEach(e => { e.textContent = ""; });
  $$("[aria-invalid]", form).forEach(e => e.removeAttribute("aria-invalid"));
  Object.entries(errs).forEach(([k, m]) => { const e = $(`[data-err="${k}"]`, form); if (e) e.textContent = m; const i = form.elements[k]; if (i && i.setAttribute) i.setAttribute("aria-invalid", "true"); });
  const first = Object.keys(errs)[0]; if (first && form.elements[first] && form.elements[first].focus) form.elements[first].focus();
  return Object.keys(errs).length === 0;
}
function table(cols, rows, opt = {}) {
  if (!rows.length) return `<div class="empty">${esc(opt.empty || "ไม่มีรายการ")}</div>`;
  const head = cols.map(c => `<th${c.num ? ' class="num"' : ""}>${esc(c.th)}</th>`).join("");
  const body = rows.map(r => `<tr${opt.rowAct ? ` class="clickable" data-act="${opt.rowAct}" data-id="${esc(opt.rowId(r))}"` : ""}>${cols.map(c => `<td class="${c.num ? "num" : ""} ${c.wrap ? "wrap" : ""}">${c.html ? c.html(r) : esc(c.val(r))}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap"${opt.maxH ? ` style="max-height:${opt.maxH}px;overflow:auto"` : ""}><table class="t"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function paged(key, rows, size = 25) {
  const pg = S.ui["pg-" + key] || 1; const pages = Math.max(1, Math.ceil(rows.length / size)); const p = Math.min(pg, pages);
  return { rows: rows.slice((p - 1) * size, p * size), pager: `<div class="pager"><span>แสดง ${fmt(Math.min(rows.length, (p - 1) * size + 1))}–${fmt(Math.min(rows.length, p * size))} จาก ${fmt(rows.length)} รายการ</span><span class="actions">${btn("‹ ก่อนหน้า", "page", { sm: true, data: { key, to: p - 1 }, disabled: p <= 1 })}<span>หน้า ${p}/${pages}</span>${btn("ถัดไป ›", "page", { sm: true, data: { key, to: p + 1 }, disabled: p >= pages })}</span></div>` };
}
function pageHead(title, opt = {}) {
  return `<div class="page-head"><div>${opt.crumbs ? `<div class="crumbs">${opt.crumbs}</div>` : ""}<h1>${esc(title)}</h1>${opt.lead ? `<p class="lead">${opt.lead}</p>` : ""}</div><div class="actions">${opt.actions || ""}</div></div>`;
}
function panel(title, body, opt = {}) {
  return `<section class="panel"${opt.id ? ` id="${opt.id}"` : ""}><header><h2>${esc(title)}</h2><div class="actions">${opt.actions || ""}</div></header><div class="body ${opt.flush ? "flush" : ""}">${body}</div></section>`;
}
function kv(pairs) { return `<dl class="kv">${pairs.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`; }

/* ---------------- กราฟแท่ง (SVG) ---------------- */
function barChart(items, opt = {}) {
  // items: [{label, v, v2?, tip}]  แนวนอน 1 สเกล
  const w = 640, rowH = opt.rowH || 24, padL = opt.padL || 190, padR = 56, h = items.length * rowH + 26;
  const max = Math.max(1, ...items.map(i => Math.max(i.v, i.v2 || 0))) * 1.05;
  const x = v => padL + (w - padL - padR) * v / max;
  const ticks = niceTicks(max, 4);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opt.aria || "กราฟแท่ง")}">`;
  ticks.forEach(t => { s += `<line class="grid-line" x1="${x(t)}" x2="${x(t)}" y1="0" y2="${h - 20}"/><text x="${x(t)}" y="${h - 6}" text-anchor="middle">${fmt(t)}</text>`; });
  items.forEach((it, i) => {
    const y = i * rowH + 4; const two = it.v2 != null; const bh = two ? (rowH - 10) / 2 : rowH - 10;
    s += `<g data-tip="${esc(it.tip || `${it.label}: ${fmt(it.v)}`)}"><rect class="hit" x="0" y="${y - 2}" width="${w}" height="${rowH}"/>`;
    s += `<text x="${padL - 8}" y="${y + rowH / 2}" text-anchor="end">${esc(it.label.length > 28 ? it.label.slice(0, 27) + "…" : it.label)}</text>`;
    s += `<rect class="bar1" x="${padL}" y="${y}" width="${Math.max(0, x(it.v) - padL)}" height="${bh}" rx="2"/>`;
    if (two) s += `<rect class="bar2" x="${padL}" y="${y + bh + 2}" width="${Math.max(0, x(it.v2) - padL)}" height="${bh}" rx="2"/>`;
    s += `<text class="lbl-strong" x="${x(Math.max(it.v, it.v2 || 0)) + 5}" y="${y + rowH / 2}">${esc(it.valueLabel || fmt(it.v))}</text></g>`;
  });
  return s + "</svg>";
}
function colChart(items, opt = {}) {
  const w = 640, h = 220, padB = 28, padT = 16, padL = 36;
  const max = Math.max(1, ...items.map(i => Math.max(i.v, i.v2 || 0))) * 1.1;
  const bw = (w - padL) / items.length; const y = v => h - padB - (h - padB - padT) * v / max;
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opt.aria || "กราฟแท่ง")}">`;
  niceTicks(max, 4).forEach(t => { s += `<line class="grid-line" x1="${padL}" x2="${w}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`; });
  items.forEach((it, i) => {
    const x0 = padL + i * bw; const two = it.v2 != null; const inner = Math.min(46, bw * .7); const each = two ? (inner - 2) / 2 : inner;
    const bx = x0 + (bw - inner) / 2;
    s += `<g data-tip="${esc(it.tip || `${it.label}: ${fmt(it.v)}`)}"><rect class="hit" x="${x0}" y="0" width="${bw}" height="${h}"/>`;
    s += `<rect class="bar1" x="${bx}" y="${y(it.v)}" width="${each}" height="${Math.max(0, h - padB - y(it.v))}" rx="2"/>`;
    if (two) s += `<rect class="bar2" x="${bx + each + 2}" y="${y(it.v2)}" width="${each}" height="${Math.max(0, h - padB - y(it.v2))}" rx="2"/>`;
    s += `<text x="${x0 + bw / 2}" y="${h - 10}" text-anchor="middle">${esc(it.label)}</text></g>`;
  });
  return s + "</svg>";
}
function niceTicks(max, n) {
  const raw = max / n; const mag = Math.pow(10, Math.floor(Math.log10(raw))); const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out = []; for (let v = 0; v <= max; v += step) out.push(Math.round(v * 100) / 100); return out;
}
function legend(items) { return `<div class="legend">${items.map(([cls, t]) => `<span><i style="background:var(${cls})"></i>${esc(t)}</span>`).join("")}</div>`; }

/* ---------------- บันทึกไฟล์ (downloads capability / ดูในเครื่อง) ---------------- */
let downloadsNS;
async function getDownloads() {
  if (downloadsNS !== undefined) return downloadsNS;
  try { downloadsNS = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { downloadsNS = null; }
  return downloadsNS;
}
async function saveFile(filename, content) {
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename, data: content }); toast(`บันทึก ${filename} แล้ว`); audit("ส่งออกไฟล์", filename); }
    catch (e) {
      if (e && e.code === "declined") toast("ยกเลิกการบันทึกไฟล์");
      else if (e && e.code === "rate_limited") toast("มีหน้าต่างบันทึกไฟล์เปิดอยู่ ลองอีกครั้งในอีกสักครู่");
      else { copyFallback(content, filename); }
    }
    return;
  }
  if (!window.claude) {      // เปิดในเครื่อง (http.server) — ดาวน์โหลดตรง
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" })); a.download = filename; a.click();
    toast(`ดาวน์โหลด ${filename}`); audit("ส่งออกไฟล์", filename); return;
  }
  copyFallback(content, filename);
}
function copyFallback(content, filename) {
  openModal(`คัดลอกเนื้อหา ${filename}`, `<p class="note">หน้านี้บันทึกไฟล์ลงเครื่องไม่ได้ในมุมมองปัจจุบัน คัดลอกเนื้อหาด้านล่างไปวางในไฟล์แทน</p><textarea id="copy-area" rows="14" readonly>${esc(content)}</textarea><div class="form-foot">${btn("คัดลอก", "copy-area", { kind: "primary" })}</div>`);
}
function csv(rows, cols) {
  const q = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + [cols.map(c => q(c.th)).join(","), ...rows.map(r => cols.map(c => q(c.csv ? c.csv(r) : c.val(r))).join(","))].join("\r\n");
}

/* ---------------- router ---------------- */
const ROUTES = {};    // name -> {render(args), perm, title}
function route(name, def) { ROUTES[name] = def; }
function parseHash() {
  const h = (location.hash || "#home").slice(1);
  const parts = h.split("-"); const name = parts[0];
  return { name: ROUTES[name] ? name : "home", args: parts.slice(1) };
}
function go(hash) { if (location.hash === "#" + hash) render(); else location.hash = "#" + hash; }
function render() {
  const { name, args } = parseHash(); S.page = name; S.args = args;
  const r = ROUTES[name]; const view = $("#view");
  renderNav(); renderPersona();
  if (r.perm && !can(r.perm)) {
    view.innerHTML = pageHead(r.title) + `<div class="note bad"><strong>ไม่มีสิทธิ์เข้าถึงหน้านี้</strong><br>${esc(denyMsg(r.perm))} — ลองสลับบทบาทที่มุมขวาบน</div>`;
    return;
  }
  try { view.innerHTML = r.render(args); }
  catch (e) { console.error(e); view.innerHTML = `<div class="note bad">แสดงหน้านี้ไม่สำเร็จ: ${esc(e.message)}</div>`; }
  if (r.after) r.after(args);
  if (S.scrollTop !== false) window.scrollTo(0, 0);
  S.scrollTop = true;
  document.getElementById("app").removeAttribute("data-side");
}
function rerender() { S.scrollTop = false; const y = window.scrollY; render(); window.scrollTo(0, y); }

const NAV = [
  ["", [["home", "งานของฉัน", null, "tasks"]]],
  ["หลักสูตร", [["programs", "ทะเบียนหลักสูตร", "program.view"], ["approvals", "การอนุมัติหลักสูตร", "approval.view", "cases"], ["amendments", "สมอ.08 ปรับปรุงเล็กน้อย", "amend.submit|amend.approve"], ["cisa", "CISA และการรับรอง", "cisa.view"]]],
  ["ข้อมูลวิชาการ", [["courses", "คลังรายวิชา", "course.view"], ["staff", "อาจารย์และเกณฑ์ 2565", "staff.view"], ["publications", "ผลงานวิชาการ", "publication.own|publication.certify"]]],
  ["ประชุมและติดตาม", [["meetings", "ปฏิทินประชุม", "approval.schedule|approval.resolve|approval.faculty"], ["finance", "ต้นทุนและจุดคุ้มทุน", "finance.view"], ["dashboard", "แดชบอร์ดผู้บริหาร", "report.exec"], ["reports", "เอกสารและรายงาน", "doc.export|report.ops"]]],
  ["ระบบ", [["integration", "ศูนย์เชื่อมโยงข้อมูล", "integ.view"], ["reference", "ข้อมูลอ้างอิงและรหัสเทียบ", "ref.manage"], ["settings", "ค่าตั้งค่าและความพร้อม", "settings.view"], ["users", "ผู้ใช้และสิทธิ์", "users.manage"], ["audit", "บันทึกการใช้งาน", "audit.view"], ["gaps", "ข้อมูลที่ยังขาด", null], ["about", "เกี่ยวกับต้นแบบ", null]]],
];
function canAny(spec) { return !spec || spec.split("|").some(p => can(p)); }
function renderNav() {
  const counts = { tasks: myTasks().length, cases: casesForMe().filter(c => c.status !== "APPROVED").length };
  $("#nav").innerHTML = NAV.map(([g, items]) => {
    const vis = items.filter(i => canAny(i[2])); if (!vis.length) return "";
    return (g ? `<div class="nav-group">${g}</div>` : "") + vis.map(([k, t, , c]) => `<a href="#${k}"${S.page === k || (k === "programs" && ["program", "edit", "newprog"].includes(S.page)) ? ' aria-current="page"' : ""}><span>${t}</span>${c && counts[c] ? `<span class="count">${counts[c]}</span>` : ""}</a>`).join("");
  }).join("");
}
function renderPersona() { const u = me(); $("#persona-role").textContent = `${u.role} · ${roleOf().th}`; $("#persona-name").textContent = u.name; }

/* ---------------- event delegation ---------------- */
const ACTIONS = {}; const FORMS = {}; const CHANGES = {};
function act(name, fn) { ACTIONS[name] = fn; }
function form(name, fn) { FORMS[name] = fn; }
function onChange(name, fn) { CHANGES[name] = fn; }
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.getAttribute("aria-disabled") === "true") { e.preventDefault(); toast(el.title || "ทำรายการนี้ไม่ได้"); return; }
  const fn = ACTIONS[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-form]"); if (!f) return;
  e.preventDefault(); const fn = FORMS[f.dataset.form]; if (fn) fn(formData(f), f);
});
document.addEventListener("change", e => {
  const el = e.target.closest("[data-change]"); if (!el) return;
  const fn = CHANGES[el.dataset.change]; if (fn) fn(el, e);
});
document.addEventListener("input", e => {
  const el = e.target.closest("[data-input]"); if (!el) return;
  const fn = CHANGES[el.dataset.input]; if (fn) { clearTimeout(el._t); el._t = setTimeout(() => fn(el, e), 220); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
// tooltip ของกราฟ
document.addEventListener("mousemove", e => {
  const g = e.target.closest && e.target.closest("[data-tip]"); let tip = $(".tip");
  if (!g) { if (tip) tip.remove(); return; }
  if (!tip) { tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip); }
  tip.textContent = g.dataset.tip; tip.style.left = Math.min(e.clientX + 12, innerWidth - 270) + "px"; tip.style.top = e.clientY + 14 + "px";
});

act("close-modal", closeModal);
act("toggle-side", () => { const a = $("#app"); a.dataset.side = a.dataset.side === "open" ? "" : "open"; });
act("reset-data", () => openModal("รีเซ็ตข้อมูลจำลอง", `<p>ล้างทุกการแก้ไขที่ทำในต้นแบบนี้ (เก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น) และโหลดข้อมูลจากไฟล์ JSON ใหม่</p><div class="form-foot">${btn("ยกเลิก", "close-modal")}${btn("รีเซ็ต", "reset-confirm", { kind: "danger" })}</div>`));
act("reset-confirm", resetData);
act("page", el => { S.ui["pg-" + el.dataset.key] = Number(el.dataset.to); rerender(); });
act("go", el => go(el.dataset.to));
act("copy-area", () => {
  const ta = $("#copy-area"); const done = () => toast("คัดลอกแล้ว");
  try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast("เลือกข้อความแล้ว กด Ctrl+C เพื่อคัดลอก"); }); } catch (e) { ta.select(); }
});
