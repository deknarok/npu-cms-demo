/* screens-admin.js — S17 แดชบอร์ด · เอกสารและรายงาน · S18 ศูนย์เชื่อมโยง · S19 ข้อมูลอ้างอิง · S20 ค่าตั้งค่า · S21 ผู้ใช้และสิทธิ์ · audit */
"use strict";

/* ---------------- S17 แดชบอร์ดผู้บริหาร ---------------- */
route("dashboard", { perm: "report.exec", title: "แดชบอร์ดผู้บริหาร", render() {
  const ps = D.programs.filter(inScope).filter(p => p.life !== "DRAFT"); const act = ps.filter(p => p.life === "ACTIVE");
  const low = ps.filter(lowIntake); const due = act.filter(reviewDue); const stdFail = act.filter(p => !standardsCheck(p).ok);
  const cisaRun = D.workflow.cisa.filter(c => c.step < 12 && inScope(IDX.prog.get(c.prog)));
  const byFac = D.meta.faculties.map(f => { const list = act.filter(p => p.fac === f.id); return { label: f.name.replace("คณะ", "").replace("วิทยาลัย", "วิทยาลัย"), v: list.reduce((a, p) => a + ((stat(p) || { intake: [0, 0, 0] }).intake[2]), 0), v2: list.reduce((a, p) => a + ((stat(p) || { plan: 0 }).plan), 0), n: list.length }; }).filter(x => x.n).sort((a, b) => b.v - a.v);
  const byLevel = D.meta.levels.map(l => ({ label: l.abbr, v: act.filter(p => p.level === l.code).length })).filter(x => x.v);
  const dueYears = [2569, 2570, 2571, 2572, 2573].map(y => ({ label: String(y), v: act.filter(p => p.nextReview === y).length }));
  return pageHead("แดชบอร์ดผู้บริหาร", { lead: `ข้อมูล ณ ${thDate(today(), true)} · ${scopeText()} · หลักสูตรและปีหลักสูตรจริงจากทะเบียน สถิตินักศึกษาเป็นข้อมูลจำลอง ${gapPill("G13")}`, actions: btn("รายงานหลักสูตรนักศึกษาน้อย", "open-doc", { data: { code: "RPT-LOWINTAKE" } }) + btn("รายงานครบรอบปรับปรุง", "open-doc", { data: { code: "RPT-REVIEWDUE" } }) }) +
    `<div class="grid g4">
      <div class="panel stat"><span class="label">หลักสูตรเปิดรับ</span><span class="value">${fmt(act.length)}</span><span class="sub">จากทั้งหมด ${fmt(ps.length)} · งดรับ ${ps.filter(p => p.life === "ADMISSION_SUSPENDED").length}</span></div>
      <div class="panel stat"><span class="label">นักศึกษาน้อย 3 ปีต่อเนื่อง</span><span class="value">${fmt(low.length)}</span><span class="sub">ตามมติสภา 8/2568</span></div>
      <div class="panel stat"><span class="label">อาจารย์ไม่ผ่านเกณฑ์ 2565</span><span class="value">${fmt(stdFail.length)}</span><span class="sub">หลักสูตร</span></div>
      <div class="panel stat"><span class="label">อยู่ใน CISA</span><span class="value">${fmt(cisaRun.length)}</span><span class="sub">เหลือ &lt; 30 วัน ${cisaRun.filter(c => { const s = cisaSla(c); return s && s.left != null && s.left < 30; }).length}</span></div></div>
    <div class="grid g2">${panel("รับนักศึกษาปีการศึกษา 2569 เทียบแผนรับ รายคณะ", barChart(byFac.map(x => ({ label: x.label, v: x.v, v2: x.v2, valueLabel: `${fmt(x.v)} / ${fmt(x.v2)}`, tip: `${x.label}: รับจริง ${fmt(x.v)} · แผน ${fmt(x.v2)} · ${x.n} หลักสูตร` })), { aria: "รับนักศึกษาเทียบแผนรายคณะ", rowH: 28 }) + legend([["--series-1", "รับจริง 2569"], ["--series-2", "แผนรับ"]]))}
    <div class="grid">${panel("หลักสูตรเปิดรับจำแนกตามระดับ", barChart(byLevel.map(x => ({ label: x.label, v: x.v, tip: `${x.label}: ${x.v} หลักสูตร` })), { padL: 110, aria: "จำนวนหลักสูตรตามระดับ" }))}
    ${panel("ครบรอบปรับปรุงรายปี (พ.ศ.)", colChart(dueYears.map(x => ({ label: x.label, v: x.v, tip: `ครบรอบปี ${x.label}: ${x.v} หลักสูตร` })), { aria: "ครบรอบปรับปรุงรายปี" }))}</div></div>
    <div class="grid g2">${panel(`นักศึกษาน้อย 3 ปี (${low.length})`, table([{ th: "หลักสูตร", html: p => `<a href="#program-${p.id}">${esc(progTitle(p, true))}</a><br><span class="muted small">${esc(IDX.fac.get(p.fac).name)}</span>` }, { th: "2567/68/69", val: p => stat(p).intake.join(" / ") }, { th: "สถานะ", html: p => pillOf(LIFE, p.life) }], low.slice(0, 15)), { flush: true })}
    ${panel(`ครบรอบปรับปรุงภายใน 1 ปี (${due.length})`, table([{ th: "หลักสูตร", html: p => `<a href="#program-${p.id}">${esc(progTitle(p, true))}</a>` }, { th: "ครบรอบ", val: p => p.nextReview }, { th: "เรื่องที่เปิด", html: p => { const c = openCaseOf(p); return c ? esc(caseStageText(c)) : pill("ยังไม่เริ่ม", "warn"); } }], due.slice(0, 15)), { flush: true })}</div>`;
} });

