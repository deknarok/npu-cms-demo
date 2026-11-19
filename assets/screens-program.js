/* screens-program.js — S03 หน้าหลักสูตร (แท็บ) · S04 ตัวแก้ไขฉบับ · S05 โครงสร้าง · S06 แผนการเรียน · S08/S09 OBE · S10 อาจารย์ · S12 การเงิน · สร้างหลักสูตร */
"use strict";

const PTABS = [["overview", "ภาพรวม"], ["versions", "ฉบับ"], ["structure", "โครงสร้าง"], ["plan", "แผนการเรียน"], ["obe", "OBE / PLO"], ["staff", "อาจารย์"], ["finance", "การเงิน"], ["approval", "การอนุมัติ"], ["cisa", "CISA/การรับรอง"], ["performance", "ผลการดำเนินงาน"], ["documents", "เอกสาร"]];
function editable(p) { const v = latestVer(p); return canEditProg(p) && ["DRAFT", "IN_REVIEW"].includes(v.state); }
function lockNote(p) {
  const v = latestVer(p);
  if (["DRAFT", "IN_REVIEW"].includes(v.state)) return canEditProg(p) ? "" : `<div class="note">ดูอย่างเดียว — ${esc(denyMsg("program.edit"))} หรืออยู่นอกขอบเขต</div>`;
  return `<div class="note">ฉบับ พ.ศ. ${v.year} อนุมัติแล้วและถูกล็อก การแก้ไขต้องสร้าง<b>ฉบับปรับปรุง</b> หรือยื่น <b>สมอ.08</b> ${can("program.create") && canEditProg(p) ? btn("สร้างฉบับปรับปรุง", "new-revision", { sm: true, data: { id: p.id } }) : ""} ${can("amend.submit") ? `<a class="btn sm" href="#amendments">ยื่น สมอ.08</a>` : ""}</div>`;
}

