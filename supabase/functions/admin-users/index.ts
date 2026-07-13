import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' }
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw new Error('Serverconfiguratie ontbreekt.');
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Niet ingelogd.' }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userResult, error: userError } = await admin.auth.getUser(token);
    if (userError || !userResult.user) return json({ error: 'Ongeldige sessie.' }, 401);
    const { data: profile } = await admin.from('profiles').select('role,is_active').eq('id', userResult.user.id).maybeSingle();
    if (profile?.role !== 'admin' || profile?.is_active === false) return json({ error: 'Alleen beheerders.' }, 403);

    const body = await request.json();
    if (body.action === 'list') {
      const { data: authPage, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const { data: profiles, error: profileError } = await admin.from('profiles').select('*');
      if (profileError) throw profileError;
      const byId = new Map((profiles || []).map((row) => [row.id, row]));
      const users = (authPage.users || []).map((user) => {
        const row = byId.get(user.id) || {};
        return { id: user.id, email: user.email, first_name: row.first_name || '', last_name: row.last_name || '', full_name: row.full_name || user.email, role: row.role || 'user', is_active: row.is_active !== false, avatar_url: row.avatar_url || null };
      });
      return json({ users });
    }
    if (body.action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || password.length < 8) return json({ error: 'E-mail en minimaal 8 tekens wachtwoord zijn verplicht.' }, 400);
      const first = String(body.first_name || '').trim();
      const last = String(body.last_name || '').trim();
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { first_name: first, last_name: last, full_name: [first, last].filter(Boolean).join(' ') || email }
      });
      if (error) throw error;
      await admin.from('profiles').upsert({ id: data.user.id, email, first_name: first, last_name: last, full_name: [first, last].filter(Boolean).join(' ') || email, role: 'user', is_active: body.is_active !== false, updated_at: new Date().toISOString() });
      return json({ user: { id: data.user.id, email } });
    }
    if (body.action === 'set_active') {
      const target = String(body.user_id || '');
      if (!target || target === userResult.user.id) return json({ error: 'Ongeldige gebruiker.' }, 400);
      const { error } = await admin.from('profiles').update({ is_active: Boolean(body.is_active), updated_at: new Date().toISOString() }).eq('id', target);
      if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === 'set_password') {
      const target = String(body.user_id || '');
      const password = String(body.password || '');
      if (!target || password.length < 8) return json({ error: 'Ongeldige gebruiker of wachtwoord.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(target, { password });
      if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === 'delete') {
      const target = String(body.user_id || '');
      if (!target || target === userResult.user.id) return json({ error: 'Je kunt je eigen beheerdersaccount niet verwijderen.' }, 400);

      const { data: targetProfile, error: targetProfileError } = await admin.from('profiles').select('role').eq('id', target).maybeSingle();
      if (targetProfileError) throw targetProfileError;
      if (targetProfile?.role === 'admin') return json({ error: 'Een beheerdersaccount kan hier niet worden verwijderd.' }, 400);

      // Verzamel bestandspaden voordat de databasecascade de bijbehorende rijen verwijdert.
      const [{ data: visitPhotos }, { data: ownedThreads }] = await Promise.all([
        admin.from('visit_photos').select('file_path').eq('user_id', target),
        admin.from('contact_threads').select('id').eq('user_id', target)
      ]);
      const threadIds = (ownedThreads || []).map((row) => row.id);
      let attachmentPaths: string[] = [];
      if (threadIds.length) {
        const { data: attachments } = await admin.from('contact_attachments').select('storage_path').in('thread_id', threadIds);
        attachmentPaths = (attachments || []).map((row) => row.storage_path).filter(Boolean);
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(target);
      if (deleteError) throw deleteError;

      // Databasegegevens verdwijnen door ON DELETE CASCADE. Storage wordt apart opgeruimd.
      const cleanupWarnings: string[] = [];
      const visitPaths = (visitPhotos || []).map((row) => row.file_path).filter(Boolean);
      if (visitPaths.length) {
        const { error } = await admin.storage.from('visit-photos').remove(visitPaths);
        if (error) cleanupWarnings.push('Niet alle bezoekfoto’s konden worden verwijderd.');
      }
      if (attachmentPaths.length) {
        const { error } = await admin.storage.from('contact-attachments').remove(attachmentPaths);
        if (error) cleanupWarnings.push('Niet alle contactbijlagen konden worden verwijderd.');
      }
      const { data: profileFiles, error: profileListError } = await admin.storage.from('profile-photos').list(target, { limit: 100 });
      if (profileListError) cleanupWarnings.push('Profielfoto controleren mislukt.');
      const profilePaths = (profileFiles || []).map((file) => `${target}/${file.name}`);
      if (profilePaths.length) {
        const { error } = await admin.storage.from('profile-photos').remove(profilePaths);
        if (error) cleanupWarnings.push('De profielfoto kon niet worden verwijderd.');
      }
      return json({ ok: true, warnings: cleanupWarnings });
    }
    return json({ error: 'Onbekende actie.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
