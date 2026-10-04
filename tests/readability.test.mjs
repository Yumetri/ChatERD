import test from 'node:test';
import assert from 'node:assert/strict';
import {placeGeometry,routeRelationship} from '../web/routing.mjs';
import {chooseGeometry,segmentsOf,segmentContact} from '../web/readability.mjs';
import {relationshipKeys} from '../web/placement.mjs';
import {fieldConnections,fieldPortOffsets} from '../web/field-anchors.mjs';
import {cardinalityAreas} from '../web/layout.mjs';

const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function airportFixture(){
    const fields=['departure_airport_id','arrival_airport_id'];
    const relationships=fields.map((field,i)=>({id:`r${i}`,a:'AIRPORT',b:'FLIGHT',label:i?'도착':'출발',cardA:'ONLY_ONE',cardB:'ZERO_OR_MORE',identifying:false}));
    const model={groups:[],entities:[{name:'AIRPORT'}, {name:'FLIGHT',metadata:{foreignKeys:fields.map((field,i)=>({columns:[field],references:{table:'AIRPORT',columns:['id']},label:relationships[i].label}))}}],relationships};
    const entities={AIRPORT:{x:64,y:64,width:200,height:200,fieldOffsets:{id:80}},FLIGHT:{x:600,y:64,width:250,height:300,fieldOffsets:{departure_airport_id:80,arrival_airport_id:117}}};
    const geometry={entities,groups:{},edges:relationships.map((r,i)=>({id:r.id,sources:[r.a],targets:[r.b],labels:[{text:r.label,width:64,height:26}],sections:[{startPoint:{x:264,y:144},endPoint:{x:600,y:144+i*37},bendPoints:[]}]}))};
    return {model,geometry};
}
test('two airport-role labels remain separate and keep their exact FK rows',()=>{
    const {model,geometry}=airportFixture(),before=structuredClone(geometry);
    const routed=placeGeometry(model,geometry),[a,b]=routed.edges.map(e=>e.labels[0]);
    assert(!overlaps(a,b),'departure and arrival labels overlap');
    assert.equal(routed.edges[0].sections[0].endPoint.y,144);
    assert.equal(routed.edges[1].sections[0].endPoint.y,181);
    for(let i=0;i<routed.edges.length;i++)for(let j=0;j<routed.edges.length;j++)if(i!==j){
        const label=routed.edges[i].labels[0],s=routed.edges[j].sections[0],points=[s.startPoint,...s.bendPoints,s.endPoint];
        for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k],hit=a.x===b.x?a.x>label.x&&a.x<label.x+label.width&&Math.max(a.y,b.y)>label.y&&Math.min(a.y,b.y)<label.y+label.height:a.y>label.y&&a.y<label.y+label.height&&Math.max(a.x,b.x)>label.x&&Math.min(a.x,b.x)<label.x+label.width;assert(!hit,'a label hides the other relationship');}
    }
    assert.deepEqual(geometry,before,'layout must not mutate source geometry');
});
test('parallel airport roles do not share their long horizontal corridor',()=>{
    const {model,geometry}=airportFixture(),routed=placeGeometry(model,geometry);
    const horizontal=edge=>{const s=edge.sections[0],points=[...s.bendPoints];return points.slice(1).map((p,i)=>[points[i],p]).filter(([a,b])=>a.y===b.y);};
    for(const [a,b]of horizontal(routed.edges[0]))for(const [c,d]of horizontal(routed.edges[1]))if(a.y===c.y)assert(Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))<=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)),'parallel roles share a horizontal corridor');
});
test('two cardinalities on the same PK row get distinct slots inside that row',()=>{
    const {model,geometry}=airportFixture(),metrics={attrs:[{name:'id'}],titleHeight:40,headerHeight:38,rowHeights:[70]};
    geometry.entities.AIRPORT.fieldOffsets.id=113;
    geometry.entities.AIRPORT.fieldPorts=fieldPortOffsets(metrics,fieldConnections(model).get('AIRPORT'));
    const keys=relationshipKeys(model.relationships),placement={edges:Object.fromEntries(model.relationships.map(r=>[keys.get(r.id),{from:{side:'E',ratio:.5},to:{side:'W',ratio:.5}}]))};
    const routed=placeGeometry(model,geometry,placement),[a,b]=routed.edges.map(e=>e.sections[0].startPoint);
    assert.equal(Math.abs(a.y-b.y),26);
    for(const p of [a,b])assert(p.y>64+78&&p.y<64+148,'the connection left its bound PK row');
    const first=cardinalityAreas([routed.edges[0]])[0],second=cardinalityAreas([routed.edges[1]])[0];
    assert(!overlaps(first,second),'cardinality symbols on the PK row overlap');
    assert.deepEqual(routed.edges.map(e=>e.sections[0].endPoint.y),[144,181],'distinct FK row centers should remain unchanged');
});
test('relations from the same PK to different tables separate their long shared lane',()=>{
    const {model,geometry}=airportFixture();
    model.relationships[1]={...model.relationships[1],b:'OTHER'};
    model.entities.push({name:'OTHER',metadata:{foreignKeys:[{columns:['airport_id'],references:{table:'AIRPORT',columns:['id']},label:'도착'}]}});
    geometry.entities.FLIGHT.y=500;
    geometry.entities.OTHER={...geometry.entities.FLIGHT,y:850,fieldOffsets:{airport_id:80}};
    geometry.edges[1].targets=['OTHER'];
    const keys=relationshipKeys(model.relationships),placement={edges:Object.fromEntries(model.relationships.map(r=>[keys.get(r.id),{from:{side:'E',ratio:.5},to:{side:'W',ratio:.5}}]))};
    const routed=placeGeometry(model,geometry,placement);
    let shared=0;
    for(const [a,b]of segmentsOf(routed.edges[0],true))for(const [c,d]of segmentsOf(routed.edges[1],true))shared+=segmentContact(a,b,c,d).shared;
    assert(shared<32,'relations to different tables merge into one long lane');
});
test('a manually selected FK side and waypoint remain fixed even when a shorter side exists',()=>{
    const {model,geometry}=airportFixture(),edge=geometry.edges[0],placement={from:{side:'W',ratio:.5},to:{side:'E',ratio:.5},via:{x:32,y:32}};
    const routed=routeRelationship(edge,model.relationships[0],geometry.entities,geometry.entities,placement,undefined,{from:['id'],to:['departure_airport_id']});
    const s=routed.sections[0];assert.equal(s.startPoint.x,64);assert.equal(s.endPoint.x,850);assert(s.bendPoints.some(p=>p.x===32&&p.y===32));
});
test('layout selection prefers clear labels over a more compact fit and uses fit for equal quality',()=>{
    const edge=(id,x)=>({id,labels:[{x,y:10,width:64,height:26}],sections:[{startPoint:{x:0,y:50},endPoint:{x:100,y:50},bendPoints:[]}]});
    const compact={entities:{},groups:{},edges:[edge('a',20),edge('b',20)],box:{width:200,height:100}};
    const clear={...compact,edges:[edge('a',20),edge('b',120)],box:{width:400,height:100}};
    assert.equal(chooseGeometry([compact,clear],2,g=>g.box),clear);
    const larger={...clear,box:{width:800,height:100}};
    assert.equal(chooseGeometry([larger,clear],2,g=>g.box),clear);
});
test('automatic attachment compares feasible sides instead of accepting an outward detour first',()=>{
    const {model,geometry}=airportFixture(),edge=structuredClone(geometry.edges[0]);
    edge.sections[0].startPoint.x=64;edge.sections[0].endPoint.x=850;
    const routed=routeRelationship(edge,model.relationships[0],geometry.entities,geometry.entities,{},undefined,{from:['id'],to:['departure_airport_id']});
    const section=routed.sections[0];
    assert.equal(section.startPoint.x,264,'the facing side should beat the outward source side');
    assert.equal(section.endPoint.x,600,'the facing side should beat the outward target side');
});
