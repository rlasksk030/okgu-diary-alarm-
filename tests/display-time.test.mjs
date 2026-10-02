import test from 'node:test';
import assert from 'node:assert/strict';
import {entry,relativeTime,savedTime} from '../worker/store.ts';

test('diary save labels preserve original Korean format across KST midnight, noon and year boundary',()=>{
 for(const [instant,label] of [['2026-10-02T15:04:00Z','10월 3일 오전 12:04'],['2026-10-03T03:05:00Z','10월 3일 오후 12:05'],['2026-12-31T15:06:00Z','1월 1일 오전 12:06']]){
  const timestamp=Date.parse(instant);assert.equal(savedTime(timestamp),label);
  assert.equal(entry({updated_at:timestamp,visibility:'teacher'}).savedTime,label);
 }
});

test('comment and praise age labels preserve the main server wording and boundaries',()=>{
 const now=Date.parse('2026-10-03T01:00:00Z');
 for(const [seconds,label] of [[0,'방금'],[59,'방금'],[60,'1분 전'],[3599,'59분 전'],[3600,'1시간 전'],[86399,'23시간 전'],[86400,'어제'],[172799,'어제'],[172800,'10월 1일']])assert.equal(relativeTime(now-seconds*1000,now),label);
});
