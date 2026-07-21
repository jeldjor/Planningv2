/* Planyx dagveiligheid: hele dag uit planning en afgeronde opdrachten vergrendelen. */
(function(){
  'use strict';

  const TERMINAL=new Set(['uitgevoerd','niet uitgevoerd','bezocht']);
  const normalized=value=>String(value||'').trim().toLowerCase();
  const isTerminal=visit=>!!visit&&(visit.uitgevoerd===true||TERMINAL.has(normalized(visit.status)));
  const workspaceId=()=>window.GJ_AUTH?.workspaceUserId||window.GJ_AUTH?.profile?.id||null;
  const supabase=()=>window.GJ_AUTH?.sb||null;
  const desktopDb=()=>{try{return db}catch(_){return null}};
  const desktopState=()=>{try{return state}catch(_){return null}};
  const rpcMessage=error=>{
    const message=String(error?.message||error||'Onbekende fout');
    return /remove_planning_day|move_planning_day|does not exist|schema cache/i.test(message)
      ? message+'\n\nVoer eerst SUPABASE_V11_3_8_DAY_LOCK.sql uit in Supabase.'
      : message;
  };

  async function removeDay(date,visits,after){
    const visible=visits.filter(visit=>!visit.pause&&visit.status!=='Uit planning');
    const open=visible.filter(visit=>!isTerminal(visit));
    const locked=visible.filter(isTerminal);
    if(!open.length){
      alert(locked.length?'Deze dag bevat alleen uitgevoerde opdrachten. Die blijven op deze datum staan.':'Deze dag bevat geen geplande opdrachten.');
      return;
    }
    const lockedText=locked.length?`\n\n${locked.length} uitgevoerde opdracht${locked.length===1?' blijft':'en blijven'} op deze datum staan.`:'';
    if(!confirm(`Hele dag uit planning halen?\n\n${open.length} openstaande opdracht${open.length===1?' wordt':'en worden'} uit de planning gehaald.${lockedText}`))return;
    const client=supabase();
    if(!client)throw new Error('Supabase is nog niet verbonden. Log opnieuw in.');
    const result=await client.rpc('remove_planning_day',{p_workspace_id:workspaceId(),p_date:date});
    if(result.error)throw new Error(rpcMessage(result.error));
    if(Number(result.data?.removed)!==open.length)throw new Error('De database heeft niet alle openstaande opdrachten bevestigd. Vernieuw de planning en probeer opnieuw.');
    open.forEach(visit=>{visit.status='Uit planning';visit.routeLive=false;visit.route_live=false;});
    await after?.({open,locked,result:result.data});
  }

  function installLaptop(){
    const lockText='Deze opdracht is uitgevoerd en blijft op de oorspronkelijke datum staan. Alleen Planning leegmaken of Alles resetten kan deze verwijderen.';
    const data=desktopDb;

    const originalCustomerRow=window.customerRow;
    if(typeof originalCustomerRow==='function'){
      window.customerRow=customerRow=function(visit){
        let html=originalCustomerRow.apply(this,arguments);
        if(!isTerminal(visit))return html;
        return html.replace('class="customer ','class="customer v114LockedVisit ')
          .replace(/\sdraggable="true"\sondragstart="[^"]*"\sondragend="[^"]*"/,'')
          .replace(/<button class="secondary" onclick="openMoveDialogForVisit\('[^']+'\)">Herplan<\/button>/,'')
          .replace(/<button class="secondary" onclick="moveOut\('[^']+'\)">Uit planning<\/button>/,'')
          .replace('<div class="actions">','<div class="actions"><span class="v114LockedBadge" title="'+lockText+'">🔒 Datum vergrendeld</span>');
      };
    }

    if(typeof window.openMoveDialogForVisit==='function'){
      const original=window.openMoveDialogForVisit;
      window.openMoveDialogForVisit=openMoveDialogForVisit=function(id){const visit=(data()?.visits||[]).find(v=>String(v.id)===String(id));if(isTerminal(visit)){alert(lockText);return;}return original.apply(this,arguments);};
    }
    if(typeof window.moveOut==='function'){
      const original=window.moveOut;
      window.moveOut=moveOut=function(id){const visit=(data()?.visits||[]).find(v=>String(v.id)===String(id));if(isTerminal(visit)){alert(lockText);return;}return original.apply(this,arguments);};
    }
    if(typeof window.startDragVisit==='function'){
      const original=window.startDragVisit;
      window.startDragVisit=startDragVisit=function(event,id){const visit=(data()?.visits||[]).find(v=>String(v.id)===String(id));if(isTerminal(visit)){event.preventDefault();alert(lockText);return;}return original.apply(this,arguments);};
    }
    if(typeof window.editVisitTime==='function'){
      const original=window.editVisitTime;
      window.editVisitTime=editVisitTime=function(id){const visit=(data()?.visits||[]).find(v=>String(v.id)===String(id));if(isTerminal(visit)){alert('De tijden van een uitgevoerde opdracht zijn vergrendeld.');return;}return original.apply(this,arguments);};
    }
    if(typeof window.saveMoveDialog==='function'){
      const original=window.saveMoveDialog;
      window.saveMoveDialog=saveMoveDialog=function(){const s=desktopState(),visit=s?.moveMode==='visit'?(data()?.visits||[]).find(v=>String(v.id)===String(s.moveVisitId)):null;if(isTerminal(visit)){alert(lockText);document.getElementById('moveDialog')?.close();return;}return original.apply(this,arguments);};
    }

    if(typeof window.generatePlanning==='function'){
      const original=window.generatePlanning;
      window.generatePlanning=generatePlanning=async function(){
        const snapshots=(data()?.visits||[]).filter(isTerminal).map(visit=>({visit,date:visit.date,status:visit.status,time:visit.time,end:visit.end,order:visit.order}));
        try{return await original.apply(this,arguments);}
        finally{snapshots.forEach(item=>Object.assign(item.visit,{date:item.date,status:item.status,time:item.time,end:item.end,order:item.order}));window.save?.();window.render?.();}
      };
    }

    async function moveOpenPartOfDay(oldDate,newDate){
      if(!oldDate||oldDate===newDate)return;
      const all=(window.visitsOn?.(oldDate)||[]).filter(visit=>visit.status!=='Uit planning');
      const source=all.filter(visit=>!isTerminal(visit)),locked=all.filter(isTerminal);
      if(!source.length){alert('Deze dag bevat alleen uitgevoerde opdrachten en kan daarom niet worden verplaatst.');return;}
      if((window.visitsOn?.(newDate)||[]).length){alert('Zet een complete dag alleen op een lege dag.');return;}
      for(const visit of source){
        const customer=window.getC?.(visit.customerId)||{},reason=window.blockReason?.(newDate,customer);
        if(reason&&!String(reason).toLowerCase().includes('thuiswerk')){alert(`Deze dag is geblokkeerd: ${reason}.`);return;}
        const possible=window.visitWindowPossibleOnDate?.(customer,newDate,visit.duration||customer.Bezoektijd||60);
        if(possible&&!possible.ok){alert(`${customer.Winkel||'Klant'} kan niet naar ${window.displayDate?.(newDate)||newDate}: ${possible.reason}.`);return;}
      }
      const lockedText=locked.length?`\n\n${locked.length} uitgevoerde opdracht${locked.length===1?' blijft':'en blijven'} op ${window.displayDate?.(oldDate)||oldDate} staan.`:'';
      if(!confirm(`${source.length} openstaande opdracht${source.length===1?'':'en'} verplaatsen naar ${window.displayDate?.(newDate)||newDate}?${lockedText}`))return;
      const client=supabase();if(!client){alert('Supabase is nog niet verbonden.');return;}
      try{
        const result=await client.rpc('move_planning_day',{p_workspace_id:workspaceId(),p_old_date:oldDate,p_new_date:newDate});
        if(result.error)throw result.error;
        if(Number(result.data?.moved)!==source.length)throw new Error('Niet alle openstaande opdrachten zijn door de database bevestigd.');
        source.forEach(visit=>{visit.date=newDate;visit.time='';visit.end='';});
        if(data()?.routeStats){delete data().routeStats[oldDate];delete data().routeStats[newDate];}
        window.save?.();const s=desktopState();if(s){s.selected=newDate;s.cursor=window.dateObj?.(newDate)||s.cursor;}window.render?.();await window.loadPlanningFromSupabase?.();
      }catch(error){console.error(error);alert('Dag verplaatsen mislukt: '+rpcMessage(error));}
    }
    window.gjMoveWholeDayStable=moveOpenPartOfDay;window.gjMoveWholeDay=moveOpenPartOfDay;

    const previousDrop=window.dropVisitOnDate;
    if(typeof previousDrop==='function'){
      window.dropVisitOnDate=dropVisitOnDate=function(event,date){
        const raw=event.dataTransfer?.getData('application/x-planning-gjsystems-day')||event.dataTransfer?.getData('text/plain')||'',oldDate=String(raw).replace(/^day:/,'');
        if(/^\d{4}-\d{2}-\d{2}$/.test(oldDate)){event.preventDefault();event.stopPropagation();window.endDragDay?.(event);moveOpenPartOfDay(oldDate,date);return;}
        const visit=(data()?.visits||[]).find(v=>String(v.id)===String(raw));
        if(isTerminal(visit)){event.preventDefault();event.stopPropagation();alert(lockText);return;}
        return previousDrop.apply(this,arguments);
      };
    }
    if(typeof window.startDragDay==='function'){
      const original=window.startDragDay;
      window.startDragDay=function(event,date){if((window.visitsOn?.(date)||[]).every(isTerminal)){event.preventDefault();alert('Deze dag bevat alleen uitgevoerde opdrachten en kan niet worden verplaatst.');return;}return original.apply(this,arguments);};
    }

    const routeHead=document.querySelector('.routeHead');
    if(routeHead&&!document.getElementById('v114RemoveDay')){
      const optimize=document.getElementById('btnOptimize'),actions=document.createElement('div');actions.className='v114DayActions';
      optimize?.parentNode?.insertBefore(actions,optimize);if(optimize)actions.appendChild(optimize);
      const button=document.createElement('button');button.id='v114RemoveDay';button.type='button';button.className='v114RemoveDay';button.textContent='Hele dag uit planning';actions.appendChild(button);
      button.addEventListener('click',async()=>{button.disabled=true;try{const date=desktopState()?.selected;await removeDay(date,(data()?.visits||[]).filter(visit=>visit.date===date),async({open})=>{if(data()?.unplanned)open.forEach(visit=>data().unplanned.push({id:window.uuid?.()||crypto.randomUUID(),customerId:visit.customerId,customerName:window.getC?.(visit.customerId)?.Winkel,oldDate:date,reason:'Hele dag uit planning gehaald'}));if(data()?.fixed)data().fixed=data().fixed.filter(fixed=>!open.some(visit=>String(visit.id)===String(fixed.visitId)));if(data()?.routeStats)delete data().routeStats[date];window.save?.();window.render?.();await window.loadPlanningFromSupabase?.();});}catch(error){console.error(error);alert('Dag uit planning halen mislukt: '+rpcMessage(error));}finally{button.disabled=false;}});
    }
  }

  function installMobile(){
    const state=()=>window.GJ_MOBILE?.state?.()||{},findVisit=id=>(state().visits||[]).find(visit=>String(visit.id)===String(id)||String(visit.planningId)===String(id));
    if(window.GJ_MOBILE?.removeFromPlanning){const original=window.GJ_MOBILE.removeFromPlanning;window.GJ_MOBILE.removeFromPlanning=async function(id){if(isTerminal(findVisit(id)))throw new Error('Deze opdracht is uitgevoerd en blijft op de oorspronkelijke datum staan.');return original.apply(this,arguments);};}
    document.addEventListener('click',event=>{const action=event.target.closest('.removePlan,.moveUp,.moveDown,.eyeBtn,.saveTimeBtn');if(!action||!isTerminal(findVisit(action.dataset.id)))return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();alert('Deze opdracht is uitgevoerd en blijft op de oorspronkelijke datum staan.');},true);
    const lockCards=()=>document.querySelectorAll('.visitCard').forEach(card=>{const action=card.querySelector('[data-id]'),visit=action?findVisit(action.dataset.id):null;if(!isTerminal(visit))return;card.classList.add('v114LockedVisit');card.querySelectorAll('.moveUp,.moveDown,.removePlan,.eyeBtn,.saveTimeBtn').forEach(button=>button.remove());if(!card.querySelector('.v114LockedBadge'))card.querySelector('.smallBtns')?.insertAdjacentHTML('beforebegin','<span class="v114LockedBadge">🔒 Datum vergrendeld</span>');});
    new MutationObserver(lockCards).observe(document.getElementById('todayRoute')||document.body,{childList:true,subtree:true});lockCards();
    const smallButtons=document.querySelector('#today .smallBtns');
    if(smallButtons&&!document.getElementById('v114MobileRemoveDay')){
      const button=document.createElement('button');button.id='v114MobileRemoveDay';button.type='button';button.className='v114RemoveDay';button.textContent='Hele dag uit planning halen';smallButtons.insertAdjacentElement('afterend',button);
      button.addEventListener('click',async()=>{button.disabled=true;try{const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;await removeDay(date,(state().visits||[]).filter(visit=>visit.date===date),async()=>{window.GJ_MOBILE.persist?.();await window.GJ_MOBILE.sync?.(false);window.GJ_MOBILE.render?.();});}catch(error){console.error(error);alert('Dag uit planning halen mislukt: '+rpcMessage(error));}finally{button.disabled=false;}});
    }
  }

  window.GJ_DAY_LOCK={isTerminal,removeDay};
  if(document.body?.dataset.gjDeviceLocation==='disabled')installLaptop();else installMobile();
})();
