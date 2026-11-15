// Identifica o formato pelos bytes, sem confiar na extensão ou no MIME do navegador.
export function photoFormat(bytes){
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {type:'image/jpeg',extension:'.jpg'};
  if([137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))return {type:'image/png',extension:'.png'};
  return null;
}
export async function normalizePhoto(file){
  if(!(file instanceof File)||file.size<10||file.size>12*1024*1024)throw new Error('Envie uma foto JPEG/PNG com até 12 MB.');
  const format=photoFormat(new Uint8Array(await file.slice(0,12).arrayBuffer()));
  if(!format)throw new Error('O conteúdo deste arquivo não foi reconhecido como JPEG ou PNG. Abra a imagem e use Exportar/Salvar como JPEG ou PNG; alterar apenas o nome não converte a foto.');
  const matches=format.type==='image/png'?/\.png$/i.test(file.name):/\.jpe?g$/i.test(file.name);
  const name=matches?file.name:file.name.replace(/\.[^.]+$/,'')+format.extension;
  return new File([file],name,{type:format.type,lastModified:file.lastModified});
}
