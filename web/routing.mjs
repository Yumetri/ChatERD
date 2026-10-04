import {CARDINALITY_CLEARANCE,GROUP_PADDING,cardinalityAreas} from './layout.mjs';
import {anchorPoint,nearestAnchor,relationshipKeys} from './placement.mjs';
import {foreignKeyBindings,fieldOffset} from './field-anchors.mjs';
import {rectanglesOverlap,lineHitsRectangle,segmentsOf,segmentContact,routeCost} from './readability.mjs';
const delta={N:{x:0,y:-1},E:{x:1,y:0},S:{x:0,y:1},W:{x:-1,y:0}};
const inside=(p,r)=>p.x>r.x+.001&&p.x<r.x+r.width-.001&&p.y>r.y+.001&&p.y<r.y+r.height-.001;
const expand=(r,d)=>({x:r.x-d,y:r.y-d,width:r.width+2*d,height:r.height+2*d});
function blocked(a,b,rects){return rects.some(r=>a.x===b.x?a.x>r.x+.001&&a.x<r.x+r.width-.001&&Math.max(a.y,b.y)>r.y+.001&&Math.min(a.y,b.y)<r.y+r.height-.001:a.y>r.y+.001&&a.y<r.y+r.height-.001&&Math.max(a.x,b.x)>r.x+.001&&Math.min(a.x,b.x)<r.x+r.width-.001);}
function bound(values,value,upper=false){let lo=0,hi=values.length;while(lo<hi){const mid=(lo+hi)>>1;if(values[mid]<value||upper&&values[mid]===value)lo=mid+1;else hi=mid;}return lo;}
function blockedLinks(xs,ys,rects,horizontal,vertical){
    const w=xs.length,h=ys.length,hd=new Int32Array(w*h),vd=new Int32Array(w*h);
    // Rectangle ranges become difference-array updates, followed by two
    // sweeps. O(rectangles * (rows + columns) + grid), not a rectangle scan
    // for every A* neighbor. Boundary/epsilon rules match blocked() exactly.
    for(const r of rects){
        const left=r.x+.001,right=r.x+r.width-.001,top=r.y+.001,bottom=r.y+r.height-.001;
        const x0=bound(xs,left,true)-1,x1=bound(xs,right),y0=bound(ys,top,true)-1,y1=bound(ys,bottom);
        if(x0<x1)for(let y=bound(ys,top,true);y<bound(ys,bottom);y++){hd[y*w+x0]++;hd[y*w+x1]--;}
        if(y0<y1)for(let x=bound(xs,left,true);x<bound(xs,right);x++){vd[x*h+y0]++;vd[x*h+y1]--;}
    }
    for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x++){count+=hd[y*w+x];horizontal[y*w+x]=count?2:1;}}
    for(let x=0;x<w;x++){let count=0;for(let y=0;y<h;y++){count+=vd[x*h+y];vertical[y*w+x]=count?2:1;}}
}
class Heap {
    items=[];
    push(v){const a=this.items;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].score<=v.score)break;a[i]=a[p];i=p;}a[i]=v;}
    pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}
