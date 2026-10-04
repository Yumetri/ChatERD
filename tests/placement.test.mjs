import test from 'node:test';
import assert from 'node:assert/strict';
import ELK from 'elkjs/lib/elk.bundled.js';
import {readPlacement,writePlacement,removePlacement,relationshipKey,anchorPoint} from '../web/placement.mjs';
import {cardinalityGraph,cardinalityEdges,cardinalityAreas,GROUP_PADDING} from '../web/layout.mjs';
import {placeGeometry,orthogonalPath,packedGeometry} from '../web/routing.mjs';
const settings={version:1,mode:'screen',aspect:1.4,nodes:{A:{x:64,y:300},B:{x:500,y:64}},edges:{}};
test('placement comments round trip without touching YAML, ER source or unrelated metadata',()=>{
    const source='---\r\ntitle: 한글\r\n---\r\n%% @db-camp {"table":"A"}\r\nerDiagram\r\n A\r\n';
    const value=writePlacement(source,settings);assert(value.indexOf('@db-camp-layout')>value.indexOf('title: 한글'));assert.deepEqual(readPlacement(value),settings);assert.equal(removePlacement(value),source);
    const updated=writePlacement(value,{...settings,mode:'vertical'});assert.equal(updated.match(/@db-camp-layout/g).length,1);assert.equal(readPlacement(updated).mode,'vertical');
    assert.throws(()=>readPlacement(value+'\r\n%% @db-camp-layout '+JSON.stringify(settings)),/한 줄/);
});
test('layout metadata refuses unsupported versions, invalid coordinates and arbitrary fields',()=>{
    for(const invalid of [{...settings,version:2},{...settings,mode:'free'},{...settings,aspect:0},{...settings,nodes:{A:{x:-1,y:2}}},{...settings,nodes:{A:{x:null,y:2}}},{...settings,nodes:{A:{x:1,y:2,width:300}}},{...settings,edges:{x:{via:{x:NaN,y:0}}}},{...settings,edges:{x:{from:{side:'X',ratio:.5}}}},{...settings,edges:{x:{to:{side:'N',ratio:1}}}}])assert.throws(()=>readPlacement('%% @db-camp-layout '+JSON.stringify(invalid)),/배치|비율/);
    assert.throws(()=>readPlacement('%% @db-camp-layout {broken'),/JSON/);
});
test('relationship identity survives unrelated relationship reorder and changes when meaning changes',()=>{
    const r={id:'relation-1',a:'A',b:'B',label:'포함',cardA:'ONLY_ONE',cardB:'ZERO_OR_MORE',identifying:true};
    assert.equal(relationshipKey(r,[{...r,id:'relation-0',label:'other'},r]),relationshipKey({...r,id:'relation-0'},[{...r,id:'relation-0'}]));
    assert.notEqual(relationshipKey(r,[r]),relationshipKey({...r,cardB:'ONE_OR_MORE'},[{...r,cardB:'ONE_OR_MORE'}]));
});
test('attachment positions protect the crow-foot from rounded table corners',()=>{const node={x:64,y:64,width:160,height:40};assert.deepEqual(anchorPoint(node,{side:'E',ratio:.05}),{x:224,y:78});assert.deepEqual(anchorPoint(node,{side:'W',ratio:.95}),{x:64,y:90});});
test('cardinality exclusion rectangles include all orientations and the full symbol plus border gap',()=>{
    for(const [dx,dy]of [[32,0],[-32,0],[0,32],[0,-32]]){
        const p={x:100,y:100},q={x:100+dx,y:100+dy},areas=cardinalityAreas([{sections:[{startPoint:p,bendPoints:[q,{x:300,y:300}],endPoint:{x:300,y:332}}]}]);
        const a=areas[0];assert.equal(areas.length,2);
        assert(a.x<=Math.min(p.x,q.x)-4&&a.y<=Math.min(p.y,q.y)-4);
        assert(a.x+a.width>=Math.max(p.x,q.x)+4&&a.y+a.height>=Math.max(p.y,q.y)+4);
        assert.equal(dx?a.height:a.width,26);
    }
    // The old 24px group inset cuts through a 27px optionality circle. The
    // new inset keeps even the 32px reserved corridor and 4px gap inside.
    assert(24<27);assert(GROUP_PADDING.right>32+4);assert(GROUP_PADDING.top>=GROUP_PADDING.left+20);
});
test('moving grouped tables recalculates nested boxes with cardinality and title padding',()=>{
    const model={groups:[{id:'outer',parent:null},{id:'inner',parent:'outer'}],entities:[{name:'A',parent:'inner'}],relationships:[]};
    const geometry={entities:{A:{x:100,y:100,width:200,height:100}},groups:{inner:{x:76,y:56,width:248,height:168},outer:{x:52,y:12,width:296,height:236}},edges:[]};
    const moved=placeGeometry(model,geometry,{nodes:{A:{x:300,y:300}},edges:{}}),a=moved.entities.A,i=moved.groups.inner,o=moved.groups.outer;
    for(const [child,parent]of [[a,i],[i,o]]){assert.equal(child.x-parent.x,48);assert.equal(child.y-parent.y,68);assert.equal(parent.x+parent.width-child.x-child.width,48);assert.equal(parent.y+parent.height-child.y-child.height,48);}
});
test('orthogonal routing goes around a table and retains an explicit waypoint',()=>{
    const obstacles=[{x:100,y:20,width:100,height:100}],path=orthogonalPath({x:0,y:60},{x:300,y:60},obstacles);
    assert(path.length>2);for(let i=1;i<path.length;i++)assert(path[i].x===path[i-1].x||path[i].y===path[i-1].y);
    assert.throws(()=>orthogonalPath({x:150,y:50},{x:300,y:60},obstacles),/바깥/);
});
async function fixture(){const model={groups:[],entities:[{name:'A',parent:null},{name:'B',parent:null}],relationships:[{id:'e',a:'A',b:'B',label:'x',cardA:'ONLY_ONE',cardB:'ZERO_OR_MORE',identifying:true}]};
    const input={id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.edgeRouting':'ORTHOGONAL'},children:[{id:'A',width:200,height:100},{id:'B',width:200,height:100}],edges:[{id:'e',sources:['A'],targets:['B'],labels:[{text:'x',width:26,height:26}]}]};
    const {graph,portOwners}=cardinalityGraph(input),result=await new ELK().layout(graph),nodes=new Map(result.children.map(n=>[n.id,n]));
    return {model,geometry:{entities:Object.fromEntries(nodes),groups:{},edges:cardinalityEdges(result.edges,nodes,portOwners)}};
}
test('manual table, edge and attachment positions restore with protected cardinalities; overlap is rejected',async()=>{
    const {model,geometry}=await fixture(),key=relationshipKey(model.relationships[0],model.relationships);
    const placement={...settings,edges:{[key]:{from:{side:'E',ratio:.5},to:{side:'W',ratio:.5},via:{x:350,y:240}}}};
    const moved=placeGeometry(model,geometry,placement),section=moved.edges[0].sections[0];
    assert.deepEqual({x:moved.entities.A.x,y:moved.entities.A.y},settings.nodes.A);assert.deepEqual(section.startPoint,anchorPoint(moved.entities.A,placement.edges[key].from));
    assert(section.bendPoints.some(p=>p.x===350&&p.y===240));
    const points=[section.startPoint,...section.bendPoints,section.endPoint];for(let i=1;i<points.length;i++)assert(points[i].x===points[i-1].x||points[i].y===points[i-1].y);
    assert.equal(Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),32);assert.equal(Math.hypot(points.at(-1).x-points.at(-2).x,points.at(-1).y-points.at(-2).y),32);
    assert.throws(()=>placeGeometry(model,geometry,{nodes:{A:{x:64,y:64},B:{x:70,y:70}}}),/겹칩니다/);
    const again=placeGeometry(model,geometry,JSON.parse(JSON.stringify(placement)));assert.deepEqual(again,moved);
    assert.deepEqual(placeGeometry(model,geometry,{nodes:{REMOVED:{x:100,y:100}},edges:{removed:{via:{x:20,y:20}}}}),geometry);
    const packed=packedGeometry(model,geometry,1);assert(packed.entities.B.y>packed.entities.A.y+packed.entities.A.height);assert.equal(packed.edges.length,1);
});
