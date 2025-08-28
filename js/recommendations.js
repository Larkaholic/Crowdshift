// Wire up Smart Recommendations interactions

(function () {
  let current = {
  start: [16.4023, 120.5960],
    dest: null,
    destName: null,
    mode: 'private',
  };

  function setActiveModeBtn(mode) {
    document.querySelectorAll('#mode-switch .mode-btn').forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('bg-slate-100');
      } else {
        btn.classList.remove('bg-slate-100');
      }
    });
  }

  function renderRouteList(items) {
    const list = document.getElementById('route-list');
    if (!list) return;
    list.innerHTML = '';
    (items || []).forEach(item => {
      const li = document.createElement('li');
      li.className = 'rounded-lg border border-slate-100 p-2';
      li.innerHTML = `<div class="flex items-center justify-between">
        <div class="text-[11px] font-medium" style="color:${item.color}">${item.label}</div>
        <div class="text-[10px] text-slate-600">${item.summary?.distKm ?? '?'} km · ${item.summary?.mins ?? '?'} mins</div>
      </div>`;
      list.appendChild(li);
    });
  }

  function showPoiList(title, items, onPick) {
    const sec = document.getElementById('poi-section');
    const t = document.getElementById('poi-title');
    const ul = document.getElementById('poi-list');
    if (!sec || !t || !ul) return;
    if (!items || !items.length) {
      sec.classList.add('hidden');
      return;
    }
    t.textContent = title;
    ul.innerHTML = '';
    items.forEach((it, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<button class="w-full rounded-lg border border-slate-100 p-2 text-left hover:bg-slate-50">
        <div class="text-[11px] font-semibold">${it.name || it.route || 'Option ' + (idx+1)}</div>
        <div class="text-[10px] text-slate-500">${it.route ? 'Route ' + it.route + ' terminal' : 'Stand nearby'}</div>
      </button>`;
      const btn = li.querySelector('button');
      btn.addEventListener('click', () => onPick && onPick(it));
      ul.appendChild(li);
    });
    sec.classList.remove('hidden');
  }

  function showPanel() {
    const panel = document.getElementById('route-map-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    // Try to position panel near recommendations by scrolling into view
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hidePanel() {
    const panel = document.getElementById('route-map-panel');
    if (!panel) return;
    panel.classList.add('hidden');
  }

  async function handleVisit(btn) {
    const lat = parseFloat(btn.dataset.lat);
    const lng = parseFloat(btn.dataset.lng);
    const destName = btn.dataset.dest || 'Destination';

    const title = document.getElementById('route-dest-title');
    if (title) title.textContent = `Routes to ${destName}`;

    showPanel();

    let start = current.start; // default city center

    current.dest = [lat, lng];
    current.destName = destName;

    if ('geolocation' in navigator) {
      // prefer cached geolocation when user clicks Use My Location
      const useBtn = document.getElementById('use-geoloc-btn');
      if (useBtn) {
        useBtn.onclick = () => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              start = [pos.coords.latitude, pos.coords.longitude];
              current.start = start;
              runModeRouting();
            },
            () => runModeRouting(),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        };
        useBtn.classList.remove('hidden');
      }

      // get a one-shot best-effort location immediately (non-blocking)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          start = [pos.coords.latitude, pos.coords.longitude];
          current.start = start;
          runModeRouting();
        },
        () => runModeRouting(),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      runModeRouting();
    }
  }

  async function runModeRouting() {
    const { start, dest, destName, mode } = current;
    if (!dest) return;
    if (mode === 'private') {
      const items = await MapModule.showRoutes({ start, dest, destName });
      renderRouteList(items);
      showPoiList('', [], null);
    } else if (mode === 'taxi') {
      const res = await MapModule.showViaTaxi({ start, dest, destName });
      renderRouteList(res.routeItems);
      showPoiList('Taxi Stands', res.poi, (picked) => {
        // reroute using picked stand
        MapModule.showViaTaxi({ start, dest, destName, stands: [picked.coords] }).then(r => {
          renderRouteList(r.routeItems);
        });
      });
    } else if (mode === 'jeepney') {
      const res = await MapModule.showViaJeepney({ start, dest, destName });
      renderRouteList(res.routeItems);
      showPoiList('Jeepney Terminals', res.poi, (picked) => {
        MapModule.showViaJeepney({ start, dest, destName, terminals: [picked.coords] }).then(r => {
          renderRouteList(r.routeItems);
        });
      });
    } else if (mode === 'walking') {
      const items = await MapModule.showWalking({ start, dest, destName });
      renderRouteList(items);
      showPoiList('', [], null);
    }
  }

  function init() {
    // pick up best-effort default start if available (set by places.js)
    if (Array.isArray(window.__defaultStart)) {
      current.start = window.__defaultStart;
    }

    // Delegate to support dynamically injected buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.js-visit-now');
      if (btn) {
        e.preventDefault();
        handleVisit(btn);
      }
    });

    const closeBtn = document.getElementById('close-map-btn');
    if (closeBtn) closeBtn.addEventListener('click', hidePanel);

    // Mode switching
    document.querySelectorAll('#mode-switch .mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        current.mode = btn.dataset.mode;
        setActiveModeBtn(current.mode);
        runModeRouting();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
