const $ = id => document.getElementById(id);
const config = window.MAGIC_CONFIG;
// Somente um link de recuperação pode abrir este formulário. Uma sessão comum
// de outra conta não é tratada como autorização para uma redefinição.
let recovery = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
let ready = false;
const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
client.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    recovery = true;
    ready = true;
    $('resetForm').hidden = false;
    $('resetStatus').textContent = 'Escolha uma senha com pelo menos 8 caracteres.';
  }
});
try {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session || !recovery) throw new Error('invalid');
  ready = true;
  $('resetForm').hidden = false;
  $('resetStatus').textContent = 'Escolha uma senha com pelo menos 8 caracteres.';
} catch {
  if (!ready) $('resetStatus').textContent = 'Abra esta página pelo link de recuperação enviado ao seu e-mail. Se ele expirou, solicite outro em “Esqueci minha senha”.';
}
$('resetForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready || !recovery) return;
  const password = $('newPassword').value;
  if (password.length < 8 || password !== $('confirmPassword').value) {
    $('resetStatus').textContent = 'As senhas devem ser iguais e ter pelo menos 8 caracteres.';
    return;
  }
  $('resetSubmit').disabled = true;
  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    ready = false;
    $('newPassword').value = '';
    $('confirmPassword').value = '';
    $('resetForm').hidden = true;
    $('resetStatus').textContent = 'Senha atualizada! Volte ao Magic e entre com a nova senha. Seus dados foram preservados.';
    await client.auth.signOut({ scope: 'local' });
  } catch {
    $('resetStatus').textContent = 'Não foi possível alterar a senha. O link pode ter expirado ou a nova senha pode não atender aos requisitos. Solicite outro link se necessário.';
  } finally { $('resetSubmit').disabled = false; }
});