route("program", { perm: "program.view", title: "หลักสูตร", render(args) {
  const p = IDX.prog.get(Number(args[0])); if (!p) return `<div class="note bad">ไม่พบหลักสูตร</div>`;
  if (!inScope(p)) return pageHead(progTitle(p)) + `<div class="note bad">หลักสูตรนี้อยู่นอกขอบเขตของบทบาท ${roleOf().code} (${esc(scopeText())})</div>`;
  const tab = args[1] || "overview"; const v = latestVer(p);
  const head = pageHead(p.name, { crumbs: `<a href="#programs">ทะเบียนหลักสูตร</a> › ${esc(IDX.fac.get(p.fac).name)}`,
    lead: `${esc(p.degree)} · ${esc(IDX.level.get(p.level).th)} · <span class="mono">${p.code}</span> · ฉบับล่าสุด พ.ศ. ${v.year} ${pillOf(VSTATE, v.state)} ${pillOf(LIFE, p.life)} ${srcPill(!p.simulated)}`,
    actions: (can("doc.export") ? btn("เล่ม มคอ.2", "open-doc", { data: { code: "DOC-TQF2", id: p.id } }) : "") + (editable(p) ? `<a class="btn primary" href="#edit-${v.id}">แก้ไขฉบับร่าง</a>` : "") });
  const tabs = `<nav class="tabs">${PTABS.map(([k, t]) => `<a href="#program-${p.id}-${k}"${k === tab ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>`;
  const fn = PTAB[tab] || PTAB.overview;
  return head + tabs + fn(p);
} });

const PTAB = {};
PTAB.overview = p => {
  const v = latestVer(p); const s = stat(p); const st = standardsCheck(p); const c = openCaseOf(p); const ci = cisaOf(p);
  return `<div class="grid g-side"><div class="grid">
    ${panel("ข้อมูลหลักสูตร", kv([["ชื่อปริญญา", esc(p.degree)], ["สาขาวิชา", esc(p.name)], ["ชื่อภาษาอังกฤษ", gapPill("G20")], ["ระดับ", esc(IDX.level.get(p.level).th)], ["คณะ/วิทยาลัย", esc(IDX.fac.get(p.fac).name)],
      ["หน่วยกิต/ระยะเวลา", `${v.credits} หน่วยกิต · ${v.years} ปี`], ["แผนการศึกษา", v.plans.map(x => `${esc(x.plan)}${x.regId ? ` <span class="tag">${x.regId}</span>` : ""}`).join("<br>")], ["เกรดเฉลี่ยขั้นต่ำ", esc(v.minGpa)],
      ["ช่องทางรายงานภายนอก", IDX.level.get(p.level).channel === "CISA" ? "CISA (สป.อว.)" : "ไม่ส่ง CISA (ค่าตั้งค่า P09)"], ["รหัสหลักสูตร (CHECO)", p.checoCode ? `<span class="mono">${p.checoCode}</span> ${srcPill(false)}` : "—"],
      ["ครบรอบปรับปรุง", `พ.ศ. ${p.nextReview} ${reviewDue(p) ? pill("ใกล้ครบรอบ", "warn") : ""}`], ["การรับรองถึง", `พ.ศ. ${p.accredExpiry} (ประกาศ กมอ. 2568: 5 ปี +1 สำหรับหลักสูตร 5 ปีขึ้นไป)`]]))}
    ${panel("เรื่องที่อยู่ระหว่างดำเนินการ", c ? `<p><a href="#case-${c.id}"><b>${esc(c.title)}</b></a></p><p>${pillOf(CASE_STATUS, c.status)} ${esc(caseStageText(c))}</p>${stepsMini(c)}` : `<div class="empty">ไม่มีเรื่องที่เปิดอยู่</div>`)}
  </div><div class="grid">
    ${panel("สรุปสถานะ", `<ul class="list">
      <li><span>เกณฑ์ 2565</span>${st.rs ? (st.ok ? pill("ผ่าน", "good") : pill(`ไม่ผ่าน ${st.fails}`, "bad")) + (st.warns ? " " + pill(`ตรวจด้วยคน ${st.warns}`, "warn") : "") : pill("ไม่มีชุดกฎ", "neutral")}</li>
      <li><span>CISA</span>${ci ? (ci.step >= 12 ? pill("สป.อว. รับทราบแล้ว", "good") : pill(`ขั้น ${ci.step}/12`, "info")) : pill("—", "neutral")}</li>
      <li><span>OBE design</span>${obeOf(p) ? (obeOf(p).published ? pill("เผยแพร่ให้ TQF แล้ว", "good") : pill("ยังไม่เผยแพร่", "warn")) : gapPill("G18")}</li>
      <li><span>โครงสร้างรายหมวด</span>${structureOf(p) ? (structureOf(p).source === "TEMPLATE" ? pill("ร่างตามระเบียบ", "warn") + " " + gapPill("G05") : pill("มี", "good")) : gapPill("G05")}</li>
      <li><span>แผนรับ / รับจริงปีล่าสุด</span><span>${s ? `${s.plan} / ${s.intake[2]}` : "—"} ${srcPill(false)}</span></li></ul>`, { flush: true })}
    ${s ? panel("รับนักศึกษา 3 ปี", colChart(s.years.map((y, i) => ({ label: String(y), v: s.intake[i], v2: s.plan, tip: `ปีการศึกษา ${y}: รับจริง ${s.intake[i]} · แผน ${s.plan}` })), { aria: "รับนักศึกษาเทียบแผน" }) + legend([["--series-1", "รับจริง"], ["--series-2", "แผนรับ"]])) : ""}
  </div></div>`;
};
function gapPill(code) { const g = D.gaps.find(x => x.code === code); return `<span class="pill warn" title="${esc(g ? g.need : "")}">รอข้อมูล ${code}</span>`; }
function stepsMini(c) {
  return `<ol class="steps">${c.steps.map((s, i) => { const m = s.meeting ? IDX.meeting.get(s.meeting) : null;
    return `<li class="${s.status === "DONE" ? "done" : s.status === "CURRENT" ? "current" : s.status === "REJECTED" ? "rejected" : ""}"><span class="mk">${s.status === "DONE" ? "✓" : i + 1}</span><div><div class="st-title">${esc(BODY_TH(s.body))}</div><div class="st-meta">${s.status === "DONE" ? `${esc((RESULT_TH[s.result] || [""])[0])} · ${thDate(s.date)}${m ? " · ครั้งที่ " + esc(m.no) : ""}` : s.status === "CURRENT" ? (m ? `บรรจุวาระครั้งที่ ${esc(m.no)} (${thDate(m.date)})` : "รอบรรจุวาระ") : "รอ"}${s.note ? ` · ${esc(s.note)}` : ""}</div></div></li>`; }).join("")}</ol>`;
}

PTAB.versions = p => panel("ประวัติฉบับหลักสูตร", table([
  { th: "ฉบับ", html: v => `<b>พ.ศ. ${v.year}</b> <span class="muted small">#${v.id}</span>` }, { th: "ประเภท", val: v => v.kind === "NEW" ? "หลักสูตรใหม่" : "หลักสูตรปรับปรุง" },
  { th: "หน่วยกิต", num: true, val: v => v.credits }, { th: "แผน/รหัสทะเบียน", html: v => v.plans.map(x => `${esc(x.plan)} ${x.regId ? `<span class="tag">${x.regId}</span>` : ""}`).join("<br>") },
  { th: "สภาอนุมัติ", html: v => v.senate ? thDate(v.senate) + " " + srcPill(false) : "—" }, { th: "สป.อว. รับทราบ", val: v => v.ack ? thDate(v.ack) : "—" }, { th: "สถานะ", html: v => pillOf(VSTATE, v.state) },
  { th: "ที่มา", html: v => v.source === "REG" ? `<span class="pill real">ทะเบียน</span>` : srcPill(false) },
  { th: "", html: v => ["DRAFT", "IN_REVIEW"].includes(v.state) && canEditProg(p) ? `<a class="btn sm" href="#edit-${v.id}">แก้ไข</a>` : "" }], [...p.versions].reverse()), { flush: true }) +
  `<div class="note">ฉบับที่อนุมัติแล้วถูกล็อก (02 หลักการข้อ 2) · การเปลี่ยนแปลงเล็กน้อยผ่าน สมอ.08 ผูกกับฉบับ · ปีหลักสูตรและรหัสทะเบียนเป็นข้อมูลจริง วันที่อนุมัติเป็นข้อมูลจำลอง ${gapPill("G11")}</div>`;

/* ---------- S05 โครงสร้าง ---------- */
PTAB.structure = p => {
  const s = structureOf(p); const v = latestVer(p);
  if (!s) return `<div class="note warn">ยังไม่มีโครงสร้างรายหมวดของหลักสูตรนี้ — ระบบทะเบียนต้องเข้าระบบก่อนจึงดึงได้ ${gapPill("G05")}<br>หน่วยกิตรวมจากทะเบียน: <b>${v.credits}</b> หน่วยกิต</div>` +
    (editable(p) ? btn("สร้างโครงสร้างจากแม่แบบระดับ" + levelAbbr(p.level), "struct-template", { kind: "primary", data: { id: p.id } }) : "");
  const can2 = typeof canStruct === "function" ? canStruct(p) : editable(p) && can("structure.edit"); let nid = 0; const paths = [];
  function node(n, path) {
    const id = nid++; paths[id] = path; const cr = (n.courses || []).reduce((a, c) => a + ((IDX.course.get(c) || {}).c || 0), 0);
    const sum = treeCredits(n); const warn = (n.courses && n.courses.length && cr < n.min);
    return `<li><div class="node"><span><span class="t">${esc(n.title)}</span> <span class="muted small">ขั้นต่ำ ${n.min} นก.${n.courses && n.courses.length ? ` · รายวิชาที่ระบุ ${cr} นก.` : ""}</span> ${warn ? pill("ไม่ถึงขั้นต่ำ", "warn") : ""}</span>
      <span class="actions">${can2 ? btn("+ รายวิชา", "struct-add", { sm: true, data: { prog: p.id, path: path.join(".") } }) + btn("แก้", "struct-edit", { sm: true, data: { prog: p.id, path: path.join(".") } }) : ""}</span></div>
      ${(n.courses || []).length ? `<div>${n.courses.map(c => { const x = IDX.course.get(c) || { th: "(ไม่พบรายวิชา)", cr: "" }; return `<div class="crs"><span class="tag">${esc(c)}</span><a href="#" data-act="course-open" data-id="${esc(c)}">${esc(x.th)}</a><span class="muted small">${esc(x.cr)}</span>${can2 ? `<button class="link-btn" data-act="struct-remove" data-prog="${p.id}" data-path="${path.join(".")}" data-code="${esc(c)}" aria-label="นำ ${esc(c)} ออก">นำออก</button>` : ""}</div>`; }).join("")}</div>` : ""}
      ${(n.children || []).length ? `<ul>${n.children.map((ch, i) => node(ch, path.concat(i))).join("")}</ul>` : ""}</li>`;
  }
  const total = s.min; const depth = (function d(n) { return 1 + Math.max(0, ...(n.children || []).map(d)); })(s);
  const checks = [[total >= v.credits, `หน่วยกิตรวมขั้นต่ำ ${total} เทียบกับ ${v.credits} ของฉบับ`], [depth <= 5, `ความลึก ${depth} ระดับ (CISA รองรับ ≤ 5)`], [treeCourses(s).every(c => IDX.course.has(c)), "ทุกรายวิชาอยู่ในคลังรายวิชา"]];
  const tplNote = s.source === "TEMPLATE" ? `<div class="note warn"><b>โครงสร้างร่างตาม${esc(s.basis)}</b> — สร้างอัตโนมัติจากหน่วยกิตรวมจริงของระบบทะเบียน (${v.credits} หน่วยกิต) และหน่วยกิตขั้นต่ำรายหมวดในระเบียบ ยังไม่มีรายวิชา · โครงสร้างจริงต้องนำเข้าจากระบบทะเบียน (program_info_1 ต้องเข้าระบบ) ${gapPill("G05")}</div>` : "";
  const pool = p.dept ? [...IDX.course.values()].filter(c => c.grp === p.dept) : [];
  const poolPanel = pool.length && can2 ? panel(`รายวิชาที่ระบบทะเบียนผูกกับกลุ่ม “${p.dept}” (${pool.length} วิชา) — ใช้เลือกเข้าหมวด`, table([{ th: "รหัส", html: c => `<span class="mono">${esc(c.code)}</span>` }, { th: "รายวิชา", wrap: true, html: c => `<a href="#" data-act="course-open" data-id="${esc(c.code)}">${esc(c.th)}</a>` }, { th: "นก.", val: c => c.cr }], pool.slice(0, 80), { maxH: 320 }) + `<div class="body muted small">กลุ่มนี้อาจใช้ร่วมหลายหลักสูตรในคณะ (ข้อมูลจริงจากระบบทะเบียน class_info) · ใช้ปุ่ม “+ รายวิชา” ในหมวดเพื่อเพิ่ม</div>`, { flush: true }) : "";
  return lockNote(p) + tplNote + `<div class="grid g-side">${panel("โครงสร้างหลักสูตร (ต้นไม้ ≤ 5 ระดับ)", `<ul class="tree">${node(s, [])}</ul>`)}
    ${panel("ตรวจโครงสร้าง", `<ul class="list">${checks.map(([ok, t]) => `<li><span>${esc(t)}</span>${ok ? pill("ผ่าน", "good") : pill("ไม่ผ่าน", "bad")}</li>`).join("")}</ul><div class="body"><p class="muted small">รายวิชาและหน่วยกิตเป็นข้อมูลจริงจากระบบทะเบียน การจัดเข้าหมวดเป็นข้อมูลจำลอง</p></div>`, { flush: true })}</div>` + poolPanel;
};
function nodeAt(p, path) { let n = structureOf(p); (path ? path.split(".") : []).filter(x => x !== "").forEach(i => { n = n.children[Number(i)]; }); return n; }
act("struct-add", el => {
  const p = IDX.prog.get(Number(el.dataset.prog));
  openModal("เพิ่มรายวิชาเข้าหมวด", `<form data-form="struct-add" data-prog="${p.id}" data-path="${el.dataset.path}"><div class="field"><label for="f-cq">ค้นหารายวิชาในคลัง (รหัสหรือชื่อ)</label><input id="f-cq" name="q" type="search" data-input="struct-search" autocomplete="off"></div><div id="cq-res" class="table-wrap" style="max-height:340px;overflow:auto"><div class="empty">พิมพ์อย่างน้อย 2 ตัวอักษร</div></div></form>`);
});
onChange("struct-search", el => {
  const q = el.value.trim(); const box = $("#cq-res"); if (q.length < 2) { box.innerHTML = `<div class="empty">พิมพ์อย่างน้อย 2 ตัวอักษร</div>`; return; }
  const f = el.closest("form"); const rows = [...IDX.course.values()].filter(c => c.code.includes(q) || c.th.includes(q)).slice(0, 40);
  box.innerHTML = table([{ th: "รหัส", html: c => `<span class="mono">${esc(c.code)}</span>` }, { th: "ชื่อวิชา", val: c => c.th }, { th: "นก.", val: c => c.cr }, { th: "", html: c => btn("เพิ่ม", "struct-pick", { sm: true, data: { code: c.code, prog: f.dataset.prog, path: f.dataset.path } }) }], rows, { empty: "ไม่พบรายวิชา" });
});
act("struct-pick", el => {
  const p = IDX.prog.get(Number(el.dataset.prog)); const n = nodeAt(p, el.dataset.path); n.courses = n.courses || [];
  if (n.courses.includes(el.dataset.code)) { toast("มีรายวิชานี้ในหมวดแล้ว"); return; }
  n.courses.push(el.dataset.code); audit("เพิ่มรายวิชาในโครงสร้าง", `${p.code} ${el.dataset.code}`); persist(); closeModal(); toast(`เพิ่ม ${el.dataset.code} แล้ว`); rerender();
});
act("struct-remove", el => { const p = IDX.prog.get(Number(el.dataset.prog)); const n = nodeAt(p, el.dataset.path); n.courses = n.courses.filter(c => c !== el.dataset.code); audit("นำรายวิชาออกจากโครงสร้าง", el.dataset.code); persist(); rerender(); });
act("struct-edit", el => {
  const p = IDX.prog.get(Number(el.dataset.prog)); const n = nodeAt(p, el.dataset.path);
  openModal("แก้ไขหมวด/กลุ่มวิชา", `<form data-form="struct-edit" data-prog="${p.id}" data-path="${el.dataset.path}"><div class="form-grid">${field("title", "ชื่อหมวด/กลุ่มวิชา", { value: n.title, required: true, full: true })}${field("min", "หน่วยกิตขั้นต่ำ", { type: "number", value: n.min, min: 0, required: true })}${field("child", "เพิ่มกลุ่มย่อย (ถ้ามี)", { placeholder: "เช่น กลุ่มวิชาเอกเลือก" })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`);
});
form("struct-edit", (d, f) => {
  if (!formErrors(f, Object.assign({}, !d.title ? { title: "ระบุชื่อหมวด" } : {}, d.min === "" || Number(d.min) < 0 ? { min: "ระบุหน่วยกิตเป็นตัวเลข ≥ 0" } : {}))) return;
  const p = IDX.prog.get(Number(f.dataset.prog)); const n = nodeAt(p, f.dataset.path); n.title = d.title; n.min = Number(d.min);
  if (d.child) { n.children = n.children || []; n.children.push({ title: d.child, min: 0, courses: [] }); }
  audit("แก้โครงสร้างหลักสูตร", `${p.code} ${d.title}`); persist(); closeModal(); toast("บันทึกโครงสร้างแล้ว"); rerender();
});
act("struct-template", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const v = latestVer(p);
  const ge = v.year >= 2565 ? 24 : 30;   // ge.min_credits (ระเบียบ ป.ตรี 2566 ข้อ 11.1)
  D.design.structures[p.id] = { title: "โครงสร้างหลักสูตร", min: v.credits, children: [{ title: "หมวดวิชาศึกษาทั่วไป", min: ge, courses: [] }, { title: "หมวดวิชาเฉพาะ", min: Math.max(72, v.credits - ge - 6), children: [{ title: "กลุ่มวิชาแกน", min: 0, courses: [] }, { title: "กลุ่มวิชาเอกบังคับ", min: 0, courses: [] }, { title: "กลุ่มวิชาเอกเลือก", min: 0, courses: [] }] }, { title: "หมวดวิชาเลือกเสรี", min: 6, courses: [] }] };
  audit("สร้างโครงสร้างจากแม่แบบ", p.code); persist(); rerender();
});

