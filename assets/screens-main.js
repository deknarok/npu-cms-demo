/* screens-main.js — S01 งานของฉัน · S02 ทะเบียนหลักสูตร · ค้นหา · ข้อมูลที่ยังขาด · เกี่ยวกับต้นแบบ */
"use strict";

/* ---------------- S01 งานของฉัน ---------------- */
route("home", { title: "งานของฉัน", render() {
  const u = me(); const tasks = myTasks(); const progs = D.programs.filter(inScope);
  const active = progs.filter(p => p.life === "ACTIVE"); const cases = casesForMe().filter(c => !["APPROVED", "REJECTED"].includes(c.status));
  const due = active.filter(reviewDue); const req = D.settings.settings.filter(s => s.status !== "CONFIRMED").length;
  const upcoming = D.workflow.meetings.filter(m => m.status === "SCHEDULED").slice(0, 6);
  const sevOrder = { bad: 0, warn: 1, info: 2 };
  const myAudit = D.integ.audit.filter(a => a.user === S.user).slice(0, 6);
  return pageHead(`สวัสดี ${u.name}`, { lead: `${esc(roleOf().th)} · ขอบเขต: ${esc(scopeText())} · วันที่ ${thDate(today(), true)}`,
      actions: (can("program.create") ? btn("สร้างหลักสูตร/ฉบับปรับปรุง", "go", { kind: "primary", data: { to: "newprog" } }) : "") + btn("สลับบทบาท", "switch-user") }) +
    `<div class="grid g4">
      <div class="panel stat"><span class="label">หลักสูตรในขอบเขต</span><span class="value">${fmt(progs.length)}</span><span class="sub">เปิดรับ ${fmt(active.length)}</span></div>
      <div class="panel stat"><span class="label">เรื่องอยู่ระหว่างอนุมัติ</span><span class="value">${fmt(cases.length)}</span><span class="sub">ร่าง ${cases.filter(c => c.status === "DRAFT").length} · ส่งกลับ ${cases.filter(c => c.status === "RETURNED").length}</span></div>
      <div class="panel stat"><span class="label">ครบรอบปรับปรุงภายใน 1 ปี</span><span class="value">${fmt(due.length)}</span><span class="sub">ตามปีหลักสูตร + 5</span></div>
      <div class="panel stat"><span class="label">ค่าตั้งค่าที่ยังไม่ยืนยัน</span><span class="value">${fmt(req)}</span><span class="sub">จาก ${D.settings.settings.length} รายการ</span></div>
    </div>
    <div class="grid g-side">
      ${panel(`งานที่ต้องทำ (${tasks.length})`, tasks.length ? `<ul class="list">${tasks.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]).slice(0, 40).map(t => `<li><div class="grow">${pill(t.kind, t.sev)} <a href="#${t.link}">${esc(t.text)}</a></div></li>`).join("")}</ul>` : `<div class="empty">ไม่มีงานค้างสำหรับบทบาทนี้</div>`, { flush: true })}
      <div class="grid">
        ${panel("ประชุมที่กำลังจะมาถึง", `<ul class="list">${upcoming.map(m => `<li><div class="grow"><strong>${esc(BODY_TH(m.body))}</strong> ครั้งที่ ${esc(m.no)}<br><span class="muted small">${thDate(m.date, true)} · ปิดรับวาระ ${thDate(m.deadline)}</span></div>${can("approval.view") ? `<a class="btn sm" href="#meeting-${m.id}">ดู</a>` : ""}</li>`).join("")}</ul>`, { flush: true })}
        ${panel("กิจกรรมล่าสุดของฉัน", myAudit.length ? `<ul class="list">${myAudit.map(a => `<li><div class="grow">${esc(a.action)} · ${esc(a.target)}<br><span class="muted small">${thDateTime(a.at)}</span></div></li>`).join("")}</ul>` : `<div class="empty">ยังไม่มีกิจกรรม</div>`, { flush: true })}
      </div>
    </div>
    <div class="note info">ต้นแบบนี้ใช้หลักสูตรและรายวิชา<b>จริง</b>จากระบบทะเบียน และอัตราค่าธรรมเนียมจริงจาก ERP ส่วนบุคลากร มติ สถานะ และสถิติเป็น<b>ข้อมูลจำลอง</b> ข้อมูลที่ยังขาด ${D.gaps.length} รายการดูได้ที่ <a href="#gaps">ข้อมูลที่ยังขาด</a> · ทุกการแก้ไขเก็บในเบราว์เซอร์ของคุณเท่านั้น</div>`;
} });

