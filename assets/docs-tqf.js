/* docs-tqf.js — แบบฟอร์ม มคอ.2 / มคอ.3 / มคอ.5 ฉบับเต็ม
   โครงหัวข้อ: แบบฟอร์ม AUN-QA ของ มมส. ปีการศึกษา 2571 (6 หมวด) — มนพ. ใช้โครงสร้างนี้ (ผู้ใช้ 19 พ.ย. 2569, ปิด G01/P16)
   มคอ.3/5 เป็นเอกสารของโมดูล TQF — ต้นแบบนี้แสดงเพื่อยืนยันว่า CMS ส่งข้อมูลตั้งต้นครบ */
"use strict";

function gapTag(code, text) {
  const g = (D.gaps || []).find(x => x.code === code);
  return `<span style="color:#8a5a00;border:1px dashed #a8741a;padding:0 4px;font-size:12px;white-space:nowrap" title="${esc(g ? g.need : "")}">[รอข้อมูล ${esc(code)}${text ? ": " + esc(text) : ""}]</span>`;
}
function sampleTag() { return `<span style="color:#8a5a00;font-size:12px">[ข้อความตัวอย่าง]</span>`; }
function blankLine(n = 1) { return Array.from({ length: n }, () => `<p style="border-bottom:1px dotted #777;height:22px;margin:0 0 4px"></p>`).join(""); }
const TAXO_COLS = { K: ["R", "U", "AP", "AN", "E", "C"], S: ["I", "M", "P", "A", "N"], E: ["Rc", "Rp", "V", "O", "C"] };
const TAXO_MAP = { Remember: "R", Understand: "U", Apply: "AP", Analyze: "AN", Evaluate: "E", Create: "C", Imitation: "I", Manipulation: "M", Precision: "P", Articulation: "A", Naturalization: "N",
  Receiving: "Rc", Responding: "Rp", Valuing: "V", Organization: "O", Characterization: "C" };
