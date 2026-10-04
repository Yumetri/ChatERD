import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutFeedback} from '../runtime/layout-feedback.mjs';
import {relationshipKeys} from '../web/placement.mjs';

function fixture(heights){
    const relationships=heights.map((_,i)=>({id:`r${i}`,a:'A',b:'B',label:`관계 ${i}`,cardA:'ONLY_ONE',cardB:'ZERO_OR_MORE',identifying:false}));
    return {relationships,geometry:{entities:{A:{x:0,y:0,width:100,height:100},B:{x:300,y:0,width:100,height:100}},groups:{},edges:heights.map((y,i)=>({id:`r${i}`,sources:['A'],targets:['B'],sections:[{startPoint:{x:100,y},endPoint:{x:300,y},bendPoints:[{x:132,y},{x:268,y}]}]}))}};
}
test('preview diagnostics identify near parallel relations even when their lines do not overlap',()=>{
    const model=fixture([10,11.6,60]),before=structuredClone(model),report=layoutFeedback(model);
    assert.equal(report.available,true);assert.equal(report.close_parallel_count,1);
    const issue=report.close_parallel_segments[0];assert.equal(issue.gap_px,1.6);assert.equal(issue.parallel_run_px,136);
    assert.deepEqual(issue.relations.map(r=>r.label),['관계 0','관계 1']);
    assert.equal(issue.relations[1].placement_key,relationshipKeys(model.relationships).get('r1'));
    assert.deepEqual(report.related_entities,model.geometry.entities);assert.deepEqual(model,before);
});
test('24px is a review threshold; opposite directions and vertical runs are measured consistently',()=>{
    assert.equal(layoutFeedback(fixture([10,34])).close_parallel_count,0);
    const model=fixture([10,16.4]);
    const section=model.geometry.edges[1].sections[0];
    [section.startPoint,section.endPoint]=[section.endPoint,section.startPoint];section.bendPoints.reverse();
    let issue=layoutFeedback(model).close_parallel_segments[0];assert.equal(issue.gap_px,6.4);assert.equal(issue.parallel_run_px,136);
    for(const edge of model.geometry.edges)for(const s of edge.sections){for(const p of [s.startPoint,...s.bendPoints,s.endPoint])[p.x,p.y]=[p.y,p.x];}
    issue=layoutFeedback(model).close_parallel_segments[0];assert.equal(issue.orientation,'vertical');assert.equal(issue.gap_px,6.4);
    assert.equal(layoutFeedback(model,{targetGap:6}).close_parallel_count,0);
});
test('cardinality stubs and short coincident stretches do not masquerade as long crowded lanes',()=>{
    const model=fixture([10,10]);
    model.geometry.edges[0].sections[0]={startPoint:{x:0,y:100},endPoint:{x:300,y:60},bendPoints:[{x:80,y:100},{x:80,y:60},{x:268,y:60}]};
    model.geometry.edges[1].sections[0]={startPoint:{x:0,y:100},endPoint:{x:300,y:140},bendPoints:[{x:80,y:100},{x:80,y:140},{x:268,y:140}]};
    assert.equal(layoutFeedback(model,{minRun:10}).close_parallel_count,0,'common first marker corridor should be ignored');
    const short=fixture([10,10]);for(const e of short.geometry.edges)e.sections[0].bendPoints[1].x=150;
    assert.equal(layoutFeedback(short).close_parallel_count,0);
});
test('missing geometry is unavailable and large reports explicitly disclose truncation',()=>{
    assert.equal(layoutFeedback(null).available,false);
    const noEdges=fixture([]);assert.equal(layoutFeedback(noEdges).closest_parallel_gap_px,null);
    const report=layoutFeedback(fixture([0,1,2,3]),{limit:2});
    assert.equal(report.close_parallel_count,6);assert.equal(report.reported_count,2);assert.equal(report.truncated,true);
});
