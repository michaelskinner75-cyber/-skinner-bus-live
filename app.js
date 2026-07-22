const STANCES = { X55: '3', X58: '4', X56: '5', X61: '5', X59: '6', X59A: '6' };
let data = [];
let filter = 'all';
let query = '';

const $ = (selector) => document.querySelector(selector);
const datePicker = $('#datePicker');
const augustStart = '2026-08-01';
const augustEnd = '2026-08-31';

function defaultDate() {
  const iso = new Date().toISOString().slice(0, 10);
  return iso >= augustStart && iso <= augustEnd ? iso : augustStart;
}

datePicker.value = defaultDate();

function keyFor(journey) {
  const id = journey.id || [journey.time, journey.route, journey.destination, journey.stance].join('|');
  return `${datePicker.value}|${id}`;
}

function seenSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('edinburgh-seen') || '[]'));
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  localStorage.setItem('edinburgh-seen', JSON.stringify([...set]));
}

function runsForDate() {
  const selectedDate = datePicker.value;
  return data
    .filter((journey) => !journey.date || journey.date === selectedDate)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
}

function halbeathNote(journey) {
  const destination = String(journey.destination || '').toLowerCase();
  const stopNames = (journey.stops || []).map((stop) => String(stop.name || stop.stop || '').toLowerCase());
  if (destination.includes('halbeath')) return 'Terminates at Halbeath';
  if (stopNames.some((name) => name.includes('halbeath'))) return 'Via Halbeath';
  return 'Does not serve Halbeath';
}

function render() {
  const seen = seenSet();
  const all = runsForDate();
  const matches = all.filter((journey) => {
    const isSeen = seen.has(keyFor(journey));
    const filterMatch = filter === 'all' || (filter === 'seen' && isSeen) || (filter === 'unseen' && !isSeen);
    const text = `${journey.route || ''} ${journey.destination || ''} ${journey.via || ''}`.toLowerCase();
    return filterMatch && text.includes(query.toLowerCase());
  });

  $('#seenCount').textContent = all.filter((journey) => seen.has(keyFor(journey))).length;
  $('#totalCount').textContent = all.length;
  $('#remainingCount').textContent = all.filter((journey) => !seen.has(keyFor(journey))).length;

  const list = $('#departureList');
  list.innerHTML = '';

  if (!matches.length) {
    list.innerHTML = `<div class="empty">${all.length ? 'No departures match this filter.' : 'No Stagecoach timetable departures have been imported for this date.'}</div>`;
    return;
  }

  matches.forEach((journey) => {
    const isSeen = seen.has(keyFor(journey));
    const note = halbeathNote(journey);
    const card = document.createElement('article');
    card.className = `departure${isSeen ? ' seen' : ''}`;
    card.innerHTML = `
      <div class="time">${journey.time || '--:--'}</div>
      <div class="route">${journey.route || '?'}</div>
      <div class="details">
        <button type="button">
          <strong>${journey.destination || 'Destination not published'}</strong>
          <small>${journey.via ? `via ${journey.via} · ` : ''}Tap for all stops</small>
          <div class="badges"><span class="badge">Scheduled</span><span class="badge halbeath">${note}</span></div>
        </button>
      </div>
      <div class="stance" title="Stance">${journey.stance || STANCES[journey.route] || '?'}</div>
      <div class="seen-control"><label><input type="checkbox" ${isSeen ? 'checked' : ''}> Seen</label></div>`;

    card.querySelector('.details button').addEventListener('click', () => openJourney(journey, note));
    card.querySelector('input').addEventListener('change', (event) => {
      const current = seenSet();
      if (event.target.checked) current.add(keyFor(journey));
      else current.delete(keyFor(journey));
      saveSeen(current);
      render();
    });
    list.append(card);
  });
}

function openJourney(journey, note) {
  $('#dialogMeta').textContent = `${journey.time || ''} · Service ${journey.route || ''} · Stance ${journey.stance || STANCES[journey.route] || 'not published'}`;
  $('#dialogTitle').textContent = journey.destination || 'Journey';
  $('#halbeathDetail').textContent = note;
  const stopList = $('#stopList');
  stopList.innerHTML = '';
  const stops = journey.stops || [];
  if (!stops.length) {
    stopList.innerHTML = '<li>Stop-by-stop pattern has not yet been imported for this journey.</li>';
  } else {
    stops.forEach((stop) => {
      const item = document.createElement('li');
      item.innerHTML = `${stop.name || stop.stop || ''}${stop.time ? `<time>${stop.time}</time>` : ''}`;
      stopList.append(item);
    });
  }
  $('#liveLink').href = journey.liveUrl || `https://bustimes.org/search?q=${encodeURIComponent(`${journey.route || ''} Edinburgh Bus Station`)}`;
  $('#journeyDialog').showModal();
}

async function loadTimetable() {
  const notice = $('#dataNotice');
  notice.textContent = 'Checking the published Stagecoach timetable…';
  try {
    const response = await fetch(`data/edinburgh-stagecoach.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    data = Array.isArray(json) ? json : Array.isArray(json.departures) ? json.departures : [];
    if (data.length) {
      notice.textContent = `Published scheduled timetable loaded: ${data.length} journey records. Times are scheduled, not live.`;
    } else {
      notice.textContent = 'The timetable file is connected, but it currently contains no Edinburgh Stagecoach departures. The importer still needs valid timetable records.';
    }
  } catch (error) {
    console.error('Timetable load failed:', error);
    notice.textContent = 'The timetable file could not be loaded. Refresh the page after GitHub Pages finishes updating.';
  }
  render();
}

function updateClock() {
  const now = new Date();
  $('#clock').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  $('#todayLabel').textContent = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

$('#search').addEventListener('input', (event) => {
  query = event.target.value.trim();
  render();
});

datePicker.addEventListener('change', render);

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    render();
  });
});

$('#clearChecks').addEventListener('click', () => {
  if (!confirm(`Clear all Seen checks for ${datePicker.value}?`)) return;
  const current = seenSet();
  [...current].filter((item) => item.startsWith(`${datePicker.value}|`)).forEach((item) => current.delete(item));
  saveSeen(current);
  render();
});

$('#closeDialog').addEventListener('click', () => $('#journeyDialog').close());

updateClock();
setInterval(updateClock, 30000);
loadTimetable();
