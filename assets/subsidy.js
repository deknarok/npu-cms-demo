/* subsidy.js — G15 เงินอุดหนุนรายหัว ปวช./ปวส. รายหลักสูตร (หน้าบันทึกและจัดการ)
   แผนคณะ (FP) บันทึกของคณะตน · แผนมหาวิทยาลัย (UP) บันทึกทุกหลักสูตร/กำหนดอัตรามาตรฐานตามระดับ/ยืนยัน
   ค่าที่ยืนยันแล้วใช้ในการวิเคราะห์ต้นทุน/จุดคุ้มทุนอัตโนมัติ (sc.subsidy) */
"use strict";

const SUB_PARTS = [["teach", "ค่าจัดการเรียนการสอน"], ["book", "ค่าหนังสือเรียน"], ["equip", "ค่าอุปกรณ์การเรียน"], ["uniform", "ค่าเครื่องแบบ"], ["activity", "ค่ากิจกรรมพัฒนาคุณภาพผู้เรียน"]];
const SUB_STATUS = { DRAFT: ["ร่าง (รอแผนมหาวิทยาลัยยืนยัน)", "warn"], CONFIRMED: ["ยืนยันแล้ว", "good"] };
const SUB_LEVELS = ["VOC", "HVOC"];
function subsidyList() { D.finance.subsidies = D.finance.subsidies || []; return D.finance.subsidies; }
function subsidyFY() { return Number(S.ui.subFY || 2570); }
/* ค่าที่ใช้ของหลักสูตร: รายหลักสูตร > อัตรามาตรฐานของระดับ */
function subsidyOf(p, fy = subsidyFY(), confirmedOnly = false) {
  const L = subsidyList().filter(x => x.fy === fy && (!confirmedOnly || x.status === "CONFIRMED"));
  return L.find(x => x.prog === p.id) || L.find(x => x.level === p.level && !x.prog) || null;
}
function canSubEdit(p) { return can("finance.review") || (can("finance.edit") && myFac(p)); }

