// Quick Actions wiring: scroll to sections, open modals, and simple demos
(function(){
  const open = (el) => { el.classList.remove('hidden'); el.classList.add('flex'); };
  const close = (el) => { el.classList.add('hidden'); el.classList.remove('flex'); };

  function scrollToId(id){
    const t = document.getElementById(id);
    if(t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openTopup(){
    const modal = document.getElementById('topup-modal');
    if(!modal){ scrollToId('active-balance'); return; }
    open(modal);
  }

  function openSettings(){
    const m = document.getElementById('settings-modal');
    if(!m) return;
    // load opts from localStorage
    document.getElementById('opt-dark').checked = localStorage.getItem('opt-dark') === '1';
    document.getElementById('opt-autoreload').checked = localStorage.getItem('opt-autoreload') === '1';
    open(m);
  }

  function openHelp(){
    const m = document.getElementById('help-modal');
    if(!m) return;
    open(m);
  }

  function openMapPanel(){
    const panel = document.getElementById('route-map-panel');
    if(panel){
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      scrollToId('smart-recommendations');
    }
  }

  function init(){
    document.querySelectorAll('.js-qa').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        switch(action){
          case 'topup':
            openTopup();
            break;
          case 'buy-card':
            scrollToId('smart-card-options');
            break;
          case 'bus-routes':
            scrollToId('shuttle-routes');
            break;
          case 'parking':
            scrollToId('parking-availability');
            break;
          case 'book-tour':
            scrollToId('smart-recommendations');
            break;
          case 'map':
            openMapPanel();
            break;
          case 'settings':
            openSettings();
            break;
          case 'help':
            openHelp();
            break;
        }
      });
    });

    // settings modal events
    const settings = document.getElementById('settings-modal');
    if(settings){
      document.getElementById('settings-save').addEventListener('click', () => {
        localStorage.setItem('opt-dark', document.getElementById('opt-dark').checked ? '1':'0');
        localStorage.setItem('opt-autoreload', document.getElementById('opt-autoreload').checked ? '1':'0');
        close(settings);
      });
      settings.querySelector('.js-close-settings').addEventListener('click', () => close(settings));
      settings.addEventListener('click', (e) => { if(e.target === settings) close(settings); });
    }

    // help modal events
    const help = document.getElementById('help-modal');
    if(help){
      help.querySelector('.js-close-help').addEventListener('click', () => close(help));
      help.addEventListener('click', (e) => { if(e.target === help) close(help); });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
