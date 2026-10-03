"""Offline only. Run on an extracted owner ZIP under .local; prints counts only.
Requires openpyxl 3.1.5. Never imports data or writes to the Google source.
"""
import argparse, hashlib, json, pathlib, re, unicodedata, datetime
from zoneinfo import ZoneInfo
import openpyxl

def audit(folder):
    base=pathlib.Path('.local').resolve(); root=pathlib.Path(folder).resolve()
    if not root.is_relative_to(base): raise ValueError('PRIVATE_LOCAL_DIRECTORY_REQUIRED')
    paths=list(root.rglob('*'))
    if any(p.is_symlink() for p in paths): raise ValueError('SYMLINK_NOT_ALLOWED')
    def find(name):
        found=[p for p in paths if p.is_file() and unicodedata.normalize('NFC',p.name)==name]
        if len(found)!=1: raise ValueError('PACKAGE_FILE_MISSING_OR_AMBIGUOUS')
        return found[0]
    def load(name): return json.loads(find(name).read_text())
    raw=load('raw.private.json'); candidate=load('raw.positional-candidate.private.json')
    catalog=load('photo-catalog.private.json')
    if raw.get('format')!='okgu-sheet-raw-export-v1' or not raw.get('complete'): raise ValueError('INCOMPLETE_SOURCE')
    if raw['sheets'].keys()!=candidate['sheets'].keys(): raise ValueError('CANDIDATE_SHEET_MISMATCH')
    if any(raw['sheets'][k]['rows']!=candidate['sheets'][k]['rows'] for k in raw['sheets']): raise ValueError('CANDIDATE_CHANGED_VALUES')
    xlsx=[p for p in paths if p.suffix.lower()=='.xlsx']
    if len(xlsx)!=1: raise ValueError('WORKBOOK_REQUIRED')
    book=openpyxl.load_workbook(xlsx[0],read_only=True,data_only=True)
    def norm(v):
        if v is None: return ''
        if isinstance(v,dict) and v.get('type')=='date': return datetime.datetime.fromisoformat(v['iso'].replace('Z','+00:00')).timestamp()
        if isinstance(v,datetime.datetime): return v.replace(tzinfo=ZoneInfo(raw['timeZone'])).timestamp() if v.tzinfo is None else v.timestamp()
        return v
    mismatch=0
    if set(book.sheetnames)!=set(raw['sheets']): raise ValueError('WORKBOOK_SHEET_MISMATCH')
    for name,sheet in raw['sheets'].items():
        rows=list(book[name].values); expected=[sheet['headers']]+sheet['rows']
        while rows and all(v is None for v in rows[-1]): rows.pop()
        while expected and all(v=='' or v is None for v in expected[-1]): expected.pop()
        if len(rows)!=len(expected): mismatch+=1; continue
        for r,e in zip(rows,expected):
            width=max(len(r),len(e)); rr=list(r)+[None]*(width-len(r)); ee=list(e)+[None]*(width-len(e))
            mismatch+=sum(norm(a)!=norm(b) for a,b in zip(rr,ee))
    book.close()
    byid={}; photo_mismatch=0; photo_bytes=0; copied_ids=0; zero=0
    for c in catalog:
        if c['id'] in byid: raise ValueError('DUPLICATE_PHOTO_SOURCE_ID')
        byid[c['id']]=c
        # Catalog path can include a folder prefix. Resolve within this private package.
        relative=str(c['path']).replace('\\','/')
        matches=[p for p in paths if p.is_file() and (p.relative_to(root).as_posix().endswith(relative) or p.name==pathlib.PurePosixPath(relative).name)]
        if len(matches)!=1: raise ValueError('PHOTO_PATH_MISSING_OR_AMBIGUOUS')
        data=matches[0].read_bytes(); photo_bytes+=len(data); zero+=not len(data)
        photo_mismatch+=hashlib.sha256(data).hexdigest()!=c['sha256'] or len(data)!=c['size']
        copied_ids+=c['id']!=c['backupId']
    source_ref=[]
    for row in candidate['sheets']['일기기록']['rows']:
        if all(x=='' or x is None for x in row): continue
        for ordinal,url in enumerate(json.loads(row[11] or '[]')):
            match=re.match(r'^https://drive\.google\.com/thumbnail\?id=([\w-]+)(?:&|$)',url)
            if not match: raise ValueError('PHOTO_PROVIDER_REVIEW_REQUIRED')
            source_ref.append((row[0],ordinal,match[1],url))
    manifest=[(f['diaryId'],f['ordinal'],f['id'],f['sourceUrl']) for f in raw['files']]
    mapping_mismatch=sum(x not in manifest for x in source_ref)+sum(x not in source_ref for x in manifest)
    missing=sum(x[2] not in byid for x in source_ref)
    def nonempty(entity): return [r for r in candidate['sheets'][entity]['rows'] if any(v!='' and v is not None for v in r)]
    accounts=nonempty('학생계정'); names={r[0] for r in accounts}
    diaries={r[0] for r in nonempty('일기기록')}; posts={r[0] for r in nonempty('게시판')}
    counts={k:len(nonempty(k)) for k in raw['sheets']}
    report={
        'format':1,'source':'owner-uploaded-private-zip','capturedAt':raw['capturedAt'],
        'sheetCount':len(raw['sheets']),'rowCounts':counts,'physicalRowCounts':{k:len(v['rows']) for k,v in raw['sheets'].items()},'workbookCellMismatches':mismatch,
        'canonicalCandidateChangedValues':False,'headerDriftSheets':sum(raw['sheets'][k]['headers']!=candidate['sheets'][k]['headers'] for k in raw['sheets']),
        'semanticMappingReviewed':False,'positionChecksRequireCurrentCodeConfirmation':True,
        'accounts':{'total':len(accounts),'students':sum(r[2]=='학생' for r in accounts),'teachers':sum(r[2]=='선생님' for r in accounts),'existingSha256Pins':sum(isinstance(r[1],str) and r[1].startswith('sha256$') for r in accounts),'blankTeacherClass':sum(r[2]=='선생님' and not r[3] for r in accounts)},
        'photos':{'files':len(catalog),'bytes':photo_bytes,'originalToCopyIdChanges':copied_ids,'checksumOrSizeMismatches':photo_mismatch,'references':len(source_ref),'uniqueReferenced':len({x[2] for x in source_ref}),'missingReferenced':missing,'manifestMappingMismatches':mapping_mismatch,'unreferenced':len(set(byid)-{x[2] for x in source_ref}),'zeroByteUnreferenced':sum(c['size']==0 for c in catalog if c['id'] not in {x[2] for x in source_ref})},
        'sourceRelationshipIssues':{'diaryCommentWithoutDiary':sum(r[1] not in diaries for r in nonempty('선생님댓글')),'boardCommentWithoutPost':sum(r[1] not in posts for r in nonempty('게시판댓글')),'likeWithoutPost':sum(r[0] not in posts for r in nonempty('게시판좋아요')),'praiseWithoutIdOrActors':sum(not r[0] and not r[1] and not r[2] for r in nonempty('칭찬메시지'))},
        'sourceWrites':False,'imported':False,'finalDeltaAcquired':False
    }
    if mismatch or photo_mismatch or missing or mapping_mismatch: raise ValueError('SOURCE_PACKAGE_COMPARISON_FAILED')
    (root/'audit-report.private.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (root/'audit-report.private.json').chmod(0o600)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('folder');args=parser.parse_args()
    try: print(json.dumps(audit(args.folder),ensure_ascii=False,indent=2))
    except Exception:
        # Paths, rows and parser messages can contain private data.
        raise SystemExit('PRIVATE_SOURCE_AUDIT_FAILED: inspect input privately; no source data logged')
