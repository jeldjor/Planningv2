/* Planning-GJsystems v10.9: definitive route/day/status UI corrections */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const isLaptop=!!$('calendarBody');

  function setVersionLabels(){
    document.title='Planyx';
    document.querySelectorAll('.version,.productVersion,.settingsVersion').forEach(el=>el.remove());
  }

  function syncProfilePreviewState(){
    document.querySelectorAll('.v109ProfilePreview img').forEach(img=>{
      const update=()=>img.toggleAttribute('data-has-photo',!!img.getAttribute('src'));
      update();
      new MutationObserver(update).observe(img,{attributes:true,attributeFilter:['src']});
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setVersionLabels();syncProfilePreviewState()});
  else{setVersionLabels();syncProfilePreviewState()}
  window.addEventListener('gj-auth-ready',()=>setTimeout(()=>{setVersionLabels();syncProfilePreviewState()},50));

  if(!isLaptop){
    let pendingMobileTime=null;
    document.addEventListener('click',event=>{
      const button=event.target.closest('.saveTimeBtn');
      if(!button)return;
      const id=button.dataset.id;
      pendingMobileTime={id,start:document.getElementById('editStart-'+id)?.value||'',end:document.getElementById('editEnd-'+id)?.value||''};
    },true);
    window.syncPlanningToSupabase=async function(){
      const client=window.GJ_AUTH?.sb,edit=pendingMobileTime;
      pendingMobileTime=null;
      if(!client||!edit?.id)return false;
      const saved=await client.from('planning').update({starttijd:edit.start||null,eindtijd:edit.end||null,updated_at:new Date().toISOString()}).eq('id',edit.id).select('datum').single();
      if(saved.error)throw saved.error;
      // Ook deze oude eventroute gebruikt uitsluitend de gedeelde dagengine.
      // Geen losse trajecten meer die het centrale huis-tot-huis-resultaat
      // kunnen overschrijven.
      await window.GJ_MOBILE?.recalculate?.(saved.data.datum,false);
      return true;
    };
    return;
  }

  const terminalStatus=s=>['Uitgevoerd','Niet uitgevoerd','Bezocht'].includes(String(s||''));

  async function ensureCentralTomTom(){
    const client=window.GJ_AUTH?.sb;
    if(!client)return window.GJ_TOMTOM_ENABLED===true;
    try{
      const {data,error}=await client.rpc('get_tomtom_status');
      if(error)throw error;
      window.GJ_TOMTOM_ENABLED=!!(data===true||data?.enabled===true);
    }catch(err){
      console.warn('Centrale TomTom-status kon niet worden geladen:',err);
      window.GJ_TOMTOM_ENABLED=false;
    }
    return window.GJ_TOMTOM_ENABLED===true;
  }
  window.gjEnsureCentralTomTom=ensureCentralTomTom;

  function dayLegs(date){
    const visits=visitsOn(date);
    const points=[startPoint(),...visits.map(v=>getC(v.customerId)).filter(Boolean),startPoint()];
    const legs=[];
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],d=km(a,b);
      const mode=(i>0&&i<points.length-2&&d!==null&&d*1000<=Number(db.settings.walk||300))?'walk':'car';
      legs.push({a,b,mode,key:routeKey(a,b,mode)});
    }
    return legs;
  }

  function invalidateDayRouteCacheV109(date){
    if(!db.routeCache)return;
    for(const leg of dayLegs(date))delete db.routeCache[leg.key];
    if(db.routeStats)delete db.routeStats[date];
  }
  window.gjInvalidateDayRouteCache=invalidateDayRouteCacheV109;

  const originalRouteStats=routeStatsForDay;
  window.routeStatsForDay=routeStatsForDay=function(date){
    const stats=originalRouteStats(date);
    if(!stats)return stats;
    // v11 bewaart één gezaghebbend dagtotaal inclusief de terugrit. Dit mag
    // niet opnieuw worden afgekeurd doordat de oude lokale trajectcache leeg
    // is; laptop en iPhone lezen juist dit centrale huis-tot-huis-resultaat.
    if(stats.includesReturn===true)return stats;
    const legs=dayLegs(date);
    stats.live=legs.length>0&&legs.every(leg=>{
      const route=db.routeCache?.[leg.key];
      return !!(route&&(route.live===true||route.source==='TomTom'||route.source==='Live'));
    });
    return stats;
  };

  window.routeQualityDotStats=routeQualityDotStats=function(stats){
    const live=!!(stats&&stats.calculated&&stats.live===true);
    return `<span class="${live?'routeDotLive':'routeDotEstimate'}" title="${live?'Live routeberekening':'Geschatte route'}"></span>`;
  };

  window.refreshDayRoute=refreshDayRoute=async function(date){
    if(!date)return;
    invalidateDayRouteCacheV109(date);
    const online=await ensureCentralTomTom();
    if(online&&visitsOn(date).length)await calculateDayRoutes(date,false);
    saveRouteStats(date);
    save();
    render();
  };

  window.refreshChangedDays=refreshChangedDays=async function(dates){
    const unique=[...new Set((dates||[]).filter(Boolean))];
    unique.forEach(invalidateDayRouteCacheV109);
    const online=await ensureCentralTomTom();
    if(online){
      for(const date of unique)if(visitsOn(date).length)await calculateDayRoutes(date,false);
    }
    unique.forEach(saveRouteStats);
    save();
    render();
  };

  const originalGeneratePlanning=generatePlanning;
  window.generatePlanning=generatePlanning=async function(){
    await ensureCentralTomTom();
    return originalGeneratePlanning.apply(this,arguments);
  };

  const DAY_MIME='application/x-planning-gjsystems-day';
  let draggingDay='';
  window.startDragDay=function(ev,date){
    if(!date||!visitsOn(date).length){ev.preventDefault();return}
    draggingDay=date;
    ev.dataTransfer.effectAllowed='move';
    ev.dataTransfer.setData(DAY_MIME,date);
    ev.dataTransfer.setData('text/plain','day:'+date);
    ev.currentTarget.classList.add('v109DayDragging');
    document.body.classList.add('draggingDay');
  };
  window.endDragDay=function(ev){
    ev?.currentTarget?.classList.remove('v109DayDragging');
    document.body.classList.remove('draggingDay');
    document.querySelectorAll('.v109DayDrop').forEach(x=>x.classList.remove('v109DayDrop'));
    draggingDay='';
  };

  async function syncMovedDay(oldDate,newDate,visits,departure){
    for(const visit of visits){
      if(window.gjPreserveTerminalStatus)await window.gjPreserveTerminalStatus(window.GJ_AUTH?.sb,visit);
      if(window.gjSyncMovedVisitToSupabase)await window.gjSyncMovedVisitToSupabase(visit,oldDate,newDate);
    }
    const client=window.GJ_AUTH?.sb;
    const userId=window.GJ_AUTH?.workspaceUserId||window.GJ_AUTH?.profile?.id;
    if(client&&userId){
      if(departure){
        const row={user_id:userId,datum:newDate,vertrektijd:departure+':00',updated_at:new Date().toISOString()};
        const up=await client.from('app_day_settings').upsert(row,{onConflict:'user_id,datum'});
        if(up.error)console.warn('Vertrektijd van verplaatste dag opslaan:',up.error);
      }
      const del=await client.from('app_day_settings').delete().eq('user_id',userId).eq('datum',oldDate);
      if(del.error)console.warn('Oude daginstelling verwijderen:',del.error);
      const legs=dayLegs(newDate);
      for(let i=0;i<visits.length;i++){
        const visit=visits[i],route=db.routeCache?.[legs[i]?.key];
        if(!route||!/^[0-9a-f-]{36}$/i.test(String(visit.id||'')))continue;
        const parking=legs[i]?.mode==='car'?Number(db.settings.parking||15):0;
        const patch={
          route_volgorde:i+1,
          reistijd_min:Number(route.min||0)+parking,
          afstand_km:Number(route.km||0),
          route_mode:legs[i]?.mode||'car',
          route_live:route.live===true||route.source==='TomTom',
          updated_at:new Date().toISOString()
        };
        const result=await client.from('planning').update(patch).eq('id',visit.id);
        if(result.error)console.warn('Route van verplaatste dag opslaan:',result.error);
      }
    }
  }

  async function moveWholeDay(oldDate,newDate){
    if(!oldDate||oldDate===newDate)return;
    const source=visitsOn(oldDate).slice();
    if(!source.length)return;
    if(visitsOn(newDate).length){alert('Zet een complete dag alleen op een lege dag.');return}
    for(const visit of source){
      const customer=getC(visit.customerId)||{};
      const reason=blockReason(newDate,customer);
      if(reason&&!String(reason).toLowerCase().includes('thuiswerk')){alert(`Deze dag is geblokkeerd: ${reason}.`);return}
      const possible=visitWindowPossibleOnDate(customer,newDate,visit.duration||customer.Bezoektijd||60);
      if(!possible.ok){alert(`${customer.Winkel||'Klant'} kan niet naar ${displayDate(newDate)}: ${possible.reason}.`);return}
    }
    if(!confirm(`Complete dag met ${source.length} klant${source.length===1?'':'en'} verplaatsen naar ${displayDate(newDate)}?`))return;
    const departure=db.dayDepartures?.[oldDate]||'';
    for(const visit of source)visit.date=newDate;
    for(const fixed of db.fixed||[])if(fixed.date===oldDate)fixed.date=newDate;
    if(departure){db.dayDepartures[newDate]=departure;delete db.dayDepartures[oldDate]}
    if(db.disabledBreaks?.[oldDate]){db.disabledBreaks[newDate]=true;delete db.disabledBreaks[oldDate]}
    if(db.routeStats){delete db.routeStats[oldDate];delete db.routeStats[newDate]}
    save();
    state.selected=newDate;
    state.cursor=dateObj(newDate);
    render();
    await refreshChangedDays([oldDate,newDate]);
    await syncMovedDay(oldDate,newDate,source,departure);
    if(window.syncChangedPlanningDates)await window.syncChangedPlanningDates([newDate]);
  }
  window.gjMoveWholeDay=moveWholeDay;

  function decorateCalendarDays(){
    document.querySelectorAll('.dayCell,.weekCol').forEach(cell=>{
      const inline=cell.getAttribute('onclick')||'';
      const match=inline.match(/selectDate\('([0-9]{4}-[0-9]{2}-[0-9]{2})'\)/);
      const date=match?.[1];
      if(!date||!visitsOn(date).length){
        cell.classList.remove('v109DayDraggable');
        cell.removeAttribute('draggable');
        cell.querySelector('.v109DayHandle')?.remove();
        return;
      }
      cell.classList.add('v109DayDraggable');
      cell.draggable=true;
      cell.dataset.v109Day=date;
      if(!cell.querySelector('.v109DayHandle')){
        const handle=document.createElement('span');
        handle.className='v109DayHandle';
        handle.title='Sleep de complete dag';
        handle.textContent='↕';
        (cell.querySelector('.dayNo,.weekDateTitle')||cell).appendChild(handle);
      }
      if(cell.dataset.v109Bound!=='1'){
        cell.dataset.v109Bound='1';
        cell.addEventListener('dragstart',ev=>{
          /* Een losse klant blijft apart versleepbaar; alleen de dagcel start een dagverplaatsing. */
          if(ev.target.closest('.customer'))return;
          window.startDragDay(ev,cell.dataset.v109Day);
        });
        cell.addEventListener('dragend',window.endDragDay);
      }
    });
  }
  const calendarObserver=new MutationObserver(()=>decorateCalendarDays());
  calendarObserver.observe(document.body,{subtree:true,childList:true});
  setTimeout(decorateCalendarDays,0);

  const originalDropVisit=dropVisitOnDate;
  window.dropVisitOnDate=dropVisitOnDate=function(ev,date){
    const transferred=ev.dataTransfer?.getData(DAY_MIME)||ev.dataTransfer?.getData('text/plain')||draggingDay;
    const oldDate=String(transferred||'').replace(/^day:/,'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(oldDate)){
      ev.preventDefault();
      ev.stopPropagation();
      window.endDragDay(ev);
      moveWholeDay(oldDate,date).catch(err=>{console.error(err);alert('Dag verplaatsen mislukt: '+err.message)});
      return;
    }
    return originalDropVisit.apply(this,arguments);
  };

  const originalAllowDrop=allowVisitDrop;
  window.allowVisitDrop=allowVisitDrop=function(ev,date){
    originalAllowDrop.apply(this,arguments);
    const transferred=ev.dataTransfer?.types&&[...ev.dataTransfer.types].includes(DAY_MIME);
    if(transferred||draggingDay)ev.currentTarget.classList.add('v109DayDrop');
  };
  const originalLeaveDrop=leaveVisitDrop;
  window.leaveVisitDrop=leaveVisitDrop=function(ev){
    ev.currentTarget.classList.remove('v109DayDrop');
    return originalLeaveDrop.apply(this,arguments);
  };

  /* Nooit een reeds definitieve status terugzetten door een route-/tijdsync. */
  window.gjPreserveTerminalStatus=async function(client,visit){
    if(!client||!visit||terminalStatus(visit.status))return visit?.status||'';
    if(!/^[0-9a-f-]{36}$/i.test(String(visit.id||'')))return visit.status||'';
    const {data,error}=await client.from('planning').select('status,uitgevoerd').eq('id',visit.id).maybeSingle();
    if(!error&&data&&(terminalStatus(data.status)||data.uitgevoerd===true)){
      visit.status=data.status||'Uitgevoerd';
      return visit.status;
    }
    return visit.status||'';
  };

  if(window.syncChangedPlanningDates){
    const originalSyncChanged=window.syncChangedPlanningDates;
    window.syncChangedPlanningDates=async function(dates){
      const client=window.GJ_AUTH?.sb;
      const unique=[...new Set((dates||[]).filter(Boolean))];
      for(const date of unique)for(const visit of visitsOn(date))await window.gjPreserveTerminalStatus(client,visit);
      return originalSyncChanged.apply(this,arguments);
    };
  }
})();
