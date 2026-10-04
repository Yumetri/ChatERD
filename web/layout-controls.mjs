import {readPlacement,writePlacement,defaultPlacement,nearestAnchor,relationshipKey,relationshipKeys} from './placement.mjs';
import {placeGeometry} from './routing.mjs';
import {createGeometryUpdater} from './render.mjs';
import {foreignKeyBindings,fieldOffset} from './field-anchors.mjs';
const NS='http://www.w3.org/2000/svg';
export function layoutControls({canvas,diagram,getState,save,notify,inspect,history}) {
    const $=id=>document.getElementById(id);
    let drag=null,selected=null,writing=false,expected='',frame=0,latest=null,pendingFocus=null;
    const hint=text=>{$('layout-hint').textContent=text;$('layout-hint').title=text;};
    const valid=s=>s.full&&s.ready&&s.selected==='all';
    const world=e=>{const svg=diagram.querySelector('svg'),p=new DOMPoint(e.clientX,e.clientY);return p.matrixTransform(svg.getScreenCTM().inverse());};
    const canAuto=s=>valid(s)||s.idle&&s.selected==='all'&&s.content.trim();
    function updateSource(value,{allowDraft=false,preserveView=false}={}){const s=getState();if(!valid(s)&&!(allowDraft&&canAuto(s)))return;
        writing=true;expected=value;try{save(value,{preserveView});}finally{writing=false;}
        $('layout-undo').disabled=!history.canUndo();$('layout-redo').disabled=!history.canRedo();
    }
    function changed(value){expected=value;if(!writing)pendingFocus=null;}
    function restoreFocus(s){if(!pendingFocus||!valid(s)||s.content!==pendingFocus.content||diagram.dataset.layoutSource!==pendingFocus.content)return;
        if(document.activeElement!==document.body&&!diagram.contains(document.activeElement)){pendingFocus=null;return;}
        const target=pendingFocus.entity?[...diagram.querySelectorAll('[data-entity]')].find(n=>n.dataset.entity===pendingFocus.entity):diagram.querySelector(`[data-layout-handle="${pendingFocus.kind}"]`);
        if(target){pendingFocus=null;target.focus({preventScroll:true});}}
    function refresh(){const s=getState();
        if(expected&&s.content!==expected&&!writing){expected=s.content;pendingFocus=null;}
        // Keep the chosen mode while its new render is pending; do not flash
        // back to the default when changed() temporarily clears the snapshot.
        if(s.full)$('layout-mode').value=s.full.model.placement?.mode||defaultPlacement(s.full.model).mode;
        else try{const pending=readPlacement(s.content);if(pending)$('layout-mode').value=pending.mode;}catch{/* Invalid drafts retain the last chosen mode. */}
        for(const id of ['layout-mode','layout-reset'])$(id).disabled=!canAuto(s);
        $('manual-layout').disabled=!valid(s);
        $('layout-undo').disabled=!!drag||!history.canUndo();
        $('layout-redo').disabled=!!drag||!history.canRedo();
        const focusedHandle=diagram.contains(document.activeElement)?document.activeElement.dataset.layoutHandle:null;
        diagram.querySelector('.layout-controls')?.remove();if(!selected||!valid(s)||!$('manual-layout').checked){restoreFocus(s);return;}
        const model=s.full.model,r=model.relationships.find(r=>r.id===selected),edge=(drag?.geometry||model.geometry).edges.find(e=>e.id===selected);if(!r||!edge){selected=null;return;}
        const section=edge.sections[0],points=[section.startPoint,...section.bendPoints,section.endPoint],placement=(drag?.next||model.placement)?.edges?.[relationshipKey(r,model.relationships)];
        const segments=points.slice(1,-2).map((p,i)=>({p,q:points[i+2],length:Math.hypot(points[i+2].x-p.x,points[i+2].y-p.y)})).sort((a,b)=>b.length-a.length),segment=segments[0]||{p:points[1],q:points.at(-2)};
        const via=placement?.via||{x:(segment.p.x+segment.q.x)/2,y:(segment.p.y+segment.q.y)/2};
        const svg=diagram.querySelector('svg'),scale=Math.hypot(svg.getScreenCTM().a,svg.getScreenCTM().b),g=document.createElementNS(NS,'g');g.setAttribute('class','layout-controls');
        for(const [kind,p]of [['from',section.startPoint],['via',via],['to',section.endPoint]]){
            const c=document.createElementNS(NS,'circle');for(const [k,v]of Object.entries({cx:p.x,cy:p.y,r:7/Math.max(.05,scale),'data-layout-handle':kind,'data-relation':selected,tabindex:0,role:'button','aria-label':kind==='via'?'관계선 경로 조절점':kind==='from'?'시작 연결 지점':'끝 연결 지점'}))c.setAttribute(k,v);g.append(c);
        }svg.append(g);if(focusedHandle)g.querySelector(`[data-layout-handle="${focusedHandle}"]`)?.focus({preventScroll:true});restoreFocus(s);
    }
    $('layout-mode').onchange=()=>{const s=getState();if(!canAuto(s))return;const box=canvas.getBoundingClientRect(),mode=$('layout-mode').value;
        updateSource(writePlacement(s.content,{version:1,mode,...(mode==='screen'?{aspect:Math.round(Math.max(.1,Math.min(10,box.width/box.height))*1000)/1000}:{}),nodes:{},edges:{}}),{allowDraft:true});selected=null;hint('자동 배치를 적용합니다. 수동 위치는 되돌리기로 복원할 수 있습니다.');};
    $('layout-reset').onclick=()=>{const s=getState();if(!canAuto(s))return;let p;try{p=readPlacement(s.content);}catch{}p||=s.full?defaultPlacement(s.full.model):{version:1,mode:$('layout-mode').value};updateSource(writePlacement(s.content,{...p,nodes:{},edges:{}}),{allowDraft:true});selected=null;hint('수동 위치를 지우고 현재 모드로 자동 배치합니다.');};
    $('layout-undo').onclick=()=>{if(!drag)history.undo();};$('layout-redo').onclick=()=>{if(!drag)history.redo();};
    $('manual-layout').onchange=()=>{refresh();hint($('manual-layout').checked?'테이블 드래그 · 관계선 클릭 후 조절점 드래그':'빈 공간 드래그로 이동 · 휠로 확대');};
    function placement(s){const p=structuredClone(s.full.model.placement||defaultPlacement(s.full.model));
        p.nodes=Object.fromEntries(Object.entries(s.full.model.geometry.entities).map(([id,n])=>[id,{x:n.x,y:n.y}]));p.edges||={};
        const nodes={...s.full.model.geometry.entities,...s.full.model.geometry.groups};
        const relations=new Map(s.full.model.relationships.map(r=>[r.id,r])),keys=relationshipKeys(s.full.model.relationships);
        for(const e of s.full.model.geometry.edges){const r=relations.get(e.id),key=keys.get(e.id),section=e.sections[0];p.edges[key]={from:nearestAnchor(nodes[r.a],section.startPoint),to:nearestAnchor(nodes[r.b],section.endPoint),...(p.edges[key]||{})};}
        return p;
    }
    function begin(e){const s=getState();if(e.button!==0||!valid(s)||!$('manual-layout').checked)return false;
        const entity=e.target.closest('[data-entity]')?.dataset.entity,hit=e.target.closest('[data-relation]');if(!entity&&!hit){selected=null;refresh();return false;}
        selected=hit?.dataset.relation||null;
        drag={entity,relation:selected,kind:e.target.dataset.layoutHandle||'via',x:e.clientX,y:e.clientY,point:world(e),state:s,placement:placement(s),moved:false,error:null,cache:{},updater:createGeometryUpdater(diagram.querySelector('svg'),s.full.model)};
        canvas.setPointerCapture(e.pointerId);return true;
    }
    function update(e){if(!drag)return;const s=getState();if(s.content!==drag.state.content||s.version!==drag.state.version||!valid(s)){cancel();hint('새 편집 버전이 도착해 위치 조절을 취소했습니다.');return;}
        if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<3&&!drag.moved)return;
        if(drag.lastX===e.clientX&&drag.lastY===e.clientY)return;
        drag.lastX=e.clientX;drag.lastY=e.clientY;
        const p=world(e),draft={...drag.placement,nodes:{...drag.placement.nodes},edges:{...drag.placement.edges}};const round=n=>Math.round(n*100)/100;
        if(!drag.moved){drag.moved=true;notify('배치 조절 중 · 놓으면 정상 렌더 후 저장합니다.',false);}
        if(drag.entity){const original=drag.state.full.model.geometry.entities[drag.entity];draft.nodes[drag.entity]={x:round(Math.max(48,original.x+p.x-drag.point.x)),y:round(Math.max(48,original.y+p.y-drag.point.y))};}
        else {const r=s.full.model.relationships.find(r=>r.id===drag.relation),key=relationshipKey(r,s.full.model.relationships),nodes={...s.full.model.geometry.entities,...s.full.model.geometry.groups};
            draft.edges[key]={...draft.edges[key],[drag.kind]:drag.kind==='via'?{x:round(Math.max(16,p.x)),y:round(Math.max(16,p.y))}:nearestAnchor(nodes[drag.kind==='from'?r.a:r.b],p)};}
        try{const geometry=placeGeometry(s.full.model,s.full.model.geometry,draft,drag.cache);
            drag.updater(geometry);drag.geometry=geometry;
            drag.next=draft;drag.error=null;refresh();hint('놓으면 저장합니다. 기호 주변 공간과 테이블 겹침을 확인합니다.');
        }catch(error){drag.error=error;hint(error.message);}
    }
    function move(e){if(!drag)return false;latest={clientX:e.clientX,clientY:e.clientY};if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(latest)update(latest);});return true;}
    function end(e){if(!drag)return false;if(frame){cancelAnimationFrame(frame);frame=0;}update(e);if(!drag)return true;const finished=drag;drag=null;latest=null;
        if(!finished.moved){if(finished.entity)inspect(finished.entity);else {hint('가운데 조절점은 경로, 양끝 조절점은 테이블 연결 위치를 바꿉니다.');refresh();}
            const target=[...diagram.querySelectorAll('[role="button"]')].find(n=>finished.entity?n.dataset.entity===finished.entity:n.dataset.relation===finished.relation&&(n.dataset.layoutHandle||'via')===finished.kind);
            target?.focus({preventScroll:true});return true;}
        if(finished.error||!finished.next){diagram.innerHTML=finished.state.full.svg;refresh();notify('원본 유지 · 적용하지 못한 배치입니다.',true);return true;}
        updateSource(writePlacement(finished.state.content,finished.next),{preserveView:true});hint('배치 메타데이터를 저장하고 전체 이미지를 준비합니다.');return true;
    }
    function cancel(){if(frame)cancelAnimationFrame(frame);frame=0;latest=null;const s=getState(),moved=drag?.moved;if(moved&&s.full)diagram.innerHTML=s.full.svg;drag=null;refresh();if(moved&&valid(s))notify('위치 조절 취소 · 저장된 배치를 유지합니다.',true);}
    function key(e){const s=getState();if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey||!valid(s)||!$('manual-layout').checked)return false;const target=e.target.closest('[data-relation]'),entity=e.target.closest('[data-entity]')?.dataset.entity;
        if(target&&['Enter',' '].includes(e.key)){selected=target.dataset.relation;refresh();diagram.querySelector('[data-layout-handle="via"]')?.focus({preventScroll:true});hint('조절점을 드래그하거나 방향키로 이동하세요.');return true;}
        const change={ArrowLeft:{x:-10,y:0},ArrowRight:{x:10,y:0},ArrowUp:{x:0,y:-10},ArrowDown:{x:0,y:10}}[e.key];if(!change||(!entity&&!target?.dataset.layoutHandle))return false;
        const draft=placement(s);if(entity){const p=draft.nodes[entity];p.x=Math.max(48,p.x+change.x);p.y=Math.max(48,p.y+change.y);}
        else {const r=s.full.model.relationships.find(r=>r.id===target.dataset.relation),entry=draft.edges[relationshipKey(r,s.full.model.relationships)],kind=target.dataset.layoutHandle;
            if(kind==='via')entry.via={x:Math.max(16,Number(target.getAttribute('cx'))+change.x),y:Math.max(16,Number(target.getAttribute('cy'))+change.y)};
            else {
                const node=s.full.model.geometry.entities[kind==='from'?r.a:r.b],offset=fieldOffset(node,foreignKeyBindings(s.full.model).get(r.id)?.[kind]);
                if(offset!==undefined){if(!change.x){hint('FK 연결 지점의 높이는 컬럼 행을 따릅니다. 좌우 방향키로 연결 면을 바꾸세요.');return true;}entry[kind]={side:change.x<0?'W':'E',ratio:Math.max(.05,Math.min(.95,offset/node.height))};}
                else entry[kind].ratio=Math.max(.05,Math.min(.95,entry[kind].ratio+(change.x||change.y)/400));
            }}
        try{placeGeometry(s.full.model,s.full.model.geometry,draft);const value=writePlacement(s.content,draft);pendingFocus={entity,kind:target?.dataset.layoutHandle,content:value};updateSource(value,{preserveView:true});hint('키보드로 조정한 배치를 저장합니다.');}catch(error){hint(error.message);}return true;
    }
    return {begin,move,end,cancel,refresh,changed,key,isDragging:()=>!!drag};
}
