// Reuses the operating project's ALREADY supplied source constant: no ID/key input.
// Manual owner execution only. Anonymous/public Web App calls are rejected.
function _okguManualBackupOwner_() {
  const active=Session.getActiveUser().getEmail(), effective=Session.getEffectiveUser().getEmail();
  if(!active || !effective || active!==effective) throw new Error('MANUAL_OWNER_EXECUTION_REQUIRED');
}
function backupOkguWithKnownSource() {
  _okguManualBackupOwner_();
  if(typeof SPREADSHEET_ID!=='string' || !SPREADSHEET_ID) throw new Error('EXISTING_OPERATING_PROJECT_REQUIRED');
  PropertiesService.getScriptProperties().setProperty('OKGU_SOURCE_SPREADSHEET_ID',SPREADSHEET_ID);
  const result=exportOkguReadOnly();
  if(result.complete) {
    const props=PropertiesService.getScriptProperties(),folder=DriveApp.getFolderById(props.getProperty('OKGU_PRIVATE_BACKUP_FOLDER_ID'));
    _okguPrivateFolder_(folder);
    const metadata={format:'okgu-operating-runtime-v1',capturedAt:new Date().toISOString(),runtimeKind:'editor manual execution; NOT proof of the active web deployment version',projectTimeZone:Session.getScriptTimeZone(),writePauseProperty:props.getProperty('OKGU_WRITE_PAUSED')==='yes',teacherFeedFunctionPresent:typeof getRecentEntries==='function',triggers:ScriptApp.getProjectTriggers().map(t=>({id:t.getUniqueId(),handler:t.getHandlerFunction(),source:String(t.getTriggerSource()),eventType:String(t.getEventType())})),limits:['Trigger API cannot read the configured clock hour','Running executions and active deployment version must be checked in the owner UI']};
    const files=folder.getFilesByName('operating-runtime.private.json');
    if(files.hasNext()) files.next().setContent(JSON.stringify(metadata));else folder.createFile('operating-runtime.private.json',JSON.stringify(metadata),MimeType.PLAIN_TEXT);
  }
  return result;
}

