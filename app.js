const AREAS = ['All', 'Fife', 'Dundee', 'Perth', 'Angus', 'St Andrews', 'Edinburgh'];

// Scheduled-board starter data. These rows are not live vehicle predictions.
// The next data stage will replace this list with Stagecoach TransXChange records.
const departures = [
  { route:'X54', destination:'Dundee', stop:'Dunfermline Bus Station', area:'Fife', time:'06:55' },
  { route:'7', destination:'Leven', stop:'Kirkcaldy Bus Station', area:'Fife', time:'07:05' },
  { route:'39', destination:'Arbroath', stop:'Dundee Seagate', area:'Dundee', time:'07:15' },
  { route:'16', destination:'Perth', stop:'Dundee Seagate', area:'Dundee', time:'07:30' },
  { route:'X7', destination:'Aberdeen', stop:'Arbroath Bus Station', area:'Angus', time:'07:40' },
  { route:'X59', destination:'Edinburgh', stop:'St Andrews Bus Station', area:'St Andrews', time:'07:55' },
  { route:'15', destination:'Crieff', stop:'Perth Bus Station', area:'Perth', time:'08:10' },
  { route:'X56', destination:'Perth', stop:'Ferrytoll Park & Ride', area:'Edinburgh', time:'08:25' }
];

let selectedArea = 'All';
let query = '';
const saved = new Set(JSON.parse(localStorage.getItem('sbl-favourites') || '[]'));

const list = document.querySelector('#departureList');
const template = document.querySelector('#departureTemplate');
const areaChips = document.querySelector('#areaChips');
const favourites = document.querySelector('#favourites');

function updateClock() {
  const now = new Date();
  document.querySelector('#clock').textContent = now.toLocaleString('en-GB', {
    weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
  });
}

function minutesUntil(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const departure = new Date(now);
  departure.setHours(hours, minutes, 0, 0);
  if (departure < now) departure.setDate(departure.getDate() + 1);
  return Math.max(0, Math.ceil((departure - now) / 60000));
}

function liveSearchUrl(item) {
  return `https://bustimes.org/search?q=${encodeURIComponent(`${item.stop} ${item.route}`)}`;
}

function renderAreas() {
  areaChips.innerHTML = '';
  AREAS.forEach(area => {
    const button = document.createElement('button');
    button.className = `chip${area === selectedArea ? ' active' : ''}`;
    button.textContent = area;
    button.onclick = () => { selectedArea = area; renderAreas(); renderDepartures(); };
    areaChips.append(button);
  });
}

function keyFor(item) { return `${item.route}|${item.stop}|${item.destination}`; }

function renderDepartures() {
  const filtered = departures
    .map(item => ({ ...item, due: minutesUntil(item.time) }))
    .filter(item => {
      const areaMatch = selectedArea === 'All' || item.area === selectedArea;
      const text = `${item.route} ${item.destination} ${item.stop} ${item.area}`.toLowerCase();
      return areaMatch && text.includes(query.toLowerCase());
    })
    .sort((a, b) => a.due - b.due);

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No scheduled Stagecoach departures match that search.</div>';
    return;
  }

  filtered.forEach(item => {
    const node = template.content.cloneNode(true);
    node.querySelector('.route-badge').textContent = item.route;
    node.querySelector('h4').textContent = item.destination;
    node.querySelector('.stop-name').textContent = item.stop;
    const pill = node.querySelector('.status-pill');
    pill.textContent = 'Scheduled';
    pill.classList.add('scheduled');
    node.querySelector('.vehicle').textContent = `Timetable ${item.time}`;
    node.querySelector('.time-block strong').textContent = item.due <= 1 ? 'Due' : item.due;
    node.querySelector('.time-block span').textContent = item.due <= 1 ? 'scheduled' : 'mins';

    const liveLink = document.createElement('a');
    liveLink.className = 'live-check-link';
    liveLink.href = liveSearchUrl(item);
    liveLink.target = '_blank';
    liveLink.rel = 'noopener noreferrer';
    liveLink.textContent = 'Check live on bustimes.org ↗';
    node.querySelector('.meta-row').append(liveLink);

    const fav = node.querySelector('.favourite-button');
    const key = keyFor(item);
    if (saved.has(key)) { fav.textContent = '★'; fav.classList.add('saved'); }
    fav.onclick = () => {
      if (saved.has(key)) saved.delete(key); else saved.add(key);
      localStorage.setItem('sbl-favourites', JSON.stringify([...saved]));
      renderDepartures(); renderFavourites();
    };
    list.append(node);
  });
}

function renderFavourites() {
  favourites.innerHTML = '';
  const selected = departures.filter(d => saved.has(keyFor(d)));
  if (!selected.length) {
    favourites.innerHTML = '<div class="empty">Tap ☆ beside a departure to save it.</div>';
    return;
  }
  selected.forEach(item => {
    const card = document.createElement('button');
    card.className = 'favourite-card';
    card.innerHTML = `<strong>${item.stop}</strong><span>${item.route} to ${item.destination} · ${item.time}</span>`;
    card.onclick = () => { query = item.stop; document.querySelector('#searchInput').value = query; renderDepartures(); };
    favourites.append(card);
  });
}

document.querySelector('#searchInput').addEventListener('input', event => { query = event.target.value.trim(); renderDepartures(); });
document.querySelector('#clearSearch').onclick = () => { query = ''; document.querySelector('#searchInput').value = ''; renderDepartures(); };
document.querySelector('#refreshButton').onclick = () => { updateClock(); renderDepartures(); };
document.querySelector('#nearMeButton').onclick = () => {
  if (!navigator.geolocation) return alert('Location is not supported on this device.');
  navigator.geolocation.getCurrentPosition(
    pos => alert(`Location found: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}\nNearby-stop matching will connect to NaPTAN in the next data stage.`),
    () => alert('Location permission was not granted.')
  );
};
document.querySelector('#themeButton').onclick = () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('sbl-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
};
if (localStorage.getItem('sbl-theme') === 'dark') document.body.classList.add('dark');

updateClock();
setInterval(() => { updateClock(); renderDepartures(); }, 30000);
renderAreas(); renderDepartures(); renderFavourites();