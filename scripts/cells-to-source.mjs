// Read-only connector CellData -> existing private source format. Never writes Sheets.
import {readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const [baselinePath,cellsPath,outputPath]=process.argv.slice(2);
const local=await realpath('.local');
for(const input of [baselinePath,cellsPath])assert((await realpath(input)).startsWith(local+path.sep));
assert(path.resolve(outputPath).startsWith(local+path.sep));
const baseline=JSON.parse(await readFile(baselinePath)),live=JSON.parse(await readFile(cellsPath));
assert.equal(live.spreadsheetId,baseline.provenance.sourceSpreadsheetId);
assert.equal(live.properties.timeZone,'Asia/Seoul');
assert.deepEqual(live.sheets.map(s=>s.properties.title).sort(),Object.keys(baseline.sheets).sort());
const raw=structuredClone(baseline);raw.capturedAt=live.capturedAt;raw.completedAt=live.completedAt;
raw.provenance={...raw.provenance,collectionMethod:'authenticated Google Sheets connector CellData',latestCellCapture:true};
raw.photoReferences=[];
const summary={};
for(const sheet of live.sheets){
 const name=sheet.properties.title,old=baseline.sheets[name],width=old.headers.length;
 const data=sheet.data?.[0];assert(data&&!data.startRow&&!data.startColumn);
 const range=live.ranges.find(r=>r.startsWith("'"+name+"'!"));assert(range&&Number(range.match(/\d+$/)[0])===sheet.properties.gridProperties.rowCount);
 const value=cell=>{
  const v=cell?.effectiveValue||cell?.userEnteredValue||{};
  assert(!v.errorValue&&!v.formulaValue,'SOURCE_CELL_ERROR');
  if('numberValue' in v&&['DATE','DATE_TIME','TIME'].includes(cell.effectiveFormat?.numberFormat?.type)){
   return {type:'date',iso:new Date(Math.round((v.numberValue-25569)*86400000)-9*3600000).toISOString()};
  }
  return v.stringValue??v.numberValue??v.boolValue??'';
 };
 const rows=data.rowData.map(row=>Array.from({length:width},(_,i)=>value(row.values?.[i])));
 assert.deepEqual(rows.shift(),old.headers,'SOURCE_HEADERS_CHANGED');
 while(rows.length&&rows.at(-1).every(v=>v===''))rows.pop();
 // Retain byte-identical date objects/metadata for unchanged source cells.
 for(let i=0;i<rows.length;i++)for(let j=0;j<width;j++){
  const before=old.rows[i]?.[j],after=rows[i][j];
  if(before?.type==='date'&&after?.type==='date'&&Date.parse(before.iso)===Date.parse(after.iso))rows[i][j]=before;
 }
 raw.sheets[name]={...old,rows};
 summary[name]={before:old.rows.length,current:rows.length,changed:rows.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(old.rows[i])).length};
}
for(const [i,row] of raw.sheets['일기기록'].rows.entries()){
 const urls=JSON.parse(row[11]||'[]');
 for(const [ordinal,url] of urls.entries()){
  const previous=baseline.photoReferences.find(r=>r.sourceUrl===url);
  assert(previous,'NEW_PHOTO_REQUIRES_AUTHENTICATED_CAPTURE');
  raw.photoReferences.push({...previous,row:i+2,ordinal});
 }
}
// Photos are the verified original bytes; paths resolve to their existing private location.
for(const photo of raw.photos)photo.path=path.relative(path.dirname(outputPath),path.resolve(path.dirname(baselinePath),photo.path));
await writeFile(outputPath,JSON.stringify(raw),{mode:0o600});
console.log(JSON.stringify({sheets:summary,photoReferences:raw.photoReferences.length,sourceWrites:false}));
