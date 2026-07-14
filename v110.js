/* Planning-GJsystems v10.10: live routes, blijvende dagverplaatsing en winkelbezoek-PDF */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),isLaptop=!!$('calendarBody');
  const client=()=>window.GJ_AUTH?.sb||null;
  const isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
  let mutationDepth=0,pendingRemoteReload=false,liveRouteBusy=false;

  function setVersion(){
    document.title='Planning-GJsystems';
    document.querySelectorAll('.version,.productVersion,.settingsVersion').forEach(el=>el.remove());
  }
  function beginMutation(){mutationDepth++;window.__GJ_LOCAL_MUTATION__=true}
  function withDeadline(promise,milliseconds,message){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds)})]).finally(()=>clearTimeout(timer))}
  async function endMutation(){
    mutationDepth=Math.max(0,mutationDepth-1);window.__GJ_LOCAL_MUTATION__=mutationDepth>0;
    if(!mutationDepth&&pendingRemoteReload){pendingRemoteReload=false;await window.loadPlanningFromSupabase?.()}
  }
  function plannedDates(){return [...new Set((db.visits||[]).filter(v=>v.date&&v.status!=='Uit planning').map(v=>v.date))].sort()}

  if(window.loadPlanningFromSupabase){
    const originalLoad=window.loadPlanningFromSupabase;
    window.loadPlanningFromSupabase=async function(){
      if(window.__GJ_LOCAL_MUTATION__){pendingRemoteReload=true;return true}
      return await originalLoad.apply(this,arguments);
    };
  }

  function routeLegs(date){
    const visits=visitsOn(date),points=[startPoint(),...visits.map(v=>getC(v.customerId)).filter(Boolean),startPoint()],legs=[];
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],distance=km(a,b);
      const mode=i>0&&i<points.length-2&&distance!==null&&distance*1000<=Number(db.settings.walk||300)?'walk':'car';
      legs.push({a,b,mode,key:routeKey(a,b,mode)});
    }
    return legs;
  }
  async function persistLiveDay(date){
    const sb=client();if(!sb)return false;
    // v11 slaat de complete dag al atomisch op via save_day_route.
    if(window.GJPlanningCore&&db.routeStats?.[date]?.includesReturn===true)return true;
    const visits=visitsOn(date),legs=routeLegs(date);
    const [planningResult,customerResult]=await Promise.all([
      sb.from('planning').select('id,customer_id,route_volgorde').eq('datum',date),
      sb.from('customers').select('id,klantnummer')
    ]);
    if(planningResult.error)throw planningResult.error;if(customerResult.error)throw customerResult.error;
    const rows=planningResult.data||[],customerIds=new Map();
    for(const row of customerResult.data||[]){customerIds.set(String(row.id),row.id);if(row.klantnummer)customerIds.set(String(row.klantnummer),row.id)}
    const used=new Set();
    for(let i=0;i<visits.length;i++){
      const visit=visits[i],route=db.routeCache?.[legs[i]?.key];
      let row=rows.find(r=>!used.has(r.id)&&[visit.planningId,visit.id].some(id=>String(id||'')===String(r.id)));
      if(!row){const cid=customerIds.get(String(visit.customerId));row=rows.find(r=>!used.has(r.id)&&String(r.customer_id)===String(cid))}
      if(!row||!route)continue;used.add(row.id);visit.id=row.id;visit.planningId=row.id;visit.supabase=true;
      const parking=legs[i]?.mode==='car'?Number(db.settings.parking||15):0;
      const patch={route_volgorde:i+1,reistijd_min:Number(route.min||0)+parking,afstand_km:Number(route.km||0),route_mode:legs[i]?.mode||'car',route_live:route.live===true||route.source==='TomTom',updated_at:new Date().toISOString()};
      const result=await sb.from('planning').update(patch).eq('id',row.id);
      if(result.error)throw result.error;
    }
    if(used.size!==visits.length)throw new Error('Niet alle planningregels konden aan de live route worden gekoppeld.');
    save();
    return true;
  }
  async function makeDayLive(date,{persist=true,force=false}={}){
    if(!date||!visitsOn(date).length)return true;
    const enabled=window.gjEnsureCentralTomTom?await window.gjEnsureCentralTomTom():window.GJ_TOMTOM_ENABLED===true;
    if(!enabled)throw new Error('TomTom staat niet online. Live routes konden niet worden berekend.');
    if(force&&window.gjInvalidateDayRouteCache)window.gjInvalidateDayRouteCache(date);
    await withDeadline(calculateDayRoutes(date,false),45000,`Dagroute ${displayDate(date)} is na 45 seconden afgebroken. Controleer TomTom/Supabase en probeer opnieuw.`);
    const stats=routeStatsForDay(date);
    if(!stats?.live)throw new Error(`De live route voor ${displayDate(date)} is niet volledig ontvangen.`);
    saveRouteStats(date);save();render();
    if(persist)await persistLiveDay(date);
    return true;
  }
  async function makeDatesLive(dates,{persist=true,force=false,quiet=false,onProgress=null}={}){
    if(liveRouteBusy)return false;
    liveRouteBusy=true;
    try{
      const unique=[...new Set((dates||[]).filter(Boolean))];
      for(let index=0;index<unique.length;index++){
        if(typeof onProgress==='function')onProgress(index+1,unique.length,unique[index]);
        await makeDayLive(unique[index],{persist,force});
      }
      return true;
    }catch(error){console.error('Live routeberekening:',error);if(!quiet)alert(error.message);return false}
    finally{liveRouteBusy=false}
  }
  window.gjMakeDatesLive=makeDatesLive;

  if(isLaptop){
    const priorGenerate=window.generatePlanning;
    window.generatePlanning=generatePlanning=async function(){
      let result;const from=typeof parseDisplayDate==='function'?parseDisplayDate($('planFrom')?.value):'',to=typeof parseDisplayDate==='function'?parseDisplayDate($('planTo')?.value):'';
      // De oude planner berekende routes voordat zijn nieuwe lokale regels in
      // Supabase bestonden. Sla die voorstap over; na opslaan berekent v11 de
      // routes met de echte database-ID's atomair en volledig live.
      const tomtomWasEnabled=window.GJ_TOMTOM_ENABLED===true;
      window.GJ_TOMTOM_ENABLED=false;
      beginMutation();
      try{
        result=await priorGenerate.apply(this,arguments);
      }finally{window.GJ_TOMTOM_ENABLED=tomtomWasEnabled;pendingRemoteReload=false;await endMutation()}
      // De planner voegt rijen in Supabase toe. Lees daarna éénmaal de echte
      // database-ID's terug voordat de atomische v11-routeopslag begint.
      await window.loadPlanningFromSupabase?.();
      const dates=plannedDates().filter(date=>(!from||date>=from)&&(!to||date<=to));
      const progress=$('progressDialog'),report=$('planningReportDialog'),reportWasOpen=report?.open===true;
      if(reportWasOpen)report.close();
      if(dates.length&&progress&&!progress.open)progress.showModal();
      try{
        const ok=await makeDatesLive(dates,{persist:true,force:true,quiet:false,onProgress:(current,total)=>{
          if($('progressText'))$('progressText').textContent=`Dagroute ${current} van ${total} live berekenen (maximaal 45 seconden)...`;
          if($('progressFill'))$('progressFill').style.width=Math.round(current/total*100)+'%';
        }});
        if(ok&&dates.length){if($('progressText'))$('progressText').textContent=`Klaar: ${dates.length} dagroutes live berekend.`;if($('progressFill'))$('progressFill').style.width='100%';await new Promise(resolve=>setTimeout(resolve,350))}
      }finally{
        if(progress?.open)progress.close();
        if(reportWasOpen&&!report.open)report.showModal();
      }
      return result;
    };
    const priorRefresh=window.refreshDayRoute;
    window.refreshDayRoute=refreshDayRoute=async function(date){
      beginMutation();
      try{await priorRefresh.call(this,date);await makeDatesLive([date],{persist:true,force:true,quiet:false})}
      finally{await endMutation()}
    };
    const priorRefreshMany=window.refreshChangedDays;
    window.refreshChangedDays=refreshChangedDays=async function(dates){
      beginMutation();
      try{await priorRefreshMany.call(this,dates);await makeDatesLive(dates,{persist:true,force:true,quiet:false})}
      finally{await endMutation()}
    };

    async function planningRowsForDay(date){
      const sb=client();if(!sb)return [];
      const result=await sb.from('planning').select('id,customer_id,datum,status,uitgevoerd').eq('datum',date);
      if(result.error)throw result.error;return result.data||[];
    }
    async function customerUuid(localId){
      const sb=client();if(!sb)return null;
      if(isUuid(localId)){const byId=await sb.from('customers').select('id').eq('id',localId).maybeSingle();if(!byId.error&&byId.data)return byId.data.id}
      const byNumber=await sb.from('customers').select('id').eq('klantnummer',String(localId)).maybeSingle();
      if(byNumber.error)throw byNumber.error;return byNumber.data?.id||null;
    }
    async function moveDayInDatabase(oldDate,newDate,source){
      const sb=client();if(!sb)return [];
      const current=await planningRowsForDay(oldDate),byId=new Map(current.map(r=>[String(r.id),r])),byCustomer=new Map(current.map(r=>[String(r.customer_id),r]));
      const resolved=[];
      for(const visit of source){
        let row=byId.get(String(visit.planningId||visit.id));
        if(!row){const cid=await customerUuid(visit.customerId);row=byCustomer.get(String(cid))}
        if(!row)throw new Error(`Planningregel van ${(getC(visit.customerId)||{}).Winkel||'klant'} is niet gevonden.`);
        resolved.push({visit,row});
      }
      const moved=[];
      try{
        for(const {visit,row} of resolved){
          const patch={datum:newDate,starttijd:visit.time||null,eindtijd:visit.end||null,route_volgorde:Number(visit.order||999),updated_at:new Date().toISOString()};
          const result=await sb.from('planning').update(patch).eq('id',row.id).eq('datum',oldDate).select('id,datum').single();
          if(result.error)throw result.error;moved.push(row.id);visit.id=row.id;visit.planningId=row.id;visit.supabase=true;
        }
        const verify=await sb.from('planning').select('id,datum').in('id',moved);
        if(verify.error)throw verify.error;
        if((verify.data||[]).length!==moved.length||(verify.data||[]).some(r=>r.datum!==newDate))throw new Error('De nieuwe datum kon niet volledig worden bevestigd.');
      }catch(error){
        for(const id of moved)await sb.from('planning').update({datum:oldDate,updated_at:new Date().toISOString()}).eq('id',id);
        throw error;
      }
      return moved;
    }
    async function moveDaySettings(oldDate,newDate,departure){
      const sb=client(),uid=window.GJ_AUTH?.workspaceUserId||window.GJ_AUTH?.profile?.id;if(!sb||!uid)return;
      const settings=db.disabledBreaks?.[oldDate]?{break_disabled:true}:{};
      if(departure||Object.keys(settings).length){
        const row={user_id:uid,datum:newDate,vertrektijd:departure?departure+':00':null,settings,updated_at:new Date().toISOString()};
        const up=await sb.from('app_day_settings').upsert(row,{onConflict:'user_id,datum'});if(up.error)throw up.error;
      }
      const del=await sb.from('app_day_settings').delete().eq('user_id',uid).eq('datum',oldDate);if(del.error)throw del.error;
      const fixed=await sb.from('fixed_appointments').update({datum:newDate,updated_at:new Date().toISOString()}).eq('user_id',uid).eq('datum',oldDate);if(fixed.error)console.warn('Vaste afspraken van dag:',fixed.error);
    }
    async function moveWholeDayStable(oldDate,newDate){
      if(!oldDate||oldDate===newDate)return;
      const source=visitsOn(oldDate).slice();if(!source.length)return;
      if(visitsOn(newDate).length)return alert('Zet een complete dag alleen op een lege dag.');
      for(const visit of source){
        const c=getC(visit.customerId)||{},reason=blockReason(newDate,c);
        if(reason&&!String(reason).toLowerCase().includes('thuiswerk'))return alert(`Deze dag is geblokkeerd: ${reason}.`);
        const possible=visitWindowPossibleOnDate(c,newDate,visit.duration||c.Bezoektijd||60);
        if(!possible.ok)return alert(`${c.Winkel||'Klant'} kan niet naar ${displayDate(newDate)}: ${possible.reason}.`);
      }
      if(!confirm(`Complete dag met ${source.length} klant${source.length===1?'':'en'} verplaatsen naar ${displayDate(newDate)}?`))return;
      const departure=db.dayDepartures?.[oldDate]||'';
      beginMutation();document.body.classList.add('v110SavingDay');
      try{
        const moved=await client().rpc('move_planning_day',{p_workspace_id:window.GJ_AUTH?.workspaceUserId||window.GJ_AUTH?.profile?.id,p_old_date:oldDate,p_new_date:newDate});
        if(moved.error)throw moved.error;
        if(Number(moved.data?.moved)!==source.length)throw new Error('Niet alle bezoeken zijn door de database bevestigd.');
        source.forEach(v=>v.date=newDate);
        for(const fixed of db.fixed||[])if(fixed.date===oldDate)fixed.date=newDate;
        if(departure){db.dayDepartures[newDate]=departure;delete db.dayDepartures[oldDate]}
        if(db.disabledBreaks?.[oldDate]){db.disabledBreaks[newDate]=true;delete db.disabledBreaks[oldDate]}
        delete db.routeStats?.[oldDate];delete db.routeStats?.[newDate];save();
        state.selected=newDate;state.cursor=dateObj(newDate);render();
        await makeDatesLive([newDate],{persist:true,force:true});
        await window.syncChangedPlanningDates?.([newDate]);
        window.setSyncStatus?.('Supabase: complete dag opgeslagen','ok');
      }catch(error){console.error(error);alert('Dag verplaatsen mislukt: '+error.message);pendingRemoteReload=true}
      finally{document.body.classList.remove('v110SavingDay');await endMutation()}
    }
    window.gjMoveWholeDayStable=moveWholeDayStable;
    const priorDrop=window.dropVisitOnDate;
    window.dropVisitOnDate=dropVisitOnDate=function(event,date){
      const mime='application/x-planning-gjsystems-day',raw=event.dataTransfer?.getData(mime)||event.dataTransfer?.getData('text/plain')||'';
      const oldDate=String(raw).replace(/^day:/,'');
      if(/^\d{4}-\d{2}-\d{2}$/.test(oldDate)){event.preventDefault();event.stopPropagation();window.endDragDay?.(event);moveWholeDayStable(oldDate,date);return}
      return priorDrop.apply(this,arguments);
    };
  }else{
    const priorMobileCard=window.cardHtml;
    if(typeof priorMobileCard==='function')window.cardHtml=cardHtml=function(visit){
      let html=priorMobileCard.apply(this,arguments);
      if(['Uitgevoerd','Niet uitgevoerd'].includes(visit.status))html=html.replace('<div class="btnRow">','<div class="btnRow"><button type="button" class="visitPdfBtn secondary" data-id="'+String(visit.planningId||visit.id)+'">PDF</button>');
      return html;
    };
    // De mobiele kern berekent vanaf v10.11 zelf de volledige route inclusief
    // terugrit. Daardoor gebruikt het dagtotaal exact dezelfde trajecten als laptop.
  }

  function localHistory(ref){return (db.history||[]).find(h=>String(h.id)===String(ref)||String(h.supabaseHistoryId)===String(ref)||String(h.planningId)===String(ref))||null}
  function localCustomer(id){
    if(isLaptop)return typeof getC==='function'?getC(id)||{}:{};
    return (db.customers||[]).find(c=>String(c.id)===String(id))||{};
  }
  function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('Foto kon niet worden gelezen.'));reader.readAsDataURL(blob)})}
  async function fetchAsDataUrl(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('Foto is niet bereikbaar.');return blobToDataUrl(await response.blob())}
  async function loadPhoto(path,fallback){
    if(fallback?.data&&String(fallback.data).startsWith('data:'))return fallback;
    const sb=client();
    if(sb&&path){
      const downloaded=await sb.storage.from('visit-photos').download(path);
      if(!downloaded.error&&downloaded.data)return {name:path.split('/').pop()||'foto',data:await blobToDataUrl(downloaded.data),path};
      const signed=await sb.storage.from('visit-photos').createSignedUrl(path,300);
      if(!signed.error&&signed.data?.signedUrl)return {name:path.split('/').pop()||'foto',data:await fetchAsDataUrl(signed.data.signedUrl),path};
    }
    if(fallback?.data){return {...fallback,data:await fetchAsDataUrl(fallback.data)}}
    throw new Error('Foto ontbreekt of is niet bereikbaar.');
  }
  async function loadVisitReportData(reference){
    const sb=client(),local=localHistory(reference);let history=null,planning=null,customerRow=null,profile=null,photoRows=[];
    if(sb){
      const historyId=local?.supabaseHistoryId||(isUuid(reference)&&!local?.planningId?reference:null);
      if(historyId){const r=await sb.from('visit_history').select('*').eq('id',historyId).maybeSingle();if(!r.error)history=r.data}
      const planningId=history?.planning_id||local?.planningId||(!history&&isUuid(reference)?reference:null);
      if(!history&&planningId){const r=await sb.from('visit_history').select('*').eq('planning_id',planningId).order('created_at',{ascending:false}).limit(1).maybeSingle();if(!r.error)history=r.data}
      if(planningId){const r=await sb.from('planning').select('*').eq('id',planningId).maybeSingle();if(!r.error)planning=r.data}
      const customerId=history?.customer_id||planning?.customer_id||(isUuid(local?.customerId)?local.customerId:null);
      if(customerId){const r=await sb.from('customers').select('*').eq('id',customerId).maybeSingle();if(!r.error)customerRow=r.data}
      if(!customerRow&&local?.customerId){const r=await sb.from('customers').select('*').eq('klantnummer',String(local.customerId)).maybeSingle();if(!r.error)customerRow=r.data}
      const userId=history?.user_id||planning?.user_id;
      if(userId){const r=await sb.from('profiles').select('full_name,first_name,last_name,email').eq('id',userId).maybeSingle();if(!r.error)profile=r.data}
      if(history?.id){const r=await sb.from('visit_photos').select('file_path,created_at').eq('history_id',history.id).order('created_at',{ascending:true});if(!r.error)photoRows=r.data||[]}
    }
    const c=customerRow||localCustomer(local?.customerId||planning?.customer_id),localPhotos=local?.photos||[];
    const paths=new Map();photoRows.forEach(row=>paths.set(row.file_path,{path:row.file_path}));localPhotos.forEach(photo=>paths.set(photo.path||photo.data,{path:photo.path,fallback:photo}));
    const photos=[];for(const item of paths.values()){try{photos.push(await loadPhoto(item.path,item.fallback))}catch(error){console.warn(error.message,item.path)}}
    const rawRemarks=history?.opmerkingen??local?.remarks??'';
    const status=history?.status||planning?.status||local?.status||(['Uitgevoerd','Niet uitgevoerd'].includes(rawRemarks)?rawRemarks:'Uitgevoerd');
    const planningNotes=planning?.notities||'';
    const taggedFollowUp=String(rawRemarks||planningNotes).match(/(?:vervolgactie|follow[- ]?up)\s*:\s*(.+)$/i)?.[1]||'';
    const remarks=['Uitgevoerd','Niet uitgevoerd'].includes(String(rawRemarks))?planningNotes:rawRemarks;
    const reason=history?.reden||(status==='Niet uitgevoerd'?remarks:'');
    const followUp=history?.vervolgactie||planning?.vervolgactie||taggedFollowUp;
    const visitor=[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||profile?.full_name||profile?.email||window.GJ_AUTH?.profile?.full_name||window.GJ_AUTH?.profile?.email||'';
    return {
      chain:c.keten||c.Keten||c.chain||'',storeName:c.naam||c.Winkel||c.name||local?.customerName||'Onbekende klant',branch:c.vestiging||c.Vestiging||c.filiaal||'',
      street:c.straat||c.Straat||c.adres||c.address||c.street||'',houseNumber:c.huisnr||c.Huisnr||c.nr||'',postalCode:c.postcode||c.Postcode||c.postal||'',city:c.plaats||c.Plaats||c.city||local?.place||'',
      contactPerson:c.contactpersoon||c.Contactpersoon||'',visitor,visitDate:history?.bezoekdatum||planning?.datum||local?.date||'',startTime:String(history?.starttijd||planning?.starttijd||local?.time||'').slice(0,5),endTime:String(history?.eindtijd||planning?.eindtijd||local?.end||'').slice(0,5),
      activity:history?.activiteit||local?.activity||'',status,reason,summary:history?.samenvatting||local?.summary||'',remarks,followUp,workPerformed:history?.uitgevoerde_werkzaamheden||'',attentionPoints:history?.aandachtspunten||'',photos,generatedAt:new Date().toISOString()
    };
  }
  function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1}
  async function exportVisitPdf(reference){
    if(!window.GJ_VISIT_PDF)throw new Error('De PDF-generator is niet geladen.');
    const preview=isIOS()?window.open('about:blank','_blank'):null;document.body.classList.add('v110PdfBusy');
    try{
      const report=await loadVisitReportData(reference),result=window.GJ_VISIT_PDF.createDocument(report);
      window.GJ_VISIT_PDF.openOrDownload(result,{previewWindow:preview,open:isIOS()});return result;
    }catch(error){if(preview&&!preview.closed)preview.close();console.error(error);alert('PDF maken mislukt: '+error.message);return null}
    finally{document.body.classList.remove('v110PdfBusy')}
  }
  window.gjLoadVisitReportData=loadVisitReportData;window.gjExportVisitPdf=exportVisitPdf;
  window.exportHistoryVisitPdf=async reference=>exportVisitPdf(reference);
  window.exportGenericVisitPdf=async row=>{
    const ref=row?.historyId||row?.planningId||row?.visitId;if(ref)return exportVisitPdf(ref);
    alert('Bij dit bezoek ontbreekt een databasekoppeling voor het PDF-rapport.');
  };
  document.addEventListener('click',event=>{
    const button=event.target.closest('.visitPdfBtn');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();exportVisitPdf(button.dataset.id);
  },true);

  setVersion();
  window.addEventListener('gj-auth-ready',setVersion);
})();
