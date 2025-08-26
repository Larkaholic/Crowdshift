// City Status analytics: compute active tourists and hotspots
(function(){
  const ACTIVE_ID = 'active-tourists-count';
  const HOTSPOT_ID = 'hotspots-active-count';
  const REFRESH_ID = 'city-refresh';

  async function loadSpots(){
    try {
      const res = await fetch('/analytics/spots.json', { cache: 'no-store' });
      if(!res.ok) throw new Error('Failed to load spots');
      const data = await res.json();
      return data?.spots || [];
    } catch (e) {
      console.warn('Analytics load error', e);
      return [];
    }
  }

  function computeTotals(spots){
    const totalActive = spots.reduce((sum, s) => sum + (s.active||0), 0);
    // Hotspot definition: active occupancy >= 70% of capacity
    const isHot = s => s.capacity > 0 && (s.active || 0) / s.capacity >= 0.7;
    const hotCount = spots.filter(isHot).length;
    const totalSpots = spots.length;
    return { totalActive, hotCount, totalSpots };
  }

  function formatNumber(n){
    return n.toLocaleString('en-PH');
  }

  function render({ totalActive, hotCount, totalSpots }){
    const activeEl = document.getElementById(ACTIVE_ID);
    const hotEl = document.getElementById(HOTSPOT_ID);
    if(activeEl) activeEl.textContent = formatNumber(totalActive);
    if(hotEl) hotEl.textContent = `${hotCount}/${totalSpots}`;
  }

  async function refresh(){
    const spots = await loadSpots();
    render(computeTotals(spots));
  }

  function init(){
    const btn = document.getElementById(REFRESH_ID);
    if(btn) btn.addEventListener('click', refresh);
    // initial load
    refresh();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
