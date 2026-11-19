/* history.js — D12 ทะเบียนการปรับปรุงหลักสูตร (design/15-revision-history.md)
   ปรับปรุงใหญ่ (ฉบับใหม่) และปรับปรุงเล็กน้อย (สมอ.08) ทุกครั้ง: ครั้งที่ เหตุผล ประเด็นสำคัญ มติ วันมีผล รุ่นที่ใช้
   เปรียบเทียบฉบับ (คำนวณจาก snapshot) · หลักสูตร ณ รุ่นนักศึกษา · ตรวจความถูกต้องของบันทึก (hash chain) */
"use strict";

const HKIND = { NEW: ["หลักสูตรใหม่", "info"], MAJOR: ["ปรับปรุง (ฉบับใหม่)", "warn"], MINOR: ["ปรับปรุงเล็กน้อย (สมอ.08)", "neutral"], SUSPEND: ["งดรับนักศึกษา", "warn"], CLOSE: ["ปิดดำเนินการ", "bad"] };
const HSTATUS = { APPROVED: ["อนุมัติแล้ว", "good"], IN_PROGRESS: ["ระหว่างดำเนินการ", "info"] };
function reasonTh(c) { return (D.hist.reasons.find(r => r.code === c) || { th: c }).th; }
function areaTh(a) { return (D.hist.areas[a] || [a])[0]; }
function areaSig(a) { return (D.hist.areas[a] || [, "MINOR"])[1]; }
(function () { if (!D.hist) return; })();

/* ---------- snapshot ของฉบับ ---------- */
function liveSnap(p, v) {
  const o = obeOf(p); const s = structureOf(p);
  const strip = n => ({ title: n.title, min: n.min, courses: [...(n.courses || [])], children: (n.children || []).map(strip) });
  return { credits: v.credits, years: v.years, minGpa: v.minGpa, plans: v.plans.map(x => x.plan), tree: s ? strip(s) : null, framework: o ? "PLO" : null,
    plos: o ? o.plos.map(x => ({ code: x.code, text: x.text, domain: x.domain })) : null, staff: progResponsible(p).map(r => r.staff), studyPlan: D.design.studyPlans[p.id] ? JSON.parse(JSON.stringify(D.design.studyPlans[p.id])) : null };
}
function snapOf(p, v) {
  if (D.hist.snapshots[v.id]) return D.hist.snapshots[v.id];
  if (v.id === latestVer(p).id || (v.id === activeVer(p).id && latestVer(p).state === "APPROVED")) return liveSnap(p, v);
  return { credits: v.credits, years: v.years, minGpa: v.minGpa, plans: v.plans.map(x => x.plan), tree: null, framework: null, plos: null, staff: null, studyPlan: null };
}
function flatTree(n, path = [], out = new Map()) { if (!n) return out; const k = path.concat(n.title).join(" › "); out.set(k, n.min); (n.children || []).forEach(c => flatTree(c, path.concat(n.title), out)); return out; }
function allCourses(n, out = new Set()) { if (!n) return out; (n.courses || []).forEach(c => out.add(c)); (n.children || []).forEach(c => allCourses(c, out)); return out; }

/* ---------- เปรียบเทียบ 2 ฉบับ ---------- */
function diffSnap(a, b) {
  const items = []; const unknown = []; const add = (area, before, after, ref) => items.push({ area, before, after, ref, sig: areaSig(area) });
  if (a.credits !== b.credits) add("CREDITS", `${a.credits} หน่วยกิต`, `${b.credits} หน่วยกิต`);
  if (a.years !== b.years) add("YEARS", `${a.years} ปี`, `${b.years} ปี`);
  if (a.minGpa !== b.minGpa) add("GPA", a.minGpa, b.minGpa);
  const pa = [...new Set(a.plans)].sort().join(", "), pb = [...new Set(b.plans)].sort().join(", "); if (pa !== pb) add("PLAN", pa, pb);
  if (a.framework && b.framework && a.framework !== b.framework) add("FRAMEWORK", a.framework === "TQF5" ? "มาตรฐานผลการเรียนรู้ 5 ด้าน (TQF)" : "PLO", b.framework === "TQF5" ? "มาตรฐานผลการเรียนรู้ 5 ด้าน (TQF)" : "PLO (OBE)");
  if (a.tree && b.tree) {
    const fa = flatTree(a.tree), fb = flatTree(b.tree);
    fb.forEach((m, k) => { if (!fa.has(k)) add("STRUCTURE", "—", `${k} ${m} นก.`, k); else if (fa.get(k) !== m) add("STRUCTURE", `${k} ${fa.get(k)} นก.`, `${m} นก.`, k); });
    fa.forEach((m, k) => { if (!fb.has(k)) add("STRUCTURE", `${k} ${m} นก.`, "ตัดออก", k); });
    const ca = allCourses(a.tree), cb = allCourses(b.tree);
    cb.forEach(c => { if (!ca.has(c)) add("COURSE_ADD", "—", c, c); }); ca.forEach(c => { if (!cb.has(c)) add("COURSE_REMOVE", c, "—", c); });
  } else unknown.push("STRUCTURE");
  if (a.plos && b.plos && a.framework === "PLO" && b.framework === "PLO") {
    const ma = new Map(a.plos.map(x => [x.code, x])), mb = new Map(b.plos.map(x => [x.code, x]));
    mb.forEach((x, k) => { if (!ma.has(k)) add("PLO_ADD", "—", `${k} ${x.text}`, k); else if (ma.get(k).text !== x.text) add("PLO_CHANGE", `${k} ${ma.get(k).text}`, x.text, k); });
    ma.forEach((x, k) => { if (!mb.has(k)) add("PLO_REMOVE", `${k} ${x.text}`, "—", k); });
  } else if (!a.plos || !b.plos) unknown.push("PLO");
  if (a.staff && b.staff) { b.staff.filter(s => !a.staff.includes(s)).forEach(s => add("STAFF_IN", "—", staffName(s), s)); a.staff.filter(s => !b.staff.includes(s)).forEach(s => add("STAFF_OUT", staffName(s), "—", s)); }
  else unknown.push("STAFF");
  if (a.studyPlan && b.studyPlan) { const pos = sp => { const m = new Map(); sp.forEach(t => t.courses.forEach(c => m.set(c, `ปี ${t.year}/${t.term}`))); return m; }; const A = pos(a.studyPlan), B = pos(b.studyPlan);
    B.forEach((t, c) => { if (A.has(c) && A.get(c) !== t) add("STUDY_PLAN", `${c} ${A.get(c)}`, t, c); }); }
  return { items, unknown, major: items.some(i => i.sig === "MAJOR") };
}

