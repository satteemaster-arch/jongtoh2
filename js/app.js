/* app.js — ตัวควบคุมหลัก เชื่อม API แทน localStorage */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('hidden'), 2600);
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString('th-TH', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}

let currentBookingRestId = null;
let currentBookingRests  = [];
let selectedTable        = null;

// ============================================================
//  Restaurant images — map cuisine/keywords to real photos
// ============================================================
const U = (id) => `https://images.unsplash.com/photo-${id}?w=600&h=400&fit=crop&q=80`;
const FOOD_IMAGES = [
  { kw: ['ไทย', 'thai'],                  url: U('1504674900247-0877df9cc836') },
  { kw: ['ญี่ปุ่น', 'ซูชิ', 'japan', 'sushi'], url: U('1579871494447-9811cf80d66c') },
  { kw: ['อิตา', 'พาสต้า', 'italian', 'pasta'], url: U('1551183053-bf91a1d81141') },
  { kw: ['พิซซ่า', 'pizza'],              url: U('1513104890138-7c749659a591') },
  { kw: ['เบอร์เกอร์', 'burger', 'ฟาสต์'], url: U('1568901346375-23c9450c58cd') },
  { kw: ['สเต็ก', 'steak', 'เนื้อ'],       url: U('1546964124-0cce460f38ef') },
  { kw: ['ทะเล', 'seafood'],              url: U('1559737558-2f5a35f4523b') },
  { kw: ['เกาหลี', 'korea', 'bbq', 'ปิ้งย่าง'], url: U('1498654896293-37aacf113fd9') },
  { kw: ['จีน', 'china', 'chinese', 'ติ่มซำ'], url: U('1525755662778-989d0524087e') },
  { kw: ['กาแฟ', 'คาเฟ่', 'cafe', 'coffee'], url: U('1495474472287-4d71bcdd2085') },
  { kw: ['ขนม', 'หวาน', 'เบเกอรี', 'dessert', 'bakery'], url: U('1551024601-bec78aea704b') },
];
const DEFAULT_FOOD_IMAGE = U('1517248135467-4c7edcad34c4');

function restaurantImage(r) {
  if (/^https?:\/\//.test(r.img || '')) return r.img;          // already a real URL
  const hay = `${r.type || ''} ${r.name || ''}`.toLowerCase();
  const hit = FOOD_IMAGES.find((m) => m.kw.some((k) => hay.includes(k)));
  return hit ? hit.url : DEFAULT_FOOD_IMAGE;
}

// ============================================================
//  Navigation
// ============================================================
function showView(name) {
  $$('.view').forEach((v) => v.classList.add('hidden'));
  const view = $('#view-' + name);
  if (view) view.classList.remove('hidden');

  $$('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === name)
  );

  if (name === 'booking')     renderRestaurants();
  if (name === 'myBookings')  renderMyBookings();
  if (name === 'admin')       renderAdmin();
}

// ============================================================
//  Auth
// ============================================================
function initAuth() {
  $$('.tab').forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      $('#loginForm').classList.toggle('hidden', !isLogin);
      $('#registerForm').classList.toggle('hidden', isLogin);
    })
  );

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = $('#loginUser').value.trim();
    const p = $('#loginPass').value;
    const msg = $('#loginMsg');
    try {
      const { token, user } = await API.login(u, p);
      Auth.save(token, user);
      msg.textContent = '';
      enterApp();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });

  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = $('#regUser').value.trim();
    const p = $('#regPass').value;
    const msg = $('#regMsg');
    try {
      const { token, user } = await API.register(u, p);
      msg.textContent = 'สมัครสำเร็จ! กำลังเข้าสู่ระบบ...';
      msg.className = 'form-msg success';
      setTimeout(() => { Auth.save(token, user); enterApp(); }, 700);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    Auth.clear();
    location.reload();
  });
}

