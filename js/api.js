/* api.js — fetch wrapper ส่ง JWT header ทุก request */
const BASE = '';  // serve จาก server เดียวกัน

async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const API = {
  // Auth
  login:    (username, password) => apiFetch('/api/auth/login',    { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username, password) => apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),

  // Restaurants
  getRestaurants: ()           => apiFetch('/api/restaurants'),
  addRestaurant:  (data)       => apiFetch('/api/restaurants',       { method: 'POST',   body: JSON.stringify(data) }),
  deleteRestaurant: (id)       => apiFetch(`/api/restaurants/${id}`, { method: 'DELETE' }),

  // Bookings
  getMyBookings:  ()           => apiFetch('/api/bookings/my'),
  getAllBookings:  ()           => apiFetch('/api/bookings/all'),
  createBooking:  (data)       => apiFetch('/api/bookings',          { method: 'POST',   body: JSON.stringify(data) }),
  cancelBooking:  (id)         => apiFetch(`/api/bookings/${id}`,    { method: 'DELETE' }),

  // Tables
  getTableAvailability: (restaurantId, date, timeSlot) =>
    apiFetch(`/api/tables/${restaurantId}/availability?date=${date}&time_slot=${encodeURIComponent(timeSlot)}`),

  // Settings
  getSettings:    ()           => apiFetch('/api/settings'),
  updateSettings: (data)       => apiFetch('/api/settings',          { method: 'PUT',    body: JSON.stringify(data) }),
};