/* ---------------- เอกสารและรายงาน ---------------- */
route("reports", { perm: null, title: "เอกสารและรายงาน", render() {
  const list = D.documents.filter(d => can(d.perm)); const progs = D.programs.filter(inScope).filter(p => p.life !== "CLOSING");
  const showcase = D.programs.filter(p => p.showcase && inScope(p));
  const def = (showcase[0] || progs[0] || {}).id;
  const sel = S.ui.repProg || def;
  const opts = progs.map(p => [p.id, progTitle(p, true) + (p.showcase ? " ★" : "")]);
  return pageHead("เอกสารและรายงาน", { lead: `เอกสารพิมพ์ (A4, ฟอนต์ Sarabun) บันทึกเป็น HTML เพื่อเปิดพิมพ์/แปลง PDF · ไฟล์ข้อมูลเป็น CSV (UTF-8 BOM เปิดด้วย Excel ได้) · เอกสารที่ค่าตั้งค่ายังไม่ยืนยันจะมีลายน้ำ “ร่าง” · ★ = หลักสูตรตัวอย่างที่มีข้อมูลครบ` }) +
    `<section class="panel"><header><h2>เลือกหลักสูตรสำหรับเอกสารรายหลักสูตร</h2></header><div class="body"><div class="filters">${field("repProg", "หลักสูตร", { type: "select", options: opts, value: sel, blank: false }).replace("<select ", '<select data-change="rep-prog" ')}</div></div></section>` +
    panel("เอกสาร/รายงานที่บทบาทนี้ออกได้", `<ul class="list">${list.map(d => {
      let action;
      if (d.scope === "program") action = btn("เปิด", "open-doc", { data: { code: d.code, id: sel } });
      else if (d.scope === "course") action = `<span class="actions">${Object.keys(D.tqf).map(c => btn(c, "open-doc", { sm: true, data: { code: d.code, id: c } })).join("")}</span>`;
      else if (d.scope === "case") action = `<a class="btn" href="#approvals">เลือกจากเรื่องเสนอ</a>`;
      else if (d.scope === "meeting") action = `<a class="btn" href="#meetings">เลือกจากการประชุม</a>`;
      else if (d.scope === "amend") action = `<a class="btn" href="#amendments">เลือกจาก สมอ.08</a>`;
      else action = btn("เปิด", "open-doc", { data: { code: d.code } });
      return `<li><div class="grow"><b>${esc(d.th)}</b><br><span class="muted small"><span class="mono">${d.code}</span> · ${d.fmt.map(x => x.toUpperCase()).join(" + ")} · ${esc(d.uc)} · ${d.scope === "program" ? "รายหลักสูตร" : d.scope === "course" ? "รายวิชา (ตัวอย่าง 3 วิชา)" : d.scope === "university" ? "ทั้งมหาวิทยาลัย" : "รายเรื่อง"}</span></div>${action}</li>`; }).join("")}</ul>`, { flush: true }) +
    (D.documents.length > list.length ? `<div class="note">อีก ${D.documents.length - list.length} เอกสารต้องใช้สิทธิ์ที่บทบาท ${roleOf().code} ไม่มี</div>` : "");
} });
onChange("rep-prog", el => { S.ui.repProg = Number(el.value); rerender(); });

