import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Session} from '../runtime/server.mjs';
import {appHarness} from './app-harness.mjs';
const source='erDiagram\n PILOT {\n uuid id PK\n string name\n }\n';
async function fixture(){const dir=await mkdtemp(path.join(tmpdir(),'db-camp-theme-')),file=path.join(dir,'sample.mmd');await writeFile(file,source);return {file,s:await Session.create(file)};}
function consistent(app,theme){assert.equal(app.root.dataset.theme,theme,'page theme');assert.equal(app.svg().dataset.theme,theme,'SVG theme');assert.equal(app.svg().style.getPropertyValue('--background'),app.root.style.getPropertyValue('--background'),'page and SVG palette');assert.match(app.elements.get('theme').getAttribute('aria-label'),theme==='dark'?/라이트/:/다크/);}
test('another tab changing the session theme keeps page and regenerated SVG consistent',async()=>{
    const {s,file}=await fixture(),a=await appHarness(s);await a.settle();consistent(a,'dark');
    const b=await appHarness(s);await b.settle();b.toggle();await b.settle();await a.settle();consistent(a,'light');
    await writeFile(file,source.replace('string name','string name\n int age'));await a.settle();consistent(a,'light');
});
test('opening another viewer with a light preference cannot reset an existing dark session',async()=>{
    const {s}=await fixture(),a=await appHarness(s);await a.settle();const version=s.version;
    const b=await appHarness(s,{preference:'light'});await b.settle();await a.settle();
    assert.equal(s.version,version,'new viewers must not enqueue a theme job');consistent(a,'dark');consistent(b,'dark');
});
test('external edits, editor drafts and detail views retain dark mode and do not rewrite source on theme changes',async()=>{
    const {s,file}=await fixture(),a=await appHarness(s);await a.settle();
    const edited=source.replace('string name','string name\n int age');await writeFile(file,edited);await a.settle();consistent(a,'dark');
    // Set the actual editor text before invoking its app change handler.
    const draft=edited.replace('int age','int years');a.edit(draft);await a.settle();consistent(a,'dark');
    a.view('entity:PILOT');await a.settle();consistent(a,'dark');assert.equal(await readFile(file,'utf8'),draft);
});

test('simultaneous first viewers claim the preferred theme once without failing startup',async()=>{
    const {s}=await fixture();const [a,b]=await Promise.all([appHarness(s),appHarness(s,{preference:'light'})]);
    await a.settle();await b.settle();consistent(a,s.theme);consistent(b,s.theme);assert.equal(s.themeInitialized,true);
    assert.equal(s.version,2); // Only the winning dark initialization advances it.
});
test('rapid toggles and a reopened viewer converge on the latest theme',async()=>{
    const {s,file}=await fixture(),a=await appHarness(s);await a.settle();
    a.toggle();a.toggle();a.toggle();await a.settle();consistent(a,'light');
    const reopened=await appHarness(s,{preference:'dark'});await reopened.settle();consistent(reopened,'light');
    assert.equal(await readFile(file,'utf8'),source);
});
