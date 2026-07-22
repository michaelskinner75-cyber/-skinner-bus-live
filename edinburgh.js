let departures = [];
let selectedStance = 'All';
let query = '';

const rows = document.querySelector('#boardRows');
const filters = document.querySelector('#stanceFilters');

function updateClock() {
  const now = new Date();
  document.querySelector('#boardClock').textContent = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  document.querySelector('#boardDate').textContent = now.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
}

function minutesUntil(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const departure = new Date(now);
  departure.setHours(hours, minutes, 0, 0);
  return Math.ceil((departure - now) / 60000);
}

function todayName() {
  return new Intl.DateTimeFormat('en-GB', { weekday:'long' }).format(new Date());
}

function allStances() {
  return [...new Set(departures.map(item => item.stance).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, undefined, { numeric:true }));
}

function renderFilters() {
  filters.innerHTML = '';
  ['All', ...allStances()].forEach(stance => {
    const button = document.createElement('button');
    button.className = `stance-chip${stance === selectedStance ? ' active' : ''}`;
    button.textContent = stance;
    button.onclick = () => { selectedStance = stance; renderFilters(); renderRows(); };
    filters.append(button);
  });
}

function renderRows() {
  const today = todayName();
  const matches = departures
    .filter(item => !item.days || item.days.includes(today))
    .map(item => ({ ...item, due: minutesUntil(item.time) }))
    .filter(item => item.due >= -1)
    .filter(item => {
      const stanceMatch = selectedStance === 'All' || item.stance === selectedStance;
      const searchable = `${item.route} ${item.destination} ${item.via || ''} ${item.operator} ${item.stance}`.toLowerCase();
      return stanceMatch && searchable.includes(query.toLowerCase());
    })
    .sort((a,b) => a.due - b.due)
    .slice(0, 80);

  rows.innerHTML = '';
  if (!matches.length) {
    rows.innerHTML = '<div class="empty">No more Stagecoach departures are scheduled from Edinburgh Bus Station today.</div>';
    return;
  }

  matches.forEach(item => {
    const row = document.createElement('article');
    row.className = 'board-row';
    const dueText = item.due <= 1 ? 'Due by timetable' : `In ${item.due} mins`;
    row.innerHTML = `
      <div class="board-time">${item.time}</div>
      <div><span class="route">${item.route}</span></div>
      <div class="destination"><strong>${item.destination}</strong><span>${item.via || 'Scheduled service'}</span></div>
      <div class="operator">${item.operator}</div>
      <div class="stance" aria-label="Stance ${item.stance}">${item.stance}</div>
      <div class="status scheduled">${dueText}</div>`;
    rows.append(row);
  });
}

async function loadTimetable() {
  rows.innerHTML = '<div class="empty">Loading the official Stagecoach timetable…</div>';
  try {
    const response = await fetch(`data/edinburgh-scheduled.json?v=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    departures = Array.isArray(data.departures) ? data.departures : [];
    const generated = data.generated ? new Date(data.generated).toLocaleString('en-GB') : 'unknown';
    const notice = document.querySelector('.notice span:not(.pulse)');
    if (notice) notice.textContent = `Official Stagecoach scheduled data. Updated ${generated}. Check bustimes.org for live running.`;
    renderFilters();
    renderRows();
  } catch (error) {
    rows.innerHTML = '<div class="empty">The official timetable is still being generated. Refresh this page in a few minutes.</div>';
    console.error(error);
  }
}

document.querySelector('#boardSearch').addEventListener('input', event => { query = event.target.value.trim(); renderRows(); });
document.querySelector('#showAllStances').onclick = () => { selectedStance = 'All'; renderFilters(); renderRows(); };
document.querySelector('#refreshBoard').onclick = () => { updateClock(); loadTimetable(); };

updateClock();
setInterval(() => { updateClock(); renderRows(); }, 30000);
loadTimetable();
