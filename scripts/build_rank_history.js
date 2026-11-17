#!/usr/bin/env node
/** Save verifiable, completed-week franchise standings and HPI-F snapshots.
 * No historical HPI-F is back-calculated from today's rosters.
 * Requires a successful player-statistics export for the completed week.
 * Uses the site's exact HPI calculation (assets/app.js), not a second formula.
 */
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const config=read('data/config.json');
const year=String(config.season),leagueId=String(config.leagueId);
const stats=read(`data/player-stats-${year}.json`);
const upto=Number(stats.weeks);
if(!Number.isInteger(upto)||upto<1||upto>Number(config.seasonWeeks?.[year]||17))throw Error('Player export has invalid completed-week count');
if(!stats.players||Object.keys(stats.players).length<100)throw Error('Player export incomplete; preserving ranking history');
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'HUSCFFL-rank-snapshot/1.0','Accept':'application/json'}});if(!r.ok)throw Error(`${url} HTTP ${r.status}`);return r.json()}
const byId=Object.fromEntries(config.teams.map(t=>[t.id,t]));
const rosterIds=Object.fromEntries(Object.entries(config.rosterOverrides||{}).map(([id,num])=>[String(num),id]));
if(Object.keys(rosterIds).length!==config.teams.length)throw Error('Roster mapping incomplete; refusing ranking snapshot');
function finished(ranks){return Object.keys(ranks).length===config.teams.length&&config.teams.every(t=>Number.isInteger(ranks[t.id]))}
function standingsFromGames(games){
 const totals=Object.fromEntries(config.teams.map(t=>[t.id,{id:t.id,wins:0,losses:0,ties:0,pf:0}]));
 for(const week of games){
  const groups=new Map();
  if(week.length!==config.teams.length)throw Error(`Week matchup count ${week.length} differs from ${config.teams.length}`);
  for(const m of week){
   const id=rosterIds[String(m.roster_id)];if(!id)throw Error('Unmapped roster in historical matchup');
   const mid=String(m.matchup_id);if(!groups.has(mid))groups.set(mid,[]);
   const score=Number(m.custom_points??m.points);
   if(!Number.isFinite(score))throw Error('Invalid matchup score');
   totals[id].pf+=score;groups.get(mid).push({id,score});
  }
  if(groups.size!==config.teams.length/2)throw Error('Unexpected number of matchups');
  for(const pair of groups.values()){
   if(pair.length!==2)throw Error('Incomplete weekly matchup');
   const [a,b]=pair;const left=totals[a.id],right=totals[b.id];
   if(a.score>b.score){left.wins++;right.losses++}
   else if(b.score>a.score){right.wins++;left.losses++}
   else {left.ties++;right.ties++}
  }
 }
 const sorted=Object.values(totals).sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.pf-a.pf);
 return {ranks:Object.fromEntries(sorted.map((t,i)=>[t.id,i+1])),totals};
}
async function main(){
 const base=`https://api.sleeper.app/v1/league/${leagueId}`;
 const [rosters,nfl,...games]=await Promise.all([
  get(`${base}/rosters`),get('https://api.sleeper.app/v1/state/nfl'),
  ...Array.from({length:upto},(_,i)=>get(`${base}/matchups/${i+1}`))
 ]);
 if(String(nfl.season)===year && nfl.season_type==='regular' && Number(nfl.week||1)<=upto)
  throw Error('NFL week has not completed; refusing premature snapshot');
 const standingsHistory={};
 for(let week=1;week<=upto;week++)standingsHistory[week]=standingsFromGames(games.slice(0,week));
 const current=standingsHistory[upto];
 // Sleeper may not include postseason in its league standings settings.
 // Never claim the accumulated head-to-head standings equal live official standings in that case.
 if(upto<=14){
  for(const r of rosters){const t=current.totals[rosterIds[String(r.roster_id)]];
   if(!t||Number(r.settings?.wins)!==t.wins||Number(r.settings?.losses)!==t.losses)
    throw Error('Current Sleeper standings disagree with reconstructed weekly standings; no snapshot saved');
  }
 }
 const owners={};
 for(const r of rosters){const id=rosterIds[String(r.roster_id)];if(!id)throw Error('Roster mapping incomplete');
  for(const pid of r.players||[]){if(owners[String(pid)])throw Error('Player listed on multiple rosters');owners[String(pid)]={teamId:id}}
 }
 const rows=Object.fromEntries(config.teams.map(t=>[t.id,[]]));
 for(let w=0;w<games.length;w++){
  for(const m of games[w]){
   const id=rosterIds[String(m.roster_id)];const points=m.players_points||{};
   const starts=m.starters||[];
   if(starts.length<15)throw Error(`Incomplete starter lineup for ${id}, week ${w+1}`);
   const sum=starts.reduce((n,pid)=>n+Number(points[pid]||0),0);
   if(!Number.isFinite(sum))throw Error('Invalid starter score');
   rows[id].push({week:w+1,total:sum});
  }
 }
 // Evaluate the SAME HPI-P/HPI-F functions used by the browser; never duplicate weights.
 const code=fs.readFileSync(path.join(root,'assets/app.js'),'utf8')
  .replace(/setupBackToTop\(\);\s*init\(\);\s*$/,'');
 const context=vm.createContext({console,sessionStorage:{getItem:()=>null},URLSearchParams,Map,Set});
 vm.runInContext(code,context,{filename:'assets/app.js',timeout:30000});
 context.snapshotInput={config,stats,owners,rows};
 const power=vm.runInContext(`(()=>{
  state.config=snapshotInput.config;
  state.playerFiles[${JSON.stringify(year)}]=snapshotInput.stats;
  state.playerRosterMap[${JSON.stringify(year)}]=snapshotInput.owners;
  state.playerOwnershipDiagnostics={};
  state.scoring[${JSON.stringify(year)}]={rows:snapshotInput.rows,failed:0,unmapped:0};
  const pd=hpiPlayerData(),fr=hpiFranchiseData(pd);
  return fr?.map(x=>({id:x.id,rank:x.rank,rating:x.rating}))||null;
 })()`,context,{timeout:30000});
 if(!power||power.length!==config.teams.length||power.some(t=>!Number.isFinite(t.rating)))
  throw Error('HPI-F could not be calculated with complete validated data; snapshot not saved');
 const powerRanks=Object.fromEntries(power.map(t=>[t.id,t.rank]));
 if(!finished(powerRanks))throw Error('Incomplete HPI-F rankings');
 const target=path.join(root,'data/rank-history.json');
 const history=fs.existsSync(target)?read('data/rank-history.json'):{schema:1,seasons:{}};
 if(history.schema!==1)throw Error('Unrecognized historical schema');
 history.seasons??={};history.seasons[year]??={weeks:{}};
 const snapshot=history.seasons[year].weeks;
 // Completed historical official standings are recoverable from past matchups;
 // previous HPI-F ratings are NOT reconstructed from today's roster.
 for(let w=1;w<=upto;w++){
  snapshot[w]??={};
  snapshot[w].standings=standingsHistory[w].ranks;
 }
 snapshot[upto].power=powerRanks;
 snapshot[upto].captured_at=new Date().toISOString();
 const output=JSON.stringify(history,null,2)+'\n';
 const temp=target+'.tmp';fs.writeFileSync(temp,output);fs.renameSync(temp,target);
 console.log(`Saved complete ${year} week ${upto} standings and HPI-F rankings. Prior HPI-F weeks left unchanged.`);
}
main().catch(err=>{console.error('Rank snapshot not published:',err);process.exitCode=1});
