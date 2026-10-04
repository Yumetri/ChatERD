import http from 'node:http';
import { readFile, writeFile, realpath, stat, open, rename, unlink } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const hash=content=>createHash('sha256').update(content).digest('hex');
const id=()=>randomBytes(24).toString('hex');
const utf8=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const assert=(ok,message)=>{if(!ok) throw new Error(message);};
const publicJob=j=>Object.fromEntries(['id','kind','content','source_hash','version','status','error','theme','key_section','created'].filter(k=>j[k]!==undefined).map(k=>[k,j[k]]));
export class Session {
    static async create(schema,{reviewFile}={}) {
        const filename=await realpath(schema); assert(path.extname(filename).toLowerCase()==='.mmd' && (await stat(filename)).isFile(),'기존 .mmd 파일을 지정하세요.');
        const content=utf8(await readFile(filename)); assert(Buffer.byteLength(content)<1024*1024,'스키마가 1 MiB를 초과했습니다.');
        const session=new Session(filename,content);session.reviewFile=reviewFile;
        if(reviewFile)try{const review=JSON.parse(await readFile(reviewFile,'utf8'));if(review.policy===1&&review.schema_path===filename&&typeof review.required==='boolean')session.review={required:review.required,reason:review.reason||''};}catch{}
        return session;
    }
    constructor(filename,content) {
        this.filename=filename; this.content=content; this.savedHash=hash(content); this.version=1;
        this.review={required:true,reason:'initial'};this.reviewDirty=false;
        this.theme='light'; this.themeInitialized=false; this.keySection=false; this.jobs=new Map(); this.tokens=Object.fromEntries(['ui','draw','discuss'].map(role=>[role,id()])); this.queue=Promise.resolve(); this.newCurrent();
    }
    requireReview(reason){this.review={required:true,reason};this.reviewDirty=true;}
    async persistReview(){if(!this.reviewDirty||!this.reviewFile)return;const temp=`${this.reviewFile}.${id()}.tmp`;try{await writeFile(temp,JSON.stringify({policy:1,schema_path:this.filename,...this.review}),{mode:0o600});await rename(temp,this.reviewFile);this.reviewDirty=false;}finally{await unlink(temp).catch(()=>{});}}
    async fail(j,error){j.status='error';j.error=String(error);this.requireReview(j.error);await this.persistReview();}
    async syncDisk(){
        let d;try{d=await this.disk();assert(Buffer.byteLength(d.content)<1024*1024,'스키마가 1 MiB를 초과했습니다.');assert(await realpath(this.filename)===this.filename,'schema path changed');}catch(e){this.requireReview(e.message);await this.persistReview();throw e;}if(d.hash===this.savedHash)return false;
        assert(hash(this.content)===this.savedHash,'unsaved editor draft; external file cannot replace it');
        assert(![...this.jobs.values()].some(j=>j.kind==='candidate'&&['pending','ready'].includes(j.status)),'candidate review in progress; external file cannot replace it');
        assert(await realpath(this.filename)===this.filename,'schema path changed');
        this.content=d.content;this.savedHash=d.hash;this.version++;this.cancel();this.newCurrent();return true;
    }
    exclusive(fn) { const task=this.queue.then(fn); this.queue=task.catch(()=>{}); return task; }
    newJob(kind,content) { const job={id:id(),kind,content,source_hash:hash(content),version:this.version,status:'pending',theme:this.theme,key_section:this.keySection,base:this.savedHash,created:Date.now(),repairs:0}; this.jobs.set(job.id,job);return job; }
    newCurrent(kind='current') {this.current=this.newJob(kind,this.content).id;}
    expire() {
        for(const [key,j] of this.jobs) {
            if(j.status==='pending' && Date.now()-j.created>30000) {j.status='error';j.error='render timeout: 로컬 뷰어를 열어 주세요.';this.requireReview(j.error);}
            if(Date.now()-j.created>600000 && key!==this.current && key!==this.lastGood) this.jobs.delete(key);
        }
    }
    cancel(except) {for(const j of this.jobs.values()) if(j.id!==except && (j.kind==='candidate'||j.status==='pending')) {j.status='cancelled';j.error='editor changed';delete j.png;delete j.svg;}}
    remember(j) {
        const previous=this.jobs.get(this.lastGood); if(previous&&previous!==j) {delete previous.png;delete previous.svg;previous.status='cancelled';previous.error='superseded preview';}
        this.lastGood=j.id;
    }
    async disk() {const content=utf8(await readFile(this.filename));return {content,hash:hash(content)};}
    async state() {
        this.expire();await this.persistReview(); const j=this.jobs.get(this.current); let disk;
        try{disk=await this.disk();}catch(e){this.requireReview(e.message);await this.persistReview();}
        return {api_version:3,runtime_revision:2,active_candidates:[...this.jobs.values()].some(j=>j.kind==='candidate'&&['pending','ready'].includes(j.status)),review_mode:this.review.required?'strict':'automatic',review_reason:this.review.reason,content:this.content,source_hash:hash(this.content),saved_hash:this.savedHash,version:this.version,
            current_id:this.current,render_status:j?.status||'error',render_error:j?.error||'',theme:this.theme,theme_initialized:this.themeInitialized,key_section:this.keySection,schema_path:this.filename,
            file_conflict:!disk||disk.hash!==this.savedHash,...(disk?{disk_content:disk.content,disk_hash:disk.hash}:{disk_error:'cannot read current UTF-8 schema'})};
    }
    async base(version,savedHash=this.savedHash) {
        assert(version===this.version && savedHash===this.savedHash,'editor revision changed; re-read before editing');
        assert((await this.disk()).hash===this.savedHash,'file changed externally; reload explicitly before editing');
    }
    async save(content) {
        assert(await realpath(this.filename)===this.filename,'schema path changed');
        assert((await this.disk()).hash===this.savedHash,'file changed externally; refusing to overwrite');
        if(hash(content)===this.savedHash) return;
        const info=await stat(this.filename), temp=path.join(path.dirname(this.filename),`.db-camp-${id()}.tmp`);
        const handle=await open(temp,'wx',info.mode&0o777);
        try {
            await handle.writeFile(content,'utf8'); await handle.sync(); await handle.close();
            assert((await this.disk()).hash===this.savedHash,'file changed during save');
            assert(await realpath(this.filename)===this.filename,'schema path changed during save');
            await rename(temp,this.filename);this.savedHash=hash(content);
        } finally {await handle.close().catch(()=>{});await unlink(temp).catch(()=>{});}
    }
    async act(role,action,input={},query=new URLSearchParams()) {
        this.expire();await this.persistReview();
        if(action==='diagram') return this.state();
        if(action==='jobs') {if(query.get('clean')!=='0')try{await this.syncDisk();}catch{/* Keep dirty drafts/candidates and expose the file conflict. */}return {state:await this.state(),jobs:[...this.jobs.values()].filter(j=>j.status==='pending').map(publicJob)};}
        if(action==='sync'){await this.syncDisk();return this.state();}
        if(action==='preview') {
            const j=this.jobs.get(query.get('id')||this.current);assert(j,'unknown preview');
            if(role==='draw'&&j.status==='ready') j.seen=true;
            return {job:publicJob(j),png:j.png||'',svg:j.svg||'',semantic:j.semantic||'',model:j.model||null};
        }
        if(action==='reload') {const d=await this.disk();this.content=d.content;this.savedHash=d.hash;this.version++;this.cancel();this.newCurrent();return this.state();}
        if(action==='theme') {
            assert(['light','dark'].includes(input.theme),'invalid theme');
            assert(input.initialize===undefined||typeof input.initialize==='boolean','invalid theme initialization');
            if(input.key_section!==undefined)assert(typeof input.key_section==='boolean','invalid presentation option');
            // The first viewer claims the browser preference once. Subsequent
            // viewers (including simultaneous startup) only adopt this state.
            if(input.initialize&&this.themeInitialized)return this.state();
            assert(input.version===this.version,'theme or editor revision changed');
            this.themeInitialized=true;
            const unchanged=this.theme===input.theme&&(input.key_section===undefined||input.key_section===this.keySection);
            if(input.key_section!==undefined)this.keySection=input.key_section;
            if(input.initialize&&unchanged)return this.state();
            this.theme=input.theme;this.version++;this.cancel();this.newCurrent('theme');return this.state();
        }
        if(action==='draft') {
            await this.base(input.version);assert(typeof input.content==='string'&&Buffer.byteLength(input.content)<1024*1024,'invalid or oversized source');
            this.content=input.content;this.version++;this.cancel();this.newCurrent();return this.state();
        }
        if(action==='stage') {
            await this.base(input.version,input.saved_hash);assert(typeof input.content==='string'&&Buffer.byteLength(input.content)<1024*1024,'invalid or oversized source');
            assert(![...this.jobs.values()].some(j=>j.kind==='candidate'&&j.status==='pending'),'candidate already rendering');
            let repairs=0, reference='';
            if(input.repair_of) {
                const previous=this.jobs.get(input.repair_of);
                assert(previous&&previous.version===this.version&&previous.status!=='cancelled','invalid repair reference');
                repairs=previous.repairs+1;assert(repairs<=2,'automatic repair limit reached');
                assert(['syntax','visual'].includes(input.adjustment),'repair must be syntax or visual');
                if(input.adjustment==='visual') {assert(previous.status==='ready','visual repair needs a valid rendered reference');reference=previous.semantic;}
            } else assert(!input.adjustment,'adjustment requires repair_of');
            for(const j of this.jobs.values()) if(j.kind==='candidate'&&j.id!==input.repair_of&&j.status==='ready') {j.status='cancelled';delete j.png;delete j.svg;}
            const j=this.newJob('candidate',input.content);j.repairs=repairs;j.reference=reference;return publicJob(j);
        }
        if(action==='report') {
            const j=this.jobs.get(input.id);
            assert(j&&j.status==='pending'&&j.version===this.version&&j.source_hash===input.source_hash,'stale render report');
            if(input.error) {await this.fail(j,input.error);return {job:publicJob(j),state:await this.state()};}
            try{
            assert(input.theme===this.theme&&j.theme===input.theme,'render theme does not match requested theme');
            const png=Buffer.from(input.png||'','base64');assert(png.length<=8*1024*1024&&png.length>=24&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'invalid or oversized PNG');
            const width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert(width>0&&height>0&&width*height<=20000000,'invalid PNG dimensions');
            PNG.sync.read(png,{checkCRC:true});
            assert(typeof input.svg==='string'&&input.svg.includes('<svg')&&input.svg.length<2*1024*1024&&!/<(?:script|foreignObject)\b/i.test(input.svg),'invalid SVG');
            const semantic=JSON.parse(input.semantic);assert(semantic&&typeof semantic==='object','missing ER semantic signature');
            if(j.reference&&j.reference!==input.semantic) {await this.fail(j,'visual repair changed ER semantics');return {job:publicJob(j),state:await this.state()};}
            if(j.kind!=='candidate') await this.save(j.content);
            Object.assign(j,{status:'ready',png:input.png,svg:input.svg,semantic:input.semantic,model:input.model||null});
            if(j.kind!=='candidate') this.remember(j);
            return {job:publicJob(j),state:await this.state()};
            }catch(e){await this.fail(j,e.message);throw e;}
        }
        if(action==='commit') {
            const j=this.jobs.get(input.id);
            assert(j?.kind==='candidate'&&j.status==='ready'&&Array.isArray(input.findings),'successful render required before commit');
            assert(input.review==='pass'?j.seen:input.review==='automatic'&&!this.review.required,'rendered preview must be retrieved and visually reviewed before commit');
            await this.base(j.version,j.base);await this.save(j.content);this.content=j.content;this.version++;
            Object.assign(j,{kind:'current',version:this.version});this.cancel(j.id);this.current=j.id;this.remember(j);
            if(input.review==='pass'){this.review={required:false,reason:''};this.reviewDirty=true;await this.persistReview();}return this.state();
        }
        throw new Error('unknown operation');
    }
}
const permissions={ui:{GET:['diagram','preview','jobs'],POST:['draft','report','reload','theme']},draw:{GET:['diagram','preview'],POST:['stage','commit','sync']},discuss:{GET:['diagram','preview'],POST:[]}};
const inputs={draft:['content','version','saved_hash'],stage:['content','version','saved_hash','repair_of','adjustment'],theme:['theme','version','key_section','initialize'],reload:[],sync:[],report:['id','source_hash','theme','png','svg','semantic','model','error','renderer_version'],commit:['id','review','findings']};
export async function startServer(schema,{descriptor,port=0,resume}={}) {
    const session=await Session.create(schema,{reviewFile:descriptor?`${descriptor}.review.json`:undefined}); let address;
    if(resume){session.tokens=resume.tokens;session.version=resume.version;session.theme=resume.theme;session.themeInitialized=resume.theme_initialized??true;session.keySection=resume.key_section;Object.assign(session.jobs.get(session.current),{version:session.version,theme:session.theme,key_section:session.keySection});}
    const server=http.createServer(async(req,res)=>{
        res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
        const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
        try {
            const url=new URL(req.url,address);
            if(req.headers.host!==new URL(address).host) return json(403,{error:'invalid host'});
            if(url.pathname.startsWith('/api/')) {
                if(req.headers.origin&&req.headers.origin!==address) return json(403,{error:'foreign origin'});
                if(!url.pathname.startsWith('/api/camp/')) return json(403,{error:'session route only'});
                const token=(req.headers.authorization||'').replace(/^Bearer /,''),role=Object.keys(session.tokens).find(r=>session.tokens[r]===token);
                if(!role) return json(401,{error:'unauthorized'});
                const action=url.pathname.slice('/api/camp/'.length);
                if(!permissions[role][req.method]?.includes(action)) return json(403,{error:'operation unavailable for this capability'});
                let input={}; if(req.method==='POST') {
                    let length=0;const chunks=[];
                    for await(const chunk of req) {length+=chunk.length;if(length>16*1024*1024) return json(413,{error:'request too large'});chunks.push(chunk);}
                    input=JSON.parse(Buffer.concat(chunks).toString()||'{}');
                    assert(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>inputs[action].includes(k)),'unknown input field');
                    if(action==='report')assert(input.renderer_version===3,'뷰어가 이전 버전입니다. 브라우저를 한 번 새로고침해 주세요.');
                }
                return json(200,await session.exclusive(()=>session.act(role,action,input,url.searchParams)));
            }
            if(req.method!=='GET') return json(405,{error:'GET only'});
            const filename=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
            assert(/^(?:index\.html|style\.css|app\.js|app\.js\.LEGAL\.txt|third-party\.html|LICENSE|THIRD_PARTY_NOTICES\.md|docs\/[A-Za-z0-9_-]+\.(?:md|json|diff)|licenses\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_.-]+|assets\/chaterd\.png|chunks\/[\w.-]+\.js(?:\.LEGAL\.txt)?)$/.test(filename),'unknown asset');
            const bytes=await readFile(path.join(root,'dist',filename));
            res.writeHead(200,{'Content-Type':filename.endsWith('.html')&&!filename.startsWith('licenses/')?'text/html; charset=utf-8':filename.endsWith('.css')?'text/css':filename.endsWith('.png')?'image/png':filename.endsWith('.js')?'text/javascript':'text/plain; charset=utf-8'});res.end(bytes);
        }catch(e){json(e.code==='ENOENT'?404:409,{error:e.message});}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    address=`http://127.0.0.1:${server.address().port}`;
    const description={api_version:3,runtime_revision:2,url:address,schema_path:session.filename,tokens:session.tokens,pid:process.pid};
    if(descriptor) await writeFile(descriptor,JSON.stringify(description),{mode:0o600});
    return {server,session,descriptor:description};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
    let resume;if(process.argv[4])resume=JSON.parse(await readFile(process.argv[4],'utf8'));
    const result=await startServer(process.argv[2],{descriptor:process.argv[3],...(resume?{port:Number(new URL(resume.url).port),resume}:{})});
    console.log(result.descriptor.url);
    process.on('SIGTERM',()=>result.server.close(()=>process.exit(0)));
}