function enterApp() {
  const user = Auth.getUser();
  $('#view-login').classList.add('hidden');
  $('#navbar').classList.remove('hidden');
  $('#userBadge').textContent = `👤 ${user.username} (${user.role === 'admin' ? 'ผู้ดูแล' : 'ลูกค้า'})`;
  $$('.admin-only').forEach((el) => el.classList.toggle('hidden', user.role !== 'admin'));
  showView('booking');
}

// ============================================================
//  หน้าจองโต๊ะ
// ============================================================
async function renderRestaurants() {
  const grid = $('#restaurantGrid');
  grid.innerHTML = '<p class="empty">กำลังโหลด...</p>';
  try {
    const rests = await API.getRestaurants();
    const countEl = $('#restCount');
    if (!rests.length) {
      if (countEl) countEl.textContent = '';
      grid.innerHTML = '<p class="empty">ยังไม่มีร้านอาหาร</p>'; return;
    }
    if (countEl) countEl.textContent = `${rests.length} ร้าน`;
    grid.innerHTML = rests.map((r) => {
      const emoji = /^https?:\/\//.test(r.img || '') ? '🍴' : (r.img || '🍴');
      const imgUrl = restaurantImage(r);
      const thumb = `<span class="thumb-emoji">${emoji}</span>
                     <img src="${imgUrl}" alt="${r.name}" loading="lazy" onerror="this.remove()" />`;
      const zones = r.zones || [];
      const seats = zones.reduce((sum, z) => sum + (z.capacity || 0), 0);
      const zoneChips = zones.slice(0, 3)
        .map((z) => `<span class="zone-chip">${z.name}</span>`).join('');
      const meta = zones.length
        ? `<div class="rest-meta">
             <span class="rest-meta-item">🪑 ${zones.length} โซน</span>
             <span class="rest-meta-item">👥 รองรับ ${seats} ที่นั่ง</span>
           </div>
           <div class="rest-zones">${zoneChips}</div>`
        : '';
      return `
        <div class="rest-card" data-id="${r.id}">
          <div class="rest-thumb">${thumb}</div>
          <div class="rest-body">
            <span class="rest-tag">${r.type || ''}</span>
            <h3>${r.name}</h3>
            <p>${r.description || ''}</p>
            ${meta}
            <button class="btn btn-primary btn-block btn-book" data-id="${r.id}">จองโต๊ะ →</button>
          </div>
        </div>`;
    }).join('');
    $$('.btn-book').forEach((btn) =>
      btn.addEventListener('click', (e) => { e.stopPropagation(); openBooking(Number(btn.dataset.id), rests); })
    );
  } catch {
    grid.innerHTML = '<p class="empty">โหลดข้อมูลไม่สำเร็จ</p>';
  }
}

function gotoStep(n) {
  $$('.bk-step').forEach((s) => s.classList.add('hidden'));
  $('#bk-step' + n).classList.remove('hidden');
  [1, 2, 3].forEach((i) => {
    const node = $('#sn' + i);
    if (!node) return;
    node.classList.toggle('active',    i === n);
    node.classList.toggle('completed', i < n);
  });
}

async function openBooking(restId, rests) {
  const rest = rests.find((r) => r.id === restId);
  if (!rest) return;
  currentBookingRestId = restId;
  currentBookingRests  = rests;
  selectedTable        = null;

  const settings = await API.getSettings();
  $('#bkRestName').textContent = 'จองโต๊ะ — ' + rest.name;
  $('#bkTime').innerHTML = (settings.timeSlots || []).map((t) => `<option value="${t}">${t} น.</option>`).join('');

  const today = new Date().toISOString().split('T')[0];
  $('#bkDate').min = today;
  $('#bkDate').value = today;

  $('#bookingMsg').textContent = '';
  gotoStep(1);
  $('#bookingModal').classList.remove('hidden');
}

