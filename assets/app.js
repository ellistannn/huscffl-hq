/* No build tools required: this site works directly on GitHub Pages. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '—';
const slug = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const state = {config:null,stories:[],team:'all',week:'all',type:'all',view:'home',rosters:[],users:[],standings:[],matchups:[],h2hGames:[],h2hStatus:"loading",h2hSeason:"all",h2hWarnings:[],live:false,article:null,transactions:[],transactionSeason:'2026',transactionType:'all',transactionTeam:'all',transactionStatus:'loading',transactionsLastUpdated:null,transactionNames:{},transactionMappings:{},transactionError:''};
const api = async endpoint => {const res=await fetch(`https://api.sleeper.app/v1/league/${state.config.leagueId}/${endpoint}`);if(!res.ok)throw Error(`Sleeper ${endpoint}: ${res.status}`);return res.json()};
function urlState(){const p=new URLSearchParams(location.search);state.team=state.config.teams.some(t=>t.id===p.get('team'))?p.get('team'):'all';const w=p.get('week');state.week=w&&/^\d{1,2}$/.test(w)?w:'all';state.view=['home','archive','teams','standings','transactions'].includes(p.get('view'))?p.get('view'):'home';state.article=p.get('article')||null;if(state.article)state.view='article';}
function setUrl(){const p=new URLSearchParams();if(state.team!=='all')p.set('team',state.team);if(state.week!=='all')p.set('week',state.week);if(state.view!=='home'&&state.view!=='article')p.set('view',state.view);if(state.article)p.set('article',state.article);history.pushState({},'',`${location.pathname}${p.toString()?'?'+p:''}`);}
function teamName(id){return state.config.teams.find(t=>t.id===id)?.name||id}
function selectedRoster(){return state.rosters.find(r=>r.teamId===state.team)}
function mapTeams(){const teams=state.config.teams;const overrides=state.config.rosterOverrides||{};for(const roster of state.rosters){const owner=state.users.find(u=>String(u.user_id)===String(roster.owner_id));const sleeperName=owner?.metadata?.team_name||owner?.display_name||'';const custom=Object.entries(overrides).find(([,rid])=>Number(rid)===Number(roster.roster_id))?.[0];roster.teamId=custom || teams.find(t=>slug(t.name)===slug(sleeperName))?.id || null;roster.displayName=owner?.metadata?.team_name||owner?.display_name||`Roster ${roster.roster_id}`;roster.managerName=owner?.display_name||'Unknown manager';}
 // Match team names first; any remaining names use predictable roster-order fallback only when unambiguous.
 const unknown=state.rosters.filter(r=>!r.teamId), remaining=teams.filter(t=>!state.rosters.some(r=>r.teamId===t.id));
 if(unknown.length===1&&remaining.length===1)unknown[0].teamId=remaining[0].id;
}
function deriveStandings(){state.standings=state.rosters.map(r=>{const s=r.settings||{};const total=(key,dec)=>Number(s[key]||0)+Number(s[dec]||0)/100;return {...r,wins:s.wins||0,losses:s.losses||0,ties:s.ties||0,pf:total('fpts','fpts_decimal'),pa:total('fpts_against','fpts_against_decimal')}}).sort((a,b)=>b.wins-a.wins || a.losses-b.losses || b.pf-a.pf);}
async function loadLive(){try{const [rosters,users,league,nflState]=await Promise.all([api('rosters'),api('users'),fetch(`https://api.sleeper.app/v1/league/${state.config.leagueId}`).then(r=>{if(!r.ok)throw Error('league info unavailable');return r.json()}),fetch('https://api.sleeper.app/v1/state/nfl').then(r=>{if(!r.ok)throw Error('NFL state unavailable');return r.json()}).catch(()=>null)]);state.rosters=rosters;state.users=users;mapTeams();deriveStandings();state.live=true;$('#dataStatus').textContent='● Live league data via Sleeper';render();loadTransactions();await loadHeadToHead(league,nflState);}catch(err){console.warn(err);state.h2hStatus='error';$('#dataStatus').textContent='Sleeper data unavailable · stories still accessible';render();}}
function matchupScore(m){const override=m.custom_points;return Number(override != null ? override : m.points);}
async function fetchSeasonGames(season,leagueId,nflState){
  const base=`https://api.sleeper.app/v1/league/${leagueId}`;
  const get=async path=>{const r=await fetch(`${base}/${path}`);if(!r.ok)throw Error(`${season}: ${path} (${r.status})`);return r.json()};
  const [league,rosters,users]=await Promise.all([get(''),get('rosters'),get('users')]);
  const seasonNum=Number(league.season||season), current=Number(nflState?.season);
  let completed=0;
  if(current && seasonNum<current) completed=18;
  else if(current && seasonNum===current){
    completed=nflState.season_type==='regular'?Math.max(0,Number(nflState.week||1)-1):18;
  } else if(seasonNum<new Date().getFullYear())completed=18;
  else throw Error(`Cannot determine completed weeks for ${season}`);
  const currentOwners=new Map(state.rosters.filter(r=>r.teamId).map(r=>[String(r.owner_id),r.teamId]));
  const teamByName=new Map(state.config.teams.map(t=>[slug(t.name),t.id]));
  const userById=new Map(users.map(u=>[String(u.user_id),u]));
  const overrides=state.config.historicalRosterOverrides?.[season]||{};
  const teams=new Map();
  for(const r of rosters){
    const user=userById.get(String(r.owner_id));
    const names=[user?.metadata?.team_name,user?.display_name,r.metadata?.team_name];
    let id=Object.entries(overrides).find(([,number])=>Number(number)===Number(r.roster_id))?.[0];
    if(!id)id=names.map(name=>teamByName.get(slug(name))).find(Boolean);
    if(!id)id=currentOwners.get(String(r.owner_id));
    if(id)teams.set(Number(r.roster_id),id);
  }
  const results=await Promise.allSettled(Array.from({length:completed},(_,i)=>get(`matchups/${i+1}`)));
  const games=[];let failed=0,unmapped=0;
  for(let i=0;i<results.length;i++){
    if(results[i].status!=='fulfilled'){failed++;continue;}
    const grouped=new Map();
    for(const m of results[i].value||[]){if(m.matchup_id==null)continue;const k=String(m.matchup_id);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(m)}
    for(const pair of grouped.values()){
      if(pair.length!==2)continue;
      const [a,b]=pair,ta=teams.get(Number(a.roster_id)),tb=teams.get(Number(b.roster_id));
      if(!ta||!tb){unmapped++;continue;}
      const scoreA=matchupScore(a),scoreB=matchupScore(b);
      if(!Number.isFinite(scoreA)||!Number.isFinite(scoreB))continue;
      games.push({season:Number(season),week:i+1,a:ta,b:tb,scoreA,scoreB});
    }
  }
  return {games,failed,unmapped};
}
async function loadHeadToHead(league,nflState){
  const ids=state.config.leagueIds||{[String(state.config.season)]:state.config.leagueId};
  const results=await Promise.allSettled(Object.entries(ids).map(async ([season,id])=>fetchSeasonGames(season,id,nflState)));
  state.h2hGames=[];state.h2hWarnings=[];
  results.forEach((res,i)=>{
    const season=Object.keys(ids)[i];
    if(res.status==='fulfilled'){
      state.h2hGames.push(...res.value.games);
      if(res.value.failed)state.h2hWarnings.push(`${season}: ${res.value.failed} week(s) unavailable`);
      if(res.value.unmapped)state.h2hWarnings.push(`${season}: ${res.value.unmapped} matchup(s) have unmapped franchises`);
    }else{console.warn('H2H season error',season,res.reason);state.h2hWarnings.push(`${season} season could not be loaded`)}
  });
  state.h2hStatus=results.every(x=>x.status==='rejected')?'error':state.h2hWarnings.length?'partial':state.h2hGames.length?'ready':'empty';
  render();
}
function renderHeadToHead(roster){
  if(!roster)return '<div class="h2h-empty">Map this franchise to the correct Sleeper roster ID to show head-to-head records.</div>';
  const status=state.h2hStatus;
  if(status==='loading')return '<div class="h2h-empty">Loading head-to-head history…</div>';
  if(status==='error')return '<div class="h2h-empty">Head-to-head results are unavailable. Check Sleeper connections and league IDs.</div>';
  const selected=state.h2hSeason;
  const games=state.h2hGames.filter(g=>selected==='all'||String(g.season)===selected);
  const opponents=state.config.teams.filter(t=>t.id!==roster.teamId);
  const rows=opponents.map(t=>{
    const matches=games.filter(g=>(g.a===roster.teamId&&g.b===t.id)||(g.b===roster.teamId&&g.a===t.id));
    let w=0,l=0,ties=0,pf=0,pa=0;
    for(const g of matches){const us=g.a===roster.teamId?g.scoreA:g.scoreB,them=g.a===roster.teamId?g.scoreB:g.scoreA;pf+=us;pa+=them;if(us>them)w++;else if(us<them)l++;else ties++}
    return `<tr><td>${safe(t.name)}</td><td>${w}–${l}–${ties}</td><td>${matches.length}</td><td>${matches.length?fmt(pf):'—'}</td><td>${matches.length?fmt(pa):'—'}</td></tr>`;
  });
  const played=games.filter(g=>g.a===roster.teamId||g.b===roster.teamId).length;
  const options=['all',...Object.keys(state.config.leagueIds||{}).sort()].map(v=>`<option value="${safe(v)}" ${v===selected?'selected':''}>${v==='all'?'All-Time':v}</option>`).join('');
  const warning=state.h2hWarnings.length?`<p class="muted">Partial history: ${safe(state.h2hWarnings.join('; '))}. Update roster overrides if team names or owners changed.</p>`:'';
  return `<div class="h2h-heading"><div><div class="eyebrow">RIVALRY TRACKER · EST. 2025</div><h3>Head-to-head records</h3></div><label class="muted">Season <select id="h2hSeasonSelect" aria-label="Head-to-head season">${options}</select></label></div><p class="muted">${played} completed matchups · ${selected==='all'?'2025–present':selected}</p><div class="h2h-scroll"><table class="standings-table h2h-table"><thead><tr><th>Opponent</th><th>W–L–T</th><th>Games</th><th>PF</th><th>PA</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>${warning}<p class="muted h2h-note">Includes completed regular-season and postseason matchups. For historical franchises whose names or ownership changed, configure the roster mapping before relying on totals.</p>`;
}
function setupSelectors(){const ts=$('#teamSelect'),ws=$('#weekSelect');for(const t of state.config.teams){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;ts.appendChild(o)}const weeks=new Set(state.stories.map(s=>String(s.week)));for(let w=1;w<=18;w++)weeks.add(String(w));for(const w of [...weeks].sort((a,b)=>Number(a)-Number(b))){const o=document.createElement('option');o.value=w;o.textContent=`Week ${w}`;ws.appendChild(o)}ts.addEventListener('change',e=>{state.team=e.target.value;state.article=null;change();});ws.addEventListener('change',e=>{state.week=e.target.value;state.article=null;change()});$('#resetFilters').addEventListener('click',()=>{state.team='all';state.week='all';state.type='all';state.article=null;change()});$$('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.article=null;change()});$$('[data-go]').forEach(b=>b.onclick=()=>{state.view=b.dataset.go;state.article=null;change()});$$('[data-type]').forEach(b=>b.onclick=()=>{state.type=b.dataset.type;change()});setupTransactionControls();$('#backToArchive').onclick=()=>{state.view='archive';state.article=null;change()};window.addEventListener('popstate',()=>{urlState();render()});}
function change(){setUrl();render();window.scrollTo({top:0,behavior:'smooth'});}
function articleMatches(a){const teamMatch=state.team==='all'||a.teams?.includes('all')||a.teams?.includes(state.team);return teamMatch&&(state.week==='all'||String(a.week)===state.week)&&(state.type==='all'||a.type===state.type);}
function sortedStories(){return state.stories.filter(articleMatches).sort((a,b)=>b.season-a.season||b.week-a.week||String(b.date).localeCompare(String(a.date)))}
function storyCard(a){const art=document.createElement('article');art.className='story';art.innerHTML=`<div class="story-image" aria-hidden="true">${a.type==='preview'?'VS':a.type==='recap'?'W':'H'}</div><div class="story-body"><span class="tag">${safe(a.type)} · ${safe(a.season)} · WEEK ${safe(a.week)}</span><h3>${safe(a.title)}</h3><p>${safe(a.summary)}</p><button type="button">Read story →</button></div>`;art.querySelector('button').onclick=()=>{state.article=a.id;state.view='article';change()};return art;}
function renderStories(el,stories){el.replaceChildren();if(!stories.length){el.innerHTML='<div class="empty">No coverage matches these filters yet. Upload a recap or preview Markdown file to the articles folder.</div>';return}stories.forEach(a=>el.appendChild(storyCard(a)))}
function renderTable(el,limit=Infinity){const rows=state.standings.slice(0,limit);if(!rows.length){el.innerHTML='<p class="muted">Standings will appear when Sleeper data becomes available.</p>';return}const table=document.createElement('table');table.className='standings-table';table.innerHTML='<thead><tr><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th></tr></thead><tbody></tbody>';rows.forEach((r,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><button class="teamlink">${i+1}. ${safe(r.teamId?teamName(r.teamId):r.displayName)}</button></td><td>${r.wins}</td><td>${r.losses}</td><td>${fmt(r.pf)}</td><td>${fmt(r.pa)}</td>`;tr.querySelector('button').onclick=()=>{if(r.teamId){state.team=r.teamId;state.view='teams';state.article=null;change()}};table.tBodies[0].appendChild(tr)});el.replaceChildren(table)}
function renderTeamPanel(){const el=$('#teamPanel');el.hidden=state.team==='all';if(el.hidden)return;const r=selectedRoster();const match=state.matchups.find(m=>Number(m.roster_id)===Number(r?.roster_id));const opponent=match&&state.matchups.find(m=>m.matchup_id===match.matchup_id&&m.roster_id!==match.roster_id);const oppRoster=opponent&&state.rosters.find(a=>a.roster_id===opponent.roster_id);const record=r?`${r.settings?.wins||0}–${r.settings?.losses||0}${r.settings?.ties?'–'+r.settings.ties:''}`:'—';const s=state.standings.find(a=>a.roster_id===r?.roster_id);const rank=s?state.standings.indexOf(s)+1:'—';el.innerHTML=`<div class="eyebrow">FRANCHISE HEADQUARTERS</div><h2>${safe(teamName(state.team))}</h2><div class="muted">${r?`Manager: ${safe(r.managerName)}`:'Map this team to its Sleeper roster to show its stats.'}</div><div class="metrics"><div class="metric"><small>Record</small><b>${record}</b></div><div class="metric"><small>League rank</small><b>${rank}${rank==='—'?'':' / '+state.standings.length}</b></div><div class="metric"><small>Points for</small><b>${s?fmt(s.pf):'—'}</b></div><div class="metric"><small>Points against</small><b>${s?fmt(s.pa):'—'}</b></div></div><div class="team-details"><div class="detail"><strong>Current roster</strong>${r?`${r.players?.length||0} players on roster · ${r.starters?.length||0} starter slots`:'Live roster not matched'}<br><span class="muted">Roster/player details can be expanded in the next version.</span></div><div class="detail"><strong>Weekly matchup</strong>${oppRoster?`Vs. ${safe(oppRoster.teamId?teamName(oppRoster.teamId):oppRoster.displayName)} · ${fmt(Number(match.custom_points??match.points))} – ${fmt(Number(opponent.custom_points??opponent.points))}`:'Select a week to view a matchup, if available.'}</div></div><section class="h2h-section">${renderHeadToHead(r)}</section><section class="team-transactions"><h3>Recent transactions</h3><div class="muted">2026 season · auto-updated</div>${renderTransactionCards('2026',state.team,5)}</section>`;const selector=el.querySelector("#h2hSeasonSelect");if(selector)selector.addEventListener("change",e=>{state.h2hSeason=e.target.value;renderTeamPanel()});}
function renderTeams(){const el=$('#teamGrid');el.replaceChildren();state.config.teams.forEach(t=>{const r=state.rosters.find(r=>r.teamId===t.id);const b=document.createElement('button');b.className='team-tile';b.innerHTML=`<span class="symbol">${safe(t.name[0])}</span><h3>${safe(t.name)}</h3><p>${r?`${r.settings?.wins||0}–${r.settings?.losses||0} · ${safe(r.managerName)}`:'View franchise dashboard'} →</p>`;b.onclick=()=>{state.team=t.id;state.view='home';state.article=null;change()};el.appendChild(b)})}
function renderArticle(){const el=$('#articleBody');const a=state.stories.find(s=>s.id===state.article);if(!a){el.innerHTML='<h1>Article not found</h1><p>Check the link or return to coverage.</p>';return}el.innerHTML=`<div class="eyebrow">${safe(a.type)} · SEASON ${safe(a.season)} · WEEK ${safe(a.week)}</div><h1>${safe(a.title)}</h1><p class="lead">${safe(a.summary)}</p><div class="article-content">${a.bodyHtml || (a.paragraphs||[]).map(p=>`<p>${safe(p)}</p>`).join('')}</div>`;document.title=`${a.title} | HUSCFFL`}
function render(){if(!state.config)return;document.title='HUSCFFL | League Headquarters';$('#teamSelect').value=state.team;$('#weekSelect').value=state.week;renderTeamPanel();let stories=sortedStories();renderStories($('#featuredStories'),stories.slice(0,3));renderStories($('#archiveStories'),stories);$('#storyCount').textContent=`${stories.length} ${stories.length===1?'story':'stories'}`;renderTable($('#homeStandings'),6);renderTable($('#fullStandings'));renderTeams();$$('[data-type]').forEach(b=>b.classList.toggle('on',b.dataset.type===state.type));$$('.view').forEach(v=>v.hidden=v.id!==`${state.view}View`);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));if(state.view==='article')renderArticle();renderTransactions();}

/* Sleeper transaction history, read-only. Weekly transactions may contain pending / failed records. */
function setupTransactionControls(){
  const team=$('#transactionTeam');
  for(const t of state.config.teams){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;team.appendChild(o)}
  $('#transactionSeason').onchange=e=>{state.transactionSeason=e.target.value;renderTransactions()};
  $('#transactionType').onchange=e=>{state.transactionType=e.target.value;renderTransactions()};
  team.onchange=e=>{state.transactionTeam=e.target.value;renderTransactions()};
  $('#refreshTransactions').onclick=()=>loadTransactions(true);
}
function txType(t){return t.type==='trade'?'Trade':t.type==='waiver'?'Waiver claim':t.type==='free_agent'?'Free-agent move':(t.type||'Roster move')}
function txTeamName(s,rid){const tid=state.transactionMappings[s]?.[String(rid)];return tid?teamName(tid):`Roster ${rid}`}
function txTeams(t){const ids=new Set([...(t.roster_ids||[]),...Object.keys(t.adds||{}).map(k=>t.adds[k]),...Object.keys(t.drops||{}).map(k=>t.drops[k]),...(t.consenter_ids||[])]);return [...ids].map(x=>String(x));}
function txPlayer(id){return state.transactionNames[String(id)]||(/^[A-Z]{2,3}$/.test(String(id))?`${id} D/ST`:`Player ${id}`)}
function txSummary(t,season){
 const adds=Object.entries(t.adds||{}).map(([player,rid])=>`${txPlayer(player)} → ${txTeamName(season,rid)}`);
 const drops=Object.entries(t.drops||{}).map(([player,rid])=>`${txPlayer(player)} dropped by ${txTeamName(season,rid)}`);
 const picks=(t.draft_picks||[]).map(p=>`${p.season} round ${p.round} pick`);
 const faab=t.settings?.waiver_bid;
 let lines=[];
 if(adds.length)lines.push(`Added: ${adds.join(' · ')}`);
 if(drops.length)lines.push(`Dropped: ${drops.join(' · ')}`);
 if(picks.length)lines.push(`Draft picks: ${picks.join(' · ')}`);
 if(faab!=null&&t.type==='waiver')lines.push(`Waiver bid: ${faab}`);
 if(!lines.length)lines.push('Transaction completed · See Sleeper for full details');
 return lines;
}
function txFiltered(season,team='all',type='all'){
 return state.transactions.filter(x=>x._season===season&&(type==='all'||x.type===type)&&(team==='all'||txTeams(x).some(r=>state.transactionMappings[season]?.[r]===team)));
}
function renderTransactionCards(season,team='all',max=30,type='all'){
 const list=txFiltered(season,team,type).slice(0,max);
 if(!list.length)return '<div class="transaction-empty">No completed transactions available for these filters.</div>';
 return list.map(t=>{
 const ms=t.status_updated||t.created||0;
 const date=ms?new Date(ms).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):`Week ${t._week}`;
 const teams=txTeams(t).map(r=>txTeamName(season,r)).join(' · ');
 return `<article class="transaction-card"><div class="transaction-meta">${safe(date)} · WEEK ${safe(t._week)} · ${safe(txType(t))}</div><h3>${safe(txType(t))}</h3><div class="transaction-team">${safe(teams)}</div>${txSummary(t,season).map(line=>`<p>${safe(line)}</p>`).join('')}</article>`;
 }).join('');
}
function renderHomeTransactions(){
 const el=$('#homeTransactionList'),status=$('#homeTransactionStatus');
 if(!el||!status)return;
 const season=String(state.config.season);
 const items=txFiltered(season,state.team,'all');
 status.textContent=state.transactionStatus==='loading'?'Loading recent moves…':state.transactionStatus==='error'?'Transaction feed unavailable':items.length?`Latest ${Math.min(5,items.length)} completed moves · ${season}`:'No completed transactions found';
 el.innerHTML=renderTransactionCards(season,state.team,5);
}

