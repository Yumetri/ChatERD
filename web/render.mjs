import mermaid from 'mermaid';
import ELK from 'elkjs/lib/elk.bundled.js';
import {load,JSON_SCHEMA} from 'js-yaml';
import {extractModel,semanticSignature,columnInfo,keyLabel,selectView} from './model.mjs';
import {applyTheme} from './theme.mjs';
import {absoluteEdges,cardinalityGraph,cardinalityEdges,GROUP_PADDING,cardinalityAreas} from './layout.mjs';
import {placeGeometry,packedGeometry} from './routing.mjs';
import {fieldOffsets,fieldConnections,fieldPortOffsets,FIELD_PORT_SPACING} from './field-anchors.mjs';
import {chooseGeometry} from './readability.mjs';
const NS='http://www.w3.org/2000/svg',FONT='"Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif';
const elk=new ELK(); let queue=Promise.resolve();
const columns=[['name','필드명'],['type','데이터 타입'],['keys','키 / 제약'],['nullable','NULL 허용'],['comment','설명']];
function element(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [key,v]of Object.entries(attrs))e.setAttribute(key,v);if(text!==undefined)e.textContent=text;return e;}
let measurementContext;
const widthsCache=new Map(),linesCache=new Map();let metricsCache=new WeakMap();
function cached(cache,key,compute){if(cache.has(key))return cache.get(key);const value=compute();if(cache.size>=12000)cache.clear();cache.set(key,value);return value;}
// A canvas per character made dragging large tables especially expensive.
// Bounded text caches and weak entity keys never retain old schema snapshots.
function measure(text,size=14,bold=false){return cached(widthsCache,JSON.stringify([text,size,bold]),()=>{const c=measurementContext||=document.createElement('canvas').getContext('2d');c.font=`${bold?'600 ':''}${size}px ${FONT}`;return Math.ceil(c.measureText(text).width);});}
function lines(text,max,size=14,bold=false){return cached(linesCache,JSON.stringify([text,max,size,bold]),()=>{const result=[];let line='';for(const ch of String(text)){if(ch==='\n'||(line&&measure(line+ch,size,bold)>max)){result.push(line);line='';}if(ch!=='\n')line+=ch;}result.push(line);return result;});}
if(typeof document!=='undefined')document.fonts?.addEventListener('loadingdone',()=>{widthsCache.clear();linesCache.clear();metricsCache=new WeakMap();});
function text(parent,value,x,y,width,size=14,bold=false,role,anchor='start'){const l=lines(value,width,size,bold), t=element('text',{x,y,'font-size':size,'font-weight':bold?'600':'400','text-anchor':anchor,class:role||''});l.forEach((line,i)=>t.append(element('tspan',{x,dy:i?size+5:0},line)));parent.append(t);return l.length*(size+5);}
function styling(entity){const css={};for(const statement of entity.styles)for(const part of statement.split(';')){const at=part.indexOf(':');if(at<0)continue;const key=part.slice(0,at).trim(),value=part.slice(at+1).trim();if(['fill','stroke','color'].includes(key)&&CSS.supports('color',value)&&!value.includes('var('))css[key]=value;if(key==='font-size'&&/^[\d.]+(?:px|pt)$/.test(value))css.size=Math.max(10,Math.min(28,parseFloat(value)*(value.endsWith('pt')?4/3:1)));}return css;}
function tableMetrics(entity,keySection,connections=new Map()){
    const key=JSON.stringify([!!keySection,[...connections].map(([field,keys])=>[field,keys.length])]),entries=metricsCache.get(entity);if(entries?.has(key))return entries.get(key);
    const style=styling(entity),size=style.size||14;
    const attrs=keySection?[...entity.attributes.filter(a=>a.keys.includes('PK')),...entity.attributes.filter(a=>!a.keys.includes('PK'))]:entity.attributes;
    const values=attrs.map(a=>{const c=columnInfo(entity,a);return [a.name,a.type,keyLabel(entity,a),c.nullable===true?'○':'',c.description??a.comment];});
    const widths=columns.map(([,label],i)=>Math.max(measure(label,size,true)+24,Math.min([230,170,180,70,280][i],Math.max(0,...values.map(row=>measure(row[i],size,i===2)))+24)));
    const titleLines=lines(entity.title,Math.max(140,widths.reduce((a,b)=>a+b,0)-24),size+2,true);
    const titleHeight=Math.max(40,titleLines.length*(size+7)+16)+(entity.title!==entity.name?size+10:0);
    const headerHeight=size+24;
    const rowHeights=values.map((row,index)=>{
        const count=connections.get(attrs[index].name)?.length||0;
        return Math.max(Math.max(...row.map((v,i)=>lines(v,widths[i]-24,size,i===2).length))*(size+5)+18,count>1?count*FIELD_PORT_SPACING+18:0);
    });
    const width=entity.attributes.length?widths.reduce((a,b)=>a+b,0):Math.max(160,measure(entity.title,size+2,true)+32);
    const value={entity,attrs,values,widths,titleHeight,headerHeight,rowHeights,width,height:titleHeight+(attrs.length?headerHeight+rowHeights.reduce((a,b)=>a+b,0):0),size,style};
    const cache=entries||new Map();cache.set(key,value);metricsCache.set(entity,cache);return value;
}
const direction=d=>({TB:'DOWN',BT:'UP',LR:'RIGHT',RL:'LEFT'}[d]||'DOWN');
async function layoutModel(model,options,layoutDirection=model.direction){
    const connections=fieldConnections(model),metrics=new Map(model.entities.map(e=>[e.name,tableMetrics(e,options.keySection,connections.get(e.name))]));
    const children=new Map();children.set('root',[]);
    for(const g of model.groups) children.set(g.id,[]);
    for(const e of model.entities){const m=metrics.get(e.name);(children.get(e.parent)||children.get('root')).push({id:e.name,width:m.width,height:m.height});}
    const groupPadding=`[${Object.entries(GROUP_PADDING).map(([side,size])=>`${side}=${size}`).join(',')}]`;
    for(const g of model.groups){const node={id:g.id,children:children.get(g.id),layoutOptions:{'elk.padding':groupPadding,'elk.direction':direction(layoutDirection)}};(children.get(g.parent)||children.get('root')).push(node);}
    const edges=model.relationships.map(r=>({id:r.id,sources:[r.a],targets:[r.b],labels:[{text:r.label,width:measure(r.label,13)+16,height:26}]}));
    const graph={id:'root',children:children.get('root'),edges,layoutOptions:{'elk.algorithm':'layered','elk.direction':direction(layoutDirection),
        'elk.hierarchyHandling':'INCLUDE_CHILDREN','elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':String(model.visual?.nodeSpacing||48),
        'elk.layered.spacing.nodeNodeBetweenLayers':String(model.visual?.rankSpacing||96),'elk.spacing.edgeNode':'28',
        'elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES','elk.padding':'[top=32,left=32,bottom=32,right=32]'}};
    const routed=cardinalityGraph(graph);
    const result=await elk.layout(routed.graph);return {result,metrics,portOwners:routed.portOwners};
}
function table(svg,m,x,y,keySection){
    const e=m.entity,g=element('g',{class:'entity','data-entity':e.name,transform:`translate(${x},${y})`,tabindex:0,role:'button','aria-label':`${e.name} 테이블 상세`});
    if(m.style.fill)g.style.setProperty('--table-surface',m.style.fill);if(m.style.stroke)g.style.setProperty('--border',m.style.stroke);if(m.style.color)g.style.setProperty('--text',m.style.color);
    g.append(element('rect',{width:m.width,height:m.height,rx:5,class:'table-base'}));
    g.append(element('rect',{width:m.width,height:m.titleHeight,rx:5,class:'table-heading'}));
    text(g,e.title,12,24,m.width-24,m.size+2,true,'table-title');
    if(e.title!==e.name)text(g,e.name,12,m.titleHeight-10,m.width-24,12,false,'physical-name');
    if(m.attrs.length){
        let rowY=m.titleHeight;
        g.append(element('rect',{y:rowY,width:m.width,height:m.headerHeight,class:'column-heading'}));
        let left=0;columns.forEach(([role,label],i)=>{const centered=role==='keys'||role==='nullable';text(g,label,left+(centered?m.widths[i]/2:12),rowY+m.size+9,m.widths[i]-24,m.size,true,'column-title',centered?'middle':'start');left+=m.widths[i];});
        rowY+=m.headerHeight;
        m.values.forEach((row,index)=>{
            const height=m.rowHeights[index];g.append(element('rect',{y:rowY,width:m.width,height,class:index%2?'alternate-row':'data-row'}));
            if(keySection&&index&&m.attrs[index-1].keys.includes('PK')&&!m.attrs[index].keys.includes('PK'))g.append(element('line',{x1:0,x2:m.width,y1:rowY,y2:rowY,class:'pk-divider'}));
            let x=0;row.forEach((v,i)=>{const role=columns[i][0],centered=role==='keys'||role==='nullable',cell=element('g',{'data-column':role,'data-field':m.attrs[index].name});text(cell,v,x+(centered?m.widths[i]/2:12),rowY+m.size+9,m.widths[i]-24,m.size,i===2,i===2?'key-text':'',centered?'middle':'start');g.append(cell);x+=m.widths[i];});
            rowY+=height;g.append(element('line',{x1:0,x2:m.width,y1:rowY,y2:rowY,class:'grid-line'}));
        });
        let x=0;m.widths.slice(0,-1).forEach(w=>{x+=w;g.append(element('line',{x1:x,x2:x,y1:m.titleHeight,y2:m.height,class:'grid-line'}));});
    }
    svg.append(g);
}
function markerTransform(p,q){return `translate(${p.x},${p.y}) rotate(${Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI})`;}
function pathData(section){return [section.startPoint,...(section.bendPoints||[]),section.endPoint].map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ');}
function marker(svg,p,q,card,edge,end){
    const g=element('g',{class:'cardinality',transform:markerTransform(p,q),'data-cardinality':card,'data-layout-edge':edge,'data-layout-end':end});
    const bar=x=>g.append(element('line',{x1:x,x2:x,y1:-7,y2:7}));
    // Cardinalities stay solid even when the non-identifying relationship
    // is dashed; otherwise the middle crow-foot prong can disappear.
    g.append(element('line',{x1:0,x2:card==='ZERO_OR_MORE'||card==='ONE_OR_MORE'?27:23,y1:0,y2:0}));
    if(card==='ZERO_OR_MORE'||card==='ONE_OR_MORE'){g.append(element('path',{d:'M 0 -7 L 14 0 L 0 7'}));if(card==='ZERO_OR_MORE')g.append(element('circle',{cx:23,cy:0,r:4}));else bar(23);}
    else {bar(7);if(card==='ZERO_OR_ONE')g.append(element('circle',{cx:19,cy:0,r:4}));else if(card==='ONLY_ONE')bar(16);else g.append(element('text',{x:18,y:4},'?'));}
    svg.append(g);
}
function svgStyle(svg){svg.append(element('style',{},`svg[data-view]{font-family:${FONT};fill:var(--text)}.canvas{fill:var(--background)}
 .group-fill{fill:var(--surface);fill-opacity:.45;stroke:none}.group-box{fill:none;stroke:var(--border);stroke-dasharray:5 4}.group-title{fill:var(--muted);font-weight:600}
 .table-base{fill:var(--table-surface);stroke:var(--border)}.table-heading,.column-heading{fill:var(--table-header)}.table-title,.key-text{fill:var(--accent)}.physical-name{fill:var(--muted)}
 .data-row{fill:var(--table-surface)}.alternate-row{fill:var(--table-alternate)}.grid-line{stroke:var(--border);stroke-width:.6}.pk-divider{stroke:var(--line);stroke-width:2}
 .relationship{fill:none;stroke:var(--line);stroke-width:1.5}.relationship-hit{fill:none;stroke:transparent;stroke-width:14;pointer-events:stroke;cursor:pointer}.cardinality{stroke:var(--line);stroke-width:1.5;fill:none;pointer-events:none}.cardinality circle{fill:var(--background)}
 .edge-label-bg{fill:var(--background)}.edge-label{fill:var(--text)}.entity{cursor:pointer}.entity:focus .table-base{stroke:var(--accent);stroke-width:3}`));}
export function geometryBounds(geometry){
    const points=[...Object.values(geometry.entities),...Object.values(geometry.groups)].map(n=>({x:n.x+n.width,y:n.y+n.height}));
    for(const e of geometry.edges){for(const s of e.sections||[])points.push(s.startPoint,s.endPoint,...(s.bendPoints||[]));for(const l of e.labels||[])points.push({x:l.x+l.width,y:l.y+l.height});}
    return {width:Math.ceil(Math.max(168,...points.map(p=>p.x))+32),height:Math.ceil(Math.max(88,...points.map(p=>p.y))+32)};
}
export function geometrySVG(fullModel,geometry,theme='light',{view='all',keySection=false}={}){
    const model=selectView(fullModel,view),connections=fieldConnections(model),metrics=new Map(model.entities.map(e=>[e.name,tableMetrics(e,keySection,connections.get(e.name))])),bounds=geometryBounds(geometry);
    const width=Math.ceil(Math.max(bounds.width,measure(model.title||'',16,true)+64)),height=bounds.height;
    if(width*height*4>20000000)throw new Error('전체 그림이 너무 큽니다. 스키마를 주제별로 분리해 주세요.');
    const svg=element('svg',{xmlns:NS,width,height,viewBox:`0 0 ${width} ${height}`,'data-view':view,role:'img','aria-label':`${model.entities.length}개 테이블 ERD`});applyTheme(svg,theme);svgStyle(svg);svg.append(element('rect',{width,height,class:'canvas'}));
    if(model.title)text(svg,model.title,32,22,width-64,16,true,'diagram-title');
    const positions=new Map(Object.entries(geometry.entities)),groupPositions=new Map(Object.entries(geometry.groups));
    const areas=cardinalityAreas(geometry.edges);
    // A deterministic, geometry-specific id also avoids collisions when two
    // different SVG diagrams are embedded in the same document.
    let hash=2166136261;for(const ch of JSON.stringify(areas))hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
    const maskId=`group-clearance-${hash.toString(16)}`;
    if(groupPositions.size&&areas.length){const defs=element('defs'),mask=element('mask',{id:maskId,maskUnits:'userSpaceOnUse',x:0,y:0,width,height,'mask-type':'luminance'});
        mask.append(element('rect',{x:0,y:0,width,height,fill:'white'}));for(const area of areas)mask.append(element('rect',{...area,fill:'black',class:'cardinality-clearance'}));defs.append(mask);svg.append(defs);}
    for(const [name,g]of groupPositions){const title=model.groups.find(s=>s.id===name)?.title||name,attrs={x:g.x,y:g.y,width:g.width,height:g.height,rx:8};svg.append(element('rect',{...attrs,class:'group-fill','data-layout-group':name}));svg.append(element('rect',{...attrs,class:'group-box','data-group':name,...(areas.length?{mask:`url(#${maskId})`}:{})}));text(svg,title,g.x+16,g.y+25,g.width-32,14,true,'group-title');svg.lastChild.setAttribute('data-layout-group',name);}
    const rels=new Map(model.relationships.map(r=>[r.id,r]));
    const edges=geometry.edges,symbols=[];
    for(const edge of edges){const r=rels.get(edge.id);for(const section of edge.sections||[]){const points=[section.startPoint,...(section.bendPoints||[]),section.endPoint],d=pathData(section);svg.append(element('path',{d,class:'relationship','stroke-dasharray':r.identifying?'none':'6 4','data-relation':r.id}));svg.append(element('path',{d,class:'relationship-hit','data-relation':r.id,tabindex:0,role:'button','aria-label':`${r.a}와 ${r.b}: ${r.label} 관계선 조절`}));symbols.push([points[0],points[1],r.cardA,r.id,'from'],[points.at(-1),points.at(-2),r.cardB,r.id,'to']);}for(const label of edge.labels||[]){if(label.x===undefined)continue;svg.append(element('rect',{x:label.x,y:label.y,width:label.width,height:label.height,rx:4,class:'edge-label-bg','data-layout-edge':r.id}));text(svg,r.label,label.x+8,label.y+18,label.width-16,13,false,'edge-label');svg.lastChild.setAttribute('data-layout-edge',r.id);}}
    for(const [p,q,card,edge,end] of symbols)marker(svg,p,q,card,edge,end);
    for(const [name,p]of positions)table(svg,metrics.get(name),p.x,p.y,keySection);
    return {svg:new XMLSerializer().serializeToString(svg),width,height};
}
// Drag previews update geometry attributes only. Table cells, styles, focus,
// viewBox and camera survive; exports still use the complete shared renderer.
export function createGeometryUpdater(svg,model,geometry=model.geometry){
    // A running server can retain SVGs produced before the drag identifiers
    // were introduced. Hydrate their existing nodes once; never force a source
    // edit or discard the valid saved snapshot just to upgrade the viewer.
    const missing=node=>node&&!node.hasAttribute('data-layout-edge');
    if(geometry&&(missing(svg.querySelector('.cardinality'))||missing(svg.querySelector('.edge-label-bg'))||svg.querySelector('.group-fill:not([data-layout-group])'))){
        const fills=[...svg.querySelectorAll('.group-fill')],titles=[...svg.querySelectorAll('.group-title')];
        Object.keys(geometry.groups).forEach((name,i)=>{fills[i].setAttribute('data-layout-group',name);titles[i].setAttribute('data-layout-group',name);});
        const markers=[...svg.querySelectorAll('.cardinality')],backgrounds=[...svg.querySelectorAll('.edge-label-bg')],labels=[...svg.querySelectorAll('.edge-label')];let markerIndex=0,labelIndex=0;
        for(const edge of geometry.edges){for(const section of edge.sections||[])for(const end of ['from','to']){const node=markers[markerIndex++];node.setAttribute('data-layout-edge',edge.id);node.setAttribute('data-layout-end',end);}
            for(const label of edge.labels||[])if(label.x!==undefined){backgrounds[labelIndex].setAttribute('data-layout-edge',edge.id);labels[labelIndex++].setAttribute('data-layout-edge',edge.id);}}
    }
    const entities=new Map([...svg.querySelectorAll('[data-entity]')].map(n=>[n.dataset.entity,n]));
    const groups=new Map(model.groups.map(g=>[g.id,{title:g.title||g.id,nodes:[]}]));
    for(const node of svg.querySelectorAll('[data-layout-group], [data-group]'))groups.get(node.dataset.layoutGroup||node.dataset.group)?.nodes.push(node);
    const edges=new Map(model.relationships.map(r=>[r.id,{paths:[],markers:[],labels:[]}]));
    for(const node of svg.querySelectorAll('[data-relation]'))if(node.tagName==='path')edges.get(node.dataset.relation)?.paths.push(node);
    for(const node of svg.querySelectorAll('[data-layout-edge]')){const entry=edges.get(node.dataset.layoutEdge);if(node.classList.contains('cardinality'))entry?.markers.push(node);else entry?.labels.push(node);}
    const mask=svg.querySelector('mask'),areas=[...svg.querySelectorAll('.cardinality-clearance')],canvas=svg.querySelector('.canvas');
    const attrs=(node,values)=>{for(const [key,value]of Object.entries(values))if(node.getAttribute(key)!==String(value))node.setAttribute(key,value);};
    let previous=null;
    return geometry=>{
        const bounds=geometryBounds(geometry),width=Math.ceil(Math.max(bounds.width,measure(model.title||'',16,true)+64)),height=bounds.height;
        if(width*height*4>20000000)throw new Error('전체 그림이 너무 큽니다. 스키마를 주제별로 분리해 주세요.');
        attrs(canvas,{width,height});if(mask){attrs(mask,{width,height});attrs(mask.firstChild,{width,height});}
        for(const [name,p]of Object.entries(geometry.entities)){const old=previous?.entities[name];if(!old||p.x!==old.x||p.y!==old.y)attrs(entities.get(name),{transform:`translate(${p.x},${p.y})`});}
        for(const [name,g]of Object.entries(geometry.groups)){const old=previous?.groups[name];if(old&&g.x===old.x&&g.y===old.y&&g.width===old.width&&g.height===old.height)continue;
            const entry=groups.get(name);for(let i=0;i<entry.nodes.length;i++){const node=entry.nodes[i];if(node.tagName==='rect')attrs(node,{x:g.x,y:g.y,width:g.width,height:g.height});
                else {const parent=document.createElementNS(NS,'g');text(parent,entry.title,g.x+16,g.y+25,g.width-32,14,true,'group-title');const next=parent.firstChild;next.setAttribute('data-layout-group',name);node.replaceWith(next);entry.nodes[i]=next;}}
        }
        for(let i=0;i<geometry.edges.length;i++){const edge=geometry.edges[i];if(previous?.edges[i]===edge)continue;const entry=edges.get(edge.id);
            edge.sections.forEach((section,j)=>{const d=pathData(section);for(const path of entry.paths.slice(j*2,j*2+2))attrs(path,{d});
                const points=[section.startPoint,...(section.bendPoints||[]),section.endPoint];attrs(entry.markers[j*2],{transform:markerTransform(points[0],points[1])});attrs(entry.markers[j*2+1],{transform:markerTransform(points.at(-1),points.at(-2))});});
            edge.labels?.forEach((label,j)=>{const [bg,t]=entry.labels.slice(j*2,j*2+2);if(!bg||!t||label.x===undefined)return;attrs(bg,{x:label.x,y:label.y,width:label.width,height:label.height});attrs(t,{x:label.x+8,y:label.y+18});for(const span of t.children)attrs(span,{x:label.x+8});});
        }
        if(mask)cardinalityAreas(geometry.edges).forEach((area,i)=>attrs(areas[i],area));
        previous=geometry;
    };
}
export async function drawModel(fullModel,theme='light',{view='all',keySection=false}={}){
    await document.fonts.ready;const model=selectView(fullModel,view),placement=model.placement;
    const directions=placement?.mode==='screen'?['LR','TB']:[placement?.mode==='horizontal'?'LR':placement?.mode==='vertical'?'TB':model.direction];
    const candidates=[],connections=fieldConnections(model);let lastError;
    for(const dir of directions){const {result,portOwners,metrics}=await layoutModel(model,{keySection},dir),positions=new Map(),groupPositions=new Map();
        function visit(parent,x=0,y=0){for(const n of parent.children||[]){const px=x+n.x,py=y+n.y;if(n.children){groupPositions.set(n.id,{...n,x:px,y:py});visit(n,px,py);}else positions.set(n.id,{...n,x:px,y:py,fieldOffsets:fieldOffsets(metrics.get(n.id)),fieldPorts:fieldPortOffsets(metrics.get(n.id),connections.get(n.id))});}}visit(result);
        const edges=cardinalityEdges(absoluteEdges(result.edges||[],groupPositions),new Map([...positions,...groupPositions]),portOwners);
        const base={entities:Object.fromEntries(positions),groups:Object.fromEntries(groupPositions),edges};
        try{const geometry=placeGeometry(model,base);geometry.direction=dir;candidates.push(geometry);}catch(error){lastError=error;}
        if(placement?.mode==='screen'){
            const count=model.groups.filter(g=>!g.parent).length+model.entities.filter(e=>!e.parent).length;
            for(let columns=1;columns<=Math.min(8,count);columns++)try{const packed=packedGeometry(model,base,columns),geometry=Object.keys(placement.nodes||{}).length||Object.keys(placement.edges||{}).length?placeGeometry(model,packed):packed;geometry.direction=dir;geometry.packedColumns=columns;candidates.push(geometry);}catch(error){lastError=error;/* Try other candidates when a label or a protected endpoint has no space. */}
        }
    }
    const geometry=chooseGeometry(candidates,placement?.aspect||1.5,geometryBounds);
    if(!geometry)throw lastError||new Error('읽을 수 있는 자동 배치를 찾지 못했습니다. 간격을 늘려 주세요.');
    const {svg:serialized,width,height}=geometrySVG(fullModel,geometry,theme,{view,keySection}),png=await svgToPng(serialized,width,height);
    return {svg:serialized,png,base64:await blobBase64(png),width,height,theme,model:{...fullModel,geometry},view,keySection,semantic:semanticSignature(fullModel)};
}
export function renderSnapshot(source,theme='light',options={}){
    const task=queue.then(async()=>{
        if(!source.trim())throw new Error('빈 스키마는 저장할 수 없습니다.');
        mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,theme:'base',fontFamily:FONT});
        // The public getDiagramFromText API removes frontmatter but does not
        // apply its config/title. parse applies Mermaid's own config handling.
        await mermaid.parse(source);
        const front=source.replace(/\r\n?/g,'\n').match(/^\s*---\n([\s\S]*?)\n\s*---(?:\n|$)/);
        const metadata=front?load(front[1],{schema:JSON_SCHEMA}):{};
        const diagram=await mermaid.mermaidAPI.getDiagramFromText(source,{title:metadata?.title===undefined?'':String(metadata.title)});
        if(diagram.type!=='er')throw new Error('Mermaid erDiagram만 지원합니다.');
        const model=extractModel(diagram.db,source);
        const snapshot=await drawModel(model,theme,options);return {...snapshot,content:source};
    });queue=task.catch(()=>{});return task;
}
export async function rethemeSnapshot(snapshot,theme){const svg=new DOMParser().parseFromString(snapshot.svg,'image/svg+xml').documentElement;applyTheme(svg,theme);const value=new XMLSerializer().serializeToString(svg);const png=await svgToPng(value,snapshot.width,snapshot.height);return {...snapshot,svg:value,png,base64:await blobBase64(png),theme};}
export async function svgToPng(value,width,height){const url=URL.createObjectURL(new Blob([value],{type:'image/svg+xml'}));try{const img=new Image();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('이미지 변환 시간 초과')),15000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(new Error('SVG 이미지 변환 실패'));};img.src=url;});const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 변환 실패')),'image/png'));if(png.size>8*1024*1024)throw new Error('이미지가 8 MiB를 초과했습니다.');return png;}finally{URL.revokeObjectURL(url);}}
export async function blobBase64(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let value='';for(let i=0;i<bytes.length;i+=32768)value+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(value);}
export function download(snapshot,format,stem){const url=URL.createObjectURL(format==='png'?snapshot.png:new Blob([snapshot.svg],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download=`${stem}${snapshot.view==='all'?'':'-detail'}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