/* ---------- S06 แผนการเรียน ---------- */
PTAB.plan = p => {
  const plan = D.design.studyPlans[p.id]; if (!plan) return `<div class="note warn">ยังไม่มีแผนการเรียน ${gapPill("G05")}</div>`;
  const s = structureOf(p); const inTree = new Set(s ? treeCourses(s) : []);
  const notIn = plan.flatMap(t => t.courses).filter(c => !inTree.has(c));
  return lockNote(p) + (notIn.length ? `<div class="note bad">รายวิชาในแผนที่ไม่อยู่ในโครงสร้าง: ${notIn.join(", ")}</div>` : `<div class="note">ตรวจแล้ว: ทุกรายวิชาในแผนอยู่ในโครงสร้างหลักสูตร</div>`) +
    `<div class="grid g2">${plan.map(t => { const cr = t.courses.reduce((a, c) => a + ((IDX.course.get(c) || {}).c || 0), 0);
      return panel(`ปีที่ ${t.year} ภาคการศึกษาที่ ${t.term}`, table([{ th: "รหัส", html: c => `<span class="mono">${esc(c)}</span>` }, { th: "รายวิชา", html: c => `<a href="#" data-act="course-open" data-id="${esc(c)}">${esc((IDX.course.get(c) || {}).th || "")}</a>` }, { th: "นก.", val: c => (IDX.course.get(c) || {}).cr || "" }], t.courses), { flush: true, actions: `<span class="muted small">รวม ${cr} หน่วยกิต ${cr > 22 ? pill("เกิน 22", "warn") : ""}</span>` }); }).join("")}</div>`;
};

