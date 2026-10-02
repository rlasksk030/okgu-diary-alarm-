import test from 'node:test';import assert from 'node:assert/strict';
import {unexpectedCategory} from '../worker/errors.ts';
test('trial diagnostics classify infrastructure faults without leaking messages, SQL or credentials',()=>{
 for(const [error,expected] of [[new Error('PBKDF2 iterations exceed limit: private-PIN'),'CRYPTO_ITERATION_LIMIT'],[new Error('D1_ERROR: SQL private diary content SQLITE_CONSTRAINT'),'DATABASE_OTHER'],[new TypeError('private token'),'TYPE_ERROR'],[new Error('private token'),'UNCLASSIFIED'],[{message:'secret'},'UNCLASSIFIED']])assert.equal(unexpectedCategory(error),expected);
});
