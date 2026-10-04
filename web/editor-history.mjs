import {EditorState} from '@codemirror/state';
import {isolateHistory} from '@codemirror/commands';

// Loading a saved/external revision starts a new editing session. It must not
// be possible to undo the load and overwrite a newer author or an empty doc.
export function loadedEditorState(doc,extensions,selection={anchor:0,head:0}){
    return EditorState.create({doc,extensions,selection:{anchor:Math.min(selection.anchor,doc.length),head:Math.min(selection.head,doc.length)}});
}
// Each completed layout gesture is one event, separate from nearby typing.
export const layoutTransaction=(state,source)=>({changes:{from:0,to:state.doc.length,insert:source},annotations:isolateHistory.of('full')});
