// Top Up modal multi-step flow, inspired by common transit cards (Oyster/Octopus/EZ-Link)
(function(){
  const modal = document.getElementById('topup-modal');
  const steps = Array.from(document.querySelectorAll('#topup-modal .topup-step'));
  const el = id => document.getElementById(id);

  const state = {
    step: 1,
    amount: 0,
    email: '',
    method: 'card',
    autoReload: false,
  };

  function showStep(n){
    state.step = n;
    steps.forEach(s => s.classList.toggle('hidden', parseInt(s.dataset.step,10) !== n));
    const sub = el('topup-subtitle');
    if(n===1) sub.textContent = 'Choose or enter an amount';
    if(n===2) sub.textContent = 'Select payment method';
    if(n===3) sub.textContent = 'Provide payment details';
    if(n===4) sub.textContent = 'Review and confirm';
  }

  function openTopup(prefillAmt){
    if(prefillAmt) {
      state.amount = parseInt(prefillAmt, 10) || 0;
    } else {
      state.amount = 0;
    }
    el('tp-amount').value = state.amount || '';
    el('tp-email').value = '';
    el('tp-autoreload').checked = false;
    document.querySelector('input[name="tp-method"][value="card"]').checked = true;
    switchMethod('card');
    showStep(1);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeTopup(){
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  function nextFrom1(){
    const custom = parseInt(el('tp-amount').value || '0', 10);
    const chosen = isNaN(custom) || custom <= 0 ? state.amount : custom;
    if(!chosen || chosen < 50){
      alert('Minimum top up is ₱50.');
      return;
    }
    state.amount = Math.round(chosen);
    state.email = el('tp-email').value.trim();
    showStep(2);
  }

  function switchMethod(m){
    state.method = m;
    el('tp-card-fields').classList.toggle('hidden', m !== 'card');
    el('tp-ewallet-fields').classList.toggle('hidden', m !== 'ewallet');
    el('tp-kiosk-fields').classList.toggle('hidden', m !== 'kiosk');
  }

  function nextFrom2(){
    const sel = document.querySelector('input[name="tp-method"]:checked');
    switchMethod(sel?.value || 'card');
    state.autoReload = el('tp-autoreload').checked;
    showStep(3);
  }

  function nextFrom3(){
    // For demo, minimal validation for card
    if(state.method === 'card'){
      const num = el('tp-card-number').value.replace(/\s+/g,'');
      const exp = el('tp-card-exp').value.trim();
      const cvv = el('tp-card-cvv').value.trim();
      const name = el('tp-card-name').value.trim();
      if(num.length < 12 || !/^(0[1-9]|1[0-2])\/(\d{2})$/.test(exp) || cvv.length < 3 || !name){
        alert('Please enter valid card details.');
        return;
      }
    }

    // Review
    const feeRate = state.method === 'card' || state.method === 'ewallet' ? 0.015 : 0;
    const fees = state.amount * feeRate;
    const total = state.amount - fees;
    el('tp-review').innerHTML = `
      <div class="flex items-center justify-between"><span>Amount</span><span>₱${state.amount.toFixed(2)}</span></div>
      <div class="flex items-center justify-between"><span>Method</span><span>${state.method === 'card' ? 'Card' : state.method === 'ewallet' ? 'E‑Wallet' : 'Kiosk'}</span></div>
      <div class="flex items-center justify-between"><span>Fees</span><span>₱${fees.toFixed(2)}</span></div>
      <div class="flex items-center justify-between font-semibold"><span>Total</span><span>₱${total.toFixed(2)}</span></div>
      <div class="text-[10px] text-slate-500">${state.autoReload ? 'Auto‑reload enabled' : 'Auto‑reload off'}${state.email ? ' · Receipt to ' + state.email : ''}</div>
    `;
    showStep(4);
  }

  function confirmTopup(){
    el('tp-feedback').textContent = 'Processing payment...';
    setTimeout(() => {
      el('tp-feedback').textContent = 'Success! Balance updated.';
      // Update visible balance
      const balEl = document.getElementById('balance-amount');
      if(balEl){
        const num = parseFloat(balEl.textContent.replace(/[^0-9.]/g,'')) || 0;
        const newBal = num + state.amount;
        balEl.textContent = `₱${newBal.toFixed(2)}`;
      }
      // Notify others (e.g., profile) about top-up success
      try {
        window.dispatchEvent(new CustomEvent('topup:success', { detail: { amount: state.amount } }));
      } catch(_) {}
      setTimeout(closeTopup, 1000);
    }, 1000);
  }

  function init(){
    // open triggers
    document.querySelectorAll('.js-topup-open').forEach(btn => {
      btn.addEventListener('click', () => openTopup(btn.dataset.amount));
    });

    // quick amounts
    document.querySelectorAll('#topup-modal .tp-amt').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = parseInt(btn.dataset.amt, 10);
        el('tp-amount').value = amt;
      });
    });

    // step actions
    document.getElementById('tp-next-1').addEventListener('click', nextFrom1);
    document.getElementById('tp-next-2').addEventListener('click', nextFrom2);
    document.getElementById('tp-next-3').addEventListener('click', nextFrom3);
    document.getElementById('tp-confirm').addEventListener('click', confirmTopup);

    // back buttons
    document.querySelectorAll('#topup-modal .tp-back').forEach(btn => {
      btn.addEventListener('click', () => showStep(Math.max(1, state.step - 1)));
    });

    // close handlers
    document.getElementById('topup-close').addEventListener('click', closeTopup);
    modal.addEventListener('click', (e) => { if(e.target === modal) closeTopup(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
