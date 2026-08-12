(function(){
  "use strict";
  if(window.__GJ_COURIER_V1146__)return;
  window.__GJ_COURIER_V1146__=true;

  var state={orders:[],settings:{},courier:{},date:"",summary:null,review:null,busy:false,channel:null,map:null,mapLayer:null};
  var byId=function(id){return document.getElementById(id)};
  var esc=function(value){return String(value==null?"":value).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
  var delay=function(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})};
  var today=function(){var d=new Date(),p=function(n){return String(n).padStart(2,"0")};return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())};
  var normalize=function(value){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")};
  var clean=function(value){return String(value==null?"":value).trim().replace(/\s+/g," ")};
  var number=function(value,fallback){var n=Number(value);return Number.isFinite(n)?n:(fallback==null?0:fallback)};
  var hash=function(value){var text=normalize(value),h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)};
  var workspaceId=function(){return window.GJ_AUTH&&GJ_AUTH.workspaceUserId||null};

  function mount(){
    if(byId("courierApp"))return;
    var root=document.createElement("div");
    root.id="courierApp";
    root.innerHTML=[
      "<header class='courierHeader'>",
        "<div class='courierBrand'><img src='planyx-login-transparent.png?v=114600' alt='Planyx'><div class='courierBrandText'><strong>Koeriersroute</strong><span>Importeren, controleren en bezorgen</span></div></div>",
        "<button id='courierSettingsButton' type='button'>Instellingen</button>",
        "<button id='courierLogout' type='button'>Uitloggen</button>",
      "</header>",
      "<main class='courierMain'>",
        "<section class='courierToolbar'>",
          "<label>Bezorgdatum<select id='courierDate'></select></label>",
          "<div class='courierToolbarActions'>",
            "<button id='courierImportButton' class='courierButton courierImportOnlyDesktop' type='button'>Excel importeren</button>",
            "<input id='courierFile' class='courierFile' type='file' accept='.xlsx,.xls,.csv'>",
            "<button id='courierValidate' class='courierButton secondary' type='button'>Adressen controleren</button>",
            "<button id='courierOptimize' class='courierButton' type='button'>Optimaliseer route</button>",
          "</div>",
        "</section>",
        "<div id='courierProgress' class='courierProgress'></div>",
        "<section id='courierStats' class='courierStats'></section>",
        "<section id='courierSummary' class='courierSummary'></section>",
        "<section id='courierMapPanel' class='courierMapPanel'><div class='courierSectionHead'><h2>Volledige route</h2><button id='courierFitRoute' class='courierButton secondary' type='button'>Alles in beeld</button></div><div id='courierMap' class='courierMap'></div></section>",
        "<section id='courierInvalidSection' class='courierSection'><div class='courierSectionHead'><h2>Adres controleren</h2><span id='courierInvalidCount' class='courierBadge'></span></div><div id='courierInvalidList' class='courierList'></div></section>",
        "<section class='courierSection'><div class='courierSectionHead'><h2>Bezorgroute</h2><span id='courierOpenCount' class='courierBadge'></span></div><div id='courierRouteList' class='courierList'></div></section>",
        "<section id='courierExcludedSection' class='courierSection'><div class='courierSectionHead'><h2>Uit route</h2><span id='courierExcludedCount' class='courierBadge'></span></div><div id='courierExcludedList' class='courierList'></div></section>",
        "<section id='courierDeliveredSection' class='courierSection'><div class='courierSectionHead'><h2>Bezorgd</h2><span id='courierDeliveredCount' class='courierBadge'></span></div><div id='courierDeliveredList' class='courierList'></div></section>",
      "</main>",
      "<div id='courierReviewBackdrop' class='courierReviewBackdrop' role='dialog' aria-modal='true'>",
        "<div class='courierReview'>",
          "<h2>Adres controleren</h2><p>TomTom wil het adres aanpassen. Kies eerst wat er moet gebeuren.</p>",
          "<div class='courierCompare'><div><small>Ingevoerd adres</small><strong id='courierReviewOriginal'></strong></div><div class='suggested'><small>Voorstel van TomTom</small><strong id='courierReviewSuggested'></strong></div></div>",
          "<label>Zelf aanpassen<input id='courierReviewInput' autocomplete='street-address'></label>",
          "<div id='courierReviewStatus' class='courierReviewStatus'></div>",
          "<div class='courierReviewActions'>",
            "<button id='courierReviewApprove' class='courierButton success' type='button'>Voorstel goedkeuren</button>",
            "<button id='courierReviewRecheck' class='courierButton' type='button'>Aanpassing controleren</button>",
            "<button id='courierReviewExclude' class='courierButton danger' type='button'>Niet meenemen</button>",
            "<button id='courierReviewLater' class='courierButton secondary' type='button'>Later controleren</button>",
          "</div>",
        "</div>",
      "</div>",
      "<dialog id='courierSettingsDialog' class='courierDialog'><form method='dialog' class='courierDialogBody'>",
        "<h2>Route-instellingen</h2>",
        "<div class='courierSettingsGrid'>",
          "<label class='wide'>Startadres<input id='courierStartAddress' autocomplete='street-address' placeholder='Straat, huisnummer, postcode en plaats'></label>",
          "<label class='wide courierCheck'><input id='courierEndSame' type='checkbox' checked> Eindigen op het startadres</label>",
          "<label class='wide'>Ander eindadres<input id='courierEndAddress' autocomplete='street-address' placeholder='Alleen invullen bij een ander eindadres'></label>",
          "<label>Vertrektijd<input id='courierDeparture' type='time' value='08:00'></label>",
          "<label>Navigatie<select id='courierNavigation'><option value='google'>Google Maps</option><option value='apple'>Apple Kaarten</option><option value='waze'>Waze</option></select></label>",
          "<div class='wide courierHelp'>Per afleveradres worden standaard twee minuten gerekend. Er geldt geen pauze, maximale werkduur of maximumaantal adressen.</div>",
        "</div>",
        "<div class='courierDialogActions'><button id='courierSettingsCancel' class='courierButton secondary' value='cancel'>Annuleren</button><button id='courierSettingsSave' class='courierButton' value='default' type='button'>Opslaan</button></div>",
      "</form></dialog>"
    ].join("");
    document.body.appendChild(root);
    bind();
  }

  function setProgress(message,type){
    var el=byId("courierProgress");
    if(!el)return;
    el.textContent=message||"";
    el.className="courierProgress"+(message?" show":"")+(type?" "+type:"");
  }

  function setBusy(value,message){
    state.busy=!!value;
    ["courierImportButton","courierValidate","courierOptimize"].forEach(function(id){var el=byId(id);if(el)el.disabled=state.busy});
    if(message)setProgress(message);
  }

  function dateValue(value){
    if(value instanceof Date&&!isNaN(value)){var p=function(n){return String(n).padStart(2,"0")};return value.getFullYear()+"-"+p(value.getMonth()+1)+"-"+p(value.getDate())}
    if(typeof value==="number"&&window.XLSX&&XLSX.SSF){var d=XLSX.SSF.parse_date_code(value);if(d)return d.y+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0")}
    var text=clean(value),m=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
    m=text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);if(m)return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
    return "";
  }

  function timeValue(value){
    if(value instanceof Date&&!isNaN(value))return String(value.getHours()).padStart(2,"0")+":"+String(value.getMinutes()).padStart(2,"0");
    if(typeof value==="number"){var total=Math.round(value*1440);return String(Math.floor(total/60)%24).padStart(2,"0")+":"+String(total%60).padStart(2,"0")}
    var m=clean(value).match(/^(\d{1,2}):(\d{2})/);return m?m[1].padStart(2,"0")+":"+m[2]:"";
  }

  function countryCode(row){
    var code=clean(row.d_country_code).toUpperCase();if(code)return code;
    var land=normalize(row.d_country);
    if(land==="netherlands"||land==="nederland")return "NL";
    if(land==="belgium"||land==="belgie")return "BE";
    if(land==="germany"||land==="duitsland")return "DE";
    return "";
  }

  function phoneValue(value,code){
    var text=clean(value);if(!text)return "";
    var plus=text.charAt(0)==="+",digits=text.replace(/\D/g,"");
    if(!plus&&code==="NL"&&digits.length===9)digits="0"+digits;
    return plus?"+"+digits:digits;
  }

  function phoneHref(value,code){
    var digits=String(value||"").replace(/\D/g,"");if(!digits)return "";
    if(String(value).trim().charAt(0)==="+")return "+"+digits;
    if(code==="NL"&&digits.charAt(0)==="0")return "+31"+digits.slice(1);
    return digits;
  }

  function combinedAddress(row){
    var a1=clean(row.d_address1),a2=clean(row.d_address2);
    var first=a1;
    if(a2&&normalize(a1).slice(-normalize(a2).length)!==normalize(a2))first=clean(a1+" "+a2);
    var country=countryCode(row)||clean(row.d_country);
    return [first,clean(row.d_zipcode),clean(row.d_city),country].filter(Boolean).join(", ");
  }

  function mapRow(row,index,existing){
    var deliveryDate=dateValue(row.delivery_date);
    if(!deliveryDate)throw new Error("Rij "+(index+2)+": delivery_date is leeg of ongeldig.");
    var cargo=clean(row.cargoid),cid=clean(row.c_id);
    if(!cargo&&!cid)throw new Error("Rij "+(index+2)+": cargoid en c_id ontbreken.");
    var external=cargo?"cargo:"+cargo:"c:"+cid,original=combinedAddress(row);
    if(!clean(row.d_address1)||!clean(row.d_zipcode)||!clean(row.d_city))throw new Error("Rij "+(index+2)+": afleveradres is niet compleet.");
    var key=hash(original),same=existing&&existing.source_address_key===key;
    var base={
      external_id:external,cargo_id:cargo||null,source_c_id:cid||null,source_status:clean(row.status)||null,
      reference:clean(row.referentie)||null,delivery_date:deliveryDate,
      delivery_time_from:timeValue(row.delivery_time_van)||null,delivery_time_to:timeValue(row.delivery_time_tot)||null,
      recipient_company:clean(row.d_company)||null,recipient_name:clean(row.d_name)||clean(row.d_company)||"Klant",
      recipient_phone:phoneValue(row.d_phone,countryCode(row))||null,address1:clean(row.d_address1)||null,
      address2:clean(row.d_address2)||null,postcode:clean(row.d_zipcode)||null,city:clean(row.d_city)||null,
      country:clean(row.d_country)||null,country_code:countryCode(row)||null,original_address:original,
      source_address_key:key,imported_at:new Date().toISOString(),updated_at:new Date().toISOString(),
      delivery_status:existing&&existing.delivery_status||"pending"
    };
    if(same){
      base.route_address=existing.route_address;base.validation_status=existing.validation_status||"unchecked";
      base.validation_message=existing.validation_message;base.tomtom_suggestion=existing.tomtom_suggestion;
      base.latitude=existing.latitude;base.longitude=existing.longitude;base.route_order=existing.route_order;
      base.arrival_label=existing.arrival_label;base.departure_label=existing.departure_label;
      base.travel_minutes=existing.travel_minutes;base.distance_km=existing.distance_km;base.delivered_at=existing.delivered_at;
    }else{
      base.route_address=null;base.validation_status="unchecked";base.validation_message=null;base.tomtom_suggestion=null;
      base.latitude=null;base.longitude=null;base.route_order=null;base.arrival_label=null;base.departure_label=null;
      base.travel_minutes=null;base.distance_km=null;base.delivered_at=existing&&existing.delivered_at||null;
    }
    return base;
  }

  async function importFile(file){
    if(!window.XLSX)throw new Error("Importeer dit bestand op de laptopversie.");
    setBusy(true,"Excelbestand lezen...");
    try{
      var data=await file.arrayBuffer(),book=XLSX.read(data,{type:"array",cellDates:true});
      var sheet=book.Sheets[book.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:"",raw:true});
      if(!rows.length)throw new Error("Het bestand bevat geen bezorgopdrachten.");
      var required=["c_id","cargoid","d_name","d_phone","d_address1","d_address2","d_zipcode","d_city","delivery_date"];
      var headers=Object.keys(rows[0]||{}),missing=required.filter(function(h){return headers.indexOf(h)<0});
      if(missing.length)throw new Error("Deze kolommen ontbreken: "+missing.join(", "));
      var existing=new Map(state.orders.map(function(order){return [order.external_id,order]})),mapped=new Map();
      rows.forEach(function(row,index){var old=existing.get((clean(row.cargoid)?"cargo:"+clean(row.cargoid):"c:"+clean(row.c_id)));var item=mapRow(row,index,old);mapped.set(item.external_id,item)});
      var values=Array.from(mapped.values());
      for(var offset=0;offset<values.length;offset+=100){
        setProgress("Opdrachten opslaan: "+Math.min(offset+100,values.length)+" van "+values.length+"...");
        var result=await GJ_AUTH.sb.from("courier_orders").upsert(values.slice(offset,offset+100),{onConflict:"user_id,external_id"});
        if(result.error)throw result.error;
      }
      state.date=values[0]&&values[0].delivery_date||state.date;
      await loadOrders();
      setProgress(values.length+" opdrachten geïmporteerd. Nieuwe adressen worden nu gecontroleerd.","success");
      await validateAddresses(true);
    }finally{
      setBusy(false);
      var input=byId("courierFile");if(input)input.value="";
    }
  }

  async function loadSettings(){
    var loaded=await GJPlanningCore.loadUserSettings(GJ_AUTH.sb,workspaceId());
    state.settings=loaded||{};
    var oldStart=state.settings.start||"",oldLat=number(state.settings.startLat,NaN),oldLng=number(state.settings.startLng,NaN);
    state.courier=Object.assign({
      startAddress:oldStart,startLat:Number.isFinite(oldLat)?oldLat:null,startLng:Number.isFinite(oldLng)?oldLng:null,
      endSame:true,endAddress:"",endLat:null,endLng:null,departure:state.settings.depart||"08:00",navigation:"google",stopMinutes:2
    },state.settings.courier||{});
  }

  async function loadOrders(){
    var result=await GJ_AUTH.sb.from("courier_orders").select("*").order("delivery_date",{ascending:true}).order("route_order",{ascending:true,nullsFirst:false});
    if(result.error)throw result.error;
    state.orders=result.data||[];
    var dates=Array.from(new Set(state.orders.map(function(x){return x.delivery_date}).filter(Boolean))).sort();
    if(!state.date||dates.indexOf(state.date)<0)state.date=dates.indexOf(today())>=0?today():(dates[0]||today());
    var day=await GJ_AUTH.sb.from("courier_route_days").select("summary").eq("delivery_date",state.date).maybeSingle();
    state.summary=day.error?null:(day.data&&day.data.summary||null);
    render();
  }

  function ordersForDate(){
    return state.orders.filter(function(order){return order.delivery_date===state.date});
  }

  function invalidOrder(order){
    return order.delivery_status==="pending"&&order.validation_status!=="valid";
  }

  function statsHtml(day){
    var open=day.filter(function(x){return x.delivery_status==="pending"&&x.validation_status==="valid"}).length;
    var invalid=day.filter(invalidOrder).length,delivered=day.filter(function(x){return x.delivery_status==="delivered"}).length;
    var excluded=day.filter(function(x){return x.delivery_status==="excluded"}).length;
    return [
      ["Totaal",day.length],["Te bezorgen",open],["Adrescontrole",invalid],["Bezorgd",delivered],["Uit route",excluded]
    ].map(function(item){return "<div class='courierStat'><strong>"+item[1]+"</strong><span>"+item[0]+"</span></div>"}).join("");
  }

  function card(order,index,kind){
    var name=order.recipient_name||order.recipient_company||"Klant",company=order.recipient_company&&order.recipient_company!==name?order.recipient_company:"";
    var address=order.route_address||order.original_address,phone=order.recipient_phone||"",href=phoneHref(phone,order.country_code);
    var meta=[];
    if(order.arrival_label)meta.push("Aankomst "+order.arrival_label);
    if(order.travel_minutes!=null)meta.push(order.travel_minutes+" min rijden");
    if(order.distance_km!=null)meta.push(Number(order.distance_km).toFixed(1)+" km");
    if(phone)meta.push("<a href='tel:"+esc(href)+"'>"+esc(phone)+"</a>");
    var actions="";
    if(kind==="open")actions="<button class='courierButton courierPin "+(order.route_lock==="first"?"active":"")+"' data-action='pin-first' data-id='"+esc(order.id)+"'>Eerste vast</button><button class='courierButton courierPin "+(order.route_lock==="last"?"active":"")+"' data-action='pin-last' data-id='"+esc(order.id)+"'>Laatste vast</button><button class='courierButton' data-action='navigate' data-id='"+esc(order.id)+"'>Navigeren</button><button class='courierButton success' data-action='delivered' data-id='"+esc(order.id)+"'>Bezorgd</button><button class='courierButton danger' data-action='exclude' data-id='"+esc(order.id)+"'>Uit route</button>";
    if(kind==="invalid")actions="<button class='courierButton' data-action='review' data-id='"+esc(order.id)+"'>Adres aanpassen</button><button class='courierButton danger' data-action='exclude' data-id='"+esc(order.id)+"'>Niet meenemen</button>";
    if(kind==="excluded"||kind==="delivered")actions="<button class='courierButton secondary' data-action='restore' data-id='"+esc(order.id)+"'>Terugzetten</button>";
    var badge=order.route_order||index+1;
    var lock=order.route_lock==="first"?" · eerste vast":order.route_lock==="last"?" · laatste vast":"";
    return "<article data-order-id='"+esc(order.id)+"' data-route-lock='"+esc(order.route_lock||"")+"' class='courierCard "+(kind==="invalid"?"invalid ":"")+(kind==="delivered"?"delivered ":"")+(kind==="open"&&index===0?"next ":"")+(order.route_lock?"locked ":"")+"'>"+(kind==="open"?"<button type='button' class='courierDragHandle' aria-label='Vasthouden en verslepen'>☰</button>":"")+"<div class='courierOrder'>"+esc(badge)+"</div><div class='courierInfo'><h3>"+esc(name)+"</h3>"+(company?"<div class='courierCompany'>"+esc(company)+"</div>":"")+"<div class='courierAddress'>"+esc(address)+"</div><div class='courierMeta'>"+meta.map(function(x){return "<span>"+x+"</span>"}).join("")+lock+"</div></div><div class='courierActions'>"+actions+"</div></article>";
  }

  function render(){
    var dates=Array.from(new Set(state.orders.map(function(x){return x.delivery_date}).filter(Boolean))).sort(),select=byId("courierDate");
    if(select){
      select.innerHTML=dates.length?dates.map(function(date){return "<option value='"+esc(date)+"' "+(date===state.date?"selected":"")+">"+new Date(date+"T12:00:00").toLocaleDateString("nl-NL",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"})+"</option>"}).join(""):"<option value='"+today()+"'>Nog geen opdrachten</option>";
    }
    var day=ordersForDate(),invalid=day.filter(invalidOrder);
    var open=day.filter(function(x){return x.delivery_status==="pending"&&x.validation_status==="valid"}).sort(function(a,b){return number(a.route_order,9999)-number(b.route_order,9999)});
    var excluded=day.filter(function(x){return x.delivery_status==="excluded"}),delivered=day.filter(function(x){return x.delivery_status==="delivered"}).sort(function(a,b){return number(a.route_order,9999)-number(b.route_order,9999)});
    byId("courierStats").innerHTML=statsHtml(day);
    byId("courierInvalidCount").textContent=invalid.length;byId("courierOpenCount").textContent=open.length;
    byId("courierExcludedCount").textContent=excluded.length;byId("courierDeliveredCount").textContent=delivered.length;
    byId("courierInvalidSection").style.display=invalid.length?"":"none";byId("courierExcludedSection").style.display=excluded.length?"":"none";byId("courierDeliveredSection").style.display=delivered.length?"":"none";
    byId("courierInvalidList").innerHTML=invalid.length?invalid.map(function(x,i){return card(x,i,"invalid")}).join(""):"";
    byId("courierRouteList").innerHTML=open.length?open.map(function(x,i){return card(x,i,"open")}).join(""):"<div class='courierEmpty'>Geen open bezorgopdrachten voor deze datum.</div>";
    byId("courierExcludedList").innerHTML=excluded.map(function(x,i){return card(x,i,"excluded")}).join("");
    byId("courierDeliveredList").innerHTML=delivered.map(function(x,i){return card(x,i,"delivered")}).join("");
    renderSummary();
    renderMap(open);
  }

  function renderSummary(){
    var el=byId("courierSummary"),s=state.summary;
    if(!s||!s.count){el.className="courierSummary";el.innerHTML="";return}
    el.className="courierSummary show";
    el.innerHTML=[
      ["Adressen",s.count],["Afstand",number(s.km).toFixed(1)+" km"],["Rijtijd",formatDuration(s.travelMin)],
      ["Stoptijd",formatDuration(s.stopMin)],["Verwacht klaar",s.end||"–"]
    ].map(function(item){return "<div><strong>"+esc(item[1])+"</strong><span>"+item[0]+"</span></div>"}).join("");
  }

  function renderMap(open){
    var panel=byId("courierMapPanel"),container=byId("courierMap"),c=state.courier||{};
    var start={lat:number(c.startLat,NaN),lng:number(c.startLng,NaN)},end=c.endSame!==false?start:{lat:number(c.endLat,NaN),lng:number(c.endLng,NaN)};
    if(!panel||!container||!window.L||!GJPlanningCore.hasPoint(start)||!GJPlanningCore.hasPoint(end)||!open.length){if(panel)panel.style.display="none";return}
    panel.style.display="block";
    if(!state.map)state.map=L.map(container,{scrollWheelZoom:false});
    if(state.mapLayer)state.mapLayer.remove();
    state.mapLayer=L.layerGroup().addTo(state.map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(state.mapLayer);
    var points=[[start.lat,start.lng]];
    var marker=function(lat,lng,label,title,kind){return L.marker([lat,lng],{icon:L.divIcon({className:"courierMapMarker "+kind,html:"<span>"+esc(label)+"</span>",iconSize:[32,32],iconAnchor:[16,16]})}).bindTooltip(title).addTo(state.mapLayer)};
    marker(start.lat,start.lng,"S",c.startAddress||"Start","start");
    open.forEach(function(order,index){var lat=Number(order.latitude),lng=Number(order.longitude);if(Number.isFinite(lat)&&Number.isFinite(lng)){points.push([lat,lng]);marker(lat,lng,String(index+1),(order.recipient_name||"Klant")+" — "+(order.route_address||order.original_address),"stop")}});
    points.push([end.lat,end.lng]);marker(end.lat,end.lng,c.endSame!==false?"E":"S",c.endSame!==false?(c.endAddress||"Eind"):"Terug bij start",c.endSame!==false?"end":"start");
    L.polyline(points,{color:"#0a4ca8",weight:4,opacity:.8,dashArray:"8 6"}).addTo(state.mapLayer);
    state.map.fitBounds(L.latLngBounds(points).pad(.08));setTimeout(function(){state.map.invalidateSize()},0);
  }

  function formatDuration(minutes){
    var m=Math.max(0,Math.round(number(minutes)));return m<60?m+" min":Math.floor(m/60)+"u "+String(m%60).padStart(2,"0")+"m";
  }

  function geocodeCountry(order){
    return order&&order.country_code||"NL";
  }

  async function geocode(query,country){
    var response=await GJ_AUTH.sb.functions.invoke("tomtom-proxy",{body:{action:"geocode",query:query,country:country||""}});
    if(response.error||response.data&&response.data.error)throw new Error(response.data&&response.data.error||response.error&&response.error.message||"Adres niet gevonden.");
    var result=response.data&&response.data.results&&response.data.results[0];
    if(!result||!result.position)throw new Error("Adres niet gevonden.");
    return result;
  }

  function suggestionAddress(result){
    var address=result&&result.address||{},free=clean(address.freeformAddress),parts=[free,clean(address.postalCode),clean(address.municipality||address.localName),clean(address.countryCode)];
    var seen=new Set(),out=[];
    parts.forEach(function(part){var key=normalize(part);if(part&&!seen.has(key)&&!(free&&normalize(free).indexOf(key)>=0&&part!==free)){seen.add(key);out.push(part)}});
    return out.join(", ")||free;
  }

  function semanticMatch(order,result,query){
    var address=result.address||{},inputText=clean(query||order.original_address),input=normalize(inputText);
    var postcode=normalize(order.postcode||(inputText.match(/\b\d{4}\s?[A-Za-z]{2}\b/i)||[])[0]),foundPostcode=normalize(address.postalCode);
    var street=normalize(address.streetName),freeform=clean(address.freeformAddress);
    var beforePostcode=inputText.split(/\b\d{4}\s?[A-Za-z]{2}\b/i)[0],houseParts=beforePostcode.match(/\b\d+\s*[A-Za-z]?(?:[-\/]\s*[A-Za-z0-9]+)?\b/g)||[];
    var foundParts=freeform.split(/\b\d{4}\s?[A-Za-z]{2}\b/i)[0].match(/\b\d+\s*[A-Za-z]?(?:[-\/]\s*[A-Za-z0-9]+)?\b/g)||[];
    var inputHouse=normalize(houseParts[houseParts.length-1]||""),foundHouse=normalize(address.streetNumber||foundParts[foundParts.length-1]||"");
    var postcodeOk=!!postcode&&!!foundPostcode&&postcode===foundPostcode,houseOk=!!inputHouse&&!!foundHouse&&inputHouse===foundHouse;
    var streetOk=!!street&&input.indexOf(street)>=0;
    return postcodeOk&&houseOk&&(streetOk||postcodeOk);
  }

  async function tomTomOrder(visits,start,end){
    if(visits.length<2)return visits.slice();
    var response=await GJ_AUTH.sb.functions.invoke("tomtom-proxy",{body:{action:"optimize-waypoints",start:start,end:end,stops:visits.map(function(visit){return {lat:Number(visit.customer.lat),lng:Number(visit.customer.lng)}})}});
    if(response.error||response.data&&response.data.error)throw new Error(response.data&&response.data.error||response.error&&response.error.message||"TomTom kon de routevolgorde niet bepalen.");
    var order=response.data&&response.data.order;
    if(!Array.isArray(order)||order.length!==visits.length||new Set(order).size!==visits.length)throw new Error("TomTom gaf geen volledige routevolgorde terug.");
    return order.map(function(index){return visits[index]});
  }

  async function saveValidated(order,routeAddress,result,remember){
    var position=result.position,payload={
      route_address:routeAddress,validation_status:"valid",validation_message:null,tomtom_suggestion:null,
      latitude:Number(position.lat),longitude:Number(position.lon),updated_at:new Date().toISOString()
    };
    var update=await GJ_AUTH.sb.from("courier_orders").update(payload).eq("id",order.id);
    if(update.error)throw update.error;
    if(remember!==false){
      var correction=await GJ_AUTH.sb.from("courier_address_corrections").upsert({
        source_address_key:order.source_address_key,original_address:order.original_address,route_address:routeAddress,
        latitude:Number(position.lat),longitude:Number(position.lon),approved_at:new Date().toISOString(),updated_at:new Date().toISOString()
      },{onConflict:"user_id,source_address_key"});
      if(correction.error)throw correction.error;
    }
  }

  async function cachedCorrection(order){
    var result=await GJ_AUTH.sb.from("courier_address_corrections").select("*").eq("source_address_key",order.source_address_key).maybeSingle();
    if(result.error)throw result.error;
    return result.data||null;
  }

  function openReview(order,result,errorMessage){
    return new Promise(function(resolve){
      state.review={order:order,result:result,resolve:resolve};
      byId("courierReviewOriginal").textContent=order.original_address;
      byId("courierReviewSuggested").textContent=result?suggestionAddress(result):"Geen passend adres gevonden";
      byId("courierReviewInput").value=order.original_address;
      byId("courierReviewStatus").textContent=errorMessage||"";
      byId("courierReviewApprove").disabled=!result;
      byId("courierReviewBackdrop").classList.add("show");
    });
  }

  function finishReview(action){
    var review=state.review;if(!review)return;
    state.review=null;byId("courierReviewBackdrop").classList.remove("show");review.resolve(action);
  }

  async function handleReviewAction(action){
    var review=state.review;if(!review)return;
    var order=review.order;
    try{
      if(action==="approve"){
        if(!review.result)return;
        await saveValidated(order,suggestionAddress(review.result),review.result,true);finishReview("saved");return;
      }
      if(action==="exclude"){
        var excluded=await GJ_AUTH.sb.from("courier_orders").update({delivery_status:"excluded",validation_status:"excluded",updated_at:new Date().toISOString()}).eq("id",order.id);
        if(excluded.error)throw excluded.error;finishReview("excluded");return;
      }
      if(action==="later"){finishReview("later");return}
      if(action==="recheck"){
        var input=clean(byId("courierReviewInput").value);if(input.length<5)throw new Error("Vul een compleet adres in.");
        byId("courierReviewStatus").textContent="TomTom controleert het aangepaste adres...";
        var result=await geocode(input,geocodeCountry(order));
        if(semanticMatch(Object.assign({},order,{original_address:input,postcode:(input.match(/\b\d{4}\s?[A-Za-z]{2}\b/)||[])[0]||order.postcode}),result,input)){
          await saveValidated(order,input,result,true);finishReview("saved");return;
        }
        review.result=result;byId("courierReviewSuggested").textContent=suggestionAddress(result);byId("courierReviewApprove").disabled=false;
        byId("courierReviewStatus").textContent="TomTom stelt nog een wijziging voor. Keur deze eerst goed.";
      }
    }catch(error){byId("courierReviewStatus").textContent=error.message||String(error)}
  }

  async function validateOne(order,interactive){
    var cached=await cachedCorrection(order);
    if(cached){
      var result={position:{lat:cached.latitude,lon:cached.longitude}};
      await saveValidated(order,cached.route_address,result,false);return "valid";
    }
    try{
      var found=await geocode(order.original_address,geocodeCountry(order));
      if(semanticMatch(order,found,order.original_address)){
        await saveValidated(order,order.original_address,found,true);return "valid";
      }
      var pending=await GJ_AUTH.sb.from("courier_orders").update({validation_status:"needs_review",tomtom_suggestion:found,validation_message:"TomTom stelt een ander adres voor.",updated_at:new Date().toISOString()}).eq("id",order.id);
      if(pending.error)throw pending.error;
      if(interactive)return await openReview(order,found,"");
      return "needs_review";
    }catch(error){
      var missing=await GJ_AUTH.sb.from("courier_orders").update({validation_status:"not_found",validation_message:error.message||"Adres niet gevonden.",tomtom_suggestion:null,updated_at:new Date().toISOString()}).eq("id",order.id);
      if(missing.error)throw missing.error;
      if(interactive)return await openReview(order,null,error.message||"Adres niet gevonden.");
      return "not_found";
    }
  }

  async function validateAddresses(interactive){
    if(state.busy&&interactive!==true)return;
    var candidates=ordersForDate().filter(function(order){return order.delivery_status==="pending"&&order.validation_status!=="valid"});
    if(!candidates.length){setProgress("Alle adressen voor deze dag zijn al gecontroleerd.","success");return}
    setBusy(true,"Adressen controleren...");
    try{
      for(var i=0;i<candidates.length;i++){
        setProgress("Adres "+(i+1)+" van "+candidates.length+" controleren...");
        await validateOne(candidates[i],interactive!==false);
        if(i<candidates.length-1)await delay(180);
      }
      await loadOrders();
      var unresolved=ordersForDate().filter(invalidOrder).length;
      setProgress(unresolved?unresolved+" adres(sen) moeten nog worden aangepast of uitgesloten.":"Alle adressen zijn geldig voor TomTom.",unresolved?"error":"success");
    }finally{setBusy(false)}
  }

  function minutesOf(value){
    var m=String(value||"08:00").match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):480;
  }

  function clockLabel(total){
    var value=Math.max(0,Math.round(total)),days=Math.floor(value/1440),clock=String(Math.floor(value/60)%24).padStart(2,"0")+":"+String(value%60).padStart(2,"0");
    return clock+(days?" (+"+days+" dag)":"");
  }

  async function calculateAndSave(selected,message){
    var c=state.courier,start={lat:number(c.startLat,NaN),lng:number(c.startLng,NaN)};
    var end=c.endSame!==false?start:{lat:number(c.endLat,NaN),lng:number(c.endLng,NaN)};
    if(!GJPlanningCore.hasPoint(start)||!GJPlanningCore.hasPoint(end)){openSettings();return alert("Stel eerst een geldig start- en eindadres in.");}
    setBusy(true,message||"Route opnieuw berekenen...");
    try{
      setProgress("TomTom berekent "+selected.length+" adressen. Grote routes worden veilig in delen verwerkt...");
      var requests=GJPlanningCore.createLegRequests(selected,start,end,0);
      var legs=await GJPlanningCore.requestRouteBatch(GJ_AUTH.sb,requests),cursor=minutesOf(c.departure),rows=[],km=0,travel=0,stop=2;
      selected.forEach(function(visit,index){
        var leg=legs[index],arrival=cursor+number(leg.min),departure=arrival+stop;
        rows.push({id:visit.id,route_order:index+1,arrival_label:clockLabel(arrival),departure_label:clockLabel(departure),travel_minutes:Math.round(number(leg.min)),distance_km:Math.round(number(leg.km)*10)/10});
        cursor=departure;travel+=number(leg.min);km+=number(leg.km);
      });
      var returnLeg=legs[selected.length];if(returnLeg){cursor+=number(returnLeg.min);travel+=number(returnLeg.min);km+=number(returnLeg.km)}
      var summary={count:selected.length,km:Math.round(km*10)/10,travelMin:Math.round(travel),stopMin:selected.length*stop,departure:c.departure,end:clockLabel(cursor),includesReturn:!!returnLeg,live:legs.every(function(x){return x.live===true}),calculatedAt:new Date().toISOString()};
      var saved=await GJ_AUTH.sb.rpc("save_courier_route",{p_workspace_id:workspaceId(),p_date:state.date,p_rows:rows,p_summary:summary});
      if(saved.error)throw saved.error;
      await loadOrders();setProgress("Route met "+selected.length+" adressen is berekend en opgeslagen.","success");
    }catch(error){setProgress("Route berekenen mislukt: "+(error.message||error),"error");throw error}
    finally{setBusy(false)}
  }

  async function optimizeRoute(){
    var day=ordersForDate(),invalid=day.filter(invalidOrder);
    if(invalid.length)return alert("Controleer of verwijder eerst alle ongeldige adressen.");
    var active=day.filter(function(order){return order.delivery_status==="pending"&&order.validation_status==="valid"});
    if(!active.length)return alert("Er zijn geen open bezorgadressen voor deze datum.");
    var c=state.courier,start={lat:number(c.startLat,NaN),lng:number(c.startLng,NaN)};
    var end=c.endSame!==false?start:{lat:number(c.endLat,NaN),lng:number(c.endLng,NaN)};
    if(!GJPlanningCore.hasPoint(start)||!GJPlanningCore.hasPoint(end)){openSettings();return alert("Stel eerst een geldig start- en eindadres in.");}
    setBusy(true,"TomTom bepaalt de beste routevolgorde...");
    try{
      var visits=active.map(function(order){return {id:order.id,planningId:order.id,routeLock:order.route_lock||null,customer:{lat:Number(order.latitude),lng:Number(order.longitude),name:order.recipient_name}}});
      var first=visits.find(function(visit){return visit.routeLock==="first"})||null,last=visits.find(function(visit){return visit.routeLock==="last"})||null;
      var middle=visits.filter(function(visit){return visit!==first&&visit!==last});
      var optimizeStart=first?{lat:first.customer.lat,lng:first.customer.lng}:start,optimizeEnd=last?{lat:last.customer.lat,lng:last.customer.lng}:end;
      var optimized=await tomTomOrder(middle,optimizeStart,optimizeEnd),selected=[];
      if(first)selected.push(first);selected.push.apply(selected,optimized);if(last)selected.push(last);
      setBusy(false);return await calculateAndSave(selected,"TomTom berekent de geoptimaliseerde route...");
    }catch(error){setProgress("Optimaliseren mislukt: "+(error.message||error),"error");throw error}
    finally{setBusy(false)}
  }

  async function setRouteLock(order,lock){
    var next=order.route_lock===lock?null:lock;
    if(next){var cleared=await GJ_AUTH.sb.from("courier_orders").update({route_lock:null,updated_at:new Date().toISOString()}).eq("delivery_date",state.date).eq("route_lock",lock);if(cleared.error)throw cleared.error}
    var updated=await GJ_AUTH.sb.from("courier_orders").update({route_lock:next,updated_at:new Date().toISOString()}).eq("id",order.id);if(updated.error)throw updated.error;
    await loadOrders();await optimizeRoute();
  }

  async function saveManualOrder(){
    var ids=Array.from(byId("courierRouteList").querySelectorAll(".courierCard[data-order-id]")).map(function(card){return card.dataset.orderId});
    var active=ordersForDate().filter(function(order){return order.delivery_status==="pending"&&order.validation_status==="valid"}),byOrder=new Map(active.map(function(order){return [order.id,order]}));
    var ordered=ids.map(function(id){return byOrder.get(id)}).filter(Boolean),first=ordered.find(function(order){return order.route_lock==="first"}),last=ordered.find(function(order){return order.route_lock==="last"});
    ordered=ordered.filter(function(order){return order!==first&&order!==last});if(first)ordered.unshift(first);if(last)ordered.push(last);
    var visits=ordered.map(function(order){return {id:order.id,planningId:order.id,customer:{lat:Number(order.latitude),lng:Number(order.longitude),name:order.recipient_name}}});
    await calculateAndSave(visits,"Handmatige volgorde opnieuw berekenen...");
  }

  async function setOrderStatus(id,status){
    var payload={delivery_status:status,route_lock:null,updated_at:new Date().toISOString()};
    if(status==="delivered")payload.delivered_at=new Date().toISOString();
    if(status==="pending")payload.delivered_at=null;
    var result=await GJ_AUTH.sb.from("courier_orders").update(payload).eq("id",id);
    if(result.error)throw result.error;
    state.summary=null;
    await GJ_AUTH.sb.from("courier_route_days").delete().eq("delivery_date",state.date);
    await loadOrders();
  }

  function navigateTo(order){
    var query=encodeURIComponent(order.route_address||order.original_address),app=state.courier.navigation||"google",url;
    if(app==="waze")url="https://www.waze.com/ul?q="+query+"&navigate=yes";
    else if(app==="apple")url="https://maps.apple.com/?daddr="+query+"&dirflg=d";
    else url="https://www.google.com/maps/dir/?api=1&destination="+query+"&travelmode=driving";
    window.open(url,"_blank","noopener");
  }

  function openSettings(){
    var c=state.courier;
    byId("courierStartAddress").value=c.startAddress||"";
    byId("courierEndSame").checked=c.endSame!==false;
    byId("courierEndAddress").value=c.endAddress||"";
    byId("courierEndAddress").disabled=c.endSame!==false;
    byId("courierDeparture").value=c.departure||"08:00";
    byId("courierNavigation").value=c.navigation||"google";
    byId("courierSettingsDialog").showModal();
  }

  async function saveSettings(){
    var startAddress=clean(byId("courierStartAddress").value),endSame=byId("courierEndSame").checked,endAddress=clean(byId("courierEndAddress").value);
    if(!startAddress)throw new Error("Vul een startadres in.");
    setProgress("Start- en eindadres controleren...");
    var old=state.courier,startChanged=normalize(startAddress)!==normalize(old.startAddress),startLat=old.startLat,startLng=old.startLng;
    if(startChanged||!Number.isFinite(Number(startLat))||!Number.isFinite(Number(startLng))){
      var startResult=await geocode(startAddress,"NL");startLat=Number(startResult.position.lat);startLng=Number(startResult.position.lon);
    }
    var endLat=startLat,endLng=startLng;
    if(!endSame){
      if(!endAddress)throw new Error("Vul een eindadres in of kies eindigen op het startadres.");
      var endChanged=normalize(endAddress)!==normalize(old.endAddress);
      endLat=old.endLat;endLng=old.endLng;
      if(endChanged||!Number.isFinite(Number(endLat))||!Number.isFinite(Number(endLng))){
        var endResult=await geocode(endAddress,"NL");endLat=Number(endResult.position.lat);endLng=Number(endResult.position.lon);
      }
    }
    state.courier={
      startAddress:startAddress,startLat:startLat,startLng:startLng,endSame:endSame,endAddress:endSame?"":endAddress,
      endLat:endSame?null:endLat,endLng:endSame?null:endLng,departure:byId("courierDeparture").value||"08:00",
      navigation:byId("courierNavigation").value||"google",stopMinutes:2
    };
    var merged=Object.assign({},state.settings,{courier:state.courier});
    await GJPlanningCore.saveUserSettings(GJ_AUTH.sb,merged,workspaceId());
    state.settings=merged;byId("courierSettingsDialog").close();setProgress("Route-instellingen opgeslagen.","success");
  }

  async function reviewOrder(order){
    if(order.tomtom_suggestion&&order.tomtom_suggestion.position)return openReview(order,order.tomtom_suggestion,order.validation_message||"");
    try{var found=await geocode(order.original_address,geocodeCountry(order));return openReview(order,found,"")}
    catch(error){return openReview(order,null,error.message||"Adres niet gevonden.")}
  }

  function bindDragging(){
    var list=byId("courierRouteList"),dragged=null,startY=0,moved=false;
    list.addEventListener("pointerdown",function(event){
      var handle=event.target.closest(".courierDragHandle");if(!handle||state.busy)return;
      dragged=handle.closest(".courierCard");startY=event.clientY;moved=false;dragged.classList.add("dragging");handle.setPointerCapture&&handle.setPointerCapture(event.pointerId);event.preventDefault();
    });
    list.addEventListener("pointermove",function(event){
      if(!dragged)return;if(Math.abs(event.clientY-startY)>5)moved=true;
      var target=document.elementFromPoint(event.clientX,event.clientY);target=target&&target.closest(".courierCard[data-order-id]");
      if(!target||target===dragged||target.parentElement!==list)return;
      var rect=target.getBoundingClientRect();if(event.clientY<rect.top+rect.height/2)list.insertBefore(dragged,target);else list.insertBefore(dragged,target.nextSibling);event.preventDefault();
    });
    var finish=function(){if(!dragged)return;dragged.classList.remove("dragging");dragged=null;if(moved)saveManualOrder().catch(function(error){setProgress(error.message||String(error),"error");loadOrders()})};
    list.addEventListener("pointerup",finish);list.addEventListener("pointercancel",finish);
  }

  function bind(){
    byId("courierImportButton").onclick=function(){byId("courierFile").click()};
    byId("courierFile").onchange=function(event){var file=event.target.files&&event.target.files[0];if(file)importFile(file).catch(function(error){setProgress("Importeren mislukt: "+error.message,"error")})};
    byId("courierValidate").onclick=function(){validateAddresses(true).catch(function(error){setProgress(error.message,"error")})};
    byId("courierOptimize").onclick=function(){optimizeRoute().catch(function(){})};
    byId("courierFitRoute").onclick=function(){var open=ordersForDate().filter(function(x){return x.delivery_status==="pending"&&x.validation_status==="valid"}).sort(function(a,b){return number(a.route_order,9999)-number(b.route_order,9999)});renderMap(open)};
    byId("courierDate").onchange=async function(event){state.date=event.target.value;await loadOrders()};
    byId("courierSettingsButton").onclick=openSettings;
    byId("courierEndSame").onchange=function(event){byId("courierEndAddress").disabled=event.target.checked};
    byId("courierSettingsSave").onclick=function(){saveSettings().catch(function(error){setProgress(error.message,"error")})};
    byId("courierLogout").onclick=async function(){sessionStorage.removeItem("gj_app_open_session");await GJ_AUTH.identitySb.auth.signOut();location.reload()};
    byId("courierReviewApprove").onclick=function(){handleReviewAction("approve")};
    byId("courierReviewRecheck").onclick=function(){handleReviewAction("recheck")};
    byId("courierReviewExclude").onclick=function(){handleReviewAction("exclude")};
    byId("courierReviewLater").onclick=function(){handleReviewAction("later")};
    byId("courierApp").addEventListener("click",async function(event){
      var button=event.target.closest("[data-action]");if(!button)return;
      var order=state.orders.find(function(x){return x.id===button.dataset.id});if(!order)return;
      try{
        if(button.dataset.action==="navigate")navigateTo(order);
        if(button.dataset.action==="delivered")await setOrderStatus(order.id,"delivered");
        if(button.dataset.action==="exclude")await setOrderStatus(order.id,"excluded");
        if(button.dataset.action==="restore")await setOrderStatus(order.id,"pending");
        if(button.dataset.action==="pin-first")await setRouteLock(order,"first");
        if(button.dataset.action==="pin-last")await setRouteLock(order,"last");
        if(button.dataset.action==="review"){await reviewOrder(order);await loadOrders()}
      }catch(error){setProgress(error.message||String(error),"error")}
    });
    bindDragging();
  }

  async function init(detail){
    var profile=detail&&detail.workspaceProfile||window.GJ_AUTH&&GJ_AUTH.workspaceProfile||window.GJ_AUTH&&GJ_AUTH.profile;
    if(!profile||profile.app_mode!=="courier")return;
    document.body.classList.add("gj-courier-mode");
    mount();
    try{
      await loadSettings();await loadOrders();
      if(state.channel)GJ_AUTH.sb.removeChannel(state.channel);
      state.channel=GJ_AUTH.sb.channel("courier-orders-"+workspaceId()).on("postgres_changes",{event:"*",schema:"public",table:"courier_orders",filter:"user_id=eq."+workspaceId()},function(){loadOrders().catch(function(){})}).subscribe();
      if(!state.courier.startAddress)setProgress("Stel eerst het startadres in via Instellingen.");
    }catch(error){
      setProgress("Koerierswerkruimte kon niet worden geladen. Voer eerst SUPABASE_V11_4_6_COURIER.sql uit. "+(error.message||error),"error");
    }
  }

  window.addEventListener("gj-auth-ready",function(event){init(event.detail)});
  window.GJCourier={VERSION:"11.4.6-r2",mapExportRow:mapRow,combineDeliveryAddress:combinedAddress,normalizePhone:phoneValue,addressMatchesTomTom:semanticMatch};
  if(window.GJ_AUTH&&GJ_AUTH.profile)setTimeout(function(){init({workspaceProfile:GJ_AUTH.workspaceProfile||GJ_AUTH.profile})},0);
})();
