export const palettes={
    light:{background:'#ffffff',surface:'#f8fafc',alternate:'#f1f5f9',header:'#eff6ff','table-surface':'#eaf0f6','table-alternate':'#e0e8f1','table-header':'#dbeafe',text:'#1f2937',muted:'#64748b',border:'#94a3b8',line:'#475569',accent:'#1d4ed8',error:'#b91c1c',selection:'#dbeafe'},
    dark:{background:'#111827',surface:'#1f2937',alternate:'#253244',header:'#23304a','table-surface':'#1f2937','table-alternate':'#253244','table-header':'#23304a',text:'#e5e7eb',muted:'#94a3b8',border:'#94a3b8',line:'#cbd5e1',accent:'#93c5fd',error:'#fca5a5',selection:'#1e3a5f'}
};
export function preferredTheme(){try{const value=localStorage.getItem('db-camp:theme');if(Object.hasOwn(palettes,value))return value;}catch{}return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
export function applyTheme(root,name){if(!palettes[name])throw new Error('알 수 없는 테마');for(const [key,value] of Object.entries(palettes[name]))root.style.setProperty(`--${key}`,value);root.dataset.theme=name;root.style.colorScheme=name;}
