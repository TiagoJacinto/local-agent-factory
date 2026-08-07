import { spawnSync } from "node:child_process"; import { resolve } from "node:path";
function git(...args:string[]){const r=spawnSync("git",args,{encoding:"utf8"});if(r.status!==0)throw new Error(`git ${args.join(" ")} failed: ${(r.stderr||"").trim()}`);return (r.stdout||"").trim();}
export function isRepo(){return spawnSync("git",["rev-parse","--git-dir"],{encoding:"utf8"}).status===0;}
export function repoRoot(){return isRepo()?resolve(git("rev-parse","--show-toplevel")):resolve(process.cwd());}
export function currentBranch(){return git("rev-parse","--abbrev-ref","HEAD");}
export function rev(ref="HEAD"){return git("rev-parse",ref);} export function shortSha(ref="HEAD"){return git("rev-parse","--short",ref);}
export function refExists(ref:string){return spawnSync("git",["rev-parse","--verify","--quiet",`${ref}^{commit}`],{encoding:"utf8"}).status===0;}
export function mergeBase(ref:string,other="HEAD"){return git("merge-base",ref,other);} export function isDirty(){return !!git("status","--porcelain");}
export function untrackedFiles(){return git("ls-files","--others","--exclude-standard").split("\n").filter(Boolean);}
export function diffFiles(base:string){return git("diff","--name-only",base).split("\n").filter(Boolean);} export function diffStat(base:string){return git("diff","--stat",base);}
export function diffText(base:string){return git("diff",base);}
export function diffCounts(base:string){let a=0,d=0;for(const l of git("diff","--numstat",base).split("\n")){const [x,y]=l.split("\t");if(/^\d+$/.test(x||""))a+=+x;if(/^\d+$/.test(y||""))d+=+y;}return [a,d] as const;}
export function changedFiles(){return git("status","--porcelain").split("\n").filter(Boolean).map(x=>x.slice(3));}
export function commitAll(message:string){if(!isRepo())throw new Error("not a git repository — a commit phase needs one");git("add","-A");if(!git("status","--porcelain"))throw new Error("nothing to commit — preceding phases changed no files");git("commit","-m",message);return shortSha();}