/* Fetch Sleeper's player catalog at most once daily per browser, then keep only names
   for the transaction players to avoid storing the full multi-megabyte catalog. */
async function loadPlayerNames(){
 const key='huscffl-player-names-v1';
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&saved.names){state.transactionNames=saved.names;render();}}
 catch(e){console.warn('Player name cache unavailable',e)}
 if(!state.transactions.length)return;
 const needed=new Set(state.transactions.flatMap(t=>[...Object.keys(t.adds||{}),...Object.keys(t.drops||{})]));
 const names=state.transactionNames;
 const missing=[...needed].filter(id=>!names[id]);
 if(!missing.length)return;
 const checkedKey='huscffl-player-catalog-checked';
 let last=0;try{last=Number(localStorage.getItem(checkedKey)||0)}catch(e){}
 if(Date.now()-last<86400000)return;
 try{
  const response=await fetch('https://api.sleeper.app/v1/players/nfl');
  if(!response.ok)throw Error(`Sleeper player directory: HTTP ${response.status}`);
  const players=await response.json();
  for(const id of needed){const pl=players[id];if(pl){const name=pl.full_name||[pl.first_name,pl.last_name].filter(Boolean).join(' ');if(name)names[id]=name;}}
  try{localStorage.setItem(key,JSON.stringify({names}));localStorage.setItem(checkedKey,String(Date.now()))}catch(e){console.warn('Could not cache player names',e)}
  render();
 }catch(err){console.warn('Could not resolve player names',err)}
}
function renderTransactions(){
 if(!state.config||!$('#transactionList'))return;
 $('#transactionSeason').value=state.transactionSeason;
 $('#transactionType').value=state.transactionType;
 $('#transactionTeam').value=state.transactionTeam;
 const list=txFiltered(state.transactionSeason,state.transactionTeam,state.transactionType);
 const stamp=state.transactionsLastUpdated?` · Last checked ${state.transactionsLastUpdated.toLocaleTimeString()}`:'';
 $('#transactionStatus').textContent=(state.transactionStatus==='error'?`Sleeper transaction data unavailable: ${state.transactionError}`:state.transactionStatus==='loading'?'Loading Sleeper transaction history…':`${list.length} completed moves shown${stamp}`);
 $('#transactionList').innerHTML=renderTransactionCards(state.transactionSeason,state.transactionTeam,200,state.transactionType);
 renderHomeTransactions();
}
async function loadTransactions(force=false){
 if(!state.config||window.__txBusy)return;
 window.__txBusy=true;
 try{
  const seasons=Object.entries(state.config.leagueIds||{[String(state.config.season)]:state.config.leagueId});
  const data=await Promise.all(seasons.map(async ([season,id])=>{
   const base=`https://api.sleeper.app/v1/league/${id}`;
   const [league,rosters,users]=await Promise.all(['', '/rosters','/users'].map(s=>fetch(base+s).then(r=>{if(!r.ok)throw Error(`${season}: Sleeper ${r.status}`);return r.json()})));
   const owners=new Map(state.rosters.filter(r=>r.teamId).map(r=>[String(r.owner_id),r.teamId]));
   const nameMap=new Map(state.config.teams.map(t=>[slug(t.name),t.id]));
   const uMap=new Map(users.map(u=>[String(u.user_id),u]));
   const overrides=season===String(state.config.season)?(state.config.rosterOverrides||{}):(state.config.historicalRosterOverrides?.[season]||{});
   const mapping={};
   rosters.forEach(r=>{const u=uMap.get(String(r.owner_id));const names=[u?.metadata?.team_name,r.metadata?.team_name,u?.display_name];const manual=Object.entries(overrides).find(([,num])=>Number(num)===Number(r.roster_id))?.[0];const tid=manual||names.map(n=>nameMap.get(slug(n))).find(Boolean)||owners.get(String(r.owner_id));if(tid)mapping[String(r.roster_id)]=tid;});
   const weeks=Math.min(18,Math.max(1,Number(league.settings?.playoff_week_start||15)+3));
   const fetched=await Promise.allSettled(Array.from({length:weeks},(_,i)=>fetch(`${base}/transactions/${i+1}`).then(r=>{if(!r.ok)throw Error('transaction week unavailable');return r.json()}).then(arr=>(arr||[]).map(x=>({...x,_week:i+1,_season:season})))));
   const tx=fetched.filter(r=>r.status==='fulfilled').flatMap(r=>r.value).filter(t=>t.status==='complete');
   if(!fetched.some(r=>r.status==='fulfilled'))throw Error(`${season}: all transaction weeks failed`);
   return {season,tx,mapping,partial:fetched.some(r=>r.status==='rejected')};
  }));
  state.transactionMappings=Object.fromEntries(data.map(d=>[d.season,d.mapping]));
  state.transactions=data.flatMap(d=>d.tx).filter((t,i,arr)=>arr.findIndex(x=>x._season===t._season&&x.transaction_id===t.transaction_id)===i).sort((a,b)=>(b.status_updated||b.created||0)-(a.status_updated||a.created||0));
  state.transactionStatus='ready';state.transactionsLastUpdated=new Date();state.transactionError=data.some(d=>d.partial)?'Some weeks could not be retrieved; history may be incomplete.':'';
  render();
  await loadPlayerNames();
 }catch(e){console.warn(e);state.transactionStatus='error';state.transactionError=e.message;renderTransactions()}
 finally{window.__txBusy=false}
}

async function init(){try{const [config,stories]=await Promise.all([fetch('data/config.json').then(r=>{if(!r.ok)throw Error('config.json missing');return r.json()}),fetch('data/stories.json').then(r=>{if(!r.ok)throw Error('stories.json missing');return r.json()})]);state.config=config;state.stories=stories;urlState();setupSelectors();render();loadLive();setInterval(loadTransactions,300000);}catch(err){console.error(err);$('#dataStatus').textContent='Unable to load site files. Use GitHub Pages or a local server.'}}
init();
