import { validateSnapshot, emptySnapshot, errorMessage } from './core.js';

const config = window.MAGIC_CONFIG || {};
const $ = id => document.getElementById(id);
const login = $('cloudLogin');
const welcome = $('cloudWelcome');
const notice = $('cloudNotice');
const lock = $('cloudLock');
let client, user, revision = 0, queued = null, inFlight = null, flushing = false, blocked = false, started = false;
let loadedPayload, exportedRecovery = false;
let signupMode = false;
const draftKey = () => `magic:pending:${user.id}`;
const status = text => { $('cloudStatus').textContent = text; };

function preserveDraft() {
  const draft = { baseRevision: revision, inFlight, queued };
  try { localStorage.setItem(draftKey(), JSON.stringify(draft)); }
  catch { throw new Error('O navegador está sem espaço. Baixe um backup antes de fechar esta página.'); }
}
function download(value, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function showLock(message) {
  blocked = true;
  $('cloudLockMessage').textContent = message;
  lock.hidden = false;
  document.querySelector('.app-container').inert = true;
  $('cloudRecovery').focus();
}
async function readRemote() {
  const { data, error } = await client.from('magic_states').select('payload,revision,request_id').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data;
}
async function flush() {
  if (flushing || blocked || !user || (!queued && !inFlight)) return;
  flushing = true;
  try {
    while (queued || inFlight) {
      if (!inFlight) {
        inFlight = { payload: queued, expected: revision, requestId: crypto.randomUUID() };
        queued = null;
      }
      preserveDraft();
      status('Sincronizando…');
      const { data, error } = await client.rpc('magic_save', {
        p_payload: inFlight.payload, p_expected_revision: inFlight.expected, p_request_id: inFlight.requestId
      });
      if (error) throw error;
      revision = data.revision;
      inFlight = null;
      if (queued) preserveDraft();
      else localStorage.removeItem(draftKey());
    }
    status('Salvo online');
    notice.hidden = true;
  } catch (error) {
    status('Há alterações pendentes');
    notice.textContent = errorMessage(error);
    notice.hidden = false;
    if (String(error.message).includes('MAGIC_CONFLICT')) showLock(errorMessage(error));
  } finally { flushing = false; }
}

function safeMarkup(raw) {
  const template = document.createElement('template');
  template.innerHTML = String(raw || '');
  const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'BR', 'SPAN', 'SMALL', 'CODE']);
  const clean = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowed.has(child.tagName)) { child.replaceWith(document.createTextNode(child.textContent)); continue; }
        for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
        clean(child);
      } else if (child.nodeType !== Node.TEXT_NODE) child.remove();
    }
  };
  clean(template.content);
  return template.innerHTML;
}

window.MagicCloud = {
  save(payload) {
    if (blocked || !started) return;
    queued = structuredClone(payload);
    try { preserveDraft(); } catch (error) { showLock(error.message); return; }
    void flush();
  },
  safeMarkup,
  async chat(body) {
    const { data, error } = await client.functions.invoke(config.chatFunction || 'magic-chat', { body });
    if (error) throw error;
    return new Response(data.text || '', { status: 200 });
  }
};

async function boot(payload) {
  validateSnapshot(payload);
  loadedPayload = structuredClone(payload);
  window.MAGIC_BOOTSTRAP = { payload: loadedPayload, userId: user.id };
  login.hidden = true;
  welcome.hidden = true;
  document.body.classList.remove('cloud-locked');
  if (!started) {
    const script = document.createElement('script');
    script.src = './app.js';
    await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.body.appendChild(script); });
    window.MagicApp.start();
    started = true;
  } else window.MagicApp.applyRemote(payload);
  $('cloudAccount').textContent = user.email;
  $('cloudBar').hidden = false;
  $('cloudBackup').disabled = false;
  status('Salvo online');
}

async function enter(session) {
  user = session.user;
  $('cloudAuthMessage').textContent = 'Carregando seus dados…';
  const remote = await readRemote();
  revision = remote?.revision || 0;
  blocked = false;
  document.querySelector('.app-container').inert = false;
  let draft;
  try { draft = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch { /* cache ilegível não substitui a nuvem */ }
  if (draft?.inFlight || draft?.queued) {
    const acknowledged = draft.inFlight && remote?.request_id === draft.inFlight.requestId;
    const local = draft.queued || draft.inFlight?.payload;
    // Se a última resposta se perdeu, o request_id evita duplicar aquela gravação.
    if (acknowledged && !draft.queued) localStorage.removeItem(draftKey());
    else {
      inFlight = acknowledged ? null : draft.inFlight;
      queued = draft.queued;
      await boot(local);
      if (acknowledged || draft.baseRevision === revision) {
        blocked = false;
        await flush();
      } else showLock('Há alterações locais e uma versão diferente na nuvem. Baixe sua cópia local antes de carregar a versão online.');
      return;
    }
  }
  if (remote) await boot(remote.payload);
  else {
    login.hidden = true;
    welcome.hidden = false;
    $('cloudBar').hidden = false;
    $('cloudBackup').disabled = true;
    $('cloudAccount').textContent = user.email;
    status('Importe seus dados para começar');
  }
}

$('cloudLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('cloudSubmit').disabled = true;
  try {
    const credentials = { email: $('cloudEmail').value.trim(), password: $('cloudPassword').value };
    if (signupMode && credentials.password.length < 8) throw new Error('Escolha uma senha com pelo menos 8 caracteres.');
    const { data, error } = signupMode
      ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: location.href.split('#')[0] } })
      : await client.auth.signInWithPassword(credentials);
    $('cloudPassword').value = '';
    if (error) throw error;
    if (data.session) await enter(data.session);
    else {
      signupMode = false;
      $('cloudSubmit').textContent = 'Entrar';
      $('cloudSignup').textContent = 'Primeiro acesso? Criar minha conta';
      $('cloudAuthMessage').textContent = 'Confira seu e-mail para confirmar o cadastro. Depois volte aqui e entre com sua senha.';
    }
  } catch (error) {
    $('cloudAuthMessage').textContent = /8 caracteres/.test(error.message) ? error.message
      : /invalid|credentials/i.test(error.message) ? 'Confira seu e-mail e sua senha.'
      : /email.*confirm/i.test(error.message) ? 'Confirme seu cadastro pelo e-mail antes de entrar.'
      : /rate.*limit/i.test(error.message) ? 'O limite de tentativas ou e-mails foi atingido. Aguarde um pouco antes de tentar novamente.'
      : 'Não foi possível entrar ou carregar os dados. Verifique a conexão e a configuração do Supabase.';
  } finally { $('cloudSubmit').disabled = false; }
});
$('cloudSignup').addEventListener('click', () => {
  signupMode = !signupMode;
  $('cloudSubmit').textContent = signupMode ? 'Criar minha conta' : 'Entrar';
  $('cloudSignup').textContent = signupMode ? 'Já tenho conta: entrar' : 'Primeiro acesso? Criar minha conta';
  $('cloudPassword').autocomplete = signupMode ? 'new-password' : 'current-password';
  $('cloudAuthMessage').textContent = signupMode ? 'Use seu e-mail e escolha uma senha com pelo menos 8 caracteres.' : 'Entre para acessar suas finanças.';
});

