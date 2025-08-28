// Admin dashboard logic
(function(){
	const API = '/analytics/spots.json';

	let data = { spots: [] };
	let chart;

	const el = (id) => document.getElementById(id);
	const fmt = (n) => n.toLocaleString('en-PH');

	async function load(){
		const res = await fetch(API, { cache: 'no-store' });
		data = await res.json();
		if(!data.spots) data.spots = [];
	}

	function compute(){
		const spots = data.spots;
		const totalActive = spots.reduce((s,x)=>s+(x.active||0),0);
		const totalCap = spots.reduce((s,x)=>s+(x.capacity||0),0);
		const hot = spots.filter(x => x.capacity>0 && (x.active||0)/x.capacity >= 0.7).length;
		return { totalActive, occupancy: totalCap? Math.round((totalActive/totalCap)*100):0, hot, count: spots.length };
	}

	function renderKpis(){
		const c = compute();
		el('kpi-active').textContent = fmt(c.totalActive);
		el('kpi-hotspots').textContent = `${c.hot}/${c.count}`;
		el('kpi-occupancy').textContent = `${c.occupancy}%`;
		el('kpi-spots').textContent = c.count;
	}

	function linreg(y){
		// simple linear regression y = a + b*x for x=0..n-1
		const n = y.length; if(n<2) return { a: y[0]||0, b: 0 };
		let sumx=0,sumy=0,sumxy=0,sumxx=0;
		for(let i=0;i<n;i++){ sumx+=i; sumy+=y[i]; sumxy+=i*y[i]; sumxx+=i*i; }
		const b = (n*sumxy - sumx*sumy) / Math.max(1,(n*sumxx - sumx*sumx));
		const a = (sumy - b*sumx)/n;
		return { a,b };
	}

	// Single Exponential Smoothing
	function sesForecast(hist, alpha, horizon){
		if(!hist.length) return Array(horizon).fill(0);
		let s = hist[0];
		for(let t=1;t<hist.length;t++) s = alpha*hist[t] + (1-alpha)*s;
		return Array(horizon).fill(Math.max(0, Math.round(s)));
	}

	// Moving Average forecast (last MA value extended)
	function maForecast(hist, windowSize, horizon){
		const n = hist.length;
		if(n===0) return Array(horizon).fill(0);
		const w = Math.max(2, Math.min(windowSize, n));
		const start = Math.max(0, n - w);
		const avg = hist.slice(start).reduce((a,b)=>a+b,0)/Math.max(1, hist.slice(start).length);
		return Array(horizon).fill(Math.max(0, Math.round(avg)));
	}

	// Holt's linear trend (no seasonality)
	function holtForecast(hist, alpha, beta, horizon){
		const n = hist.length; if(n===0) return Array(horizon).fill(0);
		let level = hist[0];
		let trend = n>1 ? hist[1]-hist[0] : 0;
		for(let t=1;t<n;t++){
			const prevLevel = level;
			level = alpha*hist[t] + (1-alpha)*(level + trend);
			trend = beta*(level - prevLevel) + (1-beta)*trend;
		}
		const out=[]; for(let k=1;k<=horizon;k++) out.push(Math.max(0, Math.round(level + k*trend)));
		return out;
	}

	function linearForecast(hist, horizon){
		const { a,b } = linreg(hist);
		const start = hist.length; const f = [];
		for(let k=0;k<horizon;k++){ const x = start + k; f.push(Math.max(0, Math.round(a + b*x))); }
		return f;
	}

	function forecastSeries(hist, horizon, method, params){
		switch(method){
			case 'ses': return sesForecast(hist, params.alpha ?? 0.3, horizon);
			case 'ma': return maForecast(hist, params.window ?? 3, horizon);
			case 'holt': return holtForecast(hist, params.alpha ?? 0.3, params.beta ?? 0.2, horizon);
			case 'linear':
			default: return linearForecast(hist, horizon);
		}
	}

	function rollingErrors(actual){
		// naive one-step-ahead errors using chosen method vs actual
		// We'll compute residuals from linear baseline for band width
		if(actual.length < 3) return [];
		const errors=[];
		for(let i=2;i<actual.length;i++){
			const hist = actual.slice(0,i);
			const pred = linearForecast(hist,1)[0];
			errors.push(actual[i]-pred);
		}
		return errors;
	}

	function renderChart(){
		const ctx = document.getElementById('active-chart');
		if(!ctx) return;
		const now = compute().totalActive;
		const points = Array.from({length: 12}, ()=> Math.max(0, Math.round(now*(0.85 + Math.random()*0.3))));
		const labels = points.map((_,i)=>`T-${11-i}`);

		const doForecast = document.getElementById('toggle-forecast')?.checked;
		const horizon = parseInt(document.getElementById('forecast-horizon')?.value||'6',10);
		const method = document.getElementById('forecast-method')?.value || 'linear';
		const alpha = parseFloat(document.getElementById('smoothing-alpha')?.value || '0.3');
		const maWin = parseInt(document.getElementById('ma-window')?.value || '3',10);
		const showBand = document.getElementById('toggle-band')?.checked;
		const params = { alpha, beta: 0.2, window: maWin };
		const future = doForecast ? forecastSeries(points, horizon, method, params) : [];
		const allLabels = doForecast ? [...labels, ...future.map((_,i)=>`+${i+1}`)] : labels;

		if(chart) chart.destroy();
		const datasets = [
			{ label: 'Recent', data: points, tension: 0.35, fill: false, borderColor: '#10B981', backgroundColor: '#10B981' }
		];
		if(doForecast){
			datasets.push({ label: 'Projection', data: [...Array(points.length).fill(null), ...future], tension: 0.35, fill: false, borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', borderDash: [6,4] });
			if(showBand){
				const errs = rollingErrors(points);
				const mad = errs.length? errs.reduce((a,b)=>a+Math.abs(b),0)/errs.length : 0;
				const upper = future.map(v=>v + 1.5*mad);
				const lower = future.map(v=>Math.max(0, v - 1.5*mad));
				datasets.push({ label: 'Upper', data: [...Array(points.length).fill(null), ...upper], borderColor: 'rgba(14,165,233,0.2)', backgroundColor: 'rgba(14,165,233,0.12)', fill: '+1', pointRadius: 0, borderWidth: 0 });
				datasets.push({ label: 'Lower', data: [...Array(points.length).fill(null), ...lower], borderColor: 'rgba(14,165,233,0.2)', backgroundColor: 'rgba(14,165,233,0.12)', fill: '-1', pointRadius: 0, borderWidth: 0 });
			}
		}
		chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: allLabels,
				datasets
			},
			options: { plugins: { legend: { display: true, labels: { boxWidth: 8, font: { size: 10 } } } }, interaction: { mode: 'index', intersect: false }, scales: { x: { ticks: { color: '#64748b', font: { size: 10 } } }, y: { ticks: { color: '#64748b', font: { size: 10 } } } } }
		});

		// Plain-language summary
		const summary = document.getElementById('forecast-summary');
		if(summary){
			if(doForecast && future.length){
				const last = points[points.length-1];
				const end = future[future.length-1];
				const delta = end - last;
				const direction = delta>0 ? 'increase' : (delta<0 ? 'decrease' : 'stay about the same');
				const methodName = { linear:'Linear trend', ses:'Exponential smoothing', ma:'Moving average', holt:'Holt trend' }[method]||'Projection';
				summary.textContent = `${methodName}: counts may ${direction} by about ${Math.abs(delta).toLocaleString('en-PH')} over the next ${horizon} intervals.`;
			} else {
				summary.textContent = `Turn on Projection to see the next ${horizon} intervals.`;
			}
		}
	}

	function renderTable(){
		const body = el('spots-body');
		body.innerHTML = '';
		data.spots.forEach((s, idx) => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td class="px-2 py-2"><input class="spot-name w-full rounded border border-slate-200 p-1" value="${s.name||''}"/></td>
				<td class="px-2 py-2"><input type="number" class="spot-cap w-24 rounded border border-slate-200 p-1" value="${s.capacity||0}"/></td>
				<td class="px-2 py-2"><input type="number" class="spot-act w-24 rounded border border-slate-200 p-1" value="${s.active||0}"/></td>
				<td class="px-2 py-2 text-[12px] text-slate-600">${s.capacity? Math.round((s.active||0)/s.capacity*100):0}%</td>
				<td class="px-2 py-2 text-[12px]">${s.capacity>0 && (s.active||0)/s.capacity>=0.7 ? '<span class="rounded bg-amber-100 px-2 py-0.5 text-amber-700">Hot</span>' : '<span class="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">OK</span>'}</td>
				<td class="px-2 py-2 text-right"><button class="row-del rounded border border-rose-200 px-2 py-1 text-[10px] text-rose-600 hover:bg-rose-50">Remove</button></td>
			`;
			tr.querySelector('.row-del').addEventListener('click', ()=>{ data.spots.splice(idx,1); renderAll(); });
			tr.querySelector('.spot-name').addEventListener('input', (e)=>{ s.name = e.target.value; });
			tr.querySelector('.spot-cap').addEventListener('input', (e)=>{ s.capacity = parseInt(e.target.value||'0',10); renderTableSummary(tr, s); });
			tr.querySelector('.spot-act').addEventListener('input', (e)=>{ s.active = parseInt(e.target.value||'0',10); renderTableSummary(tr, s); });
			body.appendChild(tr);
		});
	}

	function renderTableSummary(tr, s){
		tr.children[3].textContent = `${s.capacity? Math.round((s.active||0)/s.capacity*100):0}%`;
		tr.children[4].innerHTML = s.capacity>0 && (s.active||0)/s.capacity>=0.7 ? '<span class="rounded bg-amber-100 px-2 py-0.5 text-amber-700">Hot</span>' : '<span class="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">OK</span>';
		renderKpis();
		renderChart();
	}

	function randomize(){
		data.spots.forEach(s=>{
			const cap = s.capacity || 0;
			s.active = Math.round(Math.max(0, Math.min(cap, cap*(0.3+Math.random()*0.8))))
		});
		renderAll();
	}

	function addRow(){
		data.spots.push({ id: `spot-${Date.now()}`, name: 'New Spot', capacity: 1000, active: 0 });
		renderAll();
	}

	async function save(){
		// Since we’re on a static site, just download a JSON reflecting current state
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = 'spots.json'; a.click();
		URL.revokeObjectURL(url);
	}

	async function importFile(){
		const fileInput = el('file-import');
		const f = fileInput.files?.[0];
		if(!f) return;
		const text = await f.text();
		try { data = JSON.parse(text); if(!data.spots) data.spots = []; } catch(_) { alert('Invalid JSON'); return; }
		renderAll();
	}

	function exportFile(){
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = 'spots.json'; a.click();
		URL.revokeObjectURL(url);
	}

		function bind(){
		el('admin-refresh').addEventListener('click', async ()=>{ await load(); renderAll(); });
		el('admin-randomize').addEventListener('click', randomize);
		el('add-row').addEventListener('click', addRow);
		el('save-table').addEventListener('click', save);
		el('btn-import').addEventListener('click', importFile);
		el('btn-export').addEventListener('click', exportFile);
			const tgl = document.getElementById('toggle-forecast');
			const tglBtn = document.getElementById('toggle-forecast-btn');
			const hor = document.getElementById('forecast-horizon');
			const methodSel = document.getElementById('forecast-method');
			const alphaInput = document.getElementById('smoothing-alpha');
			const maWin = document.getElementById('ma-window');
			const bandTgl = document.getElementById('toggle-band');
			if(tgl) tgl.addEventListener('change', renderChart);
			if(tglBtn && tgl){
				tglBtn.addEventListener('click', ()=>{
					tgl.checked = !tgl.checked;
					renderChart();
					// update button label
					tglBtn.textContent = tgl.checked ? 'Hide projection' : 'Show projection';
				});
				// initialize label
				tglBtn.textContent = tgl.checked ? 'Hide projection' : 'Show projection';
			}
			if(hor) hor.addEventListener('change', renderChart);
			if(methodSel){
				const updateParamsVisibility = ()=>{
					const method = methodSel.value;
					document.getElementById('param-ses')?.classList.toggle('hidden', !(method==='ses' || method==='holt'));
					document.getElementById('param-ma')?.classList.toggle('hidden', method!=='ma');
				};
				methodSel.addEventListener('change', ()=>{ updateParamsVisibility(); renderChart(); });
				updateParamsVisibility();
			}
			if(alphaInput) alphaInput.addEventListener('change', renderChart);
			if(maWin) maWin.addEventListener('change', renderChart);
			if(bandTgl) bandTgl.addEventListener('change', renderChart);
			const infoBtn = document.getElementById('forecast-info-toggle');
			const info = document.getElementById('forecast-info');
			if(infoBtn && info){ infoBtn.addEventListener('click', ()=> info.classList.toggle('hidden')); }
	}

	function renderAll(){ renderKpis(); renderChart(); renderTable(); }

	async function init(){ await load(); bind(); renderAll(); }
	document.addEventListener('DOMContentLoaded', init);
})();