async function loadFloorPlan() {
  const date     = $('#bkDate').value;
  const timeSlot = $('#bkTime').value;
  const plan     = $('#floorPlan');

  $('#bk-step2-info').textContent = `📅 ${fmtDate(date)}  ·  ⏰ ${timeSlot} น.`;
  plan.innerHTML = '<p class="empty">กำลังโหลดผังโต๊ะ...</p>';
  gotoStep(2);

  try {
    const tables = await API.getTableAvailability(currentBookingRestId, date, timeSlot);
    if (!tables.length) {
      plan.innerHTML = '<p class="empty">ร้านนี้ยังไม่มีผังโต๊ะ</p>';
      return;
    }

    // จัดกลุ่มตาม zone_name
    const byZone = {};
    tables.forEach((t) => {
      if (!byZone[t.zone_name]) byZone[t.zone_name] = [];
      byZone[t.zone_name].push(t);
    });

    plan.innerHTML = Object.entries(byZone).map(([zone, ts]) => {
      const avail = ts.filter((t) => !t.is_booked).length;
      const sorted = [...ts].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
      return `
        <div class="fp-zone">
          <div class="fp-zone-header">
            <span class="fp-zone-name">${zone}</span>
            <span class="fp-zone-avail ${avail === 0 ? 'full' : ''}">
              ${avail === 0 ? 'เต็มทุกโต๊ะ' : `ว่าง ${avail} / ${ts.length} โต๊ะ`}
            </span>
          </div>
          <div class="fp-tables">
            ${sorted.map((t) => `
              <div class="fp-table ${t.is_booked ? 'taken' : 'available'}"
                   data-id="${t.id}" data-seats="${t.seats}"
                   data-label="${t.label}" data-zone="${t.zone_name}">
                <span class="fp-icon">${t.is_booked ? '🚫' : '🪑'}</span>
                <span class="fp-label">โต๊ะ ${t.label}</span>
                <span class="fp-cap">${t.is_booked ? 'จองแล้ว' : t.seats + ' ที่นั่ง'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    plan.querySelectorAll('.fp-table.available').forEach((el) =>
      el.addEventListener('click', () => selectTable(el))
    );
  } catch {
    plan.innerHTML = '<p class="empty">โหลดผังโต๊ะไม่สำเร็จ</p>';
  }
}

function selectTable(el) {
  $('#floorPlan').querySelectorAll('.fp-table.selected').forEach((s) => s.classList.remove('selected'));
  el.classList.add('selected');

  selectedTable = {
    id:    Number(el.dataset.id),
    label: el.dataset.label,
    zone:  el.dataset.zone,
    seats: Number(el.dataset.seats),
  };

  $('#selectedTableInfo').innerHTML = `
    <div class="selected-badge">
      🪑 โต๊ะ <b>${selectedTable.label}</b> &nbsp;·&nbsp; ${selectedTable.zone}
      <span class="muted">&nbsp;(รองรับ ${selectedTable.seats} ที่นั่ง)</span>
    </div>
  `;
  $('#bkGuests').max   = selectedTable.seats;
  $('#bkGuests').value = Math.min(2, selectedTable.seats);
  $('#bkName').value   = Auth.getUser().username;
  $('#bookingMsg').textContent = '';
  gotoStep(3);
}

function initBooking() {
  $('#closeBooking').addEventListener('click', () => $('#bookingModal').classList.add('hidden'));
  $('#bookingModal').addEventListener('click', (e) => {
    if (e.target.id === 'bookingModal') $('#bookingModal').classList.add('hidden');
  });

  $('#dateTimeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadFloorPlan();
  });

  $('#backToStep1').addEventListener('click', () => gotoStep(1));
  $('#backToStep2').addEventListener('click', () => gotoStep(2));

  $('#bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#bookingMsg');
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await API.createBooking({
        restaurant_id: currentBookingRestId,
        table_id:      selectedTable ? selectedTable.id : null,
        zone:          selectedTable ? selectedTable.zone : null,
        date:          $('#bkDate').value,
        time_slot:     $('#bkTime').value,
        guests:        Number($('#bkGuests').value),
        booker_name:   $('#bkName').value.trim(),
        phone:         $('#bkPhone').value.trim(),
      });
      $('#bookingModal').classList.add('hidden');
      toast('จองโต๊ะสำเร็จ! 🎉', 'success');
      showView('myBookings');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    } finally {
      btn.disabled = false;
    }
  });
}

