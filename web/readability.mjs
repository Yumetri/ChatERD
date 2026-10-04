// Geometry-only checks shared by routing and automatic layout selection.
// They never alter entities, FK bindings, or saved manual placement.
export const pathPoints=section=>[section.startPoint,...(section.bendPoints||[]),section.endPoint];
export const rectanglesOverlap=(a,b,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
export function lineHitsRectangle(a,b,r,gap=0){
    return a.x===b.x?a.x>r.x-gap&&a.x<r.x+r.width+gap&&Math.max(a.y,b.y)>r.y-gap&&Math.min(a.y,b.y)<r.y+r.height+gap:
        a.y>r.y-gap&&a.y<r.y+r.height+gap&&Math.max(a.x,b.x)>r.x-gap&&Math.min(a.x,b.x)<r.x+r.width+gap;
}
export function segmentsOf(edge,trim=false){
    return (edge.sections||[]).flatMap(s=>{const points=pathPoints(s),segments=[];for(let i=1;i<points.length;i++)if(points[i].x!==points[i-1].x||points[i].y!==points[i-1].y)segments.push([points[i-1],points[i]]);return trim?segments.slice(1,-1):segments;});
}
export function segmentContact(a,b,c,d){
    const horizontal=a.y===b.y,other=c.y===d.y;
    if(horizontal===other){
        if((horizontal?a.y!==c.y:a.x!==c.x))return {crossings:0,shared:0};
        const axis=horizontal?'x':'y';
        return {crossings:0,shared:Math.max(0,Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis])))};
    }
    const [p,q,r,s]=horizontal?[a,b,c,d]:[c,d,a,b];
    return {crossings:r.x>Math.min(p.x,q.x)&&r.x<Math.max(p.x,q.x)&&p.y>Math.min(r.y,s.y)&&p.y<Math.max(r.y,s.y)?1:0,shared:0};
}
export function routeCost(points,others=[]){
    let length=0,bends=0,previous,crossings=0,shared=0;
    for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];if(a.x===b.x&&a.y===b.y)continue;
        const direction=a.y===b.y?'H':'V';length+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(previous&&previous!==direction)bends++;previous=direction;
        // Common endpoint marker stubs are intentionally allowed to meet.
        if(i>1&&i<points.length-1)for(const [c,d]of others){const hit=segmentContact(a,b,c,d);crossings+=hit.crossings;shared+=hit.shared;}
    }
    return length+16*bends+64*crossings+.5*shared;
}
export function geometryQuality(geometry){
    const nodes=Object.values(geometry.entities),edges=geometry.edges,labels=edges.flatMap(e=>(e.labels||[]).filter(l=>Number.isFinite(l.x)).map(l=>({...l,edge:e.id})));
    let nodeOverlaps=0,labelCollisions=0,crossings=0,shared=0,length=0,bends=0;
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(rectanglesOverlap(nodes[i],nodes[j],16))nodeOverlaps++;
    const segments=edges.map(e=>segmentsOf(e,true));
    for(let i=0;i<labels.length;i++){
        const label=labels[i];for(const n of nodes)if(rectanglesOverlap(label,n,4))labelCollisions++;
        for(let j=i+1;j<labels.length;j++)if(rectanglesOverlap(label,labels[j],4))labelCollisions++;
        for(const e of edges)if(e.id!==label.edge)for(const [a,b]of segmentsOf(e))if(lineHitsRectangle(a,b,label,2))labelCollisions++;
    }
    for(let i=0;i<edges.length;i++){
        for(const s of edges[i].sections||[]){let previous;const points=pathPoints(s);for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k];if(a.x===b.x&&a.y===b.y)continue;const direction=a.y===b.y?'H':'V';length+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(previous&&direction!==previous)bends++;previous=direction;}}
        for(let j=i+1;j<edges.length;j++)for(const [a,b]of segments[i])for(const [c,d]of segments[j]){const hit=segmentContact(a,b,c,d);crossings+=hit.crossings;shared+=hit.shared;}
    }
    return {nodeOverlaps,labelCollisions,crossings,shared,length,bends};
}
export function compareQuality(a,b){
    for(const key of ['nodeOverlaps','labelCollisions'])if(a[key]!==b[key])return a[key]-b[key];
    // Sharing a long corridor makes distinct relationships difficult to trace.
    return (a.length+16*a.bends+64*a.crossings+.5*a.shared)-(b.length+16*b.bends+64*b.crossings+.5*b.shared);
}
export function chooseGeometry(candidates,aspect,bounds){
    const ranked=candidates.map(geometry=>({geometry,quality:geometryQuality(geometry),box:bounds(geometry)}));
    const fit=r=>Math.min(aspect/r.box.width,1/r.box.height);
    ranked.sort((a,b)=>compareQuality(a.quality,b.quality)||fit(b)-fit(a));
    return ranked[0]?.geometry;
}