/* ---------- บันทึก: สร้าง/ปิดบันทึก/ตรวจ hash chain ---------- */
function fnv(str) { let h1 = 0x811c9dc5, h2 = 0x01000193 ^ str.length; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ (c + i), 2246822519) >>> 0; } return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")); }
function stable(x) { return Array.isArray(x) ? `[${x.map(stable).join(",")}]` : x && typeof x === "object" ? `{${Object.keys(x).sort().map(k => JSON.stringify(k) + ":" + stable(x[k])).join(",")}}` : JSON.stringify(x === undefined ? null : x); }
function canon(r) { const o = Object.assign({}, r); delete o.hash; delete o.prevHash; return stable(o); }   // ทุกระดับของข้อมูลอยู่ใน hash
function sealedChain(pid) { return D.hist.records.filter(r => r.prog === pid && r.hash).sort((a, b) => a.sealSeq - b.sealSeq); }
function seal(r) {
  const chain = sealedChain(r.prog); const prev = chain[chain.length - 1];
  r.sealSeq = prev ? prev.sealSeq + 1 : 1; r.sealedAt = r.sealedAt || today(); r.prevHash = prev ? prev.hash : "GENESIS"; r.hash = fnv(r.prevHash + canon(r));
}
function verifyChain(pid) {
  const chain = sealedChain(pid); let prev = "GENESIS";
  for (const r of chain) { if (r.prevHash !== prev || fnv(prev + canon(r)) !== r.hash) return { ok: false, at: r }; prev = r.hash; }
  return { ok: true, n: chain.length };
}
function sealAllOnce() {
  if (D.hist.sealed) return;
  [...D.hist.records].sort((a, b) => (a.at || "9999").localeCompare(b.at || "9999") || a.id - b.id).forEach(r => { if (r.status === "APPROVED" && !r.hash) seal(r); });
  D.hist.sealed = true;
}
function newRecord(o) { const r = Object.assign({ id: Math.max(0, ...D.hist.records.map(x => x.id)) + 1, issues: [], reasons: [], items: null, sim: false }, o); D.hist.records.push(r); return r; }
function ensureRecords(p) {
  p.versions.forEach((v, i) => {
    if (!["DRAFT", "IN_REVIEW"].includes(v.state) || D.hist.records.some(r => r.ver === v.id && ["NEW", "MAJOR"].includes(r.kind))) return;
    const base = v.basedOn || (i ? p.versions[i - 1].id : null);
    newRecord({ prog: p.id, ver: v.id, baseVer: base, kind: v.kind === "NEW" && !base ? "NEW" : "MAJOR", seqMajor: D.hist.records.filter(r => r.prog === p.id && ["NEW", "MAJOR"].includes(r.kind) && r.status === "APPROVED").length, seqMinor: null,
      title: `ร่างหลักสูตร${v.kind === "NEW" ? "ใหม่" : "ปรับปรุง"} พ.ศ. ${v.year}`, reasons: [], issues: (v.form && v.form.rationale) ? [{ area: "GENERAL", text: v.form.rationale, real: false }] : [], effTerm: 1, effYear: v.year, cohort: v.year, council: null, ack: null, case: (D.workflow.cases.find(c => c.ver === v.id) || {}).id || null, amend: null, status: "IN_PROGRESS", at: null, lineage: D.life.lineage[v.id] || undefined });
  });
}
function histOf(p) { ensureRecords(p); return D.hist.records.filter(r => r.prog === p.id); }
const _bi2 = buildIndex;
buildIndex = function () { _bi2(); if (D.hist) { D.hist.areas.GENERAL = D.hist.areas.GENERAL || ["ภาพรวม/อื่น ๆ", "MINOR"]; sealAllOnce(); } };
function recLabel(r) {
  if (r.kind === "NEW") return "หลักสูตรใหม่";
  if (r.kind === "MAJOR") return r.status === "APPROVED" ? `ปรับปรุงครั้งที่ ${r.seqMajor}` : `ร่างปรับปรุงครั้งที่ ${r.seqMajor + (r.seqMajor ? 0 : 1)}`;
  if (r.kind === "MINOR") return `ปรับปรุงเล็กน้อยครั้งที่ ${r.seqMinor}`;
  return HKIND[r.kind][0];
}
function verOf(id) { return (IDX.ver.get(id) || {}).v; }

/* ---------- หลักสูตร ณ รุ่นนักศึกษา ---------- */
function asOf(p, cohort) {
  const vs = p.versions.filter(v => ["APPROVED", "SUPERSEDED"].includes(v.state) && v.year <= cohort).sort((a, b) => b.year - a.year); const v = vs[0];
  if (!v) return null;
  const minors = histOf(p).filter(r => r.kind === "MINOR" && r.status === "APPROVED" && r.ver === v.id && (r.retro || (r.cohort || 0) <= cohort)).sort((a, b) => a.seqMinor - b.seqMinor);
  const skipped = histOf(p).filter(r => r.kind === "MINOR" && r.status === "APPROVED" && r.ver === v.id && !r.retro && (r.cohort || 0) > cohort);
  return { v, minors, skipped };
}

