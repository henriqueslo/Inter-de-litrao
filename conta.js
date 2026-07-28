/* ============================================================
   conta.js — módulo compartilhado de conta do jogador
   Usado por index.html e partida.html.
   Requer que a página defina antes: SUPABASE_URL e SUPABASE_KEY,
   e tenha os elementos #accountLink, #accountModal, #accountModalBody.
   ============================================================ */

/* Escape de HTML para qualquer dado vindo do banco */
function esc(s){
  return String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

let playerToken = null;
try{ playerToken = sessionStorage.getItem('ilb_player_token'); }catch(e){}
let playerUser = null;
let playerRoster = null;

function playerHeaders(){
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${playerToken || SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function fetchPlayerSession(){
  if(!playerToken) return;
  try{
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: playerHeaders() });
    if(!res.ok){ playerToken = null; try{ sessionStorage.removeItem('ilb_player_token'); }catch(e){} return; }
    playerUser = await res.json();
    const rosterRes = await fetch(`${SUPABASE_URL}/rest/v1/roster?user_id=eq.${playerUser.id}&select=*`, { headers: playerHeaders() });
    const rosterRows = await rosterRes.json();
    playerRoster = rosterRows[0] || null;
  }catch(e){ /* segue sem sessão */ }
}

function renderAccountLink(){
  const link = document.getElementById('accountLink');
  if(!link) return;
  if(playerToken && playerUser){
    link.textContent = playerRoster ? '👤 ' + playerRoster.name.split(' ')[0] : '👤 Minha conta';
  } else {
    link.textContent = '👤 Entrar';
  }
}

function openAccountModal(){
  document.getElementById('accountModal').classList.add('open');
  if(playerToken && playerUser) renderAccountModalLoggedIn();
  else renderLoginModalForm();
}
function closeAccountModal(){
  document.getElementById('accountModal').classList.remove('open');
}

function renderLoginModalForm(){
  document.getElementById('accountModalBody').innerHTML = `
    <div class="modal-title">Entrar</div>
    <div class="modal-sub">Use sua conta pra votar no craque das partidas.</div>
    <label>E-mail</label>
    <input type="email" id="modalLoginEmail" maxlength="120" placeholder="seu@email.com">
    <label>Senha</label>
    <input type="password" id="modalLoginPass" maxlength="80" placeholder="••••••••">
    <div class="row-actions" style="margin-top:10px;"><button class="btn btn-ouro" onclick="modalLoginSubmit()">Entrar</button></div>
    <div id="modalMsg" class="modal-msg"></div>
    <span class="modal-toggle" onclick="renderSignupModalForm()">Ainda não tem conta? Cadastre-se</span>
  `;
}

function renderSignupModalForm(){
  document.getElementById('accountModalBody').innerHTML = `
    <div class="modal-title">Criar conta</div>
    <div class="modal-sub">Só o elenco consegue votar — depois de criar a conta, você vincula seu nome.</div>
    <label>Seu e-mail</label>
    <input type="email" id="modalSignupEmail" maxlength="120" placeholder="seu@email.com">
    <label>Crie uma senha</label>
    <input type="password" id="modalSignupPass" maxlength="80" placeholder="mínimo 6 caracteres">
    <div class="row-actions" style="margin-top:10px;"><button class="btn btn-ouro" onclick="modalSignupSubmit()">Criar conta</button></div>
    <div id="modalMsg" class="modal-msg"></div>
    <span class="modal-toggle" onclick="renderLoginModalForm()">Já tem conta? Fazer login</span>
  `;
}

async function renderAccountModalLoggedIn(){
  if(!playerRoster){
    let options = '<option value="">Carregando...</option>';
    try{
      const res = await fetch(`${SUPABASE_URL}/rest/v1/roster?user_id=is.null&select=id,name&order=name.asc`, { headers: playerHeaders() });
      const rows = await res.json();
      options = '<option value="">Selecione...</option>' + rows.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    }catch(e){}
    document.getElementById('accountModalBody').innerHTML = `
      <div class="modal-title">Falta vincular seu nome</div>
      <div class="modal-sub">Escolha quem você é no elenco pra liberar sua conta.</div>
      <label>Seu nome no elenco</label>
      <select id="modalClaimRosterId">${options}</select>
      <div class="row-actions" style="margin-top:10px;"><button class="btn btn-ouro" onclick="modalClaimSubmit()">Vincular</button></div>
      <div id="modalMsg" class="modal-msg"></div>
      <span class="modal-toggle" onclick="modalLogout()">Sair</span>
    `;
    return;
  }
  document.getElementById('accountModalBody').innerHTML = `
    <div class="modal-title">Olá, ${esc(playerRoster.name)}! 👋</div>
    <div class="modal-sub">${esc(playerUser.email)}</div>
    <div class="modal-sub">Sua conta está pronta pra votar no craque de cada partida.</div>
    <div class="row-actions"><button class="btn btn-outline" onclick="modalLogout()">Sair da conta</button></div>
  `;
}

async function modalLoginSubmit(){
  const email = document.getElementById('modalLoginEmail').value.trim();
  const password = document.getElementById('modalLoginPass').value;
  const msgEl = document.getElementById('modalMsg');
  if(!email || !password){ msgEl.textContent = 'Preencha e-mail e senha.'; msgEl.className = 'modal-msg err'; return; }
  try{
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(!res.ok || !data.access_token){ msgEl.textContent = 'E-mail ou senha incorretos.'; msgEl.className = 'modal-msg err'; return; }
    playerToken = data.access_token;
    try{ sessionStorage.setItem('ilb_player_token', playerToken); }catch(e){}
    location.reload();
  }catch(e){
    msgEl.textContent = 'Erro de conexão.'; msgEl.className = 'modal-msg err';
  }
}

async function modalSignupSubmit(){
  const email = document.getElementById('modalSignupEmail').value.trim();
  const password = document.getElementById('modalSignupPass').value;
  const msgEl = document.getElementById('modalMsg');
  if(!email || password.length < 6){ msgEl.textContent = 'Preencha e-mail e uma senha com pelo menos 6 caracteres.'; msgEl.className = 'modal-msg err'; return; }
  try{
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(!res.ok){ msgEl.textContent = data.msg || data.error_description || 'Erro ao criar conta.'; msgEl.className = 'modal-msg err'; return; }
    if(data.access_token){
      playerToken = data.access_token;
      try{ sessionStorage.setItem('ilb_player_token', playerToken); }catch(e){}
      location.reload();
    } else {
      msgEl.textContent = 'Conta criada! Confirme seu e-mail e depois faça login.'; msgEl.className = 'modal-msg ok';
    }
  }catch(e){
    msgEl.textContent = 'Erro de conexão.'; msgEl.className = 'modal-msg err';
  }
}

async function modalClaimSubmit(){
  const rosterId = document.getElementById('modalClaimRosterId').value;
  const msgEl = document.getElementById('modalMsg');
  if(!rosterId){ msgEl.textContent = 'Selecione seu nome.'; msgEl.className = 'modal-msg err'; return; }
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_roster`, {
      method: 'POST',
      headers: { ...playerHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ target_roster_id: Number(rosterId) })
    });
    if(!res.ok){ msgEl.textContent = 'Erro ao vincular. Esse nome pode já estar em uso.'; msgEl.className = 'modal-msg err'; return; }
    location.reload();
  }catch(e){
    msgEl.textContent = 'Erro de conexão.'; msgEl.className = 'modal-msg err';
  }
}

function modalLogout(){
  playerToken = null; playerUser = null; playerRoster = null;
  try{ sessionStorage.removeItem('ilb_player_token'); }catch(e){}
  location.reload();
}
