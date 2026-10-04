import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url));
const write=process.argv.includes('--write');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
const bundle=await build({entryPoints:[path.join(root,'web/app.mjs')],bundle:true,format:'esm',splitting:true,outdir:path.join(root,'dist'),target:'es2024',minify:true,write:false,metafile:true});
const shipped=new Set();
for(const output of Object.values(bundle.metafile.outputs))for(const [input,info] of Object.entries(output.inputs)){
    if(!info.bytesInOutput)continue;
    const relative=path.relative(root,path.resolve(input)).replaceAll(path.sep,'/');
    const match=relative.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/);
    if(match)shipped.add(match[1]);
}
async function legalFiles(directory,prefix='',depth=0){
    const result=[];
    for(const entry of await readdir(directory,{withFileTypes:true})){
        if(entry.name==='node_modules'||entry.name.startsWith('.'))continue;
        const relative=prefix+entry.name;
        if(entry.isFile()&&/^(?:licen[sc]e|notice|copying|copyright)(?:\b|[._-])/i.test(entry.name))result.push(relative);
        if(entry.isDirectory()&&depth<3)result.push(...await legalFiles(path.join(directory,entry.name),relative+'/',depth+1));
    }
    return result.sort();
}
const records=[];
for(const [location,metadata] of Object.entries(lock.packages).sort(([a],[b])=>a.localeCompare(b,'en'))){
    if(!location)continue;
    const name=location.slice(location.lastIndexOf('node_modules/')+13);
    const license=metadata.license||(name==='khroma'?'MIT':null);
    assert(license,`Missing declared license: ${location}`);
    const id=name.replaceAll('@','').replaceAll('/','--')+'--'+metadata.version;
    const directory=path.join(root,location);
    let installed=true;try{await stat(directory);}catch{installed=false;}
    let originals=[];
    if(installed)originals=await legalFiles(directory);
    const files=[];
    // Platform esbuild binaries use the same upstream esbuild MIT license.
    const binary=name.startsWith('@esbuild/');
    if(binary){originals=['LICENSE.md'];}
    if(installed&&!binary)assert(originals.some(n=>/^(?:.*\/)?(?:licen[sc]e|copying)/i.test(n)),`No license text: ${location}`);
    if(!installed&&!binary)assert(metadata.optional&&metadata.dev,`Required package missing: ${location}`);
    for(const original of originals){
        const bytes=await readFile(binary?path.join(root,'node_modules/esbuild/LICENSE.md'):path.join(directory,original));
        const dest=`licenses/npm/${id}/${original.replace(/[^A-Za-z0-9._/-]/g,'_')}`;
        if(write){await mkdir(path.dirname(path.join(root,dest)),{recursive:true});await writeFile(path.join(root,dest),bytes);}
        else assert.equal(digest(await readFile(path.join(root,dest))),digest(bytes),`License changed: ${dest}`);
        files.push({path:dest,sha256:digest(bytes)});
    }
    const record={location,name,version:metadata.version,license,integrity:metadata.integrity??null,dev:!!metadata.dev,optional:!!metadata.optional,browser:shipped.has(location),source:metadata.resolved??null,files};
    records.push(record);
}
for(const location of shipped)assert(records.some(r=>r.location===location),`Untracked bundled package: ${location}`);
const snapshot=JSON.stringify({format:1,packages:records},null,2)+'\n';
const manifest=path.join(root,'docs/dependency-manifest.json');
if(write){
    await writeFile(manifest,snapshot);
    const noticeFile=path.join(root,'THIRD_PARTY_NOTICES.md');
    let notice;try{notice=await readFile(noticeFile,'utf8');}catch{}
    if(notice){
        const rows=records.map(r=>`| ${r.name} | ${r.version} | ${r.license} | ${r.browser?'예':''} | ${r.files.map(f=>`[${path.basename(f.path)}](${f.path})`).join(', ')} |`);
        const table='<!-- npm inventory:start -->\n| 패키지 | 버전 | 라이선스 | 브라우저 | 라이선스·고지 원문 |\n|---|---|---|---|---|\n'+rows.join('\n')+'\n<!-- npm inventory:end -->';
        assert(notice.includes('<!-- npm inventory:start -->'),'Notice table marker missing');
        await writeFile(noticeFile,notice.replace(/<!-- npm inventory:start -->[\s\S]*?<!-- npm inventory:end -->/,table));
    }
}
else{
    const previous=JSON.parse(await readFile(manifest,'utf8'));
    // License files for optional packages may vary by OS; all declared packages and browser code must match.
    const stable=items=>items.map(({files,...item})=>item);
    assert.deepEqual(stable(previous.packages),stable(records),'Dependency or browser inventory changed; regenerate and review notices');
    for(const item of previous.packages)for(const f of item.files)assert.equal(digest(await readFile(path.join(root,f.path))),f.sha256,`Stored license changed: ${f.path}`);
    const java=[...JSON.parse(await readFile(path.join(root,'docs/embedded-java-manifest.json'),'utf8')),...JSON.parse(await readFile(path.join(root,'docs/embedded-js-manifest.json'),'utf8'))];
    for(const item of java)for(const f of item.notices)assert.equal(digest(await readFile(path.join(root,f.path))),f.sha256,`Embedded notice changed: ${f.path}`);
}
console.log(`License audit: ${records.length} locked packages, ${shipped.size} browser packages; ${write?'snapshot written':'notices verified'}`);
