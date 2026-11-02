/* No build tools required: this site works directly on GitHub Pages. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '—';
const slug = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const state = {config:null,stories:[],team:'all',week:'all',type:'all',view:'home',rosters:[],users:[],standings:[],historicalStandings:{},standingsSeason:'2026',teamRecordSeason:'2026',coverageSeason:'2026',matchups:[],h2hGames:[],h2hStatus:"loading",h2hSeason:"all",h2hWarnings:[],live:false,article:null,transactions:[],transactionSeason:'2026',transactionType:'all',transactionTeam:'all',transactionStatus:'loading',transactionsLastUpdated:null,transactionNames:{},playerPositions:{},transactionMappings:{},transactionError:'',scoring:{},scoringStatus:'loading',scoringSeason:'2026',playerYear:'2026',playerWeeks:[],playerMetric:'total',playerPosition:'ALL',playerStatus:'all',playerTeam:'all',playerSearch:'',playerPage:0,playerFiles:{},playerRosterMap:{},rawPlayerRosters:{},playerFileState:'loading',topPlayerPosition:'QB',playerYears:['2026'],playerPositionsSelected:[],playerTeamsSelected:[]};
const standingsSort={home:{key:'rank',direction:'asc'},full:{key:'rank',direction:'asc'}};
const seasonWeeks = season => Number(state.config?.seasonWeeks?.[String(season)] || (String(season)==='2025'?16:17));
const api = async endpoint => {const res=await fetch(`https://api.sleeper.app/v1/league/${state.config.leagueId}/${endpoint}`);if(!res.ok)throw Error(`Sleeper ${endpoint}: ${res.status}`);return res.json()};
function urlState(){const p=new URLSearchParams(location.search);state.team=state.config.teams.some(t=>t.id===p.get('team'))?p.get('team'):'all';const s=p.get('season');state.coverageSeason=(s&&state.config.leagueIds?.[s])?s:String(state.config.season);const w=p.get('week');state.week=w&&/^\d{1,2}$/.test(w)?w:'all';state.view=['home','archive','teams','standings','transactions','constitution','scoring','players'].includes(p.get('view'))?p.get('view'):'home';state.article=p.get('article')||null;if(state.article)state.view='article';if(!['teams','archive','home','article'].includes(state.view))state.team='all';if(state.view==='transactions'&&state.config.teams.some(t=>t.id===p.get('transactionTeam')))state.transactionTeam=p.get('transactionTeam');}
function setUrl(){const p=new URLSearchParams();if(['teams','archive','home'].includes(state.view)&&state.team!=='all')p.set('team',state.team);if(state.view==='transactions'&&state.transactionTeam!=='all')p.set('transactionTeam',state.transactionTeam);if(state.coverageSeason!==String(state.config.season))p.set('season',state.coverageSeason);if(state.week!=='all')p.set('week',state.week);if(state.view!=='home'&&state.view!=='article')p.set('view',state.view);if(state.article)p.set('article',state.article);history.pushState({},'',`${location.pathname}${p.toString()?'?'+p:''}`);}
function change(){setUrl();render()}
function pageTop(){window.scrollTo({top:0,behavior:'instant'})}
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
     let offense=0,defense=0,unknown=0;const positional={QB:0,RB:0,WR:0,TE:0,DL:0,LB:0,DB:0};let unresolvedFlex=0;
     for(let j=0;j<starters.length;j++){
      const slot=slots[j],pid=starters[j],val=Number(points[pid]??0);
      if(!Number.isFinite(val))continue;
      if(offensive.has(slot))offense+=val;
      else if(defensive.has(slot))defense+=val;
      else unknown+=val;
      const fixed={QB:'QB',RB:'RB',WR:'WR',TE:'TE',DL:'DL',DE:'DL',DT:'DL',EDGE:'DL',LB:'LB',DB:'DB',CB:'DB',S:'DB',FS:'DB',SS:'DB'};
      const position=fixed[slot]||normalizePlayerPosition(state.playerPositions[String(pid)]);
      if(position)positional[position]+=val;
      else if(!fixed[slot]&&Number.isFinite(val))unresolvedFlex++;
     }
     if(unknown!==0)unclassified++;
     rows[id].push({week:w+1,offense:Number(offense.toFixed(2)),defense:Number(defense.toFixed(2)),total:Number((offense+defense).toFixed(2)),unknown:Number(unknown.toFixed(2)),positional,unresolvedFlex,starters:starters.map((pid,j)=>({id:String(pid),slot:slots[j],points:Number(points[pid]??0)})),opponent:null,points:Number(match.custom_points??match.points??offense+defense),matchupId:match.matchup_id,rosterId:match.roster_id});
    }
    const paired=new Map();
    for(const match of results[w].value||[]){if(match.matchup_id==null)continue;const key=String(match.matchup_id);if(!paired.has(key))paired.set(key,[]);paired.get(key).push(match)}
    for(const pair of paired.values()){if(pair.length!==2)continue;for(const m of pair){const id=map.get(Number(m.roster_id));const opp=pair.find(x=>x!==m);const item=rows[id]?.find(x=>x.week===w+1&&Number(x.rosterId)===Number(m.roster_id));if(item)item.opponent={id:map.get(Number(opp.roster_id)),score:Number(opp.custom_points??opp.points),name:teamName(map.get(Number(opp.roster_id)))};}}
   }
   state.scoring[year]={rows,failed,unmapped,unclassified,upto};
  }catch(err){console.warn('Scoring data '+year,err);state.scoring[year]={rows:{},error:String(err)}}
 }));
 state.scoringStatus='ready';recalculatePositionalTotals();render();
}
function normalizePlayerPosition(raw){const p=String(raw||'').toUpperCase();if(['QB','RB','WR','TE','LB'].includes(p))return p;if(['DL','DE','DT','EDGE'].includes(p))return 'DL';if(['DB','CB','S','FS','SS'].includes(p))return 'DB';return null}
function recalculatePositionalTotals(){
 const fixed={QB:'QB',RB:'RB',WR:'WR',TE:'TE',DL:'DL',DE:'DL',DT:'DL',EDGE:'DL',LB:'LB',DB:'DB',CB:'DB',S:'DB',FS:'DB',SS:'DB'};
 for(const year of Object.values(state.scoring))for(const weeks of Object.values(year?.rows||{}))for(const week of weeks){
  const positional={QB:0,RB:0,WR:0,TE:0,DL:0,LB:0,DB:0};let unresolvedFlex=0;
  for(const player of week.starters||[]){const pos=fixed[player.slot]||normalizePlayerPosition(state.playerPositions[player.id]);if(pos)positional[pos]+=player.points;else unresolvedFlex++}
  week.positional=positional;week.unresolvedFlex=unresolvedFlex;
 }
}
function scoringRows(season){
 const data=state.scoring[String(season)]?.rows||{};
 return state.config.teams.map(t=>{const weeks=data[t.id]||[];const sum=k=>weeks.reduce((a,w)=>a+w[k],0);const off=sum('offense'),def=sum('defense'),n=weeks.length;return {...t,off,def,total:off+def,avg:n?(off+def)/n:0,avgOff:n?off/n:0,avgDef:n?def/n:0,games:n}}).sort((a,b)=>b.total-a.total);
}
function seasonStandingsRanks(season){
 const source=season===String(state.config.season)?state.standings:state.historicalStandings[season]||[];
 return new Map(source.map((r,i)=>[r.teamId,i+1]));
}
function scoringTeamClick(event,season){const button=event.target.closest('[data-team]');if(!button)return;state.team=button.dataset.team;state.coverageSeason=season;state.week='all';rebuildWeekOptions();state.view='teams';state.article=null;change();pageTop()}
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
 renderComparison();renderLeaguePositionalComparison();
}
function renderComparison(){
 const area=$('#offenseDefenseComparison');if(!area)return;
 const all=scoringRows(state.scoringSeason).filter(t=>t.games>0);
 if(!all.length){area.innerHTML='<p class="muted">Comparison will appear when weekly scoring data is available.</p>';return}
 const meanX=all.reduce((x,t)=>x+t.avgOff,0)/all.length,meanY=all.reduce((x,t)=>x+t.avgDef,0)/all.length;
 const maxX=Math.max(...all.map(t=>t.avgOff),meanX)*1.12,minX=Math.max(0,Math.min(...all.map(t=>t.avgOff),meanX)*.85);
 const maxY=Math.max(...all.map(t=>t.avgDef),meanY)*1.15,minY=Math.max(0,Math.min(...all.map(t=>t.avgDef),meanY)*.8);
 const x=n=>65+(n-minX)/(maxX-minX||1)*680,y=n=>345-(n-minY)/(maxY-minY||1)*300;
 const points=all.map(t=>`<g class="comparison-dot" data-team="${safe(t.id)}" data-name="${safe(t.name)}" data-offense="${fmt(t.avgOff)}" data-defense="${fmt(t.avgDef)}" tabindex="0" role="button" aria-label="${safe(t.name)}: ${fmt(t.avgOff)} offensive and ${fmt(t.avgDef)} defensive points per week" aria-pressed="${state.compareTeam===t.id}"><defs><clipPath id="logo-clip-${safe(t.id)}"><circle cx="${x(t.avgOff).toFixed(2)}" cy="${y(t.avgDef).toFixed(2)}" r="15"/></clipPath></defs><circle cx="${x(t.avgOff).toFixed(2)}" cy="${y(t.avgDef).toFixed(2)}" r="${state.compareTeam===t.id?19:17}" fill="white" stroke="${state.compareTeam===t.id?'#bb4f67':'#754b62'}" stroke-width="${state.compareTeam===t.id?3:1.5}"/><image class="scatter-team-logo" href="${safe(teamLogoSrc(t.id))}" x="${(x(t.avgOff)-15).toFixed(2)}" y="${(y(t.avgDef)-15).toFixed(2)}" width="30" height="30" preserveAspectRatio="xMidYMid meet" clip-path="url(#logo-clip-${safe(t.id)})"/><text x="${x(t.avgOff).toFixed(2)}" y="${(y(t.avgDef)+3).toFixed(2)}" text-anchor="middle" font-size="9" class="scatter-fallback">${safe(t.name.split(/\s+/).map(w=>w[0]).join('').slice(0,3))}</text><circle cx="${x(t.avgOff).toFixed(2)}" cy="${y(t.avgDef).toFixed(2)}" r="21" fill="transparent" stroke="none"/></g>`).join('');
 area.innerHTML=`<div class="compare-controls"><label>Highlight team <select id="compareTeam"><option value="">All teams</option>${all.map(t=>`<option value="${safe(t.id)}" ${state.compareTeam===t.id?'selected':''}>${safe(t.name)}</option>`).join('')}</select></label><span class="muted">League average offense: ${fmt(meanX)} · Defense: ${fmt(meanY)}</span></div><svg class="comparison-svg" viewBox="0 0 800 405" role="img" aria-label="All franchise average weekly offense versus defense scoring"><line x1="${x(meanX)}" y1="30" x2="${x(meanX)}" y2="345" stroke="#b38b9c" stroke-dasharray="5 5"/><line x1="65" y1="${y(meanY)}" x2="745" y2="${y(meanY)}" stroke="#b38b9c" stroke-dasharray="5 5"/><line x1="65" y1="345" x2="745" y2="345" stroke="#82727a"/><line x1="65" y1="30" x2="65" y2="345" stroke="#82727a"/><text x="400" y="385" text-anchor="middle">Average offensive points / week →</text><text x="19" y="198" text-anchor="middle" transform="rotate(-90 19 198)">Average defensive points / week →</text><text x="75" y="47" fill="#777">Defense-led</text><text x="737" y="47" text-anchor="end" fill="#777">Strong both ways</text>${points}<g id="comparisonTooltip" class="comparison-tooltip" visibility="hidden" pointer-events="none"><rect width="248" height="71" rx="9" fill="#321d2b"/><text x="12" y="22" fill="#fff4e6" font-size="13" font-weight="700" id="comparisonTooltipName"></text><text x="12" y="43" fill="#ffd5cb" font-size="12" id="comparisonTooltipOffense"></text><text x="12" y="60" fill="#ffd5cb" font-size="12" id="comparisonTooltipDefense"></text></g></svg><p class="muted">Each point represents one franchise. Hover or tap for team and scoring averages. Dashed lines are the league averages.</p>`;
 area.querySelector('#compareTeam').onchange=e=>{state.compareTeam=e.target.value;renderComparison()};
 const tip=area.querySelector('#comparisonTooltip');
 const tipName=area.querySelector('#comparisonTooltipName'),tipOff=area.querySelector('#comparisonTooltipOffense'),tipDef=area.querySelector('#comparisonTooltipDefense');
 const showTip=node=>{const circle=node.querySelector('circle');const px=Number(circle.getAttribute('cx')),py=Number(circle.getAttribute('cy'));const boxX=Math.max(8,Math.min(800-248-8,px+19));const boxY=py>112?py-83:py+18;tip.setAttribute('transform',`translate(${boxX.toFixed(1)} ${boxY.toFixed(1)})`);tipName.textContent=node.dataset.name;tipOff.textContent=`Offense: ${node.dataset.offense} pts/week`;tipDef.textContent=`Defense: ${node.dataset.defense} pts/week`;tip.setAttribute('visibility','visible')};
 const hideTip=()=>tip.setAttribute('visibility','hidden');
 area.querySelectorAll('.comparison-dot').forEach(node=>{const logo=node.querySelector('.scatter-team-logo');if(logo)logo.addEventListener('error',()=>{logo.style.display='none';const fallback=node.querySelector('.scatter-fallback');if(fallback)fallback.style.visibility='visible'});node.addEventListener('pointerenter',()=>showTip(node));node.addEventListener('pointerleave',hideTip);node.addEventListener('focus',()=>showTip(node));node.addEventListener('blur',hideTip);node.addEventListener('click',()=>{state.compareTeam=node.dataset.team;renderComparison()});node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();state.compareTeam=node.dataset.team;renderComparison()}})});
}
function renderLeaguePositionalComparison(){
 const el=$('#leaguePositionalComparison');if(!el)return;
 const season=state.scoringSeason;
 const data=state.scoring[season];
 if(!data||data.error){el.innerHTML='<p class="muted">Positional rankings load with the selected season scoring data.</p>';return}
 const positions=['QB','RB','WR','TE','DL','LB','DB'];
 const selected=positions.includes(state.leaguePositionalPosition)?state.leaguePositionalPosition:'QB';
 const metric=state.leaguePositionalMetric==='total'?'total':'average';
 const source=data.rows||{};
 const teams=state.config.teams.map(t=>{
  const weeks=source[t.id]||[];
  const total=weeks.reduce((n,w)=>n+Number(w.positional?.[selected]||0),0);
  return {id:t.id,name:t.name,total,weeks:weeks.length,average:weeks.length?total/weeks.length:0,unresolved:weeks.reduce((n,w)=>n+(w.unresolvedFlex||0),0)};
 }).sort((a,b)=>b[metric]-a[metric]||a.name.localeCompare(b.name));
 const controls=`<div class="player-controls"><label>Position <select id="leaguePositionalPosition">${positions.map(p=>`<option value="${p}" ${selected===p?'selected':''}>${p}</option>`).join('')}</select></label><label>Metric <select id="leaguePositionalMetric"><option value="average" ${metric==='average'?'selected':''}>Points / week</option><option value="total" ${metric==='total'?'selected':''}>Total starter points</option></select></label></div>`;
 el.innerHTML=controls+`<div class="standings-scroll"><table class="standings-table"><thead><tr><th>Rank</th><th>Franchise</th><th>Weeks</th><th>${metric==='average'?'FP / Week':'Starter FP'}</th></tr></thead><tbody>${teams.map((t,i)=>`<tr><td>${i+1}</td><td>${teamLogoMarkup(t.id,t.name,'table-team-logo')} ${safe(t.name)}</td><td>${t.weeks}</td><td>${t.weeks?fmt(t[metric]):'—'}</td></tr>`).join('')}</tbody></table></div><p class="muted">Points from starting FLEX, Superflex and IDP FLEX slots count toward the player's real position. Bench points excluded.${teams.some(t=>t.unresolved)?' Some flex positions are not identified yet.':''}</p>`;
 el.querySelector('#leaguePositionalPosition').onchange=e=>{state.leaguePositionalPosition=e.target.value;renderLeaguePositionalComparison()};
 el.querySelector('#leaguePositionalMetric').onchange=e=>{state.leaguePositionalMetric=e.target.value;renderLeaguePositionalComparison()};
}
function renderTeamRankings(){
 const area=$('#teamRankings');if(!area)return;
 if(state.team==='all'){area.hidden=true;return}area.hidden=false;
 const rows=scoringRows(state.coverageSeason).filter(t=>t.games>0),own=rows.find(t=>t.id===state.team);
 if(!own){area.innerHTML='<h3>League scoring comparison</h3><p class="muted">No completed scoring data for this franchise and season.</p>';return}
 const metrics=[['Offense','avgOff'],['Defense','avgDef'],['Combined','avg']];
 area.innerHTML=`<h3>League scoring comparison · ${safe(state.coverageSeason)}</h3><div class="ranking-bars">${metrics.map(([label,key])=>{const ordered=[...rows].sort((a,b)=>b[key]-a[key]);const rank=ordered.findIndex(t=>t.id===own.id)+1;return `<div class="ranking-item"><div class="ranking-heading"><strong>${label}</strong><span>${rank} of ${rows.length} · ${fmt(own[key])} PPG</span></div><div class="ranking-track"><div class="ranking-fill" style="width:${(rows.length-rank+1)/rows.length*100}%"></div></div></div>`}).join('')}</div><p class="muted">Bars show league ranking, not share of total points. Completed weeks only.</p>${renderPositionalRankings()}`;
 const metric=area.querySelector('#positionMetric');if(metric)metric.addEventListener('change',e=>{state.positionMetric=e.target.value;renderTeamRankings()});
}

function renderPositionalRankings(){
 const season=state.coverageSeason, source=state.scoring[season]?.rows||{};
 const positions=['QB','RB','WR','TE','DL','LB','DB'];const teams=state.config.teams;
 const complete=teams.map(t=>{const weeks=source[t.id]||[];const total={};for(const p of positions)total[p]=weeks.reduce((n,w)=>n+Number(w.positional?.[p]||0),0);return {id:t.id,name:t.name,weeks:weeks.length,total,unresolved:weeks.reduce((n,w)=>n+(w.unresolvedFlex||0),0)}});
 const mine=complete.find(t=>t.id===state.team);if(!mine?.weeks)return '<h3>Positional scoring rankings</h3><p class="muted">Awaiting completed weekly matchup data.</p>';
 const average=state.positionMetric!=='total';const rows=positions.map(p=>{const ordered=complete.filter(t=>t.weeks).sort((a,b)=>(b.total[p]/(average?b.weeks:1))-(a.total[p]/(average?a.weeks:1)));const rank=ordered.findIndex(t=>t.id===state.team)+1;return {p,rank,n:ordered.length,value:mine.total[p]/(average?mine.weeks:1)}});
 const missing=complete.some(t=>t.unresolved>0);
 return `<section class="position-ranks"><div class="position-ranks-heading"><h3>Positional Scoring Rankings · ${safe(season)}</h3><label>Metric <select id="positionMetric"><option value="average" ${average?'selected':''}>Points / week</option><option value="total" ${!average?'selected':''}>Total starter points</option></select></label></div><p class="muted">All starting lineup slots count, including FLEX, Superflex, and IDP Flex, assigned to each player's actual position.</p><div class="position-ranking-grid">${rows.map(r=>`<div class="position-rank"><strong>${r.p}</strong><span>#${r.rank} of ${r.n}</span><b>${fmt(r.value)} pts${average?' / week':''}</b></div>`).join('')}</div>${missing?'<p class="muted">Some flex starters could not be position-identified yet. Rankings update after the daily player-position catalog loads.</p>':''}</section>`;
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
async function loadLive(){try{const [rosters,users,league,nflState]=await Promise.all([api('rosters'),api('users'),fetch(`https://api.sleeper.app/v1/league/${state.config.leagueId}`).then(r=>{if(!r.ok)throw Error('league info unavailable');return r.json()}),fetch('https://api.sleeper.app/v1/state/nfl').then(r=>{if(!r.ok)throw Error('NFL state unavailable');return r.json()}).catch(()=>null)]);state.rosters=rosters;state.users=users;mapTeams();reconcilePlayerOwnership();deriveStandings();state.live=true;loadHistoricalStandings();$('#dataStatus').textContent='● Live league data via Sleeper';render();loadTransactions();loadScoring();await loadHeadToHead(league,nflState);}catch(err){console.warn(err);state.h2hStatus='error';$('#dataStatus').textContent='Sleeper data unavailable · stories still accessible';render();}}

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
 ts.addEventListener('change',e=>{state.team=e.target.value;state.article=null;change();pageTop()});
 $('#coverageSeason').addEventListener('change',e=>{state.coverageSeason=e.target.value;state.week='all';state.article=null;rebuildWeekOptions();change()});
 ws.addEventListener('change',e=>{state.week=e.target.value;state.article=null;change();pageTop()});
 $('#resetFilters').addEventListener('click',()=>{state.team='all';state.week='all';state.type='all';state.coverageSeason=String(state.config.season);state.article=null;rebuildWeekOptions();change()});
 $$('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.article=null;if(!['teams','archive','home'].includes(state.view))state.team='all';change()});
 $$('[data-go]').forEach(b=>b.onclick=()=>{state.view=b.dataset.go;state.article=null;if(!['teams','archive','home'].includes(state.view))state.team='all';change()});
 $$('[data-type]').forEach(b=>b.onclick=()=>{state.type=b.dataset.type;change()});
 setupTransactionControls();setupPlayerControls();
 const standingsPicker=$('#standingsSeason');if(standingsPicker)standingsPicker.addEventListener('change',e=>{state.standingsSeason=e.target.value;render()});$('#scoringSeason').onchange=e=>{state.scoringSeason=e.target.value;renderScoring()};
 $('#backToArchive').onclick=()=>{state.view='archive';state.article=null;change()};
 window.addEventListener('popstate',()=>{urlState();rebuildWeekOptions();render();pageTop()});
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
 rows.forEach(r=>{const tr=document.createElement('tr');const label=r.teamId?teamName(r.teamId):r.displayName;tr.innerHTML=`<td>${r.officialRank}</td><td><div class="team-cell">${r.teamId?teamLogoMarkup(r.teamId,label,'table-team-logo'):''}<button class="teamlink">${safe(label)}</button></div></td><td>${r.wins}</td><td>${r.losses}</td><td>${fmt(r.pf)}</td><td>${fmt(r.pa)}</td><td>${fmt(r.maxpf)}</td>`;tr.querySelector('.teamlink').onclick=()=>{if(r.teamId){state.team=r.teamId;state.view='teams';state.article=null;change();pageTop()}};tbody.appendChild(tr)});table.appendChild(tbody);el.replaceChildren(table)
}
function renderTeamPanel(){const el=$('#teamPanel');el.hidden=state.team==='all'||!['teams','home'].includes(state.view);if(el.hidden)return;const r=selectedRoster();const match=state.matchups.find(m=>Number(m.roster_id)===Number(r?.roster_id));const opponent=match&&state.matchups.find(m=>m.matchup_id===match.matchup_id&&m.roster_id!==match.roster_id);const oppRoster=opponent&&state.rosters.find(a=>a.roster_id===opponent.roster_id);const season=state.coverageSeason;const rosterRows=season===String(state.config.season)?state.standings:(state.historicalStandings[season]||[]);const s=rosterRows.find(a=>a.teamId===state.team);const record=s?`${s.wins}–${s.losses}${s.ties?'–'+s.ties:''}`:'—';const rank=s?rosterRows.indexOf(s)+1:'—';el.innerHTML=`<div class="eyebrow">FRANCHISE HEADQUARTERS</div><div class="team-hero">${teamLogoMarkup(state.team,teamName(state.team),'team-hero-logo')}<div><h2>${safe(teamName(state.team))}</h2><div class="muted">Season: ${safe(season)} · Use the Season and Week selectors above to explore history.</div><div class="muted">${r?`Manager: ${safe(r.managerName)}`:'Map this team to its Sleeper roster to show its stats.'}</div></div></div><div class="metrics"><div class="metric"><small>Record</small><b>${record}</b></div><div class="metric"><small>League rank</small><b>${rank}${rank==='—'?'':' / '+rosterRows.length}</b></div><div class="metric"><small>Points for</small><b>${s?fmt(s.pf):'—'}</b></div><div class="metric"><small>Points against</small><b>${s?fmt(s.pa):'—'}</b></div><div class="metric"><small>Max PF</small><b>${s?fmt(s.maxpf):'—'}</b></div></div><div class="team-details"><div class="detail"><strong>Current roster</strong>${r?`${r.players?.length||0} players on roster · ${r.starters?.length||0} starter slots`:'Live roster not matched'}<br><span class="muted">Roster/player details can be expanded in the next version.</span></div><div class="detail"><strong>Weekly matchup</strong>${oppRoster?`Vs. ${safe(oppRoster.teamId?teamName(oppRoster.teamId):oppRoster.displayName)} · ${fmt(Number(match.custom_points??match.points))} – ${fmt(Number(opponent.custom_points??opponent.points))}`:'Select a week to view a matchup, if available.'}</div></div><section id="teamScoring" class="panel team-scoring"></section><section class="h2h-section">${renderHeadToHead(r)}</section><section id="teamRankings" class="panel team-scoring"></section><section id="topPlayersPanel" class="panel team-scoring"></section><section class="team-transactions"><h3>Recent transactions</h3><div class="muted">2026 season · auto-updated</div>${renderTransactionCards('2026',state.team,5)}<p><button type="button" id="viewAllTeamTransactions" class="text-button">View All Transactions →</button></p></section><section id="teamRecentArticles" class="team-recent-articles panel"><div class="panel-head"><div><div class="eyebrow">FROM THE ARCHIVE</div><h3>Recent Articles</h3></div><button class="text-button" type="button" id="viewAllTeamArticles">View All Team Articles →</button></div><div id="teamRecentArticleList" class="stories"></div></section>`;const selector=el.querySelector("#h2hSeasonSelect");if(selector)selector.addEventListener("change",e=>{state.h2hSeason=e.target.value;render()});const allTx=$('#viewAllTeamTransactions');if(allTx)allTx.onclick=()=>{state.transactionTeam=state.team;state.view='transactions';change();window.scrollTo(0,0)};}
function renderTeamArticles(){
 const el=$('#teamRecentArticleList');if(!el||state.team==='all')return;
 const articles=state.stories.filter(a=>a.teams?.includes(state.team)||a.teams?.includes('all')).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||Number(b.season)-Number(a.season)||Number(b.week)-Number(a.week)).slice(0,3);
 renderStories(el,articles);
 const link=$('#viewAllTeamArticles');if(link)link.onclick=()=>{state.type='all';state.week='all';state.coverageSeason=String(state.config.season);state.view='archive';state.article=null;rebuildWeekOptions();change();window.scrollTo({top:0,behavior:'instant'})};
}
function renderTeams(){const el=$('#teamGrid');el.replaceChildren();state.config.teams.forEach(t=>{const r=state.rosters.find(r=>r.teamId===t.id);const b=document.createElement('button');b.className='team-tile';b.innerHTML=`${teamLogoMarkup(t.id,t.name,'team-tile-logo')}<h3>${safe(t.name)}</h3><p>${r?`${r.settings?.wins||0}–${r.settings?.losses||0} · ${safe(r.managerName)}`:'View franchise dashboard'} →</p>`;b.onclick=()=>{state.team=t.id;state.view='teams';state.article=null;change();pageTop()};el.appendChild(b)})}
function renderArticle(){const el=$('#articleBody');const a=state.stories.find(s=>s.id===state.article);if(!a){el.innerHTML='<h1>Article not found</h1><p>Check the link or return to coverage.</p>';return}const ids=articleTeamIds(a);const isMatchup=ids.length===2;const hero=isMatchup?`<section class="matchup-hero"><div class="matchup-team">${teamLogoMarkup(ids[0],teamName(ids[0]),'matchup-hero-logo')}<div class="matchup-team-name">${safe(teamName(ids[0]))}</div></div><div class="matchup-center"><div class="matchup-vs">VS</div><div class="matchup-meta">${safe(a.type)} · WEEK ${safe(a.week)}</div></div><div class="matchup-team">${teamLogoMarkup(ids[1],teamName(ids[1]),'matchup-hero-logo')}<div class="matchup-team-name">${safe(teamName(ids[1]))}</div></div></section>`:(ids.length?`<div class="article-logo-row">${ids.map(id=>`<div class="article-logo-chip">${teamLogoMarkup(id,teamName(id),'article-logo')}<span>${safe(teamName(id))}</span></div>`).join('')}</div>`:'');el.innerHTML=`<div class="eyebrow">${safe(a.type)} · SEASON ${safe(a.season)} · WEEK ${safe(a.week)}</div>${hero}<h1>${safe(a.title)}</h1><p class="lead">${safe(a.summary)}</p><div class="article-content">${a.bodyHtml || (a.paragraphs||[]).map(p=>`<p>${safe(p)}</p>`).join('')}</div>`;document.title=`${a.title} | HUSCFFL`}

function render(){if(!state.config)return;document.title='HUSCFFL | League Headquarters';$('#teamSelect').value=state.team;$('#weekSelect').value=state.week;renderTeamPanel();renderTeamScoring();renderTeamRankings();renderTeamArticles();renderScoring();renderTopPlayers();renderPlayerDatabase();let stories=sortedStories();renderStories($('#featuredStories'),stories.slice(0,9));renderStories($('#archiveStories'),stories);$('#storyCount').textContent=`${stories.length} ${stories.length===1?'story':'stories'}`;renderTable($('#homeStandings'),10,String(state.config.season));renderTable($('#fullStandings'));const standingsPicker=$('#standingsSeason');if(standingsPicker)standingsPicker.value=state.standingsSeason;const toolbar=$('.toolbar');if(toolbar)toolbar.hidden=!['home','archive','teams'].includes(state.view);const leagueSummary=$('.home-league-grid');if(leagueSummary)leagueSummary.hidden=state.team!=='all';renderTeams();$$('[data-type]').forEach(b=>b.classList.toggle('on',b.dataset.type===state.type));$$('.view').forEach(v=>v.hidden=v.id!==`${state.view}View`);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));if(state.view==='article')renderArticle();renderTransactions();}

/* Sleeper transaction history, read-only. Weekly transactions may contain pending / failed records. */
function setupTransactionControls(){
  const team=$('#transactionTeam');
  for(const t of state.config.teams){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;team.appendChild(o)}
  $('#transactionSeason').onchange=e=>{state.transactionSeason=e.target.value;renderTransactions()};
  $('#transactionType').onchange=e=>{state.transactionType=e.target.value;renderTransactions()};
  team.onchange=e=>{state.transactionTeam=e.target.value;setUrl();renderTransactions()};
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

/* Prefer the small player-name catalog committed daily by GitHub Actions. Fallback
   to Sleeper's full player directory when an ID is still missing. */
async function loadPlayerNames(){
 const key='huscffl-player-names-v2';
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.names)Object.assign(state.transactionNames,saved.names)}catch(e){}
 const needed=new Set(state.transactions.flatMap(t=>[...Object.keys(t.adds||{}),...Object.keys(t.drops||{})]));
 const names=state.transactionNames;
 try{const response=await fetch('data/player-names.json?cache='+Math.floor(Date.now()/3600000),{cache:'no-cache'});if(response.ok){const local=await response.json();Object.assign(names,local.names||local);Object.assign(state.playerPositions,local.positions||{});recalculatePositionalTotals();renderTeamRankings()}}catch(e){console.warn('Local player name catalog unavailable',e)}
 let missing=[...needed].filter(id=>!names[id]);
 if(missing.length){
   const checkedKey='huscffl-player-catalog-last-try-v2';let last=0;try{last=Number(localStorage.getItem(checkedKey)||0)}catch(e){}
   if(Date.now()-last>3600000){
    try{
      const response=await fetch('https://api.sleeper.app/v1/players/nfl');
      if(!response.ok)throw Error('Player catalog HTTP '+response.status);
      const players=await response.json();
      for(const id of missing){const pl=players[id];if(pl){const name=pl.full_name||[pl.first_name,pl.last_name].filter(Boolean).join(' ');if(name)names[id]=name}}
      try{localStorage.setItem(checkedKey,String(Date.now()))}catch(e){}
    }catch(e){console.warn('Could not resolve missing player IDs',e)}
   }
 }
 try{localStorage.setItem(key,JSON.stringify({names}))}catch(e){}
 recalculatePositionalTotals();renderTeamRankings();renderTransactions();
}
function renderTransactions(){
 if(!state.config||!$('#transactionList'))return;
 $('#transactionSeason').value=state.transactionSeason;
 $('#transactionType').value=state.transactionType;
 $('#transactionTeam').value=state.transactionTeam;
 const list=txFiltered(state.transactionSeason,state.transactionTeam,state.transactionType);
 const backlink=$('#transactionTeamBack');if(backlink){backlink.hidden=state.transactionTeam==='all';backlink.onclick=()=>{state.team=state.transactionTeam;state.view='teams';change()}}const stamp=state.transactionsLastUpdated?` · Last checked ${state.transactionsLastUpdated.toLocaleTimeString()}`:'';
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
  reconcilePlayerOwnership();
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


/* v21 NFL-wide player database: reads weekly, league-scored data generated by a scheduled action. */
const playerPositions=['QB','RB','WR','TE','DL','LB','DB'];
const playerEligible={ALL:playerPositions,QB:['QB'],RB:['RB'],WR:['WR'],TE:['TE'],FLEX:['RB','WR','TE'],SFLEX:['QB','RB','WR','TE'],DL:['DL'],LB:['LB'],DB:['DB'],IDPFLEX:['DL','LB','DB']};
const selectedYears=()=>state.playerYears.length?state.playerYears:['2026'];
const rosterYear=()=>selectedYears().slice().sort().at(-1);
const maxPlayerWeeks=()=>Math.max(...selectedYears().map(seasonWeeks));
const selectedPositionKeys=()=>state.playerPositionsSelected.length?state.playerPositionsSelected:Object.keys(playerEligible).filter(x=>x!=='ALL');
const eligibleSelectedPositions=()=>[...new Set(selectedPositionKeys().flatMap(x=>playerEligible[x]||[]))];
function multiDropdown(key,label,choices,selected){
 const summary=selected.length===0?'All':selected.length===choices.length?'All selected':selected.length===1?(choices.find(x=>String(x[0])===String(selected[0]))?.[1]||selected[0]):`${selected.length} selected`;
 return `<details class="multi-dropdown" data-multi="${key}"><summary>${safe(label)} <span class="multi-summary">${safe(String(summary))}</span></summary><div class="multi-menu"><div class="multi-actions"><button type="button" data-multi-action="all" data-key="${key}">Select All</button><button type="button" data-multi-action="clear" data-key="${key}">Clear</button></div><div class="multi-items">${choices.map(([value,text])=>`<label><input type="checkbox" data-multi-key="${key}" value="${safe(String(value))}" ${selected.map(String).includes(String(value))?'checked':''}> ${safe(String(text))}</label>`).join('')}</div></div></details>`;
}
function filterDropdowns(onlyRoster=false){
 const years=[['2025','2025'],['2026','2026']];
 const weekOpts=Array.from({length:maxPlayerWeeks()},(_,i)=>[String(i+1),`Week ${i+1}`]);
 const positionOpts=Object.keys(playerEligible).filter(p=>p!=='ALL').map(p=>[p,p==='SFLEX'?'Superflex':p==='IDPFLEX'?'IDP FLEX':p]);
 const teamOpts=state.config.teams.map(t=>[t.id,t.name]);
 return `<div class="player-multi-grid">${multiDropdown('years','Seasons',years,state.playerYears)}${multiDropdown('weeks','Scoring Weeks',weekOpts,state.playerWeeks)}${multiDropdown('positions','Positions',positionOpts,state.playerPositionsSelected)}${onlyRoster?'':multiDropdown('teams','Fantasy Teams',teamOpts,state.playerTeamsSelected)}</div>`;
}
function playerControlsHTML(){
 const opt=(value,text,current)=>`<option value="${safe(value)}" ${String(current)===String(value)?'selected':''}>${safe(text)}</option>`;
 return `${filterDropdowns()}<div class="player-controls"><label>Roster status <select data-player-control="status">${[['all','All players'],['available','Available only'],['rostered','Rostered only']].map(([v,t])=>opt(v,t,state.playerStatus)).join('')}</select></label><label>Player name <input data-player-control="search" value="${safe(state.playerSearch)}" placeholder="Search players"></label><label>Metric <select data-player-control="metric">${opt('total','Total fantasy points',state.playerMetric)}${opt('average','Average per game',state.playerMetric)}</select></label></div>`;
}
function applyMultiChange(key,val,checked){
 const prop={years:'playerYears',weeks:'playerWeeks',positions:'playerPositionsSelected',teams:'playerTeamsSelected'}[key];if(!prop)return;
 let updated=checked?[...new Set([...state[prop],key==='weeks'?Number(val):val])]:state[prop].filter(x=>String(x)!==String(val));
 if(key==='years'&&!updated.length)updated=[val];
 state[prop]=key==='weeks'?updated.sort((a,b)=>a-b):updated;
 if(key==='years')state.playerWeeks=state.playerWeeks.filter(w=>w<=maxPlayerWeeks());
 state.playerYear=rosterYear();state.playerPage=0;
}
function attachMultiEvents(root){
 if(!root||root.dataset.multiBound==='yes')return;root.dataset.multiBound='yes';
 root.addEventListener('change',e=>{
  const box=e.target.closest('[data-multi-key]');if(!box)return;
  const details=box.closest('details'),key=box.dataset.multiKey;
  applyMultiChange(key,box.value,box.checked);
  const prop={years:'playerYears',weeks:'playerWeeks',positions:'playerPositionsSelected',teams:'playerTeamsSelected'}[key];
  details.querySelector('.multi-summary').textContent=(state[prop].length||'All')+' selected';
  if(key==='years'){
   const weekPanel=root.querySelector('[data-multi="weeks"]');
   if(weekPanel)weekPanel.outerHTML=multiDropdown('weeks','Scoring Weeks',Array.from({length:maxPlayerWeeks()},(_,i)=>[String(i+1),`Week ${i+1}`]),state.playerWeeks);
  }
  renderPlayerRows();renderTopPlayers(false);
 });
 root.addEventListener('click',e=>{
  const btn=e.target.closest('[data-multi-action]');if(!btn)return;
  const key=btn.dataset.key,details=btn.closest('details');const values=[...details.querySelectorAll('[data-multi-key]')].map(x=>x.value);
  const selection=btn.dataset.multiAction==='all'?values:[];
  if(key==='years'&&!selection.length)return;
  const prop={years:'playerYears',weeks:'playerWeeks',positions:'playerPositionsSelected',teams:'playerTeamsSelected'}[key];
  state[prop]=key==='weeks'?selection.map(Number):selection;
  state.playerYear=rosterYear();state.playerPage=0;
  details.querySelectorAll('[data-multi-key]').forEach(x=>x.checked=selection.includes(x.value));
  details.querySelector('.multi-summary').textContent=(selection.length||'All')+' selected';
  if(key==='years'){
   state.playerWeeks=state.playerWeeks.filter(w=>w<=maxPlayerWeeks());
   const weekPanel=root.querySelector('[data-multi="weeks"]');
   if(weekPanel)weekPanel.outerHTML=multiDropdown('weeks','Scoring Weeks',Array.from({length:maxPlayerWeeks()},(_,i)=>[String(i+1),`Week ${i+1}`]),state.playerWeeks);
  }
  renderPlayerRows();renderTopPlayers(false);
 });
}
function setupPlayerControls(){
 const root=$('#playersControls');
 root.addEventListener('change',e=>{const c=e.target.dataset.playerControl;if(!c)return;state['player'+c[0].toUpperCase()+c.slice(1)]=e.target.value;state.playerPage=0;renderPlayerRows();renderTopPlayers(false)});
 root.addEventListener('input',e=>{if(e.target.dataset.playerControl==='search'){state.playerSearch=e.target.value;state.playerPage=0;renderPlayerRows();}});
}
function rebuildPlayerOwnership(year,rosters){
 const ownership={};const mapping=state.transactionMappings[year]||{};
 const current=year===String(state.config.season);
 const currentRosters=new Map(state.rosters.map(r=>[String(r.roster_id),r]));
 for(const r of rosters){
  const rid=String(r.roster_id);
  const team=mapping[rid]||(current?currentRosters.get(rid)?.teamId:null)||null;
  const players=[...(r.players||[]),...(r.reserve||[]),...(r.taxi||[])].map(String);
  const reserves=new Set((r.reserve||[]).map(String)),taxi=new Set((r.taxi||[]).map(String));
  for(const id of players)ownership[id]={teamId:team,label:team?teamName(team):`Roster ${rid}`,rosterId:rid,status:taxi.has(id)?'Taxi':reserves.has(id)?'IR':'Rostered'};
 }
 state.playerRosterMap[year]=ownership;
 renderPlayerRows();renderTopPlayers();
}
function reconcilePlayerOwnership(){for(const [year,rosters] of Object.entries(state.rawPlayerRosters||{}))rebuildPlayerOwnership(year,rosters)}
async function loadPlayerScores(){
 for(const y of Object.keys(state.config.leagueIds)){
  fetch(`data/player-stats-${y}.json?refresh=${Math.floor(Date.now()/3600000)}`,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('No player data for '+y);return r.json()}).then(data=>{state.playerFiles[y]=data;renderPlayerDatabase();renderTopPlayers()}).catch(e=>{state.playerFiles[y]={error:String(e)};renderPlayerDatabase();renderTopPlayers()});
  fetch(`https://api.sleeper.app/v1/league/${state.config.leagueIds[y]}/rosters`).then(r=>r.ok?r.json():Promise.reject(Error('roster unavailable'))).then(rosters=>{
   state.rawPlayerRosters[y]=rosters;rebuildPlayerOwnership(y,rosters);
  }).catch(e=>console.warn('Roster ownership '+y,e));
 }
}
function playerRows(options={}){
 const yearList=selectedYears(), weeks=state.playerWeeks;
 const positions=options.allPositions?playerPositions:eligibleSelectedPositions();
 const combined=new Map();
 for(const y of yearList){const file=state.playerFiles[y];if(!file?.players)continue;
  for(const [id,p] of Object.entries(file.players)){
   const pos=normalizePlayerPosition(p.position);if(!pos||!positions.includes(pos))continue;
   let item=combined.get(id);if(!item){item={id,name:p.name||state.transactionNames[id]||`Player ${id}`,pos,nflTeam:p.team||'FA',points:0,gp:0};combined.set(id,item)}
   for(const w of weeks){if(w>seasonWeeks(y))continue;const entry=p.weeks?.[w];if(entry){item.points+=Number(entry.points||0);if(entry.played)item.gp++}}
  }
 }
 const ownerMap=state.playerRosterMap[rosterYear()]||{};
 const list=[];
 for(const p of combined.values()){
  const ownership=ownerMap[p.id];if(!options.unfiltered){
   if(state.playerStatus==='available'&&ownership)continue;
   if(state.playerStatus==='rostered'&&!ownership)continue;
   if(state.playerTeamsSelected.length&&(!ownership?.teamId||!state.playerTeamsSelected.includes(ownership.teamId)))continue;
   if(state.playerSearch&&!p.name.toLowerCase().includes(state.playerSearch.toLowerCase()))continue;
  }
  const average=p.gp?p.points/p.gp:0;list.push({...p,average,metric:state.playerMetric==='average'?average:p.points,ownership});
 }
 return list.sort((a,b)=>b.metric-a.metric||b.points-a.points||a.name.localeCompare(b.name));
}
function rankedPlayerRows(){
 const pool=playerRows({unfiltered:true});let prev=null,rank=0;const ranks=new Map();pool.forEach((p,i)=>{if(prev===null||Math.abs(prev-p.metric)>0.00001)rank=i+1;prev=p.metric;ranks.set(p.id,rank)});return ranks;
}
function playerRankLabel(p,ranks){return p.pos+(ranks.get(p.id)||'—')}
function renderPlayerRows(){const el=$('#playerDatabaseTable');if(!el)return;const status=$('#playerDatabaseStatus');const missing=selectedYears().filter(y=>!state.playerFiles[y]?.players);
 if(missing.length){status.textContent=`Player scoring data unavailable for ${missing.join(', ')}. Run the GitHub Actions player statistics workflow.`;el.innerHTML='';return}
 if(!state.playerWeeks.length){status.textContent='Select at least one week to calculate player rankings.';el.innerHTML='';return}
 const rows=playerRows(),ranks=rankedPlayerRows(),per=50,pages=Math.max(1,Math.ceil(rows.length/per));state.playerPage=Math.min(state.playerPage,pages-1);const visible=rows.slice(state.playerPage*per,(state.playerPage+1)*per);
 status.textContent=`${rows.length.toLocaleString()} players · ${selectedYears().join(' + ')} · ${state.playerWeeks.length} selected weeks · Roster status as of ${rosterYear()}`;
 el.innerHTML=`<table class="standings-table player-table"><thead><tr><th>Player</th><th>Pos</th><th>Rank</th><th>Roster status</th><th>GP</th><th>Total FP</th><th>FP/G</th></tr></thead><tbody>${visible.map(p=>`<tr class="${p.ownership?'':'player-available'}"><td><strong>${safe(p.name)}</strong><small>${safe(p.nflTeam)}</small></td><td>${safe(p.pos)}</td><td>${safe(playerRankLabel(p,ranks))}</td><td>${safe(p.ownership?(p.ownership.status+' · '+(p.ownership.teamId?teamName(p.ownership.teamId):p.ownership.label)):'Available')}</td><td>${p.gp}</td><td>${fmt(p.points)}</td><td>${p.gp?fmt(p.average):'—'}</td></tr>`).join('')}</tbody></table>`;
 const pager=$('#playerDatabasePager');pager.innerHTML=`<button type="button" id="playerPrev" ${!state.playerPage?'disabled':''}>Previous</button><span>Page ${state.playerPage+1} / ${pages}</span><button type="button" id="playerNext" ${state.playerPage>=pages-1?'disabled':''}>Next</button>`;
 $('#playerPrev').onclick=()=>{state.playerPage--;renderPlayerRows()};$('#playerNext').onclick=()=>{state.playerPage++;renderPlayerRows()};
}
function renderPlayerDatabase(){if(!state.config)return;const controls=$('#playersControls');if(!controls)return;controls.innerHTML=playerControlsHTML();attachMultiEvents(controls);renderPlayerRows()}
function renderTopPlayers(rebuild=true){
 const el=$('#topPlayersPanel');if(!el)return;const id=state.team;if(id==='all'){el.innerHTML='';return}
 const ownMap=state.playerRosterMap[rosterYear()]||{};
 const eligible=eligibleSelectedPositions();
 const rows=playerRows({unfiltered:true});
 const rankByPosition={};for(const pos of playerPositions){const list=rows.filter(p=>p.pos===pos);let rank=0,prev=null;rankByPosition[pos]=new Map();list.forEach((p,i)=>{if(prev===null||Math.abs(p.metric-prev)>0.00001)rank=i+1;prev=p.metric;rankByPosition[pos].set(p.id,rank)})}
 const mine=rows.filter(p=>eligible.includes(p.pos)&&ownMap[p.id]?.teamId===id);
 const missing=selectedYears().filter(y=>!state.playerFiles[y]?.players);
 if(rebuild||!el.querySelector('#rosterPlayerData')){
  el.innerHTML=`<div class="panel-head"><div><div class="eyebrow">THE ROSTER</div><h3>Rostered Players by Position</h3></div><button type="button" class="text-button" id="openPlayerDatabase">Full player database →</button></div>${filterDropdowns(true)}<div class="player-controls"><label>Metric <select id="topPlayerMetric"><option value="total" ${state.playerMetric==='total'?'selected':''}>Total fantasy points</option><option value="average" ${state.playerMetric==='average'?'selected':''}>Average per game</option></select></label></div><p class="muted">All current rostered players (including bench, IR, and taxi). Scoring combines checked weeks from selected seasons; ownership reflects ${rosterYear()}.</p><div id="rosterPlayerData"></div>`;
  attachMultiEvents(el);
  el.querySelector('#topPlayerMetric').onchange=e=>{state.playerMetric=e.target.value;renderTopPlayers(false);renderPlayerRows()};
  el.querySelector('#openPlayerDatabase').onclick=()=>{state.view='players';state.playerTeamsSelected=[id];state.article=null;change();window.scrollTo(0,0)};
 }
 const body=el.querySelector('#rosterPlayerData');if(!body)return;
 body.innerHTML=missing.length?`<p class="muted">Missing player statistics for ${missing.join(', ')}.</p>`:!state.playerWeeks.length?'<p class="muted">Select at least one scoring week.</p>':`<div class="standings-scroll"><table class="standings-table"><thead><tr><th>Player</th><th>Rank</th><th>GP</th><th>Total FP</th><th>FP/G</th></tr></thead><tbody>${mine.map(p=>`<tr><td>${safe(p.name)}</td><td>${safe(p.pos)}${rankByPosition[p.pos]?.get(p.id)||'—'}</td><td>${p.gp}</td><td>${fmt(p.points)}</td><td>${p.gp?fmt(p.average):'—'}</td></tr>`).join('')||'<tr><td colspan="5">No rostered players found for this selection.</td></tr>'}</tbody></table></div>`;
}

async function init(){try{const [config,stories]=await Promise.all([fetch('data/config.json').then(r=>{if(!r.ok)throw Error('config.json missing');return r.json()}),fetch('data/stories.json').then(r=>{if(!r.ok)throw Error('stories.json missing');return r.json()})]);state.config=config;state.stories=stories;state.playerYears=[state.playerYear];state.playerWeeks=Array.from({length:seasonWeeks(state.playerYear)},(_,i)=>i+1);urlState();setupSelectors();render();loadConstitution();loadLive();setInterval(loadTransactions,300000);loadPlayerScores();}catch(err){console.error(err);$('#dataStatus').textContent='Unable to load site files. Use GitHub Pages or a local server.'}}
function setupBackToTop(){const b=$('#backToTop');if(!b)return;const update=()=>{b.hidden=window.scrollY<500};window.addEventListener('scroll',update,{passive:true});update();b.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}))}
setupBackToTop();
init();
