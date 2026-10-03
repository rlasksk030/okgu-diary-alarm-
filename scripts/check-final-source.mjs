import {readFile,writeFile,realpath,mkdir} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {cutoverProof} from '../migration/source/cutover-proof.mjs';
try{
 const local=await realpath('.local');async function load(p){const file=await realpath(p);if(!file.startsWith(local+path.sep))throw Error('PRIVATE_PATH_REQUIRED');return {file,raw:JSON.parse(await readFile(file))};}
 const first=await load(process.argv[2]),second=await load(process.argv[3]),evidence=await load(process.argv[4]);
 for(const capture of [first,second])for(const photo of capture.raw.photos||[]){const file=await realpath(path.resolve(path.dirname(capture.file),photo.path));if(!file.startsWith(path.dirname(capture.file)+path.sep))throw Error('PRIVATE_PHOTO_PATH');const data=await readFile(file);if(data.length!==photo.size||createHash('sha256').update(data).digest('hex')!==photo.sha256)throw Error('FINAL_PHOTO_BYTES_MISMATCH');}
 const result=cutoverProof(first.raw,second.raw,evidence.raw);await mkdir('.local/source-review',{recursive:true,mode:0o700});await writeFile('.local/source-review/final-source-proof.private.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result));
}catch(e){console.error(/^[A-Z_]+$/.test(e.message)?e.message:'FINAL_SOURCE_CHECK_FAILED');process.exitCode=1;}