/* ---------- S08/S09 OBE ---------- */
PTAB.obe = p => {
  const o = obeOf(p); if (!o) return `<div class="note warn">หลักสูตรนี้ยังไม่มี OBE design ในระบบ (ฉบับที่ย้ายจากระบบเดิม — PLO อยู่ในเล่ม PDF) ${gapPill("G18")}</div>`;
  const ed = can("obe.edit") && canEditProg(p); const pc = o.plos.map(x => x.code);
  const tqf = o.framework === "TQF6"; const TOP = tqf ? "●" : "M";
  const noM = pc.filter(c => !Object.values(o.mapping).some(m => m[c] === TOP));
  const noPlo = Object.entries(o.mapping).filter(([, m]) => !Object.keys(m).length).map(([c]) => c);
  const noClo = Object.keys(o.mapping).filter(c => !(o.clos[c] || []).length);
  const rules = [[!noM.length, `${tqf ? "ทุกผลการเรียนรู้มีรายวิชารับผิดชอบหลัก (●)" : "ทุก PLO มีรายวิชาที่ระดับ M"}${noM.length ? " — ยังขาด: " + noM.join(", ") : ""}`], [!noPlo.length, "ทุกรายวิชาในโครงสร้างชี้อย่างน้อย 1 PLO"], [!noClo.length, "ทุกรายวิชามี CLO ตั้งต้น"], [o.plos.every(x => x.criteria), "ทุก PLO มีเกณฑ์วัด (performance criteria)"]];
  return `<div class="actions">${o.published ? pill(`เผยแพร่ให้ TQF แล้ว ${thDate(o.publishedAt)}`, "good") : pill("ยังไม่เผยแพร่ให้ TQF", "warn")} ${btn("เผยแพร่ OBE design ให้ TQF", "obe-publish", { kind: "primary", perm: "obe.publish", data: { id: p.id }, disabled: !rules.every(r => r[0]) && false })}<span class="muted small">ส่ง webhook obe.design.published + เปิด API GET /obe</span></div>
    ${panel("ตรวจกฎ OBE", `<ul class="list">${rules.map(([ok, t]) => `<li><span>${esc(t)}</span>${ok ? pill("ผ่าน", "good") : pill("ต้องแก้", "warn")}</li>`).join("")}</ul>`, { flush: true })}
    ${panel("1. เสียงของผู้มีส่วนได้ส่วนเสีย (VOS)", table([{ th: "กลุ่ม", val: x => x.group }, { th: "ประเภท", val: x => x.kind }, { th: "วิธีเก็บ", val: x => x.method }, { th: "จำนวน", num: true, val: x => x.n }, { th: "ความต้องการ", wrap: true, val: x => x.need }, { th: "ผลกลั่นกรอง", html: x => x.accepted ? pill("นำไปกำหนด PLO", "good") : pill("ไม่นำมาใช้", "neutral") }], o.vos), { flush: true, actions: ed ? btn("+ เพิ่ม VOS", "vos-add", { sm: true, data: { id: p.id } }) : "" })}
    ${panel("2. PLO (KSEC · taxonomy · เกณฑ์วัด)", table([{ th: "PLO", html: x => `<b>${x.code}</b>` }, { th: "ข้อความ", wrap: true, html: x => esc(x.text) + (x.subs || []).map(s => `<br><span class="muted small">${s.code} ${esc(s.text)}</span>`).join("") }, { th: "KSEC", val: x => x.domain }, { th: "ประเภท", val: x => x.type }, { th: "ระดับ", val: x => x.level }, { th: "เกณฑ์วัด / เครื่องมือ", wrap: true, html: x => `${esc(x.criteria)}<br><span class="muted small">${esc(x.tool)}</span>` }, { th: "ผลบรรลุ (TQF)", html: x => o.attain[x.code] != null ? pill(pct(o.attain[x.code]), o.attain[x.code] >= .7 ? "good" : "warn") : "—" }, { th: "", html: x => ed ? btn("แก้", "plo-edit", { sm: true, data: { id: p.id, code: x.code } }) : "" }], o.plos), { flush: true, actions: ed ? btn("+ เพิ่ม PLO", "plo-edit", { sm: true, data: { id: p.id } }) : "" })}
    ${panel("3. YLO รายชั้นปี", table([{ th: "ชั้นปี", num: true, val: y => y.year }, { th: "YLO", wrap: true, val: y => y.text }, { th: "PLO", val: y => y.plos.join(", ") }], o.ylo), { flush: true })}
    ${tqf ? `<div class="note info">ข้อมูลจากเล่ม มคอ.2 จริง (${esc(o.source)}) — กรอบผลการเรียนรู้ TQF 6 ด้าน (ก่อน OBE) · <a href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">เปิดเล่ม PDF</a> · วัตถุประสงค์ ${o.objectives.length} ข้อ · ผลการเรียนรู้ ${o.plos.length} ข้อ · mapping ${Object.keys(o.mapping).length} รายวิชา · ยังไม่มีเกณฑ์วัด/CLO ในเล่ม → ปรับเป็น PLO แบบ OBE เมื่อปรับปรุงหลักสูตร</div>${panel("วัตถุประสงค์ของหลักสูตร (เล่ม มคอ.2)", `<ol class="bul">${o.objectives.map(x => `<li>${esc(x)}</li>`).join("")}</ol>`)}` : ""}
    ${panel(tqf ? "4. แผนที่การกระจายความรับผิดชอบ (● หลัก · ○ รอง — คลิกเพื่อเปลี่ยน)" : "4. Curriculum mapping (คลิกช่องเพื่อเปลี่ยน: ว่าง → I → R → M)", `<div class="table-wrap"><table class="t matrix"><thead><tr><th>รายวิชา</th>${pc.map(c => `<th>${c}</th>`).join("")}<th>CLO</th></tr></thead><tbody>${Object.entries(o.mapping).map(([c, m]) => `<tr><td class="c-name"><span class="mono">${esc(c)}</span> ${esc((IDX.course.get(c) || {}).th || "")}</td>${pc.map(x => `<td>${ed ? `<button type="button" class="lv ${m[x] || ""}" data-act="map-cycle" data-id="${p.id}" data-course="${esc(c)}" data-plo="${x}" aria-label="${esc(c)} ${x}">${m[x] || "·"}</button>` : `<span class="lv ${m[x] || ""}">${m[x] || ""}</span>`}</td>`).join("")}<td><button class="link-btn" data-act="clo-open" data-id="${p.id}" data-course="${esc(c)}">${(o.clos[c] || []).length} CLO</button></td></tr>`).join("")}</tbody></table></div>`, { flush: true })}`;
};
act("map-cycle", el => {
  const o = obeOf(IDX.prog.get(Number(el.dataset.id))); const m = o.mapping[el.dataset.course]; const order = o.framework === "TQF6" ? ["", "●", "○"] : ["", "I", "R", "M"];
  const nx = order[(order.indexOf(m[el.dataset.plo] || "") + 1) % order.length]; if (nx) m[el.dataset.plo] = nx; else delete m[el.dataset.plo];
  o.published = false; persist(); rerender();
});
act("plo-edit", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const x = el.dataset.code ? o.plos.find(y => y.code === el.dataset.code) : { code: "PLO" + (o.plos.length + 1), text: "", domain: "K", type: "Specific", level: "Apply", criteria: "", tool: "" };
  const lv = { K: ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"], S: ["Imitation", "Manipulation", "Precision", "Articulation", "Naturalization"], E: ["Receiving", "Responding", "Valuing", "Organization", "Characterization"], C: ["Receiving", "Responding", "Valuing", "Organization", "Characterization"] };
  openModal(el.dataset.code ? `แก้ไข ${x.code}` : "เพิ่ม PLO", `<form data-form="plo-save" data-id="${p.id}" data-code="${el.dataset.code || ""}"><div class="form-grid">
    ${field("code", "รหัส", { value: x.code, readonly: true })}${field("type", "ประเภท", { type: "select", options: ["Specific", "Generic"], value: x.type, blank: false })}
    ${field("text", "ข้อความ PLO (ผู้เรียนสามารถ…)", { type: "textarea", value: x.text, required: true, full: true, hint: "ขึ้นต้นด้วยคำกริยาที่วัดได้ ตรงกับระดับ taxonomy" })}
    ${field("domain", "KSEC", { type: "select", options: [["K", "K ความรู้"], ["S", "S ทักษะ"], ["E", "E จริยธรรม"], ["C", "C ลักษณะบุคคล"]], value: x.domain, blank: false })}
    ${field("level", "ระดับ taxonomy", { type: "select", options: [...new Set(Object.values(lv).flat())], value: x.level, blank: false, hint: "Bloom / Simpson / Krathwohl (G19)" })}
    ${field("criteria", "พฤติกรรมบ่งชี้ (performance criteria)", { type: "textarea", value: x.criteria, required: true, full: true, rows: 2 })}
    ${field("tool", "วิธีการ/เครื่องมือวัด", { value: x.tool, required: true, full: true })}</div>
    <div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก PLO</button></div></form>`);
});
form("plo-save", (d, f) => {
  const errs = {}; if (d.text.length < 15) errs.text = "อธิบาย PLO อย่างน้อย 15 ตัวอักษร"; if (!d.criteria) errs.criteria = "ระบุเกณฑ์วัด"; if (!d.tool) errs.tool = "ระบุเครื่องมือวัด";
  if (!formErrors(f, errs)) return;
  const p = IDX.prog.get(Number(f.dataset.id)); const o = obeOf(p);
  if (f.dataset.code) Object.assign(o.plos.find(y => y.code === f.dataset.code), { text: d.text, domain: d.domain, type: d.type, level: d.level, criteria: d.criteria, tool: d.tool });
  else o.plos.push({ code: d.code, text: d.text, domain: d.domain, type: d.type, level: d.level, criteria: d.criteria, tool: d.tool, subs: [] });
  o.published = false; audit("บันทึก PLO", `${p.code} ${d.code}`); persist(); closeModal(); toast(`บันทึก ${d.code} แล้ว`); rerender();
});
act("vos-add", el => openModal("เพิ่มข้อมูลผู้มีส่วนได้ส่วนเสีย", `<form data-form="vos-save" data-id="${el.dataset.id}"><div class="form-grid">${field("group", "กลุ่ม", { required: true })}${field("kind", "ประเภท", { type: "select", options: ["ภายใน", "ภายนอก", "อนาคต"], required: true })}${field("method", "วิธีเก็บข้อมูล", { required: true })}${field("n", "จำนวน", { type: "number", min: 1, required: true })}${field("need", "ความต้องการที่ได้", { type: "textarea", required: true, full: true })}${field("accepted", "ผลกลั่นกรอง", { type: "select", options: [["1", "นำไปกำหนด PLO"], ["0", "ไม่นำมาใช้"]], blank: false })}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`));
form("vos-save", (d, f) => {
  const errs = {}; ["group", "kind", "method", "need"].forEach(k => { if (!d[k]) errs[k] = "จำเป็นต้องกรอก"; }); if (!(Number(d.n) > 0)) errs.n = "ระบุจำนวนมากกว่า 0";
  if (!formErrors(f, errs)) return; const o = obeOf(IDX.prog.get(Number(f.dataset.id)));
  o.vos.push({ group: d.group, kind: d.kind, method: d.method, n: Number(d.n), need: d.need, accepted: d.accepted === "1" }); persist(); closeModal(); rerender();
});
act("clo-open", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); const c = el.dataset.course; const list = o.clos[c] || [];
  openModal(`CLO ตั้งต้น ${c} ${(IDX.course.get(c) || {}).th || ""}`, table([{ th: "CLO", val: x => x.code }, { th: "ข้อความ", wrap: true, val: x => x.text }, { th: "PLO หลัก", val: x => x.plo }, { th: "น้ำหนัก", num: true, val: x => x.w + "%" }], list) +
    `<p class="muted small">CMS เป็นเจ้าของ CLO ตั้งต้นและ CLO→PLO · TQF ใช้ต่อใน มคอ.3 และคำนวณผลบรรลุ (D1)</p>${D.tqf[c] ? `<div class="actions">${btn("ดู มคอ.3", "open-doc", { data: { code: "DOC-TQF3", id: c } })}${btn("ดู มคอ.5", "open-doc", { data: { code: "DOC-TQF5", id: c } })}</div>` : ""}`);
});
act("obe-publish", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const o = obeOf(p); o.published = true; o.publishedAt = today();
  D.integ.deliveries.unshift({ id: Date.now(), event: "obe.design.published", client: "c2", at: today() + "T" + new Date().toTimeString().slice(0, 5), status: "DELIVERED", code: 200, attempts: 1 });
  audit("เผยแพร่ OBE", p.code); persist(); toast("ส่ง obe.design.published ให้โมดูล TQF แล้ว"); rerender();
});

/* ---------- S10 อาจารย์ในหลักสูตร ---------- */
PTAB.staff = p => {
  const st = standardsCheck(p); const v = latestVer(p); const lockedV = v.state === "APPROVED";
  const canAssign = can("staff.assign") && canEditProg(p);
  const rules = st.rs ? st.rs.rules.filter(r => r.type !== "COUNT") : [];
  return `${st.rs ? `<div class="note ${st.ok ? "" : "bad"}">ชุดกฎ <b>${esc(st.rs.set)}</b> (ตั้งค่าได้) · ข้อมูลอาจารย์จาก ERP-HR (จำลอง ${gapPill("G09")}) · ใช้ตำแหน่ง ณ ${esc((IDX.setting.get("staff.position_as_of") || {}).value || "SUBMISSION_DATE")} — ${st.ok ? "ผ่านทุกข้อ" : `ไม่ผ่าน ${st.fails} รายการ`}${st.warns ? ` · ต้องตรวจด้วยคน ${st.warns} คน` : ""}</div>` : ""}
    <div class="actions">${btn("รายงานผลตรวจเกณฑ์ (พิมพ์)", "open-doc", { data: { code: "DOC-STD2565", id: p.id }, perm: "standard.run" })}${canAssign && !lockedV ? btn("+ กำหนดอาจารย์", "staff-assign", { kind: "primary", data: { id: p.id } }) : ""}${lockedV && can("amend.submit") ? `<a class="btn" href="#amendments">เปลี่ยนอาจารย์ผ่าน สมอ.08</a>` : ""}</div>
    ${st.prog.map(x => `<div class="note ${x.ok ? "" : "bad"}">ข้อ ${x.no} ${esc(x.th)} — ${x.ok ? "ผ่าน" : "ไม่ผ่าน"} (${esc(x.msg)})</div>`).join("")}
    ${panel("อาจารย์ผู้รับผิดชอบหลักสูตร", `<div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>ชื่อ–สกุล</th><th>ตำแหน่ง/คุณวุฒิ</th>${rules.map(r => `<th title="${esc(r.th)}">ข้อ ${r.no}</th>`).join("")}<th></th></tr></thead><tbody>${st.rows.map((x, i) => `<tr><td>${i + 1}</td><td><a href="#" data-act="staff-open" data-id="${x.s.id}">${esc(staffName(x.s.id))}</a><br><span class="muted small mono">${x.s.id}</span></td><td>${esc(POS_TH[x.s.pos])}<br><span class="muted small">${esc(DEG_TH[x.s.deg])} ${esc(x.s.field)} · ISCED ${esc(x.s.isced || "—")}</span></td>${x.res.map(r => `<td>${r.ok ? pill("ผ่าน", "good") : r.warn ? pill("ตรวจ", "warn") : pill("ไม่ผ่าน", "bad")}<br><span class="muted small">${esc(r.msg)}</span></td>`).join("")}<td>${canAssign && !lockedV ? btn("นำออก", "staff-unassign", { sm: true, data: { prog: p.id, staff: x.s.id } }) : ""}</td></tr>`).join("")}</tbody></table></div>`, { flush: true })}
    ${panel("อาจารย์ประจำหลักสูตร", table([{ th: "ชื่อ", html: r => `<a href="#" data-act="staff-open" data-id="${r.staff}">${esc(staffName(r.staff))}</a>` }, { th: "ตำแหน่ง", val: r => POS_TH[IDX.staff.get(r.staff).pos] }, { th: "คุณวุฒิสูงสุด", val: r => DEG_TH[IDX.staff.get(r.staff).deg] }, { th: "ตั้งแต่", val: r => r.from }], progRegular(p)), { flush: true })}`;
};
act("staff-assign", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const pool = D.staffData.staff.filter(s => s.fac === p.fac && s.status === "ACTIVE");
  openModal("กำหนดอาจารย์ในหลักสูตร", `<form data-form="staff-assign" data-id="${p.id}"><div class="form-grid">${field("staff", "อาจารย์ (จาก ERP-HR)", { type: "select", options: pool.map(s => [s.id, `${staffName(s.id)} · ${DEG_TH[s.deg]} · ${(IDX.rolesByStaff.get(s.id) || []).filter(r => r.role === "PROGRAM_RESPONSIBLE").length} หลักสูตร`]), required: true, full: true })}${field("role", "บทบาท", { type: "select", options: [["PROGRAM_RESPONSIBLE", "อาจารย์ผู้รับผิดชอบหลักสูตร"], ["PROGRAM_REGULAR", "อาจารย์ประจำหลักสูตร"]], blank: false })}${field("from", "มีผลตั้งแต่ภาค", { value: `1/${latestVer(p).year}`, required: true })}</div><div class="note">ระบบจะตรวจเกณฑ์ 2565 ทันทีหลังบันทึก · CMS ไม่สร้างประวัติบุคลากรเอง (D10)</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`);
});
form("staff-assign", (d, f) => {
  if (!formErrors(f, Object.assign({}, !d.staff ? { staff: "เลือกอาจารย์" } : {}, !/^[123]\/\d{4}$/.test(d.from) ? { from: "รูปแบบ ภาค/ปี เช่น 1/2571" } : {}))) return;
  const p = IDX.prog.get(Number(f.dataset.id));
  if (D.roles.some(r => r.prog === p.id && r.staff === d.staff && !r.to)) { formErrors(f, { staff: "อาจารย์คนนี้อยู่ในหลักสูตรแล้ว" }); return; }
  D.roles.push({ prog: p.id, staff: d.staff, role: d.role, seq: progResponsible(p).length + 1, from: d.from, to: null });
  buildIndex(); audit("กำหนดอาจารย์ในหลักสูตร", `${p.code} ${d.staff}`); persist(); closeModal();
  const st = standardsCheck(p); toast(st.ok ? "บันทึกแล้ว — ผ่านเกณฑ์ 2565" : `บันทึกแล้ว — ยังไม่ผ่านเกณฑ์ ${st.fails} รายการ`); rerender();
});
act("staff-unassign", el => { const r = D.roles.find(x => x.prog === Number(el.dataset.prog) && x.staff === el.dataset.staff && !x.to); if (r) r.to = "2/2569"; buildIndex(); audit("นำอาจารย์ออกจากหลักสูตร", el.dataset.staff); persist(); rerender(); });

/* ---------- S12 การเงิน ---------- */
PTAB.finance = p => {
  const sc = D.finance.scenarios[p.id];
  if (!sc) return `<div class="note">ยังไม่มีการวิเคราะห์ต้นทุนของหลักสูตรนี้ ${can("finance.edit") && canEditProg(p) ? btn("เริ่มวิเคราะห์ (ค่าตั้งต้นตามระดับ)", "fin-new", { kind: "primary", sm: true, data: { id: p.id } }) : ""}</div>`;
  return financeEditor(p, sc);
};
function financeEditor(p, sc) {
  const be = breakeven(sc); const ed = can("finance.edit") && canEditProg(p) && sc.status !== "SIGNED"; const items = D.finance.costItems;
  const prof = D.finance.levelProfiles.find(x => x.level === p.level) || {};
  const ro = ed ? "" : " readonly";
  const num = (name, val, label, hint) => `<div class="field"><label for="fin-${name}">${esc(label)}</label><input id="fin-${name}" name="${name}" type="number" value="${val}" min="0" step="any" data-input="fin-live" data-id="${p.id}"${ro}>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
  return `<div class="actions">${pill(sc.status === "SIGNED" ? "ลงนามรับรองแล้ว" : "ร่าง", sc.status === "SIGNED" ? "good" : "warn")} ${btn("ตาราง มนพ. ข้อ 12/13/14", "open-doc", { data: { code: "DOC-FINANCE", id: p.id }, perm: "finance.view" })}${ed ? btn("บันทึก", "fin-save", { kind: "primary", data: { id: p.id } }) : ""}${sc.status !== "SIGNED" ? btn("ลงนามรับรอง (ผู้บริหารหน่วยงาน)", "fin-sign", { perm: "finance.sign", data: { id: p.id } }) : ""}${sc.status === "SIGNED" && !(sc.uniReview && sc.uniReview.status === "APPROVED") && can("finance.review") ? btn("ตรวจรับรอง (แผนมหาวิทยาลัย)", "fin-unireview", { kind: "primary", data: { id: p.id } }) : ""} ${sc.uniReview ? pill(sc.uniReview.status === "APPROVED" ? `แผนมหาวิทยาลัยรับรอง ${thDate(sc.uniReview.date)}` : "แผนมหาวิทยาลัยส่งกลับ", sc.uniReview.status === "APPROVED" ? "good" : "bad") : ""}</div>
    <div class="grid g-side"><form class="panel" id="fin-form" data-id="${p.id}"><header><h2>ข้อมูลนำเข้า (กระบวนการ 2.2B)</h2><span class="muted small">โปรไฟล์ระดับ: ${esc(IDX.level.get(p.level).abbr)} ${prof.terms || ""} ภาค · ${esc(prof.feeBasis || "")}</span></header><div class="body">
      <div class="form-grid">${num("feePerTerm", sc.feePerTerm, "ค่าธรรมเนียมเหมาจ่ายต่อภาค (บาท)", esc(sc.feeSource))}${num("subsidy", sc.subsidy == null ? "" : sc.subsidy, "เงินอุดหนุนรายหัวต่อปี", sc.subsidy == null ? "ต้องกรอก — P09/G15" : "")}
      ${num("dropout", sc.dropout * 100, "อัตราการออกกลางคัน (%)")}${num("allocationPct", sc.allocationPct * 100, "หักจัดสรรเงินรายได้ (%)", `ประกาศปีงบ ${sc.allocationYear} (ยืนยันแล้ว)`)}</div>
      <p class="lbl"><b>แผนรับ 5 ปี</b></p><div class="form-grid" style="grid-template-columns:repeat(5,minmax(0,1fr))">${sc.intake.map((n, i) => num("intake" + i, n, String(2571 + i))).join("")}</div>
      <p><b>ต้นทุนคงที่ต่อปี (FC)</b></p><div class="form-grid">${Object.entries(sc.fixed).map(([k, v]) => { const it = items.find(x => x.code === k); return num("fx_" + k, v, it.th, `${it.cat} · ${DS[it.status][0]}`); }).join("")}</div>
      <p><b>ต้นทุนผันแปรต่อคนต่อภาค (VC)</b></p><div class="form-grid">${Object.entries(sc.variablePerHead).map(([k, v]) => { const it = items.find(x => x.code === k); return num("vc_" + k, Math.round(v * 100) / 100, it.th, `${it.cat} · ${DS[it.status][0]}`); }).join("")}</div>
    </div></form>
    <div class="grid" id="fin-result">${financeResult(be, sc)}</div></div>`;
}
function financeResult(be, sc) {
  return panel("ผลการคำนวณ", kv([["รายรับต่อคนต่อปี", baht(be.revPerHeadYear) + " บาท"], [`หลังหักจัดสรร ${pct(sc.allocationPct)}`, baht(be.netRevPerHead) + " บาท"], ["ต้นทุนผันแปรต่อคนต่อปี", baht(be.vcPerHead) + " บาท"], ["ต้นทุนคงที่ต่อปี", baht(be.fc) + " บาท"], ["ส่วนเหลือต่อคน", baht(be.margin) + " บาท"]]) +
    `<div class="grid g2"><div class="panel stat"><span class="label">จุดคุ้มทุน (ทุกชั้นปีรวม)</span><span class="value">${be.beConcurrent ? fmt(be.beConcurrent) : "ไม่คุ้มทุน"}</span><span class="sub">คน</span></div><div class="panel stat"><span class="label">ต่อรุ่น (${be.years} ปี)</span><span class="value">${be.beCohort ? fmt(be.beCohort) : "—"}</span><span class="sub">คน/รุ่น · แผนรับ ${sc.intake[0]}</span></div></div>
    ${sc.intake[0] < (be.beCohort || Infinity) ? `<div class="note bad">แผนรับปีแรก ${sc.intake[0]} คน ต่ำกว่าจุดคุ้มทุนต่อรุ่น</div>` : `<div class="note">แผนรับสูงกว่าจุดคุ้มทุนต่อรุ่น</div>`}`) +
    panel("ส่วนเกิน/(ขาด) 5 ปี", barChart(be.proj.map(r => ({ label: "ปีงบ " + r.fy, v: Math.max(0, r.profit), valueLabel: (r.profit < 0 ? "(" + baht(-r.profit) + ")" : baht(r.profit)), tip: `ปีงบ ${r.fy}: นักศึกษา ${r.heads} คน · รายรับ ${baht(r.rev)} · ส่วนเกิน ${baht(r.profit)}` })), { aria: "ส่วนเกินรายปี", padL: 90 }) + `<p class="muted small">ปีที่ขาดทุนแสดงแท่งเป็นศูนย์และตัวเลขในวงเล็บ</p>`);
}
function readFin(p) {
  const f = $("#fin-form"); const sc = D.finance.scenarios[p.id]; const g = n => { const el = f.querySelector(`[name="${n}"]`); return el && el.value !== "" ? Number(el.value) : null; };
  const out = JSON.parse(JSON.stringify(sc));
  out.feePerTerm = g("feePerTerm") || 0; out.subsidy = g("subsidy"); out.dropout = (g("dropout") || 0) / 100; out.allocationPct = (g("allocationPct") || 0) / 100;
  out.intake = out.intake.map((_, i) => g("intake" + i) || 0); Object.keys(out.fixed).forEach(k => { out.fixed[k] = g("fx_" + k) || 0; }); Object.keys(out.variablePerHead).forEach(k => { out.variablePerHead[k] = g("vc_" + k) || 0; });
  return out;
}
onChange("fin-live", el => { const p = IDX.prog.get(Number(el.dataset.id)); const sc = readFin(p); $("#fin-result").innerHTML = financeResult(breakeven(sc), sc); });
act("fin-save", el => { const p = IDX.prog.get(Number(el.dataset.id)); D.finance.scenarios[p.id] = readFin(p); audit("บันทึกการวิเคราะห์ต้นทุน", p.code); persist(); toast("บันทึกการวิเคราะห์แล้ว"); rerender(); });
act("fin-sign", el => { const sc = D.finance.scenarios[el.dataset.id]; sc.status = "SIGNED"; sc.uniReview = null; notifyRole("UP", null, `รอตรวจรับรองต้นทุน: ${progTitle(IDX.prog.get(Number(el.dataset.id)), true)}`, `program-${el.dataset.id}-finance`); audit("ลงนามรับรองตารางการเงิน", el.dataset.id); persist(); toast("ลงนามรับรองแล้ว — ตารางพร้อมแนบเล่ม"); rerender(); });
act("fin-new", el => {
  const p = IDX.prog.get(Number(el.dataset.id)); const s = stat(p) || { plan: 30 }; const terms = { VOC: 6, HVOC: 4, MASTER: 4, DOCTOR: 6, BACH_CONT: 4 }[p.level] || 8;
  D.finance.scenarios[p.id] = { feePerTerm: { VOC: 400, HVOC: 1500, MASTER: 22500, DOCTOR: 30000 }[p.level] || 12000, feeSource: "ค่าตั้งต้นตามระดับ (ตรวจกับ ERP ปีงบ 2570)", creditFee: 0, terms, intake: [s.plan, s.plan, s.plan, s.plan, s.plan], dropout: .05, subsidy: ["VOC", "HVOC"].includes(p.level) ? null : 0,
    fixed: { SAL_FULL: 1500000, SAL_SUPPORT: 250000, UTILITY: 120000, DEP_EQUIP: 150000 }, variablePerHead: { COMP_TEACH: 1000, GE_FEE: 0, MATERIAL: 1200, STUDENT_DEV: 800, FIELD_SUPERVISION: 0, THESIS_EXAM: 0 }, allocationPct: .42, allocationYear: 2570, status: "DRAFT" };
  persist(); rerender();
});

