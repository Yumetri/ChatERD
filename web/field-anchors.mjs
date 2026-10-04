const bindingsCache=new WeakMap();
const connectionsCache=new WeakMap();
export const FIELD_PORT_SPACING=26;

// Independent slots within the actual bound row keep cardinality symbols
// apart without moving an endpoint onto a different field.
export function fieldConnections(model){
    if(connectionsCache.has(model))return connectionsCache.get(model);
    const result=new Map(),bindings=foreignKeyBindings(model);
    for(const r of model.relationships)for(const end of ['from','to']){
        const fields=bindings.get(r.id)?.[end];if(!fields)continue;
        const name=end==='from'?r.a:r.b;if(!result.has(name))result.set(name,new Map());
        const rows=result.get(name);
        for(const field of fields){if(!rows.has(field))rows.set(field,[]);rows.get(field).push(`${r.id}:${end}`);}
    }
    connectionsCache.set(model,result);return result;
}
export function fieldPortOffsets(metrics,connections=new Map()){
    const centers=fieldOffsets(metrics),parts=new Map();
    for(const [field,keys]of connections){if(!Number.isFinite(centers[field]))continue;
        keys.forEach((key,index)=>{if(!parts.has(key))parts.set(key,[]);parts.get(key).push(centers[field]+(index-(keys.length-1)/2)*FIELD_PORT_SPACING);});
    }
    return Object.fromEntries([...parts].map(([key,values])=>[key,(Math.min(...values)+Math.max(...values))/2]));
}

// Use rendered row order/heights, including wrapped descriptions and PK grouping.
export function fieldOffsets({attrs,titleHeight,headerHeight,rowHeights}) {
    let top=titleHeight+headerHeight;
    return Object.fromEntries(attrs.map((a,i)=>{
        const entry=[a.name,top+rowHeights[i]/2];top+=rowHeights[i];return entry;
    }));
}

export function foreignKeyBindings(model) {
    if(bindingsCache.has(model))return bindingsCache.get(model);
    const pairs=new Map();
    for(const entity of model.entities)for(const fk of entity.metadata?.foreignKeys||[]) {
        const key=JSON.stringify([fk.references.table,entity.name]);
        if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(fk);
    }
    const result=new Map();
    for(const r of model.relationships) {
        const forward=(pairs.get(JSON.stringify([r.a,r.b]))||[]).filter(fk=>!fk.label||fk.label===r.label);
        const reverse=r.a===r.b?[]:(pairs.get(JSON.stringify([r.b,r.a]))||[]).filter(fk=>!fk.label||fk.label===r.label);
        // A relation without an unambiguous FK mapping remains table-attached.
        if(forward.length+reverse.length!==1)continue;
        const fk=forward[0]||reverse[0];
        result.set(r.id,forward.length?{from:fk.references.columns,to:fk.columns}:{from:fk.columns,to:fk.references.columns});
    }
    bindingsCache.set(model,result);return result;
}

export function fieldOffset(node,fields) {
    if(!fields?.length)return undefined;
    const offsets=fields.map(field=>node.fieldOffsets?.[field]);
    if(!offsets.every(Number.isFinite))return undefined;
    // A composite key attaches at the middle of the involved row centers.
    return (Math.min(...offsets)+Math.max(...offsets))/2;
}
