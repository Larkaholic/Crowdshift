// Shuttle booking modal logic
(function(){
  const ROUTES = {
    'city-circle': {
      name: 'City Circle Route',
      intervalMins: 10,
      baseFare: 30,
      terminals: [
        { id: 'cc-1', name: 'Session Road Terminal' },
        { id: 'cc-2', name: 'Burnham Park Terminal' },
        { id: 'cc-3', name: 'SM Baguio Terminal' },
      ],
      times: ['08:00','08:10','08:20','08:30','08:40','08:50','09:00','09:10','09:20','09:30'],
    },
    'tourist-spots': {
      name: 'Tourist Spots Shuttle',
      intervalMins: 20,
      baseFare: 50,
      terminals: [
        { id: 'ts-1', name: 'Botanical Garden Hub' },
        { id: 'ts-2', name: 'Mines View Hub' },
        { id: 'ts-3', name: 'Wright Park Hub' },
      ],
      times: ['08:00','08:20','08:40','09:00','09:20','09:40','10:00'],
    },
    'shopping-district': {
      name: 'Shopping District Loop',
      intervalMins: 12,
      baseFare: 35,
      terminals: [
        { id: 'sd-1', name: 'Session Road South' },
        { id: 'sd-2', name: 'Market Entrance' },
        { id: 'sd-3', name: 'SM Carpark Hub' },
      ],
      times: ['08:06','08:18','08:30','08:42','08:54','09:06','09:18','09:30'],
    }
  };

  const el = id => document.getElementById(id);
  const modal = el('shuttle-modal');

  function openModal(routeId){
    const route = ROUTES[routeId];
    if(!route) return;

    el('shuttle-title').textContent = `Book: ${route.name}`;
    el('shuttle-subtitle').textContent = `Every ${route.intervalMins} mins · Base fare ₱${route.baseFare}`;

    // terminals
    const termSel = el('shuttle-terminal');
    termSel.innerHTML = '';
    route.terminals.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      termSel.appendChild(opt);
    });

    // date default today
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    el('shuttle-date').value = `${yyyy}-${mm}-${dd}`;

    // time slots
    const timeSel = el('shuttle-time');
    timeSel.innerHTML = '';
    route.times.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      timeSel.appendChild(opt);
    });

    // reset fields
    el('shuttle-seats').value = 1;
    el('shuttle-payment').value = 'card';
    el('shuttle-notes').value = '';
    el('shuttle-feedback').textContent = '';

    // compute fare
    updateFare(routeId);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.focus();

    // attach confirm handler
    const confirm = el('shuttle-confirm');
    confirm.onclick = () => confirmBooking(routeId);
  }

  function updateFare(routeId){
    const route = ROUTES[routeId];
    const seats = parseInt(el('shuttle-seats').value || '1', 10);
    const payment = el('shuttle-payment').value;
    const multiplier = payment === 'cash' ? 1.0 : 0.9; // 10% off with Smart Card
    const total = Math.max(1, seats) * route.baseFare * multiplier;
    el('shuttle-fare').textContent = `Fare: ₱${total.toFixed(2)} (${seats} seat${seats>1?'s':''}${payment==='card'?', Smart Card discount applied':''})`;
  }

  function closeModal(){
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  function confirmBooking(routeId){
    const route = ROUTES[routeId];
    const terminalId = el('shuttle-terminal').value;
    const terminal = route.terminals.find(t=>t.id===terminalId)?.name || 'Selected Terminal';
    const date = el('shuttle-date').value;
    const time = el('shuttle-time').value;
    const seats = parseInt(el('shuttle-seats').value||'1', 10);
    const payment = el('shuttle-payment').value;

    if(!date || !time){
      el('shuttle-feedback').textContent = 'Please select date and time.';
      return;
    }

    el('shuttle-feedback').textContent = `Booked ${seats} seat(s) on ${route.name} at ${time}, ${date} from ${terminal}. Payment: ${payment==='card'?'Smart Card':'Cash'}.`;

    // Auto close after a short delay
    setTimeout(closeModal, 1400);
  }

  function init(){
    // wire open buttons
    document.querySelectorAll('.js-shuttle-book').forEach(btn => {
      btn.addEventListener('click', () => openModal(btn.dataset.routeId));
    });

    // updates
    ['shuttle-seats','shuttle-payment'].forEach(id => {
      el(id).addEventListener('change', () => {
        const open = document.getElementById('shuttle-title').textContent;
        const key = Object.keys(ROUTES).find(k => open.includes(ROUTES[k].name));
        if(key) updateFare(key);
      });
    });

    // close handlers
    el('shuttle-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if(e.target === modal) closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
