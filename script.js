/* ================= DATA ================= */
let db = JSON.parse(localStorage.getItem("fp") || '{"devices":[],"tickets":[],"appointments":[],"n":1000}');
if (!db.appointments) db.appointments = [];
let me = JSON.parse(sessionStorage.getItem("fp-me") || "null");
let tempUsers = {};

const save = () => localStorage.setItem("fp", JSON.stringify(db));

const ACCOUNTS = {
  user:  {password:"user",  name:"Demo User", role:"user"},
  admin: {password:"admin", name:"Admin",     role:"admin"}
};
const getUser = u => tempUsers[u] || ACCOUNTS[u];
const isAdmin = () => me && me.role === "admin";

/* ================= HELPERS ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money = n => "$" + Math.round(n);
const fmt = t => new Date(t).toLocaleDateString(undefined, {month:"short", day:"numeric"});
const fmtDT = t => new Date(t).toLocaleDateString(undefined, {weekday:"short", month:"short", day:"numeric"})
  + " · " + new Date(t).toLocaleTimeString(undefined, {hour:"numeric", minute:"2-digit"});
const initials = n => (n || "U").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();

let toastTimer;
const toast = msg => {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
};

/* ================= THEME ================= */
const THEME_KEY = "fp-theme";
const THEME_COLOR = { light: "#f5f5f7", dark: "#000000" };

const THEME_TOGGLE_HTML = `
  <button class="theme-toggle" data-theme-toggle type="button" aria-label="Toggle appearance">
    <svg class="t-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
    <svg class="t-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>
`;

function syncThemeUI() {
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const btn = document.querySelector("[data-theme-toggle]");
  if (btn) {
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[theme] || THEME_COLOR.dark);
}

function setTheme(theme) {
  if (theme !== "light" && theme !== "dark") theme = "dark";
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  syncThemeUI();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  setTheme(current === "dark" ? "light" : "dark");
}

/* ================= CATALOGUE ================= */
const TYPES = { phone:"Phone", laptop:"Laptop", appliance:"Appliance" };
const REPAIRS = {
  phone: [
    ["Screen replacement", 129, 2],
    ["Battery replacement", 59, 1],
    ["Back panel", 79, 2],
    ["Charging port", 69, 2]
  ],
  laptop: [
    ["Screen replacement", 219, 3],
    ["Battery replacement", 119, 2],
    ["Keyboard", 99, 2],
    ["Storage drive", 129, 2]
  ],
  appliance: [
    ["Power supply", 59, 2],
    ["Motor repair", 89, 4],
    ["Control board", 79, 3]
  ]
};

const SYMPTOMS = {
  phone: [
    { text: "Screen cracked or touch not working", repair: 0, confidence: 94 },
    { text: "Battery drains fast", repair: 1, confidence: 88 },
    { text: "Back glass cracked", repair: 2, confidence: 96 },
    { text: "Won't charge reliably", repair: 3, confidence: 82 }
  ],
  laptop: [
    { text: "Screen cracked or flickering", repair: 0, confidence: 92 },
    { text: "Battery won't hold charge", repair: 1, confidence: 89 },
    { text: "Keys stuck or unresponsive", repair: 2, confidence: 90 },
    { text: "Slow startup or freezing", repair: 3, confidence: 80 }
  ],
  appliance: [
    { text: "Won't switch on", repair: 0, confidence: 84 },
    { text: "Noisy or stops mid-cycle", repair: 1, confidence: 81 },
    { text: "Buttons or display unresponsive", repair: 2, confidence: 76 }
  ]
};

const STAGES = ["Received", "Repairing", "Testing", "Ready", "Collected"];
const TIME_SLOTS = [9, 10, 11, 13, 14, 15, 16, 17];

/* ================= STATE ================= */
let selDev = null, selTicket = null;
let diag = { type: "phone", result: null };
let bookState = { date: null, time: null, device: null };
let lastPage = null;

const myDevices = () => !me ? [] : db.devices.filter(d => d.owner === me.username);
const myTickets = () => !me ? [] : isAdmin() ? db.tickets : db.tickets.filter(t => t.owner === me.username);
const devName = id => {
  const d = db.devices.find(x => x.id === id);
  return d ? `${d.brand} ${d.model}` : "Unknown device";
};
const isTaken = (dateTs, hour) => db.appointments.some(a => a.time === dateTs + hour * 3600000);

