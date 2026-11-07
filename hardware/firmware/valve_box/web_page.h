// The phone page the valve box serves at http://hydrotrack.local (home Wi-Fi).
#pragma once
static const char WEB_PAGE[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>HydroTrack Home</title>
<style>
:root{--bg:#f4f7f7;--card:#fff;--ink:#142023;--muted:#66787b;--line:#e0e7e6;--water:#2a55ff;--amber:#d98a00;--off:#c4442b;--accent:#0a7884}
@media(prefers-color-scheme:dark){:root{--bg:#0d1517;--card:#172326;--ink:#e3ecec;--muted:#93a6a8;--line:#26363a;--water:#6f8cff;--amber:#f0ab3c;--off:#f07a62;--accent:#47bdcb}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;
padding:16px max(16px,env(safe-area-inset-left)) 32px max(16px,env(safe-area-inset-right))}
main{max-width:460px;margin:0 auto;display:grid;gap:12px}h1{margin:4px 0 0;font-size:26px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;display:grid;gap:12px}
.state b{display:block;font-size:24px;color:var(--st)}.state small,.muted{color:var(--muted);font-size:13px}
button.big{border:0;border-radius:14px;padding:14px;font:700 16px/1 inherit;color:#fff;background:var(--off);cursor:pointer}
button.big.on{background:var(--water)}button:disabled{opacity:.5}
.alert{border-color:var(--amber)}.alert b{color:var(--amber)}.row{display:flex;justify-content:space-between;gap:10px;align-items:center}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.acts button{border:0;border-radius:12px;padding:11px;font:700 14px/1 inherit;cursor:pointer}
.danger{background:var(--off);color:#fff}.ghost{background:var(--line);color:var(--ink)}
.tap{display:grid;grid-template-columns:12px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}.tap:first-child{border:0}
.dot{width:12px;height:12px;border-radius:50%;background:var(--line)}.num{font-variant-numeric:tabular-nums;text-align:right}
.sw{width:44px;height:26px;border-radius:13px;border:0;background:var(--line);position:relative;cursor:pointer}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
.sw[aria-checked=true]{background:var(--accent)}.sw[aria-checked=true]::after{transform:translateX(18px)}
</style></head><body><main>
<div class="row"><h1>Home</h1><span class="muted" id="conn">connecting…</span></div>
<div class="card alert" id="alert" hidden><b id="aTitle"></b><span class="muted" id="aBody"></span>
<div class="acts"><button class="danger" id="aClose">Close water</button><button class="ghost" id="aDismiss">It’s me</button></div></div>
<div class="card"><div class="state"><b id="vTitle">…</b><small id="vSub"></small></div><button class="big" id="vBtn" disabled>…</button></div>
<div class="card"><div class="row"><span>Today</span><b class="num" id="today">0 L</b></div><div id="taps" class="muted">Waiting for tap devices…</div></div>
<div class="card"><div class="row"><span>Close a tap left open after 2 min</span><button class="sw" id="swAuto" role="switch" aria-checked="true"></button></div>
<div class="row"><span>Away mode</span><button class="sw" id="swAway" role="switch" aria-checked="false"></button></div></div>
<p class="muted">HydroTrack valve box · this page works on your home Wi-Fi without the internet.</p>
</main><script>
const $=id=>document.getElementById(id);let S=null;
const post=(u)=>fetch(u,{method:'POST'}).then(load);
async function load(){try{S=await (await fetch('/api/state')).json();draw();$('conn').textContent='box online'}catch(e){$('conn').textContent='box not reachable'}}
function draw(){const V={open:['Water is on','var(--water)'],closing:['Closing…','var(--amber)'],closed:['Water is off','var(--off)'],opening:['Opening…','var(--amber)'],fault:['Valve stuck: check it','var(--off)']}[S.valve];
document.querySelector('.state').style.setProperty('--st',V[1]);$('vTitle').textContent=V[0];$('vSub').textContent=S.reason||'';
const moving=S.valve=='closing'||S.valve=='opening';const b=$('vBtn');b.disabled=moving;
b.textContent=S.valve=='open'||S.valve=='closing'?'Close water':'Turn water on';b.className='big'+(S.valve=='closed'||S.valve=='fault'?' on':'');
$('today').textContent=Math.round(S.today)+' L';$('swAuto').setAttribute('aria-checked',S.autoClose);$('swAway').setAttribute('aria-checked',S.away);
$('alert').hidden=!S.alert;if(S.alert){$('aTitle').textContent=S.alert.title;$('aBody').textContent=S.alert.body}
$('taps').innerHTML=S.taps.length?S.taps.map(t=>{const f=t.flowLpm>0.05;const c=!f?'':t.useLitres>t.useLimitL?'var(--off)':t.useLitres>t.useLimitL*.75?'var(--amber)':'var(--water)';
return `<div class="tap"><span class="dot" style="${c?'background:'+c:''}"></span><span><b>${t.name}</b><br><small class="muted">${t.todayLitres.toFixed(1)} L today · ${t.seen}</small></span><span class="num"><b>${f?t.flowLpm.toFixed(1)+' L/min':'Off'}</b><br><small class="muted">${f?t.useLitres.toFixed(1)+' L this use':''}</small></span></div>`}).join(''):'Waiting for tap devices…'}
$('vBtn').onclick=()=>post('/api/valve?action='+(S.valve=='open'?'close':'open'));
$('aClose').onclick=()=>post('/api/valve?action=close');$('aDismiss').onclick=()=>post('/api/dismiss');
$('swAuto').onclick=()=>post('/api/settings?auto='+(S.autoClose?0:1));$('swAway').onclick=()=>post('/api/settings?away='+(S.away?0:1));
load();setInterval(load,1500);
</script></body></html>)HTML";
