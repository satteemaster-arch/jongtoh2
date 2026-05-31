/* ============================================================
   app.js — ตัวควบคุมหลัก (ล็อกอิน, นำทาง, จอง, แอดมิน)
   ============================================================ */

// ---------- Utilities ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast " + type;
  setTimeout(() => t.classList.add("hidden"), 2600);
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  } catch (e) { return d; }
}

let currentBookingRestId = null;

// ============================================================
//  การนำทางระหว่างหน้า
// ============================================================
function showView(name) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  const view = $("#view-" + name);
  if (view) view.classList.remove("hidden");

  $$(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name)
  );

  // โหลดข้อมูลของแต่ละหน้า
  if (name === "booking") renderRestaurants();
  if (name === "myBookings") renderMyBookings();
  if (name === "admin") renderAdmin();
}

// ============================================================
//  ระบบล็อกอิน / สมัคร
// ============================================================
function initAuth() {
  // สลับแท็บ login/register
  $$(".tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      $("#loginForm").classList.toggle("hidden", !isLogin);
      $("#registerForm").classList.toggle("hidden", isLogin);
    })
  );

  // ล็อกอิน
  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#loginUser").value.trim();
    const p = $("#loginPass").value;
    const msg = $("#loginMsg");
    const user = DB.findUser(u);
    if (!user || user.password !== p) {
      msg.textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
      msg.className = "form-msg error";
      return;
    }
    DB.setSession({ username: user.username, role: user.role });
    msg.textContent = "";
    enterApp();
  });

  // สมัครสมาชิก
  $("#registerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#regUser").value.trim();
    const p = $("#regPass").value;
    const msg = $("#regMsg");
    if (DB.findUser(u)) {
      msg.textContent = "มีชื่อผู้ใช้นี้แล้ว";
      msg.className = "form-msg error";
      return;
    }
    DB.addUser({ username: u, password: p, role: "user" });
    msg.textContent = "สมัครสำเร็จ! กำลังเข้าสู่ระบบ...";
    msg.className = "form-msg success";
    setTimeout(() => {
      DB.setSession({ username: u, role: "user" });
      enterApp();
    }, 700);
  });

  // ออกจากระบบ
  $("#logoutBtn").addEventListener("click", () => {
    DB.clearSession();
    location.reload();
  });
}

// เข้าสู่แอป (หลังล็อกอิน)
function enterApp() {
  const s = DB.getSession();
  $("#view-login").classList.add("hidden");
  $("#navbar").classList.remove("hidden");
  $("#userBadge").textContent = `👤 ${s.username} (${s.role === "admin" ? "ผู้ดูแล" : "ลูกค้า"})`;

  // แสดงเมนูแอดมินเฉพาะ role admin
  $$(".admin-only").forEach((el) =>
    el.classList.toggle("hidden", s.role !== "admin")
  );

  showView("booking");
}

// ============================================================
//  หน้าจองโต๊ะ
// ============================================================
function renderRestaurants() {
  const grid = $("#restaurantGrid");
  const rests = DB.getRests();
  if (!rests.length) {
    grid.innerHTML = `<p class="empty">ยังไม่มีร้านอาหาร</p>`;
    return;
  }
  grid.innerHTML = rests.map((r) => {
    const isImg = /^https?:\/\//.test(r.img || "");
    const thumb = isImg
      ? `<img src="${r.img}" alt="${r.name}" />`
      : (r.img || "🍴");
    return `
      <div class="rest-card" data-id="${r.id}">
        <div class="rest-thumb">${thumb}</div>
        <div class="rest-body">
          <span class="rest-tag">${r.type || ""}</span>
          <h3>${r.name}</h3>
          <p>${r.desc || ""}</p>
          <button class="btn btn-primary btn-block btn-book" data-id="${r.id}">จองโต๊ะ</button>
        </div>
      </div>`;
  }).join("");

  $$(".btn-book").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openBooking(Number(btn.dataset.id));
    })
  );
}

