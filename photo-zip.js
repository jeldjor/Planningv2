/* Planning-GJsystems v11.3.5 — bezoekfoto's als één ZIP-bestand. */
(()=>{
  'use strict';

  const encoder=new TextEncoder();
  const crcTable=(()=>{
    const table=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let value=n;
      for(let bit=0;bit<8;bit++)value=(value&1)?(0xedb88320^(value>>>1)):(value>>>1);
      table[n]=value>>>0;
    }
    return table;
  })();

  function crc32(bytes){
    let crc=0xffffffff;
    for(const byte of bytes)crc=crcTable[(crc^byte)&0xff]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }

  function safeName(value,fallback='foto'){
    const cleaned=String(value||fallback).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');
    return cleaned||fallback;
  }

  function extension(photo,blob,index){
    const source=String(photo?.name||photo?.path||'').split('?')[0],match=source.match(/\.([a-zA-Z0-9]{2,5})$/);
    if(match)return match[1].toLowerCase()==='jpeg'?'jpg':match[1].toLowerCase();
    const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif','image/gif':'gif'};
    return types[String(blob?.type||'').toLowerCase()]||`jpg`;
  }

  function dosDateTime(dateValue){
    const date=dateValue?new Date(dateValue):new Date(),year=Math.max(1980,date.getFullYear());
    return {
      time:((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|((Math.floor(date.getSeconds()/2))&31),
      date:(((year-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31)
    };
  }

  function concat(parts,total){
    const output=new Uint8Array(total);let offset=0;
    for(const part of parts){output.set(part,offset);offset+=part.length}
    return output;
  }

  function zipStore(files){
    const localParts=[],centralParts=[];let localSize=0,centralSize=0;
    for(const file of files){
      const name=encoder.encode(file.name),bytes=file.bytes,crc=crc32(bytes),stamp=dosDateTime(file.modified);
      const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0,true);lv.setUint16(8,0,true);
      lv.setUint16(10,stamp.time,true);lv.setUint16(12,stamp.date,true);lv.setUint32(14,crc,true);
      lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);lv.setUint16(26,name.length,true);lv.setUint16(28,0,true);local.set(name,30);
      localParts.push(local,bytes);

      const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);cv.setUint16(10,0,true);
      cv.setUint16(12,stamp.time,true);cv.setUint16(14,stamp.date,true);cv.setUint32(16,crc,true);
      cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);
      cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,localSize,true);central.set(name,46);
      centralParts.push(central);centralSize+=central.length;localSize+=local.length+bytes.length;
    }
    const end=new Uint8Array(22),ev=new DataView(end.buffer);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
    ev.setUint32(12,centralSize,true);ev.setUint32(16,localSize,true);ev.setUint16(20,0,true);
    return new Blob([concat(localParts,localSize),concat(centralParts,centralSize),end],{type:'application/zip'});
  }

  async function photoBlob(client,photo){
    if(photo?.blob instanceof Blob)return photo.blob;
    if(photo?.path&&client?.storage){
      const result=await client.storage.from('visit-photos').download(photo.path);
      if(!result.error&&result.data)return result.data;
    }
    const url=photo?.url||photo?.data;
    if(url){const response=await fetch(url);if(response.ok)return response.blob()}
    throw new Error('Foto kon niet worden opgehaald.');
  }

  async function saveBlob(blob,fileName){
    const file=new File([blob],fileName,{type:'application/zip'});
    if(navigator.share&&navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:fileName});return}catch(error){if(error?.name==='AbortError')return}
    }
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=fileName;link.rel='noopener';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  async function download({client,photos,customerName,visitDate,subject,summary,onProgress}){
    const source=Array.isArray(photos)?photos.filter(Boolean):[];
    if(!source.length)throw new Error("Bij dit bezoek zijn geen foto's opgeslagen.");
    const report=[
      `Klant: ${String(customerName||'Klant').trim()}`,
      `Onderwerp: ${String(subject||'').trim()||'—'}`,
      `Datum bezoek: ${String(visitDate||'').trim()||'—'}`,
      '',
      'Samenvatting',
      String(summary||'').trim()||'—',
      ''
    ].join('\r\n');
    const files=[{name:'Bezoekverslag.txt',bytes:encoder.encode(report),modified:new Date()}],failed=[];
    for(let index=0;index<source.length;index++){
      onProgress?.(index,source.length);
      try{
        const blob=await photoBlob(client,source[index]),bytes=new Uint8Array(await blob.arrayBuffer()),ext=extension(source[index],blob,index);
        files.push({name:`foto-${String(index+1).padStart(2,'0')}.${ext}`,bytes,modified:source[index].created_at||source[index].createdAt});
      }catch(error){failed.push(index+1)}
    }
    if(!files.length)throw new Error("Geen van de foto's kon uit Supabase Storage worden opgehaald.");
    const base=[safeName(customerName,'klant'),safeName(visitDate,'bezoek')].filter(Boolean).join('_'),fileName=`${base}.zip`;
    onProgress?.(source.length,source.length);
    await saveBlob(zipStore(files),fileName);
    return{downloaded:files.length-1,failed,fileName};
  }

  window.GJPhotoZip={download,safeName,zipStore};
})();
