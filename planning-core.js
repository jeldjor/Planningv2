(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GJPlanningCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='11.3.0';
  const dayLocks=new Map();
  const pad=n=>String(n).padStart(2,'0');
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const toMinutes=value=>{
    if(value===null||value===undefined||value==='')return null;
    const match=String(value).match(/^(\d{1,2}):(\d{2})/);
    if(!match)return null;
    return Number(match[1])*60+Number(match[2]);
  };
  const fromMinutes=value=>{
    const minutes=Math.max(0,Math.round(number(value,0)));
    return `${pad(Math.floor(minutes/60)%24)}:${pad(minutes%60)}`;
  };
  const localIso=(date=new Date())=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const parseIso=value=>{
    const [year,month,day]=String(value||'').split('-').map(Number);
    return new Date(year,(month||1)-1,day||1);
  };
  const addDays=(iso,amount)=>{const date=parseIso(iso);date.setDate(date.getDate()+amount);return localIso(date)};
  const haversineKm=(a,b)=>{
    const lat1=number(a?.lat,NaN),lon1=number(a?.lng,NaN),lat2=number(b?.lat,NaN),lon2=number(b?.lng,NaN);
    if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return Infinity;
    const rad=value=>value*Math.PI/180,R=6371,dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
    const h=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
    return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  };
  const pointFromCustomer=customer=>({lat:number(customer?.lat??customer?.Latitude,NaN),lng:number(customer?.lng??customer?.Longitude,NaN)});
  const hasPoint=point=>{
    const lat=number(point?.lat,NaN),lng=number(point?.lng,NaN);
    return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  };
  const visitPoint=visit=>pointFromCustomer(visit.customer||visit);

  function absenceWindows(absences,date){
    const windows=[];
    for(const absence of absences||[]){
      const start=String(absence.start_date||absence.start||''),end=String(absence.end_date||absence.end||start);
      if(!start||date<start||date>end)continue;
      let from=0,to=1440;
      const startTime=toMinutes(absence.start_time||absence.startTime),endTime=toMinutes(absence.end_time||absence.endTime);
      if(start===end){
        if(startTime!==null)from=startTime;
        if(endTime!==null)to=endTime;
      }else if(date===start){
        from=startTime===null?0:startTime;
      }else if(date===end){
        to=endTime===null?1440:endTime;
      }
      if(to<=from)to=Math.min(1440,from+1);
      windows.push({from,to,type:absence.type||'Afwezig',note:absence.note||''});
    }
    windows.sort((a,b)=>a.from-b.from);
    return windows.reduce((merged,current)=>{
      const previous=merged[merged.length-1];
      if(previous&&current.from<=previous.to){previous.to=Math.max(previous.to,current.to);previous.note=[previous.note,current.note].filter(Boolean).join(' / ');}
      else merged.push({...current});
      return merged;
    },[]);
  }

  function fitOutsideWindows(start,duration,windows){
    let cursor=Math.max(0,number(start,0));
    const length=Math.max(0,number(duration,0));
    for(let pass=0;pass<Math.max(2,(windows||[]).length+1);pass++){
      const blocking=(windows||[]).find(window=>cursor<window.to&&cursor+length>window.from);
      if(!blocking)return cursor;
      cursor=blocking.to;
    }
    return cursor;
  }

  const openingDayNames={
    0:['zo','zon','zondag','sun','sunday'],1:['ma','maa','maandag','mon','monday'],
    2:['di','din','dinsdag','tue','tuesday'],3:['wo','woe','woensdag','wed','wednesday'],
    4:['do','don','donderdag','thu','thursday'],5:['vr','vrij','vrijdag','fri','friday'],
    6:['za','zat','zaterdag','sat','saturday']
  };
  const openingDayIndex=name=>{
    const key=String(name||'').trim().toLowerCase().replace(/\./g,'');
    for(const [index,names] of Object.entries(openingDayNames))if(names.some(item=>key===item||key.startsWith(item)))return Number(index);
    return undefined;
  };
  function openingDayMatches(expression,day){
    for(const part of String(expression||'').toLowerCase().replace(/\s+/g,'').split(/[,/+&]+/).filter(Boolean)){
      if(part.includes('-')){
        const [from,to]=part.split('-'),start=openingDayIndex(from),end=openingDayIndex(to);
        if(start===undefined||end===undefined)continue;
        if(start<=end?(day>=start&&day<=end):(day>=start||day<=end))return true;
      }else if(openingDayIndex(part)===day)return true;
    }
    return false;
  }
  function normalizedOpeningWindow(value){
    if(value===null||value===undefined)return null;
    if(typeof value==='object'){
      if(value.closed===true||value.gesloten===true)return {open:'',close:'',closed:true};
      const open=value.open||value.van||value.start||value.opening||value.openingstijd;
      const close=value.close||value.tot||value.end||value.sluiting||value.sluitingstijd;
      if(open&&close)return normalizedOpeningWindow(`${open}-${close}`);
    }
    const raw=String(value).trim();if(!raw)return null;
    if(/gesloten|closed|dicht/i.test(raw))return {open:'',close:'',closed:true};
    const match=raw.match(/(\d{1,2})[:.]?(\d{2})?\s*[-–—]\s*(\d{1,2})[:.]?(\d{2})?/);if(!match)return null;
    const h1=Number(match[1]),m1=Number(match[2]||0),h2=Number(match[3]),m2=Number(match[4]||0);
    if(h1>23||h2>23||m1>59||m2>59)return null;
    return {open:`${pad(h1)}:${pad(m1)}`,close:`${pad(h2)}:${pad(m2)}`,closed:false};
  }
  function openingWindowForDate(value,date){
    const day=parseIso(date).getDay();let data=value;
    if(typeof data==='string'){
      const raw=data.trim();if(!raw)return null;
      if((raw.startsWith('{')&&raw.endsWith('}'))||(raw.startsWith('[')&&raw.endsWith(']'))){try{data=JSON.parse(raw)}catch(_){data=raw}}
    }
    if(data&&typeof data==='object'&&(data.tekst||data.text))data=data.tekst||data.text;
    if(data&&typeof data==='object'&&!Array.isArray(data)){
      for(const [key,item] of Object.entries(data))if(openingDayNames[day].some(name=>String(key).toLowerCase()===name||String(key).toLowerCase().startsWith(name))){const window=normalizedOpeningWindow(item);if(window)return window}
      for(const key of ['default','standaard','dagelijks','alle dagen'])if(data[key]){const window=normalizedOpeningWindow(data[key]);if(window)return window}
    }
    const raw=String(data||'').replace(/\n/g,';'),parts=raw.split(/[;|]/).map(item=>item.trim()).filter(Boolean);let fallback=null;
    for(const part of parts){
      if(/gesloten|closed|dicht/i.test(part)){
        const prefix=part.split(/gesloten|closed|dicht/i)[0];
        if(openingDayMatches(prefix,day)||openingDayNames[day].some(name=>prefix.toLowerCase().includes(name)))return {open:'',close:'',closed:true};
        continue;
      }
      const match=part.match(/^(.*?)\s*(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})/i);if(!match)continue;
      const window=normalizedOpeningWindow(`${match[2]}-${match[3]}`);if(!window)continue;
      const days=String(match[1]||'').trim();
      if(!days||/^(elke dag|dagelijks|alle dagen)$/i.test(days)){fallback=window;continue}
      if(openingDayMatches(days,day)||openingDayNames[day].some(name=>days.toLowerCase().includes(name)))return window;
    }
    return normalizedOpeningWindow(raw)||fallback;
  }
  function visitOpeningWindow(visit,date){
    const customer=visit?.customer||{},value=visit?.opening??visit?.openingstijden??customer.opening??customer.openingstijden??customer.Openingstijden;
    return openingWindowForDate(value,date);
  }
  const visitName=visit=>String(visit?.customer?.name||visit?.customer?.Winkel||visit?.name||visit?.winkel||'Klant');

  function routeCost(order,home){
    if(!order.length)return 0;
    let total=0,previous=home;
    for(const visit of order){const point=visitPoint(visit);total+=haversineKm(previous,point);previous=point;}
    return total+haversineKm(previous,home);
  }

  function optimizeVisits(visits,home){
    const remaining=(visits||[]).slice(),ordered=[];
    let previous=home;
    while(remaining.length){
      let best=0,bestDistance=Infinity;
      for(let i=0;i<remaining.length;i++){
        const distance=haversineKm(previous,visitPoint(remaining[i]));
        if(distance<bestDistance){bestDistance=distance;best=i;}
      }
      const [next]=remaining.splice(best,1);ordered.push(next);previous=visitPoint(next);
    }
    let improved=true;
    while(improved&&ordered.length>3){
      improved=false;
      const currentCost=routeCost(ordered,home);
      for(let i=0;i<ordered.length-1&&!improved;i++)for(let j=i+1;j<ordered.length&&!improved;j++){
        const candidate=ordered.slice();candidate.splice(i,j-i+1,...candidate.slice(i,j+1).reverse());
        if(routeCost(candidate,home)+0.001<currentCost){ordered.splice(0,ordered.length,...candidate);improved=true;}
      }
    }
    return ordered;
  }

  function createLegRequests(visits,home,walkThresholdMeters=300){
    const requests=[];
    let previous=home;
    for(let index=0;index<visits.length;index++){
      const to=visitPoint(visits[index]);
      if(!hasPoint(previous)||!hasPoint(to))throw new Error('Een klant of startlocatie heeft geen geldige coördinaten.');
      const distance=haversineKm(previous,to)*1000;
      const mode=index>0&&distance<=number(walkThresholdMeters,300)?'walk':'car';
      requests.push({from:previous,to,mode,visitId:String(visits[index].id||visits[index].planningId)});
      previous=to;
    }
    if(visits.length){
      if(!hasPoint(previous)||!hasPoint(home))throw new Error('De terugroute kan niet worden berekend.');
      requests.push({from:previous,to:home,mode:'car',return:true});
    }
    return requests;
  }

  async function edgeFailureMessage(result,fallback='geen route ontvangen'){
    if(result?.data?.error)return String(result.data.error);
    const response=result?.error?.context;
    if(response&&typeof response.clone==='function'){
      try{
        const payload=await response.clone().json();
        if(payload?.error)return String(payload.error);
      }catch(_error){/* Een oudere client kan de responsebody al hebben gelezen. */}
    }
    return String(result?.error?.message||fallback);
  }

  async function requestRouteBatch(sb,requests){
    if(!requests.length)return [];
    const results=new Array(requests.length),remoteIndexes=[];
    requests.forEach((request,index)=>{
      if(haversineKm(request.from,request.to)<=0.01)results[index]={min:1,km:0,live:true,mode:request.mode};
      else remoteIndexes.push(index);
    });
    if(!remoteIndexes.length)return results;
    const payload=remoteIndexes.map(index=>({
      ...requests[index],
      fromLat:number(requests[index].from.lat),fromLon:number(requests[index].from.lng),
      toLat:number(requests[index].to.lat),toLon:number(requests[index].to.lng),mode:requests[index].mode
    })).map(({fromLat,fromLon,toLat,toLon,mode})=>({
      fromLat,fromLon,toLat,toLon,mode
    }));
    let batch=null,received=null,lastReason='geen route ontvangen';
    // Eén dag is altijd één batch. Zo ontstaan geen dubbele routecycli of een
    // storm van losse Edge-aanroepen wanneer TomTom tijdelijk niet reageert.
    for(let attempt=0;attempt<2&&!received;attempt++){
      let timer;
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('De live routeberekening duurde te lang.')),45000)});
      try{batch=await Promise.race([sb.functions.invoke('tomtom-proxy',{body:{action:'route-batch',legs:payload}}),timeout])}
      catch(error){batch={data:null,error}}
      finally{clearTimeout(timer)}
      if(!batch?.error&&!batch?.data?.error&&Array.isArray(batch?.data?.legs)&&batch.data.legs.length===remoteIndexes.length){received=batch.data.legs;break}
      lastReason=await edgeFailureMessage(batch,lastReason);
      const code=String(batch?.data?.code||'');
      const retryable=batch?.data?.retryable===true||(!batch?.data&&!code);
      if(code==='UNSUPPORTED_ACTION')throw new Error('De actieve TomTom Edge Function is verouderd. Publiceer de meegeleverde tomtom-proxy opnieuw.');
      if(!retryable||attempt===1)break;
      await new Promise(resolve=>setTimeout(resolve,700));
    }
    if(!received)throw new Error(`TomTom-dagroute mislukt: ${lastReason}`);
    received.forEach((leg,remoteIndex)=>{
      const index=remoteIndexes[remoteIndex];
      const seconds=Number(leg?.travelTimeInSeconds),meters=Number(leg?.lengthInMeters);
      if(!Number.isFinite(seconds)||seconds<=0||seconds>86400||!Number.isFinite(meters)||meters<0||meters>1000000)throw new Error(`TomTom gaf voor traject ${index+1} geen geldige afstand en reistijd terug.`);
      // Een route-batch komt uitsluitend uit de live TomTom Edge Function.
      // Oudere geldige deployments voegden nog geen expliciet live=true toe.
      results[index]={min:Math.max(1,Math.round(seconds/60)),km:Math.round(meters/100)/10,live:leg.live!==false,mode:requests[index].mode};
    });
    return results;
  }

  function buildDay({date,departure='08:00',visits=[],absences=[],legs=[],parkingMinutes=15,pauseEnabled=true,pauseMinutes=30,pauseAt=720}){
    if(legs.length!==visits.length+(visits.length?1:0))throw new Error('Het aantal route-onderdelen klopt niet met de dagplanning.');
    const windows=absenceWindows(absences,date),rows=[];
    let cursor=toMinutes(departure);if(cursor===null)cursor=480;
    // Een afwezigheid in de ochtend blokkeert de buitendienststart. Zonder
    // expliciete vaste afspraak vóór dat blok start de route pas erna.
    const fixedBeforeMorning=(visits||[]).some(visit=>{const fixed=toMinutes(visit.fixedStart||visit.fixed_starttijd);return fixed!==null&&fixed<720});
    const morningBlock=!fixedBeforeMorning&&windows.find(window=>window.from<720&&window.to>cursor);
    if(morningBlock)cursor=Math.max(cursor,morningBlock.to);
    const initial=cursor;
    let totalKm=0,totalTravel=0,totalParking=0,totalWaiting=0,totalVisit=0,totalPause=0,pauseTaken=false;
    for(let index=0;index<visits.length;index++){
      const visit=visits[index],leg=legs[index],travel=Math.max(0,number(leg.min)),parking=leg.mode==='car'?Math.max(0,number(parkingMinutes,15)):0;
      const opening=visitOpeningWindow(visit,date),label=visitName(visit);
      if(!opening)throw new Error(`Openingstijden ontbreken of zijn niet leesbaar voor ${label}.`);
      if(opening.closed||!opening.open||!opening.close)throw new Error(`${label} is op deze dag gesloten.`);
      const openingStart=toMinutes(opening.open),openingEnd=toMinutes(opening.close);
      if(openingStart===null||openingEnd===null||openingEnd<=openingStart)throw new Error(`Openingstijden van ${label} zijn ongeldig.`);
      const travelStart=fitOutsideWindows(cursor,travel+parking,windows);
      totalWaiting+=Math.max(0,travelStart-cursor);
      let arrival=travelStart+travel+parking;
      if(pauseEnabled&&!pauseTaken&&index>0&&arrival>=number(pauseAt,720)){
        const pauseStart=fitOutsideWindows(arrival,number(pauseMinutes,30),windows);
        totalWaiting+=Math.max(0,pauseStart-arrival);arrival=pauseStart+number(pauseMinutes,30);totalPause+=number(pauseMinutes,30);pauseTaken=true;
      }
      let desired=toMinutes(visit.fixedStart||visit.fixed_starttijd);
      if(desired===null)desired=arrival;
      const beforeOpening=Math.max(desired,arrival);desired=Math.max(beforeOpening,openingStart);
      totalWaiting+=Math.max(0,desired-beforeOpening);
      const duration=Math.max(5,number(visit.duration||visit.bezoekduur_min,30));
      const visitStart=fitOutsideWindows(desired,duration,windows);
      totalWaiting+=Math.max(0,visitStart-desired);
      const visitEnd=visitStart+duration;
      if(visitEnd>openingEnd)throw new Error(`${label} past niet vóór sluitingstijd ${opening.close}.`);
      rows.push({
        id:String(visit.planningId||visit.id),order:index+1,
        start:fromMinutes(visitStart),end:fromMinutes(visitEnd),
        travelMin:Math.round(travel),parkingMin:Math.round(parking),distanceKm:Math.round(number(leg.km)*10)/10,
        routeMode:leg.mode||'car',routeLive:leg.live===true
      });
      totalKm+=number(leg.km);totalTravel+=travel;totalParking+=parking;totalVisit+=duration;cursor=visitEnd;
    }
    const returnLeg=visits.length?legs[legs.length-1]:null;
    if(returnLeg){
      const returnStart=fitOutsideWindows(cursor,number(returnLeg.min),windows);
      totalWaiting+=Math.max(0,returnStart-cursor);cursor=returnStart+number(returnLeg.min);
      totalTravel+=number(returnLeg.min);totalKm+=number(returnLeg.km);
    }
    return {
      date,departure:fromMinutes(initial),end:fromMinutes(cursor),rows,absenceWindows:windows,
      returnLeg:returnLeg?{travelMin:Math.round(number(returnLeg.min)),distanceKm:Math.round(number(returnLeg.km)*10)/10,routeLive:returnLeg.live===true}:null,
      totals:{km:Math.round(totalKm*10)/10,travelMin:Math.round(totalTravel),parkingMin:Math.round(totalParking),waitingMin:Math.round(totalWaiting),visitMin:Math.round(totalVisit),pauseMin:Math.round(totalPause),dayMin:Math.round(cursor-initial)},
      live:legs.every(leg=>leg.live===true),calculatedAt:new Date().toISOString()
    };
  }

  function stableHash(value){
    const text=JSON.stringify(value);let hash=2166136261;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16);
  }

  function routeInputHash({date,departure,visits=[],absences=[],home,parkingMinutes=15,walkThresholdMeters=300,pauseEnabled=true}){
    const normalizedVisits=(visits||[]).slice().sort((a,b)=>number(a.order,999)-number(b.order,999)).map((visit,index)=>({
      id:String(visit.planningId||visit.id||index),order:index+1,
      lat:number(visit.customer?.lat??visit.customer?.latitude),lng:number(visit.customer?.lng??visit.customer?.longitude),
      duration:number(visit.duration||visit.bezoekduur_min,30),fixedStart:visit.fixedStart||visit.fixed_starttijd||null,
      opening:visitOpeningWindow(visit,date)
    }));
    const normalizedAbsences=absenceWindows(absences,date).map(window=>({from:window.from,to:window.to}));
    return stableHash({date,departure,home:{lat:number(home?.lat),lng:number(home?.lng)},visits:normalizedVisits,absences:normalizedAbsences,parkingMinutes:number(parkingMinutes,15),walkThresholdMeters:number(walkThresholdMeters,300),pauseEnabled:pauseEnabled!==false});
  }

  function canReuseDayRoute(summary,inputHash){
    return !!(summary&&summary.live===true&&summary.includesReturn===true&&summary.returnLeg?.routeLive===true&&summary.inputHash&&summary.inputHash===inputHash);
  }

  async function persistDay(sb,{workspaceId,date,departure,result,pauseEnabled=true,inputHash=null}){
    const summary={...result.totals,end:result.end,live:result.live,includesReturn:!!result.returnLeg,returnLeg:result.returnLeg,calculatedAt:result.calculatedAt,inputHash:inputHash||null,hash:stableHash({date,departure,rows:result.rows})};
    const rows=result.rows.map(row=>({id:row.id,route_volgorde:row.order,starttijd:row.start,eindtijd:row.end,reistijd_min:row.travelMin,parking_min:row.parkingMin,afstand_km:row.distanceKm,route_mode:row.routeMode,route_live:row.routeLive}));
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Het opslaan van de dagroute duurde te lang.')),15000)});
    let rpc;
    try{rpc=await Promise.race([sb.rpc('save_day_route',{p_workspace_id:workspaceId||null,p_date:date,p_departure:departure,p_rows:rows,p_summary:summary,p_pause_enabled:pauseEnabled}),timeout])}
    finally{clearTimeout(timer)}
    if(!rpc.error)return summary;
    if(/function .* does not exist|schema cache/i.test(String(rpc.error.message||''))){
      throw new Error('De centrale routeopslag ontbreekt. Voer SUPABASE_V11_1_RELEASE.sql uit en vernieuw daarna de Supabase schema-cache.');
    }
    throw rpc.error;
  }

  async function calculateDay({sb,workspaceId,date,departure,visits,absences,home,parkingMinutes=15,walkThresholdMeters=300,optimize=false,pauseEnabled=true}){
    if(!sb)throw new Error('Supabase-verbinding ontbreekt.');
    if(!hasPoint(home))throw new Error('Stel eerst een geldige centrale startlocatie in.');
    const selected=optimize?optimizeVisits(visits,home):(visits||[]).slice().sort((a,b)=>number(a.order,999)-number(b.order,999));
    const requests=createLegRequests(selected,home,walkThresholdMeters);
    const legs=await requestRouteBatch(sb,requests);
    const result=buildDay({date,departure,visits:selected,absences,legs,parkingMinutes,pauseEnabled});
    result.inputHash=routeInputHash({date,departure,visits:selected,absences,home,parkingMinutes,walkThresholdMeters,pauseEnabled});
    await persistDay(sb,{workspaceId,date,departure,result,pauseEnabled,inputHash:result.inputHash});
    return {visits:selected,result};
  }

  function queueDay(date,operation){
    const previous=dayLocks.get(date)||Promise.resolve();
    const current=previous.catch(()=>undefined).then(operation).finally(()=>{if(dayLocks.get(date)===current)dayLocks.delete(date)});
    dayLocks.set(date,current);return current;
  }

  async function loadUserSettings(sb,workspaceId){
    let query=sb.from('user_app_settings').select('*');
    if(workspaceId)query=query.eq('user_id',workspaceId);
    const response=await query.maybeSingle();
    if(response.error&&response.error.code!=='PGRST116')throw response.error;
    const row=response.data||{},settings=row.settings||{};
    return {language:row.language||'nl',...settings};
  }

  async function saveUserSettings(sb,settings,workspaceId){
    const language=['nl','en','de'].includes(settings.language)?settings.language:'nl';
    const payload={...settings};delete payload.language;
    const response=await sb.rpc('save_user_app_settings',{p_workspace_id:workspaceId||null,p_language:language,p_settings:payload});
    if(response.error)throw response.error;
  }

  async function prepareVisitPhoto(file,{maxBytes=8*1024*1024,maxDimension=2560,quality=.84}={}){
    if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Selecteer een geldig afbeeldingsbestand.');
    const allowedTypes=new Set(['image/jpeg','image/png','image/webp']);
    if(Number(file.size||0)<=maxBytes&&allowedTypes.has(String(file.type||'').toLowerCase()))return file;
    if(typeof document==='undefined')throw new Error('Deze grote foto kan in deze omgeving niet worden verkleind.');
    let source=null,cleanup=()=>{};
    try{
      if(typeof createImageBitmap==='function'){
        try{source=await createImageBitmap(file,{imageOrientation:'from-image'});cleanup=()=>source?.close?.()}catch(_){source=null}
      }
      if(!source){
        if(typeof URL==='undefined'||typeof URL.createObjectURL!=='function')throw new Error('De foto kan niet worden geopend.');
        const objectUrl=URL.createObjectURL(file);
        try{source=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Het fotoformaat kan niet worden gelezen.'));image.src=objectUrl})}
        catch(error){URL.revokeObjectURL(objectUrl);throw error}
        cleanup=()=>URL.revokeObjectURL(objectUrl);
      }
      const sourceWidth=Number(source.naturalWidth||source.width),sourceHeight=Number(source.naturalHeight||source.height);
      if(!sourceWidth||!sourceHeight)throw new Error('De foto heeft geen geldige afmetingen.');
      let scale=Math.min(1,Number(maxDimension||2560)/Math.max(sourceWidth,sourceHeight)),jpegQuality=Number(quality||.84),blob=null;
      for(let attempt=0;attempt<7;attempt++){
        const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('De foto kan niet worden verwerkt.');
        context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(source,0,0,width,height);
        blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',jpegQuality));canvas.width=canvas.height=1;
        if(!blob)throw new Error('De foto kon niet naar JPEG worden omgezet.');
        if(blob.size<=maxBytes)break;
        scale*=.78;jpegQuality=Math.max(.62,jpegQuality-.05);
      }
      if(!blob||blob.size>maxBytes)throw new Error('De foto blijft na verkleinen te groot. Kies een andere foto.');
      const base=String(file.name||'foto').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]/g,'_')||'foto';
      return new File([blob],`${base}.jpg`,{type:'image/jpeg',lastModified:Number(file.lastModified||Date.now())});
    }catch(error){
      throw new Error(`Foto voorbereiden mislukt: ${error.message||error}`);
    }finally{cleanup()}
  }

  async function signedPhotoUrl(sb,path,expiresIn=900){
    if(!path)return null;
    const response=await sb.storage.from('visit-photos').createSignedUrl(path,expiresIn);
    if(response.error)return null;
    return response.data?.signedUrl||null;
  }

  return {VERSION,number,toMinutes,fromMinutes,localIso,parseIso,addDays,haversineKm,pointFromCustomer,hasPoint,absenceWindows,openingWindowForDate,fitOutsideWindows,optimizeVisits,createLegRequests,requestRouteBatch,buildDay,stableHash,routeInputHash,canReuseDayRoute,persistDay,calculateDay,queueDay,loadUserSettings,saveUserSettings,prepareVisitPhoto,signedPhotoUrl};
});
