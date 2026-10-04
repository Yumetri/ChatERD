import test from 'node:test';import assert from 'node:assert/strict';
import {formatSource} from '../web/format.mjs';
test('format preserves YAML, metadata and multiline descriptions while indenting ER bodies',()=>{
    const source='---\ntitle: 연습\nconfig:\n  er:\n    rankSpacing: 150\n---\n%% @db-camp {"table":"A"}\nerDiagram\naccDescr {\n  accessible\n}\nsubgraph g [주제]\nA {\nint id PK\n}\nend\n';
    const formatted=formatSource(source);assert.equal(formatted.split('erDiagram')[0],source.split('erDiagram')[0]);assert(formatted.includes('accDescr {\n  accessible\n}'));assert(formatted.includes('    A {\n        int id PK\n    }\nend'));assert.equal(formatSource(formatted),formatted);
});
