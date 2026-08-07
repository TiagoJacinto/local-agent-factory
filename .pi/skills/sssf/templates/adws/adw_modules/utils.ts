import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
export function operatorEnv():Record<string,string>{const env={...process.env} as Record<string,string>; const v=env.VIRTUAL_ENV; if(v){delete env.VIRTUAL_ENV; env.PATH=(env.PATH||"").split(":").filter(p=>p!==`${v}/bin`).join(":");} return env;}
export function newId(length=8){return crypto.randomUUID().replaceAll("-","").slice(0,length);}
export function nowIso(){return new Date().toISOString();}
export function ensureDir(path:string){mkdirSync(path,{recursive:true});return path;}
export function resolvePrompt(arg:string){try{if(existsSync(arg)) return readFileSync(arg,"utf8");}catch{} return arg;}
export function engineerName(){if(process.env.ENGINEER_NAME?.trim())return process.env.ENGINEER_NAME.trim(); const r=spawnSync("git",["config","user.name"],{encoding:"utf8",timeout:5000}); return r.status===0&&r.stdout.trim()?r.stdout.trim():process.env.USER||"engineer";}
export function shellQuote(s:string){return `'${s.replaceAll("'","'\\''")}'`;}
export function commandString(argv:string[]){return argv.map(shellQuote).join(" ");}