/* ================= LOGIN ================= */
function loginPage() {
  return `
    <div class="card narrow" style="margin-top:40px">
      <h1 style="font-size:32px">Log in</h1>
      <p class="lead" style="margin-bottom:24px;font-size:15px">Use <b>user / user</b> or <b>admin / admin</b></p>
      <form id="login-form">
        <label><span>Username</span><input name="u" required autofocus autocomplete="username" placeholder="user"></label>
        <label><span>Password</span><input name="p" type="password" required autocomplete="current-password" placeholder="••••"></label>
        <button class="btn block">Log in</button>
      </form>
      <p class="muted" style="margin-top:20px;text-align:center">No account? <a href="#signup">Sign up</a></p>
    </div>
  `;
}

function signupPage() {
  return `
    <div class="card narrow" style="margin-top:40px">
      <h1 style="font-size:32px">Sign up</h1>
      <p class="lead" style="margin-bottom:24px;font-size:15px">Temporary — disappears on refresh.</p>
      <form id="signup-form">
        <label><span>Username</span><input name="u" required autocomplete="username"></label>
        <label><span>Full name</span><input name="n" required autocomplete="name"></label>
        <label><span>Password</span><input name="p" type="password" required autocomplete="new-password"></label>
        <button class="btn block">Create account</button>
      </form>
      <p class="muted" style="margin-top:20px;text-align:center">Have an account? <a href="#login">Log in</a></p>
    </div>
  `;
}

/* ================= HOME ================= */
function homePage() {
  if (isAdmin()) return adminHome();

  const tickets = myTickets();
  const ready = tickets.filter(t => t.stage === 3);

  const actions = [
    { href:"#new",      icon:"🛠️", bg:"#e6f0ff", label:"New ticket",   desc:"Book a repair" },
    { href:"#diagnose", icon:"🔍", bg:"#f0e8ff", label:"Diagnose",     desc:"Find the fault" },
    { href:"#book",     icon:"📅", bg:"#e8f7ee", label:"Book a visit", desc:"Free technician check" },
    { href:"#devices",  icon:"📱", bg:"#fff4e0", label:"My devices",   desc:"Manage devices" }
  ];
  if (tickets.length) {
    actions.push({ href:"#ticket", icon:"📦", bg:"#f0f4f8", label:"Track repair", desc:"Live progress" });
  }

  return `
    <div class="hero">
      <h1>Hello, ${esc(me.name.split(" ")[0])}.</h1>
      <p class="lead">Here's what's happening with your repairs.</p>
    </div>

    ${ready.map(t => `
      <div class="banner">
        <span><strong>${esc(devName(t.device))}</strong> is ready for pickup.</span>
        <a href="#ticket" data-ticket="${t.id}">View →</a>
      </div>
    `).join("")}

    <div class="tiles">
      ${actions.map(a => `
        <a href="${a.href}" class="tile">
          <span class="icon" style="background:${a.bg}">${a.icon}</span>
          <b>${a.label}</b>
          <small>${a.desc}</small>
        </a>
      `).join("")}
    </div>

    <h2>Recent tickets</h2>
    <div class="card">
      ${tickets.length ? tickets.map(t => `
        <div class="row">
          <div class="row-body">
            <a href="#ticket" data-ticket="${t.id}"><b>${t.id} · ${esc(devName(t.device))}</b></a>
            <div class="muted">${t.repairs.join(", ")}</div>
          </div>
          <span class="badge ${t.stage === 3 ? "ok" : ""}">${STAGES[t.stage]}</span>
        </div>
      `).join("") : `
        <div class="empty">
          <div class="empty-icon">📋</div>
          <b>No tickets yet</b>
          <p>Create your first repair ticket to get started.</p>
        </div>
      `}
    </div>
  `;
}