/* ---------- ประเด็นที่ถูกปรับ (รวม issues + items) ---------- */
function areaCounts(records) {
  const m = {}; records.forEach(r => { const set = new Set((r.items || []).map(i => i.area).concat(r.issues.map(i => i.area))); set.forEach(a => { m[a] = (m[a] || 0) + 1; }); });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

/* ---------- แท็บประวัติการปรับปรุง ---------- */
PTABS.splice(PTABS.findIndex(t => t[0] === "versions") + 1, 0, ["history", "ประวัติการปรับปรุง"]);
PTAB.history = p => {
  const recs = histOf(p); const vs = [...p.versions].sort((a, b) => a.year - b.year);
  const majors = recs.filter(r => r.kind === "MAJOR" && r.status === "APPROVED"); const minors = recs.filter(r => r.kind === "MINOR" && r.status === "APPROVED");
  const chk = verifyChain(p.id); const first = vs[0]; const last = majors[majors.length - 1];
  const cohortSel = Number(S.ui["asof-" + p.id] || activeVer(p).year); const ao = asOf(p, cohortSel);
  const draftRec = recs.find(r => r.status === "IN_PROGRESS" && ["NEW", "MAJOR"].includes(r.kind)); const canEd = draftRec && canEditProg(p) && can("program.edit");
  const ac = areaCounts(recs.filter(r => r.status === "APPROVED" && r.kind !== "NEW"));
  const verOpts = vs.map(v => [v.id, `พ.ศ. ${v.year} (${VSTATE[v.state][0]})`]);
  const cmp = S.ui["cmp-" + p.id] || [vs.length > 1 ? vs[vs.length - 2].id : vs[0].id, vs[vs.length - 1].id];
  const block = v => {
    const r = recs.find(x => x.ver === v.id && ["NEW", "MAJOR"].includes(x.kind)); const ms = recs.filter(x => x.ver === v.id && x.kind === "MINOR").sort((a, b) => a.seqMinor - b.seqMinor);
    const other = recs.filter(x => x.ver === v.id && ["SUSPEND", "CLOSE"].includes(x.kind));
    const base = r && r.baseVer ? verOf(r.baseVer) : null; const d = base ? diffSnap(snapOf(p, base), snapOf(p, v)) : null;
    return `<li class="hv"><div class="hv-head"><span class="hv-year">พ.ศ. ${v.year || "ไม่ระบุ"}</span>${r ? pill(recLabel(r), HKIND[r.kind][1]) : ""} ${pillOf(VSTATE, v.state)} ${r && r.hash ? `<span class="muted small mono" title="hash ${r.hash}">🔒 ${r.hash.slice(0, 8)}</span>` : ""}</div>
      <div class="hv-body">${kv([["หน่วยกิต/แผน", `${v.credits} หน่วยกิต · ${esc(v.plans.map(x => x.plan).join(", "))} ${srcPill(v.source === "REG")}`], ["มติสภามหาวิทยาลัย", (() => { const real = typeof resolutionsOf === "function" ? resolutionsOf(p, v).find(x => x.body === "UNIVERSITY_COUNCIL" && x.no && !x.sim) : null; return real ? `ครั้งที่ ${esc(real.no)} วันที่ ${thDate(real.date, true)} ${pillOf(RES_SRC, real.verified ? "VERIFIED" : real.source)}` : r && r.council ? `ครั้งที่ ${esc(r.council.no)} วันที่ ${thDate(r.council.date, true)} ${srcPill(false)} <a class="small" href="#resolutions-${p.id}">บันทึกจริง</a>` : `— <a class="small" href="#resolutions-${p.id}">บันทึกย้อนหลัง</a>`; })()], ["สป.อว. รับทราบ", r && r.ack ? thDate(r.ack, true) : "—"], ["ใช้กับนักศึกษา", r ? `รุ่นปีการศึกษา ${r.cohort || v.year} เป็นต้นไป (ภาค ${r.effTerm}/${r.effYear})` : "—"],
        r && r.reasons.length ? ["เหตุผลการปรับปรุง", r.reasons.map(c => `<span class="tag">${esc(reasonTh(c))}</span>`).join(" ")] : null,
        r && r.issues.length ? ["ประเด็นสำคัญ", `<ul class="bul">${r.issues.map(i => `<li>${esc(i.text)} <span class="muted small">(${esc(areaTh(i.area))}${i.real ? " · ข้อมูลจริง" : ""})</span></li>`).join("")}</ul>`] : null,
        d ? ["ตรวจพบจากข้อมูล", d.items.length ? `${d.items.length} รายการ (${d.items.filter(i => i.sig === "MAJOR").length} ระดับสาระสำคัญ) — <a href="#compare-${p.id}-${base.id}-${v.id}">ดูตารางเปรียบเทียบ</a>${d.unknown.length ? ` <span class="muted small">· ฉบับเดิมไม่มีรายละเอียด ${d.unknown.map(areaTh).join("/")} (ย้ายจากทะเบียน)</span>` : ""}` : "ไม่พบความต่างในข้อมูลที่มี"] : null,
        r && r.lineage ? ["สายฉบับ", `${{ SPLIT: "แยกจาก", MERGE: "รวมจาก", ONE_TO_ONE: "ปรับจาก" }[r.lineage.mode]} ${r.lineage.parents.map(x => `<a href="#program-${x.prog}-history">${esc(progTitle(IDX.prog.get(x.prog), true))}</a>`).join(", ")}`] : null])}
        ${ms.length ? `<ol class="hm">${ms.map(m => `<li><div>${pill(recLabel(m), "neutral")} <b>${esc(m.title.replace(/^สมอ.08 /, ""))}</b> ${pillOf(HSTATUS, m.status)} <span class="muted small">มีผลภาค ${m.effTerm}/${m.effYear} · ${m.retro ? "ใช้กับทุกรุ่นของฉบับนี้ (ย้อนหลัง)" : `รุ่น ${m.cohort} เป็นต้นไป`} · ${m.council ? `สภาวิชาการ ${esc(m.council.no)} (${thDate(m.council.date)})` : ""} ${m.amend ? "· " + esc(m.amend) : ""}</span></div>
          ${(m.items || []).length ? `<table class="t mini"><tbody>${m.items.map(i => `<tr><td>${esc(areaTh(i.area))}</td><td>${esc(i.before || "—")}</td><td>→</td><td>${esc(i.after || "—")}</td><td class="muted small">${esc(i.note || "")}</td></tr>`).join("")}</tbody></table>` : ""}</li>`).join("")}</ol>` : ""}
        ${other.map(o => `<p>${pill(HKIND[o.kind][0], HKIND[o.kind][1])} ${esc(o.issues.map(i => i.text).join("; "))} · มีผล ${o.effTerm}/${o.effYear} ${pillOf(HSTATUS, o.status)}</p>`).join("")}</div></li>`;
  };
  return `<div class="grid g4">
      <div class="panel stat"><span class="label">เปิดหลักสูตร</span><span class="value">${first.year || "—"}</span><span class="sub">ฉบับแรกในระบบทะเบียน ${srcPill(true)}</span></div>
      <div class="panel stat"><span class="label">ปรับปรุงใหญ่ (ฉบับใหม่)</span><span class="value">${majors.length} ครั้ง</span><span class="sub">${last ? `ล่าสุด พ.ศ. ${verOf(last.ver).year}` : "ยังไม่เคยปรับปรุง"}${draftRec && draftRec.kind === "MAJOR" ? " · มีร่างครั้งถัดไป" : ""}</span></div>
      <div class="panel stat"><span class="label">ปรับปรุงเล็กน้อย (สมอ.08)</span><span class="value">${minors.length} ครั้ง</span><span class="sub">ฉบับปัจจุบัน ${minors.filter(m => m.ver === activeVer(p).id).length} ครั้ง ${srcPill(false)}</span></div>
      <div class="panel stat"><span class="label">ความถูกต้องของบันทึก</span><span class="value">${chk.ok ? "✓" : "✗"}</span><span class="sub">${chk.ok ? `ตรวจ hash chain ${chk.n} รายการ ไม่ถูกแก้ไข` : `ถูกแก้ไขที่รายการ #${chk.at.id}`}</span></div></div>
    <div class="actions">${btn("รายงานประวัติการปรับปรุง", "open-doc", { data: { code: "DOC-HISTORY", id: p.id }, perm: "doc.export" })}${btn("ตารางเปรียบเทียบเดิม–ปรับปรุง", "open-doc", { data: { code: "DOC-COMPARE", id: p.id }, perm: "doc.export" })}<a class="btn" href="#changes">ทะเบียนการปรับปรุงทั้งมหาวิทยาลัย</a></div>
    ${draftRec ? panel(`สาระการปรับปรุงของ${recLabel(draftRec)} พ.ศ. ${verOf(draftRec.ver).year} (บังคับก่อนส่งอนุมัติ)`, `${draftRec.reasons.length ? draftRec.reasons.map(c => `<span class="tag">${esc(reasonTh(c))}</span>`).join(" ") : pill("ยังไม่ระบุเหตุผล", "warn")}<ul class="bul">${draftRec.issues.map(i => `<li>${esc(i.text)} <span class="muted small">(${esc(areaTh(i.area))})</span></li>`).join("") || "<li class='muted'>ยังไม่ระบุประเด็นสำคัญ</li>"}</ul>
      ${(() => { const base = draftRec.baseVer ? verOf(draftRec.baseVer) : null; if (!base) return ""; const d = diffSnap(snapOf(p, base), snapOf(p, verOf(draftRec.ver))); return `<p class="small">ระบบตรวจพบความต่างจากฉบับ พ.ศ. ${base.year} จำนวน ${d.items.length} รายการ${d.major ? ` — ${pill("มีการเปลี่ยนแปลงระดับสาระสำคัญ ต้องเป็นฉบับปรับปรุง", "warn")}` : ""} <a href="#compare-${p.id}-${base.id}-${draftRec.ver}">เปิดตารางเปรียบเทียบ</a></p>`; })()}`,
      { actions: canEd ? btn("แก้ไขสาระการปรับปรุง", "hist-edit", { sm: true, kind: "primary", data: { id: draftRec.id } }) : "" }) : ""}
    <div class="grid g-side"><div>${panel("เส้นเวลาการปรับปรุง (ฉบับและการปรับปรุงเล็กน้อยในฉบับ)", `<ol class="hist">${vs.map(block).join("")}</ol>`)}</div>
    <div class="grid">${panel("หลักสูตรที่ใช้กับนักศึกษาแต่ละรุ่น", `<form class="filters" data-form="asof" data-id="${p.id}"><label for="f-asof">รุ่นปีการศึกษาที่เข้า</label><input id="f-asof" name="y" type="number" min="2540" max="2580" value="${cohortSel}"><button class="btn sm" type="submit">ดู</button></form>
        ${ao ? `<p>ใช้ <b>ฉบับ พ.ศ. ${ao.v.year}</b> (${ao.v.credits} หน่วยกิต)</p>${ao.minors.length ? `<p>รวมการปรับปรุงเล็กน้อยที่มีผลกับรุ่นนี้ ${ao.minors.length} ครั้ง:</p><ul class="bul">${ao.minors.map(m => `<li>${recLabel(m)}: ${esc(m.title.replace(/^สมอ.08 /, ""))} (ภาค ${m.effTerm}/${m.effYear})</li>`).join("")}</ul>` : "<p class='muted'>ไม่มีการปรับปรุงเล็กน้อยที่มีผลกับรุ่นนี้</p>"}${ao.skipped.length ? `<p class="muted small">ไม่มีผลกับรุ่นนี้ (ใช้กับรุ่นหลัง): ${ao.skipped.map(recLabel).join(", ")}</p>` : ""}` : `<div class="empty">ไม่มีฉบับที่ใช้กับรุ่น ${cohortSel}</div>`}
        <p class="muted small">ใช้ทวนสอบว่านักศึกษารุ่นหนึ่งต้องเรียนตามหลักสูตรฉบับใด และมีการเปลี่ยนแปลงใดบ้าง (เช่น ตรวจจบ ทวนสอบการเทียบโอน)</p>`)}
      ${panel("เปรียบเทียบ 2 ฉบับ", `<form data-form="cmp-pick" data-id="${p.id}"><div class="form-grid">${field("a", "ฉบับเดิม", { type: "select", options: verOpts, value: cmp[0], blank: false })}${field("b", "ฉบับที่เทียบ", { type: "select", options: verOpts, value: cmp[1], blank: false })}</div><div class="form-foot"><button class="btn primary" type="submit">เปรียบเทียบ</button></div></form>`)}
      ${ac.length ? panel("ประเด็นที่ถูกปรับ (นับจำนวนครั้ง)", barChart(ac.slice(0, 10).map(([a, n]) => ({ label: areaTh(a), v: n, tip: `${areaTh(a)}: ${n} ครั้ง` })), { aria: "ประเด็นที่ถูกปรับ", padL: 200 })) : ""}</div></div>
    <p class="muted small">ปีหลักสูตร หน่วยกิตรวม และแผนการศึกษาของแต่ละฉบับเป็นข้อมูลจริงจากระบบทะเบียน · เหตุผล มติ การปรับปรุงเล็กน้อย และรายละเอียดฉบับเก่าเป็นข้อมูลจำลอง ${gapPill("G30")}</p>`;
};
form("asof", (d, f) => { S.ui["asof-" + f.dataset.id] = Number(d.y); rerender(); });
form("cmp-pick", (d, f) => { if (d.a === d.b) { formErrors(f, { b: "เลือกฉบับที่ต่างกัน" }); return; } go(`compare-${f.dataset.id}-${d.a}-${d.b}`); });
act("hist-edit", el => {
  const r = D.hist.records.find(x => x.id === Number(el.dataset.id)); const areas = Object.entries(D.hist.areas).map(([k, v]) => [k, v[0]]);
  openModal("สาระการปรับปรุงหลักสูตร", `<form data-form="hist-edit" data-id="${r.id}"><fieldset class="field full"><legend>เหตุผลการปรับปรุง (อย่างน้อย 1)</legend><div class="checks">${D.hist.reasons.map(x => `<label><input type="checkbox" name="reasons" value="${x.code}"${r.reasons.includes(x.code) ? " checked" : ""}> ${esc(x.th)}</label>`).join("")}</div><span class="err" data-err="reasons"></span></fieldset>
    <div class="form-grid">${[0, 1, 2, 3, 4].map(i => { const it = r.issues[i] || {}; return field("area" + i, `ประเด็นที่ ${i + 1}: ด้าน`, { type: "select", options: areas, value: it.area || (i ? "" : "GENERAL") }) + field("text" + i, "สาระสำคัญ", { value: it.text, required: i === 0 }); }).join("")}</div>
    <div class="note">ใช้ในเล่ม มคอ.2 (สาระในการปรับปรุง), ตารางเปรียบเทียบ และทะเบียนการปรับปรุง — ปิดบันทึกถาวรเมื่อสภามหาวิทยาลัยอนุมัติ</div><div class="form-foot">${btn("ยกเลิก", "close-modal")}<button class="btn primary" type="submit">บันทึก</button></div></form>`, { wide: true });
});
form("hist-edit", (d, f) => {
  const r = D.hist.records.find(x => x.id === Number(f.dataset.id)); const reasons = $$('input[name="reasons"]:checked', f).map(i => i.value); const errs = {};
  if (!reasons.length) errs.reasons = "เลือกอย่างน้อย 1 เหตุผล"; if (!d.text0 || d.text0.length < 10) errs.text0 = "อธิบายอย่างน้อย 10 ตัวอักษร";
  [0, 1, 2, 3, 4].forEach(i => { if (d["text" + i] && !d["area" + i]) errs["area" + i] = "เลือกด้าน"; });
  if (!formErrors(f, errs)) return;
  r.reasons = reasons; r.issues = [0, 1, 2, 3, 4].filter(i => d["text" + i]).map(i => ({ area: d["area" + i], text: d["text" + i], real: false }));
  audit("บันทึกสาระการปรับปรุง", `${IDX.prog.get(r.prog).code} #${r.id}`); persist(); closeModal(); toast("บันทึกสาระการปรับปรุงแล้ว"); rerender();
});

