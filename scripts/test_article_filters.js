#!/usr/bin/env node
// Regression test for archive franchise, week, season and article-type filters.
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const js=fs.readFileSync(require('path').join(__dirname,'../assets/app.js'),'utf8');
const stories=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../data/stories.json')));
const config=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../data/config.json')));
const ids=new Set(config.teams.map(t=>t.id));
for(const a of stories){assert(a.teams.length>0,a.id);for(const t of a.teams)assert(t==='all'||ids.has(t),`${a.id}: ${t}`)}
const state={team:'all',type:'all',week:'all',coverageSeason:'2026',config};
const sandbox={state};
const block=js.match(/function articleTeamIds\(a\)\{[^\n]+\}/)[0]+'\n'+js.match(/function articleMatches\(a\)\{[^\n]+\}/)[0];
vm.runInNewContext(block,sandbox);
const selected=()=>stories.filter(a=>sandbox.articleMatches(a));
assert.strictEqual(stories.length,44);
assert.strictEqual(selected().length,44);
state.week='11';state.type='preview';assert.strictEqual(selected().length,6);
state.team='new-york-noodles';assert.strictEqual(selected().length,1);assert(selected()[0].id.includes('noodles-daebak'));
state.team='tampa-bay-tyranny';assert.strictEqual(selected().length,1);assert(selected()[0].id.includes('tyranny-seattle'));
state.team='utah-yetis';assert.strictEqual(selected().length,1);assert(selected()[0].id.includes('bunniez-utah'));
state.team='dalla-dalla-dallas';assert.strictEqual(selected().length,1);assert(selected()[0].id.includes('okc-dallas'));
state.team='hou-you-like-that';assert.strictEqual(selected().length,1);assert(selected()[0].id.includes('hou-lalalala'));
state.team='all';state.type='recap';assert.strictEqual(selected().length,0);
state.week='10';assert.strictEqual(selected().length,6);
state.team='new-york-noodles';assert.strictEqual(selected().length,1);
state.type='preview';assert.strictEqual(selected().length,1);
state.coverageSeason='2025';assert.strictEqual(selected().length,0);
console.log('PASS: all 44 articles: valid teams; Week 10/11 archive filters, franchise association, season and type.');
