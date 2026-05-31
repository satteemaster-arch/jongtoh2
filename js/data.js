/* ============================================================
   data.js — จัดการข้อมูลทั้งหมดผ่าน localStorage
   ============================================================ */
const DB = {
  KEYS: {
    users: "tb_users",
    rests: "tb_restaurants",
    bookings: "tb_bookings",
    settings: "tb_settings",
    session: "tb_session",
  },

  // อ่าน/เขียน helper
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },

  // ---------- เริ่มต้นข้อมูลตัวอย่าง (ครั้งแรก) ----------
  seed() {
    if (!localStorage.getItem(this.KEYS.users)) {
      this._set(this.KEYS.users, [
        { username: "admin", password: "admin", role: "admin" },
        { username: "user", password: "user", role: "user" },
      ]);
    }
    if (!localStorage.getItem(this.KEYS.rests)) {
      this._set(this.KEYS.rests, [
        {
          id: 1, name: "ครัวคุณยาย", type: "อาหารไทย", img: "🍲",
          desc: "อาหารไทยรสชาติต้นตำรับ บรรยากาศอบอุ่น",
          zones: ["โซนปรับอากาศ", "โซนสวน", "ริมหน้าต่าง"],
        },
        {
          id: 2, name: "Sakura Sushi", type: "อาหารญี่ปุ่น", img: "🍣",
          desc: "ซูชิและซาชิมิสดใหม่ทุกวัน",
          zones: ["เคาน์เตอร์บาร์", "โซนปรับอากาศ", "ห้องส่วนตัว"],
        },
        {
          id: 3, name: "Pasta House", type: "อาหารอิตาเลียน", img: "🍝",
          desc: "พาสต้าและพิซซ่าโฮมเมด",
          zones: ["โซนปรับอากาศ", "ระเบียงชั้นบน"],
        },
        {
          id: 4, name: "ชาบูเฮ้าส์", type: "ชาบู/หม้อไฟ", img: "🍲",
          desc: "บุฟเฟต์ชาบูพรีเมียม วัตถุดิบคัดสรร",
          zones: ["โซนปรับอากาศ", "โซนกลุ่มใหญ่"],
        },
      ]);
    }
    if (!localStorage.getItem(this.KEYS.bookings)) {
      this._set(this.KEYS.bookings, []);
    }
    if (!localStorage.getItem(this.KEYS.settings)) {
      this._set(this.KEYS.settings, {
        siteName: "jongtoh",
        maxGuests: 20,
        timeSlots: ["11:00", "12:00", "13:00", "17:00", "18:00", "19:00", "20:00"],
      });
    }
  },

  // ---------- Users ----------
  getUsers() { return this._get(this.KEYS.users, []); },
  addUser(u) {
    const users = this.getUsers();
    users.push(u);
    this._set(this.KEYS.users, users);
  },
  findUser(username) {
    return this.getUsers().find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
  },

  // ---------- Session ----------
  getSession() { return this._get(this.KEYS.session, null); },
  setSession(s) { this._set(this.KEYS.session, s); },
  clearSession() { localStorage.removeItem(this.KEYS.session); },

  // ---------- Restaurants ----------
  getRests() { return this._get(this.KEYS.rests, []); },
  addRest(r) {
    const rests = this.getRests();
    r.id = Date.now();
    rests.push(r);
    this._set(this.KEYS.rests, rests);
    return r;
  },
  deleteRest(id) {
    this._set(this.KEYS.rests, this.getRests().filter((r) => r.id !== id));
  },
  getRest(id) { return this.getRests().find((r) => r.id === id); },

  // ---------- Bookings ----------
  getBookings() { return this._get(this.KEYS.bookings, []); },
  addBooking(b) {
    const list = this.getBookings();
    b.id = Date.now();
    b.createdAt = new Date().toISOString();
    list.push(b);
    this._set(this.KEYS.bookings, list);
    return b;
  },
  deleteBooking(id) {
    this._set(this.KEYS.bookings, this.getBookings().filter((b) => b.id !== id));
  },
  getUserBookings(username) {
    return this.getBookings().filter((b) => b.user === username);
  },
  // ตรวจสอบโต๊ะซ้ำ: ร้าน+วัน+เวลา+โซน เดียวกันถือว่าเต็ม
  isSlotTaken(restId, date, time, zone) {
    return this.getBookings().some(
      (b) => b.restId === restId && b.date === date && b.time === time && b.zone === zone
    );
  },

  // ---------- Settings ----------
  getSettings() { return this._get(this.KEYS.settings, {}); },
  setSettings(s) { this._set(this.KEYS.settings, s); },
};

DB.seed();