/* ---------------- S18 ศูนย์เชื่อมโยง ---------------- */
route("integration", { perm: "integ.view", title: "ศูนย์เชื่อมโยงข้อมูล", render(args) {
  const tab = args[0] || "clients"; const tabs = [["clients", "API client"], ["webhooks", "Webhook"], ["imports", "นำเข้า"], ["recon", "กระทบยอด"], ["ds2004", "DS2004"]];
  const ed = can("integ.manage");
  let body = "";
  if (tab === "clients") body = panel("API client (OAuth2 client credentials)", table([{ th: "ระบบ", val: c => c.name }, { th: "scope", html: c => c.scopes.map(s => `<span class="tag">${s}</span>`).join(" ") }, { th: "สถานะ", html: c => c.status === "ACTIVE" ? pill("ใช้งาน", "good") : pill("รอผู้ขาย", "warn") }, { th: "เรียกล่าสุด", val: c => c.last ? thDateTime(c.last) : "—" }, { th: "", html: c => ed ? btn(c.status === "ACTIVE" ? "ระงับ" : "เปิดใช้", "client-toggle", { sm: true, data: { id: c.id } }) : "" }], D.integ.clients), { flush: true }) + `<div class="note">สัญญา API อยู่ใน design/openapi.yaml (17 path · 7 webhook) · ERP-HR/ERP งบ รอผู้ขาย (P19/P22)</div>`;
  if (tab === "webhooks") { const pg = paged("wh", D.integ.deliveries, 20); body = panel("การส่ง webhook (outbox)", table([{ th: "เวลา", val: x => thDateTime(x.at) }, { th: "event", html: x => `<span class="tag">${x.event}</span>` }, { th: "ปลายทาง", val: x => (D.integ.clients.find(c => c.id === x.client) || {}).name }, { th: "HTTP", num: true, val: x => x.code }, { th: "ครั้งที่ส่ง", num: true, val: x => x.attempts }, { th: "สถานะ", html: x => pill(x.status, x.status === "DELIVERED" ? "good" : x.status === "FAILED" ? "bad" : "warn") }, { th: "", html: x => x.status !== "DELIVERED" && ed ? btn("ส่งซ้ำ", "wh-retry", { sm: true, data: { id: x.id } }) : "" }], pg.rows) + pg.pager, { flush: true }); }
  if (tab === "imports") body = panel("ประวัติการนำเข้า", table([{ th: "เวลา", val: x => thDateTime(x.at) }, { th: "แหล่ง", html: x => `<span class="tag">${x.source}</span>` }, { th: "แถว", num: true, val: x => fmt(x.rows) }, { th: "สถานะ", html: x => pill(x.status, x.status === "SUCCESS" ? "good" : "warn") }, { th: "หมายเหตุ", wrap: true, val: x => x.note }], D.integ.imports.slice(0, 60)), { flush: true, actions: ed ? btn("นำเข้าหน่วยงานจาก ERP ตอนนี้", "import-now", { sm: true, data: { src: "ERP_ORG" } }) + btn("นำเข้าผู้สอนรายภาค", "import-now", { sm: true, data: { src: "REG_TEACHING" } }) : "" });
  if (tab === "recon") { const f = S.ui.reconType || ""; const rows = D.integ.reconciliation.filter(x => !f || x.type === f); const pg = paged("recon", rows, 25); const types = [...new Set(D.integ.reconciliation.map(x => x.type))];
    body = `<div class="filters">${field("rt", "ประเภท", { type: "select", options: types, value: f }).replace("<select ", '<select data-change="recon-type" ')}</div>` + panel(`ปัญหากระทบยอด (${rows.filter(x => x.status === "OPEN").length} เปิดอยู่)`, table([{ th: "#", num: true, val: x => x.id }, { th: "ประเภท", html: x => `<span class="tag">${x.type}</span>` }, { th: "ระดับ", html: x => pill(x.severity, x.severity === "HIGH" ? "bad" : "warn") }, { th: "รายละเอียด", wrap: true, val: x => x.msg }, { th: "สถานะ", html: x => pill(x.status === "OPEN" ? "เปิด" : "แก้แล้ว", x.status === "OPEN" ? "warn" : "good") }, { th: "", html: x => x.status === "OPEN" && (ed || can("ref.manage")) ? btn("ปิดเรื่อง", "recon-close", { sm: true, data: { id: x.id } }) : "" }], pg.rows) + pg.pager, { flush: true }); }
  if (tab === "ds2004") { const rows = ds2004Rows(); body = `<div class="note warn">ส่งได้เฉพาะไฟล์ทดสอบ — ยังไม่มี REF_CURR/UNIV_ID จาก สป.อว. (P05) · ERP-HR เป็นผู้ส่งออกจริง (D2)</div>` + panel(`ชุดตั้งต้น DS2004 ภาค 2/2569 (${fmt(rows.length)} แถว)`, table([{ th: "STAFF_ID", html: r => `<span class="mono">${r.staff}</span>` }, { th: "FAC", val: r => r.fac }, { th: "CURR_ID", html: r => r.curr ? `<span class="mono">${r.curr}</span>` : pill("ไม่มี", "bad") }, { th: "TEACH_TYPE", val: r => r.tt }, { th: "หลักสูตร", val: r => r.prog }], rows.slice(0, 40)), { flush: true, actions: btn("ส่งออก CSV", "open-doc", { sm: true, data: { code: "EXP-DS2004" }, perm: "report.ops" }) }); }
  return pageHead("ศูนย์เชื่อมโยงข้อมูล (M8)", { lead: "REST /v1 · webhook จาก outbox · นำเข้า ERP/แพลตฟอร์ม/TQF · DS2004 · ชุด CISA · ETL DW" }) + `<nav class="tabs">${tabs.map(([k, t]) => `<a href="#integration-${k}"${k === tab ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>` + body;
} });
act("client-toggle", el => { const c = D.integ.clients.find(x => x.id === el.dataset.id); c.status = c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"; audit("เปลี่ยนสถานะ API client", c.name); persist(); rerender(); });
act("wh-retry", el => { const x = D.integ.deliveries.find(y => y.id === Number(el.dataset.id)); x.status = "DELIVERED"; x.code = 200; x.attempts++; audit("ส่ง webhook ซ้ำ", x.event); persist(); toast("ส่งซ้ำสำเร็จ"); rerender(); });
act("import-now", el => { D.integ.imports.unshift({ id: Date.now(), source: el.dataset.src, at: today() + "T" + new Date().toTimeString().slice(0, 5), rows: Math.floor(Math.random() * 30), status: "SUCCESS", note: "สั่งนำเข้าด้วยมือ (จำลอง)" }); audit("นำเข้าข้อมูล", el.dataset.src); persist(); toast("นำเข้าเสร็จ"); rerender(); });
act("recon-close", el => { const x = D.integ.reconciliation.find(y => y.id === Number(el.dataset.id)); x.status = "RESOLVED"; audit("ปิดปัญหากระทบยอด", "#" + x.id); persist(); rerender(); });
onChange("recon-type", el => { S.ui.reconType = el.value; S.ui["pg-recon"] = 1; rerender(); });

/* ---------------- S19 ข้อมูลอ้างอิงและรหัสเทียบ ---------------- */
route("reference", { perm: "ref.manage", title: "ข้อมูลอ้างอิงและรหัสเทียบ", render(args) {
  const tab = args[0] || "codemap"; const tabs = [["codemap", "คู่รหัส ERP↔ทะเบียน"], ["orgs", "หน่วยงาน (ERP)"], ["levels", "ระดับการศึกษา"], ["bodies", "คณะกรรมการ/เส้นทาง"], ["standards", "ชุดกฎเกณฑ์ 2565"]];
  let body = "";
  if (tab === "codemap") { const f = S.ui.cmFilter || ""; const rows = D.erp.match.filter(m => !f || m.method === f); const pg = paged("cm", rows, 25); const cnt = k => D.erp.match.filter(m => m.method === k).length;
    body = `<div class="grid g4">${["ERP_MAPPING", "NAME_LEVEL", "UNMATCHED"].map(k => `<div class="panel stat"><span class="label">${{ ERP_MAPPING: "จาก ERP", NAME_LEVEL: "จับจากชื่อ+ระดับ", UNMATCHED: "จับไม่ได้" }[k]}</span><span class="value">${cnt(k)}</span></div>`).join("")}<div class="panel stat"><span class="label">มีหลายตัวเลือก</span><span class="value">${D.erp.match.filter(m => m.n > 1).length}</span></div></div>
      <div class="filters">${field("cmf", "วิธีจับคู่", { type: "select", options: [["ERP_MAPPING", "จาก ERP"], ["NAME_LEVEL", "ชื่อ+ระดับ"], ["UNMATCHED", "จับไม่ได้"]], value: f }).replace("<select ", '<select data-change="cm-filter" ')}</div>` +
      panel("ผลจับคู่จริง (program_code_match_candidates.csv)", table([{ th: "รหัส ERP", html: m => `<span class="mono">${m.org}</span>` }, { th: "หลักสูตรใน ERP", wrap: true, val: m => m.prog }, { th: "ระดับ", val: m => m.lvl }, { th: "วิธี", html: m => pill(m.method, m.method === "UNMATCHED" ? "bad" : m.method === "ERP_MAPPING" ? "good" : "info") }, { th: "รหัสทะเบียนที่เป็นไปได้", wrap: true, html: m => m.reg ? m.reg.split(";").map(r => `<span class="tag">${r}</span>`).join(" ") : "—" }, { th: "ปีหลักสูตร", val: m => m.years }, { th: "", html: m => m.method !== "ERP_MAPPING" ? btn("ยืนยันคู่", "cm-confirm", { sm: true, data: { org: m.org } }) : pill("ยืนยันแล้ว", "good") }], pg.rows) + pg.pager, { flush: true }); }
  if (tab === "orgs") { const f = S.ui.orgType || "FACULTY"; const rows = D.erp.orgs.filter(o => o.type === f); const pg = paged("org", rows, 30);
    body = `<div class="filters">${field("ot", "ประเภท", { type: "select", options: ["UNIVERSITY", "FACULTY", "DEPARTMENT", "PROGRAM"], value: f, blank: false }).replace("<select ", '<select data-change="org-type" ')}</div>` + panel(`หน่วยงานจาก ERP (${rows.length})`, table([{ th: "รหัส", html: o => `<span class="mono">${o.code}</span>` }, { th: "ชื่อ", val: o => o.name }, { th: "สังกัด (RefCode)", html: o => `<span class="mono">${o.parent}</span>` }, { th: "ระดับ", val: o => o.level }, { th: "สถานะ", val: o => o.status }, { th: "ที่มา", html: () => `<span class="pill real">ERP</span>` }], pg.rows) + pg.pager, { flush: true }); }
  if (tab === "levels") body = panel("ระดับการศึกษา", table([{ th: "รหัส", html: l => `<span class="tag">${l.code}</span>` }, { th: "ชื่อ", val: l => l.th }, { th: "ช่องทางรายงาน", html: l => l.channel === "CISA" ? pill("CISA", "info") : pill("ไม่ส่ง (P09)", "warn") }, { th: "ภาคการศึกษา", num: true, val: l => l.terms }, { th: "ชุดกฎ", val: l => l.ruleset || "—" }], D.meta.levels), { flush: true }) + panel("ระดับใน ERP (จริง)", table([{ th: "LevelId", val: l => l.LevelId }, { th: "ชื่อ", val: l => l.LevelName }, { th: "ย่อ", val: l => l.LevelAbb }], D.meta.levelsErp), { flush: true });
  if (tab === "bodies") body = panel("คณะกรรมการ", table([{ th: "รหัส", html: b => `<span class="tag">${b.code}</span>` }, { th: "ชื่อ", val: b => b.th }, { th: "กฎปฏิทิน", val: b => b.rule }], D.meta.bodies), { flush: true }) + panel("เส้นทางอนุมัติ (ตั้งค่าได้ · PROVISIONAL P08)", table([{ th: "ประเภทเรื่อง", html: ([k]) => `<span class="tag">${k}</span>` }, { th: "ลำดับขั้น", wrap: true, val: ([, v]) => v.map(BODY_TH).join(" → ") }], Object.entries(D.meta.routes)), { flush: true });
  if (tab === "standards") body = D.settings.standards.map(s => panel(`ชุดกฎ ${s.set}`, table([{ th: "ข้อ", num: true, val: r => r.no }, { th: "เกณฑ์", wrap: true, val: r => r.th }, { th: "ชนิด", html: r => `<span class="tag">${r.type}</span>` }, { th: "พารามิเตอร์", val: r => [r.min != null ? "min=" + r.min : "", r.deg ? "deg=" + r.deg : "", r.orPos ? "orPos=" + r.orPos : "", r.years ? "years=" + r.years : ""].filter(Boolean).join(" · ") }], s.rules), { flush: true })).join("") + `<div class="note">กฎเป็นข้อมูล แก้ได้โดยไม่แก้โค้ด (02 หลักการข้อ 7) · การตีความภายในรอยืนยัน (P15)</div>`;
  return pageHead("ข้อมูลอ้างอิงและรหัสเทียบ (M1)", { lead: "หน่วยงานเป็นของ ERP (D4) · คู่รหัส ERP↔ทะเบียน↔CHECO ใน code_map · ตาราง REF สป.อว. รอหนังสือ (P05)" }) + `<nav class="tabs">${tabs.map(([k, t]) => `<a href="#reference-${k}"${k === tab ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>` + body;
} });
onChange("cm-filter", el => { S.ui.cmFilter = el.value; S.ui["pg-cm"] = 1; rerender(); });
onChange("org-type", el => { S.ui.orgType = el.value; S.ui["pg-org"] = 1; rerender(); });
act("cm-confirm", el => { const m = D.erp.match.find(x => x.org === el.dataset.org); m.method = "ERP_MAPPING"; audit("ยืนยันคู่รหัส", m.org + " " + m.prog); persist(); toast("ยืนยันคู่รหัสแล้ว — ส่งต่อให้ ERP ผ่าน code_map"); rerender(); });

/* ---------------- S20 ค่าตั้งค่าและความพร้อม ---------------- */
route("settings", { perm: "settings.view", title: "ค่าตั้งค่าและความพร้อมของข้อมูล", render() {
  const all = D.settings.settings; const cnt = k => all.filter(s => s.status === k).length; const ed = can("settings.edit");
  const secs = [...new Set(all.map(s => s.section))];
  return pageHead("ค่าตั้งค่าและความพร้อมของข้อมูล (S20)", { lead: "ข้อมูลที่ยังไม่มีทำเป็นค่าตั้งค่าที่มีสถานะกำกับ ระบบทำงานต่อได้ แต่บล็อกเอกสารทางการจนกว่าจะยืนยัน · รายการจริงจาก design/09" }) +
    `<div class="grid g4">${Object.entries(DS).map(([k, v]) => `<div class="panel stat"><span class="label">${v[0]}</span><span class="value">${cnt(k)}</span><span class="sub">${pill(k, v[1])}</span></div>`).join("")}</div>` +
    secs.map(sec => panel(sec, table([{ th: "คีย์", html: s => `<span class="mono">${esc(s.key)}</span>` }, { th: "ค่าปัจจุบัน", wrap: true, val: s => s.value }, { th: "สถานะ", html: s => pillOf(DS, s.status) + (s.statusNote !== s.status ? `<br><span class="muted small">${esc(s.statusNote)}</span>` : "") }, { th: "ประเด็นค้าง", val: s => s.parking || "—" }, { th: "ผู้ดูแลค่า", html: s => pill(ROLE_SHORT[settingOwner(s.key)], settingOwner(s.key) === me().role ? "info" : "neutral") }, { th: "", html: s => ed && settingOwner(s.key) === me().role ? btn("แก้/ยืนยัน", "setting-edit", { sm: true, data: { key: s.key } }) : "" }], all.filter(s => s.section === sec)), { flush: true })).join("") +
    panel(`ประเด็นค้าง (Parking lot) ${D.settings.parking.length} รายการ`, table([{ th: "รหัส", html: x => `<span class="mono">${x.code}</span>` }, { th: "ประเด็น", wrap: true, val: x => x.issue }, { th: "ค่าที่ใช้ระหว่างรอ", wrap: true, val: x => x.fallback }, { th: "ผู้ตอบ", val: x => x.owner }, { th: "อ้างอิง", val: x => x.ref }, { th: "", html: x => x.closed ? pill("ปิดแล้ว", "good") : pill("เปิด", "warn") }], D.settings.parking), { flush: true }) +
    `<div class="note">ข้อมูลที่ยังขาดสำหรับต้นแบบ ${D.gaps.length} รายการ — <a href="#gaps">ดูรายการ</a></div>`;
} });
act("setting-edit", el => {
  const s = IDX.setting.get(el.dataset.key);
  openModal(`ค่าตั้งค่า ${s.key}`, `<form data-form="setting-save" data-key="${esc(s.key)}"><div class="form-grid">${field("value", "ค่า", { value: s.value, required: true, full: true })}${field("status", "สถานะข้อมูล", { type: "select", options: Object.entries(DS).map(([k, v]) => [k, v[0]]), value: s.status, blank: false })}${field("ref", "หลักฐาน/ที่มา", { placeholder: "เช่น ประกาศ มนพ. ลงวันที่ …", hint: "บังคับเมื่อเปลี่ยนเป็น “ยืนยันแล้ว”" })}</div><div class="note">การเปลี่ยนบันทึกประวัติใน sec.system_setting_history และ audit log</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`);
});
form("setting-save", (d, f) => {
  const errs = {}; if (!d.value) errs.value = "ระบุค่า"; if (d.status === "CONFIRMED" && !d.ref) errs.ref = "ต้องระบุหลักฐานเมื่อยืนยัน"; if (!formErrors(f, errs)) return;
  const s = IDX.setting.get(f.dataset.key); Object.assign(s, { value: d.value, status: d.status, statusNote: d.status + (d.ref ? ` (${d.ref})` : "") });
  audit("แก้ค่าตั้งค่า", `${s.key} = ${d.value} [${d.status}]`); persist(); closeModal(); toast("บันทึกค่าตั้งค่าแล้ว"); rerender();
});

/* ---------------- S21 ผู้ใช้และสิทธิ์ ---------------- */
route("users", { perm: "users.manage", title: "ผู้ใช้และสิทธิ์", render() {
  const roles = D.security.roles;
  return pageHead("ผู้ใช้และสิทธิ์ (M10)", { lead: "SSO ผ่าน Keycloak realm erpnpu (บัญชีเดียวกับ ERP) · ผูกบัญชีด้วย claim staff_id · สิทธิ์ = บทบาท × ขอบเขต (มหาวิทยาลัย/คณะ/หลักสูตร)" }) +
    panel("ผู้ใช้จำลอง", table([{ th: "ชื่อ", val: u => u.name }, { th: "หน่วยงาน", val: u => u.unit }, { th: "บทบาท", html: u => `<span class="tag">${u.role}</span> ${esc(roles.find(r => r.code === u.role).th)}` }, { th: "ขอบเขต", val: u => scopeText(u) }, { th: "ที่มาของสิทธิ์", html: u => ["UX", "EX"].includes(u.role) && u.realStaff ? pill("ตำแหน่งบริหาร ERP-HR", "info") : ["FC", "FP"].includes(u.role) ? pill("มอบหมายตามหน่วยงาน (ERP org)", "info") : pill("กำหนดโดยผู้ดูแล", "neutral") }, { th: "", html: u => btn("เข้าใช้เป็นผู้ใช้นี้", "pick-user", { sm: true, data: { id: u.id } }) }], D.security.users), { flush: true }) +
    panel("ตารางสิทธิ์ (บทบาท × สิทธิ์)", `<div class="table-wrap"><table class="t"><thead><tr><th>สิทธิ์</th>${roles.map(r => `<th title="${esc(r.th)}">${r.code}</th>`).join("")}</tr></thead><tbody>${D.security.permissions.map(p => `<tr><td>${esc(p.th)}<br><span class="muted small mono">${p.code}</span></td>${roles.map(r => `<td class="${r.perms.includes(p.code) ? "perm-yes" : "perm-no"}">${r.perms.includes(p.code) ? "✓" : "·"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`, { flush: true }) +
    panel("ตำแหน่งบริหาร → บทบาท (staff.admin_position_role_map)", table([{ th: "รหัสตำแหน่ง ERP-HR", html: x => `<span class="tag">${x[0]}</span>` }, { th: "บทบาท CMS", val: x => x[1] }, { th: "ขอบเขต", val: x => x[2] }, { th: "สถานะ", html: () => pillOf(DS, "PROVISIONAL") }], [["DEAN", "R6 คณบดี/ผู้อำนวยการ", "คณะที่บริหาร"], ["VICE_DEAN_ACAD", "R3 งานวิชาการคณะ", "คณะที่บริหาร"], ["VP_ACAD", "R8 ผู้บริหาร", "มหาวิทยาลัย"]]), { flush: true });
} });

/* ---------------- audit ---------------- */
route("audit", { perm: "audit.view", title: "บันทึกการใช้งาน", render() {
  const pg = paged("audit", D.integ.audit, 30);
  return pageHead("บันทึกการใช้งาน (audit log)", { lead: "บันทึกทุกการแก้ไขระเบียนที่อนุมัติแล้ว ทุกการส่งออก และการเข้าถึงข้อมูลส่วนบุคคล (02 §7) · รายการที่คุณทำในต้นแบบจะต่อท้ายที่นี่" }) +
    panel(`${fmt(D.integ.audit.length)} รายการ`, table([{ th: "เวลา", val: a => thDateTime(a.at) }, { th: "ผู้ใช้", val: a => userName(a.user) }, { th: "การกระทำ", val: a => a.action }, { th: "เป้าหมาย", wrap: true, val: a => a.target }, { th: "IP", html: a => `<span class="mono">${a.ip}</span>` }], pg.rows) + pg.pager, { flush: true });
} });
