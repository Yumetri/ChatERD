// Keep YAML frontmatter and multiline accessibility descriptions verbatim.
// Formatting changes indentation only; it never rewrites ER tokens/comments.
export function formatSource(source) {
    const lines=source.split('\n');let frontmatter=lines[0]?.trim()==='---',opening=frontmatter,description=false,level=0;
    return lines.map(line=>{
        const s=line.trim();
        if(frontmatter){if(s==='---'){if(opening)opening=false;else frontmatter=false;}return line;}
        if(description){if(s.includes('}'))description=false;return line;}
        if(/^accDescr\s*\{/.test(s)){description=!s.includes('}');return line;}
        if(s.startsWith('%%'))return line;
        if(s==='}'||s==='end')level=Math.max(0,level-1);
        const out=s?'    '.repeat(level)+s:'';
        if(/\{$/.test(s)||/^subgraph\b/.test(s))level++;
        return out;
    }).join('\n');
}
