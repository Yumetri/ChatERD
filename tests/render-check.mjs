import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import { setTimeout as delay } from 'node:timers/promises';
import { ensureSession, api, preview, viewerURL } from '../runtime/session.mjs';
import {formatSource} from '../web/format.mjs';
import {CARDINALITY_CLEARANCE,cardinalityAreas} from '../web/layout.mjs';
import {writePlacement,relationshipKey,removePlacement} from '../web/placement.mjs';

const directory = await mkdtemp(path.join(tmpdir(), 'db-camp-render-'));
const schema = path.join(directory, 'different schema 한글.mmd');
const source = `erDiagram
    direction LR
    RECORD {
        int id PK
        string very_long_name "한국어 이름과 긴 설명을 함께 확인"
        datetime created_at
        string category
        string description
        boolean enabled
    }
    DETAIL {
        int id PK
        int record_id FK
        string note "상세 설명"
    }
    RECORD ||--o{ DETAIL : "포함"
`;
await writeFile(schema, source);
const session = await ensureSession(schema, { openBrowser: true });
console.log('실제 브라우저 렌더 검증:', directory);
console.log('테스트 뷰어:', viewerURL(session));
async function current() {
    const start = Date.now();
    while (Date.now() - start < 35000) {
        const state = await api(session, 'discuss', 'diagram');
        if (state.render_status === 'ready') return preview(session, 'draw', state.current_id);
        if (state.render_status === 'error') { const p = await api(session, 'discuss', `preview?id=${state.current_id}`); throw new Error(p.job.error); }
        await delay(150);
    }
    throw new Error('뷰어에서 렌더 결과가 도착하지 않았습니다.');
}
async function stage(content, extra = {}) {
    const state = await api(session, 'draw', 'diagram');
    return api(session, 'draw', 'stage', { content, version: state.version, saved_hash: state.saved_hash, ...extra });
}
const baseline = await current();
assert(Buffer.from(baseline.png, 'base64').subarray(1, 4).toString() === 'PNG');
// Inspect geometry from the same actual parser/render/export used by the viewer.
function assertAttributeTable(result, entityName, field, type) {
    const group=result.svg.split(`data-entity="${entityName}"`)[1]?.split('class="entity"')[0];
    assert(group,`missing ${entityName}`);
    assert.deepEqual([...group.matchAll(/class="column-title"[^>]*><tspan[^>]*>(.*?)<\/tspan>/g)].map(m=>m[1]),['필드명','데이터 타입','키 / 제약','NULL 허용','설명']);
    const cells=[...group.matchAll(/data-column="([^"]+)" data-field="([^"]+)"[^>]*><text x="([^"]+)"([^>]*)>([\s\S]*?)<\/text>/g)].map(m=>({role:m[1],field:m[2],x:Number(m[3]),text:m[5].replace(/<[^>]*>/g,'')})).filter(c=>c.field===field);
    assert.deepEqual(cells.map(c=>c.role),['name','type','keys','nullable','comment']);
    assert.equal(cells[0].text,field);assert.equal(cells[1].text,type);
    assert(cells.every((c,i)=>!i||cells[i-1].x<c.x));
    const original=JSON.parse(result.semantic).entities.find(e=>e.name===entityName).attributes.find(a=>a.name===field);
    assert.equal(original.type,type);
}
function assertEdges(result) {
    const {entities,groups,edges}=result.model.geometry;
    const nodes={...entities,...groups};
    const boundary=(p,n)=>p.x>=n.x-.01&&p.x<=n.x+n.width+.01&&p.y>=n.y-.01&&p.y<=n.y+n.height+.01&&Math.min(Math.abs(p.x-n.x),Math.abs(p.x-n.x-n.width),Math.abs(p.y-n.y),Math.abs(p.y-n.y-n.height))<.01;
    for(const e of edges) for(const section of e.sections||[]) {
        assert(boundary(section.startPoint,nodes[e.sources[0]]),`start endpoint outside ${e.sources[0]}`);
        assert(boundary(section.endPoint,nodes[e.targets[0]]),`end endpoint outside ${e.targets[0]}`);
        for(const [p,q] of [[section.startPoint,section.bendPoints[0]],[section.endPoint,section.bendPoints.at(-1)]]) {
            assert(p.x===q.x||p.y===q.y,'cardinality must be perpendicular to its table');
            assert(Math.hypot(q.x-p.x,q.y-p.y)>=CARDINALITY_CLEARANCE-.01,'first bend clips cardinality');
        }
    }
    if(Object.keys(groups).length&&edges.length){
        assert(result.svg.includes('<mask '),'group outlines require marker exclusion');
        assert.equal((result.svg.match(/class="cardinality-clearance"/g)||[]).length,edges.reduce((n,e)=>n+2*e.sections.length,0));
        const outlines=[...result.svg.matchAll(/<rect[^>]*class="group-box"[^>]*>/g)];assert.equal(outlines.length,Object.keys(groups).length);assert(outlines.every(([tag])=>tag.includes('mask="url(#group-clearance-')));
        const parents=new Map(result.model.groups.map(g=>[g.id,g.parent]));
        for(const e of edges){const areas=cardinalityAreas([e]);for(const [index,name]of [[0,e.sources[0]],[1,e.targets[0]]]){
            const entity=result.model.entities.find(n=>n.name===name);if(!entity)continue;let parent=entity.parent;
            while(parent){const g=groups[parent],a=areas[index];assert(a.x>=g.x&&a.y>=g.y&&a.x+a.width<=g.x+g.width&&a.y+a.height<=g.y+g.height,'ancestor border crosses table cardinality');parent=parents.get(parent);}
        }}
    }
}
assertAttributeTable(baseline, 'RECORD', 'id', 'int');
console.log('PASS: 실제 SVG는 필드명→타입→키/제약→NULL→설명, 열 제목 표시, 원본 의미 유지');
await writeFile(path.join(directory, 'baseline.png'), Buffer.from(baseline.png, 'base64'));
assert.deepEqual((await readdir(directory)).sort(), ['baseline.png', path.basename(schema)].sort());
console.log('PASS: 한국어·긴 이름·다수 컬럼 실제 PNG 생성, 앱의 자동 이미지 파일 없음');
assertEdges(baseline);
const bounds = svg => svg.match(/viewBox="([^"]+)"/)?.[1];
const variants = [
    ['direction', source.replace('direction LR', 'direction TB')],
    ['spacing', `---\nconfig:\n  er:\n    rankSpacing: 220\n    nodeSpacing: 280\n---\n${source}`],
    ['font', `${source}\n    classDef default font-size:20px\n`],
];
for (const [name, content] of variants) {
    const job = await stage(content); const result = await preview(session, 'draw', job.id);
    assert.notEqual(bounds(result.svg), bounds(baseline.svg), `${name} did not affect actual layout`);
    assert.equal(await readFile(schema, 'utf8'), source, 'candidate modified original');
    await writeFile(path.join(directory, `${name}.png`), Buffer.from(result.png, 'base64'));
    console.log(`PASS: ${name} 설정이 실제 크기·배치에 영향, 후보는 원본을 변경하지 않음`);
}
const scenarios = [
    ['many-columns', `erDiagram\n WIDE_TABLE["한국어와 많은 컬럼"] {\n int id PK\n${Array.from({length:35},(_,i)=>` varchar(255) very_long_field_name_${i} "${'긴 한국어 설명과 값을 확인합니다. '.repeat(5)}"`).join('\n')}\n }\n`],
    ['isolated', 'erDiagram\n STANDALONE\n'],
    ['long-alias', 'erDiagram\n LONG_TITLE["관계가 없는 아주 긴 한국어 테이블 제목의 가독성 확인"]\n'],
    ['nullable', 'erDiagram\n NULLABLE {\n int id PK\n text? note\n }\n'],
    ['nested-groups', 'erDiagram\n subgraph outer [큰 주제]\n subgraph inner [작은 주제]\n A {\n int id PK\n }\n B {\n int id PK\n }\n A ||..o{ B : 내부\n end\n end\n'],
    ['group-relations', 'erDiagram\n subgraph g1 [영역 하나]\n A\n end\n subgraph g2 [영역 둘]\n B\n end\n g1 ||..o{ g2 : 그룹연결\n'],
    ['self-reference', 'erDiagram\n PERSON["사람"] {\n int id PK\n int parent_id FK\n }\n PERSON ||--o{ PERSON : "상위 관계"\n'],
    ['many-relations', `${source}\n OWNER {\n int id PK\n }\n CATEGORY {\n int id PK\n }\n TAG {\n int id PK\n }\n RECORD_TAG {\n int record_id PK, FK\n int tag_id PK, FK\n }\n OWNER ||--o{ RECORD : "작성"\n CATEGORY ||--o{ RECORD : "분류"\n RECORD ||--o{ RECORD_TAG : "태그 연결"\n TAG ||--o{ RECORD_TAG : "태그 참조"\n`],
    ['no-optional-cells', 'erDiagram\n FIELD_ONLY {\n varchar(255) a_very_long_field_name\n int count\n }\n'],
    ...['LR','TB','RL','BT'].map(d=>[`short-cardinality-${d}`,`---\nconfig:\n  er:\n    nodeSpacing: 1\n    rankSpacing: 1\n---\nerDiagram\n direction ${d}\n A {\n int id PK\n }\n B {\n int id PK\n text note\n }\n C\n A }o..o{ B : x\n A ||--|{ C : y\n B |o..o{ B : z\n`]),
    ...['LR','TB','RL','BT'].map(d=>[`group-cardinality-${d}`,`erDiagram\n direction ${d}\n subgraph outer [큰 영역]\n subgraph inner [작은 영역]\n A\n end\n end\n subgraph other [다른 영역]\n B\n end\n A }o..o{ B : 외부관계\n`]),
];
for (const [name,content] of scenarios) {
    const job=await stage(content), result=await preview(session,'draw',job.id);assertEdges(result);
    assert(result.svg.includes('table-title'));
    if (content.includes(' PK')) assert(result.svg.includes('key-text'));
    if (name === 'no-optional-cells') assertAttributeTable(result, 'FIELD_ONLY', 'a_very_long_field_name', 'varchar(255)');
    if(name==='nullable')assert.equal(result.model.entities[0].attributes[1].nullable,true);
    if(name==='nested-groups')assert.equal(result.model.groups.length,2);
    if(name==='group-relations')assert.equal(result.model.entities.length,2);
    if (name === 'isolated' || name === 'long-alias') assert(!result.svg.includes('data-column='), 'attribute-free entity gained fields');
    await writeFile(path.join(directory,`${name}.png`),Buffer.from(result.png,'base64'));
    console.log(`PASS: ${name} 실제 렌더링·제목·키 표시`);
}
// Test automatic modes against a copy without existing manual coordinates.
// The user's sample file may have been arranged in the viewer; never reset it.
const example=removePlacement(await readFile(new URL('../examples/sample.mmd',import.meta.url),'utf8'));
const exampleJob=await stage(example),exampleImage=await preview(session,'draw',exampleJob.id);assertEdges(exampleImage);
assert.equal(exampleImage.model.entities.length,6);assert.equal(exampleImage.model.groups.length,3);assert.equal(exampleImage.model.relationships.length,7);assert.deepEqual(exampleImage.model.warnings,[]);
assert.equal(exampleImage.model.entities.find(e=>e.name==='USER').metadata.unique[0].columns.length,2);
assert(exampleImage.svg.includes('게시 서비스 설계 연습'));await writeFile(path.join(directory,'full-example.png'),Buffer.from(exampleImage.png,'base64'));
console.log('PASS: 사용자 예시의 복합 키·FK·기본값·CHECK·NULL·3그룹, 잘못 연결된 끝점 없음');
const groupedSource='erDiagram\n subgraph g [수동 영역]\n A\n end\n B\n A }o..o{ B : 연결\n',groupedModel=(await preview(session,'draw',(await stage(groupedSource)).id)).model;
const groupedManual=writePlacement(groupedSource,{version:1,mode:'horizontal',nodes:{A:{x:300,y:300},B:{x:540,y:300}},edges:{[relationshipKey(groupedModel.relationships[0],groupedModel.relationships)]:{from:{side:'E',ratio:.5},to:{side:'W',ratio:.5},via:{x:500,y:420}}}});
const groupedImage=await preview(session,'draw',(await stage(groupedManual)).id);assertEdges(groupedImage);assert.equal(groupedImage.model.geometry.entities.A.x,300);
// This external table's reserved marker area crosses the group's right
// border. Check actual PNG pixels, not just the presence of a mask tag. The
// border must match its interior fill here, except on the real ER edge itself.
const pixels=PNG.sync.read(Buffer.from(groupedImage.png,'base64')),group=groupedImage.model.geometry.groups.g,borderX=Math.round((group.x+group.width)*2)-1;
for(let y=310;y<=330;y++){if(Math.abs(y-320)<=2)continue;for(let channel=0;channel<3;channel++){
    const at=(Math.round(y*2)*pixels.width+borderX)*4+channel,reference=at-6*4;assert(Math.abs(pixels.data[at]-pixels.data[reference])<=3,'PNG group border crosses external cardinality clearance');}}