/* ---------- แท็บอื่น ---------- */
PTAB.approval = p => {
  const cs = D.workflow.cases.filter(c => c.prog === p.id);
  return panel("เรื่องเสนออนุมัติของหลักสูตรนี้", table([{ th: "เลขที่", html: c => `<a href="#case-${c.id}" class="mono">${c.no}</a>` }, { th: "เรื่อง", wrap: true, val: c => c.title }, { th: "ประเภท", val: c => CASE_TYPE[c.type] }, { th: "สถานะ", html: c => pillOf(CASE_STATUS, c.status) + "<br>" + esc(caseStageText(c)) }, { th: "สร้างเมื่อ", val: c => thDate(c.created) }], cs, { empty: "ยังไม่มีเรื่องเสนอในระบบ (ฉบับเดิมย้ายจากระบบทะเบียน)" }), { flush: true }) +
    D.workflow.amendments.filter(a => a.prog === p.id).map(a => `<div class="note">${esc(a.no)} · ${esc(AMEND_KIND[a.kind])} · ${pillOf(AMEND_STATUS, a.status)}</div>`).join("");
};
PTAB.cisa = p => {
  const c = cisaOf(p); const lv = IDX.level.get(p.level);
  if (lv.channel !== "CISA") return `<div class="note">ระดับ ${esc(lv.abbr)} ไม่ส่ง CISA (CISA รองรับอนุปริญญา–เอก) · ช่องทางรายงานภายนอกเป็นค่าตั้งค่า ${gapPill("G17")}</div>`;
  return `<div class="actions">${btn("เปิดหน้าจัดการ CISA", "go", { kind: "primary", data: { to: "cisa-" + p.id }, perm: "cisa.view" })}</div>` + (c ? panel("สถานะใน CISA", cisaSteps(c)) : `<div class="empty">ยังไม่เคยส่ง CISA</div>`) +
    panel("การรับรองหลักสูตร (ประกาศ กมอ. 2568)", kv([["รับรองถึงปี", "พ.ศ. " + p.accredExpiry], ["รายงานหลังรุ่นแรกสำเร็จ", `ปีการศึกษา ${latestVer(p).year + latestVer(p).years}`], ["รับรองภายนอก (ก.พ./ก.ค.ศ./สภาวิชาชีพ)", "ไม่มีข้อมูล"]]));
};
function cisaSteps(c) {
  return `<ol class="steps">${D.meta.cisaSteps.map((t, i) => { const n = i + 1; const cls = n < c.step || c.step >= 12 ? "done" : n === c.step ? (c.returned ? "rejected" : "current") : "";
    return `<li class="${cls}"><span class="mk">${cls === "done" ? "✓" : n}</span><div><div class="st-title">${esc(t)}</div><div class="st-meta">${n === c.step && c.step < 12 ? (c.returned ? "ส่งกลับแก้ไข" : "อยู่ขั้นนี้") : n <= 5 ? "สถาบัน" : "สป.อว."}</div></div></li>`; }).join("")}</ol>`;
}
PTAB.performance = p => {
  const s = stat(p); const o = obeOf(p); if (!s) return `<div class="empty">ยังไม่มีข้อมูลผลการดำเนินงาน</div>`;
  return `<div class="note">ข้อมูลรับจากแพลตฟอร์มทะเบียนและโมดูล TQF ทุกคืน (UC18) — ในต้นแบบเป็นข้อมูลจำลอง ${gapPill("G13")}</div><div class="grid g4">
    <div class="panel stat"><span class="label">นักศึกษาทั้งหมด</span><span class="value">${fmt(s.total)}</span></div><div class="panel stat"><span class="label">อัตราคงอยู่</span><span class="value">${pct(s.retention)}</span></div>
    <div class="panel stat"><span class="label">ส่ง มคอ.3 / มคอ.5</span><span class="value">${pct(s.tqf3)} / ${pct(s.tqf5)}</span></div><div class="panel stat"><span class="label">มคอ.7 ปีล่าสุด</span><span class="value">${s.tqf7 ? "ส่งแล้ว" : "ยังไม่ส่ง"}</span></div></div>` +
    (o && Object.keys(o.attain).length ? panel("ผลบรรลุ PLO (จาก TQF) เป้าหมาย 70%", barChart(o.plos.map(x => ({ label: x.code, v: Math.round((o.attain[x.code] || 0) * 100), valueLabel: pct(o.attain[x.code]), tip: `${x.code}: ${pct(o.attain[x.code])}` })), { padL: 70, aria: "ผลบรรลุ PLO" })) : "") +
    `<div class="actions">${btn("รายงาน กมอ. ข้อ 8", "open-doc", { data: { code: "RPT-KMO8", id: p.id }, perm: "report.ops" })}${btn("QA snapshot", "open-doc", { data: { code: "RPT-QA", id: p.id }, perm: "report.ops" })}</div>`;
};
PTAB.documents = p => {
  const docs = D.documents.filter(d => d.scope === "program");
  const crs = Object.keys(D.tqf).filter(c => D.tqf[c].prog === p.id);
  return panel("เอกสารของหลักสูตร", `<ul class="list">${docs.map(d => `<li><div class="grow"><b>${esc(d.th)}</b><br><span class="muted small">${d.code} · ${d.fmt.join(", ").toUpperCase()} · ${d.uc}</span></div>${btn("เปิด", "open-doc", { data: { code: d.code, id: p.id }, perm: d.perm })}</li>`).join("")}</ul>`, { flush: true }) +
    (crs.length ? panel("มคอ.3 / มคอ.5 ของรายวิชาในหลักสูตร (ตัวอย่างจากโมดูล TQF)", `<ul class="list">${crs.map(c => `<li><div class="grow"><span class="mono">${c}</span> ${esc(IDX.course.get(c).th)}</div><span class="actions">${btn("มคอ.3", "open-doc", { data: { code: "DOC-TQF3", id: c } })}${btn("มคอ.5", "open-doc", { data: { code: "DOC-TQF5", id: c } })}</span></li>`).join("")}</ul>`, { flush: true }) : "");
};