function openBooking(restId) {
  const rest = DB.getRest(restId);
  if (!rest) return;
  currentBookingRestId = restId;
  const settings = DB.getSettings();

  $("#bkRestName").textContent = "จองโต๊ะ: " + rest.name;
  $("#bkTime").innerHTML = (settings.timeSlots || [])
    .map((t) => `<option value="${t}">${t} น.</option>`).join("");
  $("#bkZone").innerHTML = (rest.zones || ["ทั่วไป"])
    .map((z) => `<option value="${z}">${z}</option>`).join("");
  $("#bkGuests").max = settings.maxGuests || 20;
  $("#bkName").value = DB.getSession().username;

  // วันที่ขั้นต่ำ = วันนี้
  const today = new Date().toISOString().split("T")[0];
  $("#bkDate").min = today;
  $("#bkDate").value = today;

  $("#bookingMsg").textContent = "";
  $("#bookingModal").classList.remove("hidden");
}

function initBooking() {
  $("#closeBooking").addEventListener("click", () =>
    $("#bookingModal").classList.add("hidden")
  );
  $("#bookingModal").addEventListener("click", (e) => {
    if (e.target.id === "bookingModal") $("#bookingModal").classList.add("hidden");
  });

  $("#bookingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const settings = DB.getSettings();
    const date = $("#bkDate").value;
    const time = $("#bkTime").value;
    const zone = $("#bkZone").value;
    const guests = Number($("#bkGuests").value);
    const msg = $("#bookingMsg");

    if (guests > (settings.maxGuests || 20)) {
      msg.textContent = `จองได้สูงสุด ${settings.maxGuests} คนต่อครั้ง`;
      msg.className = "form-msg error";
      return;
    }
    if (DB.isSlotTaken(currentBookingRestId, date, time, zone)) {
      msg.textContent = "ช่วงเวลา/โซนนี้ถูกจองแล้ว กรุณาเลือกใหม่";
      msg.className = "form-msg error";
      return;
    }

    const rest = DB.getRest(currentBookingRestId);
    DB.addBooking({
      restId: currentBookingRestId,
      restName: rest.name,
      user: DB.getSession().username,
      date, time, zone, guests,
      name: $("#bkName").value.trim(),
      phone: $("#bkPhone").value.trim(),
    });

    $("#bookingModal").classList.add("hidden");
    $("#bookingForm").reset();
    toast("จองโต๊ะสำเร็จ! 🎉", "success");
    showView("myBookings");
  });
}

// ============================================================
//  หน้าการจองของฉัน
// ============================================================
function renderMyBookings() {
  const list = $("#myBookingsList");
  const bookings = DB.getUserBookings(DB.getSession().username)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!bookings.length) {
    list.innerHTML = `<p class="empty">คุณยังไม่มีการจอง</p>`;
    return;
  }
  list.innerHTML = bookings.map((b) => bookingCard(b, true)).join("");
  bindCancelButtons(list, () => renderMyBookings());
}

function bookingCard(b, showCancel) {
  return `
    <div class="booking-item">
      <div class="b-main">
        <h4>${b.restName}</h4>
        <div class="b-detail">
          <span>📅 ${fmtDate(b.date)}</span>
          <span>⏰ ${b.time} น.</span>
          <span>📍 ${b.zone}</span>
          <span>👥 ${b.guests} คน</span>
        </div>
        <div class="b-detail" style="margin-top:6px">
          <span>ผู้จอง: ${b.name}</span>
          <span>โทร: ${b.phone}</span>
        </div>
      </div>
      ${showCancel ? `<button class="btn btn-danger btn-sm btn-cancel" data-id="${b.id}">ยกเลิก</button>` : ""}
    </div>`;
}

function bindCancelButtons(scope, after) {
  scope.querySelectorAll(".btn-cancel").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("ยืนยันยกเลิกการจองนี้?")) {
        DB.deleteBooking(Number(btn.dataset.id));
        toast("ยกเลิกการจองแล้ว");
        after();
      }
    })
  );
}

// ============================================================
//  หน้าแอดมิน
// ============================================================
function initAdminTabs() {
  $$(".atab").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".atab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $$(".apanel").forEach((p) => p.classList.add("hidden"));
      $("#apanel-" + tab.dataset.atab).classList.remove("hidden");
    })
  );
}

function renderAdmin() {
  renderAdminRests();
  renderSettings();
  renderAdminBookings();
}

