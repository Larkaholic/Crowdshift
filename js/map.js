// Map module: handles Leaflet map and route rendering
// Minimal dependency: Leaflet + Leaflet Routing Machine (LRM)

const MapModule = (() => {
  let map; // Leaflet map instance
  let layers = []; // route layer refs
  let markers = [];
  let currentDest = null;
  let poiMarkers = [];

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
  poiMarkers.forEach(m => map && map.removeLayer(m));
  poiMarkers = [];
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

  async function routeBetweenFoot(start, dest){
    // Use OSRM foot profile
    return new Promise((resolve, reject) => {
      const control = L.Routing.control({
        waypoints: [L.latLng(start[0], start[1]), L.latLng(dest[0], dest[1])],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'foot' }),
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
      })
        .on('routesfound', e => { resolve(e.routes); control.remove(); })
        .on('routingerror', err => { control.remove(); reject(err?.error || err); })
        .addTo(map);
    });
  }

  async function showWalking({ start, dest, destName }){
    ensureMap();
    clearRoutes();
    currentDest = destName;

    addMarker(start, { title: 'Start' });
    addMarker(dest, { title: destName });

    try{
      const routes = await routeBetweenFoot(start, dest);
      const shortest = [...routes].sort((a,b)=>a.summary.totalDistance - b.summary.totalDistance)[0];
      const coords = shortest.coordinates.map(c=>[c.lat,c.lng]);
      // Compare to straight-line to detect big detours (e.g., due to one-way restrictions not relevant to walking)
      const directM = L.latLng(start[0], start[1]).distanceTo(L.latLng(dest[0], dest[1]));
      const detourRatio = shortest.summary.totalDistance / Math.max(1, directM);
      if(detourRatio > 1.8){
        // Fall back to direct line to "ignore" one-way constraints for walkers
        const straight = [start, dest].map(([lat,lng])=>L.latLng(lat,lng));
        renderRoutePolyline(straight, '#16a34a');
        fitTo(straight);
        const toKm = m => (m/1000).toFixed(1);
        return [ { label: 'Walking (Direct, ignores one-way)', color: '#16a34a', summary: { distKm: toKm(directM), mins: '?' } } ];
      }
      renderRoutePolyline(coords, '#16a34a'); // green for walking
      fitTo(coords);
      const toKm = m => (m/1000).toFixed(1);
      const toMin = s => Math.round(s/60);
      return [ { label: 'Walking (Shortest)', color: '#16a34a', summary: { distKm: toKm(shortest.summary.totalDistance), mins: toMin(shortest.summary.totalTime) } } ];
    }catch(e){
      const straight = [start, dest].map(([lat,lng])=>L.latLng(lat,lng));
      renderRoutePolyline(straight, COLORS.alternate);
      fitTo(straight);
      return [ { label: 'Walking (Alternate)', color: COLORS.alternate, summary: { distKm: '?', mins: '?' } } ];
    }
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

  // Multi-leg helpers
  function addPoiMarker(latlng, label, color = 'purple') {
    const icon = L.divIcon({
      className: 'poi-pin',
      html: `<div style="background:${color};color:white;border-radius:8px;padding:2px 6px;font-size:10px;box-shadow:0 1px 2px rgba(0,0,0,.2)">${label}</div>`,
      iconSize: [0, 0],
    });
    const mk = L.marker(latlng, { icon }).addTo(map);
    poiMarkers.push(mk);
    return mk;
  }

  function randomNearby(origin, count = 4, radiusMeters = 800) {
    const [lat, lng] = origin;
    const results = [];
    for (let i = 0; i < count; i++) {
      const dx = (Math.random() - 0.5) * (radiusMeters / 111320) * 2; // deg lat
      const dy = (Math.random() - 0.5) * (radiusMeters / (111320 * Math.cos(lat * Math.PI / 180))) * 2; // deg lng
      results.push([lat + dx, lng + dy]);
    }
    return results;
  }

  async function showViaTaxi({ start, dest, destName, stands }) {
    ensureMap();
    clearRoutes();
    currentDest = destName;

    addMarker(start, { title: 'You' });
    addMarker(dest, { title: destName });

    const taxiStands = (stands && stands.length ? stands : randomNearby(start, 5)).map((p, idx) => ({
      name: `Taxi Stand ${idx + 1}`,
      coords: p,
    }));

    // draw POIs
    taxiStands.forEach((s, i) => addPoiMarker(s.coords, `Taxi ${i + 1}`, '#9333ea'));

    // choose nearest stand by walking distance (approx straight-line fallback)
    let best = null;
    let bestDist = Infinity;
    taxiStands.forEach(s => {
      const d = L.latLng(start[0], start[1]).distanceTo(L.latLng(s.coords[0], s.coords[1]));
      if (d < bestDist) { bestDist = d; best = s; }
    });

    // route: start -> stand, stand -> dest
    try {
      const leg1 = await routeBetween(start, best.coords);
      const best1 = leg1.sort((a,b)=>a.summary.totalTime-b.summary.totalTime)[0];
      const leg2 = await routeBetween(best.coords, dest);
      const best2 = leg2.sort((a,b)=>a.summary.totalTime-b.summary.totalTime)[0];

      const coords1 = best1.coordinates.map(c => [c.lat, c.lng]);
      const coords2 = best2.coordinates.map(c => [c.lat, c.lng]);
      renderRoutePolyline(coords1, '#f59e0b'); // amber for access leg
      renderRoutePolyline(coords2, '#0ea5e9'); // sky for main leg
      fitTo([ ...coords1, ...coords2 ]);

      const toKm = m => (m / 1000).toFixed(1);
      const toMin = s => Math.round(s / 60);
      return {
        poi: taxiStands,
        routeItems: [
          { label: 'Walk to Taxi Stand', color: '#f59e0b', summary: { distKm: toKm(best1.summary.totalDistance), mins: toMin(best1.summary.totalTime) } },
          { label: 'Taxi to Destination', color: '#0ea5e9', summary: { distKm: toKm(best2.summary.totalDistance), mins: toMin(best2.summary.totalTime) } },
      ]
      };
    } catch (e) {
      const straight = [start, dest].map(([lat,lng])=>L.latLng(lat,lng));
      renderRoutePolyline(straight, COLORS.alternate);
      fitTo(straight);
      return { poi: taxiStands, routeItems: [ { label: 'Alternate', color: COLORS.alternate, summary: { distKm: '?', mins: '?' } } ] };
    }
  }

  async function showViaJeepney({ start, dest, destName, terminals }) {
    ensureMap();
    clearRoutes();
    currentDest = destName;

    addMarker(start, { title: 'You' });
    addMarker(dest, { title: destName });

    const jeeps = (terminals && terminals.length ? terminals : randomNearby(start, 6, 1200)).map((p, idx) => ({
      name: `Jeepney Terminal ${idx + 1}`,
      route: idx % 2 === 0 ? 'J1' : 'J2',
      coords: p,
    }));

    jeeps.forEach((j, i) => addPoiMarker(j.coords, `${j.route}`, '#16a34a'));

    // pick terminal nearest to start, and also somewhat towards dest by heuristic (min sum of distances)
    let best = null;
    let bestScore = Infinity;
    jeeps.forEach(j => {
      const d1 = L.latLng(start[0], start[1]).distanceTo(L.latLng(j.coords[0], j.coords[1]));
      const d2 = L.latLng(j.coords[0], j.coords[1]).distanceTo(L.latLng(dest[0], dest[1]));
      const score = d1 * 0.7 + d2 * 0.3;
      if (score < bestScore) { bestScore = score; best = j; }
    });

    try {
      const leg1 = await routeBetween(start, best.coords);
      const best1 = leg1.sort((a,b)=>a.summary.totalTime-b.summary.totalTime)[0];
      const leg2 = await routeBetween(best.coords, dest);
      const best2 = leg2.sort((a,b)=>a.summary.totalTime-b.summary.totalTime)[0];

      const coords1 = best1.coordinates.map(c => [c.lat, c.lng]);
      const coords2 = best2.coordinates.map(c => [c.lat, c.lng]);
      renderRoutePolyline(coords1, '#f59e0b'); // walk to terminal
      renderRoutePolyline(coords2, '#10b981'); // jeepney leg
      fitTo([ ...coords1, ...coords2 ]);

      const toKm = m => (m / 1000).toFixed(1);
      const toMin = s => Math.round(s / 60);
      return {
        poi: jeeps,
        routeItems: [
          { label: `Walk to ${best.route} Terminal`, color: '#f59e0b', summary: { distKm: toKm(best1.summary.totalDistance), mins: toMin(best1.summary.totalTime) } },
          { label: `${best.route} to Destination`, color: '#10b981', summary: { distKm: toKm(best2.summary.totalDistance), mins: toMin(best2.summary.totalTime) } },
        ]
      };
    } catch (e) {
      const straight = [start, dest].map(([lat,lng])=>L.latLng(lat,lng));
      renderRoutePolyline(straight, COLORS.alternate);
      fitTo(straight);
      return { poi: jeeps, routeItems: [ { label: 'Alternate', color: COLORS.alternate, summary: { distKm: '?', mins: '?' } } ] };
    }
  }

  return {
    showRoutes,
    showViaTaxi,
    showViaJeepney,
  showWalking,
  };
})();

window.MapModule = MapModule;
