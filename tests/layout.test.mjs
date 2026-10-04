import test from 'node:test';import assert from 'node:assert/strict';
import ELK from 'elkjs/lib/elk.bundled.js';import {absoluteEdges,cardinalityGraph,cardinalityEdges,CARDINALITY_CLEARANCE} from '../web/layout.mjs';
test('real ELK grouped edge endpoints and labels are converted to full-diagram coordinates',async()=>{
    const layout=await new ELK().layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.hierarchyHandling':'INCLUDE_CHILDREN','elk.direction':'RIGHT'},children:[{id:'group',children:[{id:'a',width:200,height:100},{id:'b',width:200,height:100}]}],edges:[{id:'e',sources:['a'],targets:['b'],labels:[{text:'test',width:30,height:20}]}]});
    const group=layout.children[0],edge=absoluteEdges(layout.edges,new Map([['group',group]]))[0];
    const a=group.children.find(n=>n.id==='a'),b=group.children.find(n=>n.id==='b');
    assert.equal(edge.sections[0].startPoint.x,group.x+a.x+a.width);assert.equal(edge.sections[0].endPoint.x,group.x+b.x);
    assert.equal(edge.labels[0].x,layout.edges[0].labels[0].x+group.x);assert.equal(edge.labels[0].y,layout.edges[0].labels[0].y+group.y);
});
test('short, bent, self and grouped routes reserve straight cardinality space in every direction',async()=>{
    const elk=new ELK();
    for(const direction of ['RIGHT','DOWN','LEFT','UP']) {
        const input={id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':direction,'elk.hierarchyHandling':'INCLUDE_CHILDREN','elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':'1','elk.layered.spacing.nodeNodeBetweenLayers':'1'},
            children:[{id:'group',children:[{id:'A',width:200,height:100},{id:'B',width:200,height:180}]}],
            edges:[{id:'ab',sources:['A'],targets:['B'],labels:[{text:'a',width:20,height:26}]},{id:'self',sources:['B'],targets:['B'],labels:[{text:'s',width:20,height:26}]}]};
        const routed=cardinalityGraph(input),layout=await elk.layout(routed.graph),nodes=new Map(),groups=new Map();
        function visit(parent,x=0,y=0){for(const n of parent.children||[]){const p={...n,x:x+n.x,y:y+n.y};nodes.set(n.id,p);if(n.children){groups.set(n.id,p);visit(n,p.x,p.y);}}}visit(layout);
        const edges=cardinalityEdges(absoluteEdges(layout.edges,groups),nodes,routed.portOwners);
        assert.deepEqual(edges.map(e=>[e.sources,e.targets]),input.edges.map(e=>[e.sources,e.targets]));
        for(const e of edges) for(const s of e.sections) for(const [p,q,id] of [[s.startPoint,s.bendPoints[0],e.sources[0]],[s.endPoint,s.bendPoints.at(-1),e.targets[0]]]) {
            const n=nodes.get(id);
            assert(Math.min(Math.abs(p.x-n.x),Math.abs(p.x-n.x-n.width),Math.abs(p.y-n.y),Math.abs(p.y-n.y-n.height))<.01);
            assert(p.x===q.x||p.y===q.y,`${direction}: diagonal cardinality stub`);
            assert(Math.hypot(q.x-p.x,q.y-p.y)>=CARDINALITY_CLEARANCE-.01,`${direction}: clipped cardinality`);
        }
        assert.equal(input.children[0].children[0].ports,undefined,'routing must not mutate the input model');
    }
    // Prove the regression oracle rejects the unreserved layout used before the fix.
    const old=await elk.layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.edgeRouting':'ORTHOGONAL','elk.layered.spacing.nodeNodeBetweenLayers':'1'},children:[{id:'A',width:100,height:100},{id:'B',width:100,height:100}],edges:[{id:'e',sources:['A'],targets:['B']}]});
    const s=old.edges[0].sections[0];assert(Math.hypot(s.endPoint.x-s.startPoint.x,s.endPoint.y-s.startPoint.y)<27);
});