/* ---------------- สลับบทบาท ---------------- */
act("switch-user", () => {
  openModal("สลับบทบาทผู้ใช้ (จำลองการเข้าระบบด้วย SSO)", `<p class="muted">เลือกผู้ใช้เพื่อดูเมนู สิทธิ์ และงานค้างตามบทบาท บทบาท R6/R3 ได้จากตำแหน่งบริหารใน ERP-HR อัตโนมัติ (D10)</p>
    <div class="persona-list">${D.security.users.map(u => { const r = D.security.roles.find(x => x.code === u.role);
      return `<button type="button" class="persona-opt" data-act="pick-user" data-id="${u.id}" aria-pressed="${u.id === S.user}"><b>${u.role} · ${esc(r.th)}</b><span>${esc(u.name)}</span><span class="muted small">${esc(u.unit)} · สิทธิ์ ${r.perms.length} รายการ</span></button>`; }).join("")}</div>`, { wide: true });
});
act("pick-user", el => { S.user = el.dataset.id; persist(); closeModal(); toast(`เข้าใช้งานเป็น ${me().name}`); go("home"); });

/* ---------------- S02 ทะเบียนหลักสูตร ---------------- */
function progRows() {
  const f = S.filters.prog || {}; const q = (f.q || "").trim();
  return D.programs.filter(inScope).filter(p =>
    (!f.fac || p.fac === f.fac) && (!f.level || p.level === f.level) && (!f.life || p.life === f.life) &&
    (!f.flag || (f.flag === "due" && reviewDue(p)) || (f.flag === "low" && lowIntake(p)) || (f.flag === "case" && openCaseOf(p)) || (f.flag === "std" && p.life === "ACTIVE" && !standardsCheck(p).ok)) &&
    (!q || p.name.includes(q) || p.degree.includes(q) || p.code.includes(q) || p.versions.some(v => v.plans.some(x => (x.regId || "").includes(q)))));
}
route("programs", { perm: "program.view", title: "ทะเบียนหลักสูตร", render() {
  const f = S.filters.prog || {}; const rows = progRows(); const pg = paged("prog", rows, 25);
  const facOpts = D.meta.faculties.filter(x => D.programs.some(p => p.fac === x.id && inScope(p))).map(x => [x.id, x.name]);
  const cols = [
    { th: "รหัส", html: p => `<span class="mono">${p.code}</span>` },
    { th: "หลักสูตร", wrap: true, html: p => `<a href="#program-${p.id}"><strong>${esc(p.name)}</strong></a><br><span class="muted small">${esc(p.degree)} · ${esc(IDX.fac.get(p.fac).name)}</span>` },
    { th: "ระดับ", val: p => levelAbbr(p.level) },
    { th: "ฉบับล่าสุด", html: p => `พ.ศ. ${p.latestYear}<br><span class="muted small">${latestVer(p).credits} นก. · ${p.versions.length} ฉบับ</span>` },
    { th: "สถานะ", html: p => pill(...lifeStatus(p)) + (reviewDue(p) && p.life === "ACTIVE" ? " " + pill("ครบรอบ " + p.nextReview, "warn") : "") + (lowIntake(p) ? " " + pill("นศ.น้อย", "bad") : "") },
    { th: "เรื่องที่เปิดอยู่", html: p => { const c = openCaseOf(p); return c ? `<a href="#case-${c.id}">${esc(caseStageText(c))}</a>` : `<span class="muted">—</span>`; } },
    { th: "CISA", html: p => { const c = cisaOf(p); if (!c) return `<span class="muted small">${IDX.level.get(p.level).channel === "NONE" ? "ไม่ส่ง CISA" : "—"}</span>`; return c.step >= 12 ? pill("รับทราบแล้ว", "good") : pill(`ขั้น ${c.step}/12`, c.returned ? "bad" : "info"); } },
    { th: "ที่มา", html: p => srcPill(!p.simulated) },
  ];
  return pageHead("ทะเบียนหลักสูตร", { lead: `หลักสูตรจากระบบทะเบียน มนพ. (program_info) จัดกลุ่มเป็น ${fmt(D.programs.length)} หลักสูตร ${fmt(D.programs.reduce((a, p) => a + p.versions.length, 0))} ฉบับ — สถานะวงจรชีวิต การอนุมัติ และ CISA เป็นข้อมูลจำลอง`,
      actions: btn("ส่งออก CSV", "open-doc", { data: { code: "EXP-PROGRAMS" }, perm: "program.view" }) + (can("program.create") ? btn("สร้างหลักสูตรใหม่/ฉบับปรับปรุง", "go", { kind: "primary", data: { to: "newprog" } }) : "") }) +
    `<section class="panel"><header><form class="filters" data-form="prog-filter" style="width:100%">
      <div style="flex:2 1 220px;min-width:0">${field("q", "ค้นหา", { value: f.q, placeholder: "ชื่อสาขา ปริญญา รหัส CMS หรือรหัสทะเบียน" })}</div>
      ${field("fac", "คณะ/วิทยาลัย", { type: "select", options: facOpts, value: f.fac })}
      ${field("level", "ระดับ", { type: "select", options: D.meta.levels.map(l => [l.code, l.abbr]), value: f.level })}
      ${field("life", "สถานะ", { type: "select", options: Object.entries(LIFE).map(([k, v]) => [k, v[0]]), value: f.life })}
      ${field("flag", "ต้องติดตาม", { type: "select", options: [["due", "ครบรอบปรับปรุง ≤ 1 ปี"], ["low", "นักศึกษาน้อย 3 ปี"], ["case", "มีเรื่องอยู่ระหว่างอนุมัติ"], ["std", "อาจารย์ไม่ผ่านเกณฑ์"]], value: f.flag })}
      <div class="actions"><button class="btn primary" type="submit">กรอง</button>${btn("ล้าง", "prog-clear")}</div></form></header>
      <div class="body flush">${table(cols, pg.rows, { empty: "ไม่พบหลักสูตรตามเงื่อนไข" })}${pg.pager}</div></section>`;
} });
form("prog-filter", d => { S.filters.prog = d; S.ui["pg-prog"] = 1; rerender(); });
act("prog-clear", () => { S.filters.prog = {}; S.ui["pg-prog"] = 1; rerender(); });

