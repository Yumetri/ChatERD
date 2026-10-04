import test from 'node:test';
import assert from 'node:assert/strict';
import {history,undo,redo,undoDepth,redoDepth} from '@codemirror/commands';
import {shortcutAction,isMacPlatform} from '../web/shortcuts.mjs';
import {loadedEditorState,layoutTransaction} from '../web/editor-history.mjs';
import {writePlacement} from '../web/placement.mjs';

test('Mac Command and Windows Control shortcuts support redo without stealing clipboard or IME input',()=>{
    assert(isMacPlatform('MacIntel'));assert(!isMacPlatform('Win32'));
    for(const mac of [true,false]){
        const mod=mac?{metaKey:true}:{ctrlKey:true},key=code=>({code,...mod});
        assert.equal(shortcutAction(key('KeyZ'),mac),'undo');
        assert.equal(shortcutAction({...key('KeyZ'),shiftKey:true},mac),'redo');
        assert.equal(shortcutAction(key('KeyS'),mac),'save');
        assert.equal(shortcutAction({...key('KeyZ'),key:'ㅋ'},mac),'undo');
        for(const code of ['KeyC','KeyV','KeyX','KeyA','KeyF'])assert.equal(shortcutAction(key(code),mac),null);
        for(const props of [{isComposing:true},{altKey:true},{defaultPrevented:true},{ctrlKey:true,metaKey:true}])assert.equal(shortcutAction({...key('KeyZ'),...props},mac),null);
        assert.equal(shortcutAction({code:'KeyZ',...(mac?{ctrlKey:true}:{metaKey:true})},mac),null);
    }
    assert.equal(shortcutAction({code:'KeyY',ctrlKey:true},false),'redo');
    assert.equal(shortcutAction({code:'KeyY',metaKey:true},true),null);
});

const original='erDiagram\nA {\n int id PK\n}\n';
function target(doc=original){
    let state=loadedEditorState(doc,[history()]);
    return {get state(){return state;},dispatch:transaction=>{state=transaction.state;},change:spec=>{state=state.update(spec).state;},load:doc=>{state=loadedEditorState(doc,[history()],state.selection.main);}};
}
test('real CodeMirror history interleaves typing and complete placement events in one timeline',()=>{
    const t=target();assert.equal(undo(t),false,'first load cannot undo to an empty diagram');
    t.change({changes:{from:t.state.doc.length,insert:'%% note\n'},userEvent:'input.type'});
    const typed=t.state.doc.toString(),placed=writePlacement(typed,{version:1,mode:'vertical',nodes:{A:{x:80,y:120}},edges:{}});
    t.change(layoutTransaction(t.state,placed));
    t.change({changes:{from:t.state.doc.length,insert:'%% later\n'},userEvent:'input.type'});
    const final=t.state.doc.toString();assert.equal(undoDepth(t.state),3);
    for(const expected of [placed,typed,original]){assert(undo(t));assert.equal(t.state.doc.toString(),expected);}
    for(const expected of [typed,placed,final]){assert(redo(t));assert.equal(t.state.doc.toString(),expected);}
});
test('new edits clear redo, and loading saved/external source clears both histories',()=>{
    const t=target();t.change(layoutTransaction(t.state,original+'%% layout\n'));assert(undo(t));
    t.change({changes:{from:t.state.doc.length,insert:'%% branch\n'},userEvent:'input.type'});
    assert.equal(redo(t),false);assert.equal(redoDepth(t.state),0);
    t.load('erDiagram\nNEW {\n int id PK\n}\n');
    assert.equal(undoDepth(t.state),0);assert.equal(redoDepth(t.state),0);assert.equal(undo(t),false);
    // Reloading identical bytes must clear stale history too.
    t.change({changes:{from:t.state.doc.length,insert:'%% saved\n'},userEvent:'input.type'});t.load(t.state.doc.toString());assert.equal(undo(t),false);
});
