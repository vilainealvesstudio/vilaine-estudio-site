export function photoName(value,currentName,mimeType){
  const extension=String(currentName||'').match(/\.(jpe?g|png)$/i)?.[0]||(mimeType==='image/png'?'.png':'.jpg');
  const stem=String(value||'').trim().normalize('NFC').replace(/\.(jpe?g|png)$/i,'');
  const result=stem+extension;
  if(!stem||result.length>180||/[\u0000-\u001f\u007f]/.test(result))throw new Error('Use um nome de 1 a 180 caracteres, sem caracteres de controle.');
  return result;
}
