export const isMacPlatform=platform=>/Mac|iPhone|iPad|iPod/i.test(platform);
export function shortcutAction(event,mac){
    if(event.isComposing||event.altKey||event.defaultPrevented)return null;
    if(mac?!event.metaKey||event.ctrlKey:!event.ctrlKey||event.metaKey)return null;
    // Physical codes also work while the Korean input method is selected.
    const key=event.code||`Key${event.key?.toUpperCase()}`;
    if(key==='KeyZ')return event.shiftKey?'redo':'undo';
    if(!mac&&key==='KeyY'&&!event.shiftKey)return 'redo';
    if(key==='KeyS'&&!event.shiftKey)return 'save';
    return null;
}
export function viewerShortcuts({canvas,undo,redo,showSaveStatus}){
    const mac=isMacPlatform(navigator.userAgentData?.platform||navigator.platform),modifier=mac?'Meta':'Control';
    for(const [id,keys]of [['layout-undo',`${modifier}+Z`],['layout-redo',`${modifier}+Shift+Z${mac?'':' Control+Y'}`]]){
        const button=document.getElementById(id);button.setAttribute('aria-keyshortcuts',keys);
        button.title+=` · ${id==='layout-undo'?(mac?'⌘Z':'Ctrl+Z'):(mac?'⌘⇧Z':'Ctrl+Shift+Z / Ctrl+Y')}`;
    }
    document.addEventListener('keydown',event=>{
        const action=shortcutAction(event,mac);if(!action)return;
        if(action==='save'){event.preventDefault();showSaveStatus();return;}
        if(event.target.closest('input,textarea,select,[contenteditable="true"],.cm-editor'))return;
        if(!canvas.contains(event.target)&&!event.target.closest('.placement-controls,#view-settings'))return;
        event.preventDefault();if(action==='undo')undo();else redo();
    });
}
