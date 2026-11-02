/* No build tools required: this site works directly on GitHub Pages. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '—';
const slug = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const state = {config:null,stories:[],team:'all',week:'all',type:'all',view:'home',rosters:[],users:[],standings:[],matchups:[],h2hGames:[],h2hStatus:"loading",live:false,article:null};
const api = async endpoint => {const res=await fetch(`https://api.sleeper.app/v1/league/${state.config.leagueId}/${endpoint}`);if(!res.ok)throw Error(`Sleeper ${endpoint}: ${res.status}`);return res.json()};
function urlState(){const p=new URLSearchParams(location.search);state.team=state.config.teams.some(t=>t.id===p.get('team'))?p.get('team'):'all';const w=p.get('week');state.week=w&&/^\d{1,2}$/.test(w)?w:'all';state.view=['home','archive','teams','standings'].includes(p.get('view'))?p.get('view'):'home';state.article=p.get('article')||null;if(state.article)state.view='article';}
function setUrl(){const p=new URLSearchParams();if(state.team!=='all')p.set('team',state.team);if(state.week!=='all')p.set('week',state.week);if(state.view!=='home'&&state.view!=='article')p.set('view',state.view);if(state.article)p.set('article',state.article);history.pushState({},'',`${location.pathname}${p.toString()?'?'+p:''}`);}
function teamName(id){return state.config.teams.find(t=>t.id===id)?.name||id}
function selectedRoster(){return state.rosters.find(r=>r.teamId===state.team)}
function mapTeams(){const teams=state.config.teams;const overrides=state.config.rosterOverrides||{};for(const roster of state.rosters){const owner=state.users.find(u=>String(u.user_id)===String(roster.owner_id));const sleeperName=owner?.metadata?.team_name||owner?.display_name||'';const custom=Object.entries(overrides).find(([,rid])=>Number(rid)===Number(roster.roster_id))?.[0];roster.teamId=custom || teams.find(t=>slug(t.name)===slug(sleeperName))?.id || null;roster.displayName=owner?.metadata?.team_name||owner?.display_name||`Roster ${roster.roster_id}`;roster.managerName=owner?.display_name||'Unknown manager';}
 // Match team names first; any remaining names use predictable roster-order fallback only when unambiguous.
 const unknown=state.rosters.filter(r=>!r.teamId), remaining=teams.filter(t=>!state.rosters.some(r=>r.teamId===t.id));
 if(unknown.length===1&&remaining.length===1)unknown[0].teamId=remaining[0].id;
}
function deriveStandings(){state.standings=state.rosters.map(r=>{const s=r.settings||{};const total=(key,dec)=>Number(s[key]||0)+Number(s[dec]||0)/100;return {...r,wins:s.wins||0,losses:s.losses||0,ties:s.ties||0,pf:total('fpts','fpts_decimal'),pa:total('fpts_against','fpts_against_decimal')}}).sort((a,b)=>b.wins-a.wins || a.losses-b.losses || b.pf-a.pf);}
async function loadLive(){try{const [rosters,users,league,nflState]=await Promise.all([api('rosters'),api('users'),fetch(`https://api.sleeper.app/v1/league/${state.config.leagueId}`).then(r=>{if(!r.ok)throw Error('league info unavailable');return r.json()}),fetch('https://api.sleeper.app/v1/state/nfl').then(r=>{if(!r.ok)throw Error('NFL state unavailable');return r.json()}).catch(()=>null)]);state.rosters=rosters;state.users=users;mapTeams();deriveStandings();state.live=true;$('#dataStatus').textContent='● Live league data via Sleeper';render();await loadHeadToHead(league,nflState);}catch(err){console.warn(err);state.h2hStatus='error';$('#dataStatus').textContent='Sleeper data unavailable · stories still accessible';render();}}
function matchupScore(m){const override=m.custom_points;return Number(override != null ? override : m.points);}
async function loadHeadToHead(league,nflState){
  try{
    // Read only completed weeks; exclude in-progress games so head-to-head totals do not change mid-matchup.
    const leagueSeason=String(league.season||state.config.season);
    const currentSeason=String(nflState?.season||'');
    let lastComplete=0;
    if(nflState && leagueSeason===currentSeason){
      if(nflState.season_type==='regular')lastComplete=Math.max(0,Number(nflState.week||1)-1);
      else if(nflState.season_type==='post')lastComplete=18;
    }else if(nflState && Number(leagueSeason)<Number(currentSeason))lastComplete=18;
    else if(!nflState || !league.season){state.h2hStatus='unavailable';render();return;}
    if(lastComplete===0){state.h2hStatus='empty';render();return;}
    const responses=await Promise.allSettled(Array.from({length:lastComplete},(_,i)=>api(`matchups/${i+1}`)));
    const games=[];let failed=0;
    for(let i=0;i<responses.length;i++){
      const result=responses[i];if(result.status!=='fulfilled'){failed++;continue;}
      const grouped=new Map();for(const m of result.value||[]){if(m.matchup_id == null)continue;const key=String(m.matchup_id);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(m);}
      for(const pair of grouped.values()){
        if(pair.length!==2)continue;
        const [a,b]=pair;const scoreA=matchupScore(a),scoreB=matchupScore(b);
        if(!Number.isFinite(scoreA)||!Number.isFinite(scoreB))continue;
        games.push({week:i+1,a:Number(a.roster_id),b:Number(b.roster_id),scoreA,scoreB});
      }
    }
    state.h2hGames=games;state.h2hStatus=failed?'partial':games.length?'ready':'empty';render();
  }catch(err){console.warn('H2H fetch failed',err);state.h2hStatus='error';render();}
}
function renderHeadToHead(roster){
  if(!roster)return '<div class="h2h-empty">Map this franchise to the correct Sleeper roster ID to show head-to-head records.</div>';
  const status=state.h2hStatus;
  if(status==='loading')return '<div class="h2h-empty">Loading head-to-head history…</div>';
  if(status==='unavailable'||status==='error')return '<div class="h2h-empty">Head-to-head results are unavailable. Check the season league ID and Sleeper connection.</div>';
  const opponents=state.config.teams.filter(t=>t.id!==roster.teamId);
  if(!opponents.length)return '<div class="h2h-empty">No opponents configured.</div>';
  const rows=opponents.map(t=>{
    const opp=state.rosters.find(r=>r.teamId===t.id);
    const games=opp?state.h2hGames.filter(g=>(g.a===roster.roster_id&&g.b===opp.roster_id)||(g.b===roster.roster_id&&g.a===opp.roster_id)):[];
    let w=0,l=0,ties=0,pf=0,pa=0;
    for(const g of games){const us=g.a===roster.roster_id?g.scoreA:g.scoreB;const them=g.a===roster.roster_id?g.scoreB:g.scoreA;pf+=us;pa+=them;if(us>them)w++;else if(us<them)l++;else ties++;}
    return `<tr><td>${safe(t.name)}</td><td>${opp?`${w}–${l}${ties?'–'+ties:''}`:'—'}</td><td>${games.length}</td><td>${games.length?fmt(pf):'—'}</td><td>${games.length?fmt(pa):'—'}</td></tr>`;
  });
  const played=state.h2hGames.filter(g=>g.a===roster.roster_id||g.b===roster.roster_id).length;
  return `<div class="h2h-heading"><div><div class="eyebrow">RIVALRY TRACKER</div><h3>Head-to-head records</h3></div><span class="muted">${played} completed matchups · ${safe(String(state.config.season))} season</span></div><div class="h2h-scroll"><table class="standings-table h2h-table"><thead><tr><th>Opponent</th><th>W–L–T</th><th>Games</th><th>PF</th><th>PA</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>${status==='partial'?'<p class="muted">Some weekly results could not be loaded; records may be incomplete.</p>':''}<p class="muted h2h-note">Regular season and postseason matchups are included when completed. Future and in-progress games are excluded.</p>`;
}
function setupSelectors(){const ts=$('#teamSelect'),ws=$('#weekSelect');for(const t of state.config.teams){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;ts.appendChild(o)}const weeks=new Set(state.stories.map(s=>String(s.week)));for(let w=1;w<=18;w++)weeks.add(String(w));for(const w of [...weeks].sort((a,b)=>Number(a)-Number(b))){const o=document.createElement('option');o.value=w;o.textContent=`Week ${w}`;ws.appendChild(o)}ts.addEventListener('change',e=>{state.team=e.target.value;state.article=null;change();});ws.addEventListener('change',e=>{state.week=e.target.value;state.article=null;change()});$('#resetFilters').addEventListener('click',()=>{state.team='all';state.week='all';state.type='all';state.article=null;change()});$$('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.article=null;change()});$$('[data-go]').forEach(b=>b.onclick=()=>{state.view=b.dataset.go;state.article=null;change()});$$('[data-type]').forEach(b=>b.onclick=()=>{state.type=b.dataset.type;change()});$('#backToArchive').onclick=()=>{state.view='archive';state.article=null;change()};window.addEventListener('popstate',()=>{urlState();render()});}
function change(){setUrl();render();window.scrollTo({top:0,behavior:'smooth'});}
function articleMatches(a){const teamMatch=state.team==='all'||a.teams?.includes('all')||a.teams?.includes(state.team);return teamMatch&&(state.week==='all'||String(a.week)===state.week)&&(state.type==='all'||a.type===state.type);}
function sortedStories(){return state.stories.filter(articleMatches).sort((a,b)=>b.season-a.season||b.week-a.week||String(b.date).localeCompare(String(a.date)))}
function storyCard(a){const art=document.createElement('article');art.className='story';art.innerHTML=`<div class="story-image" aria-hidden="true">${a.type==='preview'?'VS':a.type==='recap'?'W':'H'}</div><div class="story-body"><span class="tag">${safe(a.type)} · ${safe(a.season)} · WEEK ${safe(a.week)}</span><h3>${safe(a.title)}</h3><p>${safe(a.summary)}</p><button type="button">Read story →</button></div>`;art.querySelector('button').onclick=()=>{state.article=a.id;state.view='article';change()};return art;}
function renderStories(el,stories){el.replaceChildren();if(!stories.length){el.innerHTML='<div class="empty">No coverage matches these filters yet. Upload a recap or preview Markdown file to the articles folder.</div>';return}stories.forEach(a=>el.appendChild(storyCard(a)))}
function renderTable(el,limit=Infinity){const rows=state.standings.slice(0,limit);if(!rows.length){el.innerHTML='<p class="muted">Standings will appear when Sleeper data becomes available.</p>';return}const table=document.createElement('table');table.className='standings-table';table.innerHTML='<thead><tr><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th></tr></thead><tbody></tbody>';rows.forEach((r,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><button class="teamlink">${i+1}. ${safe(r.teamId?teamName(r.teamId):r.displayName)}</button></td><td>${r.wins}</td><td>${r.losses}</td><td>${fmt(r.pf)}</td><td>${fmt(r.pa)}</td>`;tr.querySelector('button').onclick=()=>{if(r.teamId){state.team=r.teamId;state.view='teams';state.article=null;change()}};table.tBodies[0].appendChild(tr)});el.replaceChildren(table)}
function renderTeamPanel(){const el=$('#teamPanel');el.hidden=state.team==='all';if(el.hidden)return;const r=selectedRoster();const match=state.matchups.find(m=>Number(m.roster_id)===Number(r?.roster_id));const opponent=match&&state.matchups.find(m=>m.matchup_id===match.matchup_id&&m.roster_id!==match.roster_id);const oppRoster=opponent&&state.rosters.find(a=>a.roster_id===opponent.roster_id);const record=r?`${r.settings?.wins||0}–${r.settings?.losses||0}${r.settings?.ties?'–'+r.settings.ties:''}`:'—';const s=state.standings.find(a=>a.roster_id===r?.roster_id);const rank=s?state.standings.indexOf(s)+1:'—';el.innerHTML=`<div class="eyebrow">FRANCHISE HEADQUARTERS</div><h2>${safe(teamName(state.team))}</h2><div class="muted">${r?`Manager: ${safe(r.managerName)}`:'Map this team to its Sleeper roster to show its stats.'}</div><div class="metrics"><div class="metric"><small>Record</small><b>${record}</b></div><div class="metric"><small>League rank</small><b>${rank}${rank==='—'?'':' / '+state.standings.length}</b></div><div class="metric"><small>Points for</small><b>${s?fmt(s.pf):'—'}</b></div><div class="metric"><small>Points against</small><b>${s?fmt(s.pa):'—'}</b></div></div><div class="team-details"><div class="detail"><strong>Current roster</strong>${r?`${r.players?.length||0} players on roster · ${r.starters?.length||0} starter slots`:'Live roster not matched'}<br><span class="muted">Roster/player details can be expanded in the next version.</span></div><div class="detail"><strong>Weekly matchup</strong>${oppRoster?`Vs. ${safe(oppRoster.teamId?teamName(oppRoster.teamId):oppRoster.displayName)} · ${fmt(Number(match.custom_points??match.points))} – ${fmt(Number(opponent.custom_points??opponent.points))}`:'Select a week to view a matchup, if available.'}</div></div><section class="h2h-section">${renderHeadToHead(r)}</section>`;}
function renderTeams(){const el=$('#teamGrid');el.replaceChildren();state.config.teams.forEach(t=>{const r=state.rosters.find(r=>r.teamId===t.id);const b=document.createElement('button');b.className='team-tile';b.innerHTML=`<span class="symbol">${safe(t.name[0])}</span><h3>${safe(t.name)}</h3><p>${r?`${r.settings?.wins||0}–${r.settings?.losses||0} · ${safe(r.managerName)}`:'View franchise dashboard'} →</p>`;b.onclick=()=>{state.team=t.id;state.view='home';state.article=null;change()};el.appendChild(b)})}
function renderArticle(){const el=$('#articleBody');const a=state.stories.find(s=>s.id===state.article);if(!a){el.innerHTML='<h1>Article not found</h1><p>Check the link or return to coverage.</p>';return}el.innerHTML=`<div class="eyebrow">${safe(a.type)} · SEASON ${safe(a.season)} · WEEK ${safe(a.week)}</div><h1>${safe(a.title)}</h1><p class="lead">${safe(a.summary)}</p><div class="article-content">${a.bodyHtml || (a.paragraphs||[]).map(p=>`<p>${safe(p)}</p>`).join('')}</div>`;document.title=`${a.title} | HUSCFFL`}
function render(){if(!state.config)return;document.title='HUSCFFL | League Headquarters';$('#teamSelect').value=state.team;$('#weekSelect').value=state.week;renderTeamPanel();let stories=sortedStories();renderStories($('#featuredStories'),stories.slice(0,3));renderStories($('#archiveStories'),stories);$('#storyCount').textContent=`${stories.length} ${stories.length===1?'story':'stories'}`;renderTable($('#homeStandings'),6);renderTable($('#fullStandings'));renderTeams();$$('[data-type]').forEach(b=>b.classList.toggle('on',b.dataset.type===state.type));$$('.view').forEach(v=>v.hidden=v.id!==`${state.view}View`);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));if(state.view==='article')renderArticle();}
async function init(){try{const [config,stories]=await Promise.all([fetch('data/config.json').then(r=>{if(!r.ok)throw Error('config.json missing');return r.json()}),fetch('data/stories.json').then(r=>{if(!r.ok)throw Error('stories.json missing');return r.json()})]);state.config=config;state.stories=stories;urlState();setupSelectors();render();loadLive();}catch(err){console.error(err);$('#dataStatus').textContent='Unable to load site files. Use GitHub Pages or a local server.'}}
init();