const GRADE_BASE = [["A", "80–100", "ดีเยี่ยม", "4.0"], ["B+", "75–79", "ดีมาก", "3.5"], ["B", "70–74", "ดี", "3.0"], ["C+", "65–69", "ดีพอใช้", "2.5"], ["C", "60–64", "พอใช้", "2.0"], ["D+", "55–59", "อ่อน", "1.5"], ["D", "50–54", "อ่อนมาก", "1.0"], ["F", "0–49", "ตก", "0.0"]];
/* ระบบเกรด (ระเบียบ ป.ตรี 2566 ข้อ 38.3) และช่วงคะแนน (ค่าตั้งค่า grade.score_ranges) */
function gradeScale() {
  const st = (IDX.setting && IDX.setting.get("grade.score_ranges")) || {}; const m = {};
  String(st.value || "").split("·").forEach(x => { const r = x.trim().match(/^([A-F]\+?)\s+(\d+\s*[–-]\s*\d+)/); if (r) m[r[1]] = r[2].replace(/\s/g, ""); });
  return GRADE_BASE.map(g => [g[0], m[g[0]] || g[1], g[2], g[3]]);
}
function settingText(key) { const x = IDX.setting && IDX.setting.get(key); return x && x.status !== "REQUIRED_INPUT" && x.value && !/^\(ว่าง/.test(x.value) ? x.value : ""; }
function settingPill(key) { const x = IDX.setting && IDX.setting.get(key); return x && x.status !== "CONFIRMED" ? ` <span style="color:#8a5a00;font-size:12px">[ค่าตั้งค่า ${esc(key)} · ${esc(DS[x.status] ? DS[x.status][0] : x.status)}]</span>` : ""; }
function regOf(p, v) { const grad = ["MASTER", "DOCTOR", "GRAD_DIP"].includes(p.level); if (grad) return settingText("reg.grad.current") || "ระเบียบมหาวิทยาลัยนครพนม ว่าด้วยการศึกษาระดับบัณฑิตศึกษา";
  if (["VOC", "HVOC"].includes(p.level)) return `ระเบียบมหาวิทยาลัยนครพนม ว่าด้วยการจัดการศึกษาระดับ${IDX.level.get(p.level).th}`;
  return v.year >= 2565 ? settingText("reg.bach.current") : settingText("reg.bach.legacy"); }
function staffSorted(p, role = "PROGRAM_RESPONSIBLE") {
  return (IDX.rolesByProg.get(p.id) || []).filter(r => r.role === role).map(r => IDX.staff.get(r.staff)).filter(Boolean)
    .sort((a, b) => (POS_RANK[b.pos] - POS_RANK[a.pos]) || (DEG_RANK[b.deg] - DEG_RANK[a.deg]) || (a.fn + a.ln).localeCompare(b.fn + b.ln, "th"));
}
function eduCell(s) { return [...s.edu].reverse().map(e => `${esc(e.degree)}`).join("<br>"); }
function instCell(s) { return [...s.edu].reverse().map(e => esc(e.inst)).join("<br>"); }
function yearCell(s) { return [...s.edu].reverse().map(e => e.year).join("<br>"); }
function pageA4(inner, land) { return `<div class="a4${land ? " land" : ""}">${inner}</div>`; }
function approvalsOf(p, v) {
  const c = D.workflow.cases.find(x => x.ver === v.id);
  const rows = [];
  if (c) c.steps.forEach(s => { const m = s.meeting ? IDX.meeting.get(s.meeting) : null; rows.push({ body: BODY_TH(s.body), no: s.status === "DONE" && m ? m.no : null, date: s.status === "DONE" ? s.date : null }); });
  else if (v.senate) rows.push({ body: "สภามหาวิทยาลัย", no: null, date: v.senate });
  return rows;
}

/* ===================================================================== มคอ.2 */
DOCS["DOC-TQF2"] = (p) => {
  const v = latestVer(p); const fac = IDX.fac.get(p.fac); const lv = IDX.level.get(p.level);
  const s = structureOf(p); const o = obeOf(p); const plan = D.design.studyPlans[p.id] || []; const codes = s ? treeCourses(s) : [];
  const resp = staffSorted(p), reg = staffSorted(p, "PROGRAM_REGULAR"); const st = stat(p) || { plan: 0 }; const sc = D.finance.scenarios[p.id]; const be = sc ? breakeven(sc) : null;
  const isGrad = ["MASTER", "DOCTOR", "GRAD_DIP"].includes(p.level); const stu = isGrad ? "นักศึกษา" : "นักศึกษา";
  const prevVer = p.versions.find(x => x.id === v.basedOn) || p.versions[p.versions.length - 2];
  const kindTh = v.kind === "NEW" ? "หลักสูตรใหม่" : "หลักสูตรปรับปรุง";
  const appr = approvalsOf(p, v);
  const objectives = [`ผลิตบัณฑิตที่มีความรู้และทักษะด้าน${p.name}ตามมาตรฐานวิชาชีพ`, `ผลิตบัณฑิตที่สามารถประยุกต์ความรู้แก้ปัญหาของชุมชนและผู้ประกอบการในอนุภูมิภาคลุ่มน้ำโขง`, "ผลิตบัณฑิตที่มีคุณธรรม จริยธรรม และเรียนรู้ตลอดชีวิต"];
  let h = "";

  // ปก
  h += pageA4(`${docHead("DOC-TQF2")}<p class="right">มคอ.2</p><br><br><br><br><h1>รายละเอียดของหลักสูตร</h1><h1>หลักสูตร${esc(p.degree)}</h1><h1>สาขาวิชา${esc(p.name)}</h1><h1>(${kindTh} พ.ศ. ${v.year})</h1><br><br><br><br><br><br><br><br><br><br><br><p class="center">${esc(fac.name)}</p><p class="center">มหาวิทยาลัยนครพนม</p><br><p class="center">${v.senate ? "สภามหาวิทยาลัยอนุมัติเมื่อ " + thDate(v.senate, true) : "ร่างเพื่อเสนอคณะกรรมการ"}</p><br><p class="center stamp">สร้างจาก CMS · ฉบับ ${v.id} · ${VSTATE[v.state][0]} · แบบฟอร์มอ้างอิง ${gapTag("G01", "แบบ มนพ.")}</p>`);

  // สารบัญ
  const toc = [["หมวดที่ 1", "ข้อมูลทั่วไป"], ["หมวดที่ 2", "ข้อมูลเฉพาะของหลักสูตรและผลลัพธ์การเรียนรู้ของหลักสูตร"], ["หมวดที่ 3", "ระบบการจัดการศึกษา การดำเนินการ และโครงสร้างของหลักสูตร"], ["หมวดที่ 4", "หลักเกณฑ์ในการประเมินผล" + stu], ["หมวดที่ 5", "การพัฒนาอาจารย์ และสิ่งสนับสนุนการเรียนรู้"], ["หมวดที่ 6", "การประกันคุณภาพหลักสูตร"], ["เอกสารแนบท้ายหลักสูตร", "อาจารย์ผู้รับผิดชอบหลักสูตร อาจารย์ประจำหลักสูตร อาจารย์พิเศษ"], ["เอกสารแนบ ก–ฉ", "ประวัติและผลงาน · หมวดศึกษาทั่วไป · ข้อบังคับ · ประกาศเกณฑ์ · MOU · คำสั่งแต่งตั้ง"]];
  h += pageA4(`<h1>สารบัญ</h1><table><tbody>${toc.map(([a, b]) => `<tr><td style="width:26%"><b>${a}</b></td><td>${b}</td></tr>`).join("")}</tbody></table>`);

  // หมวด 1
  h += pageA4(`<h1>หมวดที่ 1 ข้อมูลทั่วไป</h1>
    <h3>1. รหัสและชื่อหลักสูตร</h3><p>รหัส : ${p.checoCode ? esc(p.checoCode) : gapTag("G12", "รหัสหลักสูตร")}</p><p>ภาษาไทย : หลักสูตร${esc(p.degree)} สาขาวิชา${esc(p.name)}</p><p>ภาษาอังกฤษ : ${gapTag("G20", "ชื่อภาษาอังกฤษ")}</p>
    <h3>2. ชื่อปริญญาและสาขาวิชา</h3><p>ภาษาไทย (ชื่อเต็ม) : ${esc(p.degree)} (${esc(p.name)}) &nbsp; (ชื่อย่อ) : ${gapTag("G20")}</p><p>ภาษาอังกฤษ (ชื่อเต็ม/ชื่อย่อ) : ${gapTag("G20")}</p>
    <h3>3. วิชาเอก (ถ้ามี)</h3><p>${v.plans.length > 1 ? "แผนการศึกษา: " + esc(v.plans.map(x => x.plan).join(", ")) : "ไม่มี"}</p>
    <h3>4. จำนวนหน่วยกิตที่เรียนตลอดหลักสูตร</h3><p>ไม่น้อยกว่า ${v.credits} หน่วยกิต</p>
    <h3>5. รูปแบบของหลักสูตร</h3><p><b>5.1 ประเภทของหลักสูตร</b> ☑ หลักสูตรระดับ${esc(lv.th)}${p.level === "BACH" ? "ทางวิชาการ ☐ ทางวิชาชีพหรือปฏิบัติการ" : ""}</p><p><b>5.2 ภาษาที่ใช้</b> ☑ ภาษาไทย ☐ ภาษาอังกฤษ ☐ อื่น ๆ</p><p><b>5.3 การรับเข้าศึกษา</b> รับ${stu}ไทยและ${stu}ต่างชาติที่สามารถใช้ภาษาไทยได้เป็นอย่างดี</p><p><b>5.4 ความร่วมมือกับสถาบันอื่น</b> เป็นหลักสูตรของมหาวิทยาลัยโดยเฉพาะ</p><p><b>5.5 การบูรณาการหลักสูตร</b> ไม่มี</p><p><b>5.6 การให้ปริญญาแก่ผู้สำเร็จการศึกษา</b> ให้ปริญญาเพียงสาขาวิชาเดียว</p>
    <h3>6. สถานภาพของหลักสูตรและการพิจารณาอนุมัติ/เห็นชอบหลักสูตร</h3><p>6.1 ${kindTh} พ.ศ. ${v.year}${prevVer && v.kind !== "NEW" ? ` ปรับปรุงจากหลักสูตร${esc(p.degree)} สาขาวิชา${esc(p.name)} (หลักสูตร พ.ศ. ${prevVer.year})` : ""}</p><p>6.2 เริ่มใช้ในภาคการศึกษาที่ 1 ปีการศึกษา ${v.year} เป็นต้นไป</p>
    ${appr.length ? appr.map((a, i) => `<p>6.${i + 3} ${esc(a.body)} เห็นชอบหลักสูตรนี้ ในการประชุมครั้งที่ ${a.no ? esc(a.no) : "............"} เมื่อวันที่ ${a.date ? thDate(a.date, true) : "............................"}</p>`).join("") : `<p>6.3 ${gapTag("G11", "มติคณะ/สภาวิชาการ/สภา")}</p>`}
    <p>6.${appr.length + 3} องค์กรวิชาชีพรับรองหลักสูตร (ถ้ามี) ไม่มี</p>
    <h3>7. อาชีพที่สามารถประกอบได้หลังสำเร็จการศึกษา</h3><p>อาชีพหลัก: นัก${esc(p.name)} / ผู้ประกอบวิชาชีพด้าน${esc(p.name)} ${sampleTag()} ${gapTag("G21")}</p><p>อาชีพอื่น ๆ: ผู้ประกอบการ นักวิชาการในหน่วยงานภาครัฐและเอกชน</p>
    <h3>8. ข้อมูลอาจารย์ผู้รับผิดชอบหลักสูตร</h3><p class="small">(เรียงตามตำแหน่งทางวิชาการ คุณวุฒิ และพยัญชนะ · ปีที่สำเร็จการศึกษาเป็น ค.ศ.)</p>
    <table><thead><tr><th>ลำดับ</th><th>ชื่อ–สกุล</th><th>ตำแหน่งทางวิชาการ</th><th>คุณวุฒิ (สาขาวิชา)</th><th>สถาบันการศึกษา</th><th>ปีที่สำเร็จ</th></tr></thead><tbody>${resp.map((x, i) => `<tr><td class="n">${i + 1}</td><td>${esc(x.fn + " " + x.ln)}</td><td>${esc(POS_TH[x.pos])}</td><td>${eduCell(x)}</td><td>${instCell(x)}</td><td>${yearCell(x)}</td></tr>`).join("")}</tbody></table>
    <h3>9. จำนวนอาจารย์ประจำหลักสูตร</h3><p>1) จำนวนอาจารย์ประจำหลักสูตร ${resp.length + reg.length} คน (รวมอาจารย์ผู้รับผิดชอบหลักสูตร ${resp.length} คน) 2) รายละเอียดตามเอกสารแนบท้ายหลักสูตร</p>
    <h3>10. สถานที่จัดการเรียนการสอน และสถานที่ฝึกปฏิบัติงานภาคสนาม</h3><p>${esc(fac.name)} มหาวิทยาลัยนครพนม อำเภอเมือง จังหวัดนครพนม · สถานประกอบการที่ทำความร่วมมือ ${sampleTag()}</p>`);

  // หมวด 2
  const swot = { S: ["อาจารย์มีคุณวุฒิและประสบการณ์ตรงสาขา", "ที่ตั้งติดชายแดนไทย–ลาว–เวียดนาม"], W: ["ผลงานวิจัยตีพิมพ์ระดับนานาชาติยังน้อย", "ครุภัณฑ์บางส่วนล้าสมัย"], O: ["ความต้องการกำลังคนในเขตเศรษฐกิจพิเศษนครพนม", "นโยบายอุดมศึกษาเพื่อการพัฒนาพื้นที่"], T: ["จำนวนผู้เรียนวัยเรียนลดลง", "การแข่งขันกับหลักสูตรออนไลน์และสถาบันในเมืองใหญ่"] };
  const tows = { SO: "ใช้จุดแข็งด้านพื้นที่ชายแดนพัฒนารายวิชา/micro-credential ร่วมกับสถานประกอบการ", ST: "พัฒนาหลักสูตรรูปแบบยืดหยุ่น เรียนสะสมหน่วยกิต", WO: "ร่วมวิจัยกับเครือข่ายต่างประเทศเพื่อเพิ่มผลงานตีพิมพ์", WT: "วางแผนจัดหาครุภัณฑ์ร่วมกับคณะอื่นเพื่อลดต้นทุน" };
  const pl = o ? o.plos : [];
  h += pageA4(`<h1>หมวดที่ 2 ข้อมูลเฉพาะของหลักสูตรและผลลัพธ์การเรียนรู้ของหลักสูตร</h1>
    <h3>1. ปรัชญาของหลักสูตร</h3><p class="ind">ผลิตบัณฑิตสาขาวิชา${esc(p.name)}ที่มีความรู้คู่คุณธรรม เข้าใจบริบทอนุภูมิภาคลุ่มน้ำโขง และพัฒนาตนเองได้ตลอดชีวิต ${sampleTag()} ${gapTag("G21")}</p>
    <h3>2. แนวทางการจัดทำหลักสูตร</h3><p class="ind">ออกแบบหลักสูตรตามแนวคิดการศึกษาที่ยึดผลลัพธ์ (OBE) โดยรวบรวมความต้องการของผู้มีส่วนได้ส่วนเสีย กำหนด PLOs แล้วออกแบบรายวิชาและการวัดผลย้อนกลับ (backward design) สอดคล้องเกณฑ์ AUN-QA</p>
    <h3>3. เหตุผลความจำเป็นในการจัดทำหลักสูตร</h3><p class="ind">${sampleTag()} สอดคล้องแผนพัฒนาจังหวัดนครพนม ยุทธศาสตร์ อว. และผลการทบทวนหลักสูตรเดิม (มคอ.7)</p>
    <p><b>ตารางผลการวิเคราะห์ SWOT</b></p><table><tbody><tr><th style="width:50%">จุดแข็ง (S)</th><th>จุดอ่อน (W)</th></tr><tr><td>${swot.S.map(x => "• " + esc(x)).join("<br>")}</td><td>${swot.W.map(x => "• " + esc(x)).join("<br>")}</td></tr><tr><th>โอกาส (O)</th><th>อุปสรรค (T)</th></tr><tr><td>${swot.O.map(x => "• " + esc(x)).join("<br>")}</td><td>${swot.T.map(x => "• " + esc(x)).join("<br>")}</td></tr></tbody></table>
    <p><b>ตาราง TOWS Matrix</b></p><table><tbody><tr><th></th><th>S</th><th>W</th></tr><tr><th>O</th><td>${esc(tows.SO)}</td><td>${esc(tows.WO)}</td></tr><tr><th>T</th><td>${esc(tows.ST)}</td><td>${esc(tows.WT)}</td></tr></tbody></table>
    <h3>4. ข้อมูลผู้มีส่วนได้ส่วนเสียในการกำหนดหรือทบทวน PLOs</h3><p><b>4.1 การวิเคราะห์ผู้มีส่วนได้ส่วนเสียและความต้องการ</b></p>
    ${o ? `<table><thead><tr><th>ผู้มีส่วนได้ส่วนเสีย</th><th>ประเภท</th><th>วิธีการเก็บข้อมูล</th><th>จำนวน</th><th>ความต้องการ</th><th>ผลกลั่นกรอง</th></tr></thead><tbody>${o.vos.map(x => `<tr><td>${esc(x.group)}</td><td>${esc(x.kind)}</td><td>${esc(x.method)}</td><td class="n">${x.n}</td><td>${esc(x.need)}</td><td>${x.accepted ? "นำไปกำหนด PLO" : "ไม่นำมาใช้"}</td></tr>`).join("")}</tbody></table>` : gapTag("G18", "VOS")}
    <p><b>4.2 ขั้นตอน/วิธีการในการกลั่นกรองความต้องการ</b> คณะกรรมการพัฒนาหลักสูตรจัดกลุ่มความต้องการ ให้น้ำหนักตามความถี่และความสอดคล้องกับพันธกิจ แล้วยืนยันกับผู้ใช้บัณฑิต</p><p><b>4.3 การสื่อสารและเผยแพร่ข้อมูลหลักสูตรและ PLOs</b> เว็บไซต์คณะ คู่มือ${stu} การปฐมนิเทศ และ มคอ.3 ทุกรายวิชา</p>
    <h3>5. วัตถุประสงค์ของหลักสูตร</h3>${objectives.map((x, i) => `<p>${i + 1}) ${esc(x)} ${i === 0 ? sampleTag() : ""}</p>`).join("")}
    <h3>6. ผลลัพธ์การเรียนรู้ของหลักสูตร (PLOs)</h3>${pl.length ? `<table><thead><tr><th>PLOs</th><th>รายละเอียด</th><th>Specific/Generic</th><th>KSEC</th></tr></thead><tbody>${pl.map(x => `<tr><td>${x.code}</td><td>${esc(x.text)}${x.subs && x.subs.length ? "<br>" + x.subs.map(s => `<span style="font-size:13px">${s.code} ${esc(s.text)}</span>`).join("<br>") : ""}</td><td>${x.type}</td><td>${x.domain}</td></tr>`).join("")}</tbody></table>` : gapTag("G18", "PLO")}`);
  if (pl.length) {
    const cols = [...TAXO_COLS.K, ...TAXO_COLS.S, ...TAXO_COLS.E];
    h += pageA4(`<h3>7. ความสัมพันธ์ระหว่างวัตถุประสงค์ของหลักสูตรและ PLOs</h3><table><thead><tr><th>วัตถุประสงค์</th>${pl.map(x => `<th>${x.code}</th>`).join("")}</tr></thead><tbody>${objectives.map((ob, i) => `<tr><td>${i + 1}) ${esc(ob)}</td>${pl.map((x, j) => `<td class="center">${(i + j) % 3 !== 2 ? "✓" : ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <h3>8. ผลลัพธ์การเรียนรู้ที่คาดหวังรายชั้นปี (YLOs)</h3><table><thead><tr><th>ชั้นปี</th><th>YLO</th><th>PLO ที่เกี่ยวข้อง</th></tr></thead><tbody>${o.ylo.map(y => `<tr><td class="n">${y.year}</td><td>${esc(y.text)}</td><td>${y.plos.join(", ")}</td></tr>`).join("")}</tbody></table>
      <h3>9. PLOs จำแนกตาม Learning Taxonomy</h3><table style="font-size:12.5px"><thead><tr><th rowspan="2">PLOs</th><th colspan="6">Cognitive (Knowledge)</th><th colspan="5">Psychomotor (Skill)</th><th colspan="5">Affective (Attitude)</th></tr><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${pl.map(x => { const code = TAXO_MAP[x.level]; const grp = x.domain === "K" ? "K" : x.domain === "S" ? "S" : "E";
        return `<tr><td>${x.code}</td>${["K", "S", "E"].map(g => TAXO_COLS[g].map(c => `<td class="center">${g === grp && c === code ? "/" : ""}</td>`).join("")).join("")}</tr>`; }).join("")}</tbody></table>
      <p style="font-size:12.5px">R=Remembering U=Understanding AP=Applying AN=Analysing E=Evaluating C=Creating · I=Imitation M=Manipulation P=Precision A=Articulation N=Naturalization · Rc=Receiving Rp=Responding V=Valuing O=Organization C=Characterization ${gapTag("G19", "taxonomy มนพ.")}</p>`);
    h += pageA4(`<h3>10. แผนที่แสดงการกระจายความรับผิดชอบมาตรฐานผลลัพธ์การเรียนรู้จากหลักสูตรสู่รายวิชา (Curriculum Mapping)</h3><p style="font-size:13px">I = Introduce · R = Reinforce · M = Mastery ${gapTag("G19")}</p><table style="font-size:13px"><thead><tr><th>รายวิชา</th>${pl.map(x => `<th>${x.code}</th>`).join("")}</tr></thead><tbody>${Object.entries(o.mapping).map(([c, m]) => `<tr><td>${esc(c)} ${esc((IDX.course.get(c) || {}).th || "")}</td>${pl.map(x => `<td class="center">${m[x.code] || ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`, true);
    h += pageA4(`<h3>11. การกำหนดทักษะการเรียนรู้ตลอดชีวิตของหลักสูตร</h3><p><b>11.1 รายการทักษะ</b> 1) การเรียนรู้ด้วยตนเอง 2) การรู้เท่าทันดิจิทัล 3) การปรับตัวและแก้ปัญหา</p><table><thead><tr><th>ทักษะ</th><th>11.2 คำอธิบายเชิงพฤติกรรม</th><th>11.3 รายวิชา/กิจกรรม</th></tr></thead><tbody><tr><td>การเรียนรู้ด้วยตนเอง</td><td>ตั้งเป้าหมาย ค้นคว้า และประเมินการเรียนรู้ของตนได้</td><td>${esc(codes.slice(4, 6).join(", "))} · กิจกรรมโครงงาน</td></tr><tr><td>การรู้เท่าทันดิจิทัล</td><td>เลือกใช้และประเมินข้อมูลจากแหล่งดิจิทัลอย่างมีวิจารณญาณ</td><td>${esc(codes.slice(0, 2).join(", "))}</td></tr><tr><td>การปรับตัวและแก้ปัญหา</td><td>ปรับวิธีทำงานตามสถานการณ์ในสถานประกอบการ</td><td>ฝึกประสบการณ์วิชาชีพ/สหกิจศึกษา</td></tr></tbody></table>`);
  }

  // หมวด 3
  const years = [v.year, v.year + 1, v.year + 2, v.year + 3, v.year + 4]; const L = Math.max(1, v.years || 4); const n = st.plan || 40;
  const intakeTable = `<table><thead><tr><th>จำนวน${stu}</th>${years.map(y => `<th>${y}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: L }, (_, k) => `<tr><td>ชั้นปีที่ ${k + 1}</td>${years.map((y, i) => `<td class="n">${i >= k ? n : ""}</td>`).join("")}</tr>`).join("")}<tr><th>รวม</th>${years.map((y, i) => `<th class="n">${n * Math.min(i + 1, L)}</th>`).join("")}</tr><tr><th>คาดว่าจะสำเร็จการศึกษา</th>${years.map((y, i) => `<th class="n">${i + 1 >= L ? n : ""}</th>`).join("")}</tr></tbody></table>`;
  h += pageA4(`<h1>หมวดที่ 3 ระบบการจัดการศึกษา การดำเนินการ และโครงสร้างของหลักสูตร</h1>
    <h3>1. ระบบการจัดการศึกษา</h3><p><b>1.1 ระบบ</b> ระบบทวิภาค 1 ปีการศึกษาแบ่งเป็น 2 ภาคการศึกษาปกติ แต่ละภาคไม่น้อยกว่า 15 สัปดาห์ ตาม${esc(regOf(p, v))} · ลงทะเบียนภาคปกติไม่เกิน 22 หน่วยกิต ภาคฤดูร้อนไม่เกิน 9 หน่วยกิต</p><p><b>1.2 การจัดการศึกษาภาคฤดูร้อน</b> ${D.finance.levelProfiles.find(x => x.level === p.level) && D.finance.levelProfiles.find(x => x.level === p.level).summer ? "มี" : "ไม่มี (ขึ้นกับคณะ)"}</p>
    <h3>2. การดำเนินการหลักสูตร</h3><p><b>2.1 วัน–เวลา</b> ภาคการศึกษาที่ 1 มิถุนายน–ตุลาคม · ภาคการศึกษาที่ 2 พฤศจิกายน–มีนาคม · ${isGrad ? "วันเสาร์–อาทิตย์" : "วันจันทร์–ศุกร์ เวลา 08.00–16.30 น."}</p>
    <p><b>2.2 คุณสมบัติของผู้เข้าศึกษา</b> ${p.level === "BACH" ? "สำเร็จการศึกษามัธยมศึกษาตอนปลายหรือเทียบเท่า" : p.level === "HVOC" ? "สำเร็จ ปวช. หรือ ม.6" : p.level === "MASTER" ? "สำเร็จปริญญาตรีหรือเทียบเท่า" : "ตามประกาศรับสมัคร"} และตามประกาศการรับสมัครของมหาวิทยาลัย</p>
    <p><b>2.3 แผนการรับ${stu}และผู้สำเร็จการศึกษาในระยะ 5 ปี</b></p>${intakeTable}
    <p><b>2.4 งบประมาณ</b> ${be ? `ประมาณการรายรับ–รายจ่าย (จากการวิเคราะห์จุดคุ้มทุนใน CMS) · จุดคุ้มทุน ${fmt(be.beConcurrent)} คน (${fmt(be.beCohort)} คน/รุ่น)` : gapTag("G14", "การวิเคราะห์ต้นทุน")}</p>
    ${be ? `<table><thead><tr><th>ปีงบประมาณ</th><th>${stu}</th><th>รายรับ</th><th>จัดสรร 42%</th><th>รายจ่าย</th><th>ส่วนเกิน/(ขาด)</th></tr></thead><tbody>${be.proj.map(r => `<tr><td>${r.fy}</td><td class="n">${fmt(r.heads)}</td><td class="n">${baht(r.rev)}</td><td class="n">${baht(r.alloc)}</td><td class="n">${baht(r.vc + r.fc)}</td><td class="n">${r.profit < 0 ? "(" + baht(-r.profit) + ")" : baht(r.profit)}</td></tr>`).join("")}</tbody></table>` : ""}
    <p><b>2.5 ระบบการศึกษา</b> ☑ แบบชั้นเรียน ☑ แบบผสมผสาน (Hybrid) ☐ ทางไกล</p><p><b>2.6 การเทียบโอนหน่วยกิต รายวิชา และการลงทะเบียนเรียนข้ามมหาวิทยาลัย</b> ตาม${esc(regOf(p, v))} หมวด 6 การโอนและเทียบโอนผลการศึกษา (รายวิชาที่เทียบโอนต้องได้ไม่ต่ำกว่า 2.0) และระบบคลังหน่วยกิต</p>`);
  h += pageA4(`<h3>3. โครงสร้างของหลักสูตร</h3><p><b>3.1 จำนวนหน่วยกิตรวมตลอดหลักสูตร</b> ไม่น้อยกว่า ${v.credits} หน่วยกิต</p><p><b>3.2 โครงสร้างหลักสูตร</b></p>${s ? `<table><thead><tr><th>หมวดวิชา</th><th>หลักสูตรนี้</th></tr></thead><tbody>${treeRows(s)}</tbody></table>` : gapTag("G05", "โครงสร้างรายหมวด")}${s && s.source === "TEMPLATE" ? `<p style="font-size:12px;color:#8a5a00">[โครงสร้างร่างตาม${esc(s.basis)} — รอโครงสร้างจริงจากระบบทะเบียน G05]</p>` : ""}
    <p><b>3.3 ความสัมพันธ์กับหลักสูตรอื่นที่เปิดสอนในคณะ/หน่วยงานอื่น</b></p><p>3.3.1 รายวิชาที่${stu}ต้องเรียนจากหน่วยงานอื่น: หมวดวิชาศึกษาทั่วไป มหาวิทยาลัยนครพนม ไม่น้อยกว่า ${v.year >= 2565 ? 24 : 30} หน่วยกิต บริหารโดยคณะกรรมการบริหารจัดการหมวดวิชาศึกษาทั่วไป ${gapTag("G04", "กลุ่มวิชาและรายวิชา")}</p><p>3.3.2 รายวิชาที่หลักสูตรเปิดสอนให้หน่วยงานอื่น: ไม่มี</p>
    <p><b>3.4 รายวิชา</b></p>${s ? (function list(nd, d = 0) { let out = (nd.courses && nd.courses.length) || d === 0 ? "" : ""; out += `<p style="margin-left:${d * 14}px"><b>${esc(nd.title)}</b> ไม่น้อยกว่า ${nd.min} หน่วยกิต</p>`;
      if (nd.courses && nd.courses.length) out += `<table style="font-size:13.5px"><tbody>${nd.courses.map(c => { const x = IDX.course.get(c); return x ? `<tr><td style="width:15%">${esc(x.code)}</td><td>${esc(x.th)}<br><i>${esc(x.en)}</i></td><td class="n" style="width:14%">${esc(x.cr)}</td></tr>` : ""; }).join("")}</tbody></table>`;
      (nd.children || []).forEach(ch => { out += list(ch, d + 1); }); return out; })(s) : gapTag("G05")}`);
  h += pageA4(`<p><b>3.5 แผนการศึกษา</b></p>${plan.length ? plan.map(t => { const cr = t.courses.reduce((a, c) => a + ((IDX.course.get(c) || {}).c || 0), 0);
      return `<p><b>ปีที่ ${t.year} ภาคการศึกษาที่ ${t.term}</b></p><table style="font-size:13.5px"><tbody>${t.courses.map(c => { const x = IDX.course.get(c); return x ? `<tr><td style="width:15%">${esc(x.code)}</td><td>${esc(x.th)}</td><td class="n" style="width:14%">${esc(x.cr)}</td></tr>` : ""; }).join("")}<tr><th colspan="2" class="right">รวม</th><th class="n">${cr} หน่วยกิต</th></tr></tbody></table>`; }).join("") : gapTag("G05", "แผนการเรียน")}`);
  if (codes.length) h += pageA4(`<p><b>3.6 คำอธิบายรายวิชา</b> <span style="font-size:12px">(คำอธิบายจริงจากระบบทะเบียน)</span></p>${courseDescList(codes)}`);
  h += pageA4(`<h3>4. องค์ประกอบเกี่ยวกับประสบการณ์ภาคสนาม (การฝึกงานหรือสหกิจศึกษา)</h3><p><b>4.1 มาตรฐานผลการเรียนรู้</b> ${pl.length ? esc(pl.slice(1, 3).map(x => x.code).join(", ")) : ""} ประยุกต์ความรู้ในสถานประกอบการ ทำงานร่วมกับผู้อื่น และมีวินัยในการทำงาน</p><p><b>4.2 ช่วงเวลา</b> ภาคการศึกษาที่ 2 ของชั้นปีที่ ${L}</p><p><b>4.3 การจัดเวลาและตารางสอน</b> เต็มเวลาไม่น้อยกว่า 16 สัปดาห์</p>
    <h3>5. ข้อกำหนดเกี่ยวกับการทำโครงการหรืองานวิจัย</h3><p>5.1 คำอธิบายโดยย่อ: โครงงานที่แก้โจทย์จริงของชุมชน/ผู้ประกอบการ ${sampleTag()}</p><p>5.2 มาตรฐานผลการเรียนรู้: ${pl.length ? esc(pl[1].code) : "PLO"} 5.3 ช่วงเวลา: ชั้นปีที่ ${Math.max(1, L - 1)}–${L} 5.4 จำนวนหน่วยกิต: 3 หน่วยกิต</p><p>5.5 การเตรียมการ: แต่งตั้งอาจารย์ที่ปรึกษาโครงงาน ประชุมติดตามทุก 2 สัปดาห์</p><p>5.6 กระบวนการประเมินผล: ประเมินความก้าวหน้า รายงาน และการนำเสนอต่อคณะกรรมการด้วย rubric</p>`);

  // หมวด 4
  h += pageA4(`<h1>หมวดที่ 4 หลักเกณฑ์ในการประเมินผล${stu}</h1><h3>1. กฎระเบียบหรือหลักเกณฑ์ในการให้ระดับคะแนน (เกรด)</h3><p>เป็นไปตาม${esc(regOf(p, v))} หมวด 8 การวัดผลและประเมินผลการศึกษา วัดผลเป็นระดับคะแนน 8 ระดับ และสัญลักษณ์ S U AU I W · เข้าเรียนไม่น้อยกว่าร้อยละ 80 · คำนวณ GPA ทศนิยม 2 ตำแหน่ง ${["MASTER", "DOCTOR", "GRAD_DIP"].includes(p.level) ? settingPill("reg.grad.current") : ""}</p>
    <table><thead><tr><th>ระดับคะแนน</th><th>ช่วงคะแนน (ค่าตั้งต้น)</th><th>ความหมาย</th><th>ค่าระดับ</th></tr></thead><tbody>${gradeScale().map(g => `<tr><td class="center">${g[0]}</td><td class="center">${g[1]}</td><td>${g[2]}</td><td class="n">${g[3]}</td></tr>`).join("")}</tbody></table>
    <h3>2. การให้ข้อมูลป้อนกลับเพื่อพัฒนาการเรียนรู้ (Feedback)</h3><p class="ind">ผู้สอนแจ้งผลการประเมินระหว่างภาคภายใน 2 สัปดาห์ผ่าน LMS พร้อมข้อเสนอแนะรายบุคคล และเปิดช่วงให้คำปรึกษา (office hours)</p>
    <h3>3. เกณฑ์การสำเร็จการศึกษาตามหลักสูตร</h3>${["MASTER", "DOCTOR", "GRAD_DIP"].includes(p.level) ? `<p>1) เรียนครบตามโครงสร้างหลักสูตรไม่น้อยกว่า ${v.credits} หน่วยกิต 2) ได้ค่าระดับคะแนนเฉลี่ยสะสมไม่ต่ำกว่า ${esc((settingText("graduation.grad.min_gpa") || "3.00").split(" ")[0])} 3) ผ่านการสอบวิทยานิพนธ์/การค้นคว้าอิสระและการเผยแพร่ผลงานตามเกณฑ์มาตรฐานหลักสูตร 4) บรรลุผลลัพธ์การเรียนรู้ตามมาตรฐานคุณวุฒิ${settingPill("graduation.grad.min_gpa")} ${gapTag("G03", "ระเบียบบัณฑิตศึกษา 2560")}</p>` :
      `<p>ตาม${esc(regOf(p, v))} ข้อ 41: ${esc(settingText("graduation.bach.conditions"))} · ค่าระดับคะแนนเฉลี่ยสะสมไม่ต่ำกว่า ${esc(settingText("graduation.bach.min_gpa") || v.minGpa)} · หน่วยกิตรวมไม่น้อยกว่า ${v.credits} หน่วยกิต</p><p><b>ปริญญาเกียรตินิยม</b> อันดับหนึ่ง: ${esc(settingText("honors.first"))} · อันดับสอง: ${esc(settingText("honors.second"))}</p>`}
    <h3>4. การวัดการบรรลุ PLOs เมื่อเรียนครบตามโครงสร้างหลักสูตร</h3>${pl.length ? `<table><thead><tr><th>PLOs</th><th>พฤติกรรมบ่งชี้ (Performance Criteria)</th><th>วิธีการ/เครื่องมือ</th></tr></thead><tbody>${pl.map(x => `<tr><td>${x.code}: ${esc(x.text)}</td><td>${esc(x.criteria)}</td><td>${esc(x.tool)}</td></tr>`).join("")}</tbody></table>` : gapTag("G18")}`);
  // หมวด 5–6
  h += pageA4(`<h1>หมวดที่ 5 การพัฒนาอาจารย์ และสิ่งสนับสนุนการเรียนรู้</h1><h3>1. แผนการพัฒนาอาจารย์ใน 5 ปี</h3><table><thead><tr><th>ปี</th><th>กิจกรรม</th><th>เป้าหมาย</th></tr></thead><tbody>${years.map((y, i) => `<tr><td>${y}</td><td>${["อบรม OBE และการออกแบบการวัดผลตาม CLO", "พัฒนาทักษะ Active learning และสื่อดิจิทัล", "สนับสนุนการขอตำแหน่งทางวิชาการ", "ส่งเสริมการวิจัยร่วมกับเครือข่ายต่างประเทศ", "อบรม AUN-QA และการทวนสอบ"][i]}</td><td>อาจารย์ประจำหลักสูตรเข้าร่วม ≥ 80%</td></tr>`).join("")}</tbody></table>
    <h3>2. สิ่งสนับสนุนการเรียนรู้</h3><p><b>2.1</b> ห้องเรียนอัจฉริยะ ห้องปฏิบัติการคอมพิวเตอร์ ฐานข้อมูลออนไลน์ของสำนักวิทยบริการ ระบบ LMS ${sampleTag()}</p><p><b>2.2</b> สำรวจความพึงพอใจของ${stu}และอาจารย์ต่อสิ่งสนับสนุนทุกปี และเสนอแผนจัดหาผ่านคณะ</p>
    <h1 style="margin-top:22px">หมวดที่ 6 การประกันคุณภาพหลักสูตร</h1><h3>1. การประกันคุณภาพหลักสูตร</h3><p class="ind">ใช้เกณฑ์ AUN-QA 8 ด้าน: ผลลัพธ์การเรียนรู้ที่คาดหวัง · โครงสร้างและเนื้อหาหลักสูตร · แนวทางการจัดการเรียนการสอน · การวัดและประเมินผล · อาจารย์ · การสนับสนุนผู้เรียน · สิ่งสนับสนุนการเรียนรู้ · ผลลัพธ์ของหลักสูตร</p>
    <table><thead><tr><th>วัตถุประสงค์</th><th>กิจกรรม</th><th>ผู้รับผิดชอบ</th><th>ช่วงเวลา</th></tr></thead><tbody><tr><td>1. ประเมินผลลัพธ์การเรียนรู้ระดับหลักสูตร</td><td>วิเคราะห์ผลบรรลุ PLO จาก TQF + ผู้ใช้บัณฑิต</td><td>อาจารย์ผู้รับผิดชอบหลักสูตร</td><td>สิ้นปีการศึกษา</td></tr><tr><td>2. ประเมินผลลัพธ์การเรียนรู้ระดับรายวิชา</td><td>ทวนสอบ CLO ตาม มคอ.5</td><td>ผู้รับผิดชอบรายวิชา</td><td>สิ้นภาคการศึกษา</td></tr><tr><td>3. ทบทวนหลักสูตร</td><td>มคอ.7 และข้อเสนอปรับปรุง</td><td>กรรมการหลักสูตร</td><td>ทุกปี</td></tr><tr><td>4. รายงาน กมอ./QA</td><td>snapshot ตามรอบ ${gapTag("G24")}</td><td>คณะ</td><td>6/9/12 เดือน</td></tr></tbody></table>
    <h3>2. ระบบการจัดการข้อร้องเรียนและการอุทธรณ์</h3><p class="ind">รับเรื่องผ่านระบบออนไลน์ของคณะ ตอบกลับภายใน 7 วันทำการ บันทึกและรายงานกรรมการหลักสูตรทุกภาค ${sampleTag()}</p>`);
  // เอกสารแนบท้าย
  const all = [...resp.map(x => ({ x, r: "ผู้รับผิดชอบหลักสูตร" })), ...reg.map(x => ({ x, r: "อาจารย์ประจำหลักสูตร" }))];
  h += pageA4(`<h1>เอกสารแนบท้ายหลักสูตร</h1><h3>1. อาจารย์ผู้รับผิดชอบหลักสูตร และอาจารย์ประจำหลักสูตร</h3><table style="font-size:12.5px"><thead><tr><th rowspan="2">ที่</th><th rowspan="2">ชื่อ–สกุล<br>เลขประจำตัวประชาชน</th><th rowspan="2">ตำแหน่งทางวิชาการ</th><th rowspan="2">คุณวุฒิ (สาขาวิชา) สถาบัน ปีที่สำเร็จ</th><th colspan="5">ภาระงานสอน (ชม./สัปดาห์)</th></tr><tr>${years.map(y => `<th>${y}</th>`).join("")}</tr></thead><tbody>${all.map(({ x, r }, i) => `<tr><td class="n">${i + 1}</td><td>${esc(x.fn + " " + x.ln)}<br><span style="font-size:11px">(${esc(r)})</span><br><span style="font-size:11px">x-xxxx-xxxxx-xx-x</span></td><td>${esc(POS_TH[x.pos])}</td><td>${[...x.edu].reverse().map(e => `${esc(e.degree)}<br>${esc(e.inst)}, ${e.year}`).join("<br>")}</td>${years.map(() => `<td class="n">${9 + (i % 4) * 1.5}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <p style="font-size:12px">เลขประจำตัวประชาชน: CMS ไม่เก็บตามหลัก PDPA — นายทะเบียนหลักสูตรเติมในฉบับที่ส่ง สป.อว. · ข้อมูลอาจารย์ ${gapTag("G09", "ERP-HR จริง")}</p>
    <h3>2. อาจารย์พิเศษ (ถ้ามี)</h3><p>ไม่มี</p>`, true);
  h += pageA4(`<h1>เอกสารแนบ ก</h1><p class="center">ประวัติการศึกษาและผลงานทางวิชาการของอาจารย์ผู้รับผิดชอบหลักสูตรและอาจารย์ประจำหลักสูตร</p>${resp.map((x, i) => `<h3>${i + 1}. ${esc(POS_TH[x.pos])} ${esc(x.fn + " " + x.ln)}</h3><p><b>คุณวุฒิ</b> ${[...x.edu].reverse().map(e => `${esc(e.degree)} ${esc(e.inst)} (${e.year})`).join("; ")}</p><p><b>ผลงานทางวิชาการ (5 ปีย้อนหลัง)</b></p>${(IDX.pubsByStaff.get(x.id) || []).filter(p2 => p2.status === "CERTIFIED").map(p2 => `<p style="padding-left:2em;text-indent:-2em;font-size:14px">${esc(x.ln)}, ${esc(x.fn)}. (${p2.year}). ${esc(p2.title)}. <i>${esc(p2.venue)}</i>. ${p2.db !== "-" ? "[" + esc(p2.db) + "]" : ""}</p>`).join("") || "<p>—</p>"}`).join("")}<p style="font-size:12px">ผลงานเป็นข้อมูลจำลอง ${gapTag("G10")}</p>`);
  h += pageA4(`<h1>เอกสารแนบ ข–ฉ</h1><table><tbody><tr><th style="width:18%">ข</th><td>หมวดวิชาศึกษาทั่วไป มหาวิทยาลัยนครพนม (≥ ${v.year >= 2565 ? 24 : 30} หน่วยกิต) ${gapTag("G04", "เล่มฉบับล่าสุด")}</td></tr><tr><th>ค</th><td>ข้อบังคับมหาวิทยาลัยนครพนม ว่าด้วยการจัดการศึกษาระดับ${esc(lv.th)} ${gapTag("G03")}</td></tr><tr><th>ง</th><td>ประกาศกระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม เรื่อง เกณฑ์มาตรฐานหลักสูตรระดับ${esc(lv.th)} พ.ศ. 2565</td></tr><tr><th>จ</th><td>หลักฐานความร่วมมือกับสถาบันอื่น (MOU) — ไม่มี</td></tr><tr><th>ฉ</th><td>คำสั่งแต่งตั้งคณะกรรมการพัฒนาหลักสูตร (ลงนามโดยรองอธิการบดีฝ่ายวิชาการ) ${gapTag("G11", "เลขที่คำสั่ง")}</td></tr><tr><th>ช</th><td>ตารางวิเคราะห์ต้นทุนและจุดคุ้มทุน (DOC-FINANCE) · รายงานผลตรวจเกณฑ์ 2565 (DOC-STD2565)</td></tr></tbody></table>${sigBlock([resp[0] ? resp[0].fn + " " + resp[0].ln : "", "ประธานกรรมการพัฒนาหลักสูตร"], [headOf(p.fac), "คณบดี/ผู้อำนวยการ" + fac.name.replace(/^คณะ|^วิทยาลัย/, "")])}`);
  return { title: `มคอ.2 ${progTitle(p, true)} พ.ศ. ${v.year}`, html: h, file: `มคอ2-${p.code}-${v.year}` };
};

/* ===================================================================== มคอ.3 */
function orgText(key) { const x = IDX.setting.get("org." + key); return x && x.status !== "REQUIRED_INPUT" && x.value && !/^\(ว่าง/.test(x.value) ? x.value : ""; }
const ORG_LABEL = { philosophy: "ปรัชญา", education_philosophy: "ปรัชญาการศึกษา", vision: "วิสัยทัศน์", resolution: "ปณิธาน", uniqueness: "เอกลักษณ์", identity: "อัตลักษณ์", core_values: "ค่านิยมหลัก", missions: "พันธกิจ" };
function orgHeaderBlock() {
  const fields = ((IDX.setting.get("doc.tqf_header_fields") || {}).value || "philosophy,education_philosophy,vision").replace(/\(.*$/, "").split(",").map(x => x.trim()).filter(Boolean);
  const rows = fields.map(k => [ORG_LABEL[k] || k, orgText(k)]).filter(([, v]) => v);
  return rows.length ? `<table style="font-size:13.5px;margin:4px auto 10px;width:92%"><tbody>${rows.map(([k, v]) => `<tr><th style="width:22%;text-align:left">${esc(k)}มหาวิทยาลัยนครพนม</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : "";
}
function tqfHeader(code, title) {
  return `${docHead(code)}<h1>${title}</h1>${orgHeaderBlock()}<p class="center wm">เอกสารของโมดูล TQF ในแพลตฟอร์มบริการการศึกษา — CMS ส่งคำอธิบายรายวิชา PLO และ CLO ตั้งต้นให้ · ข้อความองค์กรจากค่าตั้งค่า org.*</p>`;
}
function tqfGeneral(t, c, p, upto) {
  const tea = t.teachers.map(staffName);
  const rows = [["1. รหัสและชื่อวิชา", `${esc(c.code)} ${esc(c.th)}<br>${esc(c.en)}`], ["2. จำนวนหน่วยกิต", `${esc(c.cr)} (บรรยาย-ปฏิบัติ-ศึกษาด้วยตนเอง)`], ["3. หลักสูตรและประเภทของรายวิชา", `${esc(progTitle(p))} · ${esc(courseGroupOf(p, c.code))}`],
    ["4. อาจารย์ผู้รับผิดชอบรายวิชาและอาจารย์ผู้สอน", `ผู้รับผิดชอบ: ${esc(staffName(t.coordinator))}<br>ผู้สอน: ${esc(tea.join(", "))} · ${t.sections} กลุ่มเรียน ${gapTag("G07", "ผู้สอนรายภาค")}`],
    ["5. ภาคการศึกษา/ชั้นปีที่เรียน", `ภาคการศึกษาที่ ${t.sem}/${t.year} · ชั้นปีที่ ${t.classYear}`], ["6. รายวิชาที่ต้องเรียนมาก่อน", `ไม่มี ${gapTag("G06")}`], ["7. รายวิชาที่ต้องเรียนควบคู่กัน", `ไม่มี ${gapTag("G06")}`], ["8. สถานที่เรียน", `${esc(t.room)} มหาวิทยาลัยนครพนม`]];
  if (upto === 9) rows.push(["9. วันที่จัดทำหรือปรับปรุงรายละเอียดของรายวิชาครั้งล่าสุด", thDate(t.updated, true)]);
  return `<h2>หมวดที่ 1 ข้อมูลทั่วไป</h2><table><tbody>${rows.map(([a, b]) => `<tr><th style="width:36%">${a}</th><td>${b}</td></tr>`).join("")}</tbody></table>`;
}
function courseGroupOf(p, code) {
  const s = structureOf(p); if (!s) return "—"; let found = "—";
  (function walk(n, path) { if ((n.courses || []).includes(code)) found = path.concat(n.title).slice(1).join(" › "); (n.children || []).forEach(ch => walk(ch, path.concat(n.title))); })(s, []);
  return found;
}
DOCS["DOC-TQF3"] = (code) => {
  const t = D.tqf[code]; const c = IDX.course.get(code); const p = IDX.prog.get(t.prog); const o = obeOf(p); const map = (o && o.mapping[code]) || {};
  const plos = o ? o.plos : []; const L = Number(c.l || 0), P = Number(c.p || 0), Sx = Number(c.s || 0);
  let h = pageA4(`${tqfHeader("DOC-TQF3", "แผนการจัดการเรียนการสอนของรายวิชา (มคอ.3)")}${tqfGeneral(t, c, p, 9)}
    <h2>หมวดที่ 2 ผลลัพธ์การเรียนรู้ระดับรายวิชา</h2><p><b>1. Curriculum mapping ตาม มคอ.2</b></p><table><thead><tr><th>รายวิชา</th>${plos.map(x => `<th>${x.code}</th>`).join("")}</tr></thead><tbody><tr><td>${esc(c.code)} ${esc(c.th)}</td>${plos.map(x => `<td class="center">${map[x.code] || ""}</td>`).join("")}</tr></tbody></table>
    <p><b>2. ผลลัพธ์การเรียนรู้ของหลักสูตรและผลลัพธ์การเรียนรู้ระดับรายวิชา</b></p><table><thead><tr><th style="width:45%">PLOs</th><th>CLOs</th></tr></thead><tbody>${[...new Set(t.clos.map(x => x.plo))].map(pc => { const pp = plos.find(x => x.code === pc) || { text: "" }; return `<tr><td>${pc} ${esc(pp.text)}</td><td>${t.clos.filter(x => x.plo === pc).map(x => `${x.code} ${esc(x.text)}`).join("<br>")}</td></tr>`; }).join("")}</tbody></table>`);
  h += pageA4(`<p><b>3. ผลลัพธ์การเรียนรู้ระดับรายวิชา วิธีการสอน และวิธีการวัดและประเมินผล</b></p><table><thead><tr><th>CLOs</th><th>วิธีการสอน</th><th>วิธีการวัดและประเมินผล</th></tr></thead><tbody>${t.clos.map(x => `<tr><td>${x.code} ${esc(x.text)}</td><td>${esc(x.teach)}</td><td>${esc(x.assess)}</td></tr>`).join("")}</tbody></table>
    <p><b>4. วัตถุประสงค์ในการพัฒนา/ปรับปรุงรายวิชา</b></p><p class="ind">${esc(t.objective)}</p>
    <h2>หมวดที่ 3 ลักษณะและการดำเนินการ</h2><p><b>1. คำอธิบายรายวิชา</b> <span style="font-size:12px">(จากระบบทะเบียน)</span></p><p class="ind">${esc(c.d || "—")}</p>
    <p><b>2. จำนวนชั่วโมงที่ใช้ต่อภาคการศึกษา</b></p><table><tbody><tr><th>บรรยาย</th><td class="n">${L * 15} ชั่วโมง</td></tr><tr><th>การฝึกปฏิบัติ/การฝึกงาน</th><td class="n">${P * 15} ชั่วโมง</td></tr><tr><th>การศึกษาด้วยตนเอง</th><td class="n">${Sx * 15} ชั่วโมง</td></tr></tbody></table>`);
  h += pageA4(`<h2>หมวดที่ 4 แผนการสอนและการประเมินผล</h2><p><b>1. แผนการสอน</b></p><table style="font-size:13.5px"><thead><tr><th>สัปดาห์ที่</th><th>หัวข้อ/รายละเอียด</th><th>ชม.</th><th>กิจกรรมการเรียนการสอน/สื่อ</th><th>CLO</th><th>ผู้สอน</th></tr></thead><tbody>${t.plan.map(w => `<tr><td class="center">${w.week}</td><td>${esc(w.topic)}</td><td class="n">${w.hours}</td><td>${esc(w.activity)}</td><td>${esc(w.clo)}</td><td>${esc(staffName(t.teachers[w.week % t.teachers.length]).replace(/^(ผศ\.|รศ\.|อ\.|ศ\.)(ดร\.)?/, "$1$2"))}</td></tr>`).join("")}</tbody></table><p style="font-size:13px">หมายเหตุ สัปดาห์แรกชี้แจงจุดมุ่งหมาย คำอธิบายรายวิชา CLOs วิธีสอนและวิธีวัดผลให้นักศึกษาทราบ</p>`);
  h += pageA4(`<p><b>2. แผนการประเมินผลการเรียนรู้</b></p><p>2.1 การวัดผล</p><table><thead><tr><th>CLOs</th><th>วิธีการประเมิน</th><th>สัปดาห์ที่ประเมิน</th><th>สัดส่วน</th></tr></thead><tbody>${t.clos.map(x => `<tr><td>${x.code} ${esc(x.text)}</td><td>${esc(x.assess)}</td><td>${esc(x.weeks)}</td><td class="n">${x.w}%</td></tr>`).join("")}<tr><th colspan="3" class="right">รวม</th><th class="n">${t.clos.reduce((a, x) => a + x.w, 0)}%</th></tr></tbody></table>
    <p>สรุปเกณฑ์การวัดและประเมินผล</p><table><tbody><tr><td>การสอบกลางภาค</td><td class="n">${t.summary.midterm}%</td></tr><tr><td>การสอบปลายภาค</td><td class="n">${t.summary.final}%</td></tr><tr><td>สอบย่อยในชั้นเรียน</td><td class="n">${t.summary.quiz}%</td></tr><tr><td>งานที่มอบหมาย</td><td class="n">${t.summary.assign}%</td></tr><tr><th>รวม</th><th class="n">100%</th></tr></tbody></table>
    <p>2.2 เกณฑ์การประเมินงานที่มอบหมาย</p><table><thead><tr><th>เนื้อหาที่ประเมิน</th><th>เกณฑ์การประเมิน (rubric)</th></tr></thead><tbody>${t.rubric.map(r => `<tr><td>${esc(r.content)}</td><td>${esc(r.criteria)}</td></tr>`).join("")}</tbody></table>
    <p>2.3 การประเมินผล (ระดับคะแนนตามระเบียบ ข้อ 38.3 · ช่วงคะแนนที่ผู้สอนกำหนด แจ้งนักศึกษาในวันแรกของภาค ข้อ 38.6)${settingPill("grade.score_ranges")}</p><table><thead><tr><th>ระดับคะแนน</th>${gradeScale().map(g => `<th>${g[0]}</th>`).join("")}</tr></thead><tbody><tr><td>ช่วงคะแนน</td>${gradeScale().map(g => `<td class="center">${g[1]}</td>`).join("")}</tr></tbody></table>
    <p>2.4 แนวทางการอุทธรณ์ผลการประเมิน</p><p class="ind">${(() => { const grad = ["MASTER", "DOCTOR", "GRAD_DIP"].includes(p.level); const a = settingText(grad ? "grade.appeal_grad" : "grade.appeal_bach"); return a ? esc(a) : `นักศึกษาขอดูรายละเอียดคะแนนจากผู้สอนได้ และยื่นอุทธรณ์ตามประกาศมหาวิทยาลัย/คณะ ${gapTag("G03", "ประกาศการอุทธรณ์ผลการเรียน")}`; })()} · ผู้สอนส่งผลภายใน 7 วันทำการหลังสอบ กรรมการประจำคณะเห็นชอบภายใน 20 วัน (ข้อ 38.10)</p>
    <h2>หมวดที่ 5 ทรัพยากรประกอบการเรียนการสอน</h2><p><b>1. ตำราและเอกสารที่ใช้ในการเรียนการสอน</b></p>${t.texts.map((x, i) => `<p>${i + 1}) ${esc(x)}</p>`).join("")}
    <h2>หมวดที่ 6 การทวนสอบรายวิชา</h2><p class="ind">ทวนสอบความสอดคล้องของ CLOs กับระดับใน curriculum mapping (${Object.entries(map).map(([k, v]) => k + "=" + v).join(", ") || "—"}) ทบทวนว่าการสอนเป็น Active learning วิธีวัดหลากหลาย เครื่องมือมีความตรงและความเที่ยง ใช้ rubric และตัดเกรดแบบอิงเกณฑ์ โดยคณะกรรมการทวนสอบของหลักสูตร</p>
    ${sigBlock([staffName(t.coordinator), "อาจารย์ผู้รับผิดชอบรายวิชา"], [staffName((progResponsible(p)[0] || {}).staff), "อาจารย์ผู้รับผิดชอบหลักสูตร (ตรวจสอบ)"])}`);
  return { title: `มคอ.3 ${c.code} ${c.th}`, html: h, file: `มคอ3-${c.code}-${t.sem}-${t.year}` };
};

/* ===================================================================== มคอ.5 */
DOCS["DOC-TQF5"] = (code) => {
  const t = D.tqf[code]; const c = IDX.course.get(code); const p = IDX.prog.get(t.prog);
  const tot = t.grades.reduce((a, g) => a + g.n, 0);
  let h = pageA4(`${tqfHeader("DOC-TQF5", "แบบสรุปการจัดการเรียนการสอนของรายวิชา (มคอ.5)")}${tqfGeneral(t, c, p, 8)}
    <h2>หมวดที่ 2 การจัดการเรียนการสอนที่เปรียบเทียบกับแผนการสอน</h2><p><b>1. รายงานชั่วโมงการสอนจริงเทียบกับแผนการสอน</b></p><table><thead><tr><th>หัวข้อ</th><th>ชม. ตามแผน</th><th>ชม. ที่สอนจริง</th><th>สาเหตุที่ต่างจากแผน</th><th>วิธีแก้ไข</th></tr></thead><tbody>${t.hoursDiff.map(x => `<tr><td>${esc(x.topic)}</td><td class="n">${x.plan}</td><td class="n">${x.actual}</td><td>${esc(x.reason)}</td><td>${esc(x.fix)}</td></tr>`).join("")}</tbody></table>
    <p><b>2. ประสิทธิผลของวิธีสอนและวิธีวัดผลที่ทำให้เกิดผลการเรียนรู้</b></p><table style="font-size:13px"><thead><tr><th rowspan="2">CLOs</th><th rowspan="2">วิธีการสอนที่ระบุใน มคอ.3</th><th colspan="2">ประสิทธิผล</th><th rowspan="2">วิธีวัดผลที่ระบุใน มคอ.3</th><th colspan="2">ประสิทธิผล</th><th rowspan="2">ปัญหา/ข้อเสนอแนะ</th></tr><tr><th>มี</th><th>ไม่มี</th><th>มี</th><th>ไม่มี</th></tr></thead><tbody>${t.clos.map((x, i) => { const e = t.teachEff[i]; return `<tr><td>${x.code}</td><td>${esc(x.teach)}</td><td class="center">${e.effective ? "✓" : ""}</td><td class="center">${e.effective ? "" : "✓"}</td><td>${esc(x.assess)}</td><td class="center">✓</td><td></td><td>${esc(e.problem)}</td></tr>`; }).join("")}</tbody></table>
    <p><b>3. ข้อเสนอการดำเนินการเพื่อปรับปรุงวิธีสอน</b></p><p class="ind">เพิ่มการประเมินโดยเพื่อน (peer assessment) ในกิจกรรมกลุ่ม และใช้กรณีศึกษาจากสถานประกอบการในพื้นที่</p>`);
  h += pageA4(`<h2>หมวดที่ 3 สรุปผลการจัดการเรียนการสอนของรายวิชา</h2><table><tbody><tr><th style="width:60%">1. จำนวนนักศึกษาที่ลงทะเบียนเรียน</th><td class="n">${t.enrolled} คน</td></tr><tr><th>2. จำนวนนักศึกษาที่คงอยู่เมื่อสิ้นสุดภาคการศึกษา</th><td class="n">${t.remain} คน</td></tr><tr><th>3. จำนวนนักศึกษาที่ถอน (W)</th><td class="n">${t.withdrawn} คน</td></tr></tbody></table>
    <p><b>4. การกระจายของระดับคะแนน (เกรด)</b> ${gapTag("G08", "เกรดจริงจากทะเบียน")}</p><table><thead><tr><th>ระดับคะแนน</th><th>ช่วงคะแนน</th><th>จำนวน (คน)</th><th>ร้อยละ</th></tr></thead><tbody>${t.grades.map(g => `<tr><td class="center">${g.g}</td><td class="center">${g.range}</td><td class="n">${g.n}</td><td class="n">${fmt(g.n * 100 / tot, 2)}</td></tr>`).join("")}<tr><th colspan="2">รวม</th><th class="n">${tot}</th><th class="n">100.00</th></tr></tbody></table>
    <p><b>5. ปัจจัยที่ทำให้ระดับคะแนนผิดปกติ</b> ไม่พบความผิดปกติ (สัดส่วน F ${fmt(t.grades[7].n * 100 / tot, 1)}%)</p>
    <p><b>6. ความคลาดเคลื่อนจากแผนการประเมินใน มคอ.3</b></p><table><thead><tr><th>ความคลาดเคลื่อน</th><th>เหตุผล</th></tr></thead><tbody>${t.assessDev.map(x => `<tr><td>${esc(x.what)}</td><td>${esc(x.why)}</td></tr>`).join("")}</tbody></table>
    <p><b>7. การประเมินผลสัมฤทธิ์ของนักศึกษาตาม CLOs</b></p><table><thead><tr><th>CLOs</th><th>สัดส่วนการประเมิน</th><th>เกณฑ์การบรรลุ</th><th>จำนวนที่บรรลุ (คน)</th><th>ร้อยละ</th></tr></thead><tbody>${t.cloAttain.map((x, i) => `<tr><td>${x.clo} ${esc(t.clos[i].text)}</td><td class="n">${x.w}%</td><td class="center">${esc(x.crit)}</td><td class="n">${x.n}</td><td class="n">${fmt(x.n * 100 / t.remain, 2)}</td></tr>`).join("")}<tr><th>รวม</th><th class="n">100%</th><th colspan="3"></th></tr></tbody></table>`);
  h += pageA4(`<h2>หมวดที่ 4 ปัญหาและผลกระทบต่อการดำเนินการ</h2><p><b>1. ประเด็นด้านทรัพยากรประกอบการเรียนการสอนและสิ่งอำนวยความสะดวก</b></p><table><thead><tr><th>ปัญหา</th><th>ผลกระทบต่อการเรียนรู้</th></tr></thead><tbody>${t.resourceIssues.map(x => `<tr><td>${esc(x.issue)}</td><td>${esc(x.impact)}</td></tr>`).join("")}</tbody></table>
    <h2>หมวดที่ 5 การประเมินรายวิชา</h2><p><b>1. ผลการประเมินรายวิชา</b> ${gapTag("G08", "ผลประเมินโดยนักศึกษา")}</p><table><thead><tr><th>ข้อวิพากษ์สำคัญจากผลการประเมิน</th><th>ความเห็นของอาจารย์ผู้สอน</th></tr></thead><tbody>${t.evalCritique.map(x => `<tr><td>${esc(x.critique)}</td><td>${esc(x.response)}</td></tr>`).join("")}</tbody></table>
    <h2>หมวดที่ 6 แผนการปรับปรุง</h2><p><b>1. ความก้าวหน้าของการปรับปรุงตามรายงานครั้งที่ผ่านมา</b></p><table><thead><tr><th>แผนที่เสนอครั้งก่อน</th><th>ผลการดำเนินการ</th></tr></thead><tbody>${t.prevPlan.map(x => `<tr><td>${esc(x.plan)}</td><td>${esc(x.result)}</td></tr>`).join("")}</tbody></table>
    <p><b>2. การดำเนินการด้านอื่น ๆ ในการปรับปรุงรายวิชา</b> ปรับเอกสารประกอบการสอนให้เป็นปัจจุบัน</p><p><b>3. ข้อเสนอแนะของอาจารย์ผู้รับผิดชอบรายวิชาต่ออาจารย์ผู้รับผิดชอบหลักสูตร</b> ${esc(t.toProgram)}</p>
    <p><b>4. ข้อเสนอแผนการปรับปรุงสำหรับภาคการศึกษาต่อไป</b></p><table><thead><tr><th>ข้อเสนอ</th><th>กำหนดเวลาแล้วเสร็จ</th><th>ผู้รับผิดชอบ</th></tr></thead><tbody>${t.nextPlan.map(x => `<tr><td>${esc(x.plan)}</td><td>${esc(x.due)}</td><td>${esc(x.owner)}</td></tr>`).join("")}</tbody></table>
    <table style="margin-top:28px"><tbody><tr><td style="width:50%">ชื่ออาจารย์ผู้รับผิดชอบรายวิชา ${esc(staffName(t.coordinator))}<br><br>ลงชื่อ ......................................................<br>วันที่รายงาน ........./........./.........</td><td>ชื่ออาจารย์ผู้รับผิดชอบหลักสูตร ${esc(staffName((progResponsible(p)[0] || {}).staff))}<br><br>ลงชื่อ ......................................................<br>วันที่ตรวจสอบ ........./........./.........</td></tr></tbody></table>`);
  return { title: `มคอ.5 ${c.code} ${c.th}`, html: h, file: `มคอ5-${c.code}-${t.sem}-${t.year}` };
};
