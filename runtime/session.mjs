import { readFile, mkdir, realpath, stat, open as openFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit', ...options });
        child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
    });
}
export async function build() {
    await run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: root });
    const {buildViewer}=await import('./build.mjs');await buildViewer();
}
export async function api(session, role, action, body) {
    if (!['ui', 'draw', 'discuss'].includes(role)) throw new Error('invalid capability');
    const response = await fetch(`${session.url}/api/camp/${action}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${session.tokens[role]}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(action==='report'?{renderer_version:3,...body}:body), signal: AbortSignal.timeout(35000),
    });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); return data;
}
export async function ensureSession(schema, { create = true, openBrowser = false } = {}) {
    if (!schema) throw new Error('사용자가 지정한 .mmd 경로가 필요합니다.');
    const resolved = await realpath(schema);
    if (path.extname(resolved).toLowerCase() !== '.mmd' || !(await stat(resolved)).isFile()) throw new Error('기존 UTF-8 .mmd 파일을 지정하세요.');
    const directory = path.join(root, '.runtime'); await mkdir(directory, { recursive: true, mode: 0o700 });
    const id = createHash('sha256').update(resolved).digest('hex');
    const descriptor = path.join(directory, `${id}.json`);
    let session;
    let resume,resumeFile;
    try {
        const existing = JSON.parse(await readFile(descriptor, 'utf8'));
        if (existing.schema_path === resolved) {
            const state=await api(existing,'discuss','diagram');
            if(state.api_version===3&&state.runtime_revision===2)session=existing;
            else if(create&&[2,3].includes(state.api_version)){
                const jobs=await api(existing,'ui','jobs');
                if(state.file_conflict||state.content!==state.disk_content||state.active_candidates||jobs.jobs.length)throw new Error('기존 뷰어에 초안·충돌·렌더 작업이 있습니다. 먼저 완료하거나 보존한 뒤 재실행하세요.');
                resume={...existing,version:state.version+1,theme:state.theme,theme_initialized:state.theme_initialized??true,key_section:state.key_section};
            }
        }
    } catch(error) {if(error.message.startsWith('기존 뷰어'))throw error; /* start a new session only when requested by the host */ }
    if (!session) {
        if (!create) throw new Error('뷰어 세션이 없습니다. 호스트에서 먼저 preview를 실행하세요.');
        await stat(path.join(root, 'dist/app.js')).catch(() => { throw new Error('먼저 npm run setup을 실행하세요.'); });
        const logfile = await openFile(path.join(directory, `${id}.log`), 'a', 0o600);
        if(resume){resumeFile=path.join(directory,`${id}.resume.json`);const {writeFile}=await import('node:fs/promises');await writeFile(resumeFile,JSON.stringify(resume),{mode:0o600});process.kill(resume.pid,'SIGTERM');for(let i=0;i<50;i++){try{await api(resume,'discuss','diagram');await delay(100);}catch{break;}}}
        const child = spawn(process.execPath, [path.join(root,'runtime/server.mjs'), resolved, descriptor,...(resumeFile?[resumeFile]:[])], { detached: true, stdio: ['ignore', logfile.fd, logfile.fd] });
        let spawnError; child.on('error', e => { spawnError = e; }); child.unref(); await logfile.close();
        for (let i = 0; i < 100; i++) {
            if (spawnError) throw spawnError;
            try { const candidate = JSON.parse(await readFile(descriptor, 'utf8')); if(candidate.api_version!==3||candidate.pid!==child.pid)throw new Error('stale descriptor'); await api(candidate, 'discuss', 'diagram'); session = candidate; break; } catch { await delay(100); }
        }
        if (!session) throw new Error(`뷰어 시작 실패: ${path.join(directory, `${id}.log`)}`);
        if(resumeFile){const {unlink}=await import('node:fs/promises');await unlink(resumeFile);}
    }
    if (openBrowser) await openViewer(session);
    return session;
}
export const viewerURL = session => `${session.url}/#camp=${session.tokens.ui}`;
export async function openViewer(session) {
    const url = viewerURL(session);
    await run(process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open',
        process.platform === 'win32' ? ['/c', 'start', '', url] : [url], { stdio: 'ignore' });
}
export async function preview(session, role, id, timeout = 31000) {
    const start = Date.now(); let selected = id;
    while (Date.now() - start < timeout) {
        const data = await api(session, role, `preview${selected ? `?id=${encodeURIComponent(selected)}` : ''}`);
        selected ||= data.job.id;
        if (data.job.status === 'ready') {
            if (!data.png || !data.svg || !data.semantic) throw new Error('렌더링 결과에 이미지 또는 스키마 검증 정보가 없습니다.');
            return data;
        }
        if (data.job.status !== 'pending') throw new Error(data.job.error || data.job.status);
        await delay(150);
    }
    throw new Error('렌더링 시간 초과: 로컬 뷰어가 열려 있는지 확인하세요.');
}
