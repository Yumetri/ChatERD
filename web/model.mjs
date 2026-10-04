// Extension data is explicit JSON in ordinary Mermaid comments. It stays in
// the same source/revision/semantic signature; never infer missing constraints.
import {readPlacement} from './placement.mjs';
export function metadataFrom(source) {
    const tables = Object.create(null);
    for (const line of source.split('\n')) {
        const match = line.match(/^\s*%%\s*@db-camp\s+(.+)$/); if (!match) continue;
        let value; try { value = JSON.parse(match[1]); } catch { throw new Error('@db-camp 메타데이터 JSON 오류'); }
        if (!value || typeof value.table !== 'string' || Object.hasOwn(tables,value.table)) throw new Error('@db-camp table 누락 또는 중복');
        tables[value.table] = value;
    }
    return tables;
}
export function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
    return value;
}
export function extractModel(db, source) {
    const extra = metadataFrom(source), data = db.getData();
    const groupIds=new Set((db.getSubGraphs?.()||[]).map(g=>g.id));
    const entities = [...db.getEntities()].filter(([name,e])=>!groupIds.has(e.id)&&!groupIds.has(name)).map(([name,e]) => ({ id:e.id, name, title:e.alias || name,
        parent:data.nodes.find(n=>n.id===e.id)?.parentId || null,
        styles:[...(e.cssStyles||[]),...(e.cssCompiledStyles||[])],
        attributes:e.attributes.map(a=>({name:a.name,type:a.type.replace(/\?$/,''),
            nullable:a.type.endsWith('?') ? true : null, keys:[...a.keys],comment:a.comment || ''})),
        metadata:extra[name] || {table:name} }));
    const names = new Map(entities.map(e=>[e.id,e.name]));
    const groups = (db.getSubGraphs?.() || []).map(g=>({id:g.id,title:g.title||g.id, members:[...g.nodes],direction:g.dir || null,
        parent:data.nodes.find(n=>n.id===g.id)?.parentId || null}));
    const relationships = db.getRelationships().map((r,i)=>({id:`relation-${i}`,a:names.get(r.entityA)||r.entityA,b:names.get(r.entityB)||r.entityB,
        label:r.roleA,cardA:r.relSpec.cardB,cardB:r.relSpec.cardA,identifying:r.relSpec.relType==='IDENTIFYING'}));
    const model = {entities,groups,relationships,direction:db.getDirection(),title:db.getDiagramTitle?.() || '',placement:readPlacement(source),visual:{nodeSpacing:data.config?.er?.nodeSpacing,rankSpacing:data.config?.er?.rankSpacing}};
    validateMetadata(model,extra);
    model.warnings = reviewModel(model);
    return model;
}
function fail(condition,message) { if (!condition) throw new Error(`설계 정보 오류: ${message}`); }
export function validateMetadata(model, extra) {
    const byName = new Map(model.entities.map(e=>[e.name,e]));
    for (const [name,m] of Object.entries(extra)) {
        const entity = byName.get(name); fail(entity,`${name} 테이블이 원본에 없습니다.`);
        fail(Object.keys(m).every(k=>['table','description','columns','unique','foreignKeys','checks','indexes'].includes(k)),`${name}에 알 수 없는 속성이 있습니다.`);
        if (m.description !== undefined) fail(typeof m.description==='string',`${name} description은 문자열이어야 합니다.`);
        const columns = new Map(entity.attributes.map(a=>[a.name,a]));
        const hasColumns = fields => Array.isArray(fields) && fields.length>0 && new Set(fields).size===fields.length && fields.every(c=>columns.has(c));
        if (m.columns!==undefined) fail(m.columns && typeof m.columns==='object' && !Array.isArray(m.columns),`${name} columns는 객체여야 합니다.`);
        for (const [field,c] of Object.entries(m.columns || {})) {
            fail(columns.has(field),`${name}.${field} 컬럼이 없습니다.`);
            fail(c && typeof c==='object' && !Array.isArray(c),`${name}.${field} 정보는 객체여야 합니다.`);
            fail(Object.keys(c).every(k=>['nullable','default','generated','description'].includes(k)),`${name}.${field}에 알 수 없는 속성이 있습니다.`);
            if (c.nullable!==undefined) fail(typeof c.nullable==='boolean',`${name}.${field} nullable은 true/false입니다.`);
            for (const key of ['default','generated','description']) if(c[key]!==undefined) fail(typeof c[key]==='string',`${name}.${field} ${key}는 문자열입니다.`);
            fail(!(columns.get(field).keys.includes('PK') && c.nullable===true),`${name}.${field} PK에 NULL을 허용할 수 없습니다.`);
            fail(!(columns.get(field).nullable===true && c.nullable===false),`${name}.${field} ? 타입과 NOT NULL 정보가 충돌합니다.`);
        }
        for (const key of ['unique','foreignKeys','checks','indexes']) if(m[key]!==undefined) fail(Array.isArray(m[key]),`${name} ${key}는 배열이어야 합니다.`);
        const constraintNames = new Set();
        for (const key of ['unique','foreignKeys','indexes']) for (const c of m[key]||[]) {
            fail(c && typeof c.name==='string' && c.name && !constraintNames.has(c.name),`${name} 제약 이름 누락 또는 중복`); constraintNames.add(c.name);
            fail(hasColumns(c.columns),`${name}.${c.name} 컬럼 목록이 잘못되었습니다.`);
            fail(Object.keys(c).every(k=>(key==='foreignKeys'?['name','columns','references','label','onDelete','onUpdate']:['name','columns']).includes(k)),`${name}.${c.name}에 알 수 없는 속성이 있습니다.`);
            if(key==='foreignKeys') {
                const target = byName.get(c.references?.table);
                fail(target && Array.isArray(c.references.columns) && c.references.columns.length===c.columns.length && c.references.columns.every(f=>target.attributes.some(a=>a.name===f)),`${name}.${c.name} 참조 대상 또는 컬럼 대응 오류`);
                fail(c.columns.every(f=>columns.get(f).keys.includes('FK')),`${name}.${c.name}은 FK 표기가 필요합니다.`);
                for(const k of ['label','onDelete','onUpdate']) if(c[k]!==undefined) fail(typeof c[k]==='string',`${name}.${c.name} ${k}는 문자열입니다.`);
            }
        }
        for(const check of m.checks||[]) fail(typeof check==='string',`${name} CHECK는 문자열입니다.`);
    }
}
export function columnInfo(entity, attribute) {
    const explicit = entity.metadata.columns?.[attribute.name] || {};
    return {...explicit,nullable:attribute.keys.includes('PK') ? false : explicit.nullable ?? attribute.nullable};
}
export function semanticSignature(model) {
    return JSON.stringify(stable({title:model.title||'',entities:model.entities.map(e=>({name:e.name,title:e.title,parent:e.parent,
        attributes:e.attributes,metadata:e.metadata})).sort((a,b)=>a.name.localeCompare(b.name)),
        groups:model.groups.map(({id,title,members,parent})=>({id,title,members:[...members].sort(),parent})).sort((a,b)=>a.id.localeCompare(b.id)),
        relationships:model.relationships.map(({id,...r})=>r).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}));
}
export function reviewModel(model) {
    const warnings=[]; const byName=new Map(model.entities.map(e=>[e.name,e]));
    for(const e of model.entities) {
        if(e.attributes.length && !e.attributes.some(a=>a.keys.includes('PK'))) warnings.push(`${e.name}: PK가 명시되지 않았습니다. 논리 모델인지 확인하세요.`);
        for(const a of e.attributes) if(a.keys.includes('FK') && !(e.metadata.foreignKeys||[]).some(f=>f.columns.includes(a.name))) warnings.push(`${e.name}.${a.name}: FK 참조 컬럼이 미정입니다.`);
        for(const fk of e.metadata.foreignKeys||[]) {
            const relation=model.relationships.find(r=>r.a===fk.references.table && r.b===e.name && (!fk.label||r.label===fk.label));
            if(!relation) {warnings.push(`${e.name}.${fk.name}: 참조 정보에 대응하는 관계선이 없습니다.`);continue;}
            const identifying=fk.columns.every(c=>e.attributes.find(a=>a.name===c).keys.includes('PK'));
            if(relation.identifying!==identifying) warnings.push(`${e.name}.${fk.name}: 관계선의 식별 여부와 PK 참여가 일치하지 않습니다.`);
            const nullable=fk.columns.map(c=>columnInfo(e,e.attributes.find(a=>a.name===c)).nullable);
            if(nullable.every(n=>n===false) && relation.cardA==='ZERO_OR_ONE') warnings.push(`${e.name}.${fk.name}: NOT NULL FK와 부모 0..1 표기를 확인하세요.`);
            if(nullable.some(n=>n===true) && relation.cardA==='ONLY_ONE') warnings.push(`${e.name}.${fk.name}: NULL 허용 FK와 부모 1 표기를 확인하세요.`);
            const target=byName.get(fk.references.table), pk=target.attributes.filter(a=>a.keys.includes('PK')).map(a=>a.name);
            const candidates=[pk,...(target.metadata.unique||[]).map(u=>u.columns),...target.attributes.filter(a=>a.keys.includes('UK') && !(target.metadata.unique||[]).some(u=>u.columns.includes(a.name))).map(a=>[a.name])];
            if(!candidates.some(c=>c.length===fk.references.columns.length&&c.every((n,i)=>n===fk.references.columns[i]))) warnings.push(`${e.name}.${fk.name}: 참조 대상의 PK/유일 제약이 명시되지 않았습니다.`);
        }
    }
    return warnings;
}
export function keyLabel(entity,a) {
    const groups=(entity.metadata.unique||[]).filter(u=>u.columns.includes(a.name)).map(u=>`UK:${u.name}`);
    return [...a.keys.filter(k=>k!=='UK'||!groups.length),...groups].join(', ');
}
export function selectView(model, view='all') {
    if(view==='all') return model;
    let selected=new Set();
    if(view.startsWith('group:')) {
        const id=view.slice(6), groups=new Map(model.groups.map(g=>[g.id,g]));
        const visited=new Set();function visit(key) {if(visited.has(key))return;visited.add(key);const g=groups.get(key); if(!g) {selected.add(key);return;} for(const member of g.members) visit(member);}
        visit(id);
    } else if(view.startsWith('entity:')) {
        const name=view.slice(7); selected.add(name);
        for(const r of model.relationships) if(r.a===name||r.b===name) {selected.add(r.a);selected.add(r.b);}
    } else throw new Error('알 수 없는 상세 뷰');
    const entities=model.entities.filter(e=>selected.has(e.name));
    if(!entities.length) throw new Error('상세 뷰에 테이블이 없습니다.');
    const ids=new Set(entities.map(e=>e.name));
    return {...model,entities,groups:[],relationships:model.relationships.filter(r=>ids.has(r.a)&&ids.has(r.b))};
}
