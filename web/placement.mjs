// Viewer-only data in an ordinary Mermaid comment. Never part of ER semantics.
const TAG=/^\s*%%\s*@db-camp-layout\s+(.+)$/;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const number=v=>Number.isFinite(v)&&v>=0&&v<=100000;
const keys=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k));
const point=v=>keys(v,['x','y'])&&number(v.x)&&number(v.y);
const anchor=v=>keys(v,['side','ratio'])&&['N','E','S','W'].includes(v.side)&&Number.isFinite(v.ratio)&&v.ratio>=.05&&v.ratio<=.95;
export function readPlacement(source) {
    const lines=source.split(/\r?\n/).map(l=>l.match(TAG)).filter(Boolean);
    if(!lines.length)return null;
    if(lines.length!==1)throw new Error('배치 메타데이터는 한 줄만 지정하세요.');
    let value;try{value=JSON.parse(lines[0][1]);}catch{throw new Error('배치 메타데이터 JSON 오류');}
    if(!keys(value,['version','mode','aspect','nodes','edges'])||value.version!==1||!['horizontal','vertical','screen'].includes(value.mode))throw new Error('배치 메타데이터 버전·모드 오류');
    if(value.aspect!==undefined&&(!Number.isFinite(value.aspect)||value.aspect<.1||value.aspect>10))throw new Error('화면 비율은 0.1~10이어야 합니다.');
    for(const [key,limit]of [['nodes',1000],['edges',2000]])if(value[key]!==undefined&&(!object(value[key])||Object.keys(value[key]).length>limit))throw new Error('배치 항목이 너무 많거나 잘못되었습니다.');
    for(const p of Object.values(value.nodes||{}))if(!point(p))throw new Error('테이블 배치 좌표 오류');
    for(const e of Object.values(value.edges||{}))if(!keys(e,['via','from','to'])||(!e.via&&!e.from&&!e.to)||(e.via&&!point(e.via))||(e.from&&!anchor(e.from))||(e.to&&!anchor(e.to)))throw new Error('관계선 배치 좌표 오류');
    return value;
}
export function writePlacement(source,value) {
    // Validate using precisely the same parser as rendering/direct editing.
    const line=`%% @db-camp-layout ${JSON.stringify(value)}`;readPlacement(line);
    const newline=source.includes('\r\n')?'\r\n':'\n',lines=source.split(/\r?\n/);
    const at=lines.findIndex(l=>TAG.test(l));
    if(at>=0){lines[at]=line;for(let i=lines.length-1;i>at;i--)if(TAG.test(lines[i]))lines.splice(i,1);}
    else {const opening=lines.findIndex(l=>l.trim());let insert=0;if(lines[opening]?.trim()==='---'){const end=lines.findIndex((l,i)=>i>opening&&l.trim()==='---');if(end>=0)insert=end+1;}lines.splice(insert,0,line);}
    return lines.join(newline);
}
export function removePlacement(source){const newline=source.includes('\r\n')?'\r\n':'\n';return source.split(/\r?\n/).filter(l=>!TAG.test(l)).join(newline);}
export function relationshipKey(relation,relationships) {
    const tuple=r=>[r.a,r.b,r.label,r.cardA,r.cardB,r.identifying];
    const signature=JSON.stringify(tuple(relation));
    const same=relationships.filter(r=>JSON.stringify(tuple(r))===signature);
    return JSON.stringify([...tuple(relation),same.findIndex(r=>r.id===relation.id)]);
}
// Compute duplicate ordinals once instead of scanning all relations per edge.
export function relationshipKeys(relationships){
    const counts=new Map(),keys=new Map();for(const r of relationships){const tuple=[r.a,r.b,r.label,r.cardA,r.cardB,r.identifying],signature=JSON.stringify(tuple),ordinal=counts.get(signature)||0;counts.set(signature,ordinal+1);keys.set(r.id,JSON.stringify([...tuple,ordinal]));}return keys;
}
export function defaultPlacement(model) {return {version:1,mode:['TB','BT'].includes(model.direction)?'vertical':'horizontal',nodes:{},edges:{}};}
export function anchorPoint(node,anchor) {
    const {side,ratio}=anchor;
    const length=['N','S'].includes(side)?node.width:node.height,padding=Math.min(14,length/2),offset=Math.max(padding,Math.min(length-padding,ratio*length));
    return side==='E'?{x:node.x+node.width,y:node.y+offset}:side==='W'?{x:node.x,y:node.y+offset}:side==='S'?{x:node.x+offset,y:node.y+node.height}:{x:node.x+offset,y:node.y};
}
export function nearestAnchor(node,p) {
    const sides=[['W',Math.abs(p.x-node.x)],['E',Math.abs(p.x-node.x-node.width)],['N',Math.abs(p.y-node.y)],['S',Math.abs(p.y-node.y-node.height)]];
    const side=sides.sort((a,b)=>a[1]-b[1])[0][0];
    const length=['N','S'].includes(side)?node.width:node.height,padding=Math.min(14,length/2),position=['N','S'].includes(side)?p.x-node.x:p.y-node.y;
    return {side,ratio:Math.max(.05,Math.min(.95,Math.max(padding,Math.min(length-padding,position))/length))};
}
