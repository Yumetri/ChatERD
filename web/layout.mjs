// ELK routes intra-group edges in the group's coordinate system. Normalize
// paths and labels together before drawing or validating their endpoints.
// The longest cardinality symbol extends 27px from the table boundary.
// External, invisible routing ports reserve this space in ELK's layout,
// including self-loops, short edges, labels, and compound graphs.
export const CARDINALITY_CLEARANCE = 32;
// Subject boxes reserve both the full symbol and breathing room. The extra
// top inset keeps the group's title above north-facing cardinalities.
export const GROUP_PADDING = {top:68,left:48,bottom:48,right:48};
// Protect even unrelated group borders in manually arranged diagrams. These
// areas are used only to interrupt group outlines, never the actual ER edges.
export function cardinalityAreas(edges,gap=4) {
    const areas=[];
    for(const edge of edges)for(const s of edge.sections||[]){
        const points=[s.startPoint,...(s.bendPoints||[]),s.endPoint];
        for(const [p,q]of [[points[0],points[1]],[points.at(-1),points.at(-2)]]){
            const length=Math.hypot(q.x-p.x,q.y-p.y)||1,ux=(q.x-p.x)/length,uy=(q.y-p.y)/length;
            const end={x:p.x+ux*CARDINALITY_CLEARANCE,y:p.y+uy*CARDINALITY_CLEARANCE};
            const dx=Math.abs(uy)*9+gap,dy=Math.abs(ux)*9+gap;
            areas.push({x:Math.min(p.x,end.x)-dx,y:Math.min(p.y,end.y)-dy,width:Math.abs(end.x-p.x)+2*dx,height:Math.abs(end.y-p.y)+2*dy});
        }
    }
    return areas;
}
export function cardinalityGraph(input) {
    const graph = structuredClone(input), nodes = new Map(), portOwners = new Map();
    function visit(node) { nodes.set(node.id,node); for(const child of node.children||[]) visit(child); }
    visit(graph);
    const used = new Set(nodes.keys()); let serial = 0;
    const port = owner => {
        let id; do { id = `__cardinality_port_${serial++}`; } while(used.has(id)); used.add(id);
        const node=nodes.get(owner);
        if(!node) throw new Error(`Unknown relationship endpoint: ${owner}`);
        (node.ports ||= []).push({id,width:0,height:0,layoutOptions:{'elk.port.borderOffset':String(CARDINALITY_CLEARANCE)}});
        portOwners.set(id,owner); return id;
    };
    for(const edge of graph.edges||[]) {
        edge.sources=edge.sources.map(port); edge.targets=edge.targets.map(port);
    }
    return {graph,portOwners};
}
export function cardinalityEdges(edges, nodes, portOwners) {
    const boundary = (p, port) => {
        const node=nodes.get(portOwners.get(port));
        if(!node) throw new Error(`Missing relationship endpoint: ${port}`);
        return {x:Math.max(node.x,Math.min(node.x+node.width,p.x)),y:Math.max(node.y,Math.min(node.y+node.height,p.y))};
    };
    return edges.map(edge=>({...edge,
        sources:edge.sources.map(id=>portOwners.get(id)),targets:edge.targets.map(id=>portOwners.get(id)),
        sections:(edge.sections||[]).map(section=>({...section,
            startPoint:boundary(section.startPoint,section.incomingShape||edge.sources[0]),
            endPoint:boundary(section.endPoint,section.outgoingShape||edge.targets[0]),
            bendPoints:[section.startPoint,...(section.bendPoints||[]),section.endPoint]
        }))
    }));
}
export function absoluteEdges(edges, groups) {
    return edges.map(edge=>{
        const offset=groups.get(edge.container)||{x:0,y:0};
        const point=p=>({...p,x:p.x+offset.x,y:p.y+offset.y});
        return {...edge,sections:(edge.sections||[]).map(s=>({...s,startPoint:point(s.startPoint),endPoint:point(s.endPoint),bendPoints:(s.bendPoints||[]).map(point)})),
            labels:(edge.labels||[]).map(l=>({...l,x:l.x+offset.x,y:l.y+offset.y}))};
    });
}
