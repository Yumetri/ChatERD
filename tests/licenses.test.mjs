import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildViewer} from '../runtime/build.mjs';
import {startServer} from '../runtime/server.mjs';

test('the built viewer serves its icon and complete license documents without widening file access',async()=>{
    await buildViewer();
    const dir=await mkdtemp(path.join(tmpdir(),'chaterd-licenses-')),schema=path.join(dir,'sample.mmd');
    await writeFile(schema,'erDiagram\n A {\n int id PK\n }\n');
    const {server,descriptor}=await startServer(schema);
    try{
        const url=descriptor.url;
        const index=await (await fetch(url)).text();
        assert.match(index,/<title>ChatERD<\/title>/);
        assert.match(index,/rel="icon" type="image\/png" href="\/assets\/chaterd.png"/);
        const icon=await fetch(url+'/assets/chaterd.png');
        assert.equal(icon.headers.get('content-type'),'image/png');
        assert.deepEqual(Buffer.from(await icon.arrayBuffer()),await readFile(new URL('../web/assets/chaterd.png',import.meta.url)));
        const page=await fetch(url+'/third-party.html');assert.equal(page.status,200);
        const html=await page.text();assert.match(html,/소스 다운로드/);assert.match(html,/EPL-1.0/);
        const links=new Set([...html.matchAll(/href="(\/[^\"]+)"/g)].map(m=>m[1]));
        assert(links.size>100,'License index must link to original texts, not only a summary');
        for(const link of links)assert.equal((await fetch(url+link)).status,200,link);
        const epl=await fetch(url+'/licenses/embedded/EPL-1.0.html');
        assert.equal(epl.headers.get('content-type'),'text/plain; charset=utf-8');
        assert.match(await epl.text(),/Eclipse Public License/);
        assert.equal((await fetch(url+'/docs/dependency-manifest.json')).status,200);
        assert.equal((await fetch(url+'/package-lock.json')).status,409);
        assert.equal((await fetch(url+'/licenses/%2e%2e%2fruntime%2fserver.mjs')).status,409);
    }finally{await new Promise(resolve=>server.close(resolve));}
});
