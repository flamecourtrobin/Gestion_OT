const SUPABASE_URL = 'https://dfonxvudkwwbwtlswjqp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-3BEyLaX838Z7_55AQF4eg_nTeXchXl';
const ACCESS_REQUEST_EMAIL = 'robin.flamecourt2@ucb.com';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ROLE_LABELS = {
  super_admin:'Super administrateur',
  admin:'Administrateur',
  responsable:'Responsable',
  utilisateur:'Utilisateur',
  lecture:'Lecture seule'
};
let state = { session:null, user:null, page:'dashboard', message:'', error:'', ots:[], users:[], history:[], accessRequests:[], foundOT:null, filters:{q:'',statut:'',emplacement:''}, importRows:[], editId:null };
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = v => v ? new Date(v).toLocaleString('fr-BE') : '';
const today = () => new Date().toISOString().slice(0,10);
const isSuperAdmin = () => state.user?.role === 'super_admin';
const isAdmin = () => ['super_admin','admin'].includes(state.user?.role);
const canAdd = () => ['super_admin','admin','responsable'].includes(state.user?.role);
const canEdit = () => ['super_admin','admin','responsable'].includes(state.user?.role);
const canViewAll = () => ['super_admin','admin','responsable','lecture'].includes(state.user?.role);
const canDel = () => isAdmin();
function statusOf(o){ if(o.statut==='Terminé') return 'Terminé'; if(o.statut==='Pris') return 'Pris'; if(o.date_fin && o.date_fin < today()) return 'Retard'; return 'Disponible'; }
function msg(m){state.message=m; state.error=''; render()} function err(m){state.error=m; state.message=''; render()}
async function init(){ const {data:{session}} = await sb.auth.getSession(); state.session=session; if(session) await loadAll(); render(); sb.auth.onAuthStateChange(async (_e, session)=>{state.session=session; if(session) await loadAll(); else state.user=null; render();}); }
async function loadAll(){
  const uid = state.session?.user?.id; if(!uid) return;
  let {data:profile,error:pe}=await sb.from('profiles').select('*').eq('id',uid).single();
  if(pe || !profile){ state.user={id:uid,email:state.session.user.email,full_name:state.session.user.email,role:'utilisateur'}; return; }
  state.user=profile;
  await loadOTs();
 if (isAdmin()) {
  await Promise.all([
    loadUsers(),
    loadHistory(),
    loadAccessRequests()
  ]);
}
  await Promise.all([loadUsers(),loadHistory(),loadAccessRequests()]);
}
}
async function loadOTs(){
  let all = [];
  let from = 0;
  const size = 1000;

  while (true) {
    const { data, error } = await sb
      .from('ots')
      .select('*, pris_par_profile:profiles!ots_pris_par_fkey(full_name,email)')
      .order('created_at', { ascending:false })
      .range(from, from + size - 1);

    if (error) return err(error.message);

    all = all.concat(data || []);

    if (!data || data.length < size) break;

    from += size;
  }

  state.ots = all;
}async function loadUsers(){ const {data,error}=await sb.from('profiles').select('*').order('created_at',{ascending:false}); if(!error) state.users=data||[]; }
async function loadHistory(){ const {data,error}=await sb.from('ot_history').select('*, profiles(full_name,email)').order('created_at',{ascending:false}).limit(300); if(!error) state.history=data||[]; }
async function loadAccessRequests(){ const {data,error}=await sb.from('access_requests').select('*').order('created_at',{ascending:false}); if(!error) state.accessRequests=data||[]; }
async function log(action, details, ot_id=null){ await sb.from('ot_history').insert({ot_id, action, user_id:state.user?.id, details}); }
async function login(e){ e.preventDefault(); const email=$('#email').value.trim(); const password=$('#password').value; const {error}=await sb.auth.signInWithPassword({email,password}); if(error) return renderLogin(error.message); }
async function logout(){ await sb.auth.signOut(); state={...state,session:null,user:null,page:'dashboard',ots:[],users:[],history:[]}; render(); }
async function resetPassword() {
  const email = document.querySelector('#email')?.value?.trim();

  if (!email) {
    alert('Veuillez indiquer votre adresse email.');
    return;
  }

  await sb.from('access_requests').insert({
    email: email,
    message: 'Demande de réinitialisation du mot de passe'
  });

  const subject = encodeURIComponent('Demande de réinitialisation de mot de passe');
  const body = encodeURIComponent(
    `Bonjour,

Une demande de réinitialisation de mot de passe a été effectuée.

Utilisateur : ${email}

Merci.`
  );

  window.location.href =
    `mailto:robin.flamecourt2@ucb.com?subject=${subject}&body=${body}`;

  alert('Votre demande a été transmise à l’administrateur.');
}
async function requestAccess(e){
  e.preventDefault(); const requester=$('#request_email').value.trim().toLowerCase(); if(!requester.includes('@')) return alert('Adresse mail invalide.');
  await sb.from('access_requests').insert({email:requester, message:'Demande d’accès depuis l’application'});
  const subject=encodeURIComponent('Demande d’accès à l’application OT');
  const body=encodeURIComponent(`Bonjour,\n\nJe demande un accès à l’application Gestion des OT.\n\nAdresse à autoriser : ${requester}\n\nMerci.`);
  location.href=`mailto:${ACCESS_REQUEST_EMAIL}?subject=${subject}&body=${body}`;
}
function setPage(p){state.page=p; state.message=''; state.error=''; state.foundOT=null; state.importRows=[]; state.editId=null; render();}
function nav(p,t){return `<button class="${state.page===p?'active':''}" onclick="setPage('${p}')">${t}</button>`}
function shell(content,title,sub=''){return `<div class="app"><aside class="side"><div class="brand">Gestion OT</div><div class="version">Version 4 Supabase</div><div class="userbox"><b>${esc(state.user.full_name||state.user.email)}</b><br>${esc(state.user.email)}<br><span>${ROLE_LABELS[state.user.role]||state.user.role}</span></div><nav class="nav">${nav('dashboard','Tableau de bord')}${canAdd()?nav('add','Ajouter un OT'):''}${nav('take','Récupérer un OT')}${nav('my','Mes OT')}${canViewAll()?nav('table','Tableau général'):''}${canAdd()?nav('import','Import OT'):''}${isAdmin()?nav('users','Comptes & accès'):''}${isAdmin()?nav('history','Historique'):''}<button onclick="logout()">Déconnexion</button></nav></aside><main class="main"><div class="top"><div><h1>${title}</h1><div class="sub">${sub}</div></div></div>${state.message?`<div class="msg">${esc(state.message)}</div>`:''}${state.error?`<div class="err">${esc(state.error)}</div>`:''}${content}</main></div>`}
function renderLogin(error=''){document.querySelector('#app').innerHTML=`<div class="login-wrap"><div class="login-card"><section class="hero"><h1>Gestion des OT</h1><p>Application connectée à Supabase : mêmes données sur PC, tablette et smartphone.</p><p><b>Demander un accès</b><br>La demande sera enregistrée et un email sera préparé pour ${ACCESS_REQUEST_EMAIL}.</p></section><section class="login-form"><h2>Connexion</h2>${error?`<div class="err">${esc(error)}</div>`:''}<form onsubmit="login(event)"><div class="field"><label>Email</label><input id="email" type="email" required placeholder="prenom.nom@ucb.com"></div><div class="field"><label>Mot de passe</label><input id="password" type="password" required></div><button type="submit">Se connecter</button><button type="button" class="secondary" onclick="resetPassword()">
  Mot de passe oublié
</button></form><hr><h3>Avoir accès</h3><form onsubmit="requestAccess(event)"><div class="field"><label>Votre adresse mail</label><input id="request_email" type="email" required placeholder="prenom.nom@ucb.com"></div><button class="secondary" type="submit">Envoyer la demande</button></form></section></div></div>`}
function render(){ if(!state.session || !state.user) return renderLogin(); const pages = {
  dashboard: dashboard,
  add: add,
  take: take,
  my: my,
  table: table,
  import: importPage,
  users: usersPage,
  history: historyPage
}; document.querySelector('#app').innerHTML=(pages[state.page]||dashboard)(); }
function dashboard(){const list=state.ots; const stats={total:list.length, dispo:list.filter(o=>statusOf(o)==='Disponible').length, pris:list.filter(o=>o.statut==='Pris').length, retard:list.filter(o=>statusOf(o)==='Retard').length}; return shell(`<div class="cards"><div class="card"><div class="stat">${stats.total}</div><div>Total OT</div></div><div class="card"><div class="stat">${stats.dispo}</div><div>Disponibles</div></div><div class="card"><div class="stat">${stats.pris}</div><div>Pris</div></div><div class="card"><div class="stat">${stats.retard}</div><div>En retard</div></div></div>${otTable(list.slice(0,8),false)}`,'Tableau de bord','Vue rapide des OT')}
function otForm(o={}){const prisPar=o.pris_par_profile?.full_name||o.pris_par_profile?.email||'';return `<form onsubmit="saveOT(event,'${o.id||''}')"><div class="grid2"><div class="field"><label>N° OT</label><input name="numero_ot" required value="${esc(o.numero_ot)}"></div><div class="field"><label>Nom</label><input name="nom" required value="${esc(o.nom)}"></div><div class="field"><label>Date de fin</label><input name="date_fin" type="date" required value="${esc(o.date_fin)}"></div><div class="field"><label>Emplacement</label><input name="emplacement" required value="${esc(o.emplacement)}"></div><div class="field"><label>Statut</label><select name="statut"><option ${o.statut==='Disponible'?'selected':''}>Disponible</option><option ${o.statut==='Pris'?'selected':''}>Pris</option><option ${o.statut==='Terminé'?'selected':''}>Terminé</option></select></div><div class="field"><label>Pris par</label><input disabled value="${esc(prisPar)}"></div></div><div class="field"><label>Autre</label><textarea name="autre">${esc(o.autre)}</textarea></div><button>Enregistrer</button> ${state.editId?`<button type="button" class="secondary" onclick="state.editId=null;render()">Annuler</button>`:''}</form>`}
function add(){if(!canAdd()) return shell('<div class="err">Accès refusé.</div>','Ajouter un OT'); const o=state.editId?state.ots.find(x=>x.id===state.editId):{}; return shell(`<div class="panel">${otForm(o||{})}</div>`,'Ajouter / modifier un OT','Accessible aux admins et responsables')}
async function saveOT(e,id){e.preventDefault(); const data=Object.fromEntries(new FormData(e.target).entries()); const payload={numero_ot:data.numero_ot,nom:data.nom,date_fin:data.date_fin,emplacement:data.emplacement,autre:data.autre,statut:data.statut,created_by:state.user.id}; let res; if(id){res=await sb.from('ots').update(payload).eq('id',id); await log('Modification OT',data.numero_ot,id);} else {res=await sb.from('ots').insert(payload); await log('Création OT',data.numero_ot);} if(res.error) return err(res.error.message); await loadAll(); state.editId=null; msg('OT enregistré.');}
function take(){return shell(`<div class="panel"><form onsubmit="findOT(event)" class="row"><div class="field"><label>N° OT à récupérer</label><input id="take_num" required placeholder="Ex: OT-1001"></div><button>Rechercher</button></form></div>${state.foundOT?takeCard(state.foundOT):''}`,'Récupérer un OT','Tape le N° OT puis attribue-le à ton compte')}
function takeCard(o){const st=statusOf(o); return `<div class="panel"><h3>${esc(o.numero_ot)} — ${esc(o.nom)}</h3><p><b>Date fin :</b> ${esc(o.date_fin)}<br><b>Emplacement :</b> ${esc(o.emplacement)}<br><b>Statut :</b> ${st}</p>${st==='Disponible'?`<button onclick="takeOT('${o.id}')">Prendre cet OT</button>`:`<div class="err">Cet OT est déjà attribué ou indisponible.</div>`}</div>`}
async function findOT(e){e.preventDefault(); const num=$('#take_num').value.trim(); const {data,error}=await sb.from('ots').select('*, pris_par_profile:profiles!ots_pris_par_fkey(full_name,email)').eq('numero_ot',num).maybeSingle(); if(error) return err(error.message); state.foundOT=data; if(!data) return err('OT introuvable.'); render();}
async function takeOT(id){ const {data,error}=await sb.from('ots').update({pris_par:state.user.id,date_prise:new Date().toISOString(),statut:'Pris'}).eq('id',id).eq('statut','Disponible').select().maybeSingle(); if(error) return err(error.message); if(!data) return err('Cet OT est déjà pris ou indisponible.'); await log('Attribution OT',`${data.numero_ot} pris par ${state.user.full_name||state.user.email}`,id); await loadAll(); msg('OT attribué à votre compte.');}
function filtered(list){const f=state.filters; return list.filter(o=>(!f.q||Object.values(o).join(' ').toLowerCase().includes(f.q.toLowerCase()))&&(!f.statut||statusOf(o)===f.statut)&&(!f.emplacement||o.emplacement===f.emplacement));}
function table(){if(!canViewAll()) return shell('<div class="err">Accès refusé.</div>','Tableau général'); const list=filtered(state.ots); const emps=[...new Set(state.ots.map(o=>o.emplacement).filter(Boolean))]; return shell(`<div class="toolbar"><input placeholder="Recherche" value="${esc(state.filters.q)}" oninput="state.filters.q=this.value;render()"><select onchange="state.filters.statut=this.value;render()"><option value="">Tous statuts</option>${['Disponible','Pris','Terminé','Retard'].map(s=>`<option ${state.filters.statut===s?'selected':''}>${s}</option>`).join('')}</select><select onchange="state.filters.emplacement=this.value;render()"><option value="">Tous emplacements</option>${emps.map(e=>`<option ${state.filters.emplacement===e?'selected':''}>${esc(e)}</option>`).join('')}</select><button class="secondary" onclick="exportCSV()">Export CSV</button><button class="secondary" onclick="exportExcel()">Export Excel</button></div>${otTable(list,true)}`,'Tableau général',`${list.length} OT affichés`) }
function my(){const list=state.ots.filter(o=>o.pris_par===state.user.id); return shell(`${otTable(list,false)}`,'Mes OT','OT pris par votre compte')}
function otTable(list,actions){return `<div class="table-wrap"><table><thead><tr><th>N° OT</th><th>Nom</th><th>Date fin</th><th>Emplacement</th><th>Pris par</th><th>Date prise</th><th>Autre</th><th>Statut</th>${actions?'<th>Actions</th>':''}</tr></thead><tbody>${list.map(o=>{const st=statusOf(o), pris=o.pris_par_profile?.full_name||o.pris_par_profile?.email||'';return `<tr><td><b>${esc(o.numero_ot)}</b></td><td>${esc(o.nom)}</td><td>${esc(o.date_fin)}</td><td>${esc(o.emplacement)}</td><td>${esc(pris)}</td><td>${fmt(o.date_prise)}</td><td>${esc(o.autre)}</td><td><span class="badge ${st}">${st}</span></td>${actions?`<td class="actions">${canEdit()?`<button class="small secondary" onclick="state.editId='${o.id}';setPage('add')">Modifier</button>`:''}${canDel()?`<button class="small danger" onclick="deleteOT('${o.id}')">Supprimer</button>`:''}${canEdit()&&o.statut==='Pris'?`<button class="small ghost" onclick="finishOT('${o.id}')">Terminer</button>`:''}</td>`:''}</tr>`}).join('')||'<tr><td colspan="9">Aucun OT.</td></tr>'}</tbody></table></div>`}
async function deleteOT(id){if(!confirm('Supprimer cet OT ?'))return; const o=state.ots.find(x=>x.id===id); const {error}=await sb.from('ots').delete().eq('id',id); if(error) return err(error.message); await log('Suppression OT',o?.numero_ot||id); await loadAll(); msg('OT supprimé.')} 
async function finishOT(id){const o=state.ots.find(x=>x.id===id); const {error}=await sb.from('ots').update({statut:'Terminé'}).eq('id',id); if(error) return err(error.message); await log('OT terminé',o?.numero_ot,id); await loadAll(); msg('OT terminé.');}
function usersPage(){if(!isAdmin()) return shell('<div class="err">Accès refusé.</div>','Comptes'); return shell(`<div class="grid2"><div class="panel"><h3>Créer / modifier un profil</h3><p class="muted">Crée d’abord l’utilisateur dans Supabase > Authentication > Users. Ensuite ajoute/modifie son profil ici avec le même email.</p><form onsubmit="saveUser(event)"><input type="hidden" id="user_id"><div class="field"><label>ID utilisateur Supabase</label><input id="user_uuid" placeholder="uuid depuis Authentication > Users" required></div><div class="field"><label>Nom</label><input id="user_name" required></div><div class="field"><label>Email</label><input id="user_email" type="email" required></div><div class="field"><label>Rôle</label><select id="user_role">${Object.entries(ROLE_LABELS)
  .filter(([k]) => isSuperAdmin() || k !== 'super_admin')
  .map(([k,v]) => `<option value="${k}">${v}</option>`)
  .join('')}</select></div><button>Enregistrer le profil</button></form></div><div class="panel"><h3>Demandes d'accès</h3>${state.accessRequests.map(r=>`<div class="history-item"><b>${esc(r.email)}</b><br><span class="muted">${fmt(r.created_at)}</span></div>`).join('')||'<p>Aucune demande.</p>'}<p class="muted">Les demandes ouvrent aussi un email vers ${ACCESS_REQUEST_EMAIL}.</p></div></div><br>${userTable()}`,'Comptes & accès','Gestion réservée à l’administrateur')}