await writeFile(path.join(directory,'group-manual.png'),Buffer.from(groupedImage.png,'base64'));console.log('PASS: 수동 그룹 영역의 여백·외부 크로우풋 경계 충돌 PNG 픽셀 검사, 위치 유지');
const formattedJob=await stage(formatSource(example)),formattedImage=await preview(session,'draw',formattedJob.id);assert.equal(formattedImage.semantic,exampleImage.semantic);
console.log('PASS: 실제 파서 기준 소스 정리 전후 제목·설정·그룹·제약 의미 유지');
for(const mode of ['horizontal','vertical','screen']){
    const candidate=writePlacement(example,{version:1,mode,aspect:1.4,nodes:{},edges:{}}),job=await stage(candidate),result=await preview(session,'draw',job.id);assertEdges(result);
    assert.equal(result.semantic,exampleImage.semantic);assert.equal(removePlacement(candidate),example);
    if(mode==='horizontal')assert.equal(result.model.geometry.direction,'LR');if(mode==='vertical')assert.equal(result.model.geometry.direction,'TB');
    if(mode==='screen')assert(result.model.geometry.packedColumns,'screen should use balanced subject packing for the example');
    await writeFile(path.join(directory,`layout-${mode}.png`),Buffer.from(result.png,'base64'));console.log(`PASS: ${mode} 배치 메타데이터 실제 렌더링, 원본 설계 의미 보존`);
}
const manualSettings={version:1,mode:'horizontal',nodes:{RECORD:{x:64,y:400},DETAIL:{x:1100,y:64}},edges:{[relationshipKey(baseline.model.relationships[0],baseline.model.relationships)]:{from:{side:'E',ratio:.5},to:{side:'W',ratio:.5},via:{x:1000,y:500}}}};
const manualSource=writePlacement(source,manualSettings),manualJob=await stage(manualSource),manualImage=await preview(session,'draw',manualJob.id);assertEdges(manualImage);assert.equal(manualImage.semantic,baseline.semantic);
assert.equal(manualImage.model.geometry.entities.RECORD.x,64);assert.equal(manualImage.model.geometry.entities.RECORD.y,400);assert(manualImage.model.geometry.edges[0].sections[0].bendPoints.some(p=>p.x===1000&&p.y===500));
const restored=await preview(session,'draw',(await stage(manualSource)).id);assert.equal(restored.svg,manualImage.svg);assert.equal(restored.png,manualImage.png);
await writeFile(path.join(directory,'manual-layout.png'),Buffer.from(manualImage.png,'base64'));console.log('PASS: 테이블·관계선·연결 지점 저장과 실제 SVG/PNG 재현, Mermaid 파서 영향 없음');
const baseJob = await stage(source); await preview(session, 'draw', baseJob.id);
const visual = await stage(source.replace('record_id FK', 'record_id PK'), { repair_of: baseJob.id, adjustment: 'visual' });
await assert.rejects(() => preview(session, 'draw', visual.id), /semantics/);
console.log('PASS: 실제 Mermaid 파서 기준 키 변경을 시각 보정으로 저장하지 않음');
for (const action of ['stage', 'commit', 'draft', 'report', 'reload']) await assert.rejects(() => api(session, 'discuss', action, {}), /capability/);
console.log('PASS: 토론 연결의 모든 쓰기 API 거부');
const valid = await stage(source.replace('direction LR', 'direction TB')); await preview(session, 'draw', valid.id);
await api(session, 'draw', 'commit', { id: valid.id, review: 'pass', findings: ['실제 PNG 확인'] });
const committedImage = await preview(session, 'discuss', valid.id);
assert(committedImage.svg.includes('DETAIL') && committedImage.png);
const accepted = source.replace('direction LR', 'direction TB'); assert.equal(await readFile(schema, 'utf8'), accepted);
console.log('PASS: 이미지 조회·검수 통과 후보 저장');
let state = await api(session, 'ui', 'diagram');
await api(session, 'ui', 'draft', { content: 'erDiagram\n RECORD {\n invalid', version: state.version, saved_hash: state.saved_hash });
await assert.rejects(current, /Parse|parse|syntax|Syntax/);
assert.equal(await readFile(schema, 'utf8'), accepted);
console.log('PASS: 실제 브라우저 문법 오류 보고, 원본 유지');
state = await api(session, 'ui', 'diagram');
await api(session, 'ui', 'draft', { content: source, version: state.version, saved_hash: state.saved_hash });
await current(); assert.equal(await readFile(schema, 'utf8'), source);
console.log('PASS: UI 쓰기 경로의 정상 렌더 후 자동 저장');
state=await api(session,'ui','diagram');await api(session,'ui','draft',{content:source+'\n%% @db-camp-layout {"version":1,"mode":"screen","nodes":{"RECORD":{"x":-1,"y":0}}}',version:state.version,saved_hash:state.saved_hash});
await assert.rejects(current,/배치/);assert.equal(await readFile(schema,'utf8'),source);
state=await api(session,'ui','diagram');await api(session,'ui','draft',{content:source,version:state.version,saved_hash:state.saved_hash});await current();console.log('PASS: 잘못된 배치 메타데이터는 초안에 유지하고 정상 원본을 덮어쓰지 않음');
const conflict = await stage(source); await preview(session, 'draw', conflict.id);
await writeFile(schema, accepted);
await assert.rejects(() => api(session, 'draw', 'commit', { id: conflict.id, review: 'pass', findings: [] }), /externally/);
assert.equal(await readFile(schema, 'utf8'), accepted);
console.log('PASS: 외부 파일 변경 보호');
if (await readFile(schema,'utf8') === accepted) await writeFile(schema,source);
console.log('브라우저의 Download PNG/SVG 버튼과 확대/이동을 수동 확인하세요. 테스트 뷰어는 유지합니다.');
