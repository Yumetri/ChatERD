import {EditorView,keymap} from '@codemirror/view';
import {EditorState,Prec} from '@codemirror/state';
import {basicSetup} from 'codemirror';
import {indentWithTab,undo,redo,undoDepth,redoDepth} from '@codemirror/commands';
import {StreamLanguage,HighlightStyle,syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {applyTheme,preferredTheme} from './theme.mjs';
import {renderSnapshot,drawModel,rethemeSnapshot,download} from './render.mjs';
import {columnInfo,keyLabel} from './model.mjs';
import {foreignKeyGroups,foreignKeyGroupLabel,relationshipLabel} from './foreign-keys.mjs';
import {formatSource} from './format.mjs';
import {layoutControls} from './layout-controls.mjs';
import {sourcePanel} from './source-panel.mjs';
import {viewerMenus} from './viewer-menus.mjs';
import {viewerShortcuts} from './shortcuts.mjs';
import {loadedEditorState,layoutTransaction} from './editor-history.mjs';
const $=id=>document.getElementById(id);
let theme=preferredTheme();applyTheme(document.documentElement,theme);
let quiet=false,localDraftDirty=false,fileConflict=false,controls=null,preserveContent=null,version=0,savedHash='',currentID='',generation=0,pending=0,queue=Promise.resolve(),polling=false,full=null,display=null,viewGeneration=0;
let reviewMode='strict',keySection=false,selected='all',selectedEntity=null,transform={x:0,y:0,scale:1};const busy=new Set();
const token=new URLSearchParams(location.hash.slice(1)).get('camp');
const language=StreamLanguage.define({token(stream){if(stream.match(/%%.*/))return 'comment';if(stream.match(/"[^"\n]*"/))return 'string';if(stream.match(/\b(erDiagram|direction|subgraph|end|classDef|class|style|PK|FK|UK)\b/))return 'keyword';if(stream.match(/(?:\|\||o\{|\|\{|\}o|\}\||o\||\|o|--|\.\.)/))return 'operator';if(stream.match(/[{}\[\]:?,]/))return 'punctuation';if(stream.match(/\b(int|bigint|string|text|varchar|boolean|datetime|timestamp|uuid|decimal)\b/))return 'typeName';stream.next();return null;}});
const editorExtensions=[basicSetup,language,keymap.of([indentWithTab]),Prec.highest(keymap.of([{key:'Mod-Shift-z',run:redo,preventDefault:true}])),
    EditorView.theme({'&':{color:'var(--text)',backgroundColor:'var(--background)'},'.cm-content':{caretColor:'var(--accent)'},'.cm-gutters':{backgroundColor:'var(--surface)',color:'var(--muted)',border:'none'},'.cm-activeLine,.cm-activeLineGutter':{backgroundColor:'var(--surface)'},'.cm-selectionBackground,&.cm-focused .cm-selectionBackground':{backgroundColor:'var(--selection)'},'.cm-cursor':{borderLeftColor:'var(--accent)'}}),
    syntaxHighlighting(HighlightStyle.define([{tag:tags.keyword,color:'var(--accent)',fontWeight:'600'},{tag:tags.typeName,color:'var(--accent)'},{tag:tags.string,color:'var(--text)'},{tag:tags.comment,color:'var(--muted)'},{tag:tags.operator,color:'var(--text)'},{tag:tags.punctuation,color:'var(--muted)'}])),
    EditorView.updateListener.of(update=>{if(update.docChanged&&!quiet)changed(update.state.doc.toString());})];
const editor=new EditorView({parent:$('editor'),state:EditorState.create({doc:'',extensions:editorExtensions})});
const content=()=>editor.state.doc.toString();
sourcePanel({onShow:()=>editor.requestMeasure()});
viewerMenus();
function setContent(value){quiet=true;try{editor.setState(loadedEditorState(value,editorExtensions,editor.state.selection.main));}finally{quiet=false;}}
function status(text,ready=false,error=false){$('status').textContent=ready?'저장됨':error?'확인 필요':'처리 중';$('status').title=text;$('status').setAttribute('aria-label',text);$('status').dataset.error=error;$('render-message').textContent=text;for(const id of ['png','svg'])$(id).disabled=!ready;controls?.refresh();}
async function request(action,body){const response=await fetch(`/api/camp/${action}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;}
function accept(state){version=state.version;savedHash=state.saved_hash;currentID=state.current_id;reviewMode=state.review_mode||'strict';keySection=state.key_section;$('pk-section').checked=keySection;setTheme(state.theme);}
function enqueue(fn){pending++;queue=queue.then(fn).catch(e=>{status(`충돌 또는 처리 실패: ${e.message} · 입력 초안은 유지합니다. 변경사항 초기화로 다시 불러올 수 있습니다.`,false,true);throw e;}).finally(()=>pending--);queue.catch(()=>{});return queue;}
function changed(value){if(preserveContent!==value)preserveContent=null;controls?.changed(value);generation++;localDraftDirty=true;full=null;status('편집 중 · 정상 렌더 후 원본에 저장합니다.');enqueue(async()=>{accept(await request('draft',{content:value,version,saved_hash:savedHash}));if(content()===value)localDraftDirty=false;});}
function paint(){const {x,y,scale}=transform;$('diagram').style.transform=`translate(${x}px,${y}px) scale(${scale})`;controls?.refresh();}
function fit(){if(!display)return;const box=$('canvas').getBoundingClientRect();const scale=Math.min(1,(box.width-40)/display.width,(box.height-40)/display.height);transform={x:(box.width-display.width*scale)/2,y:(box.height-display.height*scale)/2,scale:Math.max(.06,scale)};paint();}
function show(snapshot,reset=true){display=snapshot;$('diagram').innerHTML=snapshot.svg;$('diagram').dataset.layoutSource=full?.content||'';$('empty').hidden=true;if(reset)fit();else paint();}
function infoText(parent,tag,value){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
function inspect(name){
    selectedEntity=name;$('inspector').hidden=false;$('details-toggle').setAttribute('aria-expanded','true');const target=$('info');target.replaceChildren();
    if(!full){infoText(target,'p','최신 정상 렌더링을 기다리는 중입니다.');return;}
    const e=full.model.entities.find(e=>e.name===name);
    if(!e){infoText(target,'h2','설계 검토');infoText(target,'p','테이블을 클릭하면 컬럼·제약·FK 참조 정보를 확인할 수 있습니다.');}
    else {
        infoText(target,'h2',e.title);if(e.title!==e.name)infoText(target,'p',e.name);if(e.metadata.description)infoText(target,'p',e.metadata.description);
        infoText(target,'h3','컬럼');for(const a of e.attributes){const row=document.createElement('div');row.className='field-info';const c=columnInfo(e,a);infoText(row,'strong',`${a.name} · ${a.type} ${keyLabel(e,a)}`);if(c.nullable===true)infoText(row,'small','NULL 허용: ○');if(c.default!==undefined)infoText(row,'small',`DEFAULT: ${c.default}`);if(c.generated)infoText(row,'small',`생성: ${c.generated}`);if(c.description||a.comment)infoText(row,'small',c.description||a.comment);target.append(row);}
        infoText(target,'h3','키와 제약');const pk=e.attributes.filter(a=>a.keys.includes('PK')).map(a=>a.name);infoText(target,'p',pk.length?`PRIMARY KEY (${pk.join(', ')})`:'PK 미정');
        for(const u of e.metadata.unique||[])infoText(target,'p',`${u.name}: UNIQUE (${u.columns.join(', ')})`);
        for(const a of e.attributes.filter(a=>a.keys.includes('UK')&&!(e.metadata.unique||[]).some(u=>u.columns.includes(a.name))))infoText(target,'p',`UNIQUE (${a.name})`);
        for(const group of foreignKeyGroups(e)){const {fk}=group;infoText(target,'p',`[${foreignKeyGroupLabel(group)}] ${fk.name}: (${fk.columns.join(', ')}) → ${fk.references.table} (${fk.references.columns.join(', ')})`);if(fk.onDelete||fk.onUpdate)infoText(target,'p',`DELETE ${fk.onDelete||'미정'} · UPDATE ${fk.onUpdate||'미정'}`);const button=infoText(target,'button',`${fk.references.table} 참조 대상 보기`);button.className='reference-button';button.onclick=()=>inspect(fk.references.table);}
        for(const check of e.metadata.checks||[])infoText(target,'p',`CHECK (${check})`);for(const index of e.metadata.indexes||[])infoText(target,'p',`${index.name}: INDEX (${index.columns.join(', ')})`);
        infoText(target,'h3','관계');for(const r of full.model.relationships.filter(r=>r.a===name||r.b===name))infoText(target,'p',`${r.a} → ${r.b}: ${relationshipLabel(full.model,r)} · ${r.identifying?'식별':'비식별'} · ${({ONLY_ONE:'1',ZERO_OR_ONE:'0..1',ONE_OR_MORE:'1..N',ZERO_OR_MORE:'0..N'})[r.cardA]||'미정'} / ${({ONLY_ONE:'1',ZERO_OR_ONE:'0..1',ONE_OR_MORE:'1..N',ZERO_OR_MORE:'0..N'})[r.cardB]||'미정'}`);
    }
    infoText(target,'h3','검토 힌트');const warnings=full.model.warnings.filter(w=>!e||w.includes(e.name));if(!warnings.length)infoText(target,'p','명시된 제약에서 검토 힌트가 없습니다. 설계의 정확성을 자동으로 증명한 것은 아닙니다.');else {const list=document.createElement('ul');warnings.forEach(w=>infoText(list,'li',w));target.append(list);}
}
function updateControls(){
    const select=$('view'),old=selected;select.replaceChildren(new Option('전체 관계도','all'));
    for(const g of full.model.groups)select.add(new Option(`주제: ${g.title}`,`group:${g.id}`));
    for(const e of full.model.entities)select.add(new Option(`관련 테이블: ${e.title}`,`entity:${e.name}`));
    selected=[...select.options].some(o=>o.value===old)?old:'all';select.value=selected;
    $('notice').textContent=full.model.warnings.length?`검토 힌트 ${full.model.warnings.length}개`:'';
    if(!$('inspector').hidden)inspect(selectedEntity);
}
async function displayView(reset=true){
    if(!full)return;const number=++viewGeneration,base=full;status('화면과 전체 내보내기 준비 중');
    const snapshot=selected==='all'?base:await drawModel(base.model,theme,{view:selected,keySection});
    if(number!==viewGeneration||base!==full||pending)return;show(snapshot,reset);
    $('scope').textContent=selected==='all'?`전체 ${full.model.entities.length}개 테이블`:`상세 ${snapshot.svg.match(/data-entity=/g)?.length||0} / 전체 ${full.model.entities.length}개 테이블`;
    status(reviewMode==='strict'?'원본 저장됨 · 이미지 검수가 필요합니다.':'원본 저장됨 · 자동 렌더링 정상',true);
}
async function loadReady(data){const job=data.job;const model=data.model;if(!data.png||!data.svg||!model)throw new Error('렌더 이미지 또는 모델 정보가 없습니다.');const svg=new DOMParser().parseFromString(data.svg,'image/svg+xml').documentElement;
    full={svg:data.svg,png:new Blob([Uint8Array.from(atob(data.png),c=>c.charCodeAt(0))],{type:'image/png'}),model,semantic:data.semantic,theme:job.theme,width:Number(svg.getAttribute('width')),height:Number(svg.getAttribute('height')),keySection:job.key_section,view:'all',content:job.content};updateControls();await displayView(preserveContent!==job.content);if(preserveContent===job.content)preserveContent=null;}
async function renderJob(job){const number=generation;try{
    const reuse=job.kind==='theme'&&full?.content===job.content;
    const snapshot=reuse?(full.keySection===job.key_section?await rethemeSnapshot(full,job.theme):{...await drawModel(full.model,job.theme,{keySection:job.key_section}),content:job.content}):await renderSnapshot(job.content,job.theme,{keySection:job.key_section});
    if(number!==generation||pending)return;
    const report=await request('report',{renderer_version:3,id:job.id,source_hash:job.source_hash,theme:job.theme,png:snapshot.base64,svg:snapshot.svg,semantic:snapshot.semantic,model:snapshot.model});
    if(number!==generation||pending)return;if(report.job.status==='error')throw new Error(report.job.error);
    if(job.kind!=='candidate'&&job.content===content()){accept(report.state);full=snapshot;updateControls();await displayView(!reuse&&preserveContent!==job.content);if(preserveContent===job.content)preserveContent=null;}
}catch(e){if(number!==generation)return;try{await request('report',{renderer_version:3,id:job.id,source_hash:job.source_hash,error:e.message});}catch{}if(job.kind!=='candidate')status(`렌더링 실패: ${e.message} · 현재 초안과 마지막 정상 그림은 유지합니다.`,false,true);}}
async function poll(){if(polling)return;polling=true;try{const data=await request(`jobs?clean=${pending||localDraftDirty?'0':'1'}`);
    reviewMode=data.state.review_mode||'strict';
    fileConflict=data.state.file_conflict;
    if(data.state.file_conflict){status('원본 파일이 외부에서 변경되었습니다. 현재 초안을 유지합니다. 변경사항 초기화로 다시 불러오세요.',false,true);return;}
    // A rejected/still-unsent local edit must never be replaced by polling a
    // concurrent LLM commit. Only an accepted draft or explicit Reset clears it.
    if(pending||localDraftDirty)return;
    if(data.state.version>version){generation++;viewGeneration++;full=null;accept(data.state);setContent(data.state.content);status('새 버전의 그림 준비 중');}
    for(const job of data.jobs){if(job.version!==version||busy.has(job.id))continue;busy.add(job.id);renderJob(job).finally(()=>busy.delete(job.id));}
    if(data.state.render_status==='ready'&&!full){const number=generation,result=await request(`preview?id=${currentID}`);if(number===generation&&!pending&&result.job.version===version&&result.job.content===content())await loadReady(result);}
    if(data.state.render_status==='error')status(`렌더링 실패: ${data.state.render_error} · 현재 초안과 마지막 정상 그림이 다릅니다.`,false,true);
}catch(e){status(e.message,false,true);}finally{polling=false;}}
function themeButton(){const action=theme==='dark'?'라이트 테마로 전환':'다크 테마로 전환';$('theme').setAttribute('aria-label',action);$('theme').title=action;}
// Session presentation is shared by render workers. Recolor the page and the
// previous SVG together before replacing it with a freshly rendered job.
function setTheme(name){theme=name;applyTheme(document.documentElement,theme);const svg=$('diagram').querySelector('svg');if(svg)applyTheme(svg,theme);themeButton();try{localStorage.setItem('db-camp:theme',theme);}catch{}}
themeButton();
function presentation(nextTheme,nextKeySection){generation++;viewGeneration++;setTheme(nextTheme);status('전체 이미지 준비 중 · 원본 내용은 유지합니다.');enqueue(async()=>accept(await request('theme',{version,theme:nextTheme,key_section:nextKeySection})));}
$('theme').onclick=()=>presentation(theme==='dark'?'light':'dark',keySection);
$('pk-section').onchange=()=>presentation(theme,$('pk-section').checked);
$('view').onchange=()=>{selected=$('view').value;displayView().catch(e=>status(e.message,false,true));};
$('format').onclick=()=>editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:formatSource(content())}});
$('reset').onclick=async()=>{if(!confirm('저장되지 않은 변경사항을 버리고 마지막 저장본으로 초기화할까요? 이미 자동 저장된 변경은 유지됩니다.'))return;generation++;viewGeneration++;await queue.catch(()=>{});queue=Promise.resolve();pending=0;try{const s=await request('reload',{});accept(s);setContent(s.content);localDraftDirty=false;full=null;status('원본 다시 불러오는 중');await poll();}catch(e){status(e.message,false,true);}};
$('fit').onclick=fit;$('details-toggle').onclick=()=>{if($('inspector').hidden)inspect(selectedEntity);else {$('inspector').hidden=true;$('details-toggle').setAttribute('aria-expanded','false');}fit();};$('close-inspector').onclick=()=>{$('inspector').hidden=true;$('details-toggle').setAttribute('aria-expanded','false');fit();};
$('notice').onclick=()=>{inspect(null);fit();};
$('diagram').onclick=event=>{const node=event.target.closest('[data-entity]');if(node)inspect(node.dataset.entity);};$('diagram').onkeydown=event=>{if(controls?.key(event)){event.preventDefault();return;}if(['Enter',' '].includes(event.key)){const node=event.target.closest('[data-entity]');if(node){event.preventDefault();inspect(node.dataset.entity);}}};
for(const format of ['png','svg'])$(format).onclick=()=>{if(!$(format).disabled&&full){download(full,format,$('filename').textContent.replace(/\.mmd$/i,''));$('downloads').open=false;}};
function travelHistory(command){if(fileConflict||controls?.isDragging())return false;const focused=editor.hasFocus,result=command(editor);if(result&&!focused)$('canvas').focus({preventScroll:true});return result;}
const editHistory={canUndo:()=>!fileConflict&&undoDepth(editor.state)>0,canRedo:()=>!fileConflict&&redoDepth(editor.state)>0,undo:()=>travelHistory(undo),redo:()=>travelHistory(redo)};
controls=layoutControls({canvas:$('canvas'),diagram:$('diagram'),history:editHistory,getState:()=>({full,content:content(),version,theme,keySection,selected,idle:!pending&&!localDraftDirty&&!fileConflict,ready:!!full&&!pending&&!localDraftDirty&&!fileConflict&&full.content===content()&&full.theme===theme}),save:(value,{preserveView=false}={})=>{preserveContent=preserveView?value:null;editor.dispatch(layoutTransaction(editor.state,value));},notify:status,inspect});
viewerShortcuts({canvas:$('canvas'),undo:()=>{if(!controls.isDragging())editHistory.undo();},redo:()=>{if(!controls.isDragging())editHistory.redo();},showSaveStatus:()=>{$('render-feedback').open=true;}});
let drag=null;$('canvas').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();$('canvas').focus({preventScroll:true});if(controls.begin(e))return;drag={x:e.clientX,y:e.clientY,tx:transform.x,ty:transform.y,entity:e.target.closest('[data-entity]')?.dataset.entity};$('canvas').setPointerCapture(e.pointerId);});$('canvas').addEventListener('pointermove',e=>{if(controls.move(e)||!drag)return;transform.x=drag.tx+e.clientX-drag.x;transform.y=drag.ty+e.clientY-drag.y;paint();});$('canvas').addEventListener('pointerup',e=>{if(controls.end(e))return;if(drag?.entity&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<3)inspect(drag.entity);drag=null;});$('canvas').addEventListener('pointercancel',()=>{controls.cancel();drag=null;});
$('canvas').addEventListener('wheel',e=>{e.preventDefault();const box=$('canvas').getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top,next=Math.max(.05,Math.min(4,transform.scale*Math.exp(-e.deltaY*.002)));transform.x=x-(x-transform.x)*next/transform.scale;transform.y=y-(y-transform.y)*next/transform.scale;transform.scale=next;paint();},{passive:false});new ResizeObserver(()=>fit()).observe($('canvas'));
window.addEventListener('keydown',e=>{if(e.key==='Escape'){controls.cancel();drag=null;}});
async function start(){if(!token)throw new Error('runtime/cli.mjs preview로 인증된 뷰어를 열어 주세요.');const preference=theme,s=await request('diagram');accept(s);setContent(s.content);const filename=s.schema_path.split(/[\\/]/).pop();$('filename').textContent=filename;$('filename').title=filename;document.title=`ChatERD · ${filename}`;if(!s.theme_initialized)await enqueue(async()=>accept(await request('theme',{version,theme:preference,key_section:keySection,initialize:true})));await poll();setInterval(poll,350);}
start().catch(e=>status(e.message,false,true));
