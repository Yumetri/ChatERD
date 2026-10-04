import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedArgs } from '../runtime/cli.mjs';

test('discussion launches read-only with only its dedicated MCP in a fresh directory', () => {
    const args = isolatedArgs('discuss', '/tmp/a schema.mmd', '/tmp/isolated-task');
    assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
    for (const flag of ['--ignore-user-config', '--ignore-rules', '--ephemeral']) assert(args.includes(flag));
    for (const feature of ['shell_tool', 'unified_exec', 'apps', 'plugins', 'browser_use', 'computer_use', 'hooks']) {
        const index = args.indexOf(feature); assert.equal(args[index - 1], '--disable');
    }
    const config = args.find(arg => arg.startsWith('mcp_servers.db_camp.args='));
    const [, mode, file] = JSON.parse(config.slice(config.indexOf('=') + 1));
    assert.equal(mode, 'discuss'); assert.equal(file, '/tmp/a schema.mmd');
    assert.equal(args[args.indexOf('--cd') + 1], '/tmp/isolated-task');
    assert(args.includes('mcp_servers.db_camp.enabled_tools=["get_diagram","get_preview"]'));
    assert(!args.some(arg => arg.includes('stage_diagram')));
    assert(!args.some(arg => arg.includes('danger-full-access')));
});

test('draw approves only the four scoped session tools and retains the filesystem sandbox', () => {
    const args = isolatedArgs('draw', '/tmp/another.mmd', '/tmp/isolated-draw');
    assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
    assert(args.includes('mcp_servers.db_camp.tools.commit_diagram.approval_mode="approve"'));
    assert(args.includes('mcp_servers.db_camp.enabled_tools=["get_diagram","get_preview","stage_diagram","commit_diagram"]'));
    assert(!args.some(arg => arg.includes('default_tools_approval_mode')));
});