route("subsidy", { perm: "finance.view", title: "เงินอุดหนุนรายหัว ปวช./ปวส.", render() {
  const fy = subsidyFY(); const f = S.filters.sub || {};
  const progs = D.programs.filter(p => SUB_LEVELS.includes(p.level) && inScope(p) && p.life !== "CLOSED" && (!f.fac || p.fac === f.fac) && (!f.level || p.level === f.level));
  const rows = progs.map(p => { const r = subsidyOf(p, fy); const st = stat(p); const n = st && st.real ? st.total : null; return { p, r, n, est: r && n != null ? r.rate * n : null }; });
  const std = lv => subsidyList().find(x => x.fy === fy && x.level === lv && !x.prog);
  const tot = rows.reduce((a, x) => a + (x.est || 0), 0); const pg = paged("sub", rows, 30);
  return pageHead("เงินอุดหนุนรายหัว ปวช./ปวส. (G15)", { lead: `บันทึกอัตราเงินอุดหนุนรายหัวต่อคนต่อปีรายหลักสูตร — ใช้เป็นรายรับในการวิเคราะห์ต้นทุน/จุดคุ้มทุนเมื่อยืนยันแล้ว · แผนคณะบันทึกของคณะ · แผนมหาวิทยาลัยกำหนดอัตรามาตรฐานและยืนยัน`,
    actions: `<form class="filters" data-form="sub-fy" style="display:inline-flex"><label for="f-subfy">ปีงบประมาณ</label><input id="f-subfy" name="fy" type="number" min="2565" max="2580" value="${fy}" style="width:90px"><button class="btn sm" type="submit">ดู</button></form>` + btn("ส่งออก CSV", "sub-csv") }) +
    `<div class="grid g4">${SUB_LEVELS.map(lv => { const s = std(lv); return `<div class="panel stat"><span class="label">อัตรามาตรฐาน ${levelAbbr(lv)} ปีงบ ${fy}</span><span class="value">${s ? baht(s.rate) : "—"}</span><span class="sub">${s ? pillOf(SUB_STATUS, s.status) : pill("ยังไม่กำหนด", "warn")} ${can("finance.review") ? btn(s ? "แก้" : "กำหนด", "sub-edit", { sm: true, data: { level: lv } }) : ""}</span></div>`; }).join("")}
      <div class="panel stat"><span class="label">หลักสูตรที่มีอัตรา</span><span class="value">${rows.filter(x => x.r).length}/${rows.length}</span><span class="sub">รายหลักสูตร ${rows.filter(x => x.r && x.r.prog).length}</span></div>
      <div class="panel stat"><span class="label">ประมาณการรวม (อัตรา × นักศึกษาปัจจุบัน REG)</span><span class="value">${baht(tot)}</span><span class="sub">บาท/ปี</span></div></div>
    <section class="panel"><header><form class="filters" data-form="sub-filter" style="width:100%"><select name="fac" aria-label="คณะ"><option value="">ทุกคณะ/วิทยาลัย</option>${D.meta.faculties.map(x => `<option value="${x.id}"${f.fac === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select><select name="level" aria-label="ระดับ"><option value="">ปวช.+ปวส.</option>${SUB_LEVELS.map(l => `<option value="${l}"${f.level === l ? " selected" : ""}>${levelAbbr(l)}</option>`).join("")}</select><button class="btn primary" type="submit">กรอง</button></form></header></section>` +
    panel(`${rows.length} หลักสูตร`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.p.id}-finance">${esc(progTitle(x.p, true))}</a><br><span class="muted small">${esc(IDX.fac.get(x.p.fac).name)}</span>` }, { th: "ระดับ", val: x => levelAbbr(x.p.level) },
      { th: "อัตรา/คน/ปี", num: true, html: x => x.r ? `${baht(x.r.rate)}<br><span class="muted small">${x.r.prog ? "รายหลักสูตร" : "อัตรามาตรฐาน"}</span>` : pill("ยังไม่มี", "warn") }, { th: "สถานะ", html: x => x.r ? pillOf(SUB_STATUS, x.r.status) : "—" },
      { th: "นักศึกษา (REG)", num: true, val: x => x.n == null ? "—" : fmt(x.n) }, { th: "ประมาณการ/ปี", num: true, val: x => x.est == null ? "—" : baht(x.est) }, { th: "อ้างอิง", wrap: true, val: x => x.r ? x.r.ref : "" },
      { th: "", html: x => `<span class="actions">${canSubEdit(x.p) ? btn(x.r && x.r.prog ? "แก้" : "บันทึก", "sub-edit", { sm: true, data: { prog: x.p.id } }) : ""}${x.r && x.r.status === "DRAFT" && can("finance.review") ? btn("ยืนยัน", "sub-confirm", { sm: true, kind: "primary", data: { id: x.r.id } }) : ""}${btn("ประวัติ", "sub-hist", { sm: true, data: { prog: x.p.id } })}</span>` }], pg.rows, { empty: "ไม่มีหลักสูตร ปวช./ปวส. ในขอบเขต" }), { flush: true }) + pg.pager +
    `<p class="muted small">ข้อมูลจริงยังไม่มี (G15) — ไม่จำลองค่า · องค์ประกอบตามโครงการสนับสนุนค่าใช้จ่ายในการจัดการศึกษา (ใส่ได้ทีละรายการ หรือใส่ยอดรวม) · ค่าที่ยืนยันแล้วเติมลงช่อง "เงินอุดหนุนรายหัวต่อปี" ของการวิเคราะห์ต้นทุนอัตโนมัติ</p>`;
} });
form("sub-fy", d => { S.ui.subFY = Number(d.fy) || 2570; rerender(); });
form("sub-filter", d => { S.filters.sub = d; S.ui["pg-sub"] = 1; rerender(); });
act("sub-edit", el => {
  const fy = subsidyFY(); const p = el.dataset.prog ? IDX.prog.get(Number(el.dataset.prog)) : null; const lv = el.dataset.level;
  const cur = subsidyList().find(x => x.fy === fy && (p ? x.prog === p.id : x.level === lv && !x.prog)) || { parts: {} };
  openModal(`เงินอุดหนุนรายหัว ปีงบ ${fy} — ${p ? progTitle(p, true) : "อัตรามาตรฐาน " + levelAbbr(lv)}`, `<form data-form="sub-save" data-prog="${p ? p.id : ""}" data-level="${p ? p.level : lv}"><div class="form-grid">
    ${SUB_PARTS.map(([k, t]) => field("p_" + k, `${t} (บาท/คน/ปี)`, { type: "number", min: 0, step: "any", value: (cur.parts || {})[k] })).join("")}
    ${field("rate", "ยอดรวมต่อคนต่อปี (เว้นว่าง = รวมองค์ประกอบ)", { type: "number", min: 0, step: "any", value: cur.rate })}
    ${field("ref", "อ้างอิง (หนังสือ/ประกาศ/มติ)", { value: cur.ref, required: true, full: true })}${field("note", "หมายเหตุ", { type: "textarea", value: cur.note, full: true, rows: 2 })}</div>
    <div class="note">${can("finance.review") ? "แผนมหาวิทยาลัย: บันทึกแล้วยืนยันได้ทันที" : "แผนคณะ: บันทึกเป็นร่าง รอแผนมหาวิทยาลัยยืนยัน"}</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`, { wide: true });
});
form("sub-save", (d, f) => {
  const parts = {}; SUB_PARTS.forEach(([k]) => { if (d["p_" + k] !== "") parts[k] = Number(d["p_" + k]); });
  const sum = Object.values(parts).reduce((a, b) => a + b, 0); const rate = d.rate !== "" ? Number(d.rate) : sum; const errs = {};
  if (!(rate > 0)) errs.rate = "ระบุยอดรวมหรือองค์ประกอบอย่างน้อย 1 รายการ"; if (d.rate !== "" && sum && Math.abs(sum - rate) > 0.5) errs.rate = `ยอดรวมไม่ตรงผลรวมองค์ประกอบ (${baht(sum)})`; if (!d.ref) errs.ref = "ระบุหลักฐาน";
  if (!formErrors(f, errs)) return;
  const fy = subsidyFY(); const prog = f.dataset.prog ? Number(f.dataset.prog) : null; const L = subsidyList();
  const old = L.find(x => x.fy === fy && (prog ? x.prog === prog : x.level === f.dataset.level && !x.prog));
  const rec = { id: old ? old.id : Math.max(0, ...L.map(x => x.id || 0)) + 1, prog, level: f.dataset.level, fy, rate, parts, ref: d.ref, note: d.note, by: S.user, at: today(),
    status: can("finance.review") ? "CONFIRMED" : "DRAFT", confirmedBy: can("finance.review") ? S.user : null, history: ((old && old.history) || []).concat(old ? [{ rate: old.rate, status: old.status, by: old.by, at: old.at, ref: old.ref }] : []) };
  if (old) Object.assign(old, rec); else L.push(rec);
  if (rec.status === "DRAFT") notifyRole("UP", null, `รอยืนยันเงินอุดหนุนรายหัว ${prog ? progTitle(IDX.prog.get(prog), true) : levelAbbr(rec.level)} ปีงบ ${fy}`, "subsidy");
  syncSubsidy(); audit("บันทึกเงินอุดหนุนรายหัว", `${prog || rec.level} ${fy} ${rate}`); persist(); closeModal(); toast(rec.status === "CONFIRMED" ? "บันทึกและยืนยันแล้ว — ใช้ในการวิเคราะห์ต้นทุน" : "บันทึกร่างแล้ว — รอแผนมหาวิทยาลัยยืนยัน"); rerender();
});
act("sub-confirm", el => { const r = subsidyList().find(x => x.id === Number(el.dataset.id)); r.status = "CONFIRMED"; r.confirmedBy = S.user; syncSubsidy(); audit("ยืนยันเงินอุดหนุนรายหัว", `${r.prog || r.level} ${r.fy}`); persist(); rerender(); });
act("sub-hist", el => {
  const p = IDX.prog.get(Number(el.dataset.prog)); const L = subsidyList().filter(x => x.prog === p.id || (x.level === p.level && !x.prog)).sort((a, b) => b.fy - a.fy);
  openModal(`ประวัติเงินอุดหนุน — ${progTitle(p, true)}`, table([{ th: "ปีงบ", val: x => x.fy }, { th: "ประเภท", val: x => x.prog ? "รายหลักสูตร" : "อัตรามาตรฐาน" }, { th: "อัตรา", num: true, val: x => baht(x.rate) }, { th: "องค์ประกอบ", wrap: true, val: x => SUB_PARTS.filter(([k]) => x.parts[k] != null).map(([k, t]) => `${t} ${baht(x.parts[k])}`).join(" · ") }, { th: "สถานะ", html: x => pillOf(SUB_STATUS, x.status) }, { th: "แก้ล่าสุด", val: x => `${userName(x.by)} ${thDate(x.at)}` }, { th: "ก่อนหน้า", wrap: true, val: x => (x.history || []).map(h => `${baht(h.rate)} (${thDate(h.at)})`).join(", ") }], L, { empty: "ยังไม่มีข้อมูล" }), { wide: true });
});
act("sub-csv", () => { const fy = subsidyFY(); const rows = D.programs.filter(p => SUB_LEVELS.includes(p.level) && inScope(p)).map(p => ({ p, r: subsidyOf(p, fy) }));
  saveFile(`เงินอุดหนุนรายหัว-${fy}.csv`, csv(rows, [{ th: "รหัสหลักสูตร", val: x => x.p.code }, { th: "หลักสูตร", val: x => progTitle(x.p, true) }, { th: "คณะ/วิทยาลัย", val: x => IDX.fac.get(x.p.fac).name }, { th: "ระดับ", val: x => levelAbbr(x.p.level) }, { th: "ปีงบ", val: () => fy }, { th: "อัตรา/คน/ปี", val: x => x.r ? x.r.rate : "" }, { th: "ประเภท", val: x => x.r ? (x.r.prog ? "รายหลักสูตร" : "มาตรฐาน") : "" }, { th: "สถานะ", val: x => x.r ? x.r.status : "" }, { th: "อ้างอิง", val: x => x.r ? x.r.ref : "" }].concat(SUB_PARTS.map(([k, t]) => ({ th: t, val: x => x.r && x.r.parts[k] != null ? x.r.parts[k] : "" }))))); });

