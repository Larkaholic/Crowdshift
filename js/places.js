// Places (categorized POIs) rendering for Smart Recommendations
(function(){
  // Categories and sample POIs around Baguio (mock data)
  const CATEGORIES = [
    { id: 'pharmacy', label: 'Pharmacy', color: '#0ea5e9', icon: '💊' },
    { id: 'bank', label: 'ATM/Bank', color: '#10b981', icon: '🏧' },
    { id: 'market', label: 'Market', color: '#f59e0b', icon: '🧺' },
    { id: 'mall', label: 'Mall', color: '#8b5cf6', icon: '🏬' },
    { id: 'food', label: 'Restaurants/Fastfood', color: '#ef4444', icon: '🍔' },
  ];

  const DEFAULT_CENTER = [16.412, 120.593];

  // Mock dataset. Each item: { name, lat, lng, distKm, crowd: 'Low'|'Moderate'|'High', addr }
  const DATA = {
    pharmacy: [
      { name: 'Mercury Drug - Session Rd', lat: 16.4129, lng: 120.5964, distKm: 0.5, crowd: 'Moderate', addr: 'Session Road' },
      { name: 'Rose Pharmacy - SM Baguio', lat: 16.4099, lng: 120.5987, distKm: 1.0, crowd: 'Low', addr: 'SM Baguio' },
      { name: 'Watsons - Abanao', lat: 16.4139, lng: 120.5952, distKm: 0.8, crowd: 'Low', addr: 'Abanao St' },
    ],
    bank: [
      { name: 'BPI ATM - Session Rd', lat: 16.4118, lng: 120.5961, distKm: 0.4, crowd: 'Low', addr: 'Session Road' },
      { name: 'BDO ATM - SM Baguio', lat: 16.4098, lng: 120.5985, distKm: 1.0, crowd: 'Moderate', addr: 'SM Baguio' },
      { name: 'Landbank - Gov. Park', lat: 16.4149, lng: 120.5946, distKm: 0.9, crowd: 'Low', addr: 'Gov. Park Rd' },
    ],
    market: [
      { name: 'Baguio City Public Market', lat: 16.4168, lng: 120.5957, distKm: 1.4, crowd: 'High', addr: 'Magsaysay Ave' },
      { name: 'Hilltop Market', lat: 16.4176, lng: 120.5941, distKm: 1.6, crowd: 'Moderate', addr: 'Hilltop' },
      { name: 'Slaughterhouse Market', lat: 16.4304, lng: 120.5980, distKm: 3.1, crowd: 'Low', addr: 'Naguilian Rd' },
    ],
    mall: [
      { name: 'SM City Baguio', lat: 16.4096, lng: 120.5986, distKm: 1.1, crowd: 'High', addr: 'Luneta Hill' },
      { name: 'Porta Vaga Mall', lat: 16.4142, lng: 120.5967, distKm: 0.9, crowd: 'Moderate', addr: 'Session Road' },
      { name: 'Center Mall', lat: 16.4161, lng: 120.5964, distKm: 1.3, crowd: 'Moderate', addr: 'Magsaysay Ave' },
    ],
    food: [
      { name: 'Good Taste - Otek', lat: 16.4119, lng: 120.5965, distKm: 0.6, crowd: 'High', addr: 'Otek St' },
      { name: 'Jollibee - Session Rd', lat: 16.4123, lng: 120.5960, distKm: 0.4, crowd: 'Moderate', addr: 'Session Road' },
      { name: "McDonald's - Gov. Pack", lat: 16.4148, lng: 120.5950, distKm: 0.9, crowd: 'Moderate', addr: 'Gov. Pack Rd' },
      { name: 'Ketchup Food Community', lat: 16.4066, lng: 120.6135, distKm: 3.1, crowd: 'Low', addr: 'Romulo Dr' },
    ],
  };

  function pill(crowd){
    const map = { Low: ['bg-emerald-50','text-emerald-600','bg-emerald-500'], Moderate: ['bg-amber-50','text-amber-600','bg-amber-500'], High: ['bg-rose-50','text-rose-600','bg-rose-500'] };
    const [bg, text, dot] = map[crowd] || map.Moderate;
    return `<div class="inline-flex items-center gap-1 rounded-full ${bg} px-2 py-1 text-[10px] font-medium ${text}">` +
           `<span class="h-1.5 w-1.5 rounded-full ${dot}"></span> ${crowd}</div>`;
  }

  function itemCard(cat, it){
    return `
      <div class="rounded-xl border border-slate-100 p-3">
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs font-semibold">${it.name}</div>
            <div class="mt-0.5 text-[10px] text-slate-500">${cat.label} · ${it.distKm} km</div>
            <div class="mt-1 text-[10px] text-slate-400 truncate">${it.addr}</div>
          </div>
          <div class="text-right">
            ${pill(it.crowd)}
            <div class="mt-1 text-[10px] text-slate-400">ETA varies</div>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <button class="js-visit-now rounded-lg bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-brand-700" data-lat="${it.lat}" data-lng="${it.lng}" data-dest="${it.name}">Visit</button>
          <a href="#route-map-panel" class="rounded-lg border border-slate-200 px-2 py-1 text-[10px] hover:bg-slate-50">Details</a>
        </div>
      </div>`;
  }

  function renderTabs(active){
    const tabs = document.getElementById('cat-tabs');
    if(!tabs) return;
    // Ensure horizontal scroll on small screens
    tabs.classList.add('overflow-x-auto', 'whitespace-nowrap');
    // Fallback inline styles for robustness (in case Tailwind classes aren't applied on this page)
    tabs.style.overflowX = 'auto';
    tabs.style.whiteSpace = 'nowrap';
    tabs.style.webkitOverflowScrolling = 'touch';
    tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const b = document.createElement('button');
      b.className = 'inline-flex items-center rounded-lg border border-slate-200 px-2 py-1 text-[10px] hover:bg-slate-50 mr-2 shrink-0';
      if(cat.id === active) b.classList.add('bg-slate-100');
      b.dataset.cat = cat.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', cat.id === active ? 'true' : 'false');
      b.innerHTML = `<span style="color:${cat.color}">${cat.icon}</span> ${cat.label}`;
      b.addEventListener('click', () => switchCategory(cat.id));
      tabs.appendChild(b);
    });
  }

  function switchCategory(catId){
    const grid = document.getElementById('reco-grid');
    const meta = document.getElementById('reco-meta');
    if(!grid) return;
  renderTabs(catId);
    const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
    const items = DATA[cat.id] || [];
    grid.innerHTML = items.map(it => itemCard(cat, it)).join('');
    // Attach Visit handlers (recommendations.js listens for .js-visit-now at DOMContentLoaded)
    // No extra wiring needed here.
    if(meta) meta.textContent = `${items.length} places in ${cat.label} · Updated just now`;
  }

  function guessStart(){
    return new Promise((resolve) => {
      if(!('geolocation' in navigator)) return resolve(DEFAULT_CENTER);
      navigator.geolocation.getCurrentPosition(
        pos => resolve([pos.coords.latitude, pos.coords.longitude]),
        () => resolve(DEFAULT_CENTER),
        { enableHighAccuracy: true, timeout: 4000 }
      );
    });
  }

  function init(){
    const refresh = document.getElementById('reco-refresh');
    if(refresh){
      refresh.addEventListener('click', () => {
        // For now, just re-switch current category to emulate refresh
        const active = document.querySelector('#cat-tabs button.bg-slate-100')?.dataset?.cat || CATEGORIES[0].id;
        switchCategory(active);
      });
    }

    // Initialize with nearest-based default (we keep Pharmacy first)
    renderTabs(CATEGORIES[0].id);
    switchCategory(CATEGORIES[0].id);

    // Store a best-effort start location for recommendations.js defaults
    guessStart().then((coords) => {
      window.__defaultStart = coords;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
