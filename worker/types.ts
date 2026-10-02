export interface Env {DB:D1Database;LOGIN_KDF?:DurableObjectNamespace;PHOTOS:R2Bucket;ASSETS?:Fetcher;WEB_ORIGINS:string;APP_URL:string;PUSH_MODE:string;ALLOW_LIVE_PUSH?:string;PUSH_SERVER_URL?:string;PUSH_SERVER_SECRET?:string;TEST_MODE?:string;LOGIN_DIAGNOSTICS?:string;TEST_SEED_KEY?:string;}
export type Row=Record<string,any>;
export type Account={id:string;display_name:string;role:'student'|'teacher';class_id:string;label:string};
export class AppError extends Error {constructor(public code:string,public status=400){super(code);}}