/* ---------- หน้าเปรียบเทียบ ---------- */
route("compare", { perm: "program.view", title: "เปรียบเทียบฉบับหลักสูตร", render(args) {
  const p = IDX.prog.get(Number(args[0])); const a = verOf(Number(args[1])); const b = verOf(Number(args[2]));
  if (!p || !a || !b) return `<div class="note bad">ไม่พบฉบับที่ต้องการเปรียบเทียบ</div>`;
  S.ui.cmpDoc = { prog: p.id, a: a.id, b: b.id };
  const sa = snapOf(p, a), sb = snapOf(p, b); const d = diffSnap(sa, sb); const r = histOf(p).find(x => x.ver === b.id && ["NEW", "MAJOR"].includes(x.kind));
  const groups = {}; d.items.forEach(i => { (groups[i.area] = groups[i.area] || []).push(i); });
  const cname = c => { const x = IDX.course.get(c); return x ? `${c} ${x.th} ${x.cr}` : c; };
  const fa = flatTree(sa.tree), fb = flatTree(sb.tree); const paths = [...new Set([...fa.keys(), ...fb.keys()])];
  return pageHead(`เปรียบเทียบ พ.ศ. ${a.year} กับ พ.ศ. ${b.year}`, { crumbs: `<a href="#program-${p.id}-history">${esc(progTitle(p, true))}</a> › ประวัติการปรับปรุง`, lead: `พบความต่าง ${d.items.length} รายการ · ระดับสาระสำคัญ ${d.items.filter(i => i.sig === "MAJOR").length} รายการ ${d.major ? pill("ต้องเป็นการปรับปรุงหลักสูตร (ฉบับใหม่)", "warn") : pill("อยู่ในขอบเขตปรับปรุงเล็กน้อยได้", "good")}`,
    actions: btn("พิมพ์ตารางเปรียบเทียบ", "open-doc", { kind: "primary", data: { code: "DOC-COMPARE", id: p.id }, perm: "doc.export" }) }) +
    (d.unknown.length ? `<div class="note warn">ฉบับ พ.ศ. ${sa.tree ? b.year : a.year} ย้ายจากระบบทะเบียน มีเฉพาะหน่วยกิตรวมและแผนการศึกษา — เทียบ ${d.unknown.map(areaTh).join(" / ")} ไม่ได้ ${gapPill("G18")} ${gapPill("G05")}</div>` : "") +
    (r && r.issues.length ? panel(`สาระการปรับปรุงที่บันทึกไว้ (${recLabel(r)})`, `<ul class="bul">${r.issues.map(i => `<li>${esc(i.text)}</li>`).join("")}</ul>${r.reasons.map(c => `<span class="tag">${esc(reasonTh(c))}</span>`).join(" ")}`) : "") +
    panel("ภาพรวม", table([{ th: "หัวข้อ", val: x => x[0] }, { th: `พ.ศ. ${a.year}`, val: x => x[1] }, { th: `พ.ศ. ${b.year}`, val: x => x[2] }, { th: "", html: x => x[1] !== x[2] ? pill("เปลี่ยน", "warn") : "" }],
      [["หน่วยกิตรวม", sa.credits, sb.credits], ["ระยะเวลา (ปี)", sa.years, sb.years], ["เกรดเฉลี่ยขั้นต่ำ", sa.minGpa, sb.minGpa], ["แผนการศึกษา", [...new Set(sa.plans)].join(", "), [...new Set(sb.plans)].join(", ")], ["กรอบผลการเรียนรู้", sa.framework || "ไม่มีข้อมูล", sb.framework || "ไม่มีข้อมูล"], ["จำนวน PLO/LO", sa.plos ? sa.plos.length : "—", sb.plos ? sb.plos.length : "—"], ["จำนวนรายวิชาในโครงสร้าง", sa.tree ? allCourses(sa.tree).size : "—", sb.tree ? allCourses(sb.tree).size : "—"]]), { flush: true }) +
    (paths.length && sa.tree && sb.tree ? panel("โครงสร้างหลักสูตร (หน่วยกิตขั้นต่ำ)", table([{ th: "หมวด/กลุ่มวิชา", wrap: true, val: k => k.replace(/^โครงสร้างหลักสูตร › ?/, "") || "รวม" }, { th: `พ.ศ. ${a.year}`, num: true, val: k => fa.has(k) ? fa.get(k) : "—" }, { th: `พ.ศ. ${b.year}`, num: true, val: k => fb.has(k) ? fb.get(k) : "—" }, { th: "", html: k => fa.get(k) !== fb.get(k) ? pill(!fa.has(k) ? "เพิ่ม" : !fb.has(k) ? "ตัด" : "เปลี่ยน", "warn") : "" }], paths), { flush: true }) : "") +
    `<div class="grid g2">${panel(`รายวิชาที่เพิ่ม (${(groups.COURSE_ADD || []).length})`, table([{ th: "รายวิชา", wrap: true, val: i => cname(i.ref) }], groups.COURSE_ADD || [], { empty: "ไม่มี" }), { flush: true })}${panel(`รายวิชาที่ตัดออก (${(groups.COURSE_REMOVE || []).length})`, table([{ th: "รายวิชา", wrap: true, val: i => cname(i.ref) }], groups.COURSE_REMOVE || [], { empty: "ไม่มี" }), { flush: true })}</div>` +
    panel("ผลลัพธ์การเรียนรู้", sa.plos && sb.plos ? `<div class="grid g2"><div><h3 class="small">พ.ศ. ${a.year} (${sa.framework})</h3><ul class="bul">${sa.plos.map(x => `<li><b>${x.code}</b> ${esc(x.text)}</li>`).join("")}</ul></div><div><h3 class="small">พ.ศ. ${b.year} (${sb.framework})</h3><ul class="bul">${sb.plos.map(x => `<li><b>${x.code}</b> ${esc(x.text)}${(groups.PLO_ADD || []).some(i => i.ref === x.code) ? " " + pill("ใหม่", "info") : (groups.PLO_CHANGE || []).some(i => i.ref === x.code) ? " " + pill("แก้ไข", "warn") : ""}</li>`).join("")}</ul></div></div>` : `<div class="empty">ไม่มีข้อมูล PLO ของฉบับใดฉบับหนึ่ง</div>`) +
    panel("อาจารย์ผู้รับผิดชอบหลักสูตร", table([{ th: "การเปลี่ยนแปลง", val: i => areaTh(i.area) }, { th: "อาจารย์", html: i => `<a href="#" data-act="staff-open" data-id="${i.ref}">${esc(staffName(i.ref))}</a>` }], (groups.STAFF_IN || []).concat(groups.STAFF_OUT || []), { empty: sa.staff && sb.staff ? "ไม่เปลี่ยน" : "ไม่มีข้อมูลอาจารย์ของฉบับเดิม" }), { flush: true }) +
    ((groups.STUDY_PLAN || []).length ? panel(`ย้ายภาคเรียนในแผนการเรียน (${groups.STUDY_PLAN.length})`, table([{ th: "รายวิชา", val: i => cname(i.ref) }, { th: "เดิม", val: i => i.before.split(" ").slice(1).join(" ") }, { th: "ใหม่", val: i => i.after }], groups.STUDY_PLAN), { flush: true }) : "");
} });