async function createInitial(payload) {
  validateSnapshot(payload);
  const { data, error } = await client.rpc('magic_save', { p_payload: payload, p_expected_revision: 0, p_request_id: crypto.randomUUID() });
  if (error) throw error;
  revision = data.revision;
  await boot(payload);
}
$('cloudImport').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1500000) throw new Error('O arquivo excede 1,5 MB.');
    const payload = validateSnapshot(JSON.parse(await file.text()));
    await createInitial(payload);
  } catch (error) { $('cloudImportMessage').textContent = error.message; }
  event.target.value = '';
});
$('cloudStartEmpty').addEventListener('click', async () => {
  try { await createInitial(emptySnapshot()); }
  catch { $('cloudImportMessage').textContent = 'Não foi possível iniciar. Verifique a conexão ou entre novamente.'; }
});
$('cloudBackup').addEventListener('click', () => {
  download(started ? window.MagicApp.snapshot() : loadedPayload, 'magic-backup-completo.json');
});
$('cloudRecovery').addEventListener('click', () => {
  const payload = queued || inFlight?.payload || (started ? window.MagicApp.snapshot() : loadedPayload);
  download(payload, 'magic-copia-local-pendente.json');
  exportedRecovery = true;
  $('cloudLoadOnline').disabled = false;
});
$('cloudLoadOnline').addEventListener('click', () => {
  if (!exportedRecovery) return;
  localStorage.removeItem(draftKey());
  location.reload();
});
$('cloudRetry').addEventListener('click', () => { if (!blocked) void flush(); });
$('cloudLogout').addEventListener('click', async () => {
  if (queued || inFlight) {
    showLock('Há uma alteração pendente. Baixe uma cópia antes de sair.');
    return;
  }
  await client.auth.signOut({ scope: 'local' });
  location.reload();
});
window.addEventListener('online', () => void flush());
window.addEventListener('beforeunload', event => { if (queued || inFlight) { event.preventDefault(); event.returnValue = ''; } });

let checking = false;
async function checkForUpdates() {
  if (!started || !user || blocked || flushing || inFlight || queued || checking || document.hidden) return;
  if (document.activeElement?.matches('input, textarea, select')) return;
  // Não descarta valores ainda digitados, mesmo depois de o campo perder o foco.
  if (window.MagicApp.hasDraftInputs()) return;
  checking = true;
  try {
    const remote = await readRemote();
    if (queued || inFlight || flushing || blocked) return;
    if (remote && remote.revision > revision) {
      revision = remote.revision;
      window.MagicApp.applyRemote(remote.payload);
      status('Atualizado de outro aparelho');
    }
  } catch { status('Sem conexão — verificando novamente em breve'); }
  finally { checking = false; }
}
window.addEventListener('focus', () => void checkForUpdates());
document.addEventListener('visibilitychange', () => void checkForUpdates());
setInterval(() => { void flush(); void checkForUpdates(); }, 30000);

try {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl) || !config.supabaseKey) {
    throw new Error('Configuração pendente: conecte o projeto Supabase antes de publicar o Magic.');
  }
  if (config.supabaseKey.startsWith('sb_secret_')) throw new Error('Use a chave publicável, nunca uma chave secreta.');
  client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
  $('cloudSignup').disabled = false;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) await enter(data.session);
  else { $('cloudAuthMessage').textContent = 'Entre para acessar suas finanças.'; $('cloudSubmit').disabled = false; }
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' && started) {
      blocked = true;
      document.querySelector('.app-container').inert = true;
      document.body.classList.add('cloud-locked');
      login.hidden = false;
      $('cloudAuthMessage').textContent = 'Sua sessão expirou. Entre novamente.';
    }
  });
} catch (error) {
  $('cloudAuthMessage').textContent = error.message;
  $('cloudSubmit').disabled = true;
  $('cloudSignup').disabled = true;
}
