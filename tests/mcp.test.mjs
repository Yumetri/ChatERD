import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { PNG } from 'pngjs';
import { ensureSession, api, root } from '../runtime/session.mjs';

function connection(role, schema) {
    const child = spawn(process.execPath, [path.join(root, 'runtime/mcp.mjs'), role, schema]);
    const waiting = new Map(); let next = 0;
    createInterface({ input: child.stdout }).on('line', line => {
        const message = JSON.parse(line), pending = waiting.get(message.id);
        if (pending) { waiting.delete(message.id); pending.resolve(message.result); }
    });
    child.on('error', error => { for (const p of waiting.values()) p.reject(error); });
    child.on('exit', code => { for (const p of waiting.values()) p.reject(new Error(`MCP exited ${code}`)); });
    return {
        child,
        request: (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++next; waiting.set(id, { resolve, reject });
            child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        }),
    };
}
test('real stdio MCP enforces roles and returns images without disk artifacts', { timeout: 15000 }, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'db-camp-protocol-'));
    const schema = path.join(directory, '임의 파일 이름.mmd');
    const source = 'erDiagram\n ITEM {\n int id PK\n }\n';
    await writeFile(schema, source);
    const session = await ensureSession(schema);
    const discuss = connection('discuss', schema), draw = connection('draw', schema);
    try {
        for (const c of [discuss, draw]) assert.equal((await c.request('initialize', { protocolVersion: '2024-11-05' })).serverInfo.name, 'db-camp');
        assert.deepEqual((await discuss.request('tools/list')).tools.map(t => t.name), ['get_diagram', 'get_preview']);
        assert.equal((await draw.request('tools/list')).tools.length, 4);
        const denied = await discuss.request('tools/call', { name: 'commit_diagram', arguments: { id: 'x', review: 'pass' } });
        assert.equal(denied.isError, true);
        const state = JSON.parse((await discuss.request('tools/call', { name: 'get_diagram' })).content[0].text);
        assert.equal(state.content, source);
        const candidate = source.replace('int id PK', 'int id PK\n string value');
        const staged = JSON.parse((await draw.request('tools/call', { name: 'stage_diagram', arguments: { content: candidate, version: state.version, saved_hash: state.saved_hash } })).content[0].text);
        assert.equal(await readFile(schema, 'utf8'), source);
        // Protocol-only fixture. Actual SVG/PNG generation is tested separately in the browser.
        const fixture=new PNG({width:1,height:1});fixture.data.fill(255);const png = PNG.sync.write(fixture).toString('base64');
        // Geometry is also a protocol fixture, not a claim about these PNG pixels.
        const relationships=[0,1].map(i=>({id:`r${i}`,a:'A',b:'B',label:`관계 ${i}`,cardA:'ONLY_ONE',cardB:'ZERO_OR_MORE',identifying:false}));
        const model={relationships,geometry:{entities:{A:{x:0,y:0,width:100,height:100},B:{x:300,y:0,width:100,height:100}},edges:[10,16.4].map((y,i)=>({id:`r${i}`,sections:[{startPoint:{x:100,y},bendPoints:[{x:132,y},{x:268,y}],endPoint:{x:300,y}}]}))}};
        await api(session, 'ui', 'report', { id: staged.id, source_hash: staged.source_hash, theme: 'light', png, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', semantic: '{}',model });
        const image = await draw.request('tools/call', { name: 'get_preview', arguments: { id: staged.id } });
        assert.equal(image.content[1].type, 'image'); assert.equal(image.content[1].mimeType, 'image/png'); assert.equal(image.content[1].data, png);
        const feedback=JSON.parse(image.content[0].text).layout_feedback;
        assert.equal(feedback.available,true);assert.equal(feedback.close_parallel_count,1);assert.equal(feedback.close_parallel_segments[0].gap_px,6.4);
        assert.deepEqual(await readdir(directory), [path.basename(schema)]);
        const committed = await draw.request('tools/call', { name: 'commit_diagram', arguments: { id: staged.id, review: 'pass', findings: ['Protocol fixture reviewed'] } });
        assert.notEqual(committed.isError, true); assert.equal(await readFile(schema, 'utf8'), candidate);
        const visible = await api(session, 'ui', `preview?id=${staged.id}`);
        assert.equal(visible.png, png); assert(visible.svg.includes('<svg'));
        await writeFile(schema,candidate+'\n%% external edit\n');
        const conflict=await discuss.request('tools/call',{name:'get_preview',arguments:{id:staged.id}});
        assert.equal(conflict.isError,true);assert.equal(conflict.content.length,1);assert.match(conflict.content[0].text,/최신 상태/);
        await writeFile(schema,candidate);await api(session,'ui','reload',{});
        const stale=await discuss.request('tools/call',{name:'get_preview',arguments:{id:staged.id}});
        assert.equal(stale.isError,true);assert.equal(stale.content.length,1);
    } finally {
        discuss.child.kill(); draw.child.kill(); process.kill(session.pid);
    }
});
