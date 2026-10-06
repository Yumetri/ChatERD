import test from 'node:test';
import assert from 'node:assert/strict';
import {keyLabel,semanticSignature,selectView} from '../web/model.mjs';
import {foreignKeyGroups,foreignKeySummary,relationshipLabel} from '../web/foreign-keys.mjs';

function fixture(){
    const fk=(columns,table,targets,label)=>({name:`fk_${label}`,columns,references:{table,columns:targets},label});
    const child={name:'RecordPlayer',attributes:['id','record_id','player_id','membership_id','team_id'].map(name=>({name,type:'uuid',keys:[name==='id'?'PK':'FK']})),metadata:{foreignKeys:[
        fk(['record_id','team_id'],'Record',['id','team_id'],'선수별 기록'),
        fk(['player_id'],'Player',['id'],'경기 참여'),
        fk(['membership_id','player_id','team_id'],'Membership',['id','player_id','team_id'],'출전 소속 이력'),
    ]}};
    const entities=['Record','Player','Membership'].map(name=>({name,attributes:[],metadata:{}}));
    return {entities:[...entities,child],groups:[],relationships:child.metadata.foreignKeys.map((fk,i)=>({id:`r${i}`,a:fk.references.table,b:child.name,label:fk.label}))};
}

test('table summaries explicitly list each complete FK column tuple in metadata order',()=>{
    const model=fixture(),before=semanticSignature(model);
    assert.deepEqual(foreignKeyGroups(model.entities.at(-1)).map(foreignKeySummary),[
        'FK1 · 복합 (record_id, team_id)',
        'FK2 · 단일 (player_id)',
        'FK3 · 복합 (membership_id, player_id, team_id)',
    ]);
    assert.deepEqual(foreignKeyGroups({metadata:{}}).map(foreignKeySummary),[]);
    assert.equal(semanticSignature(model),before);
});

test('shared columns list every FK group and preserve PK and unique labels',()=>{
    const model=fixture(),entity=model.entities.at(-1);
    assert.deepEqual(entity.attributes.map(a=>keyLabel(entity,a)),['PK','FK1','FK2, FK3','FK3','FK1, FK3']);
    entity.attributes[1].keys.push('UK');entity.metadata.unique=[{name:'uq_record',columns:['record_id']}];
    assert.equal(keyLabel(entity,entity.attributes[1]),'FK1, UK:uq_record');
    assert.equal(keyLabel({metadata:{}},{name:'unknown',keys:['FK']}),'FK');
});

test('edge labels use the child table FK groups and explicitly mark composite constraints',()=>{
    const model=fixture(),before=semanticSignature(model);
    assert.deepEqual(model.relationships.map(r=>relationshipLabel(model,r)),['선수별 기록 [FK1 · 복합]','경기 참여 [FK2]','출전 소속 이력 [FK3 · 복합]']);
    assert.equal(semanticSignature(model),before);
    assert.deepEqual(foreignKeyGroups(model.entities.at(-1)).map(g=>g.id),['FK1','FK2','FK3']);
    const view=selectView(model,'entity:Player');
    assert.equal(relationshipLabel(view,view.relationships[0]),'경기 참여 [FK2]');
});

test('reverse and self references use the same groups; ambiguous mappings are not guessed',()=>{
    const model=fixture();model.relationships[1]={...model.relationships[1],a:'RecordPlayer',b:'Player'};
    assert.equal(relationshipLabel(model,model.relationships[1]),'경기 참여 [FK2]');
    const self={entities:[{name:'Node',metadata:{foreignKeys:[{columns:['parent_id'],references:{table:'Node',columns:['id']},label:'부모'}]}}],relationships:[{id:'self',a:'Node',b:'Node',label:'부모'}]};
    assert.equal(relationshipLabel(self,self.relationships[0]),'부모 [FK1]');
    const ambiguous=fixture();ambiguous.entities.at(-1).metadata.foreignKeys.push({...ambiguous.entities.at(-1).metadata.foreignKeys[0]});
    assert.equal(relationshipLabel(ambiguous,ambiguous.relationships[0]),'선수별 기록');
    assert.equal(relationshipLabel(model,{id:'unmapped',label:'미정'}),'미정');
});
