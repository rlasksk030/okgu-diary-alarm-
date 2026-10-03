// Offline only. Reuse the supplied server's sheet ID without exposing its secrets.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Script} from 'node:vm';
const input=process.argv[2];
if(!input)throw Error('E_PRIVATE_SERVER_FILE_REQUIRED');
const raw=await readFile(input,'utf8');
const id=/(?:const|var|let)\s+SPREADSHEET_ID\s*=\s*['"]([A-Za-z0-9_-]+)['"]/.exec(raw)?.[1];
if(!id)throw Error('E_ORIGINAL_SHEET_ID');
const exporter=await readFile('migration/source/ReadOnlyExportV2.gs','utf8');
const code='// Owner-only private helper. Do not publish/deploy/share this NEW project.\n'+
 'function backupOkguWithKnownSource() {\n'+
 '  PropertiesService.getScriptProperties().setProperty("OKGU_SOURCE_SPREADSHEET_ID",'+JSON.stringify(id)+');\n'+
 '  return exportOkguReadOnly();\n}\n\n'+exporter;
new Script(code); // Syntax only: never executes any Google service.
await mkdir('.local/private-source-export',{recursive:true,mode:0o700});
await writeFile('.local/private-source-export/ReadOnlyExport.private.gs',code,{mode:0o600});
console.log('Private owner-export helper prepared: .local/private-source-export/ReadOnlyExport.private.gs. Known source ID reused; no Google execution, source writes or deployment. Never commit this private file.');
