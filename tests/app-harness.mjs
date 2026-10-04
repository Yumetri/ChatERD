// Run the actual app coordinator against a real Session. Only browser/editor and
// rasterization are replaced; API revisions, file adoption and jobs are real.
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setImmediate as tick} from 'node:timers/promises';
import {PNG} from 'pngjs';
import {applyTheme,palettes} from '../web/theme.mjs';
const appSource=await readFile(new URL('../web/app.mjs',import.meta.url),'utf8');
function element(){
    const values=new Map(),attributes=new Map();
    const e={dataset:{},style:{setProperty:(k,v)=>values.set(k,v),getPropertyValue:k=>values.get(k)},hidden:true,options:[],value:'',
        setAttribute:(k,v)=>attributes.set(k,v),getAttribute:k=>attributes.get(k),addEventListener(){},focus(){},
        getBoundingClientRect:()=>({width:1000,height:700}),replaceChildren(...items){this.options=items;},add(item){this.options.push(item);},querySelector:()=>e.svg};
    Object.defineProperty(e,'innerHTML',{get:()=>e.html,set(value){e.html=value;e.svg=element();applyTheme(e.svg,/data-theme="(dark|light)"/.exec(value)?.[1]||'light');}});
    return e;
}
export async function appHarness(session,{preference='dark',holdRender}={}){
    const elements=new Map(),root=element(),calls=[],get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
    let state={doc:{toString:()=>'',length:0},selection:{main:{}}};
    class Editor {static theme=()=>null;static updateListener={of:()=>null};constructor(){this.state=state;}setState(s){this.state=s;}requestMeasure(){}dispatch(change){this.setState({doc:{toString:()=>change.changes.insert,length:change.changes.insert.length},selection:{main:{}}});context.harness.changed(change.changes.insert);}}
    const model={entities:[{name:'PILOT',title:'PILOT',attributes:[],metadata:{}}],groups:[],warnings:[],relationships:[]};
    const snapshot=theme=>{const png=new PNG({width:2,height:2});const rgb=Buffer.from(palettes[theme].background.slice(1),'hex');for(let i=0;i<16;i+=4){rgb.copy(png.data,i);png.data[i+3]=255;}const bytes=PNG.sync.write(png);return {svg:`<svg xmlns="http://www.w3.org/2000/svg" data-theme="${theme}" width="100" height="100"/>`,theme,model,width:100,height:100,png:new Blob([bytes]),base64:bytes.toString('base64'),semantic:'{}',keySection:false,view:'all'};};
    const context=vm.createContext({
        document:{documentElement:root,getElementById:get},location:{hash:'#camp=test'},localStorage:{setItem(){}},URLSearchParams,Blob,Uint8Array,atob,console,
        preferredTheme:()=>preference,applyTheme,
        EditorView:Editor,EditorState:{create:()=>state},basicSetup:null,Prec:{highest:x=>x},keymap:{of:()=>null},indentWithTab:null,
        undo(){},redo(){},undoDepth:()=>0,redoDepth:()=>0,StreamLanguage:{define:()=>null},HighlightStyle:{define:()=>null},syntaxHighlighting:()=>null,tags:{},
        loadedEditorState:value=>({doc:{toString:()=>value,length:value.length},selection:{main:{}}}),layoutTransaction(){},formatSource:x=>x,
        sourcePanel(){},viewerMenus(){},viewerShortcuts(){},layoutControls:()=>({refresh(){},changed(){},cancel(){},isDragging:()=>false}),
        renderSnapshot:async(content,theme)=>{await holdRender?.(content,theme);return {...snapshot(theme),content};},drawModel:async(_,theme)=>snapshot(theme),rethemeSnapshot:async(base,theme)=>({...base,...snapshot(theme)}),download(){},columnInfo(){},keyLabel(){},
        Option:class{constructor(label,value){this.label=label;this.value=value;}},DOMParser:class{parseFromString(){return {documentElement:{getAttribute:()=>100}};}},
        ResizeObserver:class{observe(){}},window:{addEventListener(){}},setInterval(){},confirm:()=>true,
        fetch:async(url,options)=>{const action=url.split('/').at(-1),[name,query]=action.split('?'),body=options.body?JSON.parse(options.body):{};calls.push({name,body});try{const data=await session.exclusive(()=>session.act('ui',name,body,new URLSearchParams(query)));return {ok:true,json:async()=>data};}catch(e){return {ok:false,status:409,json:async()=>({error:e.message})};}},
    });
    vm.runInContext(appSource.replace(/^import .*;\n/gm,'').replace(/start\(\)\.catch\(e=>status\(e.message,false,true\)\);\s*$/,'globalThis.boot=start();')+'\nglobalThis.harness={poll,changed,edit:value=>editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:value}})};',context);
    await context.boot;
    const settle=async()=>{for(let i=0;i<30;i++){await tick();await context.harness.poll();if(get('status').textContent==='저장됨'&&session.jobs.get(session.current).status==='ready')return;}throw new Error(`app did not settle: ${get('status').title}`);};
    return {root,elements,calls,settle,poll:()=>context.harness.poll(),edit:value=>context.harness.edit(value),toggle:()=>get('theme').onclick(),view:value=>{get('view').value=value;return get('view').onchange();},svg:()=>get('diagram').svg};
}
