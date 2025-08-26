// Profile modal: manage account, linked cards, and register via ID or QR
(function(){
  const modal = document.getElementById('profile-modal');
  const openBtn = document.getElementById('open-profile-btn');
  const closeBtn = document.getElementById('profile-close');
  const cardsList = document.getElementById('cards-list');
  const cardsEmpty = document.getElementById('cards-empty');
  const registerBtn = document.getElementById('card-register-btn');
  const registerPanel = document.getElementById('card-register-panel');
  const activeCardLabel = document.getElementById('active-card-label');

  let videoStream;
  let scanTimer;

  function open(){ modal.classList.remove('hidden'); modal.classList.add('flex'); loadProfile(); renderCards(); }
  function close(){ modal.classList.add('hidden'); modal.classList.remove('flex'); stopScan(); }

  function getProfile(){
    const data = JSON.parse(localStorage.getItem('profile') || '{}');
    if(!data.cards) data.cards = []; // [{id, label, default:boolean}]
    return data;
  }
  function saveProfile(data){ localStorage.setItem('profile', JSON.stringify(data)); }

  function loadProfile(){
    const p = getProfile();
    document.getElementById('prof-name').value = p.name || '';
    document.getElementById('prof-email').value = p.email || '';
  }

  function renderCards(){
    const p = getProfile();
    cardsList.innerHTML = '';
    if(!p.cards.length){ cardsEmpty.classList.remove('hidden'); return; }
    cardsEmpty.classList.add('hidden');
    p.cards.forEach((c) => {
      // ensure defaults
      c.type = c.type || 'Tourist';
      c.balance = typeof c.balance === 'number' ? c.balance : 0;
      c.status = c.status || 'Active';
      c.expiry = c.expiry || nextYear();
      c.lastTopup = c.lastTopup || null;

      const li = document.createElement('li');
      li.className = 'rounded-xl border border-slate-200 p-2 flex items-start justify-between gap-3';
      li.innerHTML = `<div class="min-w-0">
        <div class="text-[11px] font-semibold truncate">${c.label || 'Smart Card'} (${c.id})</div>
        <div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-600">
          <div><span class="text-slate-500">Type:</span> ${c.type}</div>
          <div><span class="text-slate-500">Status:</span> ${c.status}</div>
          <div><span class="text-slate-500">Balance:</span> <span class="card-balance">${formatCurrency(c.balance)}</span></div>
          <div><span class="text-slate-500">Expiry:</span> ${c.expiry}</div>
          <div class="col-span-2"><span class="text-slate-500">Last top‑up:</span> <span class="card-last-topup">${c.lastTopup ? c.lastTopup : '—'}</span></div>
        </div>
        <div class="mt-2 text-[10px] text-slate-500">${c.default ? 'Default card' : 'Linked'}</div>
      </div>
      <div class="flex shrink-0 flex-col items-stretch gap-2">
        <button class="card-topup rounded-lg border border-slate-200 px-2 py-1 text-[10px] hover:bg-slate-50">Top Up</button>
        <button class="set-default rounded-lg border border-slate-200 px-2 py-1 text-[10px] hover:bg-slate-50">Set Default</button>
        <button class="remove-card rounded-lg border border-rose-200 px-2 py-1 text-[10px] text-rose-600 hover:bg-rose-50">Remove</button>
      </div>`;
      li.querySelector('.set-default').addEventListener('click', () => setDefaultCard(c.id));
      li.querySelector('.remove-card').addEventListener('click', () => removeCard(c.id));
      li.querySelector('.card-topup').addEventListener('click', () => openTopupForCard(c.id));
      cardsList.appendChild(li);
    });
  }

  function formatCurrency(n){ return `₱${(n||0).toFixed(2)}`; }
  function nextYear(){ const d=new Date(); d.setFullYear(d.getFullYear()+1); const yyyy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
  function openTopupForCard(cardId){
    const btn = document.querySelector('.js-topup-open');
    if(btn) btn.click();
    window.__topupCardId = cardId;
  }

  function setDefaultCard(id){
    const p = getProfile();
    p.cards = p.cards.map(c => ({ ...c, default: c.id === id }));
    saveProfile(p);
    renderCards();
    const def = p.cards.find(c => c.default);
    if(activeCardLabel && def){ activeCardLabel.textContent = `Baguio Smart Card (${def.id})`; }
  }

  function removeCard(id){
    const p = getProfile();
    p.cards = p.cards.filter(c => c.id !== id);
    saveProfile(p);
    renderCards();
  }

  function addCard(id){
    if(!id) return;
    const p = getProfile();
    if(p.cards.some(c => c.id === id)) return;
    p.cards.push({ id, label: 'Smart Card', default: p.cards.length === 0, type: 'Tourist', balance: 0, status: 'Active', expiry: nextYear(), lastTopup: null });
    saveProfile(p);
    renderCards();
    const def = p.cards.find(c => c.default);
    if(activeCardLabel && def){ activeCardLabel.textContent = `Baguio Smart Card (${def.id})`; }
  }

  function startScan(){
    const vid = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
      videoStream = stream;
      vid.srcObject = stream;
      vid.play();
      scanTimer = setInterval(() => {
        if(vid.readyState === vid.HAVE_ENOUGH_DATA){
          canvas.height = vid.videoHeight;
          canvas.width = vid.videoWidth;
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR ? window.jsQR(imageData.data, imageData.width, imageData.height) : null;
          if(code && code.data){
            document.getElementById('qr-feedback').textContent = `Scanned: ${code.data}`;
            addCard(code.data.trim());
            stopScan();
          }
        }
      }, 500);
    }).catch(() => {
      document.getElementById('qr-feedback').textContent = 'Camera access denied.';
    });
  }

  function stopScan(){
    if(scanTimer) clearInterval(scanTimer);
    scanTimer = null;
    const vid = document.getElementById('qr-video');
    if(videoStream){ videoStream.getTracks().forEach(t => t.stop()); }
    videoStream = null;
    if(vid) { vid.pause(); vid.srcObject = null; }
  }

  function init(){
    if(openBtn) openBtn.addEventListener('click', open);
    if(closeBtn) closeBtn.addEventListener('click', close);
    if(registerBtn) registerBtn.addEventListener('click', () => registerPanel.classList.toggle('hidden'));

    const saveBtn = document.getElementById('prof-save');
    if(saveBtn){
      saveBtn.addEventListener('click', () => {
        const p = getProfile();
        p.name = document.getElementById('prof-name').value.trim();
        p.email = document.getElementById('prof-email').value.trim();
        saveProfile(p);
      });
    }

    const linkBtn = document.getElementById('card-link-btn');
    if(linkBtn){
      linkBtn.addEventListener('click', () => {
        const id = document.getElementById('card-id-input').value.trim();
        addCard(id);
      });
    }

    const qrStart = document.getElementById('qr-start');
    const qrStop = document.getElementById('qr-stop');
    if(qrStart) qrStart.addEventListener('click', startScan);
    if(qrStop) qrStop.addEventListener('click', stopScan);

    // Update card balance on top-up success
    window.addEventListener('topup:success', (e) => {
      const amount = e?.detail?.amount || 0;
      const p = getProfile();
      const targetId = window.__topupCardId || (p.cards.find(c => c.default)?.id);
      if(targetId){
        const card = p.cards.find(c => c.id === targetId);
        if(card){
          card.balance = (card.balance || 0) + amount;
          const today = new Date().toISOString().split('T')[0];
          card.lastTopup = `${today} +₱${amount.toFixed(2)}`;
          saveProfile(p);
          renderCards();
        }
      }
      window.__topupCardId = null;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
