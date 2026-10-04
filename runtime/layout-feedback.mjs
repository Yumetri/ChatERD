import {segmentsOf} from '../web/readability.mjs';
import {relationshipKeys} from '../web/placement.mjs';

// Read-only diagnostics for the exact image returned by get_preview. A target
// gap is a review guideline, not a spacing guarantee of the current router.
export function layoutFeedback(model,{targetGap=24,minRun=48,limit=20}={}){
    const geometry=model?.geometry;
    if(!geometry?.entities||!Array.isArray(geometry.edges))return {available:false,reason:'렌더 좌표가 없어 관계선 간격을 측정할 수 없습니다.'};
    const relations=new Map((model.relationships||[]).map(r=>[r.id,r])),keys=relationshipKeys(model.relationships||[]),epsilon=.001;
    const edges=geometry.edges.map(edge=>{
        const relation=relations.get(edge.id);
        const info={id:edge.id,placement_key:keys.get(edge.id),label:relation?.label??edge.labels?.[0]?.text??'',from:relation?.a??edge.sources?.[0],to:relation?.b??edge.targets?.[0]};
        const segments=segmentsOf(edge,true).flatMap(([a,b])=>{
            const horizontal=Math.abs(a.y-b.y)<epsilon,vertical=Math.abs(a.x-b.x)<epsilon;
            if(horizontal===vertical)return [];
            const axis=horizontal?'x':'y',orth=horizontal?'y':'x';
            return [{a,b,horizontal,lo:Math.min(a[axis],b[axis]),hi:Math.max(a[axis],b[axis]),position:(a[orth]+b[orth])/2}];
        });
        return {info,segments};
    });
    const issues=[];let nearest=Infinity;
    for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++)for(const a of edges[i].segments)for(const b of edges[j].segments){
        if(a.horizontal!==b.horizontal)continue;
        const overlap=Math.min(a.hi,b.hi)-Math.max(a.lo,b.lo);if(overlap<minRun)continue;
        const gap=Math.abs(a.position-b.position);nearest=Math.min(nearest,gap);
        if(gap+epsilon>=targetGap)continue;
        issues.push({relations:[edges[i].info,edges[j].info],orientation:a.horizontal?'horizontal':'vertical',gap_px:Number(gap.toFixed(3)),parallel_run_px:Number(overlap.toFixed(3)),segments:[[a.a,a.b],[b.a,b.b]]});
    }
    issues.sort((a,b)=>a.gap_px-b.gap_px||b.parallel_run_px-a.parallel_run_px);
    const reported=issues.slice(0,limit),names=new Set(reported.flatMap(issue=>issue.relations.flatMap(r=>[r.from,r.to])));
    return {available:true,coordinate_space:'SVG 원본 좌표(px); 화면 확대율을 적용한 픽셀 간격이 아님',target_parallel_gap_px:targetGap,minimum_parallel_run_px:minRun,
        closest_parallel_gap_px:Number.isFinite(nearest)?Number(nearest.toFixed(3)):null,close_parallel_count:issues.length,reported_count:reported.length,truncated:issues.length>limit,
        close_parallel_segments:reported,related_entities:Object.fromEntries([...names].filter(name=>geometry.entities[name]).map(name=>{const {x,y,width,height}=geometry.entities[name];return [name,{x,y,width,height}];}))};
}
