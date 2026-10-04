import test from 'node:test';
import assert from 'node:assert/strict';
import {orthogonalPath,placeGeometry} from '../web/routing.mjs';
import {relationshipKey,relationshipKeys} from '../web/placement.mjs';
// Independent Dijkstra oracle: every allowed grid link is scanned against all
// rectangles. Verifies shortest length + bend cost without production caches.
function oracle(start,end,rects){
    const xs=[...new Set([start.x,end.x,...rects.flatMap(r=>[r.x,r.x+r.width])])].sort((a,b)=>a-b),ys=[...new Set([start.y,end.y,...rects.flatMap(r=>[r.y,r.y+r.height])])].sort((a,b)=>a-b),w=xs.length;
    const distances=new Map(),queue=[[ys.indexOf(start.y)*w+xs.indexOf(start.x),0,0]];distances.set(queue[0][0]*3,0);
    const b=ys.indexOf(end.y)*w+xs.indexOf(end.x);
    while(queue.length){queue.sort((a,b)=>b[2]-a[2]);const [node,dir,cost]=queue.pop();if(distances.get(node*3+dir)!==cost)continue;if(node===b)return cost;const x=node%w,y=Math.floor(node/w);
        for(const [nx,ny,d]of [[x-1,y,1],[x+1,y,1],[x,y-1,2],[x,y+1,2]]){if(nx<0||ny<0||nx>=w||ny>=ys.length)continue;
            const blocked=rects.some(r=>d===1?ys[y]>r.y+.001&&ys[y]<r.y+r.height-.001&&Math.max(xs[x],xs[nx])>r.x+.001&&Math.min(xs[x],xs[nx])<r.x+r.width-.001:xs[x]>r.x+.001&&xs[x]<r.x+r.width-.001&&Math.max(ys[y],ys[ny])>r.y+.001&&Math.min(ys[y],ys[ny])<r.y+r.height-.001);if(blocked)continue;
            const next=ny*w+nx,total=cost+Math.abs(xs[x]-xs[nx])+Math.abs(ys[y]-ys[ny])+(dir&&dir!==d?16:0),id=next*3+d;if(total>=(distances.get(id)??Infinity))continue;distances.set(id,total);queue.push([next,d,total]);
        }
    }return Infinity;
}
function cost(points){let length=0,previous;for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i],dir=p.x===q.x?2:1;assert(p.x===q.x||p.y===q.y);length+=Math.abs(p.x-q.x)+Math.abs(p.y-q.y)+(previous&&previous!==dir?16:0);previous=dir;}return length;}
test('cached A* matches independent shortest-path oracle with obstacles, ties, and both directions',()=>{
    let seed=7331;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<120;i++){const rects=Array.from({length:i%3===0?16:8},()=>({x:20+Math.floor(random()*220),y:20+Math.floor(random()*220),width:10+Math.floor(random()*50),height:10+Math.floor(random()*50)}));const a={x:0,y:Math.floor(random()*300)},b={x:320,y:Math.floor(random()*300)};
        for(const [start,end]of [[a,b],[b,a]])assert.equal(cost(orthogonalPath(start,end,rects)),oracle(start,end,rects));
    }
    assert.deepEqual(orthogonalPath({x:0,y:0},{x:0,y:0},[]),[{x:0,y:0}]);
});
function fixture(){const r={id:'e',a:'A',b:'B',label:'포함',cardA:'ONLY_ONE',cardB:'ZERO_OR_MORE',identifying:true};return {model:{entities:[{name:'A'},{name:'B'},{name:'C'}],groups:[],relationships:[r]},geometry:{entities:{A:{x:64,y:64,width:200,height:100},B:{x:700,y:64,width:200,height:100},C:{x:400,y:400,width:100,height:100}},groups:{},edges:[{id:'e',sources:['A'],targets:['B'],labels:[{text:'포함',x:440,y:80,width:48,height:26}],sections:[{startPoint:{x:264,y:114},endPoint:{x:700,y:114},bendPoints:[{x:296,y:114},{x:668,y:114}]}]}]}};}
test('drag cache agrees with uncached routing after waypoint, attachment, obstacle and base changes',()=>{
    const {model,geometry}=fixture(),key=relationshipKey(model.relationships[0],model.relationships),cache={},base=structuredClone(geometry);
    const run=p=>{const cached=placeGeometry(model,geometry,p,cache);assert.deepEqual(cached,placeGeometry(model,geometry,p));return cached;};
    const setting={from:{side:'E',ratio:.5},to:{side:'W',ratio:.5}},p={nodes:{},edges:{[key]:setting}};
    const first=run(p),again=run(p);assert.equal(first.edges[0],again.edges[0]);
    for(let i=0;i<15;i++)run({nodes:{},edges:{[key]:{...setting,via:{x:470,y:200+i}}}});
    // An unrelated obstacle now occupies the old route. Cache must invalidate.
    const moved=run({...p,nodes:{C:{x:400,y:64}}});assert.notDeepEqual(moved.edges,first.edges);
    run({...p,edges:{[key]:{...setting,from:{side:'S',ratio:.5}}}});
    assert.throws(()=>run({...p,nodes:{B:{x:70,y:70}}}),/겹칩니다/);
    assert.deepEqual(geometry,base,'base geometry cannot be mutated by preview');
    const replacement=structuredClone(geometry);replacement.edges[0].labels[0].width=70;assert.deepEqual(placeGeometry(model,replacement,p,cache),placeGeometry(model,replacement,p));
    assert(cache.routes.size<=model.relationships.length);
});
test('linear relationship keys keep duplicate ordinals and semantic identities',()=>{const {model}=fixture(),r=model.relationships[0],list=[r,{...r,id:'duplicate'},{...r,id:'other',label:'다름'}];const keys=relationshipKeys(list);for(const relation of list)assert.equal(keys.get(relation.id),relationshipKey(relation,list));});