// ============================================================
//  หน้าการจองของฉัน
// ============================================================
async function renderMyBookings() {
  const list = $('#myBookingsList');
  list.innerHTML = '<p class="empty">กำลังโหลด...</p>';
  try {
    const bookings = await API.getMyBookings();
    if (!bookings.length) { list.innerHTML = '<p class="empty">คุณยังไม่มีการจอง</p>'; return; }
    list.innerHTML = bookings.map((b) => bookingCard(b, true)).join('');
    bindCancelButtons(list, () => renderMyBookings());
  } catch {
    list.innerHTML = '<p class="empty">โหลดข้อมูลไม่สำเร็จ</p>';
  }
}

function bookingCard(b, showCancel) {
  return `
    <div class="booking-item">
      <div class="b-main">
        <h4>${b.restaurant_name || b.restName}</h4>
        <div class="b-detail">
          <span>📅 ${fmtDate(b.date)}</span>
          <span>⏰ ${b.time_slot || b.time} น.</span>
          <span>📍 ${b.zone}</span>
          <span>👥 ${b.guests} คน</span>
        </div>
        <div class="b-detail" style="margin-top:6px">
          <span>ผู้จอง: ${b.booker_name || b.name}</span>
          <span>โทร: ${b.phone}</span>
        </div>
      </div>
      ${showCancel ? `<button class="btn btn-danger btn-sm btn-cancel" data-id="${b.id}">ยกเลิก</button>` : ''}
    </div>`;
}

function bindCancelButtons(scope, after) {
  scope.querySelectorAll('.btn-cancel').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('ยืนยันยกเลิกการจองนี้?')) return;
      try {
        await API.cancelBooking(Number(btn.dataset.id));
        toast('ยกเลิกการจองแล้ว');
        after();
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
}

// ============================================================
//  หน้าแอดมิน
// ============================================================
function initAdminTabs() {
  $$('.atab').forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.atab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.apanel').forEach((p) => p.classList.add('hidden'));
      $('#apanel-' + tab.dataset.atab).classList.remove('hidden');
    })
  );
}

async function renderAdmin() {
  renderAdminRests();
  renderSettings();
  renderAdminBookings();
}

async function renderAdminRests() {
  const box = $('#adminRestList');
  try {
    const rests = await API.getRestaurants();
    if (!rests.length) { box.innerHTML = '<p class="empty">ยังไม่มีร้านอาหาร</p>'; return; }
    box.innerHTML = rests.map((r) => {
      const isImg = /^https?:\/\//.test(r.img || '');
      const icon = isImg ? '🖼️' : (r.img || '🍴');
      return `
        <div class="admin-rest-row">
          <div class="emoji">${icon}</div>
          <div class="info">
            <b>${r.name}</b> <small>(${r.type || '-'})</small><br/>
            <small>${r.description || ''}</small><br/>
            <small>โซน: ${(r.zones || []).map((z) => `${z.name || z} (${z.capacity || 20} คน)`).join(', ') || '-'}</small>
          </div>
          <button class="btn btn-danger btn-sm btn-del-rest" data-id="${r.id}">ลบ</button>
        </div>`;
    }).join('');

    box.querySelectorAll('.btn-del-rest').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!confirm('ลบร้านนี้?')) return;
        try {
          await API.deleteRestaurant(Number(btn.dataset.id));
          toast('ลบร้านแล้ว');
          renderAdminRests();
        } catch (err) {
          toast(err.message, 'error');
        }
      })
    );
  } catch {
    box.innerHTML = '<p class="empty">โหลดข้อมูลไม่สำเร็จ</p>';
  }
}

