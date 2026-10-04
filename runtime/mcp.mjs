import { createInterface } from 'node:readline';
import { ensureSession, api, preview } from './session.mjs';
import {layoutFeedback} from './layout-feedback.mjs';

const [role, schema] = process.argv.slice(2);
if (!['draw', 'discuss'].includes(role)) throw new Error('mode must be draw or discuss');
const session = await ensureSession(schema, { create: false });
const object = properties => ({ type: 'object', properties, additionalProperties: false });
const text = { type: 'string' };
const tools = [
    { name: 'get_diagram', description: '현재 에디터·저장 해시·편집 버전·그림 상태 조회', inputSchema: object({}), annotations: { readOnlyHint: true } },
    { name: 'get_preview', description: '해당 버전의 실제 PNG와 가까운 평행선의 관계·좌표·간격 진단을 메모리에서 반환. 파일을 저장하지 않음.', inputSchema: object({ id: text }), annotations: { readOnlyHint: true } },
];
if (role === 'draw') tools.push(
    { name: 'stage_diagram', description: '원본을 바꾸지 않고 후보 렌더링. 자동 보정은 repair_of와 syntax 또는 visual로 명시.', annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, inputSchema: { ...object({ content: text, version: { type: 'integer' }, saved_hash: text, repair_of: text, adjustment: { type: 'string', enum: ['syntax', 'visual'] } }), required: ['content', 'version', 'saved_hash'] } },
    { name: 'commit_diagram', description: '최초·오류 후에는 PNG 검수 pass, 검수 통과한 파일의 정상 수정은 automatic으로 저장. 버전·파일 충돌은 거부.', annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, inputSchema: { ...object({ id: text, review: { type: 'string', enum: ['pass','automatic'] }, findings: { type: 'array', items: text } }), required: ['id', 'review', 'findings'] } },
);
export async function callTool(name, args) {
    if (!tools.some(t => t.name === name)) throw new Error('tool unavailable for this capability');
    if (name === 'get_preview') {
        const data = await preview(session, role, args.id);
        const state = await api(session, role, 'diagram');
        if(state.file_conflict || state.version!==data.job.version || (role==='discuss'&&state.source_hash!==data.job.source_hash)) throw new Error('스키마 또는 편집 버전이 변경되었습니다. get_diagram으로 최신 상태를 다시 읽으세요. 이전 그림은 현재 설계로 사용할 수 없습니다.');
        const { content, ...metadata } = data.job;
        return { content: [{ type: 'text', text: JSON.stringify({...metadata,current_version:state.version,saved_hash:state.saved_hash,disk_hash:state.disk_hash,warnings:data.model?.warnings||[],layout_feedback:layoutFeedback(data.model)}) }, { type: 'image', data: data.png, mimeType: 'image/png' }] };
    }
    const route = { get_diagram: 'diagram', stage_diagram: 'stage', commit_diagram: 'commit' }[name];
    const data = await api(session, role, route, name === 'get_diagram' ? undefined : args);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}
async function handle(message) {
    if (message.id === undefined) return;
    try {
        let result;
        switch (message.method) {
            case 'initialize': result = { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'db-camp', version: '2.0.0' } }; break;
            case 'ping': result = {}; break;
            case 'tools/list': result = { tools }; break;
            case 'tools/call':
                try { result = await callTool(message.params.name, message.params.arguments || {}); }
                catch (error) { result = { isError: true, content: [{ type: 'text', text: error.message }] }; }
                break;
            default: process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }) + '\n'); return;
        }
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\n');
    } catch (error) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: error.message } }) + '\n'); }
}
createInterface({ input: process.stdin }).on('line', line => { try { handle(JSON.parse(line)); } catch { /* malformed notifications do not grant capabilities */ } });
