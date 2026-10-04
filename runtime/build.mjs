import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, cp, readdir } from 'node:fs/promises';
import {palettes} from '../web/theme.mjs';
import {hydrateIcons} from '../web/icons.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildViewer() {
    await promisify(execFile)(process.execPath,[path.join(root,'scripts/license-audit.mjs')],{cwd:root});
    const out = path.join(root, 'dist'); await mkdir(path.join(out,'assets'), { recursive: true });
    await copyFile(path.join(root,'web/assets/chaterd.png'),path.join(out,'assets/chaterd.png'));
    await build({ entryPoints: [path.join(root,'web/app.mjs')], bundle: true, format:'esm', splitting:true,
        outdir:out, entryNames:'app', chunkNames:'chunks/[name]-[hash]', target:'es2024', minify:true, legalComments:'linked' });
    await writeFile(path.join(out,'index.html'),hydrateIcons(await readFile(path.join(root,'web/index.html'),'utf8')));
    await cp(path.join(root,'licenses'),path.join(out,'licenses'),{recursive:true});
    for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])await copyFile(path.join(root,name),path.join(out,name));
    await cp(path.join(root,'docs'),path.join(out,'docs'),{recursive:true});
    const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const notices=await readFile(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8');
    const links=(await readdir(path.join(root,'licenses'),{recursive:true,withFileTypes:true})).filter(entry=>entry.isFile()).map(entry=>path.relative(root,path.join(entry.parentPath,entry.name)).replaceAll(path.sep,'/')).sort();
    const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChatERD · 라이선스</title><style>:root{color-scheme:light dark}body{font:16px system-ui;max-width:1000px;margin:32px auto;padding:0 20px}pre{white-space:pre-wrap;overflow-wrap:anywhere}li{margin:8px 0}</style><h1>ChatERD 라이선스 · 제3자 고지</h1><p><a href="/LICENSE">MIT LICENSE</a> · <a href="/docs/third-party-sources.md">소스 제공 안내</a> · <a href="https://github.com/Yumetri/ChatERD/releases/tag/v0.1.0" target="_blank" rel="noopener noreferrer">소스 다운로드</a></p><h2>원문 파일</h2><ul>${links.map(link=>`<li><a href="/${link}">${escape(link)}</a></li>`).join('')}</ul><pre>${escape(notices)}</pre></html>`;
    await writeFile(path.join(out,'third-party.html'),html);
    // First-paint CSS and runtime SVG/editor tokens share one palette source.
    const tokens=Object.entries(palettes).map(([name,values])=>`${name==='light'?':root':`:root[data-theme=${name}]`}{${Object.entries(values).map(([k,v])=>`--${k}:${v};`).join('')}color-scheme:${name}}`).join('\n');
    await writeFile(path.join(out,'style.css'),tokens+'\n'+await readFile(path.join(root,'web/style.css'),'utf8'));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildViewer();
