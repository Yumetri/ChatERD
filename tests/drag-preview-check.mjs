import {geometrySVG,createGeometryUpdater,svgToPng} from '../web/render.mjs';
import {placeGeometry} from '../web/routing.mjs';
import {relationshipKey} from '../web/placement.mjs';
const assert=(value,message)=>{if(!value)throw new Error(message)};
export async function checkDragPreview(host){
const A={name:'A',title:'한국어 긴 이름 제목',styles:[],metadata:{},parent:'inner',attributes:[{name:'long_name_필드',type:'varchar',comment:'한국어 설명',keys:['PK']}]},B={...A,name:'B',parent:'outer'};
const r={id:'e',a:'A',b:'B',label:'관계 설명',cardA:'ONLY_ONE',cardB:'ZERO_OR_MORE',identifying:false},model={title:'검증',groups:[{id:'outer',title:'바깥 그룹'},{id:'inner',parent:'outer',title:'긴 내부 그룹'}],entities:[A,B],relationships:[r]};
const base={entities:{A:{x:200,y:200,width:650,height:115},B:{x:1100,y:500,width:650,height:115}},groups:{inner:{x:152,y:132,width:746,height:231,children:[{}]},outer:{x:104,y:64,width:1694,height:599,children:[{}]}},edges:[{id:'e',sources:['A'],targets:['B'],labels:[{text:r.label,x:850,y:330,width:96,height:26}],sections:[{startPoint:{x:850,y:250},endPoint:{x:1100,y:550},bendPoints:[{x:882,y:250},{x:950,y:250},{x:950,y:550},{x:1068,y:550}]}]}]};
const key=relationshipKey(r,[r]),p={nodes:{},edges:{[key]:{from:{side:'E',ratio:.5},to:{side:'W',ratio:.5}}}};
async function pixels(svg,width,height){const png=await svgToPng(svg,width,height),img=new Image(),url=URL.createObjectURL(png);try{img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return c.getContext('2d').getImageData(0,0,c.width,c.height).data;}finally{URL.revokeObjectURL(url);}}
let checks=0;for(const theme of ['light','dark'])for(const keySection of [false,true]){const first=geometrySVG(model,base,theme,{keySection});host.innerHTML=first.svg;const svg=host.querySelector('svg');if(theme==='dark'&&keySection)for(const node of svg.querySelectorAll('[data-layout-edge],[data-layout-group],[data-layout-end]'))for(const attr of ['data-layout-edge','data-layout-group','data-layout-end'])node.removeAttribute(attr);
    const entity=svg.querySelector('[data-entity=A]'),updater=createGeometryUpdater(svg,model,base),cache={};
    for(const next of [{...p,nodes:{A:{x:300,y:300}}},{...p,edges:{[key]:{...p.edges[key],via:{x:960,y:650}}}},{...p,edges:{[key]:{from:{side:'N',ratio:.3},to:{side:'S',ratio:.7}}}}]){
        const g=placeGeometry(model,base,next,cache);updater(g);assert(svg.querySelector('[data-entity=A]')===entity,'table DOM replaced');const fresh=geometrySVG(model,g,theme,{keySection}),target=new DOMParser().parseFromString(fresh.svg,'image/svg+xml').documentElement;
        // During dragging the camera stays fixed. Normalize only camera attrs
        // and the mask's scoped id, then compare every element/attribute/text.
        const clone=svg.cloneNode(true);for(const k of ['width','height','viewBox'])clone.setAttribute(k,target.getAttribute(k));const newID=target.querySelector('mask').id;clone.querySelector('mask').id=newID;for(const box of clone.querySelectorAll('.group-box'))box.setAttribute('mask',`url(#${newID})`);
        const structure=n=>[n.tagName,[...n.attributes||[]].map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0])),...Array.from(n.childNodes).map(c=>c.nodeType===1?structure(c):c.textContent)];
        assert(JSON.stringify(structure(clone))===JSON.stringify(structure(target)),'incremental DOM differs from full renderer');
        if(checks%3===0){const a=await pixels(new XMLSerializer().serializeToString(clone),fresh.width,fresh.height),b=await pixels(fresh.svg,fresh.width,fresh.height);assert(a.length===b.length&&a.every((v,i)=>v===b[i]),'PNG pixels differ');}checks++;
    }
}return checks;
}
