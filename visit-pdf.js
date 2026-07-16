/* Planning-GJsystems - dynamische winkelbezoek-PDF generator */
(function(root,factory){
  const api=factory(root?.jspdf?.jsPDF||null);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GJ_VISIT_PDF=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(browserJsPDF){
  'use strict';

  const chainProfiles={
    bijenkorf:{displayName:'de Bijenkorf',aliases:['bijenkorf','de bijenkorf'],primary:[171,132,62],secondary:[27,27,27],soft:[247,243,234],logo:null},
    scapino:{displayName:'Scapino',aliases:['scapino'],primary:[211,21,34],secondary:[36,36,36],soft:[253,239,240],logo:null},
    inno:{displayName:'INNO',aliases:['inno','galeria inno'],primary:[0,105,105],secondary:[11,47,48],soft:[231,245,244],logo:null},
    intersport:{displayName:'INTERSPORT',aliases:['intersport'],primary:[0,82,156],secondary:[221,31,45],soft:[233,242,250],logo:null},
    van_tilburg_sport:{displayName:'Van Tilburg Sport',aliases:['van tilburg sport','van tilburg'],primary:[35,35,35],secondary:[191,157,91],soft:[245,242,235],logo:null},
    van_haren:{displayName:'Van Haren',aliases:['van haren','vanharen'],primary:[4,20,37],secondary:[232,85,34],soft:[238,243,248],banner:{x:0,y:0,w:512,h:116}},
    bomont:{displayName:'Bomont',aliases:['bomont'],primary:[28,28,28],secondary:[179,153,119],soft:[246,243,238],banner:{x:768,y:0,w:512,h:116}},
    daka:{displayName:'DAKA',aliases:['daka'],primary:[211,0,27],secondary:[25,25,25],soft:[253,238,240],banner:{x:0,y:256,w:512,h:116}},
    e5:{displayName:'E5',aliases:['e5','e5 mode'],primary:[21,21,21],secondary:[190,151,91],soft:[245,243,239],banner:{x:768,y:256,w:512,h:116}},
    molecule:{displayName:'Molecule',aliases:['molecule'],primary:[244,183,0],secondary:[42,42,42],soft:[255,249,225],banner:{x:0,y:512,w:512,h:116}},
    torfs:{displayName:'Torfs',aliases:['torfs'],primary:[52,52,52],secondary:[246,190,0],soft:[248,243,235],banner:{x:768,y:512,w:512,h:116}},
    veritas:{displayName:'Veritas',aliases:['veritas'],primary:[30,30,30],secondary:[132,188,38],soft:[242,247,235],banner:{x:0,y:768,w:512,h:116}},
    berden:{displayName:'Berden',aliases:['berden'],primary:[0,70,42],secondary:[181,151,93],soft:[237,246,241],banner:{x:768,y:768,w:512,h:116}},
    stichd:{displayName:'stichd',aliases:[],primary:[10,23,48],secondary:[245,102,0],soft:[244,246,249],logo:null}
  };
  const bannerSprite='assets/chain-banners.png';

  const clean=value=>String(value??'').replace(/[\x00-\x1f]+/g,' ').replace(/\s+/g,' ').trim();
  const normalizeChain=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function resolveChainProfile(chain){
    const normalized=normalizeChain(chain);
    if(normalized){
      for(const [key,profile] of Object.entries(chainProfiles)){
        if(key==='stichd')continue;
        if(profile.aliases.some(alias=>normalized===alias||normalized.includes(alias)))return {key,profile,normalized};
      }
    }
    return {key:'stichd',profile:chainProfiles.stichd,normalized};
  }
  function safeFilename(value){return clean(value||'rapport').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80)}
  function displayDate(value){
    const v=clean(value);const m=v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:v;
  }
  function formatGeneratedDate(value){
    const d=value?new Date(value):new Date();
    return Number.isNaN(d.getTime())?clean(value):d.toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  function value(report,...keys){
    for(const key of keys){const v=report?.[key];if(v!==undefined&&v!==null&&clean(v)!=='')return clean(v)}
    return '';
  }
  function buildDetailFields(report){
    const address=[value(report,'street','address'),value(report,'houseNumber')].filter(Boolean).join(' ');
    const city=[value(report,'postalCode'),value(report,'city')].filter(Boolean).join(' ');
    return [
      ['Adres',address],['Postcode en plaats',city],['Contactpersoon',value(report,'contactPerson')],
      ['Bezoeker',value(report,'visitor')],['Bezoekdatum',displayDate(value(report,'visitDate','date'))],
      ['Activiteit',value(report,'activity')],['Status',value(report,'status')],
      ['Reden niet uitgevoerd',value(report,'reason')],
      ['Vervolgactie',value(report,'followUp')],['Opmerkingen',value(report,'remarks')]
    ].filter(([,v])=>v);
  }
  function buildTextSections(report){
    const candidates=[
      ['Bevindingen en samenvatting',value(report,'summary','findings')],
      ['Uitgevoerde werkzaamheden',value(report,'workPerformed')],
      ['Aandachtspunten',value(report,'attentionPoints')],
      ['Vervolgactie',value(report,'followUp')]
    ];
    const seen=new Set();
    return candidates.filter(([,text])=>{
      const key=normalizeChain(text);if(!text||seen.has(key))return false;seen.add(key);return true;
    });
  }
  function getJsPDF(explicit){
    if(explicit)return explicit;
    if(browserJsPDF)return browserJsPDF;
    try{return require('jspdf').jsPDF}catch(_){throw new Error('PDF-bibliotheek is niet beschikbaar.')}
  }
  let bannerImagePromise=null;
  function loadBannerSprite(source=bannerSprite){
    if(typeof Image==='undefined')return Promise.reject(new Error('Bannerafbeeldingen zijn alleen in de browser beschikbaar.'));
    if(!bannerImagePromise)bannerImagePromise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('De ketenbanner kon niet worden geladen.'));image.src=source});
    return bannerImagePromise;
  }
  async function prepareReportAssets(report,options={}){
    const resolved=resolveChainProfile(value(report,'chain')),banner=resolved.profile.banner;
    if(!banner||typeof document==='undefined')return report;
    try{
      const image=await loadBannerSprite(options.bannerSource||bannerSprite),canvas=document.createElement('canvas');
      canvas.width=banner.w;canvas.height=banner.h;
      const context=canvas.getContext('2d');context.drawImage(image,banner.x,banner.y,banner.w,banner.h,0,0,banner.w,banner.h);
      return {...report,bannerImage:canvas.toDataURL('image/jpeg',.94)};
    }catch(error){console.warn('Ketenbanner niet beschikbaar:',error.message);return report}
  }
  function textColor(doc,color){doc.setTextColor(color[0],color[1],color[2])}
  function fillColor(doc,color){doc.setFillColor(color[0],color[1],color[2])}
  function drawHeader(doc,report,profile){
    const pageW=doc.internal.pageSize.getWidth();
    if(report.bannerImage){
      doc.setFillColor(255,255,255);doc.rect(0,0,pageW,52,'F');
      doc.addImage(report.bannerImage,'JPEG',14,6,182,41.2,undefined,'FAST');
      doc.setDrawColor(profile.secondary[0],profile.secondary[1],profile.secondary[2]);doc.setLineWidth(.6);doc.line(14,49.5,196,49.5);
      return 54;
    }
    fillColor(doc,profile.primary);doc.rect(0,0,pageW,42,'F');
    fillColor(doc,profile.secondary);doc.rect(pageW-10,0,10,42,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(profile.displayName.length>17?18:23);doc.setTextColor(255,255,255);
    doc.text(profile.displayName,14,18,{maxWidth:76});
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('WINKELBEZOEKRAPPORT',14,29);
    const store=value(report,'storeName','customerName')||'Onbekende klant';
    const branch=value(report,'branch');const place=value(report,'city');
    doc.setFont('helvetica','bold');doc.setFontSize(store.length>30?11:14);doc.text(store,96,14,{maxWidth:99});
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    const location=[branch&&branch!==store?branch:'',place].filter(Boolean).join(' - ');
    if(location)doc.text(location,96,21,{maxWidth:99});
    const visitDate=displayDate(value(report,'visitDate','date'));
    if(visitDate)doc.text(visitDate,96,28);
    const status=value(report,'status');
    if(status){
      const notDone=normalizeChain(status).includes('niet uitgevoerd');
      fillColor(doc,notDone?[157,45,45]:[30,122,73]);doc.roundedRect(156,31,39,7,2,2,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(255,255,255);doc.text(status,175.5,35.7,{align:'center',maxWidth:36});
    }
    return 42;
  }
  function drawSectionTitle(doc,title,y,profile){
    doc.setFont('helvetica','bold');doc.setFontSize(10);textColor(doc,profile.primary);doc.text(title.toUpperCase(),14,y);
    doc.setDrawColor(profile.secondary[0],profile.secondary[1],profile.secondary[2]);doc.setLineWidth(.55);doc.line(14,y+2.4,196,y+2.4);
  }
  function drawDetails(doc,report,y,profile){
    const fields=buildDetailFields(report);if(!fields.length)return y;
    const columns=[[],[]];fields.forEach((item,index)=>columns[index%2].push(item));
    const rowHeights=columns.map(col=>col.map(([,v])=>Math.max(6,doc.splitTextToSize(v,60).length*4.1+1)));
    const boxH=Math.max(22,...rowHeights.map(rows=>rows.reduce((a,b)=>a+b,0)+14));
    drawSectionTitle(doc,'Bezoekgegevens',y,profile);y+=6;
    fillColor(doc,profile.soft);doc.setDrawColor(222,226,233);doc.roundedRect(14,y,182,boxH,2.5,2.5,'FD');
    columns.forEach((col,colIndex)=>{
      const x=20+colIndex*89;let cy=y+9;
      col.forEach(([label,val],rowIndex)=>{
        doc.setFont('helvetica','bold');doc.setFontSize(7.2);textColor(doc,profile.primary);doc.text(label,x,cy);
        doc.setFont('helvetica','normal');doc.setFontSize(8.4);doc.setTextColor(35,40,47);
        const lines=doc.splitTextToSize(val,58);doc.text(lines,x+27,cy,{lineHeightFactor:1.15});cy+=rowHeights[colIndex][rowIndex];
      });
    });
    return y+boxH+7;
  }
  function imageData(photo){return typeof photo==='string'?photo:(photo?.data||photo?.dataUrl||'')}
  function imageDimensions(doc,data,photo){
    if(Number(photo?.width)>0&&Number(photo?.height)>0)return {width:Number(photo.width),height:Number(photo.height)};
    try{const p=doc.getImageProperties(data);return {width:Number(p.width)||4,height:Number(p.height)||3}}catch(_){return {width:4,height:3}}
  }
  function drawImageCover(doc,photo,x,y,w,h){
    const data=imageData(photo);if(!data)return false;
    try{
      const size=imageDimensions(doc,data,photo),canClip=typeof doc.saveGraphicsState==='function'&&typeof doc.clip==='function'&&typeof doc.restoreGraphicsState==='function',scale=canClip?Math.max(w/size.width,h/size.height):Math.min(w/size.width,h/size.height),iw=size.width*scale,ih=size.height*scale;
      doc.setFillColor(246,248,251);doc.rect(x,y,w,h,'F');
      if(canClip){doc.saveGraphicsState();doc.rect(x,y,w,h);doc.clip();doc.discardPath?.()}
      doc.addImage(data,photo?.format||undefined,x+(w-iw)/2,y+(h-ih)/2,iw,ih,undefined,'FAST');
      if(canClip)doc.restoreGraphicsState();
      doc.setDrawColor(220,224,230);doc.rect(x,y,w,h,'S');return true;
    }catch(_){return false}
  }
  function photoLayout(count,x,y,w,maxH){
    const gap=3.5,items=[];
    if(count===1){const h=Math.min(maxH,78);items.push({x,y,w,h});return {items,height:h}}
    if(count===2){const h=Math.min(maxH,57),cw=(w-gap)/2;return {items:[{x,y,w:cw,h},{x:x+cw+gap,y,w:cw,h}],height:h}}
    if(count===3){const top=Math.min(39,maxH*.46),bottom=Math.min(42,maxH-top-gap),cw=(w-gap)/2;return {items:[{x,y,w:cw,h:top},{x:x+cw+gap,y,w:cw,h:top},{x:x+w*.18,y:y+top+gap,w:w*.64,h:bottom}],height:top+gap+bottom}}
    const cols=count<=4?2:(count<=6?3:4),rows=Math.ceil(count/cols),cw=(w-gap*(cols-1))/cols,ch=Math.min(count<=4?37:31,(maxH-gap*(rows-1))/rows);
    for(let i=0;i<count;i++)items.push({x:x+(i%cols)*(cw+gap),y:y+Math.floor(i/cols)*(ch+gap),w:cw,h:ch});
    return {items,height:rows*ch+(rows-1)*gap};
  }
  function drawPhotoBlock(doc,photos,y,profile,maxH=82){
    if(!photos.length)return y;
    drawSectionTitle(doc,`Foto's (${photos.length})`,y,profile);y+=9;
    const layout=photoLayout(photos.length,14,y,182,maxH);
    photos.forEach((photo,index)=>drawImageCover(doc,photo,layout.items[index].x,layout.items[index].y,layout.items[index].w,layout.items[index].h));
    return y+layout.height+11;
  }
  function addPage(doc,report,profile){
    doc.addPage();doc.setFillColor(255,255,255);doc.rect(0,0,doc.internal.pageSize.getWidth(),doc.internal.pageSize.getHeight(),'F');
    return drawHeader(doc,report,profile)+8;
  }
  function drawTextSections(doc,report,sections,y,profile){
    const bottom=275;
    for(const [title,text] of sections){
      if(y>bottom-20)y=addPage(doc,report,profile);
      drawSectionTitle(doc,title,y,profile);y+=7;
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(32,37,44);
      let lines=doc.splitTextToSize(text,178);
      while(lines.length){
        const capacity=Math.max(1,Math.floor((bottom-y)/4.45));
        doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(32,37,44);
        const chunk=lines.splice(0,capacity);doc.text(chunk,16,y,{lineHeightFactor:1.22});y+=chunk.length*4.45+4;
        if(lines.length){y=addPage(doc,report,profile);drawSectionTitle(doc,`${title} - vervolg`,y,profile);y+=7}
      }
    }
    return y;
  }
  function drawFooter(doc,page,total,generatedAt,profile){
    const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight();
    doc.setDrawColor(profile.secondary[0],profile.secondary[1],profile.secondary[2]);doc.setLineWidth(.4);doc.line(14,pageH-15,pageW-14,pageH-15);
    doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(85,90,98);
    doc.text('Planning-GJsystems  -  Stichd',14,pageH-8);
    doc.text(`Gegenereerd: ${formatGeneratedDate(generatedAt)}`,pageW/2,pageH-8,{align:'center'});
    doc.text(`Pagina ${page} van ${total}`,pageW-14,pageH-8,{align:'right'});
  }
  function createDocument(report,options={}){
    const JsPDF=getJsPDF(options.jsPDF),doc=new JsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    const resolved=resolveChainProfile(value(report,'chain')),{profile}=resolved;
    const photos=(report.photos||[]).filter(p=>imageData(p));
    const headerBottom=drawHeader(doc,report,profile);
    let y=drawDetails(doc,report,headerBottom+8,profile);
    const firstPhotos=photos.slice(0,8),remainingPhotos=photos.slice(8);
    if(firstPhotos.length){
      const wanted=firstPhotos.length<=2?65:82;
      if(y+wanted>216)y=addPage(doc,report,profile);
      y=drawPhotoBlock(doc,firstPhotos,y,profile,wanted);
    }
    y=drawTextSections(doc,report,buildTextSections(report),y,profile);
    for(let offset=0;offset<remainingPhotos.length;offset+=8){
      y=addPage(doc,report,profile);
      y=drawPhotoBlock(doc,remainingPhotos.slice(offset,offset+8),y,profile,198);
    }
    const total=doc.getNumberOfPages();
    for(let page=1;page<=total;page++){doc.setPage(page);drawFooter(doc,page,total,report.generatedAt,profile)}
    const fileName=`Winkelbezoek_${safeFilename(displayDate(value(report,'visitDate','date')))}_${safeFilename(value(report,'storeName','customerName')||'Klant')}.pdf`;
    return {doc,fileName,pageCount:total,profileKey:resolved.key,photoCount:photos.length};
  }
  function openOrDownload(result,options={}){
    const blob=result.doc.output('blob'),url=URL.createObjectURL(blob),isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
    if(options.previewWindow&&!options.previewWindow.closed)options.previewWindow.location.href=url;
    else if(isIOS||options.open===true){const opened=window.open(url,'_blank','noopener');if(!opened)window.location.href=url}
    else result.doc.save(result.fileName);
    setTimeout(()=>URL.revokeObjectURL(url),options.revokeDelay??60000);return result;
  }
  return {chainProfiles,normalizeChain,resolveChainProfile,buildDetailFields,buildTextSections,prepareReportAssets,createDocument,openOrDownload,safeFilename};
});
