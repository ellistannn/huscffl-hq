/* No build tools required: this site works directly on GitHub Pages. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '—';
const slug = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const state = {config:null,stories:[],team:'all',week:'all',type:'all',view:'home',rosters:[],users:[],standings:[],historicalStandings:{},standingsSeason:'2026',teamRecordSeason:'2026',coverageSeason:'2026',matchups:[],h2hGames:[],h2hStatus:"loading",h2hSeason:"all",h2hWarnings:[],live:false,article:null,transactions:[],transactionSeason:'2026',transactionType:'all',transactionTeam:'all',transactionStatus:'loading',transactionsLastUpdated:null,transactionNames:{},transactionMappings:{},transactionError:'',scoring:{},scoringStatus:'loading',scoringSeason:'2026'};
const standingsSort={home:{key:'rank',direction:'asc'},full:{key:'rank',direction:'asc'}};
const seasonWeeks = season => Number(state.config?.seasonWeeks?.[String(season)] || (String(season)==='2025'?16:17));
const api = async endpoint => {const res=await fetch(`https://api.sleeper.app/v1/league/${state.config.leagueId}/${endpoint}`);if(!res.ok)throw Error(`Sleeper ${endpoint}: ${res.status}`);return res.json()};
function urlState(){const p=new URLSearchParams(location.search);state.team=state.config.teams.some(t=>t.id===p.get('team'))?p.get('team'):'all';const s=p.get('season');state.coverageSeason=(s&&state.config.leagueIds?.[s])?s:String(state.config.season);const w=p.get('week');state.week=w&&/^\d{1,2}$/.test(w)?w:'all';state.view=['home','archive','teams','standings','transactions','constitution','scoring'].includes(p.get('view'))?p.get('view'):'home';state.article=p.get('article')||null;if(state.article)state.view='article';if(state.view!=='teams'&&state.view!=='article')state.team='all';}
function setUrl(){const p=new URLSearchParams();if(state.view==='teams'&&state.team!=='all')p.set('team',state.team);if(state.coverageSeason!==String(state.config.season))p.set('season',state.coverageSeason);if(state.week!=='all')p.set('week',state.week);if(state.view!=='home'&&state.view!=='article')p.set('view',state.view);if(state.article)p.set('article',state.article);history.pushState({},'',`${location.pathname}${p.toString()?'?'+p:''}`);}
function change(){setUrl();render()}
function teamName(id){return state.config.teams.find(t=>t.id===id)?.name||id}
function teamLogoSrc(id){return id?`assets/team-logos/${id}.png`:''}
function teamLogoMarkup(id,name,cls='team-logo'){
 if(!id)return '';
 const img=`<img class="${safe(cls)}" src="${safe(teamLogoSrc(id))}" alt="${safe(name||teamName(id))} logo" loading="lazy">`;
 return id==='new-york-noodles'?`<span class="championship-logo" title="2025 League Champion">${img}<span class="championship-badge" aria-label="2025 League Champion">🏆</span></span>`:img;
}
function articleTeamIds(a){return (a?.teams||[]).filter(t=>t&&t!=='all'&&state.config.teams.some(team=>team.id===t))}
function selectedRoster(){return state.rosters.find(r=>r.teamId===state.team)}
function mapTeams(){const teams=state.config.teams;const overrides=state.config.rosterOverrides||{};for(const roster of state.rosters){const owner=state.users.find(u=>String(u.user_id)===String(roster.owner_id));const sleeperName=owner?.metadata?.team_name||owner?.display_name||'';const custom=Object.entries(overrides).find(([,rid])=>Number(rid)===Number(roster.roster_id))?.[0];roster.teamId=custom || teams.find(t=>slug(t.name)===slug(sleeperName))?.id || null;roster.displayName=owner?.metadata?.team_name||owner?.display_name||`Roster ${roster.roster_id}`;roster.managerName=owner?.display_name||'Unknown manager';}
 // Match team names first; any remaining names use predictable roster-order fallback only when unambiguous.
 const unknown=state.rosters.filter(r=>!r.teamId), remaining=teams.filter(t=>!state.rosters.some(r=>r.teamId===t.id));
 if(unknown.length===1&&remaining.length===1)unknown[0].teamId=remaining[0].id;
}
function deriveStandings(){state.standings=state.rosters.map(r=>{const s=r.settings||{};const total=(key,dec)=>Number(s[key]||0)+Number(s[dec]||0)/100;return {...r,wins:s.wins||0,losses:s.losses||0,ties:s.ties||0,pf:total('fpts','fpts_decimal'),pa:total('fpts_against','fpts_against_decimal'),maxpf:total('ppts','ppts_decimal')}}).sort((a,b)=>b.wins-a.wins || a.losses-b.losses || b.pf-a.pf);}
async function loadScoring(){
 const seasons=Object.entries(state.config.leagueIds||{});
 const owners=new Map(state.rosters.filter(r=>r.teamId).map(r=>[String(r.owner_id),r.teamId]));
 const names=new Map(state.config.teams.map(t=>[slug(t.name),t.id]));
 const nfl=await fetch('https://api.sleeper.app/v1/state/nfl').then(r=>r.json()).catch(()=>null);
 await Promise.all(seasons.map(async ([year,leagueId])=>{
  try{
   const root=`https://api.sleeper.app/v1/league/${leagueId}`;
   const get=async path=>{const r=await fetch(root+path);if(!r.ok)throw Error('Sleeper HTTP '+r.status);return r.json()};
   const [league,rosters,users]=await Promise.all([get(''),get('/rosters'),get('/users')]);
   const userMap=new Map(users.map(u=>[String(u.user_id),u]));
   const overrides=year===String(state.config.season)?state.config.rosterOverrides||{}:state.config.historicalRosterOverrides?.[year]||{};
   const map=new Map();
   for(const r of rosters){
    const u=userMap.get(String(r.owner_id));
    const labels=[u?.metadata?.team_name,r.metadata?.team_name,u?.display_name];
    const tid=Object.entries(overrides).find(([,rid])=>Number(rid)===Number(r.roster_id))?.[0]||labels.map(n=>names.get(slug(n))).find(Boolean)||owners.get(String(r.owner_id));
    if(tid)map.set(Number(r.roster_id),tid);
   }
   const seasonCount=seasonWeeks(year);
   const completed=Number(year)<Number(nfl?.season)?seasonCount:Number(year)===Number(nfl?.season)?(nfl.season_type==='regular'?Math.max(0,Number(nfl.week||1)-1):seasonCount):0;
   const upto=Math.min(completed,seasonCount);
   const slots=(league.roster_positions||[]).filter(x=>x!=='BN'&&x!=='IR'&&x!=='TAXI');
   const offensive=new Set(['QB','RB','WR','TE','FLEX','WRRB_FLEX','REC_FLEX','SUPER_FLEX','SUPERFLEX','SFLX']);
   const defensive=new Set(['DL','DE','DT','LB','DB','CB','S','IDP_FLEX','IDP','DEF','EDGE']);
   const results=await Promise.allSettled(Array.from({length:upto},(_,w)=>get('/matchups/'+(w+1))));
   const rows=Object.fromEntries(state.config.teams.map(t=>[t.id,[]]));
   let failed=0,unmapped=0,unclassified=0;
   for(let w=0;w<results.length;w++){
    if(results[w].status!=='fulfilled'){failed++;continue}
    for(const match of results[w].value||[]){
     const id=map.get(Number(match.roster_id));if(!id){unmapped++;continue}
     const starters=match.starters||[],points=match.players_points||{};
     if(!starters.length)continue;
     let offense=0,defense=0,unknown=0;
     for(let j=0;j<starters.length;j++){
      const slot=slots[j],pid=starters[j],val=Number(points[pid]??0);
      if(!Number.isFinite(val))continue;
      if(offensive.has(slot))offense+=val;
      else if(defensive.has(slot))defense+=val;
      else unknown+=val;
     }
     if(unknown!==0)unclassified++;
     rows[id].push({week:w+1,offense:Number(offense.toFixed(2)),defense:Number(defense.toFixed(2)),total:Number((offense+defense).toFixed(2)),unknown:Number(unknown.toFixed(2)),opponent:null,points:Number(match.custom_points??match.points??offense+defense),matchupId:match.matchup_id,rosterId:match.roster_id});
    }
    const paired=new Map();
    for(const match of results[w].value||[]){if(match.matchup_id==null)continue;const key=String(match.matchup_id);if(!paired.has(key))paired.set(key,[]);paired.get(key).push(match)}
    for(const pair of paired.values()){if(pair.length!==2)continue;for(const m of pair){const id=map.get(Number(m.roster_id));const opp=pair.find(x=>x!==m);const item=rows[id]?.find(x=>x.week===w+1&&Number(x.rosterId)===Number(m.roster_id));if(item)item.opponent={id:map.get(Number(opp.roster_id)),score:Number(opp.custom_points??opp.points),name:teamName(map.get(Number(opp.roster_id)))};}}
   }
   state.scoring[year]={rows,failed,unmapped,unclassified,upto};
  }catch(err){console.warn('Scoring data '+year,err);state.scoring[year]={rows:{},error:String(err)}}
 }));
 state.scoringStatus='ready';render();
}
function scoringRows(season){
 const data=state.scoring[String(season)]?.rows||{};
 return state.config.teams.map(t=>{const weeks=data[t.id]||[];const sum=k=>weeks.reduce((a,w)=>a+w[k],0);const off=sum('offense'),def=sum('defense'),n=weeks.length;return {...t,off,def,total:off+def,avg:n?(off+def)/n:0,avgOff:n?off/n:0,avgDef:n?def/n:0,games:n}}).sort((a,b)=>b.total-a.total);
}
function seasonStandingsRanks(season){
 const source=season===String(state.config.season)?state.standings:state.historicalStandings[season]||[];
 return new Map(source.map((r,i)=>[r.teamId,i+1]));
}
function scoringTeamClick(event,season){const button=event.target.closest('[data-team]');if(!button)return;state.team=button.dataset.team;state.coverageSeason=season;state.week='all';rebuildWeekOptions();state.view='teams';state.article=null;change()}
function renderScoring(){
 const area=$('#scoringTable');if(!area)return;
 const season=state.scoringSeason,current=state.scoring[season];$('#scoringSeason').value=season;
 if(!current){area.innerHTML='<p class="muted">Loading weekly scoring data from Sleeper…</p>';renderComparison();return}
 if(current.error){area.innerHTML='<p class="muted">Scoring data unavailable: '+safe(current.error)+'</p>';renderComparison();return}
 const ranks=seasonStandingsRanks(season);
 const rows=scoringRows(season).map(t=>({...t,rank:ranks.get(t.id)??null}));
 const headers=[['rank','Rank'],['name','Team'],['games','Weeks'],['total','Total'],['off','Offense'],['def','Defense'],['avg','Avg total'],['avgOff','Avg offense'],['avgDef','Avg defense']];
 const sort=state.scoringSort||{key:'rank',dir:1};
 rows.sort((a,b)=>{const k=sort.key;if(k==='name')return a.name.localeCompare(b.name)*sort.dir;const aa=a[k]??Infinity,bb=b[k]??Infinity;return (aa-bb)*sort.dir});
 area.innerHTML=`<table class="scoring-table standings-table"><thead><tr>${headers.map(([key,label])=>`<th><button type="button" class="sort-header" data-scoring-sort="${key}" aria-label="Sort by ${label}">${label}${sort.key===key?(sort.dir===1?' ▲':' ▼'):' ↕'}</button></th>`).join('')}</tr></thead><tbody>${rows.map(t=>`<tr><td>${t.rank??'—'}</td><td><button type="button" class="scoring-team-button" data-team="${safe(t.id)}">${teamLogoMarkup(t.id,t.name,'table-team-logo')}<span>${safe(t.name)}</span></button></td><td>${t.games}</td>${['total','off','def','avg','avgOff','avgDef'].map(k=>`<td>${t.games?fmt(t[k]):'—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 area.onclick=e=>{const target=e.target.closest('[data-scoring-sort]');if(target){const k=target.dataset.scoringSort;state.scoringSort={key:k,dir:sort.key===k?-sort.dir:(k==='rank'||k==='name'?1:-1)};renderScoring();return}scoringTeamClick(e,season)};
 const notes=$('#scoringNote');if(notes)notes.textContent=`${season}: ${current.upto||0} completed weeks checked. ${current.failed?'Some weeks failed to load. ':''}${current.unmapped?'Some rosters could not be mapped. ':''}${current.unclassified?'Some player slots could not be classified. ':''}Averages use weeks with returned starting lineups.`;
 renderComparison();
}
function renderComparison(){
 const area=$('#offenseDefenseComparison');if(!area)return;
 const all=scoringRows(state.scoringSeason).filter(t=>t.games>0);
 if(!all.length){area.innerHTML='<p class="muted">Comparison will appear when weekly scoring data is available.</p>';return}
 const meanX=all.reduce((x,t)=>x+t.avgOff,0)/all.length,meanY=all.reduce((x,t)=>x+t.avgDef,0)/all.length;
 const maxX=Math.max(...all.map(t=>t.avgOff),meanX)*1.12,minX=Math.max(0,Math.min(...all.map(t=>t.avgOff),meanX)*.85);
 const maxY=Math.max(...all.map(t=>t.avgDef),meanY)*1.15,minY=Math.max(0,Math.min(...all.map(t=>t.avgDef),meanY)*.8);
 const x=n=>65+(n-minX)/(maxX-minX||1)*680,y=n=>345-(n-minY)/(maxY-minY||1)*300;
 const points=all.map(t=>`<g class="comparison-dot" data-team="${safe(t.id)}"><circle cx="${x(t.avgOff).toFixed(2)}" cy="${y(t.avgDef).toFixed(2)}" r="${state.compareTeam===t.id?11:7}" fill="${state.compareTeam===t.id?'#bb4f67':'#42649c'}" stroke="white" stroke-width="2" tabindex="0"><title>${safe(t.name)} · Offense ${fmt(t.avgOff)} · Defense ${fmt(t.avgDef)} points/week</title></circle></g>`).join('');
 area.innerHTML=`<div class="compare-controls"><label>Highlight team <select id="compareTeam"><option value="">All teams</option>${all.map(t=>`<option value="${safe(t.id)}" ${state.compareTeam===t.id?'selected':''}>${safe(t.name)}</option>`).join('')}</select></label><span class="muted">League average offense: ${fmt(meanX)} · Defense: ${fmt(meanY)}</span></div><svg class="comparison-svg" viewBox="0 0 800 405" role="img" aria-label="All franchise average weekly offense versus defense scoring"><line x1="${x(meanX)}" y1="30" x2="${x(meanX)}" y2="345" stroke="#b38b9c" stroke-dasharray="5 5"/><line x1="65" y1="${y(meanY)}" x2="745" y2="${y(meanY)}" stroke="#b38b9c" stroke-dasharray="5 5"/><line x1="65" y1="345" x2="745" y2="345" stroke="#82727a"/><line x1="65" y1="30" x2="65" y2="345" stroke="#82727a"/><text x="400" y="385" text-anchor="middle">Average offensive points / week →</text><text x="19" y="198" text-anchor="middle" transform="rotate(-90 19 198)">Average defensive points / week →</text><text x="75" y="47" fill="#777">Defense-led</text><text x="737" y="47" text-anchor="end" fill="#777">Strong both ways</text>${points}</svg><p class="muted">Each point represents one franchise. Hover or tap for team and scoring averages. Dashed lines are the league averages.</p>`;
 area.querySelector('#compareTeam').onchange=e=>{state.compareTeam=e.target.value;renderComparison()};
 area.querySelectorAll('[data-team]').forEach(node=>node.onclick=()=>{state.compareTeam=node.dataset.team;renderComparison()});
}
function renderTeamRankings(){
 const area=$('#teamRankings');if(!area)return;
 if(state.team==='all'){area.hidden=true;return}area.hidden=false;
 const rows=scoringRows(state.coverageSeason).filter(t=>t.games>0),own=rows.find(t=>t.id===state.team);
 if(!own){area.innerHTML='<h3>League scoring comparison</h3><p class="muted">No completed scoring data for this franchise and season.</p>';return}
 const metrics=[['Offense','avgOff'],['Defense','avgDef'],['Combined','avg']];
 area.innerHTML=`<h3>League scoring comparison · ${safe(state.coverageSeason)}</h3><div class="ranking-bars">${metrics.map(([label,key])=>{const ordered=[...rows].sort((a,b)=>b[key]-a[key]);const rank=ordered.findIndex(t=>t.id===own.id)+1;return `<div class="ranking-item"><div class="ranking-heading"><strong>${label}</strong><span>${rank} of ${rows.length} · ${fmt(own[key])} PPG</span></div><div class="ranking-track"><div class="ranking-fill" style="width:${(rows.length-rank+1)/rows.length*100}%"></div></div></div>`}).join('')}</div><p class="muted">Bars show league ranking, not share of total points. Completed weeks only.</p>`;
}
function scoringChart(id,season){
 const weeks=state.scoring[season]?.rows?.[id]||[];
 if(!weeks.length)return '<p class="muted">No completed weekly offense/defense data available yet for this season or team.</p>';
 const max=Math.max(1,...weeks.map(w=>Math.max(w.offense,w.defense)))*1.15;
 const W=740,H=260,left=48,right=16,top=15,bottom=38;
 const x=w=>left+(w.week-1)/(Math.max(2,seasonWeeks(season))-1)*(W-left-right);
 const y=v=>top+(1-v/max)*(H-top-bottom);
 const mk=(key,color)=>`<polyline fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${weeks.map(w=>x(w).toFixed(1)+','+y(w[key]).toFixed(1)).join(' ')}"/>${weeks.map(w=>`<circle cx="${x(w).toFixed(1)}" cy="${y(w[key]).toFixed(1)}" r="4" fill="${color}"><title>Week ${w.week}: ${key} ${Number(w[key]).toFixed(2)} points</title></circle>`).join('')}`;
 return `<div class="chart-key"><span><i class="chart-off"></i> Offense</span><span><i class="chart-def"></i> Defense</span></div><svg class="weekly-score-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${safe(teamName(id))} weekly offense and defense scores"><g stroke="#e7d8da" stroke-width="1">${[0,.25,.5,.75,1].map(f=>`<line x1="${left}" y1="${y(max*f)}" x2="${W-right}" y2="${y(max*f)}"/>`).join('')}</g><g fill="#79646e" font-size="11">${[0,.25,.5,.75,1].map(f=>`<text x="${left-8}" y="${y(max*f)+4}" text-anchor="end">${Math.round(max*f)}</text>`).join('')}${Array.from({length:seasonWeeks(season)},(_,i)=>`<text x="${x({week:i+1})}" y="${H-13}" text-anchor="middle">${i+1}</text>`).join('')}</g>${mk('offense','#bb4f67')}${mk('defense','#42649c')}</svg><p class="muted">Scores reflect active offensive and IDP starters in completed weeks. Hover over chart points for values.</p>`;
}
function renderTeamScoring(){
 const el=$('#teamScoring');if(!el)return;
 if(state.team==='all'){el.hidden=true;return}el.hidden=false;
 const season=state.coverageSeason,week=state.week;
 const rows=state.scoring[season]?.rows?.[state.team]||[];
 if(week==='all'){el.innerHTML=`<h3>Offense vs. Defense · ${safe(season)}</h3>${scoringChart(state.team,season)}`;return}
 const w=rows.find(x=>x.week===Number(week));
 if(!w){el.innerHTML=`<h3>${safe(season)} · Week ${safe(week)}</h3><p class="muted">No completed matchup results available yet. Future matchups will appear once Sleeper publishes the results.</p>`;return}
 const opp=w.opponent,won=opp?(w.points>opp.score?'Win':w.points<opp.score?'Loss':'Tie'):'Result unavailable';
 el.innerHTML=`<h3>${safe(season)} · Week ${safe(week)}</h3><div class="weekly-matchup">${opp?.id?teamLogoMarkup(opp.id,teamName(opp.id),'transaction-logo'):''}<strong>${opp?`vs ${safe(opp.name)} · ${fmt(w.points)}–${fmt(opp.score)} · ${won}`:'Opponent unavailable'}</strong></div><div class="weekly-stats"><div><small>Offense</small><strong>${fmt(w.offense)}</strong></div><div><small>Defense</small><strong>${fmt(w.defense)}</strong></div><div><small>Combined starters</small><strong>${fmt(w.total)}</strong></div></div><p class="muted">Weekly recap and preview cards are filtered above by your selected team, season, and week. Individual player lineups will require an additional player-name lookup.</p>`;
}
async function loadLive(){try{const [rosters,users,league,nflState]=await Promise.all([api('rosters'),api('users'),fetch(`https://api.sleeper.app/v1/league/${state.config.leagueId}`).then(r=>{if(!r.ok)throw Error('league info unavailable');return r.json()}),fetch('https://api.sleeper.app/v1/state/nfl').then(r=>{if(!r.ok)throw Error('NFL state unavailable');return r.json()}).catch(()=>null)]);state.rosters=rosters;state.users=users;mapTeams();deriveStandings();state.live=true;loadHistoricalStandings();$('#dataStatus').textContent='● Live league data via Sleeper';render();loadTransactions();loadScoring();await loadHeadToHead(league,nflState);}catch(err){console.warn(err);state.h2hStatus='error';$('#dataStatus').textContent='Sleeper data unavailable · stories still accessible';render();}}

async function loadHistoricalStandings(){
  const currentOwners=new Map(state.rosters.filter(r=>r.teamId).map(r=>[String(r.owner_id),r.teamId]));
  const nameMap=new Map(state.config.teams.map(t=>[slug(t.name),t.id]));
  const seasons=Object.entries(state.config.leagueIds||{}).filter(([year])=>year!==String(state.config.season));
  await Promise.all(seasons.map(async ([year,id])=>{
    try{
      const base=`https://api.sleeper.app/v1/league/${id}`;
      const read=async endpoint=>{const res=await fetch(`${base}/${endpoint}`);if(!res.ok)throw Error(`${year} ${endpoint}: ${res.status}`);return res.json()};
      const [rosters,users]=await Promise.all([read('rosters'),read('users')]);
      const userMap=new Map(users.map(u=>[String(u.user_id),u]));
      const overrides=state.config.historicalRosterOverrides?.[year]||{};
      const rows=rosters.map(r=>{
        const user=userMap.get(String(r.owner_id));
        const names=[user?.metadata?.team_name,r.metadata?.team_name,user?.display_name];
        const teamId=Object.entries(overrides).find(([,rid])=>Number(rid)===Number(r.roster_id))?.[0]||names.map(n=>nameMap.get(slug(n))).find(Boolean)||currentOwners.get(String(r.owner_id));
        const settings=r.settings||{};
        const points=(key,decimal)=>Number(settings[key]||0)+Number(settings[decimal]||0)/100;
        return {...r,teamId,displayName:names.find(Boolean)||`Roster ${r.roster_id}`,wins:settings.wins||0,losses:settings.losses||0,ties:settings.ties||0,pf:points('fpts','fpts_decimal'),pa:points('fpts_against','fpts_against_decimal'),maxpf:points('ppts','ppts_decimal')};
      }).sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.pf-a.pf);
      state.historicalStandings[year]=rows;
    }catch(err){console.warn('Historical standings unavailable:',year,err);state.historicalStandings[year]=[]}
  }));
  render();
}

function matchupScore(m){const override=m.custom_points;return Number(override != null ? override : m.points);}
async function fetchSeasonGames(season,leagueId,nflState){
  const base=`https://api.sleeper.app/v1/league/${leagueId}`;
  const get=async path=>{const r=await fetch(`${base}/${path}`);if(!r.ok)throw Error(`${season}: ${path} (${r.status})`);return r.json()};
  const [league,rosters,users]=await Promise.all([get(''),get('rosters'),get('users')]);
  const seasonNum=Number(league.season||season), current=Number(nflState?.season);
  let completed=0;
  if(current && seasonNum<current) completed=seasonWeeks(season);
  else if(current && seasonNum===current){
    completed=nflState.season_type==='regular'?Math.max(0,Number(nflState.week||1)-1):seasonWeeks(season);
  } else if(seasonNum<new Date().getFullYear())completed=seasonWeeks(season);
  else throw Error(`Cannot determine completed weeks for ${season}`);
  completed=Math.min(completed,seasonWeeks(season));
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
function rebuildWeekOptions(){const ws=$('#weekSelect');const max=seasonWeeks(state.coverageSeason);ws.replaceChildren(new Option('All weeks','all'));for(let w=1;w<=max;w++)ws.add(new Option(`Week ${w}`,String(w)));if(state.week!=='all'&&Number(state.week)>max)state.week='all';ws.value=state.week;$('#coverageSeason').value=state.coverageSeason;}
function setupSelectors(){
 const ts=$('#teamSelect'),ws=$('#weekSelect');for(const t of state.config.teams)ts.add(new Option(t.name,t.id));
 rebuildWeekOptions();
 ts.addEventListener('change',e=>{state.team=e.target.value;state.article=null;change()});
 $('#coverageSeason').addEventListener('change',e=>{state.coverageSeason=e.target.value;state.week='all';state.article=null;rebuildWeekOptions();change()});
 ws.addEventListener('change',e=>{state.week=e.target.value;state.article=null;change()});
 $('#resetFilters').addEventListener('click',()=>{state.team='all';state.week='all';state.type='all';state.coverageSeason=String(state.config.season);state.article=null;rebuildWeekOptions();change()});
 $$('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.article=null;if(state.view!=='teams')state.team='all';change()});
 $$('[data-go]').forEach(b=>b.onclick=()=>{state.view=b.dataset.go;state.article=null;if(state.view!=='teams')state.team='all';change()});
 $$('[data-type]').forEach(b=>b.onclick=()=>{state.type=b.dataset.type;change()});
 setupTransactionControls();
 const standingsPicker=$('#standingsSeason');if(standingsPicker)standingsPicker.addEventListener('change',e=>{state.standingsSeason=e.target.value;render()});$('#scoringSeason').onchange=e=>{state.scoringSeason=e.target.value;renderScoring()};
 $('#backToArchive').onclick=()=>{state.view='archive';state.article=null;change()};
 window.addEventListener('popstate',()=>{urlState();rebuildWeekOptions();render()});
}
function articleMatches(a){const teamMatch=state.team==='all'||a.teams?.includes('all')||a.teams?.includes(state.team);return teamMatch&&String(a.season)===state.coverageSeason&&(state.week==='all'||String(a.week)===state.week)&&(state.type==='all'||a.type===state.type);}
function sortedStories(){return state.stories.filter(articleMatches).sort((a,b)=>b.season-a.season||b.week-a.week||String(b.date).localeCompare(String(a.date)))}
function storyCard(a){const art=document.createElement('article');art.className='story';const ids=articleTeamIds(a);const hero=ids.length?`<div class="story-logo-row">${ids.slice(0,2).map(id=>teamLogoMarkup(id,teamName(id),'story-logo')).join(ids.length===2?'<span class="story-versus">VS</span>':'')}</div>`:`<div class="story-mark">${a.type==='preview'?'VS':a.type==='recap'?'W':'H'}</div>`;art.innerHTML=`<div class="story-image" aria-hidden="true">${hero}</div><div class="story-body"><span class="tag">${safe(a.type)} · ${safe(a.season)} · WEEK ${safe(a.week)}</span><h3>${safe(a.title)}</h3><p>${safe(a.summary)}</p><button type="button">Read story →</button></div>`;art.querySelector('button').onclick=()=>{state.article=a.id;state.view='article';change()};return art;}
function renderStories(el,stories){el.replaceChildren();if(!stories.length){el.innerHTML='<div class="empty">No coverage matches these filters yet. Upload a recap or preview Markdown file to the articles folder.</div>';return}stories.forEach(a=>el.appendChild(storyCard(a)))}
function renderTable(el,limit=Infinity,season=state.standingsSeason){
 const raw=(season===String(state.config.season)?state.standings:state.historicalStandings[season]||[]).slice(0,limit);
 if(!raw.length){el.innerHTML='<p class="muted">Standings will appear when Sleeper data becomes available.</p>';return}
 const scope=el.id==='homeStandings'?'home':'full',sort=standingsSort[scope];
 const rows=raw.map((r,i)=>({...r,officialRank:i+1}));
 const key=sort.key,dir=sort.direction==='asc'?1:-1;
 rows.sort((a,b)=>{let cmp=key==='name'?teamName(a.teamId||'').localeCompare(teamName(b.teamId||'')):key==='rank'?a.officialRank-b.officialRank:Number(a[key]??0)-Number(b[key]??0);return cmp*dir || a.officialRank-b.officialRank});
 const table=document.createElement('table');table.className='standings-table';table.setAttribute('aria-label',season+' standings including maximum potential points');
 const headers=[['rank','Rank'],['name','Team'],['wins','W'],['losses','L'],['pf','PF'],['pa','PA'],['maxpf','Max PF']];
 const thead=document.createElement('thead'),headerRow=document.createElement('tr');
 for(const [k,label] of headers){const th=document.createElement('th');if(['rank','name','pf','pa','maxpf'].includes(k)){const button=document.createElement('button');button.type='button';button.className='sort-header';button.textContent=label+(sort.key===k?(sort.direction==='asc'?' ▲':' ▼'):' ↕');button.setAttribute('aria-label',`Sort by ${label}`);th.setAttribute('aria-sort',sort.key===k?(sort.direction==='asc'?'ascending':'descending'):'none');button.onclick=()=>{if(sort.key===k)sort.direction=sort.direction==='asc'?'desc':'asc';else{sort.key=k;sort.direction=['pf','pa','maxpf'].includes(k)?'desc':'asc'}renderTable(el,limit,season)};th.appendChild(button)}else th.textContent=label;headerRow.appendChild(th)}thead.appendChild(headerRow);table.appendChild(thead);
 const tbody=document.createElement('tbody');
 rows.forEach(r=>{const tr=document.createElement('tr');const label=r.teamId?teamName(r.teamId):r.displayName;tr.innerHTML=`<td>${r.officialRank}</td><td><div class="team-cell">${r.teamId?teamLogoMarkup(r.teamId,label,'table-team-logo'):''}<button class="teamlink">${safe(label)}</button></div></td><td>${r.wins}</td><td>${r.losses}</td><td>${fmt(r.pf)}</td><td>${fmt(r.pa)}</td><td>${fmt(r.maxpf)}</td>`;tr.querySelector('.teamlink').onclick=()=>{if(r.teamId){state.team=r.teamId;state.view='teams';state.article=null;change()}};tbody.appendChild(tr)});table.appendChild(tbody);el.replaceChildren(table)
}
function renderTeamPanel(){const el=$('#teamPanel');el.hidden=state.team==='all';if(el.hidden)return;const r=selectedRoster();const match=state.matchups.find(m=>Number(m.roster_id)===Number(r?.roster_id));const opponent=match&&state.matchups.find(m=>m.matchup_id===match.matchup_id&&m.roster_id!==match.roster_id);const oppRoster=opponent&&state.rosters.find(a=>a.roster_id===opponent.roster_id);const season=state.coverageSeason;const rosterRows=season===String(state.config.season)?state.standings:(state.historicalStandings[season]||[]);const s=rosterRows.find(a=>a.teamId===state.team);const record=s?`${s.wins}–${s.losses}${s.ties?'–'+s.ties:''}`:'—';const rank=s?rosterRows.indexOf(s)+1:'—';el.innerHTML=`<div class="eyebrow">FRANCHISE HEADQUARTERS</div><div class="team-hero">${teamLogoMarkup(state.team,teamName(state.team),'team-hero-logo')}<div><h2>${safe(teamName(state.team))}</h2><div class="muted">Season: ${safe(season)} · Use the Season and Week selectors above to explore history.</div><div class="muted">${r?`Manager: ${safe(r.managerName)}`:'Map this team to its Sleeper roster to show its stats.'}</div></div></div><div class="metrics"><div class="metric"><small>Record</small><b>${record}</b></div><div class="metric"><small>League rank</small><b>${rank}${rank==='—'?'':' / '+rosterRows.length}</b></div><div class="metric"><small>Points for</small><b>${s?fmt(s.pf):'—'}</b></div><div class="metric"><small>Points against</small><b>${s?fmt(s.pa):'—'}</b></div><div class="metric"><small>Max PF</small><b>${s?fmt(s.maxpf):'—'}</b></div></div><div class="team-details"><div class="detail"><strong>Current roster</strong>${r?`${r.players?.length||0} players on roster · ${r.starters?.length||0} starter slots`:'Live roster not matched'}<br><span class="muted">Roster/player details can be expanded in the next version.</span></div><div class="detail"><strong>Weekly matchup</strong>${oppRoster?`Vs. ${safe(oppRoster.teamId?teamName(oppRoster.teamId):oppRoster.displayName)} · ${fmt(Number(match.custom_points??match.points))} – ${fmt(Number(opponent.custom_points??opponent.points))}`:'Select a week to view a matchup, if available.'}</div></div><section class="h2h-section">${renderHeadToHead(r)}</section><section class="team-transactions"><h3>Recent transactions</h3><div class="muted">2026 season · auto-updated</div>${renderTransactionCards('2026',state.team,5)}</section>`;const selector=el.querySelector("#h2hSeasonSelect");if(selector)selector.addEventListener("change",e=>{state.h2hSeason=e.target.value;renderTeamPanel()});}
function renderTeams(){const el=$('#teamGrid');el.replaceChildren();state.config.teams.forEach(t=>{const r=state.rosters.find(r=>r.teamId===t.id);const b=document.createElement('button');b.className='team-tile';b.innerHTML=`${teamLogoMarkup(t.id,t.name,'team-tile-logo')}<h3>${safe(t.name)}</h3><p>${r?`${r.settings?.wins||0}–${r.settings?.losses||0} · ${safe(r.managerName)}`:'View franchise dashboard'} →</p>`;b.onclick=()=>{state.team=t.id;state.view='teams';state.article=null;change()};el.appendChild(b)})}
function renderArticle(){const el=$('#articleBody');const a=state.stories.find(s=>s.id===state.article);if(!a){el.innerHTML='<h1>Article not found</h1><p>Check the link or return to coverage.</p>';return}const ids=articleTeamIds(a);const isMatchup=ids.length===2;const hero=isMatchup?`<section class="matchup-hero"><div class="matchup-team">${teamLogoMarkup(ids[0],teamName(ids[0]),'matchup-hero-logo')}<div class="matchup-team-name">${safe(teamName(ids[0]))}</div></div><div class="matchup-center"><div class="matchup-vs">VS</div><div class="matchup-meta">${safe(a.type)} · WEEK ${safe(a.week)}</div></div><div class="matchup-team">${teamLogoMarkup(ids[1],teamName(ids[1]),'matchup-hero-logo')}<div class="matchup-team-name">${safe(teamName(ids[1]))}</div></div></section>`:(ids.length?`<div class="article-logo-row">${ids.map(id=>`<div class="article-logo-chip">${teamLogoMarkup(id,teamName(id),'article-logo')}<span>${safe(teamName(id))}</span></div>`).join('')}</div>`:'');el.innerHTML=`<div class="eyebrow">${safe(a.type)} · SEASON ${safe(a.season)} · WEEK ${safe(a.week)}</div>${hero}<h1>${safe(a.title)}</h1><p class="lead">${safe(a.summary)}</p><div class="article-content">${a.bodyHtml || (a.paragraphs||[]).map(p=>`<p>${safe(p)}</p>`).join('')}</div>`;document.title=`${a.title} | HUSCFFL`}
function render(){if(!state.config)return;document.title='HUSCFFL | League Headquarters';$('#teamSelect').value=state.team;$('#weekSelect').value=state.week;renderTeamPanel();renderTeamScoring();renderTeamRankings();renderScoring();let stories=sortedStories();renderStories($('#featuredStories'),stories.slice(0,9));renderStories($('#archiveStories'),stories);$('#storyCount').textContent=`${stories.length} ${stories.length===1?'story':'stories'}`;renderTable($('#homeStandings'),10,String(state.config.season));renderTable($('#fullStandings'));const standingsPicker=$('#standingsSeason');if(standingsPicker)standingsPicker.value=state.standingsSeason;const leagueSummary=$('.home-league-grid');if(leagueSummary)leagueSummary.hidden=state.team!=='all';renderTeams();$$('[data-type]').forEach(b=>b.classList.toggle('on',b.dataset.type===state.type));$$('.view').forEach(v=>v.hidden=v.id!==`${state.view}View`);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));if(state.view==='article')renderArticle();renderTransactions();}

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
function tradeReceives(t,season){
 const participants=txTeams(t),groups=new Map(participants.map(rid=>[rid,[]]));
 for(const [pid,rid] of Object.entries(t.adds||{})){const key=String(rid);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(txPlayer(pid))}
 for(const p of t.draft_picks||[]){const rid=String(p.owner_id??'');if(!groups.has(rid))groups.set(rid,[]);const original=p.roster_id&&p.roster_id!==p.owner_id?` (originally ${txTeamName(season,p.roster_id)})`:'';groups.get(rid).push(`${p.season} Round ${p.round} pick${original}`)}
 return [...groups].filter(([,assets])=>assets.length).map(([rid,assets])=>{const id=state.transactionMappings[season]?.[rid];return `<div class="trade-recipient">${id?teamLogoMarkup(id,teamName(id),'compact-team-logo'):''}<div><strong>${safe(txTeamName(season,rid))} receives</strong><span>${assets.map(safe).join(' · ')}</span></div></div>`}).join('');
}
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
 const tids=txTeams(t).map(r=>state.transactionMappings[season]?.[r]).filter(Boolean);
 const teams=txTeams(t).map(r=>txTeamName(season,r)).join(' · ');
 const chips=tids.length?`<div class="transaction-logo-row">${tids.map(id=>teamLogoMarkup(id,teamName(id),'transaction-logo')).join('')}</div>`:'';
 return `<article class="transaction-card"><div class="transaction-meta">${safe(date)} · WEEK ${safe(t._week)} · ${safe(txType(t))}</div>${chips}<h3>${safe(txType(t))}</h3><div class="transaction-team">${safe(teams)}</div>${t.type==='trade'?tradeReceives(t,season):txSummary(t,season).map(line=>`<p>${safe(line)}</p>`).join('')}</article>`;
 }).join('');
}
function renderHomeTransactions(){
 const el=$('#homeTransactionList'),status=$('#homeTransactionStatus');if(!el||!status)return;
 const season=String(state.config.season),items=txFiltered(season,state.team,'all').slice(0,5);
 status.textContent=state.transactionStatus==='loading'?'Loading recent moves…':state.transactionStatus==='error'?'Transaction feed unavailable':items.length?`5 most recent moves at most · ${season}`:'No completed transactions found';
 el.innerHTML=items.map(t=>{
  const tids=txTeams(t).map(r=>state.transactionMappings[season]?.[r]).filter(Boolean);
  const teams=txTeams(t).map(r=>txTeamName(season,r)).join(' · ');
  const adds=Object.keys(t.adds||{}).map(txPlayer),drops=Object.keys(t.drops||{}).map(txPlayer);
  const detail=[adds.length?`+ ${adds.slice(0,2).join(', ')}${adds.length>2?` +${adds.length-2}`:''}`:'',drops.length?`− ${drops.slice(0,2).join(', ')}${drops.length>2?` +${drops.length-2}`:''}`:'',t.draft_picks?.length?`${t.draft_picks.length} pick(s)`:'' ].filter(Boolean).join(' · ');
  return `<div class="compact-transaction"><div class="compact-top"><span class="compact-type">${safe(txType(t))}</span><span class="compact-logos">${tids.slice(0,3).map(id=>teamLogoMarkup(id,teamName(id),'compact-team-logo')).join('')}</span></div>${t.type==='trade'?tradeReceives(t,season):`<strong>${safe(teams)}</strong><span class="compact-detail">${safe(detail||'Completed transaction')}</span>`}</div>`;
 }).join('')||'<div class="transaction-empty">No transactions to display.</div>';
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
   const weeks=seasonWeeks(season);
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


async function loadConstitution(){
 const root=$('#constitutionBody');if(!root)return;
 try{const res=await fetch('data/constitution.md');if(!res.ok)throw Error('Missing constitution');const body=await res.text();
 const lines=body.split(/\r?\n/);let inList=false,html='';
 for(const raw of lines){const line=raw.trim();if(line.startsWith('#')){if(inList){html+='</ul>';inList=false;}const m=line.match(/^(#{1,3})\s+(.*)$/);if(m)html+=`<h${m[1].length+1}>${safe(m[2])}</h${m[1].length+1}>`;}
 else if(/^[-*]\s+/.test(line)){if(!inList){html+='<ul>';inList=true;}html+=`<li>${safe(line.slice(2))}</li>`;}
 else if(line){if(inList){html+='</ul>';inList=false;}html+=`<p>${safe(line)}</p>`;}}
 if(inList)html+='</ul>';root.innerHTML=html||'<p>Constitution not yet published.</p>';
 }catch(e){root.innerHTML='<p>Constitution is not yet available.</p>';}
}

async function init(){try{const [config,stories]=await Promise.all([fetch('data/config.json').then(r=>{if(!r.ok)throw Error('config.json missing');return r.json()}),fetch('data/stories.json').then(r=>{if(!r.ok)throw Error('stories.json missing');return r.json()})]);state.config=config;state.stories=stories;urlState();setupSelectors();render();loadConstitution();loadLive();setInterval(loadTransactions,300000);}catch(err){console.error(err);$('#dataStatus').textContent='Unable to load site files. Use GitHub Pages or a local server.'}}
init();