/* ---------------- ค้นหาทั่วระบบ ---------------- */
form("global-search", d => { S.filters.search = d.q; go("search"); });
route("search", { title: "ผลการค้นหา", render() {
  const q = (S.filters.search || "").trim(); if (!q) return pageHead("ผลการค้นหา") + `<div class="empty">พิมพ์คำค้นในช่องด้านบน</div>`;
  const ps = D.programs.filter(inScope).filter(p => p.name.includes(q) || p.degree.includes(q) || p.code.includes(q)).slice(0, 30);
  const cs = can("course.view") ? [...IDX.course.values()].filter(c => c.code.includes(q) || c.th.includes(q) || (c.en || "").toLowerCase().includes(q.toLowerCase())).slice(0, 30) : [];
  const ss = can("staff.view") ? D.staffData.staff.filter(s => (s.fn + " " + s.ln).includes(q)).slice(0, 20) : [];
  return pageHead(`ผลการค้นหา “${q}”`, { lead: `หลักสูตร ${ps.length} · รายวิชา ${cs.length} · อาจารย์ ${ss.length}` }) +
    panel("หลักสูตร", table([{ th: "หลักสูตร", html: p => `<a href="#program-${p.id}">${esc(progTitle(p))}</a>` }, { th: "คณะ", val: p => IDX.fac.get(p.fac).name }, { th: "สถานะ", html: p => pillOf(LIFE, p.life) }], ps), { flush: true }) +
    (can("course.view") ? panel("รายวิชา", table([{ th: "รหัส", html: c => `<span class="mono">${esc(c.code)}</span>` }, { th: "ชื่อวิชา", html: c => `<a href="#" data-act="course-open" data-id="${esc(c.code)}">${esc(c.th)}</a><br><span class="muted small">${esc(c.en)}</span>` }, { th: "หน่วยกิต", val: c => c.cr }], cs), { flush: true }) : "") +
    (can("staff.view") ? panel("อาจารย์", table([{ th: "ชื่อ", html: s => `<a href="#" data-act="staff-open" data-id="${s.id}">${esc(staffName(s.id))}</a>` }, { th: "สังกัด", val: s => IDX.fac.get(s.fac).name }], ss), { flush: true }) : "");
} });