function initAddRest() {
  $('#addRestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const zones = $('#rZones').value.split(',').map((z) => z.trim()).filter(Boolean);
    try {
      await API.addRestaurant({
        name:        $('#rName').value.trim(),
        type:        $('#rType').value.trim(),
        img:         $('#rImg').value.trim() || '🍴',
        description: $('#rDesc').value.trim(),
        zones:       zones.length ? zones : ['ทั่วไป'],
      });
      e.target.reset();
      toast('เพิ่มร้านสำเร็จ', 'success');
      renderAdminRests();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function renderSettings() {
  try {
    const s = await API.getSettings();
    $('#setSiteName').value  = s.siteName  || '';
    $('#setMaxGuests').value = s.maxGuests || 20;

    const chips = $('#timeChips');
    chips.innerHTML = (s.timeSlots || []).map((t) =>
      `<span class="chip">${t} น.<button data-time="${t}">✕</button></span>`
    ).join('');
    chips.querySelectorAll('button').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const current = await API.getSettings();
        current.timeSlots = current.timeSlots.filter((x) => x !== btn.dataset.time);
        await API.updateSettings(current);
        renderSettings();
      })
    );
  } catch { /* silent */ }
}

function initSettings() {
  $('#addTimeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = $('#newTime').value;
    if (!t) return;
    try {
      const s = await API.getSettings();
      s.timeSlots = s.timeSlots || [];
      if (!s.timeSlots.includes(t)) {
        s.timeSlots.push(t);
        s.timeSlots.sort();
        await API.updateSettings(s);
        renderSettings();
        toast('เพิ่มช่วงเวลาแล้ว', 'success');
      }
      e.target.reset();
    } catch (err) { toast(err.message, 'error'); }
  });

  $('#generalSettings').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.updateSettings({
        siteName:  $('#setSiteName').value.trim(),
        maxGuests: Number($('#setMaxGuests').value) || 20,
      });
      toast('บันทึกการตั้งค่าแล้ว', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function renderAdminBookings() {
  const box = $('#adminBookingsList');
  box.innerHTML = '<p class="empty">กำลังโหลด...</p>';
  try {
    const bookings = await API.getAllBookings();
    if (!bookings.length) { box.innerHTML = '<p class="empty">ยังไม่มีการจอง</p>'; return; }
    box.innerHTML = bookings.map((b) => `
      <div class="booking-item">
        <div class="b-main">
          <h4>${b.restaurant_name} <small style="color:var(--muted)">— โดย ${b.username}</small></h4>
          <div class="b-detail">
            <span>📅 ${fmtDate(b.date)}</span>
            <span>⏰ ${b.time_slot} น.</span>
            <span>📍 ${b.zone}</span>
            <span>👥 ${b.guests} คน</span>
          </div>
          <div class="b-detail" style="margin-top:6px">
            <span>ผู้จอง: ${b.booker_name}</span>
            <span>โทร: ${b.phone}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm btn-cancel" data-id="${b.id}">ลบ</button>
      </div>`).join('');
    bindCancelButtons(box, () => renderAdminBookings());
  } catch {
    box.innerHTML = '<p class="empty">โหลดข้อมูลไม่สำเร็จ</p>';
  }
}

// ============================================================
//  Init
// ============================================================
// ============================================================
//  Theme (light / dark)
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = $('#themeToggle');
  if (btn) {
    btn.textContent = theme === 'light' ? '☀️' : '🌙';
    btn.title = theme === 'light' ? 'สลับเป็นโหมดมืด' : 'สลับเป็นโหมดสว่าง';
  }
}

function initTheme() {
  applyTheme(localStorage.getItem('theme') || 'dark');
  const btn = $('#themeToggle');
  if (btn) btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'light' ? 'dark' : 'light');
  });
}

function init() {
  initTheme();
  initAuth();
  initBooking();
  initAdminTabs();
  initAddRest();
  initSettings();

  $$('.nav-btn').forEach((b) =>
    b.addEventListener('click', () => showView(b.dataset.view))
  );

  if (Auth.isLoggedIn()) enterApp();
}

document.addEventListener('DOMContentLoaded', init);
