// Scheduled-board starter records. These are not live predictions.
// Replace this list with processed Stagecoach/Traveline timetable data.
const departures = [
  { time:'06:35', route:'X55', destination:'Dunfermline', via:'Ferrytoll', operator:'Stagecoach', stance:'1' },
  { time:'06:45', route:'X59', destination:'St Andrews', via:'Glenrothes', operator:'Stagecoach', stance:'2' },
  { time:'06:55', route:'X61', destination:'Kirkcaldy', via:'Halbeath P&R', operator:'Stagecoach', stance:'3' },
  { time:'07:05', route:'X56', destination:'Perth', via:'Dunfermline', operator:'Stagecoach', stance:'4' },
  { time:'07:15', route:'909', destination:'Stirling', via:'Bo’ness', operator:'Scottish Citylink', stance:'5' },
  { time:'07:25', route:'900', destination:'Glasgow', via:'Harthill', operator:'Scottish Citylink', stance:'6' },
  { time:'07:40', route:'M90', destination:'Inverness', via:'Perth', operator:'Scottish Citylink', stance:'7' },
  { time:'07:50', route:'X60', destination:'St Andrews', via:'Leven', operator:'Stagecoach', stance:'8' },
  { time:'08:00', route:'X58', destination:'Leven', via:'Kirkcaldy', operator:'Stagecoach', stance:'9' },
  { time:'08:10', route:'X54', destination:'Dundee', via:'Glenrothes', operator:'Stagecoach', stance:'10' }
];

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
  if (departure < now) departure.setDate(departure.getDate() + 1);
  return Math.ceil((departure - now) / 60000);
}

function allStances() {
  return [...new Set(departures.map(item => item.stance))].sort((a,b) => a.localeCompare(b, undefined, { numeric:true }));
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
  const matches = departures
    .map(item => ({ ...item, due: minutesUntil(item.time) }))
    .filter(item => {
      const stanceMatch = selectedStance === 'All' || item.stance === selectedStance;
      const searchable = `${item.route} ${item.destination} ${item.via} ${item.operator} ${item.stance}`.toLowerCase();
      return stanceMatch && searchable.includes(query.toLowerCase());
    })
    .sort((a,b) => a.due - b.due);

  rows.innerHTML = '';
  if (!matches.length) {
    rows.innerHTML = '<div class="empty">No scheduled departures match this search or stance.</div>';
    return;
  }

  matches.forEach(item => {
    const row = document.createElement('article');
    row.className = 'board-row';
    row.innerHTML = `
      <div class="board-time">${item.time}</div>
      <div><span class="route">${item.route}</span></div>
      <div class="destination"><strong>${item.destination}</strong><span>via ${item.via}</span></div>
      <div class="operator">${item.operator}</div>
      <div class="stance" aria-label="Stance ${item.stance}">${item.stance}</div>
      <div class="status scheduled">${item.due <= 1 ? 'Due by timetable' : `In ${item.due} mins`}</div>`;
    rows.append(row);
  });
}

document.querySelector('#boardSearch').addEventListener('input', event => { query = event.target.value.trim(); renderRows(); });
document.querySelector('#showAllStances').onclick = () => { selectedStance = 'All'; renderFilters(); renderRows(); };
document.querySelector('#refreshBoard').onclick = () => { updateClock(); renderRows(); };

updateClock();
setInterval(() => { updateClock(); renderRows(); }, 30000);
renderFilters();
renderRows();