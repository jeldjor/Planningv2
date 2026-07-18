(function () {
  'use strict';
  if (window.__GJ_LIVE_LOCATIONS_V108__) return;

  const ALLOWED_INTERVALS = [5, 10, 15, 30, 60];
  const FALLBACK_MS = 60000;
  const EVENT_DEDUP_MS = 3000;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const identityClient = () => window.GJ_AUTH?.identitySb || null;
  const isImpersonating = () => window.GJ_AUTH?.impersonating === true;
  const isAdmin = () => window.GJ_AUTH?.isAdmin === true;
  const realUserId = () => window.GJ_AUTH?.realUserId || window.GJ_AUTH?.profile?.id || null;
  const consentKey = () => `gj_location_consent_${realUserId() || 'unknown'}`;
  const deviceLocationAllowed = () => document.body?.dataset?.gjDeviceLocation !== 'disabled';

  function formatDate(value) {
    if (!value) return 'Nog nooit';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Onbekend';
    return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function ageMinutes(value, now = Date.now()) {
    if (!value) return null;
    const measured = new Date(value).getTime();
    return Number.isFinite(measured) ? Math.max(0, (now - measured) / 60000) : null;
  }

  function ageLabel(value, now = Date.now()) {
    const minutes = ageMinutes(value, now);
    if (minutes == null) return 'geen locatie';
    if (minutes < 1) return 'minder dan 1 minuut oud';
    if (minutes < 60) return `${Math.floor(minutes)} min oud`;
    const hours = Math.floor(minutes / 60);
    const rest = Math.floor(minutes % 60);
    return `${hours}u${rest ? ` ${rest}m` : ''} oud`;
  }

  function locationStatus(capturedAt, intervalMinutes = 10, centralEnabled = true, now = Date.now()) {
    if (!centralEnabled) return { key: 'disabled', label: 'Centraal uit' };
    const minutes = ageMinutes(capturedAt, now);
    if (minutes == null) return { key: 'none', label: 'Geen locatie' };
    if (minutes <= intervalMinutes * 1.5) return { key: 'current', label: 'Actueel' };
    if (minutes <= intervalMinutes * 3) return { key: 'stale', label: 'Verouderd' };
    return { key: 'offline', label: 'Offline' };
  }

  function permissionLabel(state) {
    return ({
      unknown: 'Nog niet bekend', prompt: 'Nog niet gevraagd', granted: 'Toegestaan',
      denied: 'Geweigerd', blocked: 'Geblokkeerd', services_off: 'Locatieservices uit',
      unavailable: 'Tijdelijk niet beschikbaar', timeout: 'Timeout', revoked: 'Later ingetrokken',
      error: 'Fout'
    })[state || 'unknown'] || 'Onbekend';
  }

  function promptLabel(state) {
    return ({ not_asked: 'Niet gevraagd', deferred: 'Uitgesteld', accepted: 'Geaccepteerd' })[state || 'not_asked'] || 'Niet gevraagd';
  }

  function initials(row) {
    const text = row?.full_name || row?.email || '?';
    return text.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  }

  function googleMapsUrl(latitude, longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  const manager = {
    initialized: false,
    central: null,
    own: null,
    ownLive: null,
    locationTimer: null,
    configFallbackTimer: null,
    adminFallbackTimer: null,
    configChannel: null,
    ownChannel: null,
    adminChannel: null,
    requestInFlight: false,
    lastTriggerAt: 0,
    locationListenersBound: false,
    permissionHandle: null,
    adminRows: [],
    historyRows: [],
    selectedHistoryUser: null,
    selectedHistoryHours: 24,
    currentMap: null,
    currentMapLayer: null,
    historyMap: null,
    historyMapLayer: null,
    adminRefreshTimer: null,
    handlers: {},

    async init() {
      if (this.initialized || !identityClient() || !realUserId()) return;
      this.initialized = true;
      this.installDevelopmentLabel();
      if (isAdmin()) this.installAdminUi();
      this.bindGlobalLifecycle();
      await this.loadCentral();
      await this.loadOwn();
      this.startConfigSync();
      this.startOwnSync();
      if (isAdmin()) this.startAdminSync();
      await this.reconcile({ direct: true, reason: 'login/openen' });
      if (isAdmin()) await this.refreshAdmin();
    },

    installDevelopmentLabel() {
      document.title = 'Planyx';
      document.querySelectorAll('.version,.productVersion,.settingsVersion,#v108DevBanner').forEach((element) => element.remove());
    },

    installOwnSettingsUi() {
      // v10.8.1: gewone gebruikers krijgen geen locatiebeheer in Instellingen.
      // Toestemming blijft via de eenmalige melding lopen; beheer vindt plaats
      // onder Beheer → Live Locaties.
      $('v108LocationSettings')?.remove();
    },

    installAdminUi() {
      const root = $('admin') || $('adminMobile');
      const tabs = root?.querySelector('.adminTabs');
      if (!root || !tabs || $('adminPaneLiveLocations')) return;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'secondary adminTab';
      tab.dataset.adminTab = 'liveLocations';
      tab.textContent = 'Live Locaties';
      tabs.appendChild(tab);
      const pane = document.createElement('div');
      pane.id = 'adminPaneLiveLocations';
      pane.className = 'adminPane';
      pane.hidden = true;
      pane.innerHTML = `
        <div class="sectionHead"><div><h3>Live Locaties</h3><p class="muted">Werkelijke laatst ontvangen locaties en recente locatiehistorie.</p></div></div>
        <div class="v108AdminSettings">
          <label>Live Locaties<select id="v108SystemEnabled"><option value="false">Uit</option><option value="true">Aan</option></select></label>
          <label>Updatefrequentie<select id="v108SystemInterval">${ALLOWED_INTERVALS.map((value) => `<option value="${value}">${value} minuten</option>`).join('')}</select></label>
          <button type="button" id="v108SystemSave">Centrale instelling opslaan</button>
        </div>
        <div class="v108StatusGrid">
          <div class="v108StatusItem"><span>Bewaartermijn</span><strong>24 uur</strong></div>
          <div class="v108StatusItem"><span>Laatste wijziging</span><strong id="v108SystemUpdated">Nog niet gewijzigd</strong></div>
        </div>
        <div id="v108SystemMessage" class="v108Error" aria-live="polite"></div>
        <div class="v108Section"><div class="sectionHead"><div><h3>Actuele kaart</h3><p class="muted">Een oude positie wordt altijd als Verouderd of Offline gemarkeerd.</p></div><button type="button" id="v108AdminRefresh" class="secondary">Vernieuwen</button></div><div id="v108CurrentMap" class="v108Map"><div class="v108MapEmpty">Locaties worden geladen…</div></div><div id="v108LocationList" class="v108LocationList"></div></div>
        <div class="v108Section"><h3>Kaart afgelopen 24 uur</h3><div class="v108HistoryControls"><label>Gebruiker<select id="v108HistoryUser"></select></label><label>Periode<select id="v108HistoryHours"><option value="1">Laatste 1 uur</option><option value="4">Laatste 4 uur</option><option value="8">Laatste 8 uur</option><option value="24" selected>Laatste 24 uur</option></select></label><button type="button" id="v108HistoryRefresh">Historie laden</button></div><div id="v108HistoryMap" class="v108Map"><div class="v108MapEmpty">Kies een gebruiker.</div></div><div id="v108HistoryList" class="v108HistoryList"></div></div>`;
      const paneHost = root.id === 'adminMobile' ? root : (root.querySelector(':scope > .panel, :scope > .card') || root);
      paneHost.appendChild(pane);
      $('v108SystemSave').addEventListener('click', () => this.saveCentral());
      $('v108AdminRefresh').addEventListener('click', () => this.refreshAdmin());
      $('v108HistoryRefresh').addEventListener('click', () => this.loadHistory());
      $('v108HistoryUser').addEventListener('change', (event) => { this.selectedHistoryUser = event.target.value || null; this.loadHistory(); });
      $('v108HistoryHours').addEventListener('change', (event) => { this.selectedHistoryHours = Number(event.target.value) || 24; this.loadHistory(); });
      $('v108LocationList').addEventListener('click', (event) => {
        const button = event.target.closest('.v108UserLocationToggle');
        if (button) this.setAdminUserEnabled(button.dataset.userId, button.dataset.enabled !== 'true', button);
        const tracking = event.target.closest('.v108TrackingToggle');
        if (tracking) this.setLiveTracking(tracking.dataset.userId, tracking.dataset.tracking !== 'true', tracking);
      });
      tab.addEventListener('click', () => setTimeout(() => { this.invalidateMaps(); this.refreshAdmin(); }, 30));
    },

    bindGlobalLifecycle() {
      this.handlers.signedOut = () => this.destroy();
      this.handlers.beforeUnload = () => this.destroy();
      window.addEventListener('gj-auth-signed-out', this.handlers.signedOut);
      window.addEventListener('beforeunload', this.handlers.beforeUnload, { once: true });
    },

    async loadCentral() {
      const client = identityClient();
      if (!client) return null;
      const { data, error } = await client.from('location_system_settings').select('*').eq('id', 1).single();
      if (error) throw new Error(`Live Locaties-configuratie laden mislukt: ${error.message}`);
      const previous = this.central;
      this.central = data;
      this.renderCentral();
      if (previous && (previous.enabled !== data.enabled || previous.update_interval_minutes !== data.update_interval_minutes)) {
        await this.reconcile({ direct: data.enabled, reason: 'centrale instelling gewijzigd' });
      }
      return data;
    },

    async loadOwn() {
      const client = identityClient();
      const uid = realUserId();
      if (!client || !uid) return;
      const [settingsResult, liveResult] = await Promise.all([
        client.from('user_location_settings').select('*').eq('user_id', uid).maybeSingle(),
        client.from('user_live_locations').select('*').eq('user_id', uid).maybeSingle()
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (liveResult.error) throw liveResult.error;
      this.own = settingsResult.data;
      this.ownLive = liveResult.data;
      if (this.own?.admin_enabled && this.own?.app_prompt_state !== 'accepted' && localStorage.getItem(consentKey()) === 'accepted') {
        await this.setOwn({ enabled: true, promptState: 'accepted', permissionState: this.own.permission_state || 'unknown' });
      }
      this.renderOwn();
    },

    async setOwn({ enabled, promptState, permissionState, errorMessage = null }) {
      const client = identityClient();
      const { data, error } = await client.rpc('set_my_location_preference', {
        p_route_location_enabled: Boolean(enabled),
        p_app_prompt_state: promptState,
        p_permission_state: permissionState,
        p_last_error: errorMessage
      });
      if (error) throw error;
      this.own = Array.isArray(data) ? data[0] : data;
      if (promptState === 'accepted') localStorage.setItem(consentKey(), 'accepted');
      this.renderOwn();
      return data;
    },

    renderCentral() {
      const central = this.central;
      if (!central) return;
      if ($('v108SystemEnabled')) $('v108SystemEnabled').value = String(Boolean(central.enabled));
      if ($('v108SystemInterval')) $('v108SystemInterval').value = String(central.update_interval_minutes || 10);
      if ($('v108SystemUpdated')) $('v108SystemUpdated').textContent = formatDate(central.updated_at);
      this.renderOwn();
    },

    renderOwn() {
      // Geen gebruikersinterface in Instellingen; beheer ziet de status centraal.
    },

    async saveCentral() {
      if (!isAdmin()) return;
      const message = $('v108SystemMessage');
      try {
        message.textContent = 'Opslaan…';
        const enabled = $('v108SystemEnabled').value === 'true';
        const interval = Number($('v108SystemInterval').value);
        const { data, error } = await identityClient().rpc('set_location_system_config', {
          p_enabled: enabled,
          p_update_interval_minutes: interval
        });
        if (error) throw error;
        this.central = Array.isArray(data) ? data[0] : data;
        message.textContent = enabled ? `Live Locaties staat aan (${interval} minuten).` : 'Live Locaties staat centraal uit.';
        message.className = 'v108Neutral';
        this.renderCentral();
        await this.reconcile({ direct: enabled, reason: 'beheerinstelling opgeslagen' });
        await this.refreshAdmin();
      } catch (error) {
        message.textContent = error.message;
        message.className = 'v108Error';
      }
    },

    async reconcile({ direct = false, reason = 'controle' } = {}) {
      if (!this.initialized) return;
      if (!deviceLocationAllowed()) {
        this.stopLocationCycle();
        this.closeConsent();
        return;
      }
      if (!this.central) await this.loadCentral();
      this.renderOwn();
      if (!this.central?.enabled || !this.own?.admin_enabled || isImpersonating()) {
        this.stopLocationCycle();
        this.closeConsent();
        return;
      }
      if (!this.own || this.own.app_prompt_state === 'not_asked') {
        this.stopLocationCycle();
        this.showConsent();
        return;
      }
      this.closeConsent();
      const allowedByUser = this.own.route_location_enabled && this.own.app_prompt_state === 'accepted';
      const blocked = ['denied', 'blocked', 'services_off', 'revoked'].includes(this.own.permission_state);
      if (!allowedByUser || blocked) {
        this.stopLocationCycle();
        return;
      }
      await this.observeOfficialPermission();
      this.startLocationCycle();
      if (direct) this.triggerLocation(reason);
    },

    showConsent() {
      if (!deviceLocationAllowed() || $('v108Consent') || !this.central?.enabled || !this.own?.admin_enabled || isImpersonating()) return;
      document.body.insertAdjacentHTML('beforeend', `
        <div id="v108Consent" class="v108Consent" role="dialog" aria-modal="true" aria-labelledby="v108ConsentTitle">
          <div class="v108ConsentCard"><h2 id="v108ConsentTitle">Routefunctionaliteit inschakelen</h2><p>Deze app gebruikt je locatie voor route- en navigatiefuncties met Google Maps, Waze en Kaarten.</p><div class="v108ConsentActions"><button type="button" id="v108ConsentAllow">Toestaan</button><button type="button" id="v108ConsentLater" class="secondary">Nu niet</button></div></div>
        </div>`);
      $('v108ConsentAllow').addEventListener('click', () => this.acceptAndRequest());
      $('v108ConsentLater').addEventListener('click', () => this.deferConsent());
    },

    closeConsent() {
      $('v108Consent')?.remove();
    },

    async deferConsent() {
      try {
        await this.setOwn({ enabled: false, promptState: 'deferred', permissionState: this.own?.permission_state || 'unknown' });
        this.closeConsent();
        this.stopLocationCycle();
      } catch (error) {
        const message = $('v108OwnMessage');
        if (message) message.textContent = error.message;
      }
    },

    async acceptAndRequest() {
      if (!deviceLocationAllowed() || !this.central?.enabled || !this.own?.admin_enabled || isImpersonating()) return;
      try {
        this.closeConsent();
        await this.setOwn({ enabled: true, promptState: 'accepted', permissionState: 'prompt' });
        this.startLocationCycle();
        await this.triggerLocation('toestemming gegeven', true);
      } catch (error) {
        const message = $('v108OwnMessage');
        if (message) { message.textContent = error.message; message.className = 'v108Error'; }
      }
    },

    async disableOwn() {
      try {
        await this.setOwn({
          enabled: false,
          promptState: this.own?.app_prompt_state || 'deferred',
          permissionState: this.own?.permission_state || 'unknown'
        });
        this.stopLocationCycle();
      } catch (error) {
        $('v108OwnMessage').textContent = error.message;
      }
    },

    startLocationCycle() {
      if (!deviceLocationAllowed() || !this.central?.enabled || !this.own?.admin_enabled || isImpersonating() || !this.own?.route_location_enabled || this.own?.app_prompt_state !== 'accepted') {
        this.stopLocationCycle();
        return;
      }
      this.bindLocationListeners();
      this.restartLocationTimer();
    },

    restartLocationTimer() {
      if (this.locationTimer) clearInterval(this.locationTimer);
      this.locationTimer = null;
      if (!deviceLocationAllowed() || !this.central?.enabled || !this.own?.admin_enabled || isImpersonating() || !this.own?.route_location_enabled) return;
      const trackingUntil = this.own?.tracking_until ? new Date(this.own.tracking_until).getTime() : 0;
      const minutes = trackingUntil > Date.now() ? 1 : (ALLOWED_INTERVALS.includes(Number(this.central.update_interval_minutes)) ? Number(this.central.update_interval_minutes) : 10);
      this.locationTimer = setInterval(() => {
        if (trackingUntil && Date.now() >= trackingUntil) { this.restartLocationTimer(); return; }
        if (document.visibilityState !== 'hidden') this.triggerLocation('ingestelde interval');
      }, minutes * 60000);
    },

    bindLocationListeners() {
      if (this.locationListenersBound) return;
      this.handlers.visibility = () => { if (document.visibilityState === 'visible') this.triggerLocation('terug op voorgrond'); };
      this.handlers.focus = () => this.triggerLocation('venster actief');
      this.handlers.pageshow = () => this.triggerLocation('app geopend');
      this.handlers.online = () => this.triggerLocation('internet hersteld');
      document.addEventListener('visibilitychange', this.handlers.visibility);
      window.addEventListener('focus', this.handlers.focus);
      window.addEventListener('pageshow', this.handlers.pageshow);
      window.addEventListener('online', this.handlers.online);
      this.locationListenersBound = true;
    },

    unbindLocationListeners() {
      if (!this.locationListenersBound) return;
      document.removeEventListener('visibilitychange', this.handlers.visibility);
      window.removeEventListener('focus', this.handlers.focus);
      window.removeEventListener('pageshow', this.handlers.pageshow);
      window.removeEventListener('online', this.handlers.online);
      this.locationListenersBound = false;
    },

    stopLocationCycle() {
      if (this.locationTimer) clearInterval(this.locationTimer);
      this.locationTimer = null;
      this.unbindLocationListeners();
      this.releasePermissionHandle();
    },

    async observeOfficialPermission() {
      this.releasePermissionHandle();
      if (!deviceLocationAllowed()) return 'disabled';
      if (!navigator.permissions?.query) return 'unknown';
      try {
        const handle = await navigator.permissions.query({ name: 'geolocation' });
        this.permissionHandle = handle;
        const changed = async () => {
          if (!this.own) return;
          if (handle.state === 'denied') {
            const state = this.own.permission_state === 'granted' ? 'revoked' : 'blocked';
            await this.recordPermissionFailure(state, 'Locatietoestemming is in de browser/iPhone geblokkeerd.');
            this.stopLocationCycle();
          } else if (handle.state === 'granted' && this.central?.enabled && this.own?.admin_enabled && this.own?.route_location_enabled && !isImpersonating()) {
            await this.setOwn({ enabled: true, promptState: 'accepted', permissionState: 'granted' });
            this.startLocationCycle();
            this.triggerLocation('toestemming hersteld', true);
          }
        };
        handle.addEventListener?.('change', changed);
        this.handlers.permissionChanged = changed;
        return handle.state;
      } catch (_) {
        return 'unknown';
      }
    },

    releasePermissionHandle() {
      if (this.permissionHandle && this.handlers.permissionChanged) {
        this.permissionHandle.removeEventListener?.('change', this.handlers.permissionChanged);
      }
      this.permissionHandle = null;
      this.handlers.permissionChanged = null;
    },

    async triggerLocation(reason, force = false) {
      const now = Date.now();
      if (!deviceLocationAllowed()) return false;
      if (!force && now - this.lastTriggerAt < EVENT_DEDUP_MS) return false;
      if (this.requestInFlight || !this.central?.enabled || !this.own?.admin_enabled || isImpersonating() || !this.own?.route_location_enabled || this.own?.app_prompt_state !== 'accepted') return false;
      const trackingUntil=this.own?.tracking_until?new Date(this.own.tracking_until).getTime():0;
      const intervalMinutes=trackingUntil>now?1:(ALLOWED_INTERVALS.includes(Number(this.central.update_interval_minutes))?Number(this.central.update_interval_minutes):10);
      const lastCaptured=this.ownLive?.captured_at?new Date(this.ownLive.captured_at).getTime():0;
      if(!force&&lastCaptured&&now-lastCaptured<intervalMinutes*60000*0.9)return false;
      this.lastTriggerAt = now;
      if (!navigator.onLine) {
        this.setLocalError('Geen internet. Bij het volgende geschikte moment wordt opnieuw geprobeerd.');
        return false;
      }
      if (!navigator.geolocation) {
        await this.recordPermissionFailure('unavailable', 'Locatie is niet beschikbaar in deze browser.');
        this.stopLocationCycle();
        return false;
      }
      this.requestInFlight = true;
      this.setLocalError(`Locatie wordt opgehaald (${reason})…`, true);
      try {
        const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 20000, maximumAge: 0
        }));
        if (!this.central?.enabled || isImpersonating()) return false;
        const coords = position.coords;
        const capturedAt = new Date(position.timestamp || Date.now()).toISOString();
        const { data, error } = await identityClient().rpc('save_my_live_location', {
          p_latitude: Number(coords.latitude),
          p_longitude: Number(coords.longitude),
          p_accuracy: Number(coords.accuracy),
          p_captured_at: capturedAt,
          p_speed_mps: Number.isFinite(coords.speed) && coords.speed >= 0 ? Number(coords.speed) : null,
          p_heading_degrees: Number.isFinite(coords.heading) && coords.heading >= 0 ? Number(coords.heading) : null
        });
        if (error) throw error;
        this.ownLive = {
          user_id: realUserId(), latitude: coords.latitude, longitude: coords.longitude,
          accuracy: coords.accuracy, captured_at: capturedAt, updated_at: data?.received_at || new Date().toISOString()
        };
        this.own = { ...this.own, permission_state: 'granted', last_error: null };
        this.renderOwn();
        this.setLocalError('');
        this.startLocationCycle();
        return true;
      } catch (error) {
        await this.handleLocationError(error);
        return false;
      } finally {
        this.requestInFlight = false;
      }
    },

    async handleLocationError(error) {
      let state = 'error';
      let message = error?.message || 'Locatie verzenden is mislukt.';
      if (error?.code === 1) {
        let browserState = 'unknown';
        try { browserState = (await navigator.permissions?.query?.({ name: 'geolocation' }))?.state || 'unknown'; } catch (_) {}
        state = browserState === 'denied' ? (this.own?.permission_state === 'granted' ? 'revoked' : 'blocked') : 'denied';
        message = state === 'revoked' ? 'Locatietoestemming is later ingetrokken.' : 'Locatietoestemming is geweigerd of geblokkeerd.';
      } else if (error?.code === 2) {
        state = /service|dienst|disabled|uitgeschakeld/i.test(message) ? 'services_off' : 'unavailable';
        message = state === 'services_off' ? 'Locatieservices staan uit op dit apparaat.' : 'Locatie is tijdelijk niet beschikbaar.';
      } else if (error?.code === 3) {
        state = 'timeout';
        message = 'Locatie ophalen duurde te lang (timeout).';
      } else if (/centraal uit/i.test(message)) {
        await this.loadCentral().catch(() => {});
      }
      await this.recordPermissionFailure(state, message);
      if (['denied', 'blocked', 'services_off', 'revoked'].includes(state)) this.stopLocationCycle();
    },

    async recordPermissionFailure(state, message) {
      this.setLocalError(message);
      try {
        await this.setOwn({
          enabled: Boolean(this.own?.route_location_enabled),
          promptState: this.own?.app_prompt_state || 'accepted',
          permissionState: state,
          errorMessage: message
        });
      } catch (_) {
        this.own = { ...(this.own || {}), permission_state: state, last_error: message };
        this.renderOwn();
      }
    },

    setLocalError(message, neutral = false) {
      const target = $('v108OwnMessage');
      if (!target) return;
      target.textContent = message || '';
      target.className = neutral ? 'v108Neutral' : 'v108Error';
    },

    startConfigSync() {
      const client = identityClient();
      if (this.configChannel) client.removeChannel(this.configChannel);
      this.configChannel = client.channel(`v108-location-config-${realUserId()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'location_system_settings', filter: 'id=eq.1' }, async (payload) => {
          this.central = payload.new;
          this.renderCentral();
          await this.reconcile({ direct: Boolean(payload.new.enabled), reason: 'centrale wijziging ontvangen' });
          if (isAdmin()) this.scheduleAdminRefresh();
        }).subscribe();
      if (this.configFallbackTimer) clearInterval(this.configFallbackTimer);
      this.configFallbackTimer = setInterval(() => this.loadCentral().catch(() => {}), FALLBACK_MS);
    },

    startOwnSync() {
      const client = identityClient();
      const uid = realUserId();
      if (this.ownChannel) client.removeChannel(this.ownChannel);
      this.ownChannel = client.channel(`v108-location-own-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_location_settings', filter: `user_id=eq.${uid}` }, async () => {
          await this.loadOwn();
          await this.reconcile({ direct: false, reason: 'eigen instelling gesynchroniseerd' });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_live_locations', filter: `user_id=eq.${uid}` }, () => this.loadOwn().catch(() => {}))
        .subscribe();
    },

    startAdminSync() {
      if (!isAdmin()) return;
      const client = identityClient();
      if (this.adminChannel) client.removeChannel(this.adminChannel);
      this.adminChannel = client.channel(`v108-location-admin-${realUserId()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_live_locations' }, () => this.scheduleAdminRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_location_settings' }, () => this.scheduleAdminRefresh())
        .subscribe();
      if (this.adminFallbackTimer) clearInterval(this.adminFallbackTimer);
      this.adminFallbackTimer = setInterval(() => this.refreshAdmin().catch(() => {}), FALLBACK_MS);
    },

    scheduleAdminRefresh() {
      if (this.adminRefreshTimer) clearTimeout(this.adminRefreshTimer);
      this.adminRefreshTimer = setTimeout(async () => {
        await this.refreshAdmin();
        if (this.selectedHistoryUser) await this.loadHistory();
      }, 350);
    },

    async refreshAdmin() {
      if (!isAdmin() || !$('adminPaneLiveLocations')) return;
      const list = $('v108LocationList');
      if (list) list.innerHTML = '<div class="v108Neutral">Gebruikers en locaties worden geladen…</div>';
      const { data, error } = await identityClient().rpc('get_admin_live_locations');
      if (error) {
        const missing = /does not exist|not found|schema cache|PGRST202/i.test(String(error.message || ''));
        if (list) list.innerHTML = `<div class="v108Error"><strong>Live Locaties konden niet worden geladen.</strong><br>${missing ? 'De database-uitbreiding voor Live Locaties ontbreekt. Voer SUPABASE_V11_1_RELEASE.sql één keer uit in Supabase.' : esc(error.message)}</div>`;
        return;
      }
      this.adminRows = data || [];
      this.renderAdminList();
      this.renderCurrentMap();
      this.renderHistoryUsers();
      this.renderCentral();
    },

    async setAdminUserEnabled(userId, enabled, button) {
      if (!isAdmin() || !userId) return;
      const original = button?.textContent;
      if (button) { button.disabled = true; button.textContent = 'Opslaan…'; }
      try {
        const { error } = await identityClient().rpc('set_user_location_enabled', {
          p_user_id: userId,
          p_enabled: Boolean(enabled)
        });
        if (error) throw error;
        await this.refreshAdmin();
      } catch (error) {
        alert(`Live Locaties wijzigen mislukt: ${error.message}`);
        if (button) { button.disabled = false; button.textContent = original; }
      }
    },

    async setLiveTracking(userId, enabled, button) {
      if (!isAdmin() || !userId) return;
      const original = button?.textContent;
      if (button) { button.disabled = true; button.textContent = enabled ? 'Starten…' : 'Stoppen…'; }
      try {
        const { error } = await identityClient().rpc('set_user_live_tracking', { p_user_id: userId, p_enabled: Boolean(enabled), p_minutes: 30 });
        if (error) throw error;
        await this.refreshAdmin();
      } catch (error) {
        alert(`Live volgen wijzigen mislukt: ${error.message}`);
        if (button) { button.disabled = false; button.textContent = original; }
      }
    },

    renderAdminList() {
      const list = $('v108LocationList');
      if (!list) return;
      const centralEnabled = Boolean(this.central?.enabled);
      const interval = Number(this.central?.update_interval_minutes || 10);
      list.innerHTML = this.adminRows.length ? this.adminRows.map((row) => {
        const userEnabled = row.admin_enabled === true;
        const status = userEnabled ? locationStatus(row.captured_at, interval, centralEnabled) : { key: 'disabled', label: 'Uit voor gebruiker' };
        const avatar = row.avatar_url ? `<img src="${esc(row.avatar_url)}" alt="">` : esc(initials(row));
        const maps = row.latitude == null ? '' : `<a class="btnlink" target="_blank" rel="noopener" href="${esc(googleMapsUrl(row.latitude, row.longitude))}">Openen in Google Maps</a>`;
        const trackingUntil = row.tracking_until ? new Date(row.tracking_until).getTime() : 0, tracking = trackingUntil > Date.now();
        const trackingText = tracking ? `Live volgen tot ${new Date(trackingUntil).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : '30 minuten live volgen';
        return `<article class="v108LocationCard"><div class="v108LocationHead"><div class="v108Avatar">${avatar}</div><div><div class="v108LocationName">${esc(row.full_name || row.email)}</div><div class="v108LocationMeta">${esc(row.email || '')}</div></div><span class="v108Pill ${status.key}">${status.label}</span></div><div class="v108Permission">Toestemming: ${esc(promptLabel(row.app_prompt_state))} · iPhone/browser: ${esc(permissionLabel(row.permission_state))}</div><div class="v108LocationMeta">Gemeten: ${esc(formatDate(row.captured_at))}<br>Ontvangen: ${esc(formatDate(row.received_at))}<br>Ouderdom: ${esc(ageLabel(row.captured_at))}<br>Nauwkeurigheid: ${row.accuracy == null ? 'onbekend' : `${Math.round(row.accuracy)} meter`}</div>${row.last_error ? `<div class="v108Error">${esc(row.last_error)}</div>` : ''}<div class="v108Actions"><button type="button" class="v108UserLocationToggle ${userEnabled ? 'secondary' : ''}" data-user-id="${esc(row.user_id)}" data-enabled="${userEnabled}">${userEnabled ? 'Live Locaties uitzetten' : 'Live Locaties aanzetten'}</button>${userEnabled ? `<button type="button" class="v108TrackingToggle ${tracking ? 'secondary' : ''}" data-user-id="${esc(row.user_id)}" data-tracking="${tracking}">${tracking ? 'Live volgen stoppen' : trackingText}</button>` : ''}${maps}</div>${tracking ? '<div class="v108Neutral">Iedere minuut een actuele positie zolang de app zichtbaar/actief is.</div>' : ''}</article>`;
      }).join('') : '<div class="v108Neutral">Geen gebruikers gevonden.</div>';
    },

    ensureMap(kind, elementId) {
      if (!window.L || !$(elementId)) return null;
      const mapKey = kind === 'current' ? 'currentMap' : 'historyMap';
      const layerKey = kind === 'current' ? 'currentMapLayer' : 'historyMapLayer';
      if (!this[mapKey]) {
        $(elementId).innerHTML = '';
        this[mapKey] = window.L.map(elementId, { zoomControl: true });
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap-bijdragers'
        }).addTo(this[mapKey]);
        this[layerKey] = window.L.layerGroup().addTo(this[mapKey]);
      }
      this[layerKey].clearLayers();
      return this[mapKey];
    },

    userMarkerIcon(row, status) {
      const content = row.avatar_url ? `<img src="${esc(row.avatar_url)}" alt="">` : esc(initials(row));
      return window.L.divIcon({
        className: '',
        html: `<div class="v108UserMarker ${status.key}">${content}</div>`,
        iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -20]
      });
    },

    renderCurrentMap() {
      const map = this.ensureMap('current', 'v108CurrentMap');
      if (!map) return;
      const layer = this.currentMapLayer;
      const interval = Number(this.central?.update_interval_minutes || 10);
      const points = this.adminRows.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
      points.forEach((row) => {
        const status = locationStatus(row.captured_at, interval, Boolean(this.central?.enabled));
        const popup = `<div class="v108LeafletPopup"><strong>${esc(row.full_name || row.email)}</strong>Status: ${status.label}<br>Gemeten: ${esc(formatDate(row.captured_at))}<br>Ouderdom: ${esc(ageLabel(row.captured_at))}<br>Nauwkeurigheid: ${Math.round(row.accuracy || 0)} m<br><a target="_blank" rel="noopener" href="${esc(googleMapsUrl(row.latitude, row.longitude))}">Google Maps openen</a></div>`;
        window.L.marker([row.latitude, row.longitude], { icon: this.userMarkerIcon(row, status) }).bindPopup(popup).addTo(layer);
      });
      if (points.length) map.fitBounds(window.L.latLngBounds(points.map((row) => [row.latitude, row.longitude])), { padding: [28, 28], maxZoom: 15 });
      else map.setView([52.1326, 5.2913], 7);
      setTimeout(() => map.invalidateSize(), 40);
    },

    renderHistoryUsers() {
      const select = $('v108HistoryUser');
      if (!select) return;
      const prior = this.selectedHistoryUser || select.value;
      select.innerHTML = '<option value="">Kies een gebruiker</option>' + this.adminRows.map((row) => `<option value="${esc(row.user_id)}">${esc(row.full_name || row.email)}</option>`).join('');
      if (prior && this.adminRows.some((row) => row.user_id === prior)) {
        select.value = prior;
        this.selectedHistoryUser = prior;
      }
    },

    async loadHistory() {
      if (!isAdmin()) return;
      const userId = this.selectedHistoryUser || $('v108HistoryUser')?.value;
      const hours = Number($('v108HistoryHours')?.value || this.selectedHistoryHours || 24);
      this.selectedHistoryUser = userId || null;
      this.selectedHistoryHours = [1, 4, 8, 24].includes(hours) ? hours : 24;
      if (!userId) {
        this.historyRows = [];
        this.renderHistory();
        return;
      }
      const { data, error } = await identityClient().rpc('get_admin_location_history', { p_user_id: userId, p_hours: [1, 4, 8, 24].includes(hours) ? hours : 24 });
      if (error) {
        $('v108HistoryList').innerHTML = `<div class="v108Error">${esc(error.message)}</div>`;
        return;
      }
      this.historyRows = data || [];
      this.renderHistory();
    },

    renderHistory() {
      const list = $('v108HistoryList');
      if (!list) return;
      list.innerHTML = this.historyRows.length ? this.historyRows.map((point, index) => {
        const oldest = index === 0;
        const latest = index === this.historyRows.length - 1;
        const labels = [oldest ? 'oudste' : '', latest ? 'nieuwste' : ''].filter(Boolean).join(' en ');
        return `<div class="v108HistoryPoint ${latest ? 'latest' : ''}"><div class="v108PointNumber">${index + 1}</div><div><strong>Punt ${index + 1}${labels ? ` · ${labels}` : ''}</strong><div>${esc(formatDate(point.captured_at))}</div><div class="v108LocationMeta">Ontvangen ${esc(formatDate(point.received_at))} · nauwkeurigheid ${Math.round(point.accuracy || 0)} m</div></div>${latest ? `<a class="btnlink" target="_blank" rel="noopener" href="${esc(googleMapsUrl(point.latitude, point.longitude))}">Google Maps</a>` : ''}</div>`;
      }).join('') : '<div class="v108MapEmpty">Geen punten in deze periode.</div>';
      const map = this.ensureMap('history', 'v108HistoryMap');
      if (!map) return;
      const coordinates = this.historyRows.map((point) => [point.latitude, point.longitude]);
      if (coordinates.length > 1) window.L.polyline(coordinates, { color: '#083b86', weight: 4, opacity: .72 }).addTo(this.historyMapLayer);
      this.historyRows.forEach((point, index) => {
        const latest = index === this.historyRows.length - 1;
        const icon = window.L.divIcon({ className: '', html: `<div class="v108HistoryMarker ${latest ? 'latest' : ''}">${index + 1}</div>`, iconSize: latest ? [34, 34] : [28, 28], iconAnchor: latest ? [17, 17] : [14, 14] });
        const labels = [index === 0 ? 'oudste' : '', latest ? 'nieuwste' : ''].filter(Boolean).join(' en ');
        window.L.marker([point.latitude, point.longitude], { icon }).bindPopup(`<div class="v108LeafletPopup"><strong>Punt ${index + 1}${labels ? ` · ${labels}` : ''}</strong>${esc(formatDate(point.captured_at))}<br>Nauwkeurigheid: ${Math.round(point.accuracy || 0)} m</div>`).addTo(this.historyMapLayer);
      });
      if (coordinates.length) map.fitBounds(window.L.latLngBounds(coordinates), { padding: [28, 28], maxZoom: 16 });
      else map.setView([52.1326, 5.2913], 7);
      setTimeout(() => map.invalidateSize(), 40);
    },

    invalidateMaps() {
      this.currentMap?.invalidateSize();
      this.historyMap?.invalidateSize();
    },

    destroy() {
      this.stopLocationCycle();
      this.closeConsent();
      if (this.configFallbackTimer) clearInterval(this.configFallbackTimer);
      if (this.adminFallbackTimer) clearInterval(this.adminFallbackTimer);
      if (this.adminRefreshTimer) clearTimeout(this.adminRefreshTimer);
      this.configFallbackTimer = this.adminFallbackTimer = this.adminRefreshTimer = null;
      const client = identityClient();
      [this.configChannel, this.ownChannel, this.adminChannel].forEach((channel) => { if (client && channel) client.removeChannel(channel); });
      this.configChannel = this.ownChannel = this.adminChannel = null;
      window.removeEventListener('gj-auth-signed-out', this.handlers.signedOut);
      window.removeEventListener('beforeunload', this.handlers.beforeUnload);
      this.initialized = false;
    }
  };

  window.__GJ_LIVE_LOCATIONS_V108__ = Object.freeze({
    manager,
    test: Object.freeze({ ageMinutes, ageLabel, locationStatus, permissionLabel, promptLabel, ALLOWED_INTERVALS })
  });

  window.addEventListener('gj-auth-ready', () => manager.init().catch((error) => {
    console.error('Live Locaties initialiseren mislukt', error);
    const target = $('v108LocationList') || $('v108OwnMessage');
    if (target) target.innerHTML = `<div class="v108Error"><strong>Live Locaties konden niet starten.</strong><br>${esc(error.message)}<br>Controleer of SUPABASE_V11_1_RELEASE.sql is uitgevoerd.</div>`;
  }));
  if (window.GJ_AUTH?.profile && identityClient()) queueMicrotask(() => manager.init().catch(console.error));
})();
