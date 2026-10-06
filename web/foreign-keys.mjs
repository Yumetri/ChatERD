const referencesCache=new WeakMap();

// Numbers are table-local display identifiers, in explicit metadata order.
export function foreignKeyGroups(entity){
    return (entity.metadata?.foreignKeys||[]).map((fk,index)=>({id:`FK${index+1}`,fk}));
}

export function foreignKeyReferences(model){
    if(referencesCache.has(model))return referencesCache.get(model);
    const pairs=new Map();
    for(const entity of model.entities)for(const group of foreignKeyGroups(entity)){
        const key=JSON.stringify([group.fk.references.table,entity.name]);
        if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push({...group,entity});
    }
    const result=new Map();
    for(const r of model.relationships){
        const forward=(pairs.get(JSON.stringify([r.a,r.b]))||[]).filter(({fk})=>!fk.label||fk.label===r.label);
        const reverse=r.a===r.b?[]:(pairs.get(JSON.stringify([r.b,r.a]))||[]).filter(({fk})=>!fk.label||fk.label===r.label);
        // Both field attachment and labeling require an unambiguous constraint.
        if(forward.length+reverse.length!==1)continue;
        result.set(r.id,{...(forward[0]||reverse[0]),forward:!!forward.length});
    }
    referencesCache.set(model,result);return result;
}

export function foreignKeyGroupLabel({id,fk}){
    return fk.columns.length>1?`${id} · 복합`:id;
}

export function foreignKeySummary({id,fk}){
    return `${id} · ${fk.columns.length>1?'복합':'단일'} (${fk.columns.join(', ')})`;
}

export function relationshipLabel(model,relation){
    const group=foreignKeyReferences(model).get(relation.id);
    return group?`${relation.label} [${foreignKeyGroupLabel(group)}]`:relation.label;
}
