// Preparation only. Run in a SEPARATE owner-only Apps Script project after source
// access is granted. Never install triggers or replace the production project.
// Script Properties: OKGU_SOURCE_SPREADSHEET_ID, OKGU_PRIVATE_BACKUP_FOLDER_ID.
function exportOkguReadOnly() {
  const props = PropertiesService.getScriptProperties();
  const source = props.getProperty('OKGU_SOURCE_SPREADSHEET_ID');
  const destination = props.getProperty('OKGU_PRIVATE_BACKUP_FOLDER_ID');
  if (!source || !destination) throw new Error('SOURCE_AND_PRIVATE_DESTINATION_REQUIRED');
  const folder = DriveApp.getFolderById(destination);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE || folder.getEditors().length || folder.getViewers().length) throw new Error('OWNER_ONLY_BACKUP_FOLDER_REQUIRED');
  const ss = SpreadsheetApp.openById(source), sheets = {};
  const typed = value => value instanceof Date ? {type:'date',iso:value.toISOString()} : value;
  // getSheets/getDataRange READ existing sheets. Do not use production getSheet(),
  // which may create sheets, initialize headers or rewrite old schema.
  ss.getSheets().forEach(sheet => {
    const range = sheet.getDataRange(), raw = range.getValues();
    sheets[sheet.getName()] = {headers:raw[0].map(typed),rows:raw.slice(1).map(row=>row.map(typed)),displayRows:range.getDisplayValues().slice(1),numberFormats:range.getNumberFormats(),formulas:range.getFormulas(),rowCount:sheet.getLastRow(),columnCount:sheet.getLastColumn()};
  });
  const digest = bytes => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(x=>(x&255).toString(16).padStart(2,'0')).join('');
  const files=[];const diary=sheets['일기기록'];
  if (diary) {
    const index = name => {const hits=diary.headers.map((h,i)=>h===name?i:-1).filter(i=>i>=0);if(hits.length!==1)throw new Error('PHOTO_HEADER_REVIEW_REQUIRED');return hits[0];};
    const idColumn=index('ID'),photosColumn=index('사진URLs');
    diary.rows.forEach(row => {
      if (row.every(v=>v===''||v===null)) return;
      const urls=JSON.parse(String(row[photosColumn]||'[]'));
      if (!Array.isArray(urls)||typeof row[idColumn]!=='string') throw new Error('DIARY_ID_OR_PHOTO_LIST_REVIEW_REQUIRED');
      urls.forEach((url,ordinal)=>{
        // The source stores Drive thumbnail URLs. Back up ORIGINAL bytes by file ID,
        // never the w600 response. Unrecognized providers must be reviewed.
        const match=/^https:\/\/drive\.google\.com\/thumbnail\?id=([\w-]+)(?:&|$)/.exec(url);
        if (!match) throw new Error('PHOTO_PROVIDER_REVIEW_REQUIRED');
        const blob=DriveApp.getFileById(match[1]).getBlob(),bytes=blob.getBytes(),hash=digest(bytes);
        const name=hash+'.original';folder.createFile(blob.copyBlob().setName(name));
        files.push({id:match[1],diaryId:row[idColumn],ordinal,sourceUrl:url,path:name,sha256:hash,size:bytes.length,mime:blob.getContentType()});
      });
    });
  }
  // Private raw export intentionally precedes normalization: dates, numeric PINs,
  // header drift and row identities require explicit review. No PIN/hash/record logs.
  const raw={format:'okgu-sheet-raw-export-v1',complete:true,synthetic:false,capturedAt:new Date().toISOString(),timeZone:ss.getSpreadsheetTimeZone(),sheets,files};
  folder.createFile(Utilities.newBlob(JSON.stringify(raw), 'application/json','okgu-source-'+Date.now()+'.private.json'));
  return {complete:true,sheetCount:Object.keys(sheets).length,photoCount:files.length};
}
