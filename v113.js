/* Planning-GJsystems v11.3.1: authoritative routes, import validation and database filters. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),laptop=!!$('dbTable');
  if(!laptop)return;
  const esc113=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let customerFilter='all',loadingDays=false;

  function locationState(customer){
    if(customer?._locationStatus==='auto'&&validCoordsForCustomer(customer))return 'auto';
    return validCoordsForCustomer(customer)?'valid':'invalid';
  }
  function locationLabel(customer){
    const state=locationState(customer);
    return state==='valid'?'Coördinaten geldig voor TomTom':state==='auto'?'Coördinaten automatisch gevonden; controleer en sla op':'Coördinaten ontbreken of zijn ongeldig';
  }
  function locationDot(customer){const status=locationState(customer);return `<span class="v113LocationDot ${status}" title="${esc113(locationLabel(customer))}" aria-label="${esc113(locationLabel(customer))}"></span>`}

  function ensureDatabaseFilters(){
    const search=$('dbSearch');if(!search||$('v113DbFilters'))return;
    search.insertAdjacentHTML('beforebegin','<div id="v113DbFilters" class="v113DbFilters" role="group" aria-label="Klanten filteren"><button type="button" data-db-filter="all" class="active">Alle klanten</button><button type="button" data-db-filter="active">Actieve klanten</button><button type="button" data-db-filter="inactive">Inactieve klanten</button></div>');
  }

  function collectRenderedCustomerFields(){
    document.querySelectorAll('#dbTable [data-row][data-field]').forEach(input=>{
      const customer=db.customers[Number(input.dataset.row)];if(customer)customer[input.dataset.field]=input.value;
    });
  }

  function renderDatabase113(){
    ensureDatabaseFilters();
    const query=low($('dbSearch')?.value||''),sort=state.sort;
    const filtered=db.customers.filter(customer=>{
      const active=isActive(customer);
      if(customerFilter==='active'&&!active)return false;
      if(customerFilter==='inactive'&&active)return false;
      return !query||JSON.stringify(customer).toLowerCase().includes(query);
    }).sort((a,b)=>str(a[sort.field]).localeCompare(str(b[sort.field]),'nl',{numeric:true})*sort.dir);
    const rows=filtered.slice(0,300),notice=$('dbRenderNotice');
    if(notice)notice.textContent=filtered.length>rows.length?`De eerste ${rows.length} van ${filtered.length} klanten worden getoond.`:`${filtered.length} klant${filtered.length===1?'':'en'}`;
    const headers=['Locatie',...HEADERS];
    let html=`<thead><tr>${headers.map(header=>header==='Locatie'?'<th>Locatie</th>':`<th class="sort" onclick="sortDb('${header}')">${header}${sort.field===header?(sort.dir>0?' ▲':' ▼'):''}</th>`).join('')}</tr></thead><tbody>`;
    for(const customer of rows){
      const rowIndex=db.customers.indexOf(customer);
      html+='<tr><td class="v113LocationCell">'+locationDot(customer)+'</td>';
      for(const header of HEADERS){
        if(header==='Actief')html+=`<td><select data-row="${rowIndex}" data-field="Actief"><option value="Ja" ${isActive(customer)?'selected':''}>Ja</option><option value="Nee" ${!isActive(customer)?'selected':''}>Nee</option></select></td>`;
        else html+=`<td><input data-row="${rowIndex}" data-field="${header}" value="${esc113(customer[header])}"></td>`;
      }
      html+='</tr>';
    }
    $('dbTable').innerHTML=html+'</tbody>';
    document.querySelectorAll('[data-db-filter]').forEach(button=>button.classList.toggle('active',button.dataset.dbFilter===customerFilter));
  }

  async function syncActiveCustomer(customer,previous){
    const client=window.GJ_AUTH?.sb||supa;if(!client)throw new Error('Supabase niet verbonden.');
    const active=isActive(customer);
    const response=await client.from('customers').update({actief:active,meenemen_in_planning:active,updated_at:new Date().toISOString()}).eq('klantnummer',String(customer.ID));
    if(response.error){customer.Actief=previous;throw response.error}
  }

  async function validateCustomerLocations(customers,{all=false}={}){
    const targets=(customers||[]).filter(customer=>!validCoordsForCustomer(customer)&&(all||isActive(customer)));
    if(!targets.length)return {valid:(customers||[]).filter(validCoordsForCustomer).length,auto:0,invalid:0};
    $('progressDialog')?.showModal();let repaired=0;
    try{
      for(let index=0;index<targets.length;index++){
        if($('progressText'))$('progressText').textContent=`Locatie ${index+1} van ${targets.length} controleren...`;
        if($('progressFill'))$('progressFill').style.width=`${Math.round((index+1)/targets.length*100)}%`;
        const fixed=await geocodeCustomer(targets[index]);
        targets[index]._locationStatus=fixed?'auto':'invalid';if(fixed)repaired++;
      }
    }finally{$('progressDialog')?.close()}
    return {valid:(customers||[]).filter(customer=>locationState(customer)==='valid').length,auto:repaired,invalid:(customers||[]).filter(customer=>locationState(customer)==='invalid').length};
  }

  async function saveDatabase113(){
    collectRenderedCustomerFields();save();
    setSyncStatus('Klantlocaties controleren...','busy');
    const report=await validateCustomerLocations(db.customers,{all:false});renderDatabase113();save();
    const invalidActive=db.customers.filter(customer=>isActive(customer)&&!validCoordsForCustomer(customer));
    if(invalidActive.length){setSyncStatus(`${invalidActive.length} actieve klant${invalidActive.length===1?' heeft':'en hebben'} geen geldige locatie. Herstel de rode regels eerst.`,'err');return false}
    const ok=await importCustomersToSupabase(db.customers,false);
    if(ok){db.customers.forEach(customer=>{if(validCoordsForCustomer(customer))delete customer._locationStatus});save();renderDatabase113();setSyncStatus(`Supabase bijgewerkt. ${report.auto} locatie${report.auto===1?'':'s'} automatisch hersteld.`,'ok')}
    return ok;
  }

  async function importExcel113(){
    const file=$('excelFile')?.files?.[0];if(!file)return;
    setSyncStatus('Excel lezen en locaties controleren...','busy');
    const reader=new FileReader();
    reader.onload=async event=>{
      try{
        const workbook=XLSX.read(event.target.result,{type:'array'}),sheet=workbook.Sheets[workbook.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
        if(!rows.length)throw new Error('Excel bevat geen regels.');
        const customers=rows.map((row,index)=>{const customer={};HEADERS.forEach(header=>customer[header]=pickExcelValue(row,header)??'');if(!String(customer.ID||'').trim())customer.ID=`AUTO-${Date.now()}-${index+1}`;if(!String(customer.Actief||'').trim())customer.Actief='Ja';return customer});
        db.customers=customers;save();nav('database');renderDatabase113();
        const report=await validateCustomerLocations(customers,{all:true});save();renderDatabase113();
        const invalid=customers.filter(customer=>!validCoordsForCustomer(customer));
        if(invalid.length){setSyncStatus(`Import gepauzeerd: ${invalid.length} klant${invalid.length===1?' heeft':'en hebben'} een rode locatie. Pas deze regels aan en klik daarna op Opslaan.`,'err');return}
        if(!confirm(`${customers.length} klanten gecontroleerd. ${report.auto} locatie${report.auto===1?' is':'s zijn'} automatisch gevonden. Nu definitief naar Supabase schrijven?`)){setSyncStatus('Import gecontroleerd maar nog niet naar Supabase geschreven.','busy');return}
        const ok=await importCustomersToSupabase(customers,true);
        if(ok){db.customers.forEach(customer=>delete customer._locationStatus);save();renderDatabase113()}
      }catch(error){console.error(error);setSyncStatus('Import fout: '+error.message,'err')}
      finally{if($('excelFile'))$('excelFile').value=''}
    };
    reader.readAsArrayBuffer(file);
  }

  function decorateDateFilters(){
    for(const id of ['dateFilterFrom','dateFilterTo','historyDateFrom','historyDateTo']){
      const input=$(id),label=input?.closest('label'),container=input?.closest('.filters');if(label)label.classList.add('v113DateLabel');if(container)container.classList.add('v113CompactDates');
    }
  }

  function mapDayRoute(row){
    const route=row.settings?.day_route;if(!route)return null;
    return {km:Number(route.km||0),driveMin:Number(route.travelMin||0),totalMin:Number(route.dayMin||0),start:row.vertrektijd?String(row.vertrektijd).slice(0,5):'',end:route.end||'',calculated:route.live===true,live:route.live===true,includesReturn:route.includesReturn===true,returnLeg:route.returnLeg||null,inputHash:route.inputHash||null,hash:route.hash||null,updatedAt:route.calculatedAt||row.updated_at};
  }

  async function loadAuthoritativeDaySettings(){
    if(loadingDays||!window.GJ_AUTH?.sb||typeof db==='undefined')return false;loadingDays=true;
    try{
      let query=GJ_AUTH.sb.from('app_day_settings').select('datum,vertrektijd,settings,updated_at');
      const workspace=GJ_AUTH.workspaceUserId||GJ_AUTH.profile?.id;if(workspace)query=query.eq('user_id',workspace);
      const response=await query;if(response.error)throw response.error;
      db.routeStats=db.routeStats||{};db.dayDepartures=db.dayDepartures||{};
      const remoteDates=new Set();
      for(const row of response.data||[]){if(!row.datum)continue;remoteDates.add(row.datum);if(row.vertrektijd)db.dayDepartures[row.datum]=String(row.vertrektijd).slice(0,5);const stats=mapDayRoute(row);if(stats)db.routeStats[row.datum]=stats}
      for(const date of Object.keys(db.routeStats))if(visitsOn(date).length&&!remoteDates.has(date))delete db.routeStats[date];
      save();render();return true;
    }catch(error){console.warn('Dagstatussen laden mislukt',error);return false}finally{loadingDays=false}
  }

  function bind(){
    ensureDatabaseFilters();decorateDateFilters();window.renderDb=renderDb=renderDatabase113;
    if($('dbSearch'))$('dbSearch').oninput=renderDatabase113;
    if($('btnSaveDb'))$('btnSaveDb').onclick=()=>saveDatabase113().catch(error=>{console.error(error);setSyncStatus('Opslaan mislukt: '+error.message,'err')});
    if($('excelFile'))$('excelFile').onchange=()=>importExcel113();
    $('v113DbFilters')?.addEventListener('click',event=>{const button=event.target.closest('[data-db-filter]');if(!button)return;collectRenderedCustomerFields();customerFilter=button.dataset.dbFilter;renderDatabase113()});
    $('dbTable')?.addEventListener('change',async event=>{
      const input=event.target.closest('[data-row][data-field]');if(!input)return;const customer=db.customers[Number(input.dataset.row)];if(!customer)return;
      const previous=customer[input.dataset.field];customer[input.dataset.field]=input.value;save();
      if(input.dataset.field==='Actief'){renderDatabase113();try{await syncActiveCustomer(customer,previous);setSyncStatus(`Klant is nu ${isActive(customer)?'actief':'inactief'} en gesynchroniseerd.`,'ok')}catch(error){renderDatabase113();setSyncStatus('Actief wijzigen mislukt: '+error.message,'err')}}
      else if(input.dataset.field==='Latitude'||input.dataset.field==='Longitude')renderDatabase113();
    });
    const originalLoad=window.loadPlanningFromSupabase;
    if(typeof originalLoad==='function')window.loadPlanningFromSupabase=async function(){const result=await originalLoad.apply(this,arguments);await loadAuthoritativeDaySettings();return result};
    renderDatabase113();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  window.addEventListener('gj-auth-ready',()=>setTimeout(loadAuthoritativeDaySettings,1100));
  window.GJ_V113={locationState,loadAuthoritativeDaySettings,renderDatabase:renderDatabase113,validateCustomerLocations};
})();
