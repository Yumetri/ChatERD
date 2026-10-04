// Nonmodal native disclosures: keep form controls keyboard-accessible and
// avoid competing overlays. Opening menus never resizes the diagram canvas.
export function viewerMenus(){
    const menus=[...document.querySelectorAll('.popover,#downloads')];
    for(const menu of menus){
        const summary=menu.querySelector('summary');
        summary.setAttribute('role','button');
        summary.setAttribute('aria-expanded',String(menu.open));
        menu.addEventListener('toggle',()=>{
            summary.setAttribute('aria-expanded',String(menu.open));
            if(menu.open)for(const other of menus)if(other!==menu)other.open=false;
        });
    }
    document.addEventListener('click',event=>{
        for(const menu of menus)if(menu.open&&!menu.contains(event.target))menu.open=false;
    });
    document.addEventListener('keydown',event=>{
        if(event.key!=='Escape')return;
        const open=menus.find(menu=>menu.open);if(!open)return;
        const restore=open.contains(document.activeElement);open.open=false;
        if(restore)open.querySelector('summary').focus({preventScroll:true});
    });
}