function userTable() {
  const visibleUsers = isSuperAdmin()
    ? state.users
    : state.users.filter(u => u.role !== 'super_admin');

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Rôle</th>
            <th>ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${visibleUsers.map(u => `
            <tr>
              <td>${esc(u.full_name)}</td>
              <td>${esc(u.email)}</td>
              <td>${ROLE_LABELS[u.role] || u.role}</td>
              <td>${esc(u.id)}</td>
              <td class="actions">
                <button class="small secondary" onclick="editUser('${u.id}')">
                  Modifier
                </button>
                ${u.id !== state.user.id
                  ? `<button class="small danger" onclick="removeUser('${u.id}')">Supprimer profil</button>`
                  : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
function editUser(id){const u=state.users.find(x=>x.id===id); $('#user_id').value=u.id; $('#user_uuid').value=u.id; $('#user_name').value=u.full_name||''; $('#user_email').value=u.email; $('#user_role').value=u.role;} 
async function saveUser(e){
  e.preventDefault();

  const role = $('#user_role').value;

  if (role === 'super_admin' && !isSuperAdmin()) {
    return err(
      'Seul un Super Administrateur peut attribuer ce rôle.'
    );
  }

  if (role === 'admin' && !isSuperAdmin()) {
    return err(
      'Seul un Super Administrateur peut créer ou modifier un administrateur.'
    );
  }

  const payload = {
    id: $('#user_uuid').value.trim(),
    full_name: $('#user_name').value.trim(),
    email: $('#user_email').value.trim().toLowerCase(),
    role: role
  };

  const { error } = await sb
    .from('profiles')
    .upsert(payload);

  if (error) return err(error.message);

  await loadAll();
  msg('Profil enregistré.');
}
async function removeUser(id){if(!confirm('Supprimer ce profil ? Le compte Auth reste dans Supabase.'))return; const {error}=await sb.from('profiles').delete().eq('id',id); if(error) return err(error.message); await loadAll(); msg('Profil supprimé.');}
function importPage(){if(!canAdd()) return shell('<div class="err">Accès refusé.</div>','Import OT'); return shell(`<div class="panel"><h3>Importer une liste d'OT</h3><p class="muted">Colonnes acceptées : numero_ot, nom, date_fin, emplacement, autre. CSV et XLSX acceptés.</p><div class="drop"><input type="file" accept=".csv,.xlsx,.xls" onchange="handleFile(event)"><br><br><button class="secondary" onclick="downloadTemplate()">Télécharger modèle CSV</button></div><div class="field"><label>Ou coller un CSV</label><textarea id="csvpaste" placeholder="numero_ot,nom,date_fin,emplacement,autre"></textarea></div><button onclick="previewPaste()">Prévisualiser</button> ${state.importRows.length?`<button onclick="confirmImport()">Importer ${state.importRows.length} OT</button>`:''}</div><br>${state.importRows.length?`<div class="panel import-preview"><h3>Prévisualisation</h3>${otTable(state.importRows.map((r,i)=>({...r,id:i,statut:'Disponible'})),false)}</div>`:''}`,'Import groupé','Charge plusieurs OT en une seule fois')}
function parseCSV(text){const lines=text.trim().split(/\r?\n/).filter(Boolean); const sep=lines[0].includes(';')?';':','; const headers=lines.shift().split(sep).map(h=>h.trim().toLowerCase()); return lines.map(line=>{const vals=line.split(sep).map(v=>v.trim()); let o={}; headers.forEach((h,i)=>o[h]=vals[i]||''); return normalizeImport(o);}).filter(o=>o.numero_ot&&o.nom)}
function formatDateForSupabase(value) {
  if (!value) return null;

  const v = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  let matchDot = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (matchDot) {
    return `20${matchDot[3]}-${matchDot[2].padStart(2,'0')}-${matchDot[1].padStart(2,'0')}`;
  }

  matchDot = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (matchDot) {
    return `${matchDot[3]}-${matchDot[2].padStart(2,'0')}-${matchDot[1].padStart(2,'0')}`;
  }

  let matchSlash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (matchSlash) {
    return `20${matchSlash[3]}-${matchSlash[2].padStart(2,'0')}-${matchSlash[1].padStart(2,'0')}`;
  }

  matchSlash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchSlash) {
    return `${matchSlash[3]}-${matchSlash[2].padStart(2,'0')}-${matchSlash[1].padStart(2,'0')}`;
  }

  return null;
  
}
function normalizeImport(o) {
  return {
    numero_ot: String(o.numero_ot || o['n° ot'] || o['n ot'] || o.ot || '').trim(),
    nom: String(o.nom || o.titre || '').trim(),
    date_fin: formatDateForSupabase(o.date_fin || o['date de fin'] || ''),
    emplacement: String(o.emplacement || o.lieu || '').trim(),
    autre: String(o.autre || o.commentaire || '').trim(),
    statut: 'Disponible',
    created_by: state.user.id
  };
}
function previewPaste(){state.importRows=parseCSV($('#csvpaste').value); render()}
function handleFile(e){const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=ev=>{try{if(file.name.match(/\.xlsx?$/i)){const wb=XLSX.read(ev.target.result,{type:'array'}); const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}); state.importRows=rows.map(normalizeImport).filter(o=>o.numero_ot&&o.nom);} else {state.importRows=parseCSV(ev.target.result)} render();}catch(ex){err(ex.message)}}; file.name.match(/\.xlsx?$/i)?reader.readAsArrayBuffer(file):reader.readAsText(file);}
async function confirmImport() {
  const clean = s => String(s ?? '').trim();

  const uniqueMap = new Map();

  state.importRows.forEach(r => {
    const numero = clean(r.numero_ot);

    if (!numero) return;

    uniqueMap.set(numero, {
      ...r,
      numero_ot: numero,
      nom: clean(r.nom),
      emplacement: clean(r.emplacement),
      autre: clean(r.autre),
      statut: 'Disponible',
      created_by: state.user.id
    });
  });

  const rows = Array.from(uniqueMap.values());

  if (!rows.length) {
    return err('Aucun OT valide à importer.');
  }

  const { error } = await sb
    .from('ots')
    .upsert(rows, {
      onConflict: 'numero_ot'
    });

  if (error) return err(error.message);

  await loadAll();
  state.importRows = [];

  msg(`${rows.length} OT importés ou mis à jour.`);
}
function downloadTemplate(){download('modele_ot.csv','numero_ot,nom,date_fin,emplacement,autre\nOT-2001,Inspection ligne,2026-07-01,Atelier 2,Commentaire libre\n')}
function download(name,text){const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})); a.download=name; a.click();}
function exportCSV(){const rows=filtered(state.ots); const head=['numero_ot','nom','date_fin','emplacement','date_prise','autre','statut']; const csv=[head.join(';'),...rows.map(o=>head.map(h=>`"${String(o[h]??'').replaceAll('"','""')}"`).join(';'))].join('\n'); download('export_ot.csv',csv)}
function exportExcel(){const ws=XLSX.utils.json_to_sheet(filtered(state.ots)); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'OT'); XLSX.writeFile(wb,'export_ot.xlsx');}
function historyPage(){if(!isAdmin()) return shell('<div class="err">Accès refusé.</div>','Historique'); return shell(`<div class="panel">${state.history.map(h=>`<div class="history-item"><b>${esc(h.action)}</b> — ${esc(h.details)}<br><span class="muted">${fmt(h.created_at)} par ${esc(h.profiles?.full_name||h.profiles?.email||'')}</span></div>`).join('')||'Aucun historique.'}</div>`,'Historique','Dernières actions enregistrées dans Supabase')}
init();
