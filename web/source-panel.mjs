// Viewer preferences only: never changes the editor document or schema API.
export function sourcePanel({onShow}) {
    const main=document.querySelector('main'),panel=document.getElementById('source-panel'),divider=document.getElementById('panel-divider'),toggle=document.getElementById('source-toggle');
    const storageKey='db-camp:source-panel',narrow=matchMedia('(max-width:650px)');
    const state={widthRatio:.34,heightRatio:.35,collapsed:false};let drag=null;
    try{const stored=JSON.parse(localStorage.getItem(storageKey));for(const key of ['widthRatio','heightRatio'])if(Number.isFinite(stored?.[key])&&stored[key]>0&&stored[key]<1)state[key]=stored[key];if(typeof stored?.collapsed==='boolean')state.collapsed=stored.collapsed;}catch{}
    const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}};
    function limits(){const box=main.getBoundingClientRect(),vertical=narrow.matches,total=vertical?box.height:box.width;
        const max=Math.max(0,total-8-(vertical?240:280)),min=Math.min(vertical?120:220,max);
        return {vertical,total,min,max,key:vertical?'heightRatio':'widthRatio'};}
    function apply(){const l=limits(),size=Math.max(l.min,Math.min(l.max,state[l.key]*l.total));
        main.style.setProperty(l.vertical?'--source-height':'--source-width',`${size}px`);
        main.classList.toggle('source-collapsed',state.collapsed);panel.hidden=divider.hidden=state.collapsed;
        toggle.setAttribute('aria-label',state.collapsed?'코드 패널 열기':'코드 패널 접기');toggle.title=state.collapsed?'코드 패널 열기 · Mermaid 원본을 편집합니다':'코드 패널 접기 · 다이어그램을 넓게 표시합니다';toggle.setAttribute('aria-expanded',String(!state.collapsed));
        divider.setAttribute('aria-orientation',l.vertical?'horizontal':'vertical');
        for(const [name,value]of Object.entries({min:l.min,max:l.max,now:size}))divider.setAttribute(`aria-value${name}`,String(Math.round(value)));
        divider.setAttribute('aria-valuetext',`코드 영역 ${Math.round(size)} 픽셀`);return size;
    }
    function resize(size){const l=limits();state[l.key]=Math.max(l.min,Math.min(l.max,size))/Math.max(1,l.total);apply();}
    function end(){if(!drag)return;drag=null;main.classList.remove('source-resizing');persist();}
    toggle.onclick=()=>{end();state.collapsed=!state.collapsed;apply();persist();if(!state.collapsed)onShow();};
    divider.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const l=limits();drag={pointer:e.pointerId,vertical:l.vertical,origin:l.vertical?e.clientY:e.clientX,size:apply()};divider.setPointerCapture(e.pointerId);divider.focus();main.classList.add('source-resizing');});
    divider.addEventListener('pointermove',e=>{if(drag?.pointer===e.pointerId)resize(drag.size+(drag.vertical?e.clientY:e.clientX)-drag.origin);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])divider.addEventListener(type,end);
    divider.addEventListener('dblclick',()=>{end();state.widthRatio=.34;state.heightRatio=.35;apply();persist();});
    divider.addEventListener('keydown',e=>{const l=limits(),step=e.shiftKey?30:10,delta=l.vertical?{ArrowUp:-step,ArrowDown:step}[e.key]:{ArrowLeft:-step,ArrowRight:step}[e.key];
        if(delta!==undefined||e.key==='Home'||e.key==='End'){e.preventDefault();resize(e.key==='Home'?l.min:e.key==='End'?l.max:apply()+delta);persist();}});
    narrow.addEventListener('change',()=>{end();apply();});new ResizeObserver(()=>apply()).observe(main);apply();
}
