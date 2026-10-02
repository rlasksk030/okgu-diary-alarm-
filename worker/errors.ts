// Closed categories only: never expose provider messages, SQL, PINs or tokens.
export function unexpectedCategory(error:unknown){
 const message=error instanceof Error?error.message:'';
 if(/PBKDF2/i.test(message)&&/iteration|count|limit/i.test(message))return 'CRYPTO_ITERATION_LIMIT';
 if(/PBKDF2/i.test(message))return 'CRYPTO_PBKDF2';
 if(/no such table/i.test(message))return 'DATABASE_MISSING_TABLE';
 if(/no such column/i.test(message))return 'DATABASE_MISSING_COLUMN';
 if(/binding|parameter/i.test(message)&&/D1|SQLITE/i.test(message))return 'DATABASE_BINDING';
 if(/D1_ERROR|SQLITE/i.test(message))return 'DATABASE_OTHER';
 if(error instanceof TypeError)return 'TYPE_ERROR';
 if(error instanceof RangeError)return 'RANGE_ERROR';
 return 'UNCLASSIFIED';
}
