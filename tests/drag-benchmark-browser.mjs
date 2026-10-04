import {geometrySVG,createGeometryUpdater} from '../web/render.mjs';
import {placeGeometry,orthogonalPath} from '../web/routing.mjs';
import {geometrySVG as baselineSVG} from 'baseline-render';
import {placeGeometry as baselinePlace,orthogonalPath as baselinePath} from 'baseline-routing';
import {relationshipKey} from '../web/placement.mjs';
import {fixture} from './drag-performance-fixture.mjs';
import {checkDragPreview} from './drag-preview-check.mjs';
const out=document.querySelector('pre'),host=document.querySelector('#diagram');
const quantile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];
const stats=a=>({median_ms:quantile(a,.5),p95_ms:quantile(a,.95),max_ms:Math.max(...a)});
async function bench(count,kind,optimized){
    const {model,geometry,placement}=fixture(count),samples=[],routes=[],draw=[],raf=[];
    // Calibrate obstacle/attachment bounds to the actual shared table metrics,
    // outside the measured region. Synthetic tables must have real endpoints.
    const measured=new DOMParser().parseFromString(geometrySVG(model,geometry).svg,'image/svg+xml');
    for(const table of measured.querySelectorAll('[data-entity]')){const rect=table.querySelector('.table-base'),node=geometry.entities[table.dataset.entity];node.width=Number(rect.getAttribute('width'));node.height=Number(rect.getAttribute('height'));}
    for(const edge of geometry.edges){const a=geometry.entities[edge.sources[0]],b=geometry.entities[edge.targets[0]],s={x:a.x+a.width,y:a.y+a.height/2},t={x:b.x,y:b.y+b.height/2};edge.sections[0]={startPoint:s,endPoint:t,bendPoints:[{x:s.x+32,y:s.y},{x:t.x-32,y:t.y}]};Object.assign(edge.labels[0],{x:(s.x+t.x)/2-24,y:s.y-31});}
    host.innerHTML=(optimized?geometrySVG:baselineSVG)(model,geometry).svg;
    const updater=optimized?createGeometryUpdater(host.querySelector('svg'),model):null,cache={};let previousFrame;
    for(let i=0;i<35;i++){
        const frame=await new Promise(requestAnimationFrame);if(i>=5)raf.push(frame-previousFrame);previousFrame=frame;
        const start=performance.now(),draft={...placement,nodes:{...placement.nodes},edges:{...placement.edges}};
        if(kind==='table')draft.nodes.TABLE_0={...draft.nodes.TABLE_0,y:draft.nodes.TABLE_0.y+i*.5+1};
        else {const key=relationshipKey(model.relationships[0],model.relationships);draft.edges[key]={...draft.edges[key],via:{x:800,y:geometry.entities.TABLE_0.y+geometry.entities.TABLE_0.height/2+20+i*.5}};}
        const a=performance.now(),g=optimized?placeGeometry(model,geometry,draft,cache):baselinePlace(model,geometry,draft),b=performance.now();
        if(optimized)updater(g);else host.innerHTML=baselineSVG(model,g).svg;
        // Force style/layout consistently. This is CPU + layout, not a GPU
        // paint measurement. RAF intervals report scheduling/presentation gaps.
        host.getBoundingClientRect();const end=performance.now();if(i>=5){samples.push(end-start);routes.push(b-a);draw.push(end-b);}
    }
    return {mode:optimized?'incremental':'frozen-baseline',tables:count,columns_per_table:count>6?3:20,action:kind,processing:stats(samples),routing:stats(routes),drawing:stats(draw),raf_interval:stats(raf),frames_over_16_7ms:samples.filter(v=>v>16.7).length,samples:30};
}
function routeStress(){const rects=Array.from({length:64},(_,i)=>({x:40+(i%8)*120+(i*7%23),y:40+Math.floor(i/8)*120+(i*11%29),width:75+i%5,height:75+i%7})),results=[];
    for(const [name,fn]of (BASELINE?[['frozen-baseline',baselinePath],['optimized',orthogonalPath]]:[['optimized',orthogonalPath]])){const samples=[];for(let i=0;i<50;i++){const a={x:0,y:70+i*.13},b={x:1070,y:930-i*.13},t=performance.now();const path=fn(a,b,rects),elapsed=performance.now()-t;if(BASELINE&&JSON.stringify(path)!==JSON.stringify(baselinePath(a,b,rects)))throw new Error('Routing changed from frozen baseline');if(i>=10)samples.push(elapsed);}results.push({mode:name,obstacles:64,processing:stats(samples),samples:40});}return results;
}
try{
    await document.fonts.ready;const result={environment:{user_agent:navigator.userAgent,viewport:[innerWidth,innerHeight],hardware_threads:navigator.hardwareConcurrency},method:'5 warmup + 30 RAF-paced CPU/layout samples, 40 A* stress samples; not GPU paint or OS input latency',scenarios:[]};
    if(!ROUTING_ONLY)for(const n of [6,24])for(const action of ['table','edge'])for(const optimized of BASELINE?[false,true]:[true]){result.scenarios.push(await bench(n,action,optimized));out.textContent=JSON.stringify(result,null,2);}
    result.routing_stress=routeStress();result.svg_png_parity_checks=await checkDragPreview(host);out.textContent='PASS\n'+JSON.stringify(result,null,2);await fetch('/result',{method:'POST',body:JSON.stringify(result)});
}catch(e){out.textContent=e.stack;await fetch('/result',{method:'POST',body:JSON.stringify({error:e.stack})});}
