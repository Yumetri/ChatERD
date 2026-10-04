import {build} from 'esbuild';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url)),flag=process.argv.indexOf('--baseline'),baseline=flag>=0?path.resolve(process.argv[flag+1]):null;
const output=await mkdtemp(path.join(tmpdir(),'db-camp-drag-benchmark-'));
await build({entryPoints:[path.join(root,'tests/drag-benchmark-browser.mjs')],bundle:true,format:'esm',outfile:path.join(output,'benchmark.js'),target:'es2024',define:{BASELINE:JSON.stringify(!!baseline),ROUTING_ONLY:JSON.stringify(process.argv.includes('--routing-only'))},plugins:[{name:'baseline',setup(b){b.onResolve({filter:/^baseline-(render|routing)$/},args=>({path:baseline?path.join(baseline,`${args.path.slice(9)}-before.mjs`):path.join(root,'web',`${args.path.slice(9)}.mjs`)}));}}]});
const server=http.createServer(async(req,res)=>{try{
    if(req.url==='/result'&&req.method==='POST'){if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${server.address().port}`)throw new Error('Unexpected origin');let body='';for await(const chunk of req){body+=chunk;if(body.length>1048576)throw new Error('Report too large');}const result=JSON.parse(body);await writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(result.error?'FAIL: '+result.error:`PASS: ${result.scenarios.length} measurements, ${result.svg_png_parity_checks} SVG/PNG checks`);console.log('Report:',path.join(output,'results.json'));res.end('ok');return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',req.url==='/benchmark.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
    res.end(req.url==='/benchmark.js'?await readFile(path.join(output,'benchmark.js')):'<!doctype html><meta charset="utf-8"><title>ChatERD 드래그 성능 검증</title><style>body{font:14px system-ui;color:#e2e8f0;background:#0f172a}pre{white-space:pre-wrap}#diagram{overflow:hidden;max-height:500px}button{padding:8px}</style><h1>드래그 부하 · SVG/PNG 회귀 검증</h1><button onclick="location.reload()">동일 시나리오 다시 측정</button><pre>측정 중…</pre><div id="diagram"></div><script type="module" src="/benchmark.js"></script>');
}catch(e){res.statusCode=400;res.end(e.message);}});
server.listen(0,'127.0.0.1',()=>console.log(`Browser: http://127.0.0.1:${server.address().port}\nReports: ${output}\nCtrl+C to stop.`));
