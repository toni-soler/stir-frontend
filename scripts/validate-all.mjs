import {spawnSync} from 'node:child_process';
for(const args of [['ci'],['test'],['run','i18n:validate'],['run','build']]) {
  const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{stdio:'inherit',shell:process.platform==='win32'});
  if(result.status!==0)process.exit(result.status||1);
}
