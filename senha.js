const $ = id => document.getElementById(id);
const config = window.MAGIC_CONFIG;
const sessionClient = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
let editor, ownerId, ownerEmail, ready = false;
try {
  const { data: sessionData, error: sessionError } = await sessionClient.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('session');
  const { data: identity, error: identityError } = await sessionClient.auth.getUser();
  if (identityError || !identity.user || identity.user.id !== sessionData.session.user.id) throw new Error('session');
  ownerId = identity.user.id;
  ownerEmail = identity.user.email;
  // Captura a sessão verificada em memória para não trocar de proprietário
  // se outro separador do navegador fizer login em outra conta durante a edição.
  editor = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'magic-password-editor' }
  });
  const { data: editorData, error: editorError } = await editor.auth.setSession({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token
  });
  if (editorError || editorData.user?.id !== ownerId) throw new Error('session');
  $('passwordAccount').textContent = ownerEmail;
  $('passwordIdentity').hidden = false;
  $('passwordForm').hidden = false;
  $('passwordStatus').textContent = 'Confira o e-mail acima dos campos antes de salvar. Use pelo menos 8 caracteres.';
  ready = true;
} catch {
  $('passwordStatus').textContent = 'Abra esta página no mesmo navegador do celular em que sua conta do Magic já está conectada. Esta página não envia e-mails.';
}
$('passwordForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready) return;
  const password = $('passwordNew').value;
  if (password.length < 8 || password !== $('passwordConfirm').value) {
    $('passwordStatus').textContent = 'As duas senhas precisam ser iguais e ter pelo menos 8 caracteres.';
    return;
  }
  $('passwordSave').disabled = true;
  try {
    const { data: identity, error: identityError } = await editor.auth.getUser();
    if (identityError || identity.user?.id !== ownerId) throw new Error('session');
    const { data, error } = await editor.auth.updateUser({ password });
    if (error) throw error;
    if (data.user?.id !== ownerId) throw new Error('session');
    ready = false;
    $('passwordNew').value = '';
    $('passwordConfirm').value = '';
    $('passwordForm').hidden = true;
    $('passwordStatus').textContent = 'O Supabase confirmou: senha atualizada para ' + ownerEmail + '. Agora entre no computador com esse e-mail e a nova senha.';
  } catch (error) {
    $('passwordStatus').textContent = error.code === 'same_password'
      ? 'Essa já é a senha atual desta conta. Você pode usá-la para entrar no computador.'
      : error.code === 'reauthentication_needed'
      ? 'O Supabase exige uma nova confirmação de identidade para esta sessão. Sua senha não foi alterada.'
      : 'O Supabase não confirmou a alteração. A sessão pode ter expirado ou a senha pode não atender aos requisitos. Sua planilha não foi alterada.';
  } finally { $('passwordSave').disabled = false; }
});