/* ---------- S04 ตัวแก้ไขฉบับ (wizard ตามหมวด มคอ.2) ---------- */
const VSECTIONS = [
  ["h1", "หมวด 1 ข้อมูลทั่วไป", [["nameEn", "ชื่อหลักสูตรภาษาอังกฤษ", "text", true], ["degreeAbbr", "ชื่อย่อปริญญา (ไทย)", "text", true], ["degreeEn", "ชื่อปริญญาภาษาอังกฤษ (เต็ม/ย่อ)", "text", true], ["credits", "หน่วยกิตรวมขั้นต่ำ", "number", true], ["years", "ระยะเวลาศึกษา (ปี)", "number", true], ["language", "ภาษาที่ใช้", "select:ภาษาไทย|ภาษาอังกฤษ|ไทยและอังกฤษ", true], ["careers", "อาชีพที่ประกอบได้หลังสำเร็จการศึกษา", "textarea", true], ["place", "สถานที่จัดการเรียนการสอน/ฝึกภาคสนาม", "text", false]]],
  ["h2", "หมวด 2 ข้อมูลเฉพาะและผลลัพธ์การเรียนรู้", [["philosophy", "ปรัชญาของหลักสูตร", "textarea", true], ["approach", "แนวทางการจัดทำหลักสูตร", "textarea", false], ["rationale", "เหตุผลความจำเป็น (สรุป SWOT/TOWS)", "textarea", true], ["objectives", "วัตถุประสงค์ของหลักสูตร (บรรทัดละข้อ)", "textarea", true], ["lifelong", "ทักษะการเรียนรู้ตลอดชีวิต", "textarea", false]]],
  ["h3", "หมวด 3 ระบบการจัดการศึกษาและโครงสร้าง", [["system", "ระบบการจัดการศึกษา", "select:ทวิภาค|ไตรภาค|ระบบอื่น", true], ["summer", "ภาคฤดูร้อน", "select:ไม่มี|มี", true], ["schedule", "วัน–เวลาเรียน", "text", true], ["admission", "คุณสมบัติผู้เข้าศึกษา", "textarea", true], ["intake", "แผนรับต่อปี (คน)", "number", true], ["field", "ประสบการณ์ภาคสนาม/สหกิจศึกษา", "textarea", false], ["project", "ข้อกำหนดโครงงาน/วิจัย", "textarea", false]]],
  ["h4", "หมวด 4 หลักเกณฑ์การประเมินผล", [["grading", "ระบบการให้ระดับคะแนน", "select:ตามข้อบังคับ มนพ. (8 ระดับ)|แบบ S/U", true], ["feedback", "การให้ข้อมูลป้อนกลับ", "textarea", false], ["graduation", "เกณฑ์สำเร็จการศึกษาเพิ่มเติม", "textarea", true]]],
  ["h5", "หมวด 5 การพัฒนาอาจารย์และสิ่งสนับสนุน", [["devplan", "แผนพัฒนาอาจารย์ 5 ปี", "textarea", true], ["support", "สิ่งสนับสนุนการเรียนรู้", "textarea", true]]],
  ["h6", "หมวด 6 การประกันคุณภาพ", [["qa", "ระบบประกันคุณภาพหลักสูตร (AUN-QA)", "textarea", true], ["complaint", "ระบบจัดการข้อร้องเรียนและอุทธรณ์", "textarea", true]]],
];
route("edit", { perm: "program.edit", title: "แก้ไขฉบับหลักสูตร", render(args) {
  const rec = IDX.ver.get(Number(args[0])); if (!rec) return `<div class="note bad">ไม่พบฉบับ</div>`;
  const { p, v } = rec; if (!canEditProg(p)) return pageHead("แก้ไขฉบับหลักสูตร") + `<div class="note bad">ฉบับนี้อยู่นอกขอบเขตการแก้ไขของคุณ</div>`;
  if (!["DRAFT", "IN_REVIEW"].includes(v.state)) return pageHead("แก้ไขฉบับหลักสูตร") + lockNote(p);
  v.form = v.form || { credits: v.credits, years: v.years, language: "ภาษาไทย", system: "ทวิภาค", summer: "ไม่มี", intake: (stat(p) || { plan: 40 }).plan, grading: "ตามข้อบังคับ มนพ. (8 ระดับ)" };
  const sec = args[1] || "h1"; const cur = VSECTIONS.find(s => s[0] === sec) || VSECTIONS[0];
  const done = s => s[2].filter(f => f[3]).every(f => v.form[f[0]] !== undefined && String(v.form[f[0]]).trim() !== "");
  const total = VSECTIONS.reduce((a, s) => a + s[2].filter(f => f[3]).length, 0); const filled = VSECTIONS.reduce((a, s) => a + s[2].filter(f => f[3] && v.form[f[0]] !== undefined && String(v.form[f[0]]).trim() !== "").length, 0);
  const extra = [["structure", "โครงสร้าง/รายวิชา (S05)", !!structureOf(p)], ["obe", "PLO/YLO/mapping (S08/S09)", !!obeOf(p)], ["staff", "อาจารย์ (S10)", standardsCheck(p).ok], ["finance", "งบประมาณ/จุดคุ้มทุน (S12)", !!D.finance.scenarios[p.id]]];
  return pageHead(`แก้ไข: ${p.name} (พ.ศ. ${v.year})`, { crumbs: `<a href="#program-${p.id}">${esc(progTitle(p, true))}</a> › ตัวแก้ไขฉบับ`, lead: `บันทึกอัตโนมัติเมื่อกดบันทึกแต่ละหมวด · ความครบถ้วน ${filled}/${total} ช่องบังคับ`, actions: btn("ดูร่างเล่ม มคอ.2", "open-doc", { data: { code: "DOC-TQF2", id: p.id } }) + (openCaseOf(p) ? `<a class="btn primary" href="#case-${openCaseOf(p).id}">ไปที่เรื่องเสนออนุมัติ</a>` : "") }) +
    `<div class="meter" aria-label="ความครบถ้วน"><i style="width:${Math.round(filled * 100 / total)}%"></i></div>
    <div class="grid g-side" style="grid-template-columns:minmax(0,1fr) minmax(0,2.4fr)">
      ${panel("หมวด", `<ul class="list">${VSECTIONS.map(s => `<li><a href="#edit-${v.id}-${s[0]}"${s[0] === sec ? ' style="font-weight:600"' : ""}>${esc(s[1])}</a>${done(s) ? pill("ครบ", "good") : pill("ยังไม่ครบ", "warn")}</li>`).join("")}${extra.map(([t, l, ok]) => `<li><a href="#program-${p.id}-${t}">${esc(l)}</a>${ok ? pill("ครบ", "good") : pill("ตรวจ", "warn")}</li>`).join("")}</ul>`, { flush: true })}
      <form class="panel" data-form="ver-section" data-ver="${v.id}" data-sec="${sec}"><header><h2>${esc(cur[1])}</h2>${srcPill(false)}</header><div class="body"><div class="form-grid">${cur[2].map(([k, l, t, req]) => {
        if (t.startsWith("select:")) return field(k, l, { type: "select", options: t.slice(7).split("|"), value: v.form[k], required: req });
        return field(k, l, { type: t === "textarea" ? "textarea" : t, value: v.form[k], required: req, full: t === "textarea", min: t === "number" ? 0 : null });
      }).join("")}</div><div class="form-foot">${btn("ดูตัวอย่างในเล่ม", "open-doc", { data: { code: "DOC-TQF2", id: p.id } })}<button class="btn primary" type="submit">บันทึกหมวดนี้</button></div></div></form></div>`;
} });
form("ver-section", (d, f) => {
  const { p, v } = IDX.ver.get(Number(f.dataset.ver)); const sec = VSECTIONS.find(s => s[0] === f.dataset.sec); const errs = {};
  sec[2].forEach(([k, l, t, req]) => { if (req && !d[k]) errs[k] = "จำเป็นต้องกรอก"; if (t === "number" && d[k] && !(Number(d[k]) > 0)) errs[k] = "ต้องเป็นตัวเลขมากกว่า 0"; });
  if (d.credits && p.level === "BACH" && Number(d.credits) < 120) errs.credits = "ปริญญาตรีต้องไม่น้อยกว่า 120 หน่วยกิต (เกณฑ์ 2565)";
  if (d.credits && p.level === "MASTER" && Number(d.credits) < 36) errs.credits = "ปริญญาโทต้องไม่น้อยกว่า 36 หน่วยกิต";
  if (!formErrors(f, errs)) { toast("กรอกข้อมูลไม่ครบ ตรวจช่องที่มีข้อความสีแดง"); return; }
  Object.assign(v.form, d); if (d.credits) v.credits = Number(d.credits); if (d.years) v.years = Number(d.years);
  audit("แก้ไขฉบับหลักสูตร", `${p.code} ${sec[1]}`); persist(); toast(`บันทึก${sec[1]}แล้ว`);
  const i = VSECTIONS.indexOf(sec); go(`edit-${v.id}-${(VSECTIONS[i + 1] || sec)[0]}`);
});

