/* docs.js — เอกสารพิมพ์ (A4) และไฟล์ส่งออก */
"use strict";

const DOC_CSS = `body{margin:0;background:#ddd;font-family:Sarabun,"TH Sarabun New",serif}
.a4{background:#fff;color:#111;width:794px;min-height:1123px;margin:16px auto;padding:72px 72px 64px 96px;font-size:15.5px;line-height:1.6;box-sizing:border-box}
.a4.land{width:1123px;min-height:794px;padding:56px 56px 48px 64px}
h1{font-size:21px;text-align:center;margin:0 0 4px}h2{font-size:17px;margin:16px 0 6px}h3{font-size:16px;margin:10px 0 4px}p{margin:0 0 6px}p.ind{text-indent:2.5em}
.center{text-align:center}.right{text-align:right}table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:14.5px}
th,td{border:1px solid #333;padding:3px 6px;vertical-align:top}th{background:#eee}td.n{text-align:right}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;text-align:center}.stamp{border:1px dashed #999;color:#666;font-size:12px;padding:4px 8px;display:inline-block}
.doc-head{display:flex;justify-content:space-between;font-size:13px;color:#444;border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:14px}.wm{color:#a8741a;font-size:12px}
@media print{body{background:#fff}.a4{margin:0;box-shadow:none;page-break-after:always}}`;

/* ค่าตั้งค่าที่กระทบเอกสาร: ถ้ายังไม่ CONFIRMED จะพิมพ์ลายน้ำ "ร่าง" */
const DOC_SETTINGS = {
  "DOC-FINANCE": ["finance.allocation_fallback", "finance.deduct_unit_reserve_default", "finance.allocation_method_default", "finance.rate.QE_EXAM", "finance.gov_subsidy_per_head.VOC_CERT / .HVOC_DIP"],
  "EXP-DS2004": ["uoc.univ_id", "ds2004.teacher_source"],
  "DOC-CISA": ["cisa.connector_mode"],
  "DOC-AGENDA": ["approval_route หลักสูตรใหม่/ปรับปรุง"],
  "DOC-STD2565": ["staff.position_as_of"],
};
function docReadiness(code) {
  return (DOC_SETTINGS[code] || []).map(k => IDX.setting.get(k)).filter(s => s && s.status !== "CONFIRMED");
}
function docHead(code, title) {
  const ready = docReadiness(code);
  return `<div class="doc-head"><span>มหาวิทยาลัยนครพนม · ระบบบริหารจัดการหลักสูตร (CMS)</span><span>${esc(code)} · พิมพ์ ${thDate(today())}</span></div>` +
    (ready.length ? `<p class="wm">ร่าง — ค่าตั้งค่าที่ยังไม่ยืนยัน: ${ready.map(s => esc(s.key) + " (" + DS[s.status][0] + ")").join(", ")}</p>` : "");
}
function sigBlock(left, right) {
  return `<div class="sig"><div>ลงชื่อ ......................................................<br>(${esc(left[0])})<br>${esc(left[1])}<br>วันที่ ........./........./.........</div><div>ลงชื่อ ......................................................<br>(${esc(right[0])})<br>${esc(right[1])}<br>วันที่ ........./........./.........</div></div>`;
}
function respTable(p) {
  const rows = progResponsible(p).map((r, i) => { const s = IDX.staff.get(r.staff); const e = s.edu[s.edu.length - 1] || {};
    return `<tr><td class="n">${i + 1}</td><td>${esc(POS_TH[s.pos])}</td><td>${esc(s.fn + " " + s.ln)}</td><td>${esc(s.edu.map(x => x.degree + " (" + x.inst + ", " + (x.year + 543) + ")").join("; "))}</td><td class="n">${pubs5(s.id).length}</td></tr>`; }).join("");
  return `<table><thead><tr><th>ลำดับ</th><th>ตำแหน่งทางวิชาการ</th><th>ชื่อ–สกุล</th><th>คุณวุฒิ (สาขาวิชา) สถาบัน ปีที่สำเร็จ</th><th>ผลงาน 5 ปี</th></tr></thead><tbody>${rows || '<tr><td colspan="5">ยังไม่กำหนด</td></tr>'}</tbody></table>`;
}
function treeRows(n, depth = 0) {
  let s = `<tr><td style="padding-left:${6 + depth * 18}px">${depth ? "" : "<b>"}${esc(n.title)}${depth ? "" : "</b>"}</td><td class="n">ไม่น้อยกว่า ${n.min} หน่วยกิต</td></tr>`;
  (n.children || []).forEach(ch => { s += treeRows(ch, depth + 1); });
  return s;
}
function courseDescList(codes) {
  return codes.map(c => { const x = IDX.course.get(c); if (!x) return ""; return `<p><b>${esc(x.code)}  ${esc(x.th)}  ${esc(x.cr)}</b><br><i>${esc(x.en)}</i><br>${esc(x.d || "—")}</p>`; }).join("");
}

