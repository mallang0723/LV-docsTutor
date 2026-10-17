for (const name of ['backend','frontend']) {
  const result=await Bun.build({entrypoints:[`src/${name}.ts`],outdir:'dist',target:name==='backend'?'bun':'browser',format:'esm',minify:false});
  if(!result.success)throw new Error(result.logs.join('\n'));
}