/* ---------- ทะเบียนการปรับปรุงหลักสูตร (ทั้งมหาวิทยาลัย) ---------- */
function changeRows() {
  const f = S.filters.chg || {};
  D.programs.filter(inScope).forEach(ensureRecords);
  return D.hist.records.filter(r => { const p = IDX.prog.get(r.prog); if (!p || !inScope(p)) return false; const y = r.effYear || 0;
    return (!f.fac || p.fac === f.fac) && (!f.kind || r.kind === f.kind) && (!f.reason || r.reasons.includes(f.reason)) && (!f.from || y >= Number(f.from)) && (!f.to || y <= Number(f.to)) && (!f.status || r.status === f.status); })
    .sort((a, b) => (b.effYear || 0) - (a.effYear || 0) || b.id - a.id);
}
route("changes", { perm: "program.view", title: "ทะเบียนการปรับปรุงหลักสูตร", render() {
  const f = S.filters.chg || {}; const rows = changeRows(); const pg = paged("chg", rows, 30);
  const years = []; for (let y = 2559; y <= 2571; y++) years.push(y);
  const byYear = years.map(y => ({ label: String(y).slice(2), v: rows.filter(r => r.effYear === y && ["NEW", "MAJOR"].includes(r.kind)).length, v2: rows.filter(r => r.effYear === y && r.kind === "MINOR").length }));
  byYear.forEach((x, i) => { x.tip = `ปี ${years[i]}: ฉบับใหม่/ปรับปรุง ${x.v} · สมอ.08 ${x.v2}`; });
  const rc = {}; rows.filter(r => r.kind !== "NEW").forEach(r => r.reasons.forEach(c => { rc[c] = (rc[c] || 0) + 1; }));
  const progsInScope = D.programs.filter(inScope);
  const freq = progsInScope.map(p => ({ p, n: D.hist.records.filter(r => r.prog === p.id && r.kind === "MINOR" && r.ver === activeVer(p).id && r.status === "APPROVED").length })).filter(x => x.n >= 2).sort((a, b) => b.n - a.n);
  const never = progsInScope.filter(p => p.life === "ACTIVE" && p.versions.length === 1 && p.latestYear && p.latestYear <= 2565);
  const bad = progsInScope.filter(p => !verifyChain(p.id).ok);
  return pageHead("ทะเบียนการปรับปรุงหลักสูตร", { lead: "ทุกเหตุการณ์ของทุกหลักสูตร: หลักสูตรใหม่ · ปรับปรุง (ฉบับใหม่) · ปรับปรุงเล็กน้อย (สมอ.08) · งดรับ/ปิด — บันทึกที่อนุมัติแล้วถูกปิดบันทึกด้วย hash chain แก้ย้อนหลังไม่ได้",
    actions: btn("ส่งออกทะเบียน", "open-doc", { data: { code: "RPT-CHANGES" }, perm: "report.ops" }) }) +
    `<div class="grid g4">${Object.keys(HKIND).filter(k => k !== "SUSPEND").map(k => `<div class="panel stat"><span class="label">${HKIND[k][0]}</span><span class="value">${fmt(rows.filter(r => r.kind === k || (k === "CLOSE" && r.kind === "SUSPEND")).length)}</span><span class="sub">${k === "CLOSE" ? "รวมงดรับ" : ""}</span></div>`).join("")}</div>
    <section class="panel"><header><form class="filters" data-form="chg-filter" style="width:100%">
      <select name="fac" aria-label="คณะ"><option value="">ทุกคณะ</option>${D.meta.faculties.filter(x => progsInScope.some(p => p.fac === x.id)).map(x => `<option value="${x.id}"${f.fac === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <select name="kind" aria-label="ประเภท"><option value="">ทุกประเภท</option>${Object.entries(HKIND).map(([k, v]) => `<option value="${k}"${f.kind === k ? " selected" : ""}>${v[0]}</option>`).join("")}</select>
      <select name="reason" aria-label="เหตุผล"><option value="">ทุกเหตุผล</option>${D.hist.reasons.map(x => `<option value="${x.code}"${f.reason === x.code ? " selected" : ""}>${esc(x.th)}</option>`).join("")}</select>
      <input name="from" type="number" placeholder="ตั้งแต่ปี" value="${esc(f.from || "")}" aria-label="ตั้งแต่ปี" style="width:110px"><input name="to" type="number" placeholder="ถึงปี" value="${esc(f.to || "")}" aria-label="ถึงปี" style="width:110px">
      <button class="btn primary" type="submit">กรอง</button>${btn("ล้าง", "chg-clear")}</form></header></section>
    <div class="grid g2">${panel("จำนวนการปรับปรุงตามปีที่มีผล", colChart(byYear, { aria: "จำนวนการปรับปรุงรายปี" }) + legend([["--series-1", "หลักสูตรใหม่/ปรับปรุง (ฉบับใหม่)"], ["--series-2", "ปรับปรุงเล็กน้อย (สมอ.08)"]]))}
      ${panel("เหตุผลการปรับปรุง", barChart(Object.entries(rc).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ label: reasonTh(c), v: n, tip: `${reasonTh(c)}: ${n} ครั้ง` })), { aria: "เหตุผลการปรับปรุง", padL: 230 }))}</div>
    <div class="grid g3">${panel(`ฉบับปัจจุบันที่ปรับเล็กน้อย ≥ 2 ครั้ง (${freq.length})`, table([{ th: "หลักสูตร", wrap: true, html: x => `<a href="#program-${x.p.id}-history">${esc(progTitle(x.p, true))}</a>` }, { th: "ครั้ง", num: true, val: x => x.n }], freq, { maxH: 260, empty: "ไม่มี" }), { flush: true })}
      ${panel(`เปิดรับและยังไม่เคยปรับปรุง (ฉบับ ≤ 2565) (${never.length})`, table([{ th: "หลักสูตร", wrap: true, html: p => `<a href="#program-${p.id}-history">${esc(progTitle(p, true))}</a>` }, { th: "ฉบับ", val: p => p.latestYear }], never, { maxH: 260, empty: "ไม่มี" }), { flush: true })}
      ${panel("ตรวจความถูกต้องของบันทึก", bad.length ? `<div class="note bad">พบบันทึกถูกแก้ไขใน ${bad.length} หลักสูตร</div>` : `<div class="note">ตรวจ hash chain ${progsInScope.length} หลักสูตร ${fmt(D.hist.records.filter(r => r.hash && inScope(IDX.prog.get(r.prog))).length)} รายการ — ไม่พบการแก้ไขย้อนหลัง</div><p class="muted small">ระบบจริงใช้ SHA-256 และเก็บ hash ล่าสุดใน audit log แยก</p>`)}</div>
    ${panel(`${fmt(rows.length)} รายการ`, table([{ th: "มีผล", val: r => r.effYear ? `${r.effTerm}/${r.effYear}` : "—" }, { th: "หลักสูตร", wrap: true, html: r => `<a href="#program-${r.prog}-history">${esc(progTitle(IDX.prog.get(r.prog), true))}</a><br><span class="muted small">${esc(IDX.fac.get(IDX.prog.get(r.prog).fac).name)}</span>` },
      { th: "ครั้งที่", html: r => pill(recLabel(r), HKIND[r.kind][1]) }, { th: "ฉบับ", val: r => (verOf(r.ver) || {}).year || "—" }, { th: "ประเด็นสำคัญ", wrap: true, val: r => r.issues.map(i => i.text).join(" · ") }, { th: "เหตุผล", wrap: true, val: r => r.reasons.map(reasonTh).join(", ") }, { th: "สถานะ", html: r => pillOf(HSTATUS, r.status) + (r.hash ? " 🔒" : "") }], pg.rows), { flush: true }) + pg.pager}
    <p class="muted small">ฉบับและหน่วยกิต/แผนจากระบบทะเบียน (จริง) · เหตุผล สมอ.08 มติ เป็นข้อมูลจำลอง ${gapPill("G30")}</p>`;
} });
form("chg-filter", d => { S.filters.chg = d; S.ui["pg-chg"] = 1; rerender(); });
act("chg-clear", () => { S.filters.chg = {}; rerender(); });
(function () { const g = NAV.find(x => x[0] === "หลักสูตร")[1]; g.splice(1, 0, ["changes", "ทะเบียนการปรับปรุงหลักสูตร", "program.view"]); })();

/* ---------- เชื่อมกับ workflow: ปิดบันทึกเมื่ออนุมัติ ---------- */
const _adv3 = advanceCase;
advanceCase = function (c, result, note, meetingId) {
  const p = IDX.prog.get(c.prog); ensureRecords(p);
  _adv3(c, result, note, meetingId);
  if (c.status !== "APPROVED") return;
  const v = verOf(c.ver); const last = c.steps[c.steps.length - 1]; const m = last.meeting ? IDX.meeting.get(last.meeting) : null;
  if (c.type === "CLOSE") {
    const cl = D.life.closures.find(x => x.case === c.id);
    const r = newRecord({ prog: p.id, ver: activeVer(p).id, baseVer: null, kind: cl && cl.kind === "SUSPEND_ADMISSION" ? "SUSPEND" : "CLOSE", seqMajor: null, seqMinor: null, title: cl && cl.kind === "SUSPEND_ADMISSION" ? "งดรับนักศึกษา" : "ปิดดำเนินการหลักสูตร",
      reasons: ["OTHER"], issues: [{ area: "LIFECYCLE", text: cl ? cl.reason : "ตามมติสภามหาวิทยาลัย", real: false }], effTerm: cl ? cl.term : 1, effYear: cl ? cl.year : 2570, cohort: null, council: { no: m ? m.no : "—", date: today() }, ack: null, case: c.id, amend: null, status: "APPROVED", at: today() });
    seal(r); return;
  }
  const r = D.hist.records.find(x => x.ver === c.ver && ["NEW", "MAJOR"].includes(x.kind));
  if (r && r.status !== "APPROVED") {
    const base = r.baseVer ? verOf(r.baseVer) : null;
    D.hist.snapshots[v.id] = liveSnap(p, v); if (base && !D.hist.snapshots[base.id]) D.hist.snapshots[base.id] = snapOf(p, base);
    r.items = base ? diffSnap(D.hist.snapshots[base.id], D.hist.snapshots[v.id]).items : null;
    Object.assign(r, { status: "APPROVED", title: r.kind === "NEW" ? "หลักสูตรใหม่" : `หลักสูตรปรับปรุง พ.ศ. ${v.year}`, seqMajor: r.kind === "NEW" ? 0 : D.hist.records.filter(x => x.prog === r.prog && ["NEW", "MAJOR"].includes(x.kind) && x.status === "APPROVED").length, council: { no: m ? m.no : "—", date: today() }, at: today() });
    seal(r);
  }
};
const _caseSubmit2 = ACTIONS["case-submit"];
ACTIONS["case-submit"] = el => {
  const c = IDX.case.get(Number(el.dataset.id)); const p = IDX.prog.get(c.prog); ensureRecords(p);
  const r = D.hist.records.find(x => x.ver === c.ver && x.kind === "MAJOR" && x.status === "IN_PROGRESS");
  if (c.type === "REVISION" && r && (!r.reasons.length || !r.issues.length)) {
    openModal("ยังส่งไม่ได้", `<div class="note bad">หลักสูตรปรับปรุงต้องระบุ<b>เหตุผล</b>และ<b>ประเด็นสำคัญของการปรับปรุง</b>ก่อนส่ง เพื่อบันทึกในทะเบียนการปรับปรุงและเล่ม มคอ.2</div><div class="form-foot">${btn("ปิด", "close-modal")}<a class="btn primary" href="#program-${p.id}-history" data-act="close-modal-go" data-to="program-${p.id}-history">ไปกรอกสาระการปรับปรุง</a></div>`); return;
  }
  _caseSubmit2(el);
};
const _amendStep = ACTIONS["amend-step"];
ACTIONS["amend-step"] = el => {
  _amendStep(el);
  const a = D.workflow.amendments.find(x => x.id === Number(el.dataset.id)); if (a.status !== "SENATE_APPROVED" || D.hist.records.some(r => r.amend === a.no)) return;
  const p = IDX.prog.get(a.prog); const v = activeVer(p); const topics = a.topics || [{ CHANGE_STAFF: "STAFF", CHANGE_COURSE: "COURSE", CHANGE_PLAN: "PLAN", CHANGE_INTAKE: "INTAKE" }[a.kind]];
  const items = []; if (a.out) items.push({ area: "STAFF_OUT", ref: a.out, before: staffName(a.out), after: null, note: "" }); if (a.in) items.push({ area: "STAFF_IN", ref: a.in, before: null, after: staffName(a.in), note: "" });
  topics.filter(t => t !== "STAFF").forEach(t => items.push({ area: { COURSE: "COURSE_CHANGE", PLAN: "STUDY_PLAN", INTAKE: "INTAKE" }[t] || "GENERAL", ref: null, before: "ตามฉบับเดิม", after: a.reason, note: "" }));
  const r = newRecord({ prog: p.id, ver: v.id, baseVer: null, kind: "MINOR", seqMajor: null, seqMinor: D.hist.records.filter(x => x.ver === v.id && x.kind === "MINOR").length + 1, title: "สมอ.08 " + (AMEND_KIND[a.kind] || "ปรับปรุงเล็กน้อย"),
    reasons: topics.includes("STAFF") ? ["STAFF"] : ["COURSE_UPDATE"], issues: [{ area: items[0] ? items[0].area : "GENERAL", text: a.reason, real: false }], effTerm: a.term || 1, effYear: a.effYear || 2570, cohort: a.cohort || v.year, retro: !!a.retro,
    council: { no: "สภาวิชาการ", date: today(), body: "ACADEMIC_SENATE" }, ack: null, case: null, amend: a.no, status: "APPROVED", items, at: today() });
  seal(r); persist();
};

/* ---------- เอกสาร ---------- */
DOCS["DOC-HISTORY"] = p => {
  const recs = histOf(p).slice().sort((a, b) => ((verOf(a.ver) || {}).year || 0) - ((verOf(b.ver) || {}).year || 0) || (a.kind === "MINOR") - (b.kind === "MINOR") || (a.seqMinor || 0) - (b.seqMinor || 0));
  const chk = verifyChain(p.id); const v = activeVer(p);
  const majors = recs.filter(r => r.kind === "MAJOR" && r.status === "APPROVED").length, minors = recs.filter(r => r.kind === "MINOR" && r.status === "APPROVED").length;
  const h = `<div class="a4 land">${docHead("DOC-HISTORY")}<h1>รายงานประวัติการปรับปรุงหลักสูตร</h1><p class="center">หลักสูตร${esc(p.degree)} สาขาวิชา${esc(p.name)} · ${esc(IDX.fac.get(p.fac).name)} มหาวิทยาลัยนครพนม<br>ฉบับปัจจุบัน พ.ศ. ${v.year} · ปรับปรุง (ฉบับใหม่) ${majors} ครั้ง · ปรับปรุงเล็กน้อย ${minors} ครั้ง</p>
    <table><thead><tr><th>ฉบับ</th><th>ครั้งที่/ประเภท</th><th>มีผล / รุ่นที่ใช้</th><th>มติ</th><th>เหตุผล</th><th>ประเด็นสำคัญ / รายการที่เปลี่ยน</th><th>สถานะ</th></tr></thead><tbody>${recs.map(r => `<tr><td>${(verOf(r.ver) || {}).year || "—"}</td><td>${esc(recLabel(r))}<br><small>${esc(HKIND[r.kind][0])}</small></td><td>${r.effYear ? `ภาค ${r.effTerm}/${r.effYear}` : "—"}<br><small>${r.retro ? "ทุกรุ่นของฉบับ" : r.cohort ? "รุ่น " + r.cohort + " เป็นต้นไป" : ""}</small></td><td>${r.council ? `${esc(r.council.no)}<br><small>${thDate(r.council.date)}</small>` : "—"}</td><td>${r.reasons.map(c => esc(reasonTh(c))).join("<br>")}</td><td>${r.issues.map(i => "• " + esc(i.text)).join("<br>")}${(r.items || []).filter(i => r.kind === "MINOR").map(i => `<br><small>${esc(areaTh(i.area))}: ${esc(i.before || "—")} → ${esc(i.after || "—")}</small>`).join("")}</td><td>${esc(HSTATUS[r.status][0])}</td></tr>`).join("")}</tbody></table>
    <p class="small">การตรวจความถูกต้องของบันทึก: ${chk.ok ? `ตรวจ hash chain ${chk.n} รายการ — ไม่พบการแก้ไขย้อนหลัง` : `พบการแก้ไขที่รายการ #${chk.at.id}`} · ปีหลักสูตร หน่วยกิต แผนการศึกษาเป็นข้อมูลจากระบบทะเบียน · เหตุผลและการปรับปรุงเล็กน้อยในต้นแบบเป็นข้อมูลจำลอง</p>${sigBlock(["เจ้าหน้าที่งานหลักสูตร", "ผู้จัดทำรายงาน"], ["ผู้อำนวยการกองบริการการศึกษา", "ผู้รับรอง"])}</div>`;
  return { title: `ประวัติการปรับปรุง ${progTitle(p, true)}`, html: h, file: `ประวัติปรับปรุง-${p.code}` };
};
DOCS["DOC-COMPARE"] = p => {
  let a, b; const cd = S.ui.cmpDoc;
  if (cd && cd.prog === p.id) { a = verOf(cd.a); b = verOf(cd.b); }
  else { const vs = [...p.versions].sort((x, y) => x.year - y.year); b = vs[vs.length - 1]; a = vs.length > 1 ? vs[vs.length - 2] : vs[0]; }
  const sa = snapOf(p, a), sb = snapOf(p, b); const d = diffSnap(sa, sb); const r = histOf(p).find(x => x.ver === b.id && ["NEW", "MAJOR"].includes(x.kind));
  const fa = flatTree(sa.tree), fb = flatTree(sb.tree); const paths = [...new Set([...fa.keys(), ...fb.keys()])];
  const cn = c => { const x = IDX.course.get(c); return x ? `${c} ${x.th} ${x.cr}` : c; }; const g = k => d.items.filter(i => i.area === k);
  const h = `<div class="a4 land">${docHead("DOC-COMPARE")}<h1>ตารางเปรียบเทียบหลักสูตรเดิมกับหลักสูตรปรับปรุง</h1><p class="center">หลักสูตร${esc(p.degree)} สาขาวิชา${esc(p.name)} · ฉบับ พ.ศ. ${a.year} เทียบกับ พ.ศ. ${b.year}</p>
    <h2>1. สาระในการปรับปรุง</h2>${r && r.issues.length ? `<ol>${r.issues.map(i => `<li>${esc(i.text)}</li>`).join("")}</ol><p>เหตุผล: ${r.reasons.map(reasonTh).map(esc).join(", ")}</p>` : "<p>[ยังไม่ระบุสาระการปรับปรุง]</p>"}
    <h2>2. เปรียบเทียบภาพรวม</h2><table><thead><tr><th>หัวข้อ</th><th>หลักสูตรเดิม พ.ศ. ${a.year}</th><th>หลักสูตรปรับปรุง พ.ศ. ${b.year}</th></tr></thead><tbody>${[["หน่วยกิตรวม", sa.credits, sb.credits], ["ระยะเวลาศึกษา", sa.years + " ปี", sb.years + " ปี"], ["แผนการศึกษา", [...new Set(sa.plans)].join(", "), [...new Set(sb.plans)].join(", ")], ["กรอบผลการเรียนรู้", sa.framework || "—", sb.framework || "—"]].map(x => `<tr><td>${x[0]}</td><td>${esc(x[1])}</td><td>${esc(x[2])}</td></tr>`).join("")}</tbody></table>
    <h2>3. โครงสร้างหลักสูตร</h2>${sa.tree && sb.tree ? `<table><thead><tr><th>หมวด/กลุ่มวิชา</th><th>เดิม</th><th>ปรับปรุง</th></tr></thead><tbody>${paths.map(k => `<tr><td>${esc(k.replace(/^โครงสร้างหลักสูตร › ?/, "") || "รวมตลอดหลักสูตร")}</td><td class="n">${fa.has(k) ? fa.get(k) : "—"}</td><td class="n">${fb.has(k) ? fb.get(k) : "—"}</td></tr>`).join("")}</tbody></table>` : "<p>ฉบับเดิมไม่มีโครงสร้างรายหมวดในระบบ [รอข้อมูล G05/G18]</p>"}
    <h2>4. รายวิชาที่เปลี่ยนแปลง</h2><table><thead><tr><th>รายวิชาที่ตัดออก</th><th>รายวิชาที่เพิ่ม</th></tr></thead><tbody><tr><td>${g("COURSE_REMOVE").map(i => esc(cn(i.ref))).join("<br>") || "—"}</td><td>${g("COURSE_ADD").map(i => esc(cn(i.ref))).join("<br>") || "—"}</td></tr></tbody></table>
    <h2>5. ผลลัพธ์การเรียนรู้</h2><table><thead><tr><th>เดิม</th><th>ปรับปรุง</th></tr></thead><tbody><tr><td>${(sa.plos || []).map(x => `${x.code} ${esc(x.text)}`).join("<br>") || "—"}</td><td>${(sb.plos || []).map(x => `${x.code} ${esc(x.text)}`).join("<br>") || "—"}</td></tr></tbody></table>
    <h2>6. อาจารย์ผู้รับผิดชอบหลักสูตร</h2><p>${g("STAFF_OUT").length || g("STAFF_IN").length ? `ออก: ${g("STAFF_OUT").map(i => esc(staffName(i.ref))).join(", ") || "—"} · เข้า: ${g("STAFF_IN").map(i => esc(staffName(i.ref))).join(", ") || "—"}` : sa.staff ? "ไม่เปลี่ยนแปลง" : "ไม่มีข้อมูลของฉบับเดิม"}</p>
    <p class="small">ระบบตรวจพบความต่าง ${d.items.length} รายการ (${d.items.filter(i => i.sig === "MAJOR").length} รายการระดับสาระสำคัญ) · ใช้เป็นภาคผนวกเล่ม มคอ.2 หลักสูตรปรับปรุง</p></div>`;
  return { title: `ตารางเปรียบเทียบ ${progTitle(p, true)} ${a.year}–${b.year}`, html: h, file: `เปรียบเทียบ-${p.code}-${a.year}-${b.year}` };
};
DOCS["RPT-CHANGES"] = () => {
  const rows = changeRows();
  const cols = [{ th: "ปีที่มีผล", val: r => r.effYear || "" }, { th: "ภาค", val: r => r.effTerm || "" }, { th: "รหัสหลักสูตร", val: r => IDX.prog.get(r.prog).code }, { th: "หลักสูตร", val: r => progTitle(IDX.prog.get(r.prog), true) }, { th: "คณะ", val: r => IDX.fac.get(IDX.prog.get(r.prog).fac).name },
    { th: "ประเภท", val: r => HKIND[r.kind][0] }, { th: "ครั้งที่", val: r => recLabel(r) }, { th: "ฉบับ", val: r => (verOf(r.ver) || {}).year || "" }, { th: "รุ่นที่ใช้", val: r => r.retro ? "ทุกรุ่นของฉบับ" : r.cohort || "" }, { th: "เหตุผล", val: r => r.reasons.map(reasonTh).join("; ") },
    { th: "ประเด็นสำคัญ", val: r => r.issues.map(i => i.text).join("; ") }, { th: "มติ", val: r => r.council ? `${r.council.no} ${r.council.date}` : "" }, { th: "สถานะ", val: r => HSTATUS[r.status][0] }, { th: "hash", val: r => r.hash || "" }];
  const h = `<div class="a4 land">${docHead("RPT-CHANGES")}<h1>ทะเบียนการปรับปรุงหลักสูตร</h1><p class="center">${fmt(rows.length)} รายการ (ตามตัวกรองปัจจุบัน) · แสดง 60 รายการล่าสุด ไฟล์ CSV มีครบ</p><table><thead><tr>${cols.slice(0, 13).map(c => `<th>${c.th}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 60).map(r => `<tr>${cols.slice(0, 13).map(c => `<td>${esc(c.val(r))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  return { title: "ทะเบียนการปรับปรุงหลักสูตร", html: h, file: "ทะเบียนการปรับปรุงหลักสูตร", csv: csv(rows, cols) };
};