const DOCS = {
  "DOC-TQF2": (p) => {
    const v = latestVer(p); const s = structureOf(p); const o = obeOf(p); const fac = IDX.fac.get(p.fac);
    const plan = D.design.studyPlans[p.id] || []; const codes = s ? treeCourses(s) : [];
    let h = `<div class="a4">${docHead("DOC-TQF2")}<p class="right">มคอ.2</p><br><br><br><h1>รายละเอียดของหลักสูตร</h1><h1>หลักสูตร${esc(p.degree)}</h1><h1>สาขาวิชา${esc(p.name)}</h1><h1>(หลักสูตร${v.kind === "NEW" ? "ใหม่" : "ปรับปรุง"} พ.ศ. ${v.year})</h1><br><br><br><br><br><br><p class="center">${esc(fac.name)}</p><p class="center">มหาวิทยาลัยนครพนม</p><p class="center">${v.senate ? "สภามหาวิทยาลัยอนุมัติ " + thDate(v.senate, true) : "ร่างเพื่อเสนอคณะกรรมการ"}</p><br><p class="center stamp">ร่างอัตโนมัติจาก CMS · ฉบับ ${v.id} · สถานะ ${VSTATE[v.state][0]}</p></div>`;
    h += `<div class="a4"><h2>หมวดที่ 1 ข้อมูลทั่วไป</h2><table><tbody>
      <tr><th style="width:34%">1. รหัสและชื่อหลักสูตร</th><td>รหัสหลักสูตร ${esc(p.checoCode || "(รอรหัสจาก สป.อว.)")}<br>ภาษาไทย: หลักสูตร${esc(p.degree)} สาขาวิชา${esc(p.name)}</td></tr>
      <tr><th>2. ชื่อปริญญาและสาขาวิชา</th><td>${esc(p.degree)} (${esc(p.name)})</td></tr>
      <tr><th>3. วิชาเอก/แผนการศึกษา</th><td>${esc(v.plans.map(x => x.plan).join(", "))}</td></tr>
      <tr><th>4. จำนวนหน่วยกิตที่เรียนตลอดหลักสูตร</th><td>ไม่น้อยกว่า ${v.credits} หน่วยกิต</td></tr>
      <tr><th>5. รูปแบบของหลักสูตร</th><td>หลักสูตรระดับ${esc(IDX.level.get(p.level).th)} ${v.years} ปี · ภาษาไทย · รับนักศึกษาไทยและต่างชาติที่ใช้ภาษาไทยได้ · ให้ปริญญาเพียงสาขาวิชาเดียว</td></tr>
      <tr><th>6. สถานภาพของหลักสูตร</th><td>หลักสูตร${v.kind === "NEW" ? "ใหม่" : "ปรับปรุง"} พ.ศ. ${v.year} เปิดสอนภาคการศึกษาที่ 1 ปีการศึกษา ${v.year}${v.senate ? `<br>สภามหาวิทยาลัยอนุมัติ ${thDate(v.senate, true)}` : ""}</td></tr>
      <tr><th>7. ความพร้อมในการเผยแพร่คุณภาพ</th><td>ปีการศึกษา ${v.year + v.years}</td></tr>
      <tr><th>8. สถานที่จัดการเรียนการสอน</th><td>${esc(fac.name)} มหาวิทยาลัยนครพนม จังหวัดนครพนม</td></tr></tbody></table>
      <h3>9. อาจารย์ผู้รับผิดชอบหลักสูตร</h3>${respTable(p)}
      <h2>หมวดที่ 2 ข้อมูลเฉพาะของหลักสูตร</h2><h3>1. ปรัชญา</h3><p class="ind">ผลิตบัณฑิตสาขาวิชา${esc(p.name)}ที่มีความรู้คู่คุณธรรม พร้อมทำงานในบริบทอนุภูมิภาคลุ่มน้ำโขง และพัฒนาตนเองได้ตลอดชีวิต <span class="wm">[ข้อความตัวอย่าง]</span></p>
      <h3>2. ผลลัพธ์การเรียนรู้ระดับหลักสูตร (PLOs)</h3>${o ? `<table><thead><tr><th>PLO</th><th>ข้อความ</th><th>KSEC</th><th>ระดับ</th><th>เกณฑ์การวัด</th></tr></thead><tbody>${o.plos.map(x => `<tr><td>${x.code}</td><td>${esc(x.text)}</td><td>${x.domain}</td><td>${esc(x.level)}</td><td>${esc(x.criteria)}</td></tr>`).join("")}</tbody></table>` : "<p>ยังไม่มีข้อมูล PLO ในระบบ (ฉบับที่ย้ายจากระบบเดิม)</p>"}</div>`;
    h += `<div class="a4"><h2>หมวดที่ 3 ระบบการจัดการศึกษา การดำเนินการ และโครงสร้างของหลักสูตร</h2><p class="ind">ระบบทวิภาค 1 ปีการศึกษาแบ่งเป็น 2 ภาคการศึกษาปกติ แต่ละภาคมีระยะเวลาศึกษาไม่น้อยกว่า 15 สัปดาห์</p>
      <h3>3.1 โครงสร้างหลักสูตร</h3>${s ? `<table><tbody>${treeRows(s)}</tbody></table>` : `<p>จำนวนหน่วยกิตรวมไม่น้อยกว่า ${v.credits} หน่วยกิต (รายละเอียดรายหมวดรอข้อมูลจากระบบทะเบียน — P20)</p>`}
      <h3>3.2 แผนการศึกษา</h3>${plan.length ? plan.map(t => `<p><b>ปีที่ ${t.year} ภาคการศึกษาที่ ${t.term}</b></p><table><tbody>${t.courses.map(c => { const x = IDX.course.get(c); return x ? `<tr><td style="width:18%">${esc(x.code)}</td><td>${esc(x.th)}</td><td class="n" style="width:16%">${esc(x.cr)}</td></tr>` : ""; }).join("")}</tbody></table>`).join("") : "<p>—</p>"}</div>`;
    if (codes.length) h += `<div class="a4"><h3>3.3 คำอธิบายรายวิชา</h3>${courseDescList(codes.slice(0, 18))}${codes.length > 18 ? `<p class="wm">… และอีก ${codes.length - 18} รายวิชา (ตัดเพื่อความกระชับในต้นแบบ)</p>` : ""}</div>`;
    if (o) {
      const pc = o.plos.map(x => x.code);
      h += `<div class="a4 land"><h2>หมวดที่ 4 ความสัมพันธ์ระหว่างรายวิชากับผลลัพธ์การเรียนรู้ (Curriculum Mapping)</h2><p>I = Introduce · R = Reinforce · M = Mastery</p><table><thead><tr><th>รายวิชา</th>${pc.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${Object.entries(o.mapping).map(([c, m]) => `<tr><td>${esc(c)} ${esc((IDX.course.get(c) || {}).th || "")}</td>${pc.map(x => `<td class="center">${m[x] || ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    h += `<div class="a4"><h2>หมวดที่ 5–7 (สรุป)</h2><p class="ind">การประเมินผลการเรียนรู้ใช้ระบบค่าระดับคะแนน 8 ระดับ เกณฑ์สำเร็จการศึกษาเป็นไปตามระเบียบมหาวิทยาลัยนครพนมว่าด้วยการจัดการศึกษาระดับปริญญาตรี และได้ค่าระดับคะแนนเฉลี่ยสะสมไม่ต่ำกว่า ${esc(v.minGpa)}</p><p class="ind">การรับรองหลักสูตรเป็นไปตามประกาศ กมอ. พ.ศ. 2568 · ครบรอบปรับปรุง ปี ${p.nextReview} · การรับรองถึงปี ${p.accredExpiry}</p>${sigBlock([staffName((progResponsible(p)[0] || {}).staff), "ประธานหลักสูตร"], [headOf(p.fac), "คณบดี/ผู้อำนวยการ"])}</div>`;
    return { title: `มคอ.2 ${progTitle(p, true)} พ.ศ. ${v.year}`, html: h, file: `มคอ2-${p.code}-${v.year}` };
  },

  "DOC-AGENDA": (c) => {
    const p = IDX.prog.get(c.prog); const v = (IDX.ver.get(c.ver) || {}).v || latestVer(p); const cur = currentStep(c) || c.steps[c.steps.length - 1];
    const m = cur && cur.meeting ? IDX.meeting.get(cur.meeting) : null; const st = standardsCheck(p); const sc = D.finance.scenarios[p.id];
    const be = sc ? breakeven(sc) : null;
    const h = `<div class="a4">${docHead("DOC-AGENDA")}<h1>แบบเสนอวาระการประชุม${esc(BODY_TH(cur.body))}</h1><p class="center">${m ? `ครั้งที่ ${esc(m.no)} วันที่ ${thDate(m.date, true)}` : "ครั้งที่ ....... วันที่ ............................."}</p>
      <table><tbody><tr><th style="width:26%">ระเบียบวาระที่</th><td>4 เรื่องเสนอเพื่อพิจารณา</td></tr><tr><th>เรื่อง</th><td>${esc(c.title)}</td></tr><tr><th>หน่วยงานที่เสนอ</th><td>${esc(IDX.fac.get(p.fac).name)}</td></tr><tr><th>ผู้เสนอ</th><td>${esc(userName(c.by))}</td></tr><tr><th>เลขที่เรื่องในระบบ</th><td>${esc(c.no)}</td></tr></tbody></table>
      <h3>1. ความเป็นมา</h3><p class="ind">${esc(IDX.fac.get(p.fac).name)} ได้${c.type === "NEW" ? "จัดทำหลักสูตรใหม่" : c.type === "CLOSE" ? "พิจารณาปิดหลักสูตร" : "ปรับปรุงหลักสูตร"}${esc(progTitle(p))} ${c.type === "CLOSE" ? `เนื่องจากมีนักศึกษาต่ำกว่าเกณฑ์ต่อเนื่อง 3 ปี (${(stat(p) || { intake: [] }).intake.join(", ")} คน)` : `พ.ศ. ${v.year} ให้สอดคล้องกับประกาศกระทรวงการอุดมศึกษาฯ เรื่องเกณฑ์มาตรฐานหลักสูตร พ.ศ. 2565 และประกาศ กมอ. พ.ศ. 2568`}</p>
      <h3>2. ผลการพิจารณาที่ผ่านมา</h3><table><thead><tr><th>คณะกรรมการ</th><th>ครั้งที่/วันที่</th><th>มติ</th><th>ข้อสังเกต</th></tr></thead><tbody>${c.steps.filter(s => s.status === "DONE").map(s => { const mm = s.meeting ? IDX.meeting.get(s.meeting) : null; return `<tr><td>${esc(BODY_TH(s.body))}</td><td>${mm ? esc(mm.no) + " " : ""}${thDate(s.date)}</td><td>${esc((RESULT_TH[s.result] || [s.result])[0])}</td><td>${esc(s.note)}</td></tr>`; }).join("") || '<tr><td colspan="4">เป็นการพิจารณาครั้งแรก</td></tr>'}</tbody></table>
      <h3>3. สาระสำคัญ</h3><table><tbody><tr><th style="width:40%">จำนวนหน่วยกิตรวม</th><td>${v.credits} หน่วยกิต</td></tr><tr><th>แผนรับนักศึกษา</th><td>${(stat(p) || { plan: "-" }).plan} คน/ปี</td></tr><tr><th>อาจารย์ผู้รับผิดชอบหลักสูตร</th><td>${progResponsible(p).length} คน · ผลตรวจเกณฑ์ 2565: ${st.ok ? "ผ่านทุกข้อ" : `ไม่ผ่าน ${st.fails} รายการ`}</td></tr>${be ? `<tr><th>จุดคุ้มทุน</th><td>${fmt(be.beConcurrent)} คน (พร้อมกันทุกชั้นปี) · ${fmt(be.beCohort)} คน/รุ่น</td></tr>` : ""}</tbody></table>
      <h3>4. ระเบียบ/ข้อบังคับที่เกี่ยวข้อง</h3><p class="ind">ข้อบังคับมหาวิทยาลัยนครพนมว่าด้วยการจัดการศึกษา · ประกาศเกณฑ์มาตรฐานหลักสูตร พ.ศ. 2565 · ประกาศ กมอ. พ.ศ. 2568 (การพิจารณาภายใน 90 วัน)</p>
      <h3>5. ประเด็นเสนอเพื่อพิจารณา</h3><p class="ind">จึงเสนอที่ประชุมเพื่อโปรดพิจารณา${c.type === "CLOSE" ? "ปิดหลักสูตร" : "ให้ความเห็นชอบหลักสูตร"}ดังกล่าว</p>
      <h3>เอกสารประกอบ</h3><p>1) ร่างเล่มรายละเอียดหลักสูตร (DOC-TQF2) 2) ตารางวิเคราะห์ต้นทุนและจุดคุ้มทุน (DOC-FINANCE) 3) รายงานผลตรวจเกณฑ์ 2565 (DOC-STD2565)</p>${sigBlock([userName(c.by), "เจ้าหน้าที่หลักสูตรคณะ/วิทยาลัย (ผู้เสนอ)"], [headOf(IDX.prog.get(c.prog).fac), "คณบดี/ผู้อำนวยการ"])}</div>`;
    return { title: `แบบเสนอวาระ ${c.no}`, html: h, file: `วาระ-${c.no}` };
  },

  "DOC-RESOLUTION": (m) => {
    const items = D.workflow.cases.filter(c => c.steps.some(s => s.meeting === m.id));
    const h = `<div class="a4">${docHead("DOC-RESOLUTION")}<h1>รายงานการประชุม${esc(BODY_TH(m.body))}</h1><p class="center">ครั้งที่ ${esc(m.no)} วันที่ ${thDate(m.date, true)}</p><p class="center">(เฉพาะวาระที่เกี่ยวกับหลักสูตร)</p>
      ${items.map((c, i) => { const s = c.steps.find(x => x.meeting === m.id); const p = IDX.prog.get(c.prog);
        return `<h3>4.${i + 1} ${esc(c.title)}</h3><p class="ind">${esc(IDX.fac.get(p.fac).name)} เสนอ${esc(CASE_TYPE[c.type] || "")} ${esc(progTitle(p))}</p><p><b>มติ</b> ${s && s.result ? esc(RESULT_TH[s.result][0]) : "(รอบันทึกมติ)"}${s && s.note ? " — " + esc(s.note) : ""}</p>`; }).join("") || "<p>ไม่มีวาระหลักสูตร</p>"}
      ${sigBlock([(usersOf("CC")[0] || {}).name || "", "เลขานุการ (เจ้าหน้าที่หลักสูตรส่วนกลาง)"], ["...........................................", "ผู้ตรวจรายงานการประชุม"])}</div>`;
    return { title: `รายงานการประชุม ${BODY_TH(m.body)} ${m.no}`, html: h, file: `มติ-${m.body}-${m.no.replace("/", "-")}` };
  },

  "DOC-FINANCE": (p) => {
    const sc = D.finance.scenarios[p.id]; if (!sc) return { title: "ไม่มีข้อมูล", html: `<div class="a4"><p>หลักสูตรนี้ยังไม่มีการวิเคราะห์ต้นทุน</p></div>` };
    const be = breakeven(sc); const items = D.finance.costItems;
    const fixedRows = Object.entries(sc.fixed).map(([k, v]) => { const it = items.find(x => x.code === k); return `<tr><td>${esc(it.cat)}</td><td>${esc(it.th)}</td><td class="n">${baht(v)}</td><td>${esc(DS[it.status][0])}</td></tr>`; }).join("");
    const vRows = Object.entries(sc.variablePerHead).filter(([, v]) => v).map(([k, v]) => { const it = items.find(x => x.code === k); return `<tr><td>${esc(it.cat)}</td><td>${esc(it.th)}</td><td class="n">${baht(v * 2)}</td><td>${esc(DS[it.status][0])}</td></tr>`; }).join("");
    const h = `<div class="a4 land">${docHead("DOC-FINANCE")}<h1>การวิเคราะห์ต้นทุนและจุดคุ้มทุนของหลักสูตร</h1><p class="center">${esc(progTitle(p))} · ${esc(IDX.fac.get(p.fac).name)}</p>
      <h3>ตารางที่ 12 ประมาณการรายรับต่อนักศึกษา 1 คนต่อปี</h3><table><thead><tr><th>รายการ</th><th>อัตรา</th><th>ต่อปี (บาท)</th><th>แหล่งข้อมูล</th></tr></thead><tbody>
        <tr><td>ค่าธรรมเนียมการศึกษาแบบเหมาจ่ายต่อภาค</td><td class="n">${baht(sc.feePerTerm)}</td><td class="n">${baht(sc.feePerTerm * 2)}</td><td>${esc(sc.feeSource)}</td></tr>
        ${sc.subsidy != null ? `<tr><td>เงินอุดหนุนรายหัว</td><td class="n">${baht(sc.subsidy)}</td><td class="n">${baht(sc.subsidy)}</td><td>รัฐบาล</td></tr>` : `<tr><td>เงินอุดหนุนรายหัว (ปวช./ปวส.)</td><td colspan="2" class="n">ยังไม่มีข้อมูล</td><td>ต้องกรอก (P09)</td></tr>`}
        <tr><td>หัก จัดสรรเงินรายได้ ${pct(sc.allocationPct)} (ปีงบ ${sc.allocationYear})</td><td></td><td class="n">(${baht(be.revPerHeadYear * sc.allocationPct)})</td><td>ประกาศจัดสรรเงินรายได้</td></tr>
        <tr><th colspan="2">รายรับสุทธิที่หลักสูตรใช้ได้ต่อคนต่อปี</th><th class="n">${baht(be.netRevPerHead)}</th><th></th></tr></tbody></table>
      <h3>ตารางที่ 13 ประมาณการรายจ่ายจำแนกตามหมวดงบประมาณ</h3><table><thead><tr><th>หมวดงบ</th><th>รายการ</th><th>บาท/ปี</th><th>สถานะข้อมูล</th></tr></thead><tbody><tr><th colspan="4">ต้นทุนคงที่ (FC) ต่อปี</th></tr>${fixedRows}<tr><th colspan="2">รวมต้นทุนคงที่</th><th class="n">${baht(be.fc)}</th><th></th></tr><tr><th colspan="4">ต้นทุนผันแปร (VC) ต่อนักศึกษา 1 คนต่อปี</th></tr>${vRows}<tr><th colspan="2">รวมต้นทุนผันแปรต่อคน</th><th class="n">${baht(be.vcPerHead)}</th><th></th></tr></tbody></table>
      <h3>ตารางที่ 14 จุดคุ้มทุนและประมาณการ 5 ปี</h3><p>จุดคุ้มทุน = FC ÷ (รายรับสุทธิต่อคน − VC ต่อคน) = ${baht(be.fc)} ÷ (${baht(be.netRevPerHead)} − ${baht(be.vcPerHead)}) = <b>${be.beConcurrent ? fmt(be.beConcurrent) + " คน (นักศึกษาทุกชั้นปีรวมกัน) หรือ " + fmt(be.beCohort) + " คน/รุ่น" : "ไม่คุ้มทุน (ส่วนเหลือต่อคนติดลบ)"}</b></p>
      <table><thead><tr><th>ปีงบประมาณ</th><th>จำนวนนักศึกษา</th><th>รายรับ</th><th>จัดสรร ${pct(sc.allocationPct)}</th><th>ต้นทุนผันแปร</th><th>ต้นทุนคงที่</th><th>ส่วนเกิน/(ขาด)</th></tr></thead><tbody>${be.proj.map(r => `<tr><td>${r.fy}</td><td class="n">${fmt(r.heads)}</td><td class="n">${baht(r.rev)}</td><td class="n">${baht(r.alloc)}</td><td class="n">${baht(r.vc)}</td><td class="n">${baht(r.fc)}</td><td class="n">${r.profit < 0 ? "(" + baht(-r.profit) + ")" : baht(r.profit)}</td></tr>`).join("")}</tbody></table>
      <p>หมายเหตุ: ไม่รวมค่าเสื่อมราคาสิ่งก่อสร้าง · อัตราค่าตอบแทนที่ระบุ “อ้างอิง มมส.” ใช้ชั่วคราวจนกว่าจะมีประกาศ มนพ. (P14)</p>${sigBlock([staffName((progResponsible(p)[0] || {}).staff), "ผู้จัดทำ"], ["...........................................", "ผู้อำนวยการกองนโยบายและแผน"])}</div>`;
    const cols = [{ th: "ปีงบประมาณ", val: r => r.fy }, { th: "จำนวนนักศึกษา", val: r => r.heads }, { th: "รายรับ", val: r => Math.round(r.rev) }, { th: "จัดสรร", val: r => Math.round(r.alloc) }, { th: "ต้นทุนผันแปร", val: r => Math.round(r.vc) }, { th: "ต้นทุนคงที่", val: r => r.fc }, { th: "ส่วนเกิน", val: r => Math.round(r.profit) }];
    return { title: `ตารางต้นทุนและจุดคุ้มทุน ${progTitle(p, true)}`, html: h, csv: csv(be.proj, cols), file: `จุดคุ้มทุน-${p.code}` };
  },

  "DOC-CISA": (p) => {
    const pf = cisaPreflight(p); const v = activeVer(p); const resp = progResponsible(p).map(r => IDX.staff.get(r.staff));
    const fields = [["ชื่อหลักสูตร (ไทย)", `หลักสูตร${p.degree} สาขาวิชา${p.name}`], ["ระดับ", IDX.level.get(p.level).th], ["สถานภาพ", v.kind === "NEW" ? "หลักสูตรใหม่" : "หลักสูตรปรับปรุง"], ["ปีที่เริ่มใช้", v.year],
      ["หน่วยกิตรวม", v.credits], ["ระยะเวลาศึกษา (ปี)", v.years], ["วันที่สภาอนุมัติ", v.senate || ""], ["คณะ/หน่วยงาน (REF_FAC)", IDX.fac.get(p.fac).name], ["รหัสหลักสูตรเดิม", p.checoCode || ""],
      ...resp.map((s, i) => [`อาจารย์ผู้รับผิดชอบ ${i + 1}`, `${s.fn} ${s.ln} · ${POS_TH[s.pos]} · ${(s.edu[s.edu.length - 1] || {}).degree || ""} · เลขบัตร: (นายทะเบียนกรอกใน CISA)`])];
    const h = `<div class="a4">${docHead("DOC-CISA")}<h1>ชุดเตรียมกรอกระบบ CISA</h1><p class="center">${esc(progTitle(p))}</p><p class="ind">CISA ไม่มี API ให้สถาบัน นายทะเบียนหลักสูตรใช้ชุดนี้คัดลอกเข้าเว็บ CISA (เข้าระบบด้วย ThaID) แล้วบันทึกสถานะกลับใน CMS</p>
      <h3>ผลตรวจความพร้อมก่อนส่ง (pre-flight 8 ข้อ ตามประกาศ กมอ. ข้อ 5.1)</h3><table><thead><tr><th>ข้อ</th><th>รายการ</th><th>ผล</th><th>รายละเอียด</th></tr></thead><tbody>${pf.map(x => `<tr><td>${x.no}</td><td>${esc(x.th)}</td><td>${x.ok ? "ผ่าน" : "ไม่ผ่าน"}</td><td>${esc(x.msg)}</td></tr>`).join("")}</tbody></table>
      <h3>ข้อมูลสำหรับกรอก</h3><table><tbody>${fields.map(([k, v]) => `<tr><th style="width:34%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table><p class="wm">ไม่มีเลขประจำตัวประชาชนในชุดนี้ตามหลัก PDPA</p></div>`;
    return { title: `ชุดเตรียมกรอก CISA ${progTitle(p, true)}`, html: h, csv: csv(fields, [{ th: "ฟิลด์ CISA", val: r => r[0] }, { th: "ค่า", val: r => r[1] }]), file: `CISA-${p.code}` };
  },

  "DOC-STD2565": (p) => {
    const st = standardsCheck(p); if (!st.rs) return { title: "ไม่มีชุดกฎ", html: `<div class="a4"><p>ระดับนี้ไม่มีชุดกฎ</p></div>` };
    const rules = st.rs.rules.filter(r => r.type !== "COUNT");
    const h = `<div class="a4 land">${docHead("DOC-STD2565")}<h1>รายงานผลตรวจคุณสมบัติอาจารย์ผู้รับผิดชอบหลักสูตร</h1><p class="center">${esc(progTitle(p))} · ชุดกฎ ${esc(st.rs.set)} · ข้อมูลอาจารย์จาก ERP-HR ณ ${thDate(today())}</p>
      ${st.prog.map(x => `<p><b>ข้อ ${x.no}</b> ${esc(x.th)} — ${x.ok ? "ผ่าน" : "ไม่ผ่าน"} (${esc(x.msg)})</p>`).join("")}
      <table><thead><tr><th>ชื่อ–สกุล</th><th>ตำแหน่ง/คุณวุฒิ</th>${rules.map(r => `<th>ข้อ ${r.no}<br><span style="font-weight:400">${esc(r.th)}</span></th>`).join("")}</tr></thead><tbody>${st.rows.map(x => `<tr><td>${esc(staffName(x.s.id))}</td><td>${esc(POS_TH[x.s.pos])}<br>${esc(DEG_TH[x.s.deg])} ${esc(x.s.field)} (ISCED ${esc(x.s.isced || "—")})</td>${x.res.map(r => `<td>${r.ok ? "✓" : r.warn ? "?" : "✗"} ${esc(r.msg)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p>สรุป: ${st.ok ? "ผ่านเกณฑ์ทุกข้อ" : `ไม่ผ่าน ${st.fails} รายการ`}${st.warns ? ` · ต้องตรวจด้วยคน ${st.warns} คน` : ""}</p></div>`;
    const rows = st.rows.map(x => ({ name: staffName(x.s.id), pos: POS_TH[x.s.pos], deg: DEG_TH[x.s.deg], isced: x.s.isced || "", res: x.res }));
    return { title: `ผลตรวจเกณฑ์ 2565 ${progTitle(p, true)}`, html: h, csv: csv(rows, [{ th: "ชื่อ", val: r => r.name }, { th: "ตำแหน่ง", val: r => r.pos }, { th: "คุณวุฒิสูงสุด", val: r => r.deg }, { th: "ISCED", val: r => r.isced }, ...rules.map((r, i) => ({ th: "ข้อ " + r.no, val: x => (x.res[i].ok ? "ผ่าน" : "ไม่ผ่าน") + " " + x.res[i].msg }))]), file: `เกณฑ์2565-${p.code}` };
  },

  "DOC-SMO08": (a) => {
    const p = IDX.prog.get(a.prog);
    const h = `<div class="a4">${docHead("DOC-SMO08")}<p class="right">สมอ.08</p><h1>แบบรายงานการปรับปรุงแก้ไขหลักสูตร</h1><p class="center">${esc(progTitle(p))} (หลักสูตร พ.ศ. ${p.latestYear})</p>
      <table><tbody><tr><th style="width:32%">เลขที่</th><td>${esc(a.no)}</td></tr><tr><th>ประเภทการปรับปรุง</th><td>${esc(AMEND_KIND[a.kind])}</td></tr><tr><th>เหตุผล</th><td>${esc(a.reason)}</td></tr><tr><th>มีผลตั้งแต่</th><td>ภาคการศึกษาที่ 2 ปีการศึกษา 2569</td></tr></tbody></table>
      ${a.kind === "CHANGE_STAFF" ? `<h3>รายละเอียดการเปลี่ยนแปลงอาจารย์ผู้รับผิดชอบหลักสูตร</h3><table><thead><tr><th>เดิม</th><th>ใหม่</th></tr></thead><tbody><tr><td>${esc(staffName(a.out))}<br>${esc(POS_TH[IDX.staff.get(a.out).pos])}</td><td>${esc(staffName(a.in))}<br>${esc(POS_TH[IDX.staff.get(a.in).pos])} · ${esc(DEG_TH[IDX.staff.get(a.in).deg])}</td></tr></tbody></table>` : `<h3>รายละเอียด</h3><p class="ind">${esc(a.reason)}</p>`}
      <h3>การพิจารณา</h3><p>สถานะปัจจุบัน: ${esc(AMEND_STATUS[a.status][0])}</p>${sigBlock([(usersOf("FC", IDX.prog.get(a.prog).fac)[0] || {}).name || "", "เจ้าหน้าที่หลักสูตรคณะ/วิทยาลัย"], [headOf(IDX.prog.get(a.prog).fac), "คณบดี/ผู้อำนวยการ"])}</div>`;
    return { title: `${a.no}`, html: h, file: a.no };
  },

  "EXP-DS2004": () => {
    const rows = ds2004Rows();
    const cols = [{ th: "ACADEMIC_YEAR", val: r => r.year }, { th: "SEMESTER", val: r => r.sem }, { th: "STAFF_ID", val: r => r.staff }, { th: "UNIV_ID", val: () => (IDX.setting.get("uoc.univ_id") || {}).status === "CONFIRMED" ? "" : "TBD" }, { th: "CITIZEN_ID", val: () => "(ERP-HR เติม)" }, { th: "FAC_ID", val: r => r.fac }, { th: "CURR_ID", val: r => r.curr }, { th: "TEACH_TYPE_ID", val: r => r.tt }, { th: "หมายเหตุ", val: r => r.err }];
    const h = `<div class="a4 land">${docHead("EXP-DS2004")}<h1>ชุดข้อมูลตั้งต้น DS2004 (หลักสูตรที่สอนของบุคลากร)</h1><p class="center">ภาคการศึกษาที่ 2/2569 · ${fmt(rows.length)} แถว · ERP-HR เติม UNIV_ID และ CITIZEN_ID แล้วส่ง สป.อว.</p>
      <table><thead><tr>${cols.map(c => `<th>${esc(c.th)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 30).map(r => `<tr>${cols.map(c => `<td>${esc(c.val(r))}</td>`).join("")}</tr>`).join("")}</tbody></table><p>แสดง 30 แถวแรก (ไฟล์ CSV มีครบ) · แถวที่ไม่มี CURR_ID: ${rows.filter(r => r.err).length}</p></div>`;
    return { title: "DS2004 ภาค 2/2569 (ไฟล์ทดสอบ)", html: h, csv: csv(rows, cols), file: "DS2004-2569-2-test" };
  },

  "RPT-KMO8": (p) => {
    const s = stat(p) || { intake: [], years: [] }; const o = obeOf(p);
    const h = `<div class="a4">${docHead("RPT-KMO8")}<h1>ชุดข้อมูลรายงานตามประกาศ กมอ. ข้อ 8</h1><p class="center">${esc(progTitle(p))}</p><p class="ind">รายงานผลการดำเนินงานหลักสูตรหลังผู้สำเร็จการศึกษารุ่นแรก ประกอบด้วยข้อมูลจากทะเบียน (รับเข้า คงอยู่ สำเร็จ) และจากโมดูล TQF (มคอ.5/7 ผลบรรลุ PLO)</p>
      <table><thead><tr><th>ปีการศึกษา</th>${s.years.map(y => `<th>${y}</th>`).join("")}</tr></thead><tbody><tr><td>รับเข้า (คน)</td>${s.intake.map(n => `<td class="n">${n}</td>`).join("")}</tr><tr><td>แผนรับ</td>${s.years.map(() => `<td class="n">${s.plan}</td>`).join("")}</tr></tbody></table>
      <table><tbody><tr><th style="width:50%">อัตราคงอยู่</th><td>${pct(s.retention)}</td></tr><tr><th>ผู้สำเร็จการศึกษาปีล่าสุด</th><td>${fmt(s.grad)} คน</td></tr><tr><th>ส่ง มคอ.3 ครบตามกำหนด</th><td>${pct(s.tqf3)}</td></tr><tr><th>ส่ง มคอ.5 ครบตามกำหนด</th><td>${pct(s.tqf5)}</td></tr><tr><th>มคอ.7 ปีล่าสุด</th><td>${s.tqf7 ? "ส่งแล้ว" : "ยังไม่ส่ง"}</td></tr></tbody></table>
      ${o && Object.keys(o.attain).length ? `<h3>ผลบรรลุ PLO (จาก TQF)</h3><table><thead><tr><th>PLO</th><th>เป้าหมาย</th><th>ผล</th></tr></thead><tbody>${Object.entries(o.attain).map(([k, v]) => `<tr><td>${k}</td><td class="n">70%</td><td class="n">${pct(v)}</td></tr>`).join("")}</tbody></table>` : "<p>ยังไม่มีผลบรรลุ PLO จาก TQF</p>"}</div>`;
    return { title: `รายงาน กมอ. ข้อ 8 ${progTitle(p, true)}`, html: h, csv: csv(s.years.map((y, i) => ({ y, n: s.intake[i] })), [{ th: "ปีการศึกษา", val: r => r.y }, { th: "รับเข้า", val: r => r.n }]), file: `กมอ8-${p.code}` };
  },

  "RPT-LOWINTAKE": () => {
    const rows = D.programs.filter(p => p.life !== "DRAFT" && stat(p) && lowIntake(p)).map(p => ({ p, s: stat(p) }));
    const cols = [{ th: "คณะ", val: r => IDX.fac.get(r.p.fac).name }, { th: "หลักสูตร", val: r => progTitle(r.p, true) }, { th: "ปีหลักสูตร", val: r => r.p.latestYear }, { th: "สถานะ", val: r => LIFE[r.p.life][0] }, { th: "แผนรับ", val: r => r.s.plan }, { th: "รับเข้า 2567", val: r => r.s.intake[0] }, { th: "รับเข้า 2568", val: r => r.s.intake[1] }, { th: "รับเข้า 2569", val: r => r.s.intake[2] }];
    const h = `<div class="a4 land">${docHead("RPT-LOWINTAKE")}<h1>รายงานหลักสูตรที่มีจำนวนนักศึกษาต่ำกว่าเกณฑ์ 3 ปีต่อเนื่อง</h1><p class="center">ตามมติสภามหาวิทยาลัย ครั้งที่ 8/2568 · เกณฑ์: ป.ตรี/อาชีวะ &lt; 15 คน · บัณฑิตศึกษา &lt; 5 คน · ${rows.length} หลักสูตร</p><table><thead><tr>${cols.map(c => `<th>${c.th}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(c.val(r))}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="wm">สถิตินักศึกษาเป็นข้อมูลจำลอง</p></div>`;
    return { title: "หลักสูตรนักศึกษาน้อย", html: h, csv: csv(rows, cols), file: "หลักสูตรนักศึกษาน้อย-2569" };
  },

  "RPT-REVIEWDUE": () => {
    const y = Number(today().slice(0, 4)) + 543;
    const rows = D.programs.filter(p => p.life === "ACTIVE" && p.nextReview <= y + 2).sort((a, b) => a.nextReview - b.nextReview);
    const cols = [{ th: "คณะ", val: p => IDX.fac.get(p.fac).name }, { th: "หลักสูตร", val: p => progTitle(p, true) }, { th: "ปีหลักสูตร", val: p => p.latestYear }, { th: "ครบรอบปรับปรุง", val: p => p.nextReview }, { th: "การรับรองถึง", val: p => p.accredExpiry }, { th: "เรื่องที่เปิดอยู่", val: p => { const c = openCaseOf(p); return c ? caseStageText(c) : "ยังไม่เริ่มปรับปรุง"; } }];
    const h = `<div class="a4 land">${docHead("RPT-REVIEWDUE")}<h1>หลักสูตรครบรอบปรับปรุงและใกล้หมดอายุการรับรอง</h1><p class="center">ครบรอบภายในปี ${y + 2} · ${rows.length} หลักสูตร</p><table><thead><tr>${cols.map(c => `<th>${c.th}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(c.val(r))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    return { title: "หลักสูตรครบรอบปรับปรุง", html: h, csv: csv(rows, cols), file: "ครบรอบปรับปรุง-2569" };
  },

  "RPT-CISA-SLA": () => {
    const rows = D.workflow.cisa.filter(c => c.step < 12).map(c => ({ c, p: IDX.prog.get(c.prog), sla: cisaSla(c) }));
    const cols = [{ th: "หลักสูตร", val: r => progTitle(r.p, true) }, { th: "คณะ", val: r => IDX.fac.get(r.p.fac).name }, { th: "ขั้น", val: r => `${r.c.step}/12 ${D.meta.cisaSteps[r.c.step - 1]}` }, { th: "ส่งเมื่อ", val: r => thDate(r.c.submitted) }, { th: "ช่วง", val: r => r.sla ? r.sla.phase : "" }, { th: "ใช้ไป (วัน)", val: r => r.sla ? r.sla.days : "" }, { th: "คงเหลือ SLA 90 วัน", val: r => r.sla && r.sla.left != null ? r.sla.left : "-" }, { th: "ส่งกลับแก้ไข", val: r => r.c.returned ? "ใช่" : "" }];
    const h = `<div class="a4 land">${docHead("RPT-CISA-SLA")}<h1>สถานะหลักสูตรในระบบ CISA</h1><p class="center">ณ ${thDate(today(), true)} · อยู่ระหว่างดำเนินการ ${rows.length} หลักสูตร</p><table><thead><tr>${cols.map(c => `<th>${c.th}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(c.val(r))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    return { title: "สถานะ CISA", html: h, csv: csv(rows, cols), file: "สถานะCISA-" + today() };
  },

  "EXP-PROGRAMS": () => {
    const rows = D.programs.filter(inScope);
    const cols = [{ th: "รหัส CMS", val: p => p.code }, { th: "คณะ", val: p => IDX.fac.get(p.fac).name }, { th: "ระดับ", val: p => levelAbbr(p.level) }, { th: "ปริญญา", val: p => p.degree }, { th: "สาขาวิชา", val: p => p.name }, { th: "ปีหลักสูตร", val: p => p.latestYear }, { th: "หน่วยกิต", val: p => latestVer(p).credits }, { th: "รหัสทะเบียน", val: p => latestVer(p).plans.map(x => x.regId).filter(Boolean).join(";") }, { th: "สถานะ", val: p => LIFE[p.life][0] }, { th: "ครบรอบปรับปรุง", val: p => p.nextReview }, { th: "รหัส CHECO", val: p => p.checoCode || "" }];
    return { title: "ทะเบียนหลักสูตร", html: `<div class="a4"><h1>ทะเบียนหลักสูตร</h1><p class="center">${rows.length} หลักสูตร — ใช้ไฟล์ CSV</p></div>`, csv: csv(rows, cols), file: "ทะเบียนหลักสูตร-" + today() };
  },
  "EXP-COURSES": () => {
    const rows = [...IDX.course.values()];
    const cols = [{ th: "รหัสวิชา", val: c => c.code }, { th: "ชื่อไทย", val: c => c.th }, { th: "ชื่ออังกฤษ", val: c => c.en }, { th: "หน่วยกิต", val: c => c.cr }, { th: "คณะ", val: c => c.fac }, { th: "กลุ่ม/หลักสูตร", val: c => c.grp }, { th: "กลุ่มเรียน 2569", val: c => c.sec }, { th: "คำอธิบาย", val: c => c.d }];
    return { title: "คลังรายวิชา", html: `<div class="a4"><h1>คลังรายวิชา</h1><p class="center">${fmt(rows.length)} รายวิชา — ใช้ไฟล์ CSV</p></div>`, csv: csv(rows, cols), file: "คลังรายวิชา-" + today() };
  },
  "RPT-QA": (p) => {
    const s = stat(p) || {}; const st = standardsCheck(p); const o = obeOf(p);
    const h = `<div class="a4">${docHead("RPT-QA")}<h1>Snapshot ข้อมูลหลักสูตรเพื่อการประกันคุณภาพ</h1><p class="center">${esc(progTitle(p))} · รอบ 6 เดือน · ข้อมูล ณ ${thDate(today(), true)} (ล็อกค่า)</p>
      <table><tbody><tr><th style="width:50%">ฉบับที่ใช้</th><td>พ.ศ. ${activeVer(p).year}</td></tr><tr><th>อาจารย์ผู้รับผิดชอบ</th><td>${progResponsible(p).length} คน · เกณฑ์ 2565 ${st.ok ? "ผ่าน" : "ไม่ผ่าน"}</td></tr><tr><th>นักศึกษารับเข้า 3 ปี</th><td>${(s.intake || []).join(" / ")}</td></tr><tr><th>อัตราคงอยู่</th><td>${pct(s.retention)}</td></tr><tr><th>PLO</th><td>${o ? o.plos.length + " ข้อ" : "—"}</td></tr></tbody></table><p class="wm">ส่งให้ระบบประกันคุณภาพผ่าน API qa_snapshot</p></div>`;
    return { title: `QA snapshot ${progTitle(p, true)}`, html: h, file: `QA-${p.code}` };
  },
};
const AMEND_KIND = { CHANGE_STAFF: "เปลี่ยนอาจารย์ผู้รับผิดชอบหลักสูตร", CHANGE_COURSE: "ปรับคำอธิบาย/รายวิชา", CHANGE_INTAKE: "ปรับแผนรับนักศึกษา", CHANGE_PLAN: "ปรับแผนการเรียน" };
const AMEND_STATUS = { DRAFT: ["ร่าง รอคณะเห็นชอบ", "warn"], FACULTY_APPROVED: ["คณะเห็นชอบ รอสภาวิชาการ", "info"], SENATE_APPROVED: ["สภาวิชาการอนุมัติ", "good"], REPORTED: ["แจ้งสภาเพื่อทราบ/แจ้ง สป.อว. แล้ว", "good"], REJECTED: ["ไม่อนุมัติ", "bad"] };

let CURRENT_DOC = null;
function openDoc(code, arg) {
  const meta = D.documents.find(d => d.code === code);
  if (meta && !can(meta.perm)) { toast(denyMsg(meta.perm)); return; }
  const doc = DOCS[code](arg); CURRENT_DOC = doc;
  const ready = docReadiness(code);
  openModal(doc.title, `<div class="actions">${btn("บันทึกเป็น HTML (พิมพ์ได้)", "doc-save-html", { kind: "primary" })}${doc.csv ? btn("บันทึกเป็น CSV", "doc-save-csv") : ""}<span class="muted small">${meta ? esc(meta.code + " · " + meta.uc) : ""}</span></div>
    ${ready.length ? `<div class="note warn">เอกสารนี้จะพิมพ์ลายน้ำ “ร่าง” เพราะมีค่าตั้งค่าที่ยังไม่ยืนยัน ${ready.length} รายการ — ยืนยันได้ที่หน้า ค่าตั้งค่าและความพร้อม</div>` : ""}
    <div class="doc-stage">${doc.html}</div>`, { wide: true });
  audit("ออกเอกสาร", doc.title);
}
act("doc-save-html", () => { const d = CURRENT_DOC; saveFile(d.file + ".html", `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(d.title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap"><style>${DOC_CSS}</style></head><body>${d.html}</body></html>`); });
act("doc-save-csv", () => { const d = CURRENT_DOC; saveFile(d.file + ".csv", d.csv); });
act("open-doc", el => {
  const code = el.dataset.code; const id = el.dataset.id;
  let arg = null;
  if (id) {
    const m = { program: () => IDX.prog.get(Number(id)), case: () => IDX.case.get(Number(id)), meeting: () => IDX.meeting.get(Number(id)), amend: () => D.workflow.amendments.find(a => a.id === Number(id)), course: () => id };
    const meta = D.documents.find(d => d.code === code); arg = (m[meta.scope] || (() => null))();
  }
  openDoc(code, arg);
});
