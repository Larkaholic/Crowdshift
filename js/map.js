// Map module: handles Leaflet map and route rendering
// Minimal dependency: Leaflet + Leaflet Routing Machine (LRM)

const MapModule = (() => {
  let map; // Leaflet map instance
  let layers = []; // route layer refs
  let markers = [];
  let currentDest = null;

  const COLORS = {
    shortest: '#10b981', // emerald-500
    fastest: '#0ea5e9', // sky-500
    alternate: '#94a3b8', // slate-400
  };

  function ensureMap(containerId = 'route-map') {
    if (map) return map;
    const el = document.getElementById(containerId);
    if (!el) return null;
    map = L.map(el, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 20,
    }).addTo(map);
    map.setView([16.412, 120.593], 12);
    return map;
  }

  function clearRoutes() {
    layers.forEach(l => map && map.removeLayer(l));
    layers = [];
    markers.forEach(m => map && map.removeLayer(m));
    markers = [];
  }

  function addMarker(latlng, opts = {}) {
    const m = L.marker(latlng, opts).addTo(map);
    markers.push(m);
    return m;
  }

  function fitTo(latlngs) {
    if (!map) return;
    const all = latlngs.filter(Boolean);
    if (all.length) {
      const b = L.latLngBounds(all);
      map.fitBounds(b.pad(0.2));
    }
  }

  function summarizeRoute(geojson) {
    // LRM provides summary in control; here we compute basic distance/time if provided
    // Fallback to length estimate
    try {
      const coords = geojson.coordinates || [];
      let distKm = 0;
      for (let i = 1; i < coords.length; i++) {
        const a = L.latLng(coords[i - 1][1], coords[i - 1][0]);
        const b = L.latLng(coords[i][1], coords[i][0]);
        distKm += a.distanceTo(b) / 1000;
      }
      const avgKph = 24; // city avg
      const mins = Math.round((distKm / avgKph) * 60);
      return { distKm: distKm.toFixed(1), mins };
    } catch (e) {
      return { distKm: '?', mins: '?' };
    }
  }

  function renderRoutePolyline(coords, color) {
    const line = L.polyline(coords, { color, weight: 5, opacity: 0.9 }).addTo(map);
    layers.push(line);
    return line;
  }

  async function routeBetween(start, dest, opts = {}) {
    // Use OSRM demo via LRM; compute fastest, and synthesize shortest by tweaking weighting
    return new Promise((resolve, reject) => {
      const control = L.Routing.control({
        waypoints: [L.latLng(start[0], start[1]), L.latLng(dest[0], dest[1])],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
      })
        .on('routesfound', e => {
          resolve(e.routes);
          control.remove();
        })
        .on('routingerror', err => {
          control.remove();
          reject(err?.error || err);
        })
        .addTo(map);
    });
  }

  async function showRoutes({ start, dest, destName }) {
    ensureMap();
    clearRoutes();
    currentDest = destName;

    // Markers
    addMarker(start, { title: 'Start' });
    addMarker(dest, { title: destName });

    let routes = [];
    try {
      routes = await routeBetween(start, dest);
    } catch (e) {
      console.warn('Routing failed, falling back to straight line', e);
      const straight = [start, dest].map(([lat, lng]) => L.latLng(lat, lng));
      renderRoutePolyline(straight, COLORS.alternate);
      fitTo(straight);
      return [{ label: 'Alternate', color: COLORS.alternate, summary: { distKm: '?', mins: '?' } }];
    }

    // Sort to pick fastest (lowest time) and shortest (lowest distance)
    const fastest = [...routes].sort((a, b) => a.summary.totalTime - b.summary.totalTime)[0];
    const shortest = [...routes].sort((a, b) => a.summary.totalDistance - b.summary.totalDistance)[0];

    const fastestCoords = fastest.coordinates.map(c => [c.lat, c.lng]);
    const shortestCoords = shortest.coordinates.map(c => [c.lat, c.lng]);

    renderRoutePolyline(shortestCoords, COLORS.shortest);
    renderRoutePolyline(fastestCoords, COLORS.fastest);

    // Any additional as alternate
    routes.forEach(r => {
      if (r !== fastest && r !== shortest) {
        const coords = r.coordinates.map(c => [c.lat, c.lng]);
        renderRoutePolyline(coords, COLORS.alternate);
      }
    });

    fitTo([ ...shortestCoords, ...fastestCoords ]);

    const toKm = m => (m / 1000).toFixed(1);
    const toMin = s => Math.round(s / 60);

    return [
      { label: 'Shortest', color: COLORS.shortest, summary: { distKm: toKm(shortest.summary.totalDistance), mins: toMin(shortest.summary.totalTime) } },
      { label: 'Fastest', color: COLORS.fastest, summary: { distKm: toKm(fastest.summary.totalDistance), mins: toMin(fastest.summary.totalTime) } },
    ];
  }

  return {
    showRoutes,
  };
})();

window.MapModule = MapModule;