/* ================= ADMIN HOME ================= */
function adminHome() {
  const tickets = myTickets();
  const open = tickets.filter(t => t.stage < 4).length;
  const readyCount = tickets.filter(t => t.stage === 3).length;
  const bookings = db.appointments
    .filter(a => a.time > Date.now())
    .sort((a, b) => a.time - b.time);

  return `
    <h1>Shop dashboard</h1>
    <p class="lead">Manage tickets and upcoming visits.</p>

    <div class="stats">
      <div><small>Open</small><b>${open}</b></div>
      <div><small>Ready</small><b>${readyCount}</b></div>
      <div><small>Visits</small><b>${bookings.length}</b></div>
    </div>

    <h2>Tickets</h2>
    <div class="card">
      ${tickets.length ? tickets.map(t => `
        <div class="row">
          <div class="row-body">
            <a href="#ticket" data-ticket="${t.id}"><b>${t.id} · ${esc(devName(t.device))}</b></a>
            <div class="muted">${esc(t.customer)} · ${t.repairs.join(", ")}</div>
          </div>
          <select data-ticket="${t.id}">
            ${STAGES.map((s, i) => `<option value="${i}" ${i === t.stage ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      `).join("") : `
        <div class="empty">
          <div class="empty-icon">📋</div>
          <b>No tickets yet</b>
          <p>When customers book repairs, they'll appear here.</p>
        </div>
      `}
    </div>

    <h2>Upcoming visits</h2>
    <div class="card">
      ${bookings.length ? bookings.map(a => `
        <div class="row">
          <div class="row-body">
            <b>${esc(devName(a.device))}</b>
            <div class="muted">${esc(a.customer || "Guest")} · ${fmtDT(a.time)}</div>
          </div>
          <button class="btn small secondary" data-cancel="${a.id}">Cancel</button>
        </div>
      `).join("") : `
        <div class="empty">
          <div class="empty-icon">📅</div>
          <b>No visits booked</b>
          <p>Customer appointments will show up here.</p>
        </div>
      `}
    </div>
  `;
}

/* ================= DEVICES ================= */
function devicesPage() {
  const devices = myDevices();
  return `
    <a href="#home" class="back">← Home</a>
    <h1>My devices</h1>
    <p class="lead">Every device you've registered.</p>

    <div class="card">
      ${devices.length ? devices.map(d => `
        <div class="row">
          <div class="row-body">
            <b>${esc(d.brand)} ${esc(d.model)}</b>
            <div class="muted">${TYPES[d.type]}</div>
          </div>
          <a href="#new" data-device="${d.id}" class="btn small secondary">Repair</a>
        </div>
      `).join("") : `
        <div class="empty">
          <div class="empty-icon">📱</div>
          <b>No devices yet</b>
          <p>Add your first device below.</p>
        </div>
      `}
    </div>

    <div class="card">
      <h2>Add a device</h2>
      <form id="add-device">
        <label><span>Type</span>
          <select name="type">
            ${Object.entries(TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join("")}
          </select>
        </label>
        <label><span>Brand</span><input name="brand" required placeholder="Apple"></label>
        <label><span>Model</span><input name="model" required placeholder="iPhone 14"></label>
        <button class="btn block">Add device</button>
      </form>
    </div>
  `;
}

/* ================= NEW TICKET ================= */
function newPage() {
  const devices = myDevices();
  if (!devices.length) {
    return `
      <a href="#home" class="back">← Home</a>
      <div class="card empty">
        <div class="empty-icon">📱</div>
        <b>No devices yet</b>
        <p>Add a device first, then you can book a repair.</p>
        <div style="margin-top:20px"><a href="#devices" class="btn">Add device</a></div>
      </div>
    `;
  }

  const d = devices.find(x => x.id === selDev) || devices[0];
  selDev = d.id;
  const repairs = REPAIRS[d.type];

  return `
    <a href="#home" class="back">← Home</a>
    <h1>New ticket</h1>
    <p class="lead">Book a repair for your device.</p>

    <form id="new-ticket" class="card">
      <label><span>Device</span>
        <select name="device">
          ${devices.map(x => `<option value="${x.id}" ${x.id === d.id ? "selected" : ""}>${esc(x.brand)} ${esc(x.model)}</option>`).join("")}
        </select>
      </label>

      <p style="margin:24px 0 12px;font-weight:600;color:var(--tx);letter-spacing:-0.01em">What needs fixing?</p>
      ${repairs.map((r, i) => `
        <label class="repair-opt">
          <input type="checkbox" name="repair" value="${i}">
          <span>${r[0]}<small>${r[2]} day${r[2] > 1 ? "s" : ""}</small></span>
          <em>${money(r[1])}</em>
        </label>
      `).join("")}

      <div class="form-summary">
        <div>
          <span>Estimated cost</span>
          <b id="ticket-total">$0</b>
        </div>
        <div>
          <span>Estimated time</span>
          <b id="ticket-days">—</b>
        </div>
      </div>

      <label><span>Describe the issue (optional)</span>
        <textarea name="issue" rows="3" placeholder="E.g. dropped yesterday, screen flickers."></textarea>
      </label>

      <button class="btn block">Create ticket</button>
    </form>
  `;
}

function updateTicketTotal() {
  const form = document.getElementById("new-ticket");
  if (!form) return;
  const device = db.devices.find(x => x.id === form.device.value);
  if (!device) return;
  const repairs = REPAIRS[device.type];
  const picked = [...form.querySelectorAll("[name=repair]:checked")].map(x => +x.value);
  const cost = picked.reduce((s, i) => s + repairs[i][1], 0);
  const days = picked.length ? Math.max(...picked.map(i => repairs[i][2])) : 0;
  const totalEl = document.getElementById("ticket-total");
  const daysEl = document.getElementById("ticket-days");
  if (totalEl) totalEl.textContent = money(cost);
  if (daysEl) daysEl.textContent = picked.length ? `${days} day${days > 1 ? "s" : ""}` : "—";
}

/* ================= TICKET DETAIL ================= */
function ticketPage() {
  const tickets = myTickets();
  const t = tickets.find(x => x.id === selTicket) || tickets[0];
  if (!t) { location.hash = "home"; return ""; }
  selTicket = t.id;

  const progress = Math.round((t.stage + 1) / STAGES.length * 100);

  return `
    <a href="#home" class="back">← Home</a>
    <h1>Ticket ${t.id}</h1>

    ${tickets.length > 1 ? `
      <div class="seg">
        ${tickets.map(x => `<a href="#ticket" data-ticket="${x.id}" class="${x.id === t.id ? "on" : ""}">${x.id}</a>`).join("")}
      </div>
    ` : ""}

    <div class="card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:8px">
        <div>
          <h2 style="margin-bottom:4px">${esc(devName(t.device))}</h2>
          <p class="muted">${t.repairs.join(", ")}</p>
        </div>
        <span class="badge ${t.stage === 3 ? "ok" : ""}">${STAGES[t.stage]}</span>
      </div>

      <div class="progress"><div style="width:${progress}%"></div></div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px">
        <div><small class="muted">Opened</small><br><b style="letter-spacing:-0.01em">${fmt(t.created)}</b></div>
        <div><small class="muted">Pickup by</small><br><b style="letter-spacing:-0.01em">${fmt(t.due)}</b></div>
        <div><small class="muted">Cost</small><br><b style="letter-spacing:-0.01em">${money(t.cost)}</b></div>
      </div>

      ${t.issue ? `<p class="muted" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line);font-style:italic">"${esc(t.issue)}"</p>` : ""}
    </div>

    <div class="card">
      <h3>Timeline</h3>
      ${STAGES.map((s, i) => `
        <div class="step ${i <= t.stage ? "done" : ""}">
          <div class="dot">${i <= t.stage ? "✓" : ""}</div>
          ${s}
        </div>
      `).join("")}
    </div>
  `;
}

/* ================= DIAGNOSE ================= */
function diagnosePage() {
  return `
    <a href="#home" class="back">← Home</a>
    <h1>Diagnose</h1>
    <p class="lead">Select what you're noticing — we'll suggest the most likely fix.</p>

    <div class="seg">
      ${Object.entries(TYPES).map(([k, v]) => `
        <button type="button" data-diag-type="${k}" class="${diag.type === k ? "on" : ""}">${v}</button>
      `).join("")}
    </div>

    <form id="diagnose-form" class="card">
      <p style="font-weight:600;margin-bottom:12px;letter-spacing:-0.01em">Symptoms</p>
      ${SYMPTOMS[diag.type].map((s, i) => `
        <label class="repair-opt">
          <input type="checkbox" name="sym" value="${i}">
          <span>${s.text}</span>
        </label>
      `).join("")}
      <button class="btn block" style="margin-top:20px">Run diagnostic</button>
    </form>

    <div id="diag-result">${renderDiagResult()}</div>
  `;
}

function renderDiagResult() {
  if (!diag.result) return "";
  return `
    <div class="card">
      <h3>Suggested repairs</h3>
      ${diag.result.map((r, i) => {
        const [name, price, days] = REPAIRS[diag.type][r.repair];
        return `
          <div style="padding:16px 0;${i ? 'border-top:1px solid var(--line)' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
              <div style="flex:1">
                <b style="letter-spacing:-0.01em">${i ? "Also possible" : "Most likely"}: ${name}</b>
                <div class="muted" style="margin-top:2px">${r.confidence}% match · about ${days} day${days > 1 ? "s" : ""}</div>
              </div>
              <b style="font-size:18px;letter-spacing:-0.02em">${money(price)}</b>
            </div>
          </div>
        `;
      }).join("")}
      <button type="button" class="btn block" data-create-from-diag style="margin-top:20px">Book this repair</button>
    </div>
  `;
}

/* ================= BOOK VISIT ================= */
function bookPage() {
  const devices = myDevices();
  if (!devices.length) {
    return `
      <a href="#home" class="back">← Home</a>
      <div class="card empty">
        <div class="empty-icon">📱</div>
        <b>No devices yet</b>
        <p>Add a device first, then you can book a visit.</p>
        <div style="margin-top:20px"><a href="#devices" class="btn">Add device</a></div>
      </div>
    `;
  }

  const currentDevice = devices.find(d => d.id === bookState.device) || devices[0];
  bookState.device = currentDevice.id;

  const myAppts = db.appointments
    .filter(a => a.owner === me.username && a.time > Date.now())
    .sort((a, b) => a.time - b.time);

  const dates = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 1; dates.length < 5; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) dates.push(d.getTime());
  }

  return `
    <a href="#home" class="back">← Home</a>
    <h1>Book a visit</h1>
    <p class="lead">Free 15-minute check with a technician.</p>

    ${myAppts.length ? `
      <div class="card">
        <h3>Your appointments</h3>
        ${myAppts.map(a => `
          <div class="row">
            <div class="row-body">
              <b>${fmtDT(a.time)}</b>
              <div class="muted">${esc(devName(a.device))}</div>
            </div>
            <button class="btn small secondary" data-cancel="${a.id}">Cancel</button>
          </div>
        `).join("")}
      </div>
    ` : ""}

    <form id="book-form" class="card">
      <label><span>Device</span>
        <select name="device">
          ${devices.map(d => `<option value="${d.id}" ${d.id === currentDevice.id ? "selected" : ""}>${esc(d.brand)} ${esc(d.model)}</option>`).join("")}
        </select>
      </label>

      <p style="font-weight:600;margin:20px 0 10px;letter-spacing:-0.01em">Pick a day</p>
      <div class="seg wrap" style="margin-bottom:20px">
        ${dates.map(ts => `
          <button type="button" data-book-date="${ts}" class="${bookState.date === ts ? "on" : ""}">${new Date(ts).toLocaleDateString(undefined, {weekday:"short", month:"short", day:"numeric"})}</button>
        `).join("")}
      </div>

      <p style="font-weight:600;margin:20px 0 10px;letter-spacing:-0.01em">Pick a time</p>
      <div class="seg wrap" style="margin-bottom:20px">
        ${TIME_SLOTS.map(h => {
          const blocked = bookState.date === null || isTaken(bookState.date, h);
          const on = bookState.time === h && !blocked;
          return `<button type="button" data-book-time="${h}" class="${on ? "on" : ""}" ${blocked ? "disabled" : ""}>${h}:00</button>`;
        }).join("")}
      </div>

      <button class="btn block" style="margin-top:8px">Confirm booking</button>
    </form>
  `;
}

/* ================= RENDER ================= */
function render() {
  let page = location.hash.slice(1) || "home";

  if (!me && page !== "login" && page !== "signup") return location.hash = "login";
  if (me && (page === "login" || page === "signup")) return location.hash = "home";

  let html;
  if (page === "login") html = loginPage();
  else if (page === "signup") html = signupPage();
  else if (page === "devices") html = devicesPage();
  else if (page === "new") html = newPage();
  else if (page === "ticket") html = ticketPage();
  else if (page === "diagnose") html = diagnosePage();
  else if (page === "book") html = bookPage();
  else html = homePage();

  const app = $("#app");
  app.innerHTML = html;

  if (page === "new") updateTicketTotal();

  if (lastPage !== page) {
    app.classList.remove("page-enter");
    void app.offsetWidth;
    app.classList.add("page-enter");
    lastPage = page;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const nav = $("#nav");
  if (me) {
    const links = isAdmin()
      ? [["home", "Overview"]]
      : [
          ["home", "Overview"],
          ["devices", "Devices"],
          ["new", "New ticket"],
          ["diagnose", "Diagnose"],
          ["book", "Book"]
        ];
    nav.innerHTML = `
      <div class="wrap">
        <a href="#home" class="logo">Fixpoint</a>
        <div class="nav-links">
          ${links.map(([k, l]) => `<a href="#${k}" class="${page === k ? "on" : ""}">${l}</a>`).join("")}
        </div>
        <div class="user">
          <div class="avatar">${initials(me.name)}</div>
          <span>${isAdmin() ? "Admin" : esc(me.name.split(" ")[0])}</span>
          <button data-logout>Log out</button>
        </div>
        ${THEME_TOGGLE_HTML}
      </div>
    `;
  } else {
    nav.innerHTML = `
      <div class="wrap">
        <a href="#home" class="logo">Fixpoint</a>
        ${THEME_TOGGLE_HTML}
      </div>
    `;
  }

  syncThemeUI();
}

/* ================= SUBMIT ================= */
document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;

  if (f.id === "login-form") {
    const u = f.u.value.trim().toLowerCase();
    const acc = getUser(u);
    if (!acc || acc.password !== f.p.value) return toast("Invalid username or password");
    me = {username: u, name: acc.name, role: acc.role};
    sessionStorage.setItem("fp-me", JSON.stringify(me));
    location.hash = "home";
  }

  if (f.id === "signup-form") {
    const u = f.u.value.trim().toLowerCase();
    if (ACCOUNTS[u] || tempUsers[u]) return toast("Username taken");
    tempUsers[u] = {password: f.p.value, name: f.n.value.trim(), role: "user"};
    me = {username: u, name: f.n.value.trim(), role: "user"};
    sessionStorage.setItem("fp-me", JSON.stringify(me));
    location.hash = "home";
  }

  if (f.id === "add-device") {
    db.devices.push({
      id: "d" + Date.now(),
      owner: me.username,
      type: f.type.value,
      brand: f.brand.value.trim(),
      model: f.model.value.trim()
    });
    save();
    toast("Device added");
    render();
  }

  if (f.id === "new-ticket") {
    const device = db.devices.find(x => x.id === f.device.value);
    const picked = [...f.querySelectorAll("[name=repair]:checked")].map(x => +x.value);
    if (!picked.length) return toast("Select at least one repair");

    const repairs = picked.map(i => REPAIRS[device.type][i]);
    const cost = repairs.reduce((s, r) => s + r[1], 0);
    const days = Math.max(...repairs.map(r => r[2]));
    const now = Date.now();

    const ticket = {
      id: "T" + (++db.n),
      device: device.id,
      owner: me.username,
      customer: me.name,
      repairs: repairs.map(r => r[0]),
      cost, days,
      created: now,
      due: now + days * 86400000,
      stage: 0,
      issue: f.issue.value.trim()
    };

    db.tickets.unshift(ticket);
    save();
    selTicket = ticket.id;
    toast("Ticket " + ticket.id + " created");
    location.hash = "ticket";
  }

  if (f.id === "diagnose-form") {
    const picked = [...f.querySelectorAll("[name=sym]:checked")].map(x => +x.value);
    if (!picked.length) return toast("Select at least one symptom");
    diag.result = picked.map(i => SYMPTOMS[diag.type][i]).sort((a, b) => b.confidence - a.confidence);
    document.getElementById("diag-result").innerHTML = renderDiagResult();
  }

  if (f.id === "book-form") {
    if (bookState.date === null || bookState.time === null) return toast("Pick a day and time");
    if (isTaken(bookState.date, bookState.time)) return toast("That slot is taken");
    db.appointments.push({
      id: "A" + Date.now(),
      owner: me.username,
      customer: me.name,
      device: f.device.value,
      time: bookState.date + bookState.time * 3600000
    });
    save();
    bookState = {date: null, time: null, device: bookState.device};
    toast("Appointment booked");
    render();
  }
});

/* ================= CHANGE ================= */
document.addEventListener("change", e => {
  const t = e.target;

  if (t.dataset.ticket && t.tagName === "SELECT" && isAdmin()) {
    const ticket = db.tickets.find(x => x.id === t.dataset.ticket);
    if (ticket) {
      ticket.stage = +t.value;
      save();
      toast(ticket.id + " → " + STAGES[ticket.stage]);
      render();
    }
    return;
  }

  if (t.name === "device" && location.hash === "#new") {
    const issue = t.form?.querySelector("[name=issue]")?.value ?? "";
    selDev = t.value;
    render();
    const ta = document.querySelector("#new-ticket [name=issue]");
    if (ta) ta.value = issue;
    return;
  }

  if (t.name === "repair" && location.hash === "#new") {
    updateTicketTotal();
    return;
  }

  if (t.name === "device" && location.hash === "#book") {
    bookState.device = t.value;
    return;
  }

  if (t.name === "sym" && location.hash === "#diagnose") {
    diag.result = null;
    const el = document.getElementById("diag-result");
    if (el) el.innerHTML = "";
  }
});

/* ================= CLICK ================= */
document.addEventListener("click", e => {
  if (e.target.closest("[data-theme-toggle]")) {
    toggleTheme();
    return;
  }

  if (e.target.closest("[data-logout]")) {
    me = null;
    sessionStorage.removeItem("fp-me");
    return location.hash = "login";
  }

  const diagType = e.target.closest("[data-diag-type]");
  if (diagType) {
    diag = {type: diagType.dataset.diagType, result: null};
    return render();
  }

  if (e.target.closest("[data-create-from-diag]")) {
    const d = myDevices().find(x => x.type === diag.type);
    if (!d) return toast("Add a " + TYPES[diag.type] + " first");
    selDev = d.id;
    location.hash = "new";
    return;
  }

  const bookDate = e.target.closest("[data-book-date]");
  if (bookDate) {
    bookState.date = +bookDate.dataset.bookDate;
    if (bookState.time !== null && isTaken(bookState.date, bookState.time)) bookState.time = null;
    return render();
  }

  const bookTime = e.target.closest("[data-book-time]");
  if (bookTime) {
    bookState.time = +bookTime.dataset.bookTime;
    return render();
  }

  const cancelBtn = e.target.closest("[data-cancel]");
  if (cancelBtn) {
    db.appointments = db.appointments.filter(a => a.id !== cancelBtn.dataset.cancel);
    save();
    toast("Appointment cancelled");
    return render();
  }

  const ticketLink = e.target.closest("a[data-ticket]");
  if (ticketLink) {
    selTicket = ticketLink.dataset.ticket;
    if (location.hash === "#ticket") render();
  }
  const devLink = e.target.closest("a[data-device]");
  if (devLink) selDev = devLink.dataset.device;
});

/* ================= DEMO / RESET ================= */
document.getElementById("demo").addEventListener("click", () => {
  if (!confirm("Load sample data? This will replace your current data.")) return;

  const now = Date.now();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2); dayAfter.setHours(14, 0, 0, 0);

  db = {
    devices: [
      {id:"d1", owner:"user", type:"phone",  brand:"Apple", model:"iPhone 14"},
      {id:"d2", owner:"user", type:"laptop", brand:"Apple", model:"MacBook Air"}
    ],
    tickets: [
      {id:"T1001", device:"d1", owner:"user", customer:"Demo User",
       repairs:["Screen replacement","Battery replacement"], cost:188, days:3,
       created:now-2*86400000, due:now+86400000, stage:2, issue:"Screen cracked after drop"},
      {id:"T1002", device:"d2", owner:"user", customer:"Demo User",
       repairs:["Keyboard"], cost:99, days:2,
       created:now-5*86400000, due:now-3*86400000, stage:3, issue:"Several keys stuck"}
    ],
    appointments: [
      {id:"A1001", owner:"user", customer:"Demo User", device:"d1", time:tomorrow.getTime()},
      {id:"A1002", owner:"user", customer:"Demo User", device:"d2", time:dayAfter.getTime()}
    ],
    n: 1002
  };
  save();

  if (!me || (me.username !== "user" && me.role !== "admin")) {
    me = null;
    sessionStorage.removeItem("fp-me");
    toast("Sample data loaded — log in as user / user");
    location.hash = "login";
    return;
  }

  toast("Sample data loaded");
  render();
});

document.getElementById("reset").addEventListener("click", () => {
  if (!confirm("Reset all data?")) return;
  db = {devices:[], tickets:[], appointments:[], n:1000};
  tempUsers = {};
  me = null;
  save();
  sessionStorage.removeItem("fp-me");
  location.hash = "login";
});

/* ================= INIT ================= */
if (me && !getUser(me.username)) {
  me = null;
  sessionStorage.removeItem("fp-me");
}

syncThemeUI();

addEventListener("hashchange", () => {
  render();
  requestAnimationFrame(() => {
    document.getElementById("app")?.focus({ preventScroll: true });
  });
});

render();