// Lucide 0.468.0, ISC; see ../licenses/lucide.txt. Local SVGs, no runtime CDN.
const icons={
    "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\" />\n  <path d=\"M12 2v2\" />\n  <path d=\"M12 20v2\" />\n  <path d=\"m4.93 4.93 1.41 1.41\" />\n  <path d=\"m17.66 17.66 1.41 1.41\" />\n  <path d=\"M2 12h2\" />\n  <path d=\"M20 12h2\" />\n  <path d=\"m6.34 17.66-1.41 1.41\" />\n  <path d=\"m19.07 4.93-1.41 1.41\" />",
    "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\" />",
    "panel-left-close": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M9 3v18\" />\n  <path d=\"m16 15-3-3 3-3\" />",
    "panel-left-open": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M9 3v18\" />\n  <path d=\"m14 9 3 3-3 3\" />",
    "code-xml": "<path d=\"m18 16 4-4-4-4\" />\n  <path d=\"m6 8-4 4 4 4\" />\n  <path d=\"m14.5 4-5 16\" />",
    "rotate-ccw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" />\n  <path d=\"M3 3v5h5\" />",
    "maximize": "<path d=\"M8 3H5a2 2 0 0 0-2 2v3\" />\n  <path d=\"M21 8V5a2 2 0 0 0-2-2h-3\" />\n  <path d=\"M3 16v3a2 2 0 0 0 2 2h3\" />\n  <path d=\"M16 21h3a2 2 0 0 0 2-2v-3\" />",
    "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" />\n  <polyline points=\"7 10 12 15 17 10\" />\n  <line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
    "undo-2": "<path d=\"M9 14 4 9l5-5\" />\n  <path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\" />",
    "list-tree": "<path d=\"M21 12h-8\" />\n  <path d=\"M21 6H8\" />\n  <path d=\"M21 18h-8\" />\n  <path d=\"M3 6v4c0 1.1.9 2 2 2h3\" />\n  <path d=\"M3 10v6c0 1.1.9 2 2 2h3\" />",
    "x": "<path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />",
    "layout-grid": "<rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\" />\n  <rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\" />\n  <rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\" />\n  <rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\" />"
};
export function iconMarkup(name){if(!Object.hasOwn(icons,name))throw new Error('Unknown icon: '+name);return '<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+icons[name]+'</svg>';}
export function hydrateIcons(markup){return markup.replace(/<span data-icon="([a-z0-9-]+)"><\/span>/g,(_,name)=>iconMarkup(name));}
