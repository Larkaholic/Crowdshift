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

	function renderChart(){
		const ctx = document.getElementById('active-chart');
		if(!ctx) return;
		const now = compute().totalActive;
		// create a faux last-12 points trend around current
		const points = Array.from({length: 12}, (_,i)=> Math.max(0, Math.round(now*(0.85 + Math.random()*0.3))));
		const labels = points.map((_,i)=>`T-${11-i}`);
		if(chart) chart.destroy();
		chart = new Chart(ctx, {
			type: 'line',
			data: { labels, datasets: [{ label: 'Active', data: points, tension: 0.35, fill: false, borderColor: '#10B981', backgroundColor: '#10B981' }] },
			options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#64748b', font: { size: 10 } } }, y: { ticks: { color: '#64748b', font: { size: 10 } } } } }
		});
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
	}

	function renderAll(){ renderKpis(); renderChart(); renderTable(); }

	async function init(){ await load(); bind(); renderAll(); }
	document.addEventListener('DOMContentLoaded', init);
})();
