/* Planning-GJsystems v11.0 — gedeelde productie-integratie */
(()=>{
  'use strict';
  const core=window.GJPlanningCore;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const mobile=!!$('menuPanel')&&!$('calendarBody');
  const laptop=!!$('calendarBody');
  const auth=()=>window.GJ_AUTH;
  const sb=()=>auth()?.sb;
  const workspace=()=>auth()?.workspaceUserId||auth()?.profile?.id||null;
  let historyRows=[],historyLoaded=false,historyLoading=false,historyPage=0,historyHasMore=false,realtime=null,syncTimer=null;

  function applyReleaseUi(){
    document.title='Planning-GJsystems';
    document.querySelectorAll('.version,.productVersion,.settingsVersion,#v108DevBanner').forEach(element=>element.remove());
  }

  function mobileState(){
    if(window.GJ_MOBILE?.state())return window.GJ_MOBILE.state();
    const key='gj_mobile_v56_data_'+(sessionStorage.getItem('gj_workspace_storage_id')||'guest');
    try{return JSON.parse(localStorage.getItem(key)||'null')||{customers:[],visits:[]}}catch(_){return{customers:[],visits:[]}}
  }

  function openAssignments(){
    const state=mobileState(),today=core.localIso(),query=String($('search')?.value||'').trim().toLowerCase();
    const openStatuses=new Set(['Gepland','Vast','Ingepland']);
    const visits=(state.visits||[]).filter(visit=>openStatuses.has(visit.status||'Gepland'));
    const customers=new Map((state.customers||[]).filter(customer=>customer.active!==false).map(customer=>[String(customer.id),customer]));
    const cards=[];
    for(const visit of visits){
      const customer=customers.get(String(visit.customerId));if(!customer)continue;
      const haystack=[customer.name,customer.chain,customer.city,customer.postal,visit.date].join(' ').toLowerCase();
      if(query&&!haystack.includes(query))continue;
      cards.push({customer,visit});
    }
    if(query.length>=2){
      const assigned=new Set(cards.map(item=>String(item.customer.id)));
      for(const customer of customers.values()){
        if(assigned.has(String(customer.id)))continue;
        const haystack=[customer.name,customer.chain,customer.city,customer.postal].join(' ').toLowerCase();
        if(haystack.includes(query))cards.push({customer,visit:null});
      }
    }
    cards.sort((a,b)=>String(a.visit?.date||'9999').localeCompare(String(b.visit?.date||'9999'))||String(a.customer.name).localeCompare(String(b.customer.name),'nl'));
    return {cards,today};
  }

  window.renderOverview=function(){
    const list=$('overviewList');if(!list)return;
    const {cards,today}=openAssignments();
    list.innerHTML=cards.length?cards.map(({customer,visit})=>{
      const isToday=visit?.date===today;
      return `<article class="card overviewOpenCard"><div class="overviewOpenHead"><div><strong>${esc(customer.name||'Klant')}</strong><div class="muted">${esc([customer.chain,customer.city,customer.postal].filter(Boolean).join(' · '))}</div></div>${isToday?'<span class="todayTag">Vandaag</span>':''}</div><div>${visit?`Gepland: ${esc(visit.date)} · ${esc(visit.time||'tijd volgt')}`:'Nog niet ingepland'}</div>${isToday?'':`<button type="button" data-v11-today data-planning="${esc(visit?.planningId||visit?.id||'')}" data-customer="${esc(customer.id)}" data-old-date="${esc(visit?.date||'')}">Naar vandaag verplaatsen</button>`}</article>`;
    }).join(''):'<div class="card empty">Geen openstaande opdrachten gevonden. Zoek op een klant om een niet-ingeplande klant toe te voegen.</div>';
  };

  async function moveAssignmentToToday(button){
    const client=sb(),today=core.localIso(),planningId=button.dataset.planning,customerId=button.dataset.customer,oldDate=button.dataset.oldDate;
    if(!client)return;
    button.disabled=true;
    try{
      if(planningId){
        const result=await client.from('planning').update({datum:today,starttijd:null,eindtijd:null,fixed_starttijd:null,status:'Gepland',route_volgorde:999,route_live:false,updated_at:new Date().toISOString()}).eq('id',planningId);
        if(result.error)throw result.error;
      }else{
        const duplicate=await client.from('planning').select('id').eq('customer_id',customerId).eq('datum',today).neq('status','Uit planning').maybeSingle();
        if(duplicate.error)throw duplicate.error;
        if(duplicate.data)throw new Error('Deze klant staat vandaag al in de planning.');
        const result=await client.from('planning').insert({customer_id:customerId,datum:today,status:'Gepland',route_volgorde:999,bezoekduur_min:30,route_live:false}).select('id').single();
        if(result.error)throw result.error;
      }
      await window.GJ_MOBILE.sync(false);
      if(oldDate&&oldDate!==today)await window.GJ_MOBILE.recalculate(oldDate,false);
      await window.GJ_MOBILE.recalculate(today,false);
    }catch(error){alert('Naar vandaag verplaatsen mislukt: '+error.message)}finally{button.disabled=false}
  }

  async function loadMobileHistory(force=false){
    if(historyLoading||historyLoaded&&!force||!sb())return;
    historyLoading=true;
    try{
      if(force){historyPage=0;historyRows=[];historyLoaded=false}
      const pageSize=100,from=historyPage*pageSize,response=await sb().from('visit_history').select('*').order('bezoekdatum',{ascending:false}).order('created_at',{ascending:false}).range(from,from+pageSize-1);
      if(response.error)throw response.error;
      const customers=new Map((mobileState().customers||[]).map(customer=>[String(customer.id),customer]));
      const mapped=(response.data||[]).map(row=>{const customer=customers.get(String(row.customer_id))||{};return{...row,customerName:customer.name||'Klant',city:customer.city||'',chain:customer.chain||''}});
      const known=new Set(historyRows.map(row=>String(row.id)));historyRows=historyRows.concat(mapped.filter(row=>!known.has(String(row.id))));historyHasMore=mapped.length===pageSize;historyPage++;historyLoaded=true;renderMobileHistory();
    }catch(error){const list=$('historyMobileList');if(list)list.innerHTML=`<div class="card empty">Historie laden mislukt: ${esc(error.message)}</div>`}finally{historyLoading=false}
  }

  window.renderMobileHistory=function(){
    const list=$('historyMobileList');if(!list)return;
    if(!historyLoaded){list.innerHTML='<div class="card empty">Historie wordt geladen…</div>';loadMobileHistory();return}
    const query=String($('historyMobileSearch')?.value||'').toLowerCase(),status=$('historyMobileStatus')?.value||'',from=$('historyMobileFrom')?.value||'',to=$('historyMobileTo')?.value||'';
    const filtered=historyRows.filter(row=>(!query||[row.customerName,row.city,row.chain,row.samenvatting,row.activiteit,row.opmerkingen,row.reden].join(' ').toLowerCase().includes(query))&&(!status||row.status===status)&&(!from||row.bezoekdatum>=from)&&(!to||row.bezoekdatum<=to));
    list.innerHTML=filtered.length?filtered.map(row=>`<article class="mobileHistoryCard"><div class="mobileHistoryHead"><div><strong>${esc(row.customerName)}</strong><div class="muted">${esc(row.bezoekdatum)}${row.starttijd?' · '+esc(String(row.starttijd).slice(0,5)):''} · ${esc(row.city)}</div></div><span class="mobileHistoryStatus ${row.status==='Niet uitgevoerd'?'notDone':''}">${esc(row.status||'Uitgevoerd')}</span></div><div class="mobileHistorySummary">${esc(row.samenvatting||row.reden||'Geen samenvatting.')}</div><div class="mobileHistoryActions"><button type="button" class="secondary" data-v11-history="${esc(row.id)}">Bekijken</button>${row.status==='Niet uitgevoerd'?`<button type="button" data-v11-replan="${esc(row.id)}">Opnieuw plannen</button>`:''}</div></article>`).join(''):'<div class="card empty">Geen historie gevonden.</div>';
    if($('historyMobileMore'))$('historyMobileMore').hidden=!historyHasMore;
  };

  function ensureHistoryDialog(){
    if($('historyDetailV11'))return $('historyDetailV11');
    const dialog=document.createElement('div');dialog.id='historyDetailV11';dialog.className='historyDetailV11';dialog.hidden=true;dialog.innerHTML='<div class="sheet"><div class="sheetHead"><div><strong id="historyDetailV11Title">Bezoekdetails</strong><div id="historyDetailV11Sub" class="muted"></div></div><button id="historyDetailV11Close" type="button" class="secondary">Sluiten</button></div><div id="historyDetailV11Body"></div></div>';document.body.appendChild(dialog);$('historyDetailV11Close').onclick=()=>dialog.hidden=true;dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.hidden=true});return dialog;
  }

  async function openMobileHistory(id){
    const row=historyRows.find(item=>String(item.id)===String(id));if(!row)return;
    const dialog=ensureHistoryDialog();dialog.hidden=false;$('historyDetailV11Title').textContent=row.customerName;$('historyDetailV11Sub').textContent=[row.bezoekdatum,row.status,row.city].filter(Boolean).join(' · ');$('historyDetailV11Body').innerHTML='<p>Foto’s en bezoekgegevens worden geladen…</p>';
    try{
      const photos=await sb().from('visit_photos').select('*').eq('history_id',row.id).order('created_at');if(photos.error)throw photos.error;
      const urls=(await Promise.all((photos.data||[]).map(photo=>core.signedPhotoUrl(sb(),photo.file_path)))).filter(Boolean);
      $('historyDetailV11Body').innerHTML=`<div class="meta"><div><strong>Activiteit</strong><br>${esc(row.activiteit||'—')}</div><div><strong>Bezoeker</strong><br>${esc(auth()?.profile?.full_name||auth()?.profile?.email||'—')}</div><div><strong>Start</strong><br>${esc(String(row.starttijd||'—').slice(0,5))}</div><div><strong>Einde</strong><br>${esc(String(row.eindtijd||'—').slice(0,5))}</div></div>${row.samenvatting?`<h3>Samenvatting</h3><p>${esc(row.samenvatting)}</p>`:''}${row.opmerkingen?`<h3>Opmerkingen</h3><p>${esc(row.opmerkingen)}</p>`:''}${row.reden?`<h3>Reden niet uitgevoerd</h3><p>${esc(row.reden)}</p>`:''}${row.vervolgactie?`<h3>Vervolgactie</h3><p>${esc(row.vervolgactie)}</p>`:''}${urls.length?`<h3>Foto's</h3><div class="photoGrid">${urls.map(url=>`<img src="${esc(url)}" alt="Bezoekfoto">`).join('')}</div>`:''}`;
    }catch(error){$('historyDetailV11Body').innerHTML=`<p>Bezoekdetails konden niet volledig worden geladen: ${esc(error.message)}</p>`}
  }

  async function replanHistory(id){
    const defaultDate=core.addDays(core.localIso(),1),date=prompt('Op welke datum wil je dit bezoek opnieuw plannen? Gebruik JJJJ-MM-DD.',defaultDate);if(!date)return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Gebruik een datum als JJJJ-MM-DD.');return}
    try{const result=await sb().rpc('replan_history_visit',{p_workspace_id:workspace(),p_history_id:id,p_date:date});if(result.error)throw result.error;await window.GJ_MOBILE?.sync(false);await window.GJ_MOBILE?.recalculate(date,false);alert('Nieuwe opdracht aangemaakt. De oorspronkelijke historie is ongewijzigd gebleven.')}catch(error){alert('Opnieuw plannen mislukt: '+error.message)}
  }

  function populateMobileSettings(){
    const settings=mobileState().settings||{};
    if($('mobileStartAddress'))$('mobileStartAddress').value=settings.start||'';
    if($('mobileStartLat'))$('mobileStartLat').value=settings.startLat??'';
    if($('mobileStartLng'))$('mobileStartLng').value=settings.startLng??'';
    if($('mobileParkingMinutes'))$('mobileParkingMinutes').value=settings.parking??15;
    if($('mobileWalkThreshold'))$('mobileWalkThreshold').value=settings.walk??300;
  }

  function startMobileRealtime(){
    if(!sb()?.channel)return;
    if(realtime)sb().removeChannel(realtime);
    const draw=()=>{clearTimeout(syncTimer);syncTimer=setTimeout(()=>{window.GJ_MOBILE?.persist?.();window.GJ_MOBILE?.render?.()},80)};
    const planningChanged=payload=>{
      const state=mobileState(),row=payload.new&&Object.keys(payload.new).length?payload.new:payload.old,id=String(row?.id||'');if(!id)return;
      if(payload.eventType==='DELETE'){state.visits=(state.visits||[]).filter(visit=>String(visit.planningId||visit.id)!==id);draw();return}
      if(!row.datum){state.visits=(state.visits||[]).filter(visit=>String(visit.planningId||visit.id)!==id);draw();return}
      const mapped={id,planningId:id,customerId:String(row.customer_id),date:row.datum,time:String(row.starttijd||'').slice(0,5),end:String(row.eindtijd||'').slice(0,5),fixedStart:String(row.fixed_starttijd||'').slice(0,5),status:row.status||'Gepland',order:Number(row.route_volgorde||999),travel:Number(row.reistijd_min||0),parking:Number(row.parking_min||0),distanceKm:Number(row.afstand_km||0),routeLive:row.route_live===true,duration:Number(row.bezoekduur_min||30),pause:false,mode:row.route_mode==='walk'?'walk':'drive',updatedAt:row.updated_at||'',fromSupabase:true,rescheduledFromHistoryId:row.rescheduled_from_history_id||null};
      mapped.leg=mapped.travel?((mapped.mode==='walk'?'🚶 ':'🚗 ')+mapped.travel+' min'+(mapped.distanceKm?' · '+mapped.distanceKm.toFixed(1)+' km':'')):'';
      const index=(state.visits||[]).findIndex(visit=>String(visit.planningId||visit.id)===id);if(index>=0)state.visits[index]={...state.visits[index],...mapped};else state.visits.push(mapped);draw();
    };
    const dayChanged=payload=>{
      const state=mobileState(),row=payload.new&&Object.keys(payload.new).length?payload.new:payload.old,date=row?.datum;if(!date)return;state.dayDepartures=state.dayDepartures||{};state.mobileRouteStats=state.mobileRouteStats||{};state.pauseEnabled=state.pauseEnabled||{};
      if(payload.eventType==='DELETE'){delete state.dayDepartures[date];delete state.mobileRouteStats[date];delete state.pauseEnabled[date]}
      else{if(row.vertrektijd)state.dayDepartures[date]=String(row.vertrektijd).slice(0,5);const route=row.settings?.day_route;if(route)state.mobileRouteStats[date]={km:Number(route.km||0),min:Number(route.travelMin||0),live:route.live===true,includesReturn:true,updatedAt:route.calculatedAt};state.pauseEnabled[date]=row.settings?.pause_enabled!==false}draw();
    };
    const absenceChanged=payload=>{
      const state=mobileState(),row=payload.new&&Object.keys(payload.new).length?payload.new:payload.old,id=String(row?.id||'');if(!id)return;state.blocks=state.blocks||[];const index=state.blocks.findIndex(item=>String(item.id)===id);
      if(payload.eventType==='DELETE'){if(index>=0)state.blocks.splice(index,1)}else{const mapped={id,type:row.type||'Overig',start:row.start_date,end:row.end_date||row.start_date,startTime:String(row.start_time||'').slice(0,5),endTime:String(row.end_time||'').slice(0,5),note:row.note||'',fromSupabase:true};if(index>=0)state.blocks[index]=mapped;else state.blocks.push(mapped)}draw();
    };
    const historyChanged=()=>{historyLoaded=false;if($('historyMobile')?.classList.contains('active'))loadMobileHistory(true)};
    realtime=sb().channel('gj-mobile-v11-'+workspace()).on('postgres_changes',{event:'*',schema:'public',table:'planning'},planningChanged).on('postgres_changes',{event:'*',schema:'public',table:'app_day_settings'},dayChanged).on('postgres_changes',{event:'*',schema:'public',table:'app_absences'},absenceChanged).on('postgres_changes',{event:'*',schema:'public',table:'visit_history'},historyChanged).on('postgres_changes',{event:'*',schema:'public',table:'visit_photos'},historyChanged).on('postgres_changes',{event:'*',schema:'public',table:'customers'},()=>window.GJ_MOBILE?.sync(false)).subscribe();
  }

  function setupMobile(){
    ['historyMobileSearch','historyMobileStatus','historyMobileFrom','historyMobileTo'].forEach(id=>$(id)?.addEventListener('input',renderMobileHistory));
    $('historyMobileMore')?.addEventListener('click',()=>{historyLoaded=false;loadMobileHistory(false)});
    document.addEventListener('click',async event=>{
      const time=event.target.closest('.saveTimeBtn');if(time){event.preventDefault();event.stopImmediatePropagation();const id=time.dataset.id;try{await window.GJ_MOBILE.saveTime(id,$('editStart-'+id)?.value,$('editEnd-'+id)?.value)}catch(error){alert('Tijd opslaan mislukt: '+error.message)}return}
      const remove=event.target.closest('.removePlan');if(remove){event.preventDefault();event.stopImmediatePropagation();if(confirm('Uit planning halen?'))try{await window.GJ_MOBILE.removeFromPlanning(remove.dataset.id)}catch(error){alert(error.message)}return}
      if(event.target.closest('#togglePause')){event.preventDefault();event.stopImmediatePropagation();try{await window.GJ_MOBILE.togglePause()}catch(error){alert('Pauze wijzigen mislukt: '+error.message)}return}
      if(event.target.closest('#recalcBtn')){event.preventDefault();event.stopImmediatePropagation();const button=$('recalcBtn');button.disabled=true;try{await window.GJ_MOBILE.recalculate(core.localIso(),true);alert('De efficiëntste volgorde en alle tijden zijn opnieuw berekend.')}catch(error){alert('Route optimaliseren mislukt: '+error.message)}finally{button.disabled=false}return}
      const today=event.target.closest('[data-v11-today]');if(today){event.preventDefault();await moveAssignmentToToday(today);return}
      const history=event.target.closest('[data-v11-history]');if(history){event.preventDefault();await openMobileHistory(history.dataset.v11History);return}
      const replan=event.target.closest('[data-v11-replan]');if(replan){event.preventDefault();await replanHistory(replan.dataset.v11Replan);return}
      if(event.target.closest('#saveSettings')){event.preventDefault();event.stopImmediatePropagation();const button=$('saveSettings');button.disabled=true;try{await window.GJ_MOBILE.saveSettings();alert('Instellingen zijn centraal opgeslagen.')}catch(error){alert(error.message)}finally{button.disabled=false}}
    },true);
  }

  async function calculateLaptopDay(date,optimize=false,rerender=true){
    if(typeof db==='undefined'||!sb())return false;
    return core.queueDay(date,async()=>{
      const source=(db.visits||[]).filter(visit=>visit.date===date&&visit.status!=='Uit planning'&&!visit.pause).sort((a,b)=>(a.order||999)-(b.order||999));
      if(!source.length)return true;
      const input=source.map(visit=>{const customer=typeof getC==='function'?getC(visit.customerId):{};return{...visit,planningId:visit.id,customer:{lat:Number(customer?.Latitude),lng:Number(customer?.Longitude)},fixedStart:visit.fixedStart||null,duration:Number(visit.duration||customer?.Bezoektijd||60)}});
      const result=await core.calculateDay({sb:sb(),workspaceId:workspace(),date,departure:(db.dayDepartures||{})[date]||db.settings.depart||'08:00',visits:input,absences:db.blocks||[],home:{lat:Number.parseFloat(db.settings.startLat),lng:Number.parseFloat(db.settings.startLng)},parkingMinutes:Number(db.settings.parking??15),walkThresholdMeters:Number(db.settings.walk??300),optimize,pauseEnabled:!(db.disabledBreaks||{})[date]});
      result.visits.forEach((ordered,index)=>{const visit=(db.visits||[]).find(item=>String(item.id)===String(ordered.id)),row=result.result.rows[index];if(!visit||!row)return;visit.order=row.order;visit.time=row.start;visit.end=row.end;visit.reistijd_min=row.travelMin;visit.parking_min=row.parkingMin;visit.afstand_km=row.distanceKm;visit.route_mode=row.routeMode;visit.route_live=row.routeLive});
      db.routeStats=db.routeStats||{};db.routeStats[date]={km:result.result.totals.km,driveMin:result.result.totals.travelMin,totalMin:result.result.totals.dayMin,start:result.result.departure,end:result.result.end,calculated:result.result.live,live:result.result.live,includesReturn:true};
      if(typeof save==='function')save();if(rerender&&typeof render==='function')render();return true;
    });
  }

  async function loadLaptopSettings(){
    if(typeof db==='undefined'||!sb())return;
    try{const settings=await core.loadUserSettings(sb(),workspace());db.settings={...db.settings,...settings};if(typeof save==='function')save();if(typeof fillSettings==='function')fillSettings();if(typeof render==='function')render()}catch(error){console.warn('Centrale instellingen laden mislukt',error)}
  }

  function setupLaptop(){
    window.calculateDayRoutes=(date,rerender=true)=>calculateLaptopDay(date,false,rerender);
    window.refreshDayRoute=date=>calculateLaptopDay(date,false,true);
    window.refreshChangedDays=async dates=>{for(const date of [...new Set((dates||[]).filter(Boolean))])await calculateLaptopDay(date,false,false);if(typeof render==='function')render()};
    window.v11ReplanHistory=async id=>{const raw=String(id),history=(typeof db!=='undefined'?db.history:[]).find(item=>String(item.id)===raw),historyId=history?.supabaseHistoryId||raw.replace(/^supa-history-/,'');const date=prompt('Nieuwe datum (JJJJ-MM-DD)',core.addDays(core.localIso(),1));if(!date)return;try{const response=await sb().rpc('replan_history_visit',{p_workspace_id:workspace(),p_history_id:historyId,p_date:date});if(response.error)throw response.error;if(window.gjSyncNow)await window.gjSyncNow();await calculateLaptopDay(date,false,true);alert('Nieuwe opdracht aangemaakt; de historie is behouden.')}catch(error){alert(error.message)}};
    ['dateFilterFrom','dateFilterTo'].forEach(id=>$(id)?.addEventListener('change',()=>window.renderOverview?.()));
    $('dateFilterClear')?.addEventListener('click',()=>{$('dateFilterFrom').value='';$('dateFilterTo').value='';window.renderOverview?.()});
    ['historyDateFrom','historyDateTo'].forEach(id=>$(id)?.addEventListener('change',()=>window.renderHistory?.()));
    $('historyDateClear')?.addEventListener('click',()=>{$('historyDateFrom').value='';$('historyDateTo').value='';window.renderHistory?.()});
  }

  applyReleaseUi();
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./service-worker.js').catch(error=>console.warn('App-cache kon niet worden gestart',error));
  if(mobile)setupMobile();
  if(laptop)setupLaptop();
  window.addEventListener('gj-auth-ready',()=>setTimeout(async()=>{applyReleaseUi();if(mobile){populateMobileSettings();startMobileRealtime();window.renderOverview();loadMobileHistory()}if(laptop)await loadLaptopSettings()},900));
})();
