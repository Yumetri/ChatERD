import test from 'node:test';
import assert from 'node:assert/strict';
import {placeGeometry} from '../web/routing.mjs';
import {fieldOffsets,foreignKeyBindings} from '../web/field-anchors.mjs';

function fixture(self=false) {
    const relation={id:'e',a:'Parent',b:self?'Parent':'Child',label:'소속',cardA:'ZERO_OR_ONE',cardB:'ZERO_OR_MORE',identifying:false};
    const parent={name:'Parent',metadata:{},attributes:[]};
    const child={name:self?'Parent':'Child',metadata:{foreignKeys:[{name:'fk_parent',columns:['parent_id'],references:{table:'Parent',columns:['id']},label:'소속'}]},attributes:[]};
    const model={groups:[],entities:self?[child]:[parent,child],relationships:[relation]};
    const entities={Parent:{x:100,y:100,width:240,height:300,fieldOffsets:{id:90,parent_id:190}},...(!self?{Child:{x:500,y:120,width:240,height:340,fieldOffsets:{id:90,parent_id:260}}}:{})};
    const edge={id:'e',sources:['Parent'],targets:[relation.b],labels:[{text:'소속',x:360,y:180,width:50,height:26}],sections:[{startPoint:{x:340,y:140},endPoint:self?{x:340,y:200}:{x:500,y:160},bendPoints:[{x:372,y:140},{x:468,y:160}]}]};
    return {model,geometry:{entities,groups:{},edges:[edge]}};
}

test('FK and referenced rows determine endpoints without modifying source geometry',()=>{
    const {model,geometry}=fixture(),before=structuredClone(geometry);
    const section=placeGeometry(model,geometry).edges[0].sections[0];
    assert.equal(section.startPoint.y,190);
    assert.equal(section.endPoint.y,380);
    assert.equal(section.startPoint.x,340);
    assert.equal(section.endPoint.x,500);
    assert.deepEqual(geometry,before);
});

test('row attachment follows moved tables and retains the requested waypoint',()=>{
    const {model,geometry}=fixture();
    const key=JSON.stringify(['Parent','Child','소속','ZERO_OR_ONE','ZERO_OR_MORE',false,0]);
    const placement={nodes:{Child:{x:650,y:300}},edges:{[key]:{from:{side:'E',ratio:.2},to:{side:'W',ratio:.1},via:{x:430,y:520}}}};
    const section=placeGeometry(model,geometry,placement).edges[0].sections[0];
    assert.equal(section.startPoint.y,190);
    assert.equal(section.endPoint.y,560);
    assert(section.bendPoints.some(p=>p.x===430&&p.y===520));
});

test('self reference attaches its two ends to distinct referenced and FK rows',()=>{
    const {model,geometry}=fixture(true);
    const section=placeGeometry(model,geometry).edges[0].sections[0];
    assert.equal(section.startPoint.y,190);
    assert.equal(section.endPoint.y,290);
    assert(section.startPoint.x===100||section.startPoint.x===340);
    assert(section.endPoint.x===100||section.endPoint.x===340);
});

test('an unmatched relation retains its table attachment',()=>{
    const {model,geometry}=fixture();model.relationships[0].label='別';
    assert.deepEqual(placeGeometry(model,geometry),geometry);
});

test('wrapped row heights and PK display reorder determine offsets by field name',()=>{
    assert.deepEqual(fieldOffsets({attrs:[{name:'note'},{name:'id'},{name:'parent_id'}],titleHeight:40,headerHeight:38,rowHeights:[75,37,56]}),{note:115.5,id:171.5,parent_id:218});
    assert.deepEqual(fieldOffsets({attrs:[{name:'id'},{name:'note'},{name:'parent_id'}],titleHeight:40,headerHeight:38,rowHeights:[37,75,56]}),{id:96.5,note:152.5,parent_id:218});
});

test('two FKs between the same tables bind by label, including reverse relations',()=>{
    const {model}=fixture();
    model.entities[1].metadata.foreignKeys.push({name:'fk_reviewer',columns:['reviewer_id'],references:{table:'Parent',columns:['id']},label:'검토'});
    model.relationships.push({...model.relationships[0],id:'review',a:'Child',b:'Parent',label:'검토'});
    const bindings=foreignKeyBindings(model);
    assert.deepEqual(bindings.get('e'),{from:['id'],to:['parent_id']});
    assert.deepEqual(bindings.get('review'),{from:['reviewer_id'],to:['id']});
});

test('composite keys attach between involved rows; ambiguous mappings stay unattached',()=>{
    const {model,geometry}=fixture();
    const fk=model.entities[1].metadata.foreignKeys[0];fk.columns=['tenant_id','parent_id'];fk.references.columns=['tenant_id','id'];
    geometry.entities.Parent.fieldOffsets.tenant_id=140;geometry.entities.Child.fieldOffsets.tenant_id=180;
    const section=placeGeometry(model,geometry).edges[0].sections[0];
    assert.equal(section.startPoint.y,215);assert.equal(section.endPoint.y,340);
    const ambiguous=fixture();ambiguous.model.entities[1].metadata.foreignKeys.push({...ambiguous.model.entities[1].metadata.foreignKeys[0],name:'other'});
    assert.equal(foreignKeyBindings(ambiguous.model).size,0);
});