/* ค่าที่ยืนยันแล้ว → ช่องเงินอุดหนุนในการวิเคราะห์ต้นทุน (ถ้ายังไม่ได้กรอกเอง หรือกรอกจากหน้านี้) */
function syncSubsidy() {
  Object.entries(D.finance.scenarios).forEach(([pid, sc]) => { const p = IDX.prog.get(Number(pid)); if (!p || !SUB_LEVELS.includes(p.level)) return;
    const r = subsidyOf(p, sc.allocationYear || subsidyFY(), true) || subsidyOf(p, subsidyFY(), true);
    if (r && (sc.subsidy == null || sc.subsidySource === "SUBSIDY_TABLE")) { sc.subsidy = r.rate; sc.subsidySource = "SUBSIDY_TABLE"; } });
}
const _finEditor = financeEditor;
financeEditor = function (p, sc) {
  if (SUB_LEVELS.includes(p.level)) { syncSubsidy(); const r = subsidyOf(p);
    const note = r ? `<div class="note">เงินอุดหนุนรายหัวปีงบ ${r.fy}: <b>${baht(r.rate)}</b> บาท/คน/ปี ${pillOf(SUB_STATUS, r.status)} ${r.prog ? "รายหลักสูตร" : "อัตรามาตรฐาน"} — <a href="#subsidy">จัดการ</a></div>` : `<div class="note warn">ยังไม่มีเงินอุดหนุนรายหัวของหลักสูตรนี้ ${gapPill("G15")} — <a href="#subsidy">บันทึกที่หน้าเงินอุดหนุนรายหัว</a></div>`;
    return note + _finEditor(p, sc); }
  return _finEditor(p, sc);
};
(function () { const g = NAV.find(x => x[0] === "ประชุมและติดตาม")[1]; const i = g.findIndex(x => x[0] === "finance"); g.splice(i + 1, 0, ["subsidy", "เงินอุดหนุนรายหัว ปวช./ปวส.", "finance.view"]); })();
