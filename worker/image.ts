import {AppError} from './types';
const bad=()=>{throw new AppError('E_FILE_TYPE',415);};
const dimensions=(width:number,height:number)=>{if(!width||!height||width>4096||height>4096||width*height>16777216)bad();};
const crcTable=Uint32Array.from({length:256},(_,i)=>{let n=i;for(let b=0;b<8;b++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(b:Uint8Array,start:number,end:number){let value=0xffffffff;for(let i=start;i<end;i++)value=crcTable[(value^b[i])&255]^(value>>>8);return (value^0xffffffff)>>>0;}
// Structure/CRC/dimension validation. Browser canvas re-encodes photographs before upload.
export function inspectImage(buffer:ArrayBuffer){const b=new Uint8Array(buffer),view=new DataView(buffer);
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)){let pos=8,width=0,height=0,header=false,data=false;while(pos+12<=b.length){const size=view.getUint32(pos),end=pos+12+size;if(end>b.length)bad();const kind=String.fromCharCode(...b.slice(pos+4,pos+8));if(crc(b,pos+4,end-4)!==view.getUint32(end-4))bad();if(!header){if(kind!=='IHDR'||size!==13)bad();width=view.getUint32(pos+8);height=view.getUint32(pos+12);dimensions(width,height);header=true;}else if(kind==='IHDR')bad();if(kind==='IDAT')data=true;if(kind==='IEND'){if(size!==0||!data||end!==b.length)bad();return {mime:'image/png',width,height};}pos=end;}bad();}
 if(b[0]===255&&b[1]===216&&b[b.length-2]===255&&b[b.length-1]===217){let pos=2,width=0,height=0;while(pos<b.length-2){if(b[pos++]!==255)bad();while(b[pos]===255)pos++;const marker=b[pos++];if(marker===0||marker===216||marker===217)bad();if(marker>=208&&marker<=215)continue;if(pos+2>b.length)bad();const size=view.getUint16(pos);if(size<2||pos+size>b.length)bad();if([192,193,194].includes(marker)){if(size<8)bad();height=view.getUint16(pos+3);width=view.getUint16(pos+5);dimensions(width,height);}if(marker===218){if(!width||!height||pos+size>=b.length-2)bad();return {mime:'image/jpeg',width,height};}pos+=size;}bad();}
 return bad();
}