/* ---------------- ข้อมูลที่ยังขาด ---------------- */
route("gaps", { title: "ข้อมูลที่ยังขาด", render() {
  const pr = { HIGH: ["สูง", "bad"], MEDIUM: ["กลาง", "warn"], LOW: ["ต่ำ", "neutral"], DONE: ["ปิดแล้ว", "good"] };
  return pageHead("ข้อมูลที่ยังขาด", { lead: `ส่วนที่ต้นแบบใช้ข้อมูลแทนชั่วคราว และแสดงป้าย <span class="tag">[รอข้อมูล Gxx]</span> ในหน้าจอ/เอกสาร — เมื่อได้ข้อมูลจริงจะนำเข้าแทนโดยไม่ต้องแก้โครงสร้างระบบ · ไฟล์ <span class="mono">data/data-gaps.json</span> และ <span class="mono">design/13-data-gaps.md</span>` }) +
    panel(`${D.gaps.length} รายการ`, table([
      { th: "รหัส", html: g => `<span class="mono">${g.code}</span>` }, { th: "ลำดับ", html: g => pillOf(pr, g.priority) },
      { th: "ข้อมูลที่ต้องการ", wrap: true, val: g => g.need }, { th: "กระทบส่วนใด", wrap: true, val: g => g.affects },
      { th: "ต้นแบบใช้แทนชั่วคราว", wrap: true, val: g => g.fallback }, { th: "ขอจาก", val: g => g.owner }, { th: "ประเด็นค้าง", val: g => g.parking || "—" }], D.gaps), { flush: true });
} });

/* ---------------- เกี่ยวกับต้นแบบ ---------------- */
route("about", { title: "เกี่ยวกับต้นแบบ", render() {
  const files = DATA_FILES.map(([k, url, th]) => ({ url, th, n: Array.isArray(D[k]) ? D[k].length : Object.keys(D[k] || {}).length }));
  const screens = [["S01", "งานของฉัน", "home"], ["S02", "ทะเบียนหลักสูตร", "programs"], ["S03", "หน้าหลักสูตร (แท็บ)", "program-" + D.programs.find(p => p.showcase === "EN").id], ["S04", "ตัวแก้ไขฉบับ (wizard มคอ.2)", "edit-" + latestVer(D.programs.find(p => p.showcase === "EN")).id],
    ["S05", "โครงสร้างหลักสูตร", `program-${D.programs.find(p => p.showcase === "IT").id}-structure`], ["S06", "แผนการเรียน", `program-${D.programs.find(p => p.showcase === "IT").id}-plan`], ["S07", "คลังรายวิชา", "courses"], ["S08/S09", "OBE: VOS PLO YLO mapping", `program-${D.programs.find(p => p.showcase === "IT").id}-obe`],
    ["S10", "อาจารย์และเกณฑ์ 2565", "staff"], ["S11", "ผลงานวิชาการ", "publications"], ["S12", "ต้นทุน/จุดคุ้มทุน", "finance"], ["S13", "การอนุมัติ", "approvals"], ["S14", "ปฏิทินประชุม", "meetings"], ["S15", "CISA", "cisa"], ["S16", "สมอ.08", "amendments"],
    ["S17", "แดชบอร์ดผู้บริหาร", "dashboard"], ["S18", "ศูนย์เชื่อมโยง", "integration"], ["S19", "ข้อมูลอ้างอิง", "reference"], ["S20", "ค่าตั้งค่า", "settings"], ["S21", "ผู้ใช้และสิทธิ์", "users"], ["—", "เอกสารและรายงาน", "reports"], ["—", "ข้อมูลที่ยังขาด", "gaps"]];
  return pageHead("เกี่ยวกับต้นแบบ", { lead: "ต้นแบบระบบบริหารจัดการหลักสูตร (CMS) มหาวิทยาลัยนครพนม ตามเอกสารออกแบบใน design/01–13 — หน้าเว็บ HTML ที่โหลดข้อมูลจากไฟล์ JSON" }) +
    `<div class="grid g2">${panel("แหล่งข้อมูล", `<p><b>ข้อมูลจริง</b></p><ul>${D.meta.sources.real.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p><b>ข้อมูลจำลอง</b></p><ul>${D.meta.sources.simulated.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`)}
    ${panel("ไฟล์ข้อมูล JSON", table([{ th: "ไฟล์", html: f => `<span class="mono">${f.url}</span>` }, { th: "เนื้อหา", val: f => f.th }, { th: "รายการ", num: true, val: f => fmt(f.n) }], files), { flush: true })}</div>` +
    panel("หน้าจอตามเอกสารออกแบบ (04-use-cases-screens)", `<div class="table-wrap"><table class="t"><thead><tr><th>รหัส</th><th>หน้าจอ</th><th>เปิด</th></tr></thead><tbody>${screens.map(([c, t, h]) => `<tr><td class="mono">${c}</td><td>${t}</td><td><a href="#${h}">#${h}</a></td></tr>`).join("")}</tbody></table></div>`, { flush: true }) +
    `<div class="note">ดูในเครื่อง: <span class="mono">cd prototype && python3 -m http.server 8000</span> แล้วเปิด http://localhost:8000 · สร้างข้อมูลใหม่: <span class="mono">python3 cms-work/scripts/build_prototype.py</span></div>`;
} });