// Add as a NEW helper file in the existing operating project; keep Code.gs unchanged.
// Do not deploy this helper during backup. No source writes, source trigger changes,
// web deployment, network push or automatic trigger creation are performed.
// Google Drive scope permits creating the NEW private destination. This is not
// read-only OAuth; writes are confined to the new private folder and OKGU backup properties.
function exportOkguReadOnly() {
  _okguManualBackupOwner_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('BACKUP_ALREADY_RUNNING');
  try { return _okguBackupStep_(); } finally { lock.releaseLock(); }
}
function startNewOkguBackup() {
  _okguManualBackupOwner_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('BACKUP_ALREADY_RUNNING');
  try {
    // Keeps ALL previous backup files/folders. Never deletes or alters the source.
    PropertiesService.getScriptProperties().deleteProperty('OKGU_BACKUP_STATE_FILE');
    PropertiesService.getScriptProperties().deleteProperty('OKGU_PRIVATE_BACKUP_FOLDER_ID');
    return _okguBackupStep_();
  } finally { lock.releaseLock(); }
}
function _okguBackupStep_() {
  _okguManualBackupOwner_();
  const started = Date.now(), props = PropertiesService.getScriptProperties();
  const sourceId = props.getProperty('OKGU_SOURCE_SPREADSHEET_ID');
  if (!sourceId) throw new Error('KNOWN_SOURCE_REQUIRED');
  const ss = SpreadsheetApp.openById(sourceId);
  let folder, stateFile, state;
  const stateId = props.getProperty('OKGU_BACKUP_STATE_FILE');
  if (stateId) {
    folder = DriveApp.getFolderById(props.getProperty('OKGU_PRIVATE_BACKUP_FOLDER_ID'));
    _okguPrivateFolder_(folder);
    stateFile = DriveApp.getFileById(stateId);
    const parents = stateFile.getParents(); let belongs = false;
    while (parents.hasNext()) if (parents.next().getId() === folder.getId()) belongs = true;
    if (!belongs || stateFile.getName() !== 'checkpoint.private.json') throw new Error('PRIVATE_CHECKPOINT_REQUIRED');
    state = JSON.parse(stateFile.getBlob().getDataAsString());
    if (state.sourceId !== sourceId || state.folderId !== folder.getId() || state.format !== 2) throw new Error('CHECKPOINT_SOURCE_MISMATCH');
    if (state.complete) return _okguBackupSummary_(state, folder);
  } else {
    folder = DriveApp.createFolder('옥구_최종백업_'+Utilities.formatDate(new Date(),'Asia/Seoul','yyyyMMdd_HHmmss'));
    folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    _okguPrivateFolder_(folder);
    const sheets = _okguReadSheets_(ss), references = _okguPhotoRefs_(sheets);
    const ids = {}; references.forEach(r => { ids[r.id] = true; });
    // Root identity was already present in the provided source. Stop on ambiguity.
    const named = DriveApp.getFoldersByName('OKGU_DIARY_사진'), roots = [];
    while (named.hasNext()) roots.push(named.next());
    if (roots.length !== 1) throw new Error('PHOTO_ROOT_MISSING_OR_AMBIGUOUS');
    const inventory = _okguPhotoInventory_(roots);inventory.forEach(f=>{ids[f.id]=true;});
    state = {format:2,sourceId:sourceId,folderId:folder.getId(),capturedAt:new Date().toISOString(),timeZone:ss.getSpreadsheetTimeZone(),sheets:sheets,references:references,inventory:inventory,queue:Object.keys(ids),photos:[],cursor:0,complete:false,rootCount:roots.length,sourceFolderId:roots[0].getId(),sourceHash:_okguHash_(Utilities.newBlob(JSON.stringify(sheets)).getBytes())};
    stateFile = folder.createFile('checkpoint.private.json',JSON.stringify(state),MimeType.PLAIN_TEXT);
    props.setProperties({OKGU_PRIVATE_BACKUP_FOLDER_ID:folder.getId(),OKGU_BACKUP_STATE_FILE:stateFile.getId()});
  }
  while (state.cursor < state.queue.length && Date.now()-started < 240000) {
    const id = state.queue[state.cursor], original = DriveApp.getFileById(id);
    const blob=original.getBlob(),bytes=blob.getBytes(),hash=_okguHash_(bytes),name=hash+'.original';
    // Crash before checkpoint: reuse and VERIFY the already-created file.
    const existing=folder.getFilesByName(name);let backup;
    if (existing.hasNext()) { backup=existing.next();if (existing.hasNext()) throw new Error('BACKUP_FILE_AMBIGUOUS'); }
    else backup=folder.createFile(blob.copyBlob().setName(name));
    if (_okguHash_(backup.getBlob().getBytes())!==hash || backup.getSize()!==bytes.length) throw new Error('BACKUP_PHOTO_VERIFICATION_FAILED');
    state.photos.push({id:id,backupId:backup.getId(),path:name,mime:blob.getContentType(),size:bytes.length,sha256:hash,referenced:state.references.some(r=>r.id===id)});
    state.cursor++;stateFile.setContent(JSON.stringify(state));
  }
  if (state.cursor === state.queue.length) {
    // A capture while the old app is writable is not a final-delta snapshot.
    // Detect row changes during collection instead of silently claiming completeness.
    const end = _okguReadSheets_(ss);
    if (_okguHash_(Utilities.newBlob(JSON.stringify(end)).getBytes())!==state.sourceHash) throw new Error('SOURCE_CHANGED_START_NEW_BACKUP');
    // Re-read source photo bytes to detect replacements between initial copy and completion.
    for (let i=state.verifyCursor||0;i<state.photos.length;i++) {
      if (Date.now()-started>=240000) return _okguBackupSummary_(state,folder);
      const p=state.photos[i];if (_okguHash_(DriveApp.getFileById(p.id).getBlob().getBytes())!==p.sha256) throw new Error('PHOTO_CHANGED_START_NEW_BACKUP');
      state.verifyCursor=i+1;stateFile.setContent(JSON.stringify(state));
    }
    if (_okguHash_(Utilities.newBlob(JSON.stringify(_okguReadSheets_(ss))).getBytes())!==state.sourceHash) throw new Error('SOURCE_CHANGED_START_NEW_BACKUP');
    if (JSON.stringify(_okguPhotoInventory_([DriveApp.getFolderById(state.sourceFolderId)]))!==JSON.stringify(state.inventory)) throw new Error('PHOTO_INVENTORY_CHANGED_START_NEW_BACKUP');
    const raw={format:'okgu-sheet-raw-export-v2',complete:true,synthetic:false,capturedAt:state.capturedAt,completedAt:new Date().toISOString(),timeZone:state.timeZone,sheets:state.sheets,photoReferences:state.references,photos:state.photos,sourcePhotoInventory:state.inventory,provenance:{sourceSpreadsheetId:state.sourceId,headersPreserved:true,originalSourceNotModified:true,sourceChangedDuringCapture:false}};
    const output=folder.getFilesByName('raw.private.json');
    if (output.hasNext()) output.next().setContent(JSON.stringify(raw));else folder.createFile('raw.private.json',JSON.stringify(raw),MimeType.PLAIN_TEXT);
    folder.createFile('backup-status.txt','COMPLETE\nSheets: '+Object.keys(state.sheets).length+'\nOriginal photos: '+state.photos.length+'\nPhoto references: '+state.references.length+'\nAll original/copy SHA256 verified.\nNo source modification or trigger change.\n',MimeType.PLAIN_TEXT);
    state.complete=true;stateFile.setContent(JSON.stringify(state));
  }
  return _okguBackupSummary_(state,folder);
}
function _okguReadSheets_(ss) {
  const sheets={},typed=v=>v instanceof Date?{type:'date',iso:v.toISOString()}:v;
  ss.getSheets().forEach(sheet=>{
    const range=sheet.getDataRange(),values=range.getValues();
    sheets[sheet.getName()]={headers:values[0].map(typed),rows:values.slice(1).map(r=>r.map(typed)),displayRows:range.getDisplayValues().slice(1),numberFormats:range.getNumberFormats(),formulas:range.getFormulas(),rowCount:sheet.getLastRow(),columnCount:sheet.getLastColumn()};
  });return sheets;
}
function _okguPhotoRefs_(sheets) {
  const refs=[];
  Object.keys(sheets).forEach(name=>sheets[name].rows.forEach((row,index)=>row.forEach((cell,column)=>{
    if (typeof cell!=='string' || cell.indexOf('https://drive.google.com/')<0) return;
    let list;try {list=JSON.parse(cell);} catch(e) {if (/^\s*\[/.test(cell)) throw new Error('PHOTO_CELL_FORMAT_REVIEW_REQUIRED');return;}
    if (!Array.isArray(list)) return;
    list.forEach((url,ordinal)=>{const match=/^https:\/\/drive\.google\.com\/thumbnail\?id=([\w-]+)(?:&|$)/.exec(url);
      if (!match) throw new Error('PHOTO_PROVIDER_REVIEW_REQUIRED');
      refs.push({sheet:name,row:index+2,column:column+1,ordinal:ordinal,id:match[1],sourceUrl:url});
    });
  })));return refs;
}
function _okguPhotoInventory_(roots) {
  const inventory=[];
  function walk(dir) {
    const files=dir.getFiles();while(files.hasNext()){const f=files.next();inventory.push({id:f.getId(),folderId:dir.getId(),mime:f.getMimeType(),size:f.getSize()});}
    const children=dir.getFolders();while(children.hasNext())walk(children.next());
  }
  roots.forEach(walk);return inventory.sort((a,b)=>a.id.localeCompare(b.id));
}
function _okguHash_(bytes) {return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(x=>(x&255).toString(16).padStart(2,'0')).join('');}
function _okguPrivateFolder_(folder) {if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE || folder.getEditors().length || folder.getViewers().length)throw new Error('OWNER_ONLY_BACKUP_FOLDER_REQUIRED');}
function _okguBackupSummary_(state,folder) {
  const result={complete:state.complete,sheets:Object.keys(state.sheets).length,copied:state.cursor,total:state.queue.length,verified:state.verifyCursor||0,referenceCount:state.references.length};
  // No source IDs, student rows, PINs, tokens, subscription keys or URLs in logs.
  console.log(JSON.stringify(result));console.log('Drive backup folder: '+folder.getName());return result;
}
