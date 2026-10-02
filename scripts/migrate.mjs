import {readFile} from 'node:fs/promises';
import {plan} from '../migration/core.ts';
const snapshot=JSON.parse(await readFile(process.argv[2]||'fixtures/snapshot.json','utf8'));
const {issues,counts,archiveOnly}=plan(snapshot);
console.log(JSON.stringify({mode:'read-only D1 migration plan; no import',issues,counts,archiveOnly},null,2));
if(issues.length)process.exitCode=1;