/* ---------- สร้างหลักสูตรใหม่ / ฉบับปรับปรุง (UC02/UC03) ---------- */
route("newprog", { perm: "program.create", title: "สร้างหลักสูตร", render() {
  const u = me(); const facs = D.meta.faculties.filter(f => u.scope.type === "UNIVERSITY" || f.id === (u.scope.fac || (u.scope.progs && IDX.prog.get(u.scope.progs[0]).fac)));
  const mine = D.programs.filter(p => canEditProg(p) && p.life === "ACTIVE" && latestVer(p).state === "APPROVED");
  return pageHead("สร้างหลักสูตรใหม่หรือฉบับปรับปรุง", { crumbs: `<a href="#programs">ทะเบียนหลักสูตร</a>`, lead: "หลักสูตรใหม่เริ่มจากแผนเปิดหลักสูตร (ลกสบ.01) · ฉบับปรับปรุงคัดลอกจากฉบับที่อนุมัติแล้ว — ระบบสร้างเรื่องเสนออนุมัติสถานะร่างให้อัตโนมัติ" }) +
    `<div class="grid g2"><form class="panel" data-form="new-program"><header><h2>หลักสูตรใหม่ (UC02)</h2></header><div class="body"><div class="form-grid">
      ${field("fac", "คณะ/วิทยาลัย", { type: "select", options: facs.map(f => [f.id, f.name]), required: true, full: true, value: facs.length === 1 ? facs[0].id : "" })}
      ${field("level", "ระดับ", { type: "select", options: D.meta.levels.filter(l => l.code !== "SHORT").map(l => [l.code, l.th]), required: true })}${field("year", "ปีที่เริ่มใช้ (พ.ศ.)", { type: "number", value: 2571, min: 2570, max: 2580, required: true })}
      ${field("degree", "ชื่อปริญญา (ไทย)", { required: true, placeholder: "เช่น วิทยาศาสตรบัณฑิต" })}${field("name", "สาขาวิชา", { required: true })}
      ${field("credits", "หน่วยกิตรวม", { type: "number", required: true, min: 1 })}${field("plan", "แผนรับต่อปี (คน)", { type: "number", required: true, min: 1 })}
      ${field("isced", "ISCED-F (4 หลัก)", { placeholder: "เช่น 0613", required: true })}${field("competitor", "หลักสูตรคู่แข่ง/ใกล้เคียง", { placeholder: "สถาบันและสาขา" })}
      ${field("rationale", "เหตุผลความจำเป็นและความต้องการของตลาดแรงงาน", { type: "textarea", required: true, full: true })}
    </div><div class="form-foot"><button class="btn primary" type="submit">สร้างร่างหลักสูตรใหม่</button></div></div></form>
    <form class="panel" data-form="new-revision"><header><h2>ฉบับปรับปรุง (UC03)</h2></header><div class="body">${mine.length ? `<div class="form-grid">${field("prog", "หลักสูตรที่จะปรับปรุง", { type: "select", options: mine.map(p => [p.id, `${progTitle(p, true)} (พ.ศ. ${p.latestYear})`]), required: true, full: true })}${field("year", "ปีหลักสูตรปรับปรุง (พ.ศ.)", { type: "number", value: 2571, required: true })}${field("reason", "เหตุผลการปรับปรุง", { type: "textarea", required: true, full: true, hint: "เช่น ครบรอบ 5 ปี ผล มคอ.7 ข้อเสนอผู้ใช้บัณฑิต" })}</div><div class="form-foot"><button class="btn primary" type="submit">คัดลอกเป็นฉบับปรับปรุง</button></div>` : `<div class="empty">ไม่มีหลักสูตรที่คุณแก้ไขได้และอนุมัติแล้ว</div>`}</div></form></div>`;
} });
form("new-program", (d, f) => {
  const errs = {}; ["fac", "level", "degree", "name", "rationale"].forEach(k => { if (!d[k]) errs[k] = "จำเป็นต้องกรอก"; });
  if (!/^\d{4}$/.test(d.isced || "")) errs.isced = "รหัส ISCED-F 4 หลัก"; if (!(Number(d.credits) > 0)) errs.credits = "ระบุหน่วยกิต"; if (!(Number(d.plan) > 0)) errs.plan = "ระบุแผนรับ";
  if (d.level === "BACH" && Number(d.credits) < 120) errs.credits = "ปริญญาตรีต้อง ≥ 120 หน่วยกิต";
  if (D.programs.some(p => p.fac === d.fac && p.level === d.level && p.name === d.name)) errs.name = "มีหลักสูตรนี้ในคณะแล้ว — ใช้ฉบับปรับปรุงแทน";
  if (!formErrors(f, errs)) return;
  const id = Math.max(...D.programs.map(p => p.id)) + 1; const vid = id * 100 + 1;
  const p = { id, code: `NPU-${d.fac.padStart(2, "0")}-${id}`, fac: d.fac, level: d.level, name: d.name, degree: d.degree, life: "DRAFT", latestYear: Number(d.year), nextReview: Number(d.year) + 5, accredExpiry: Number(d.year) + 5, checoCode: null, simulated: true,
    versions: [{ id: vid, year: Number(d.year), credits: Number(d.credits), years: { BACH: 4, MASTER: 2, DOCTOR: 3, HVOC: 2, VOC: 3 }[d.level] || 4, minGpa: "2.00", plans: [{ regId: null, plan: "ปกติ", credits: Number(d.credits) }], state: "DRAFT", kind: "NEW", senate: null, ack: null, source: "SIM", form: { rationale: d.rationale, intake: d.plan } }] };
  D.programs.push(p); D.stats[id] = { plan: Number(d.plan), intake: [0, 0, 0], years: [2567, 2568, 2569], total: 0, grad: 0, retention: 0, tqf3: 0, tqf5: 0, tqf7: false };
  const rk = ["MASTER", "DOCTOR", "GRAD_DIP"].includes(d.level) ? "NEW_GRAD" : "NEW";
  const cid = Math.max(...D.workflow.cases.map(c => c.id)) + 1;
  D.workflow.cases.push({ id: cid, no: `CMS-2569-${String(cid).padStart(4, "0")}`, prog: id, ver: vid, type: "NEW", route: rk, title: `ขอความเห็นชอบหลักสูตร${d.degree} สาขาวิชา${d.name} (หลักสูตรใหม่ พ.ศ. ${d.year})`, status: "DRAFT", created: today(), by: S.user,
    steps: D.meta.routes[rk].map((b, i) => ({ body: b, status: i === 0 ? "CURRENT" : "PENDING", meeting: null, date: null, result: null, note: "" })) });
  const u = me(); if (u.scope.type === "PROGRAM") u.scope.progs.push(id);
  buildIndex(); audit("สร้างหลักสูตรใหม่", p.code); persist(); toast("สร้างร่างหลักสูตรใหม่และเรื่องเสนออนุมัติแล้ว"); go(`edit-${vid}`);
});
function makeRevision(p, year, reason) {
  const base = latestVer(p); const vid = p.id * 100 + p.versions.length + 1;
  const v = JSON.parse(JSON.stringify(base)); Object.assign(v, { id: vid, year, state: "DRAFT", kind: "REVISION", senate: null, ack: null, source: "SIM", basedOn: base.id, form: Object.assign({}, base.form || {}, { rationale: reason }) });
  v.plans.forEach(x => { x.regId = null; }); p.versions.push(v);
  const rk = ["MASTER", "DOCTOR", "GRAD_DIP"].includes(p.level) ? "NEW_GRAD" : "REVISION"; const cid = Math.max(...D.workflow.cases.map(c => c.id)) + 1;
  D.workflow.cases.push({ id: cid, no: `CMS-2569-${String(cid).padStart(4, "0")}`, prog: p.id, ver: vid, type: "REVISION", route: rk, title: `ขอความเห็นชอบหลักสูตร${p.degree} สาขาวิชา${p.name} (หลักสูตรปรับปรุง พ.ศ. ${year})`, status: "DRAFT", created: today(), by: S.user,
    steps: D.meta.routes[rk].map((b, i) => ({ body: b, status: i === 0 ? "CURRENT" : "PENDING", meeting: null, date: null, result: null, note: "" })) });
  buildIndex(); audit("สร้างฉบับปรับปรุง", `${p.code} ${year}`); persist(); return vid;
}
form("new-revision", (d, f) => {
  const errs = {}; if (!d.prog) errs.prog = "เลือกหลักสูตร"; if (!d.reason) errs.reason = "ระบุเหตุผล"; const p = IDX.prog.get(Number(d.prog));
  if (p && Number(d.year) <= p.latestYear) errs.year = `ต้องมากกว่าฉบับปัจจุบัน (${p.latestYear})`; if (p && openCaseOf(p)) errs.prog = "หลักสูตรนี้มีเรื่องเปิดอยู่แล้ว";
  if (!formErrors(f, errs)) return; const vid = makeRevision(p, Number(d.year), d.reason); toast("สร้างฉบับปรับปรุงแล้ว (คัดลอกโครงสร้าง OBE อาจารย์จากฉบับเดิม)"); go(`edit-${vid}`);
});
act("new-revision", el => { const p = IDX.prog.get(Number(el.dataset.id)); if (openCaseOf(p)) { toast("หลักสูตรนี้มีเรื่องเปิดอยู่แล้ว"); return; } const vid = makeRevision(p, Math.max(2571, p.latestYear + 1), "ปรับปรุงตามรอบ"); go(`edit-${vid}`); });

