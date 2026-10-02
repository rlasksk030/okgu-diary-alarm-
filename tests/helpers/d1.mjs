import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
export async function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const file of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile('migrations/'+file,'utf8'));
 let queries=0;
 const DB={prepare(sql){const statement={params:[],bind(...params){this.params=params;return this;},async first(){queries++;return sqlite.prepare(sql).get(...this.params)||null;},async all(){queries++;return {results:sqlite.prepare(sql).all(...this.params)};},async run(){queries++;const q=sqlite.prepare(sql);return q.columns().length?{meta:{changes:0},results:q.all(...this.params)}:{meta:{changes:Number(q.run(...this.params).changes)},results:[]};}};return statement;},
 async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,DB,count:()=>queries,reset:()=>{queries=0;},close:()=>sqlite.close()};
}
