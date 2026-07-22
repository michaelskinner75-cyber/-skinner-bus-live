const AREAS = ['All', 'Fife', 'Dundee', 'Perth', 'Angus', 'St Andrews', 'Edinburgh'];

// Demo records keep the interface usable before a production data feed is connected.
// Replace this array through data-adapter.js when the timetable/live backend is ready.
const departures = [
  { route:'X54', destination:'Dundee', stop:'Dunfermline Bus Station', area:'Fife', due:3, status:'live', detail:'Live', fleet:'26341' },
  { route:'7', destination:'Leven', stop:'Kirkcaldy Bus Station', area:'Fife', due:6, status:'delayed', detail:'4 min late', fleet:'37422' },
  { route:'39', destination:'Arbroath', stop:'Dundee Seagate', area:'Dundee', due:8, status:'live', detail:'Live', fleet:'27548' },
  { route:'16', destination:'Perth', stop:'Dundee Seagate', area:'Dundee', due:12, status:'scheduled', detail:'Scheduled', fleet:null },
  { route:'X7', destination:'Aberdeen', stop:'Arbroath Bus Station', area:'Angus', due:15, status:'live', detail:'Live', fleet:'50411' },
  { route:'X59', destination:'Edinburgh', stop:'St Andrews Bus Station', area:'St Andrews', due:19, status:'delayed', detail:'7 min late', fleet:'54276' },
  { route:'15', destination:'Crieff', stop:'Perth Bus Station', area:'Perth', due:22, status:'scheduled', detail:'Scheduled', fleet:null },
  { route:'X56', destination:'Perth', stop:'Ferrytoll Park & Ride', area:'Edinburgh', due:27, status:'live', detail:'Live', fleet:'26337' }
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
  const filtered = departures.filter(item => {
    const areaMatch = selectedArea === 'All' || item.area === selectedArea;
    const text = `${item.route} ${item.destination} ${item.stop} ${item.area}`.toLowerCase();
    return areaMatch && text.includes(query.toLowerCase());
  });

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No Stagecoach departures match that search.</div>';
    return;
  }

  filtered.forEach(item => {
    const node = template.content.cloneNode(true);
    node.querySelector('.route-badge').textContent = item.route;
    node.querySelector('h4').textContent = item.destination;
    node.querySelector('.stop-name').textContent = item.stop;
    const pill = node.querySelector('.status-pill');
    pill.textContent = item.detail;
    pill.classList.add(item.status);
    node.querySelector('.vehicle').textContent = item.fleet ? `Fleet ${item.fleet}` : 'Vehicle unavailable';
    node.querySelector('.time-block strong').textContent = item.due <= 1 ? 'Due' : item.due;
    node.querySelector('.time-block span').textContent = item.due <= 1 ? 'now' : 'mins';

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
    card.innerHTML = `<strong>${item.stop}</strong><span>${item.route} to ${item.destination}</span>`;
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

updateClock(); setInterval(updateClock, 30000); renderAreas(); renderDepartures(); renderFavourites();
