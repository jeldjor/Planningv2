/* Planning-GJsystems v10.11: gelijke dagtotalen en opgeschoonde releaseweergave */
(()=>{
  'use strict';
  function applyReleaseUi(){
    document.title='Planyx';
    document.querySelectorAll('.version,.productVersion').forEach(el=>el.textContent='v10.11 DEV');
    document.getElementById('v108DevBanner')?.remove();
  }
  applyReleaseUi();
  window.addEventListener('gj-auth-ready',()=>setTimeout(applyReleaseUi,0));
})();
