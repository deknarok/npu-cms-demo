/* main.js — เริ่มต้นต้นแบบ */
"use strict";
(async function start() {
  try {
    await loadAll();
    document.getElementById("app").removeAttribute("data-loading");
    window.addEventListener("hashchange", render);
    render();
  } catch (e) {
    console.error(e);
    document.getElementById("view").innerHTML = `<div class="note bad"><strong>โหลดข้อมูลต้นแบบไม่สำเร็จ</strong><br>${esc(e.message)}<br>ถ้าเปิดไฟล์โดยตรงจากเครื่อง ให้รันเว็บเซิร์ฟเวอร์: <span class="mono">cd prototype && python3 -m http.server 8000</span></div>`;
  }
})();
