/* Planning-GJsystems - dynamische winkelbezoek-PDF generator */
(function(root,factory){
  const api=factory(root?.jspdf?.jsPDF||null);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GJ_VISIT_PDF=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(browserJsPDF){
  'use strict';

  const chainProfiles={
    bijenkorf:{displayName:'de Bijenkorf',aliases:['bijenkorf','de bijenkorf'],primary:[171,132,62],secondary:[27,27,27],soft:[247,243,234],banner:{source:'assets/chain-banners-core.png',x:0,y:0,w:1774,h:177}},
    scapino:{displayName:'Scapino',aliases:['scapino'],primary:[211,21,34],secondary:[36,36,36],soft:[253,239,240],banner:{source:'assets/chain-banners-core.png',x:0,y:177,w:1774,h:177}},
    inno:{displayName:'INNO',aliases:['inno','galeria inno'],primary:[0,105,105],secondary:[11,47,48],soft:[231,245,244],banner:{source:'assets/chain-banners-core.png',x:0,y:354,w:1774,h:177}},
    intersport:{displayName:'INTERSPORT',aliases:['intersport'],primary:[0,82,156],secondary:[221,31,45],soft:[233,242,250],banner:{source:'assets/chain-banners-core.png',x:0,y:531,w:1774,h:177}},
    van_tilburg_sport:{displayName:'Van Tilburg Sport',aliases:['van tilburg sport','van tilburg'],primary:[35,35,35],secondary:[191,157,91],soft:[245,242,235],banner:{source:'assets/chain-banners-core.png',x:0,y:708,w:1774,h:179}},
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
  function value(report,...keys){
    for(const key of keys){const v=report?.[key];if(v!==undefined&&v!==null&&clean(v)!=='')return clean(v)}
    return '';
  }
  function buildDetailFields(report){
    const store=value(report,'storeName','customerName')||'Onbekende klant';
    const branch=value(report,'branch');
    const address=[value(report,'street','address'),value(report,'houseNumber')].filter(Boolean).join(' ');
    const city=[value(report,'postalCode'),value(report,'city')].filter(Boolean).join(' ');
    const location=[branch&&normalizeChain(branch)!==normalizeChain(store)?branch:'',address,city].filter(Boolean).join(', ');
    return [
      ['Winkel',store],['Locatie',location],['Datum',displayDate(value(report,'visitDate','date'))],
      ['Activiteit',value(report,'activity')],['Bezoeker',value(report,'visitor')],
      ['Contactpersoon',value(report,'contactPerson')]
    ].filter(([,v])=>v);
  }
  function buildTextSections(report){
    const candidates=[
      ['Reden niet uitgevoerd',value(report,'reason')],
      ['Bevindingen en samenvatting',value(report,'summary','findings')],
      ['Uitgevoerde werkzaamheden',value(report,'workPerformed')],
      ['Aandachtspunten',value(report,'attentionPoints')],
      ['Vervolgactie',value(report,'followUp')],
      ['Opmerkingen',value(report,'remarks')]
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
  const bannerImagePromises=new Map();
  function loadBannerSprite(source=bannerSprite){
    if(typeof Image==='undefined')return Promise.reject(new Error('Bannerafbeeldingen zijn alleen in de browser beschikbaar.'));
    if(!bannerImagePromises.has(source))bannerImagePromises.set(source,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('De ketenbanner kon niet worden geladen.'));image.src=source}));
    return bannerImagePromises.get(source);
  }
  async function prepareReportAssets(report,options={}){
    const resolved=resolveChainProfile(value(report,'chain')),banner=resolved.profile.banner;
    if(typeof document==='undefined')return report;
    const prepared={...report};
    const cropPhoto=photo=>new Promise(resolve=>{
      const data=imageData(photo);if(!data){resolve(photo);return}
      const image=new Image();
      image.onload=()=>{
        try{
          const ratio=4/3,sourceW=image.naturalWidth||image.width,sourceH=image.naturalHeight||image.height,sourceRatio=sourceW/sourceH;
          let sx=0,sy=0,sw=sourceW,sh=sourceH;
          if(sourceRatio>ratio){sw=sourceH*ratio;sx=(sourceW-sw)/2}else if(sourceRatio<ratio){sh=sourceW/ratio;sy=(sourceH-sh)/2}
          const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1200;
          const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
          resolve({...photo,data:canvas.toDataURL('image/jpeg',.9),width:canvas.width,height:canvas.height,format:'JPEG',pdfCropped:true});
        }catch(_){resolve(photo)}
      };
      image.onerror=()=>resolve(photo);image.src=data;
    });
    prepared.photos=await Promise.all((report.photos||[]).map(cropPhoto));
    if(!banner)return prepared;
    try{
      const image=await loadBannerSprite(options.bannerSource||banner.source||bannerSprite),canvas=document.createElement('canvas');
      canvas.width=banner.w;canvas.height=banner.h;
      const context=canvas.getContext('2d');context.drawImage(image,banner.x,banner.y,banner.w,banner.h,0,0,banner.w,banner.h);
      return {...prepared,bannerImage:canvas.toDataURL('image/jpeg',.94)};
    }catch(error){console.warn('Ketenbanner niet beschikbaar:',error.message);return prepared}
  }
  function textColor(doc,color){doc.setTextColor(color[0],color[1],color[2])}
  function fillColor(doc,color){doc.setFillColor(color[0],color[1],color[2])}
  function drawHeader(doc,report,profile){
    const pageW=doc.internal.pageSize.getWidth();
    const bannerRatio=Number(profile.banner?.w)/Number(profile.banner?.h)||4.42;
    const headerH=report.bannerImage?Math.max(20,Math.min(48,pageW/bannerRatio)):44;
    if(report.bannerImage){
      doc.setFillColor(255,255,255);doc.rect(0,0,pageW,headerH,'F');
      doc.addImage(report.bannerImage,'JPEG',0,0,pageW,headerH,undefined,'FAST');
    }else{
      fillColor(doc,profile.primary);doc.rect(0,0,pageW,headerH,'F');
      fillColor(doc,profile.secondary);doc.rect(0,headerH-4,pageW,4,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(profile.displayName.length>17?20:27);doc.setTextColor(255,255,255);
      doc.text(profile.displayName,14,21,{maxWidth:150});
      doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.text('WINKELBEZOEKRAPPORT',12,33);
    }
    doc.setDrawColor(profile.secondary[0],profile.secondary[1],profile.secondary[2]);doc.setLineWidth(.7);doc.line(0,headerH,pageW,headerH);
    return headerH;
  }
  function drawReportIntro(doc,report,y,profile){
    const pageW=doc.internal.pageSize.getWidth(),status=value(report,'status');
    doc.setFont('helvetica','bold');doc.setFontSize(15);textColor(doc,profile.primary);doc.text('WINKELBEZOEKRAPPORT',14,y);
    if(status){
      const notDone=normalizeChain(status).includes('niet uitgevoerd'),badgeW=Math.min(38,Math.max(26,status.length*2.05));
      fillColor(doc,notDone?[157,45,45]:[30,122,73]);doc.roundedRect(pageW-14-badgeW,y-5.6,badgeW,7.2,1.8,1.8,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(6.6);doc.setTextColor(255,255,255);doc.text(status,pageW-14-badgeW/2,y-1,{align:'center',maxWidth:badgeW-3});
    }
    return y+10;
  }
  function drawSectionTitle(doc,title,y,profile){
    doc.setFont('helvetica','bold');doc.setFontSize(10);textColor(doc,profile.primary);doc.text(title.toUpperCase(),14,y);
    doc.setDrawColor(profile.secondary[0],profile.secondary[1],profile.secondary[2]);doc.setLineWidth(.55);doc.line(14,y+2.4,196,y+2.4);
  }
  function drawDetails(doc,report,y,profile){
    const fields=buildDetailFields(report);if(!fields.length)return y;
    const columns=3,cellW=56,rows=[];
    for(let index=0;index<fields.length;index+=columns)rows.push(fields.slice(index,index+columns));
    const rowHeights=rows.map(row=>Math.max(12,...row.map(([,v])=>doc.splitTextToSize(v,cellW-4).length*3.6+7)));
    const boxH=rowHeights.reduce((sum,height)=>sum+height,0)+8;
    fillColor(doc,profile.soft);doc.setDrawColor(222,226,233);doc.roundedRect(14,y,182,boxH,2.5,2.5,'FD');
    let rowY=y+7;
    rows.forEach((row,rowIndex)=>{
      row.forEach(([label,val],colIndex)=>{
        const x=20+colIndex*59;
        doc.setFont('helvetica','bold');doc.setFontSize(6.2);doc.setCharSpace(.35);textColor(doc,profile.primary);doc.text(label.toUpperCase(),x,rowY);doc.setCharSpace(0);
        doc.setFont('helvetica','bold');doc.setFontSize(8.4);doc.setTextColor(35,40,47);
        doc.text(doc.splitTextToSize(val,cellW-4),x,rowY+4.5,{lineHeightFactor:1.08});
      });
      rowY+=rowHeights[rowIndex];
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
      const size=imageDimensions(doc,data,photo),scale=photo?.pdfCropped?Math.max(w/size.width,h/size.height):Math.min(w/size.width,h/size.height),iw=size.width*scale,ih=size.height*scale;
      doc.setFillColor(246,248,251);doc.rect(x,y,w,h,'F');
      if(photo?.pdfCropped)doc.addImage(data,photo?.format||undefined,x,y,w,h,undefined,'FAST');
      else doc.addImage(data,photo?.format||undefined,x+(w-iw)/2,y+(h-ih)/2,iw,ih,undefined,'FAST');
      doc.setDrawColor(220,224,230);doc.rect(x,y,w,h,'S');return true;
    }catch(_){return false}
  }
  function photoLayout(count,x,y,w,maxH){
    const gap=3.5,items=[];
    if(count===1){const fw=Math.min(w,120),h=Math.min(maxH,72,fw*.75);items.push({x:x+(w-fw)/2,y,w:fw,h});return {items,height:h}}
    if(count===2){const h=Math.min(maxH,55),cw=(w-gap)/2;return {items:[{x,y,w:cw,h},{x:x+cw+gap,y,w:cw,h}],height:h}}
    if(count===3){const cw=(w-gap)/2,ch=Math.min(37,(maxH-gap)/2);return {items:[{x,y,w:cw,h:ch},{x:x+cw+gap,y,w:cw,h:ch},{x:x+(w-cw)/2,y:y+ch+gap,w:cw,h:ch}],height:ch*2+gap}}
    const cols=count===4?4:(count<=6?3:4),rows=Math.ceil(count/cols),cw=(w-gap*(cols-1))/cols,ch=Math.min(count===4?40:(count<=6?29:28),(maxH-gap*(rows-1))/rows);
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
  function drawFooter(doc,page,total,profile){
    const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight();
    doc.setDrawColor(profile.secondary[0],profile.secondary[1],profile.secondary[2]);doc.setLineWidth(.4);doc.line(14,pageH-15,pageW-14,pageH-15);
    doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(85,90,98);
    doc.text('GJsystems',14,pageH-8);
    doc.text(`Pagina ${page} van ${total}`,pageW-14,pageH-8,{align:'right'});
  }
  function createDocument(report,options={}){
    const JsPDF=getJsPDF(options.jsPDF),doc=new JsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    const resolved=resolveChainProfile(value(report,'chain')),{profile}=resolved;
    const photos=(report.photos||[]).filter(p=>imageData(p));
    const headerBottom=drawHeader(doc,report,profile);
    let y=drawReportIntro(doc,report,headerBottom+13,profile);
    y=drawDetails(doc,report,y,profile);
    y=drawTextSections(doc,report,buildTextSections(report),y,profile);
    const firstPhotos=photos.slice(0,8),remainingPhotos=photos.slice(8);
    if(firstPhotos.length){
      const wanted=firstPhotos.length<=2?65:82;
      const preview=photoLayout(firstPhotos.length,14,y+9,182,wanted),blockHeight=preview.height+20;
      if(y+blockHeight>274)y=addPage(doc,report,profile);
      y=drawPhotoBlock(doc,firstPhotos,y,profile,wanted);
    }
    for(let offset=0;offset<remainingPhotos.length;offset+=8){
      y=addPage(doc,report,profile);
      y=drawPhotoBlock(doc,remainingPhotos.slice(offset,offset+8),y,profile,198);
    }
    const total=doc.getNumberOfPages();
    for(let page=1;page<=total;page++){doc.setPage(page);drawFooter(doc,page,total,profile)}
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
