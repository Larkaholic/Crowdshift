// Wire up Smart Recommendations interactions

(function () {
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

    let start = [16.4023, 120.5960]; // default city center

    if ('geolocation' in navigator) {
      // prefer cached geolocation when user clicks Use My Location
      const useBtn = document.getElementById('use-geoloc-btn');
      if (useBtn) {
        useBtn.onclick = () => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              start = [pos.coords.latitude, pos.coords.longitude];
              MapModule.showRoutes({ start, dest: [lat, lng], destName });
            },
            () => MapModule.showRoutes({ start, dest: [lat, lng], destName }),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        };
        useBtn.classList.remove('hidden');
      }

      // get a one-shot best-effort location immediately (non-blocking)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          start = [pos.coords.latitude, pos.coords.longitude];
          MapModule.showRoutes({ start, dest: [lat, lng], destName });
        },
        () => MapModule.showRoutes({ start, dest: [lat, lng], destName }),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      MapModule.showRoutes({ start, dest: [lat, lng], destName });
    }
  }

  function init() {
    document.querySelectorAll('.js-visit-now').forEach((btn) => {
      btn.addEventListener('click', () => handleVisit(btn));
    });

    const closeBtn = document.getElementById('close-map-btn');
    if (closeBtn) closeBtn.addEventListener('click', hidePanel);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
