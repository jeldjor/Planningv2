/* Bingo Beats V172 - stabiele verbeterlaag bovenop V171. */
(function(root){
  'use strict';

  const CARD_SIZES = [4,5,6];
  const CARD_COLORS = ['yellow','pink','purple','blue','green'];

  function normalizeCardSize(value){
    const size = Number(value);
    return CARD_SIZES.includes(size) ? size : 5;
  }

  function shuffle(values, random=Math.random){
    const out = values.slice();
    for(let i=out.length-1;i>0;i--){
      const j = Math.floor(random()*(i+1));
      [out[i],out[j]] = [out[j],out[i]];
    }
    return out;
  }

  function generateBalancedCard(size=5, random=Math.random){
    size = normalizeCardSize(size);
    const total = size*size;
    const hasFree = size%2===1;
    const coloredCount = total-(hasFree?1:0);
    const pool = Array.from({length:coloredCount},(_,i)=>CARD_COLORS[i%CARD_COLORS.length]);
    const mixed = shuffle(pool,random);
    const card=[];
    const freeIndex = hasFree ? Math.floor(total/2) : -1;
    let cursor=0;
    for(let i=0;i<total;i++) card.push(i===freeIndex?'free':mixed[cursor++]);
    return card;
  }

  function sizeFromCard(card){
    const size = Math.sqrt(Array.isArray(card)?card.length:0);
    return CARD_SIZES.includes(size) ? size : 5;
  }

  function checkBingoForCard(marked,card){
    const size = sizeFromCard(card);
    const filled = i => card?.[i]==='free' || !!marked?.[i];
    const lines=[];
    for(let row=0;row<size;row++) lines.push(Array.from({length:size},(_,col)=>row*size+col));
    for(let col=0;col<size;col++) lines.push(Array.from({length:size},(_,row)=>row*size+col));
    lines.push(Array.from({length:size},(_,i)=>i*size+i));
    lines.push(Array.from({length:size},(_,i)=>i*size+(size-1-i)));
    return lines.some(line=>line.every(filled));
  }

  function colorCounts(card){
    return CARD_COLORS.reduce((result,key)=>{
      result[key]=(card||[]).filter(value=>value===key).length;
      return result;
    },{});
  }

  function nextColorFromBag(colors,room,storage){
    const available=(colors||[]).filter(Boolean);
    if(!available.length) return null;
    const store=storage||root.localStorage;
    const key='bb_color_bag_'+String(room||'default');
    let state={bag:[],last:''};
    try{ state=JSON.parse(store.getItem(key)||'null')||state; }catch(_e){}
    const keys=available.map(color=>color.key);
    state.bag=(state.bag||[]).filter(value=>keys.includes(value));
    if(!state.bag.length){
      state.bag=shuffle(keys);
      if(state.bag.length>1 && state.bag[0]===state.last){
        [state.bag[0],state.bag[1]]=[state.bag[1],state.bag[0]];
      }
    }
    const chosenKey=state.bag.shift();
    state.last=chosenKey;
    try{ store.setItem(key,JSON.stringify(state)); }catch(_e){}
    return available.find(color=>color.key===chosenKey)||available[0];
  }

  root.BBV172={normalizeCardSize,generateBalancedCard,sizeFromCard,checkBingoForCard,colorCounts,nextColorFromBag};
  if(typeof module!=='undefined' && module.exports) module.exports=root.BBV172;
  if(typeof document==='undefined') return;

  const q=id=>document.getElementById(id);
  const E=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const colorHex172=key=>({yellow:'#FFCC33',pink:'#00D4C7',purple:'#FF8A1F',blue:'#7ED957',green:'#FF5A5F',free:'#192a22'})[key]||'#33443c';

  root.bbNextRoundColor=function(colors,room){ return nextColorFromBag(colors,room,root.localStorage); };

  function selectedCardSize(){
    return normalizeCardSize(q('cardSize')?.value||root.localStorage?.bb_card_size||5);
  }
  function rememberCardSize(size){
    size=normalizeCardSize(size);
    try{ root.localStorage.bb_card_size=String(size); }catch(_e){}
    if(q('cardSize')) q('cardSize').value=String(size);
    document.documentElement.style.setProperty('--bb-card-size',String(size));
    return size;
  }
  function syncCardSize(room){
    const size=normalizeCardSize(room?.settings?.cardSize||room?.cardSize||selectedCardSize());
    rememberCardSize(size);
    return size;
  }

  /* Eén generator voor nieuwe spelers, Host doet mee en nieuw spel. */
  if(typeof genCard==='function'){
    genCard=function(){ return generateBalancedCard(selectedCardSize()); };
  }
  if(typeof checkBingo==='function'){
    checkBingo=function(marked,card){
      const source=Array.isArray(card)?card:generateBalancedCard(selectedCardSize(),()=>0.5);
      return checkBingoForCard(marked,source);
    };
  }

  /* Nieuwe spelers lezen eerst de kaartgrootte van de kamer. */
  if(typeof joinPlayer==='function'){
    joinPlayer=async function(){
      const name=(q('playerNameInput')?.value||'').trim();
      if(!name) return alert('Vul je naam in.');
      if(!currentRoomCode) return alert('Geen geldige kamer gevonden.');
      try{
        const roomSnap=await db.ref('rooms/'+currentRoomCode).once('value');
        if(!roomSnap.exists()) return alert('Deze kamer bestaat niet meer.');
        const room=roomSnap.val()||{};
        const size=syncCardSize(room);
        currentPlayerName=name;
        if(!currentPlayerId) currentPlayerId='p_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
        localStorage.hb_player_id=currentPlayerId;
        localStorage.hb_player_name=currentPlayerName;
        localStorage.hb_player_room=currentRoomCode;
        const ref=db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId);
        const existingSnap=await ref.once('value');
        const existing=existingSnap.val()||{};
        const keepCard=Array.isArray(existing.card)&&existing.card.length===size*size;
        await ref.update({
          name,
          emoji:existing.emoji||bbAnimalFor(currentPlayerId,existing),
          online:true,
          ready:true,
          joinedAt:existing.joinedAt||firebase.database.ServerValue.TIMESTAMP,
          lastSeen:firebase.database.ServerValue.TIMESTAMP,
          card:keepCard?existing.card:generateBalancedCard(size),
          marked:keepCard?(existing.marked||{}):{},
          bingo:keepCard?!!existing.bingo:false
        });
        try{ ref.child('online').onDisconnect().set(false); }catch(_e){}
        listenPlayer();
        showDashboard();
      }catch(error){ alert('Meedoen mislukt: '+(error?.message||error)); }
    };
  }

  /* Bij een geldige keuze wordt pas na Firebase-opslag verder gegaan. */
  if(typeof pickCell==='function'){
    pickCell=function(index){
      if(!currentRoomCode||!currentPlayerId||!activeRound?.id) return Promise.resolve();
      const ref=db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId);
      return ref.once('value').then(snapshot=>{
        const playerData=snapshot.val()||{};
        const card=playerData.card||[];
        const marked={...(playerData.marked||{})};
        if(card[index]!==activeRound.colorKey||marked[index]) return;
        marked[index]=true;
        const bingo=checkBingoForCard(marked,card);
        return ref.update({marked,bingo,lastPickedRound:activeRound.id,lastPickedIndex:index,ready:false}).then(()=>{
          if(bingo) return db.ref('rooms/'+currentRoomCode+'/bingos').push({name:currentPlayerName,playerId:currentPlayerId,roundId:activeRound.id,at:firebase.database.ServerValue.TIMESTAMP});
        });
      }).catch(error=>alert('Vakje opslaan mislukt: '+(error?.message||error)));
    };
  }

  /* Kaartinstelling bewaren in dezelfde Firebase-kamer. */
  if(typeof createRoom==='function'){
    const previousCreateRoom=createRoom;
    createRoom=function(){
      const result=previousCreateRoom.apply(this,arguments);
      const room=currentRoomCode;
      const size=rememberCardSize(selectedCardSize());
      if(room&&db) db.ref('rooms/'+room+'/settings/cardSize').set(size).catch(()=>{});
      return result;
    };
  }

  if(typeof listenHost==='function'){
    const previousListenHost=listenHost;
    let settingsRef=null;
    listenHost=function(room){
      const result=previousListenHost.apply(this,arguments);
      try{ settingsRef?.off('value'); }catch(_e){}
      settingsRef=db.ref('rooms/'+room+'/settings/cardSize');
      settingsRef.on('value',snapshot=>rememberCardSize(snapshot.val()||5));
      return result;
    };
  }

  async function changeCardSize(){
    const select=q('cardSize');
    if(!select) return;
    const requested=normalizeCardSize(select.value);
    const previous=normalizeCardSize(localStorage.bb_card_size||5);
    if(!currentRoomCode||!db){ rememberCardSize(requested); return; }
    try{
      const snapshot=await db.ref('rooms/'+currentRoomCode).once('value');
      const room=snapshot.val()||{};
      const status=room.currentRound?.status||'';
      if(['picking','precount','ready','answering','locked','review'].includes(status)){
        select.value=String(previous);
        return alert('De bingokaart kan alleen vóór een spel of tussen twee spellen worden gewijzigd.');
      }
      rememberCardSize(requested);
      const updates={};
      updates[`rooms/${currentRoomCode}/settings/cardSize`]=requested;
      Object.keys(room.players||{}).forEach(pid=>{
        updates[`rooms/${currentRoomCode}/players/${pid}/card`]=generateBalancedCard(requested);
        updates[`rooms/${currentRoomCode}/players/${pid}/marked`]={};
        updates[`rooms/${currentRoomCode}/players/${pid}/bingo`]=false;
        updates[`rooms/${currentRoomCode}/players/${pid}/ready`]=false;
        updates[`rooms/${currentRoomCode}/players/${pid}/lastPickedRound`]=null;
        updates[`rooms/${currentRoomCode}/players/${pid}/lastPickedIndex`]=null;
      });
      if(room.currentRound?.id){
        updates[`rooms/${currentRoomCode}/currentRound`]=null;
        updates[`rooms/${currentRoomCode}/answers`]=null;
        updates[`rooms/${currentRoomCode}/correct`]=null;
        updates[`rooms/${currentRoomCode}/bingos`]=null;
      }
      await db.ref().update(updates);
    }catch(error){
      select.value=String(previous);
      rememberCardSize(previous);
      alert('Bingokaart wijzigen mislukt: '+(error?.message||error));
    }
  }

  function cardSignature(card,marked,pickable){
    return `${card.join(',')}|${Object.keys(marked||{}).filter(key=>marked[key]).sort().join(',')}|${pickable||''}`;
  }
  function configureGrid(element,size){
    if(!element) return;
    element.classList.add('bbDynamicCard');
    element.dataset.cardSize=String(size);
    element.style.setProperty('--bb-card-size',String(size));
  }
  function renderMiniCard(element,card,marked){
    if(!element||!Array.isArray(card)||!card.length) return;
    const size=sizeFromCard(card);
    const signature=cardSignature(card,marked,'mini');
    if(element.dataset.bbV172Signature===signature) return;
    configureGrid(element,size);
    element.dataset.bbV172Signature=signature;
    element.innerHTML=card.map((color,index)=>{
      const markedCell=color==='free'||!!marked?.[index];
      return `<div class="bbV160MiniCell ${markedCell?'marked':''}" style="background:${colorHex172(color)}">${markedCell?'🐵':''}</div>`;
    }).join('');
  }
  function renderPickCard(element,card,marked,round,playerData,cellClass='bbV144Cell'){
    if(!element||!Array.isArray(card)||!card.length) return;
    const size=sizeFromCard(card);
    const canChoose=round?.status==='judged'&&playerData?.lastPickedRound!==round.id;
    const signature=cardSignature(card,marked,canChoose?round?.colorKey:'view');
    if(element.dataset.bbV172Signature===signature) return;
    configureGrid(element,size);
    element.dataset.bbV172Signature=signature;
    element.innerHTML=card.map((color,index)=>{
      const markedCell=color==='free'||!!marked?.[index];
      const pickable=canChoose&&color===round?.colorKey&&color!=='free'&&!marked?.[index];
      const className=cellClass==='bbOverlayCell'
        ? `${cellClass} ${markedCell?'marked':''} ${pickable?'pickable':'blocked'}`
        : `${cellClass} ${color} ${markedCell?'marked':''} ${pickable?'pickable':'blocked'}`;
      const content=markedCell?(cellClass==='bbV144Cell'?'<span class="bbV144Mark">BB</span>':'🐵'):'';
      return `<button type="button" class="${className}" data-i="${index}" style="--cell:${colorHex172(color)};background:${colorHex172(color)}" ${pickable?'':'disabled'}>${content}</button>`;
    }).join('');
    element.querySelectorAll('.pickable').forEach(button=>button.addEventListener('click',()=>{
      button.disabled=true;
      pickCell(Number(button.dataset.i));
    }));
  }

  function enhanceDynamicCards(room,round){
    if(!room) return;
    root.bbV172LastRoom=room;
    syncCardSize(room);
    const playerData=room.players?.[currentPlayerId]||{};
    const card=playerData.card||[];
    const marked=playerData.marked||{};
    document.querySelectorAll('.bbV160OwnMiniCard:not(.bbV172OtherPlayerCard)').forEach(element=>renderMiniCard(element,card,marked));
    const pick=document.querySelector('.bbV144Pick .bbV144Card');
    if(pick) renderPickCard(pick,card,marked,round,playerData,'bbV144Cell');
    const compact=q('dashOwnCard');
    if(compact&&compact.offsetParent!==null) renderPickCard(compact,card,marked,round,playerData,'compactCell');
    const overlay=document.querySelector('.bbFeedbackOverlay.show .bbOverlayBingo');
    if(overlay) renderPickCard(overlay,card,marked,round,playerData,'bbOverlayCell');
  }

  root.bbV160ShowCard=function(pid){
    const room=root.bbV172LastRoom||root.bbV160LastRoom||{};
    const playerData=room.players?.[pid];
    if(!playerData) return;
    let modal=q('bbV160CardModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='bbV160CardModal';
      modal.className='bbV160CardModal hidden';
      document.body.appendChild(modal);
    }
    const cleanName=String(playerData.name||'Speler').replace(/^🎤\s*/,'').trim();
    modal.innerHTML=`<div class="bbV160CardPop"><button type="button" class="bbV160Close" onclick="bbV160CloseCard()">×</button><h2>${bbAnimalFor(pid,playerData)} ${E(cleanName)}</h2><div class="bbV160OwnMiniCard bbV172OtherPlayerCard"></div></div>`;
    renderMiniCard(modal.querySelector('.bbV160OwnMiniCard'),playerData.card||[],playerData.marked||{});
    modal.classList.remove('hidden');
  };

  /* Enter maakt nooit een inzending; alleen de zichtbare knop mag dat doen. */
  function isAnswerInput(target){ return !!target?.matches?.('#bbStageAnswerInput,#scoreAnswerInput'); }
  ['keydown','keypress'].forEach(type=>document.addEventListener(type,event=>{
    if(isAnswerInput(event.target)&&event.key==='Enter'){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true));
  document.addEventListener('submit',event=>{
    if(event.target?.querySelector?.('#bbStageAnswerInput,#scoreAnswerInput')) event.preventDefault();
  },true);

  let lastFocusRound='';
  function focusAnswer(round,room){
    if(round?.status!=='answering'||!round.id||room?.answers?.[round.id]?.[currentPlayerId]) return;
    const attempt=()=>{
      const input=q('bbStageAnswerInput')||q('scoreAnswerInput');
      if(!input) return;
      input.autocomplete='off';
      input.inputMode='text';
      input.setAttribute('autofocus','autofocus');
      try{ input.focus({preventScroll:false}); input.setSelectionRange(input.value.length,input.value.length); }catch(_e){ try{ input.focus(); }catch(__e){} }
    };
    if(lastFocusRound!==round.id) lastFocusRound=round.id;
    [0,60,180,420].forEach(delay=>setTimeout(attempt,delay));
  }

  function stripSectionIcons(){
    document.querySelectorAll('h1,h2,h3,.panelTitle,.bbV160LiveHead,.bbV144TopTitle').forEach(element=>{
      const text=element.textContent||'';
      if(/live antwoorden|scorebord/i.test(text)){
        element.querySelectorAll(':scope > span').forEach(span=>{ if(/[📨📩✉📊]/u.test(span.textContent||'')) span.remove(); });
        Array.from(element.childNodes).filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>{ node.textContent=node.textContent.replace(/[📨📩✉📊]/gu,'').trimStart(); });
      }
    });
    document.querySelectorAll('.bbV144State b').forEach(element=>{ if(/[📨📩✉]/u.test(element.textContent||'')) element.textContent=''; });
  }

  function addStopButton(){
    const dashboard=q('screenDashboard');
    const inLobby=dashboard?.classList.contains('bbV160LobbyStage')||!!dashboard?.querySelector('.bbV144Lobby,.stageLobby');
    let button=q('bbLobbyStopBtn');
    if(!inLobby){ button?.remove(); return; }
    if(!button){
      button=document.createElement('button');
      button.id='bbLobbyStopBtn';
      button.type='button';
      button.className='bbLobbyStopBtn';
      button.textContent='STOPPEN';
      button.addEventListener('click',()=>openStopModal());
      document.body.appendChild(button);
    }
  }

  function stopModal(){
    let modal=q('bbStopModal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='bbStopModal';
    modal.className='bbStopModal hidden';
    modal.innerHTML=`<div class="bbStopCard"><h2>Stoppen met meedoen?</h2><p>Je verlaat het spel en de lobby. De andere spelers kunnen gewoon doorgaan.</p><div class="bbStopActions"><button type="button" class="secondary" id="bbStopCancel">Annuleren</button><button type="button" class="bbStopConfirm" id="bbStopConfirm">Ja, stoppen</button></div></div>`;
    document.body.appendChild(modal);
    q('bbStopCancel').addEventListener('click',()=>modal.classList.add('hidden'));
    q('bbStopConfirm').addEventListener('click',leaveGame);
    modal.addEventListener('click',event=>{ if(event.target===modal) modal.classList.add('hidden'); });
    return modal;
  }
  function openStopModal(){ stopModal().classList.remove('hidden'); }

  async function leaveGame(){
    const modal=stopModal();
    const button=q('bbStopConfirm');
    if(button){ button.disabled=true; button.textContent='Bezig…'; }
    const wasHostPlayer=document.body.classList.contains('bbHostPlayerMode');
    const room=currentRoomCode;
    const pid=currentPlayerId;
    try{
      if(room&&pid) await db.ref(`rooms/${room}/players/${pid}`).remove();
      try{
        db.ref('rooms/'+room).off();
        db.ref('rooms/'+room+'/bingos').off();
        db.ref('rooms/'+room+'/spotifyTest').off();
      }catch(_e){}
      ['hb_player_id','hb_player_name','hb_player_room'].forEach(key=>localStorage.removeItem(key));
      currentPlayerId='';
      currentPlayerName='';
      modal.classList.add('hidden');
      q('bbLobbyStopBtn')?.remove();
      if(wasHostPlayer){
        root.bbHostPlayerExit?.();
      }else{
        q('screenDashboard')?.classList.add('hidden');
        q('screenJoin')?.classList.remove('hidden');
        if(q('playerNameInput')) q('playerNameInput').value='';
        if(q('joinStatus')) q('joinStatus').textContent='Je hebt het spel verlaten.';
      }
    }catch(error){ alert('Stoppen mislukt: '+(error?.message||error)); }
    finally{ if(button){ button.disabled=false; button.textContent='Ja, stoppen'; } }
  }

  /* Alleen de host beslist na bingo; spelers wachten op die keuze. */
  const canDecideAfterBingo=()=>typeof isPlayerPage==='function'?!isPlayerPage():!new URLSearchParams(location.search).has('room');
  if(typeof showWinner==='function'){
    const previousShowWinner=showWinner;
    showWinner=function(name){
      const result=previousShowWinner.apply(this,arguments);
      requestAnimationFrame(()=>{
        const card=document.querySelector('#bingoFullOverlay .bingoFullCard');
        if(!card) return;
        let hint=card.querySelector('.bingoFullHint');
        if(!canDecideAfterBingo()){
          card.querySelector('.bingoFullActions')?.remove();
          if(!hint){ hint=document.createElement('div'); hint.className='bingoFullHint'; card.appendChild(hint); }
          hint.textContent='Wachten tot de host kiest hoe het spel verdergaat.';
        }else if(hint){ hint.textContent='Jij beslist hoe het spel verdergaat.'; }
      });
      return result;
    };
  }

  root.bbBingoVerderSpelen=function(){
    if(!canDecideAfterBingo()) return;
    q('bingoFullOverlay')?.classList.add('hidden');
    if(!currentRoomCode||!db) return;
    db.ref('rooms/'+currentRoomCode).once('value').then(snapshot=>{
      const room=snapshot.val()||{};
      const round=room.currentRound||{};
      const updates={};
      Object.entries(room.bingos||{}).forEach(([key,bingo])=>{ if(!round.id||bingo?.roundId===round.id) updates[`rooms/${currentRoomCode}/bingos/${key}`]=null; });
      Object.keys(room.players||{}).forEach(pid=>updates[`rooms/${currentRoomCode}/players/${pid}/bingo`]=false);
      if(round.id) updates[`rooms/${currentRoomCode}/bingoDecisions/${round.id}`]={choice:'continue',at:firebase.database.ServerValue.TIMESTAMP};
      return db.ref().update(updates);
    }).catch(error=>alert('Verder spelen mislukt: '+(error?.message||error)));
  };
  if(typeof root.bbBingoNieuweRonde==='function'){
    const previousNewBingoRound=root.bbBingoNieuweRonde;
    root.bbBingoNieuweRonde=function(){ if(canDecideAfterBingo()) return previousNewBingoRound.apply(this,arguments); };
  }

  /* Host-doet-mee veilig terug naar host, inclusief browser-terug. */
  if(typeof root.bbHostPlayerExit==='function'){
    const previousHostExit=root.bbHostPlayerExit;
    let returningToHost=false;
    root.bbHostPlayerExit=function(){
      if(returningToHost) return;
      returningToHost=true;
      try{
        q('bbHostJuryModal')?.classList.add('hidden');
        q('bbV160CardModal')?.classList.add('hidden');
        q('bbFeedbackOverlay')?.classList.remove('show');
        q('bbLobbyStopBtn')?.remove();
        previousHostExit.apply(this,arguments);
      }finally{
        document.body.classList.remove('bbKeyboardOpen');
        try{ history.replaceState({bbHostPlayer:false},document.title,location.pathname+location.hash); }catch(_e){}
        setTimeout(()=>{
          q('playerApp')?.classList.add('hidden');
          q('hostApp')?.classList.remove('hidden');
          q('mainHeader')?.classList.remove('hidden');
          if(currentRoomCode){
            try{ renderRoomBox(currentRoomCode); listenHost(currentRoomCode); listenBingo(currentRoomCode); }catch(_e){}
          }
          returningToHost=false;
        },80);
      }
    };
  }
  let hostHistoryActive=false;
  function syncHostHistory(){
    const active=document.body.classList.contains('bbHostPlayerMode');
    if(active&&!hostHistoryActive){
      hostHistoryActive=true;
      try{ history.pushState({bbHostPlayer:true},document.title,location.href); }catch(_e){}
    }else if(!active){ hostHistoryActive=false; }
  }
  root.addEventListener('popstate',()=>{
    if(document.body.classList.contains('bbHostPlayerMode')) root.bbHostPlayerExit?.();
  });

  /* Spotify-callback blijft op een stil groen scherm tot de sessie verwerkt is. */
  if(typeof handleRedirect==='function'){
    const previousHandleRedirect=handleRedirect;
    handleRedirect=async function(){
      try{ return await previousHandleRedirect.apply(this,arguments); }
      finally{ document.documentElement.classList.remove('bbSpotifyReturning'); }
    };
  }else document.documentElement.classList.remove('bbSpotifyReturning');

  /* Laatste renderlaag: focus, kaarten, lobbyknop en icoonopschoning. */
  if(typeof renderCompactDashboard==='function'){
    const previousRender=renderCompactDashboard;
    renderCompactDashboard=function(room,round){
      syncCardSize(room||{});
      root.bbV172LastRoom=room||{};
      const result=previousRender.apply(this,arguments);
      enhanceDynamicCards(room||{},round||{});
      focusAnswer(round||{},room||{});
      stripSectionIcons();
      addStopButton();
      syncHostHistory();
      return result;
    };
  }

  /* PWA en browser mogen nooit met knijp-, dubbelklik- of ctrl-zoom schalen. */
  ['gesturestart','gesturechange','gestureend'].forEach(type=>document.addEventListener(type,event=>event.preventDefault(),{passive:false}));
  document.addEventListener('touchmove',event=>{ if(event.touches?.length>1) event.preventDefault(); },{passive:false});
  document.addEventListener('dblclick',event=>event.preventDefault(),{passive:false});
  root.addEventListener('wheel',event=>{ if(event.ctrlKey) event.preventDefault(); },{passive:false});
  root.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&['+','-','=','0'].includes(event.key)) event.preventDefault();
  },true);

  const observer=new MutationObserver(()=>{
    stripSectionIcons();
    addStopButton();
    syncHostHistory();
    const room=root.bbV172LastRoom||{};
    const round=room.currentRound||activeRound||{};
    enhanceDynamicCards(room,round);
    if(round.status==='answering') focusAnswer(round,room);
  });

  function wireV172(){
    rememberCardSize(localStorage.bb_card_size||q('cardSize')?.value||5);
    q('cardSize')?.addEventListener('change',changeCardSize);
    stripSectionIcons();
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wireV172);
  else wireV172();
})(typeof window!=='undefined'?window:globalThis);
