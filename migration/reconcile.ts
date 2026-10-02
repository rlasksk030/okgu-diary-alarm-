import {sha,type Snapshot} from './core';
export function reconcile(previous:Snapshot,current:Snapshot,targetHashes:Record<string,string>){
 if(!previous.complete||!current.complete||previous.sourceId!==current.sourceId)throw new Error('INCOMPLETE_SNAPSHOT');
 const flatten=(s:Snapshot)=>new Map(Object.entries(s.entities).flatMap(([entity,rows])=>rows.map(r=>[JSON.stringify([entity,r.id]),sha(JSON.stringify(r))] as const)));
 const before=flatten(previous),after=flatten(current);const operations:{key:string;kind:string}[]=[];
 for(const [key,hash] of after){const old=before.get(key);if(!old)operations.push({key,kind:targetHashes[key]?'conflict-new-target':'insert'});else if(old!==hash)operations.push({key,kind:targetHashes[key]===old?'update-candidate':'conflict-target-changed'});}
 for(const [key] of before)if(!after.has(key))operations.push({key,kind:targetHashes[key]===before.get(key)?'missing-requires-delete-review':'conflict-target-changed'});
 return operations;
}
// Read-only rollback plan: protect every target row that changed after import, plus new v2 rows.
export function rollbackPlan(imported:Record<string,string>,current:Record<string,string>){return Object.entries(current).map(([key,hash])=>({key,action:!(key in imported)||hash!==imported[key]?'preserve-v2-export':'eligible-batch-review'}));}