act("fin-unireview", el => openModal("ตรวจรับรองการวิเคราะห์ต้นทุน (กองนโยบายและแผน)", `<form data-form="fin-unireview" data-id="${el.dataset.id}">${field("result", "ผล", { type: "select", options: [["APPROVED", "รับรอง — ใช้ประกอบการเสนอกรรมการกลั่นกรอง"], ["RETURNED", "ส่งกลับให้แผนคณะแก้ไข"]], required: true, full: true })}${field("note", "ข้อสังเกต", { type: "textarea", full: true, rows: 2 })}<div class="note">ตรวจอัตราค่าธรรมเนียมตามประกาศ อัตราหักจัดสรร ต้นทุนบังคับตามระดับ และจุดคุ้มทุนเทียบแผนรับ</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`));
form("fin-unireview", (d, f) => {
  if (!d.result) { formErrors(f, { result: "เลือกผล" }); return; } if (d.result === "RETURNED" && !d.note) { formErrors(f, { note: "ระบุสิ่งที่ต้องแก้" }); return; }
  const sc = D.finance.scenarios[f.dataset.id]; sc.uniReview = { status: d.result, note: d.note, date: today(), by: S.user }; if (d.result === "RETURNED") sc.status = "DRAFT";
  notifyRole("FP", IDX.prog.get(Number(f.dataset.id)).fac, `แผนมหาวิทยาลัย${d.result === "APPROVED" ? "รับรอง" : "ส่งกลับ"}การวิเคราะห์ต้นทุน`, `program-${f.dataset.id}-finance`);
  audit("ตรวจรับรองต้นทุน (แผนมหาวิทยาลัย)", `${f.dataset.id} ${d.result}`); persist(); closeModal(); rerender();
});
