import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function verifiedGuardOnly(base,candidate,review){
 base=base.replace(/\r\n?/g,'\n');candidate=candidate.replace(/\r\n?/g,'\n');
 const marker=/\n  _okguAssertWritable_\(\);/g;
 if(review.currentDeploymentMatchesVerifiedFreezeCandidate!==true||[...candidate.matchAll(marker)].length!==28)return false;
 const unguarded=candidate.replace(marker,'').replace(/\nfunction _okguAssertWritable_\(\)\{if\(PropertiesService\.getScriptProperties\(\)\.getProperty\('OKGU_WRITE_PAUSED'\)==='yes'\)throw new Error\('자료 이전 점검 중입니다\. 작성 내용을 보관하고 잠시 후 다시 시도해 주세요\.'\);\}\n$/,'');
 return unguarded===base&&review.beforeFreezeNormalizedSha256===hash(base)&&review.deployedCodeNormalizedSha256===hash(candidate);
}