// ----- จัดการร้าน -----
function renderAdminRests() {
  const box = $("#adminRestList");
  const rests = DB.getRests();
  if (!rests.length) {
    box.innerHTML = `<p class="empty">ยังไม่มีร้านอาหาร</p>`;
    return;
  }
  box.innerHTML = rests.map((r) => {
    const isImg = /^https?:\/\//.test(r.img || "");
    const icon = isImg ? "🖼️" : (r.img || "🍴");
    return `
      <div class="admin-rest-row">
        <div class="emoji">${icon}</div>
        <div class="info">
          <b>${r.name}</b> <small>(${r.type || "-"})</small><br/>
          <small>${r.desc || ""}</small><br/>
          <small>โซน: ${(r.zones || []).join(", ") || "-"}</small>
        </div>
        <button class="btn btn-danger btn-sm btn-del-rest" data-id="${r.id}">ลบ</button>
      </div>`;
  }).join("");

  box.querySelectorAll(".btn-del-rest").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("ลบร้านนี้?")) {
        DB.deleteRest(Number(btn.dataset.id));
        toast("ลบร้านแล้ว");
        renderAdminRests();
      }
    })
  );
}

function initAddRest() {
  $("#addRestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const zones = $("#rZones").value.split(",").map((z) => z.trim()).filter(Boolean);
    DB.addRest({
      name: $("#rName").value.trim(),
      type: $("#rType").value.trim(),
      img: $("#rImg").value.trim() || "🍴",
      desc: $("#rDesc").value.trim(),
      zones: zones.length ? zones : ["ทั่วไป"],
    });
    e.target.reset();
    toast("เพิ่มร้านสำเร็จ", "success");
    renderAdminRests();
  });
}

// ----- ตั้งค่าระบบ -----
function renderSettings() {
  const s = DB.getSettings();
  $("#setSiteName").value = s.siteName || "";
  $("#setMaxGuests").value = s.maxGuests || 20;

  const chips = $("#timeChips");
  chips.innerHTML = (s.timeSlots || []).map((t) =>
    `<span class="chip">${t} น.<button data-time="${t}">✕</button></span>`
  ).join("");
  chips.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      const st = DB.getSettings();
      st.timeSlots = st.timeSlots.filter((x) => x !== btn.dataset.time);
      DB.setSettings(st);
      renderSettings();
    })
  );
}

function initSettings() {
  $("#addTimeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("#newTime").value;
    if (!t) return;
    const s = DB.getSettings();
    s.timeSlots = s.timeSlots || [];
    if (!s.timeSlots.includes(t)) {
      s.timeSlots.push(t);
      s.timeSlots.sort();
      DB.setSettings(s);
      renderSettings();
      toast("เพิ่มช่วงเวลาแล้ว", "success");
    }
    e.target.reset();
  });

  $("#generalSettings").addEventListener("submit", (e) => {
    e.preventDefault();
    const s = DB.getSettings();
    s.siteName = $("#setSiteName").value.trim();
    s.maxGuests = Number($("#setMaxGuests").value) || 20;
    DB.setSettings(s);
    toast("บันทึกการตั้งค่าแล้ว", "success");
  });
}

// ----- รายการจองทั้งหมด -----
function renderAdminBookings() {
  const box = $("#adminBookingsList");
  const bookings = DB.getBookings()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!bookings.length) {
    box.innerHTML = `<p class="empty">ยังไม่มีการจอง</p>`;
    return;
  }
  box.innerHTML = bookings.map((b) => `
    <div class="booking-item">
      <div class="b-main">
        <h4>${b.restName} <small style="color:var(--muted)">— โดย ${b.user}</small></h4>
        <div class="b-detail">
          <span>📅 ${fmtDate(b.date)}</span>
          <span>⏰ ${b.time} น.</span>
          <span>📍 ${b.zone}</span>
          <span>👥 ${b.guests} คน</span>
        </div>
        <div class="b-detail" style="margin-top:6px">
          <span>ผู้จอง: ${b.name}</span>
          <span>โทร: ${b.phone}</span>
        </div>
      </div>
      <button class="btn btn-danger btn-sm btn-cancel" data-id="${b.id}">ลบ</button>
    </div>`).join("");
  bindCancelButtons(box, () => renderAdminBookings());
}

// ============================================================
//  เริ่มต้นแอป
// ============================================================
function init() {
  initAuth();
  initBooking();
  initAdminTabs();
  initAddRest();
  initSettings();

  $$(".nav-btn").forEach((b) =>
    b.addEventListener("click", () => showView(b.dataset.view))
  );

  // ถ้ามี session อยู่แล้ว ให้เข้าแอปเลย
  if (DB.getSession()) enterApp();
}

document.addEventListener("DOMContentLoaded", init);