// Rectilinear visibility grid with a bend penalty. All rectangles are obstacles;
// marker stubs are included, so routing never doubles back through a crow-foot.
export function orthogonalPath(start,end,rects,parallel=[]) {
    if(rects.some(r=>inside(start,r)||inside(end,r)))throw new Error('조절점을 테이블과 기호 바깥으로 옮겨 주세요.');
    // A clear straight route is already the unique minimum-cost path. Avoid
    // building a visibility grid for the many untouched aligned edges.
    if(!parallel.length&&(start.x===end.x||start.y===end.y)&&!blocked(start,end,rects))return start.x===end.x&&start.y===end.y?[{...start}]:[{...start},{...end}];
    const xs=[...new Set([start.x,end.x,...rects.flatMap(r=>[r.x,r.x+r.width]),...parallel.flatMap(([a,b])=>a.x===b.x?[a.x-12,a.x+12]:[])])].sort((a,b)=>a-b);
    const ys=[...new Set([start.y,end.y,...rects.flatMap(r=>[r.y,r.y+r.height]),...parallel.flatMap(([a,b])=>a.y===b.y?[a.y-12,a.y+12]:[])])].sort((a,b)=>a-b);
    if(xs.length*ys.length>20000)throw new Error('수동 경로가 너무 큽니다. 주제별로 나눠 주세요.');
    const width=xs.length,index=(x,y)=>y*width+x,xy=id=>({x:xs[id%width],y:ys[Math.floor(id/width)]});
    const a=index(xs.indexOf(start.x),ys.indexOf(start.y)),b=index(xs.indexOf(end.x),ys.indexOf(end.y));
    const heap=new Heap(),distance=new Float64Array(xs.length*ys.length*3).fill(Infinity),previous=new Int32Array(distance.length).fill(-1);
    // Each grid link can be visited in three directional states. Test its
    // obstacles once, lazily, and reuse the result in both directions.
    const horizontal=new Uint8Array(xs.length*ys.length),vertical=new Uint8Array(horizontal.length);
    if(rects.length>=12)blockedLinks(xs,ys,rects,horizontal,vertical);
    heap.push({id:a*3,cost:0,score:0});distance[a*3]=0;let found;
    while(heap.items.length){const item=heap.pop();if(item.cost!==distance[item.id])continue;const node=Math.floor(item.id/3),dir=item.id%3;
        if(node===b){found=item.id;break;}const x=node%width,y=Math.floor(node/width),p=xy(node);
        for(const [nx,ny,nextDir]of [[x-1,y,1],[x+1,y,1],[x,y-1,2],[x,y+1,2]]){
            if(nx<0||ny<0||nx>=width||ny>=ys.length)continue;const next=index(nx,ny),q=xy(next);
            const cache=nextDir===1?horizontal:vertical,link=Math.min(node,next);
            if(!cache[link])cache[link]=blocked(p,q,rects)?2:1;if(cache[link]===2)continue;
            const sharing=parallel.reduce((sum,[a,b])=>sum+segmentContact(p,q,a,b).shared,0);
            const cost=item.cost+Math.abs(p.x-q.x)+Math.abs(p.y-q.y)+(dir&&dir!==nextDir?16:0)+sharing*.5,id=next*3+nextDir;
            if(cost>=distance[id])continue;distance[id]=cost;previous[id]=item.id;
            heap.push({id,cost,score:cost+Math.abs(q.x-end.x)+Math.abs(q.y-end.y)});
        }
    }
    if(found===undefined)throw new Error('연결선 공간이 부족합니다. 테이블 또는 조절점을 조금 떨어뜨려 주세요.');
    const path=[];for(let id=found;id!==-1;id=previous[id])path.push(xy(Math.floor(id/3)));path.reverse();
    return path.filter((p,i)=>!i||i===path.length-1||!(path[i-1].x===p.x&&p.x===path[i+1].x||path[i-1].y===p.y&&p.y===path[i+1].y));
}
function stub(p,side){const d=delta[side];return {x:p.x+d.x*CARDINALITY_CLEARANCE,y:p.y+d.y*CARDINALITY_CLEARANCE};}
function corridor(a,b){return a.x===b.x?{x:a.x-9,y:Math.min(a.y,b.y),width:18,height:Math.abs(a.y-b.y)}:{x:Math.min(a.x,b.x),y:a.y-9,width:Math.abs(a.x-b.x),height:18};}
function options(node,oldNode,p,explicit,fields,self,port){
    const offset=node.fieldPorts?.[port]??fieldOffset(node,fields);
    if(offset!==undefined){
        const nearest=nearestAnchor(oldNode,p),side=['E','W'].includes(explicit?.side)?explicit.side:['E','W'].includes(nearest.side)?nearest.side:self?'E':p.x<oldNode.x+oldNode.width/2?'W':'E';
        return (explicit&&['E','W'].includes(explicit.side)?[side]:[side,side==='E'?'W':'E']).map(side=>({side,ratio:offset/node.height}));
    }
    if(explicit)return [explicit];const first=nearestAnchor(oldNode,p);return [first,...Object.keys(delta).filter(s=>s!==first.side).map(side=>({side,ratio:.5}))];
}
function labelCandidates(edge){
    const label=edge.labels?.[0];if(!label)return [];
    const segments=segmentsOf(edge,true).map(([a,b])=>({a,b,length:Math.hypot(b.x-a.x,b.y-a.y)})).sort((a,b)=>b.length-a.length);
    const result=[];
    if(Number.isFinite(label.x)&&Number.isFinite(label.y))result.push({...label});
    for(const {a,b,length}of segments){
        // Try the middle first, then move along the entire segment rather than
        // giving up when its midpoint happens to be occupied by another label.
        const size=a.y===b.y?label.width:label.height;
        const fractions=[.5,.25,.75,...(length>size+8?[Math.min(.5,(size/2+4)/length),Math.max(.5,1-(size/2+4)/length)]:[])];
        for(const fraction of fractions){const mid={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction};
            const positions=a.y===b.y?[{x:mid.x-label.width/2,y:mid.y-label.height-5},{x:mid.x-label.width/2,y:mid.y+5}]:[{x:mid.x+5,y:mid.y-label.height/2},{x:mid.x-label.width-5,y:mid.y-label.height/2}];
            for(const p of positions)result.push({...label,...p});}
    }
    return result;
}
function assignLabels(edges,rects){
    const markerAreas=cardinalityAreas(edges),reserved=[],placed=new Map();
    const ordered=edges.filter(e=>e.labels?.length).map((edge,index)=>({edge,index})).sort((a,b)=>b.edge.labels[0].width*b.edge.labels[0].height-a.edge.labels[0].width*a.edge.labels[0].height||a.index-b.index);
    const lines=edges.map(edge=>({id:edge.id,segments:segmentsOf(edge)}));
    for(const {edge}of ordered){
        const position=labelCandidates(edge).find(p=>p.x>=8&&p.y>=8&&!rects.some(r=>rectanglesOverlap(p,r))&&!markerAreas.some(r=>rectanglesOverlap(p,r))&&!reserved.some(r=>rectanglesOverlap(p,r,4))&&!lines.some(e=>e.id!==edge.id&&e.segments.some(([a,b])=>lineHitsRectangle(a,b,p,2))));
        if(!position)throw new Error('관계 라벨을 놓을 공간이 부족합니다. 테이블 또는 조절점을 더 떨어뜨려 주세요.');
        reserved.push(position);placed.set(edge.id,position);
    }
    return edges.map(edge=>{const label=placed.get(edge.id),old=edge.labels?.[0];return !label||label.x===old.x&&label.y===old.y?edge:{...edge,labels:[label]};});
}
export function routeRelationship(edge,relation,nodes,oldNodes,placement={},rects=Object.values(nodes).filter(n=>!n.children).map(n=>expand(n,8)),binding,context={}) {
    const a=nodes[relation.a],b=nodes[relation.b],old=edge.sections[0];
    const source=options(a,oldNodes[relation.a]||a,old.startPoint,placement.from,binding?.from,relation.a===relation.b,`${relation.id}:from`),target=options(b,oldNodes[relation.b]||b,old.endPoint,placement.to,binding?.to,relation.a===relation.b,`${relation.id}:to`);
    let lastError,best,bestCost=Infinity;
    const candidates=source.flatMap(from=>target.map(to=>{const start=anchorPoint(a,from),end=anchorPoint(b,to),s=stub(start,from.side),t=stub(end,to.side);const via=placement.via;
        const lowerBound=2*CARDINALITY_CLEARANCE+(via?Math.abs(s.x-via.x)+Math.abs(s.y-via.y)+Math.abs(t.x-via.x)+Math.abs(t.y-via.y):Math.abs(s.x-t.x)+Math.abs(s.y-t.y));return {start,end,s,t,lowerBound};})).sort((a,b)=>a.lowerBound-b.lowerBound);
    for(const {start,end,s,t,lowerBound}of candidates){if(lowerBound>=bestCost)continue;try{
        const obstacles=[...rects,corridor(start,s),corridor(end,t)];
        if(blocked(start,s,rects.filter(r=>!inside(start,r)))||blocked(end,t,rects.filter(r=>!inside(end,r))))continue;
        const middle=placement.via?[...orthogonalPath(s,placement.via,obstacles,context.parallel).slice(0,-1),...orthogonalPath(placement.via,t,obstacles,context.parallel)]:orthogonalPath(s,t,obstacles,context.parallel);
        const points=[start,...middle,end];
        const routed={...edge,labels:(edge.labels||[]).map(({x,y,...label})=>label),sections:[{...old,startPoint:start,endPoint:end,bendPoints:points.slice(1,-1)}]};
        const labelled=assignLabels([routed],rects),cost=routeCost(points,context.others);
        if(cost<bestCost){best=labelled[0];bestCost=cost;}
    }catch(e){lastError=e;}}
    if(best)return best;
    throw lastError||new Error('테이블 사이에 기호를 그릴 공간이 부족합니다.');
}
// Pack existing top-level subject boxes into rows; no fake entities/relations.
// Members retain their arrangement within a subject, then cross-box paths route
// around the real tables. Only used as candidates for the explicit screen mode.
export function packedGeometry(model,geometry,columns) {
    const blocks=[...model.groups.filter(g=>!g.parent).map(g=>({id:g.id,...geometry.groups[g.id],group:true})),...model.entities.filter(e=>!e.parent).map(e=>({id:e.name,...geometry.entities[e.name]}))];
    const ancestors=new Map(model.groups.map(g=>[g.id,g.parent]));
    const belongs=(entity,id)=>{let parent=entity.parent;while(parent){if(parent===id)return true;parent=ancestors.get(parent);}return false;};
    const nodes={};let x=64,y=64,rowHeight=0;
    blocks.forEach((block,i)=>{if(i&&i%columns===0){x=64;y+=rowHeight+96;rowHeight=0;}
        for(const e of model.entities)if(block.group?belongs(e,block.id):e.name===block.id){const n=geometry.entities[e.name];nodes[e.name]={x:n.x+x-block.x,y:n.y+y-block.y};}
        x+=block.width+96;rowHeight=Math.max(rowHeight,block.height);
    });
    return placeGeometry(model,geometry,{nodes,edges:{}});
}
export function placeGeometry(model,geometry,placement=model.placement,cache) {
    // Only node bounds change. ELK children/ports and the base geometry remain
    // immutable; deep-cloning them every frame is unnecessary.
    const entities=Object.fromEntries(Object.entries(geometry.entities).map(([id,n])=>[id,{...n}])),groups=Object.fromEntries(Object.entries(geometry.groups).map(([id,n])=>[id,{...n}])),oldNodes={...geometry.entities,...geometry.groups};
    for(const [name,p]of Object.entries(placement?.nodes||{}))if(Object.hasOwn(entities,name))Object.assign(entities[name],p);
    const moved=Object.keys(entities).some(k=>entities[k].x!==geometry.entities[k].x||entities[k].y!==geometry.entities[k].y);
    if(moved){const values=Object.values(entities);for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){const a=values[i],b=values[j];if(a.x<b.x+b.width+16&&a.x+a.width+16>b.x&&a.y<b.y+b.height+16&&a.y+a.height+16>b.y)throw new Error('테이블끼리 겹칩니다. 16px 이상 떨어뜨려 주세요.');}
        const update=(id,seen=new Set())=>{if(seen.has(id))throw new Error('그룹 순환 오류');seen.add(id);const modelGroup=model.groups.find(g=>g.id===id);
            const children=[...model.entities.filter(e=>e.parent===id).map(e=>entities[e.name]),...model.groups.filter(g=>g.parent===id).map(g=>update(g.id,new Set(seen)))];
            if(children.length){const x=Math.max(0,Math.min(...children.map(n=>n.x))-GROUP_PADDING.left),y=Math.max(0,Math.min(...children.map(n=>n.y))-GROUP_PADDING.top);
                Object.assign(groups[id],{x,y,width:Math.max(...children.map(n=>n.x+n.width))-x+GROUP_PADDING.right,height:Math.max(...children.map(n=>n.y+n.height))-y+GROUP_PADDING.bottom});}
            return groups[id];};
        for(const g of model.groups.filter(g=>!g.parent))update(g.id);
    }
    const nodes={...entities,...groups},relations=new Map(model.relationships.map(r=>[r.id,r])),keys=relationshipKeys(model.relationships),bindings=foreignKeyBindings(model);
    const obstacles=Object.values(entities).map(n=>expand(n,8));
    // Drag-local cache is cleared whenever any obstacle or endpoint bounds
    // change, including unrelated tables and nested group attachments.
    if(cache){const signature=JSON.stringify(Object.entries(nodes).map(([id,n])=>[id,n.x,n.y,n.width,n.height,!!n.children]));if(cache.signature!==signature||cache.model!==model||cache.base!==geometry){cache.signature=signature;cache.model=model;cache.base=geometry;cache.routes=new Map();}}
    const routedEdges=[];
    const edges=geometry.edges.map((edge,index)=>{const r=relations.get(edge.id),setting=placement?.edges?.[keys.get(r.id)],binding=bindings.get(r.id);
        const changed=[r.a,r.b].some(k=>nodes[k].x!==oldNodes[k].x||nodes[k].y!==oldNodes[k].y||nodes[k].width!==oldNodes[k].width||nodes[k].height!==oldNodes[k].height);
        const anchored=fieldOffset(nodes[r.a],binding?.from)!==undefined||fieldOffset(nodes[r.b],binding?.to)!==undefined;
        if(!changed&&!setting&&!anchored){routedEdges.push(edge);return edge;}
        // Lanes also separate relations to different tables that happen to
        // leave the same PK row. Shared marker stubs remain intentional.
        const others=[...routedEdges,...geometry.edges.slice(index+1)],parallel=routedEdges.flatMap(e=>segmentsOf(e,true));
        const key=cache&&JSON.stringify([setting,others.map(e=>e.sections)]),entry=cache?.routes.get(edge.id);
        const routed=entry&&entry.key===key?entry.routed:routeRelationship(edge,r,nodes,oldNodes,setting,obstacles,binding,{others:others.flatMap(e=>segmentsOf(e,true)),parallel});
        if(cache)cache.routes.set(edge.id,{key,routed});routedEdges.push(routed);return routed;
    });
    return {entities,groups,edges:assignLabels(edges,obstacles)};
}
