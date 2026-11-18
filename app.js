import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CONFIG = window.STUDIO_CONFIG || {};
const STORAGE_KEY = 'studio-ledger-data-v1';
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const today = new Date();
const isoToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10);
const seed = {
  members: ['Maya Chen', 'Theo Martin', 'Isla Robinson', 'Elliot James', 'Nina Okafor'],
  projects: [
    { id: 'demo-1', name: 'The Quiet Between', category: 'Feature film · Original score', status: 'In progress', deadline: addDays(12), budget: 18500, invoiceStatus: 'Part-paid', team: ['Maya Chen', 'Theo Martin', 'Nina Okafor'], contacts: [{name:'Ruth Palmer', role:'Director', detail:'ruth@quietbetween.film'}, {name:'Max Doyle', role:'Music supervisor', detail:'+44 7700 900 123'}], tasks: [{id:'t1',title:'Deliver revised theme suite',done:false,due:addDays(2)},{id:'t2',title:'Record string quartet session',done:false,due:addDays(6)},{id:'t3',title:'Send first invoice',done:true,due:''}], updatedAt: Date.now() - 1000 * 60 * 45 },
    { id: 'demo-2', name: 'Golden Hour Sessions', category: 'Artist album · Production', status: 'Starting soon', deadline: addDays(25), budget: 9200, invoiceStatus: 'Invoiced', team: ['Isla Robinson', 'Elliot James'], contacts: [{name:'Arlo King', role:'Artist', detail:'arlo@kingmusic.co'}], tasks: [{id:'t4',title:'Pre-production call',done:false,due:addDays(4)},{id:'t5',title:'Build album palette',done:false,due:addDays(8)}], updatedAt: Date.now() - 1000 * 60 * 60 * 8 },
    { id: 'demo-3', name: 'Wild Atlas', category: 'Documentary · Soundtrack', status: 'In progress', deadline: addDays(5), budget: 6400, invoiceStatus: 'Not invoiced', team: ['Maya Chen', 'Elliot James'], contacts: [{name:'Sophie Walsh', role:'Producer', detail:'sophie@wildatlas.tv'}], tasks: [{id:'t6',title:'Final mix approval',done:false,due:addDays(1)},{id:'t7',title:'Prepare stems for delivery',done:false,due:addDays(3)}], updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
    { id: 'demo-4', name: 'Lumen — Brand Film', category: 'Brand · Composition', status: 'Complete', deadline: addDays(-4), budget: 4800, invoiceStatus: 'Paid', team: ['Theo Martin', 'Nina Okafor'], contacts: [{name:'Cleo Banks', role:'Creative producer', detail:'cleo@lumen.studio'}], tasks: [{id:'t8',title:'Final masters delivered',done:true,due:addDays(-4)}], updatedAt: Date.now() - 1000 * 60 * 60 * 48 },
    { id: 'demo-5', name: 'Postcards From Elsewhere', category: 'Podcast · Theme & cues', status: 'On hold', deadline: addDays(48), budget: 3200, invoiceStatus: 'Not invoiced', team: ['Isla Robinson'], contacts: [{name:'Owen Price', role:'Executive producer', detail:'owen@postcards.fm'}], tasks: [{id:'t9',title:'Confirm recording dates',done:false,due:''}], updatedAt: Date.now() - 1000 * 60 * 60 * 72 }
  ]
};
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }
let db = null;
let mode = 'local';
let projects = [];
let members = [];
let activeProjectId = null;
let refreshTimer;

const localLoad = () => { try { const d = JSON.parse(localStorage.getItem(STORAGE_KEY)); return d && Array.isArray(d.projects) ? d : structuredClone(seed); } catch { return structuredClone(seed); } };
const save = async (projectId = null) => {
  if (mode === 'cloud') {
    const changed = projectId ? projects.filter(p => p.id === projectId) : projects;
    if (changed.length) { const { error } = await db.from('projects').upsert(changed.map(toCloudRow)); if (error) throw error; }
  } else { localStorage.setItem(STORAGE_KEY, JSON.stringify({projects, members})); }
  render();
};
const toCloudRow = p => ({ id: p.id, name: p.name, category: p.category || '', status: p.status, deadline: p.deadline || null, budget: p.budget || 0, invoice_status: p.invoiceStatus, team: p.team || [], contacts: p.contacts || [], tasks: p.tasks || [], updated_at: new Date(p.updatedAt || Date.now()).toISOString() });
const fromCloudRow = p => ({ id:p.id, name:p.name, category:p.category, status:p.status, deadline:p.deadline || '', budget:Number(p.budget || 0), invoiceStatus:p.invoice_status, team:p.team || [], contacts:p.contacts || [], tasks:p.tasks || [], updatedAt:new Date(p.updated_at).getTime() });
async function cloudLoad() {
  const [p, m] = await Promise.all([db.from('projects').select('*').order('deadline', {ascending:true, nullsFirst:false}), db.from('team_members').select('*').order('name')]);
  if (p.error) throw p.error; if (m.error) throw m.error;
  projects = (p.data || []).map(fromCloudRow); members = (m.data || []).map(x => x.name);
}
function notify(message, error = false) { const el = document.createElement('div'); el.className = `toast${error?' toast-error':''}`; el.textContent = message; document.body.append(el); setTimeout(() => el.remove(), 3000); }
function showApp() { $('#login-screen').classList.add('hidden'); $('#app').classList.remove('hidden'); $('#sync-label').textContent = mode === 'cloud' ? 'Team sync on' : 'Local preview'; $('#footer-storage').textContent = mode === 'cloud' ? 'Changes sync across your team' : 'Preview data saves in this browser'; }
async function init() {
  $('#today-label').textContent = today.toLocaleDateString('en-GB', {weekday:'short',day:'numeric',month:'short'}).toUpperCase();
  const cloudReady = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && CONFIG.sharedLoginEmail);
  if (cloudReady) {
    mode = 'cloud'; db = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const {data:{session}} = await db.auth.getSession();
    if (session) { try { await cloudLoad(); showApp(); setupRealtime(); } catch (e) { notify('Could not connect to the studio database.', true); $('#login-screen').classList.remove('hidden'); } }
    else $('#login-screen').classList.remove('hidden');
  } else if (CONFIG.deployed) { $('#setup-screen').classList.remove('hidden'); }
  else { const local = localLoad(); projects = local.projects; members = local.members || structuredClone(seed.members); showApp(); }
  bind(); render();
}
function setupRealtime() { db.channel('studio-ledger').on('postgres_changes', {event:'*',schema:'public',table:'projects'}, () => { clearTimeout(refreshTimer); refreshTimer=setTimeout(async()=>{await cloudLoad(); render();},250); }).on('postgres_changes',{event:'*',schema:'public',table:'team_members'},()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{await cloudLoad();render();},250);}).subscribe(); }
function bind() {
  $('#login-form').addEventListener('submit', async e => { e.preventDefault(); const btn = $('button[type="submit"]', e.currentTarget); btn.disabled=true; $('#login-error').textContent=''; try { const {error} = await db.auth.signInWithPassword({email:CONFIG.sharedLoginEmail,password:$('#password').value}); if(error) throw error; await cloudLoad(); showApp(); setupRealtime(); render(); } catch { $('#login-error').textContent='That password didn’t work. Please try again.'; } finally {btn.disabled=false;} });
  $('#toggle-password').addEventListener('click', () => { const p=$('#password'); p.type=p.type==='password'?'text':'password'; $('#toggle-password').textContent=p.type==='password'?'Show':'Hide'; });
  $('#signout-button').addEventListener('click', async()=>{ if(mode==='cloud') await db.auth.signOut(); $('#app').classList.add('hidden'); $('#login-screen').classList.remove('hidden'); $('#password').value=''; });
  $('#new-project').addEventListener('click',()=>openProjectForm()); $('#empty-new-project').addEventListener('click',()=>openProjectForm());
  $('#project-form').addEventListener('submit', submitProject); $('#project-search').addEventListener('input', renderProjects); $('#sort-select').addEventListener('change', renderProjects);
  $('#back-to-overview').addEventListener('click',()=>{activeProjectId=null; render();}); $('#edit-project').addEventListener('click',()=>openProjectForm(getProject()));
  $('#delete-project').addEventListener('click',deleteProject); $('#add-task').addEventListener('click',()=>{ $('#quick-task-form').classList.toggle('hidden'); $('#quick-task-input').focus(); }); $('#quick-task-form').addEventListener('submit',addTask);
  $('#manage-team').addEventListener('click',openTeamDialog); $('#team-form').addEventListener('submit',addMember);
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).close()));
  document.addEventListener('click',e=>{ const card=e.target.closest('[data-project-id]'); if(card && (!e.target.closest('button')||e.target.closest('.row-arrow'))){ activeProjectId=card.dataset.projectId; render(); } });
}
const getProject = () => projects.find(p=>p.id===activeProjectId);
function render() { $('#nav-count').textContent=String(projects.length).padStart(2,'0'); $('#project-count').textContent=projects.length; renderStats(); renderProjects(); if(activeProjectId && getProject()){ $('#overview-view').classList.add('hidden'); $('#project-view').classList.remove('hidden'); $('#breadcrumb-current').textContent='PROJECT'; renderProject(); } else { activeProjectId=null; $('#project-view').classList.add('hidden'); $('#overview-view').classList.remove('hidden'); $('#breadcrumb-current').textContent='OVERVIEW'; } }
function renderStats() { const active=projects.filter(p=>p.status==='In progress').length; const soon=projects.filter(p=>p.status==='Starting soon').length; const invoices=projects.filter(p=>['Invoiced','Part-paid'].includes(p.invoiceStatus)).length; const month=projects.filter(p=>p.deadline && p.deadline.slice(0,7)===isoToday.slice(0,7) && p.status!=='Complete').length; $('#stat-active').textContent=String(active).padStart(2,'0'); $('#stat-upnext').textContent=String(soon).padStart(2,'0'); $('#stat-invoices').textContent=String(invoices).padStart(2,'0'); $('#stat-month').textContent=String(month).padStart(2,'0'); }
function renderProjects() {
  const q=$('#project-search').value.trim().toLowerCase(); let items=projects.filter(p=>[p.name,p.category,p.status,...(p.team||[])].join(' ').toLowerCase().includes(q));
  const sort=$('#sort-select').value; items.sort((a,b)=>sort==='deadline' ? (a.deadline||'9999').localeCompare(b.deadline||'9999') : sort==='name' ? a.name.localeCompare(b.name) : (b.updatedAt||0)-(a.updatedAt||0));
  $('#project-list').innerHTML=items.map(p=>{const done=(p.tasks||[]).filter(t=>t.done).length, count=(p.tasks||[]).length, urgency=p.deadline ? Math.ceil((new Date(p.deadline+'T00:00:00')-new Date(isoToday+'T00:00:00'))/86400000) : null; return `<article class="project-row" data-project-id="${esc(p.id)}"><div class="row-main"><div class="row-title-line"><h3>${esc(p.name)}</h3><span class="status-badge ${statusClass(p.status)}"><i></i>${esc(p.status)}</span></div><p>${esc(p.category||'Uncategorised')}</p><div class="row-bottom"><div class="avatar-stack">${(p.team||[]).slice(0,3).map((m,i)=>`<span class="mini-avatar avatar-${i%5}" title="${esc(m)}">${initials(m)}</span>`).join('')}${(p.team||[]).length>3?`<span class="mini-avatar more-avatar">+${p.team.length-3}</span>`:''}<span class="team-caption">${p.team?.length||0} ${p.team?.length===1?'person':'people'}</span></div><span class="task-caption">${done}/${count} tasks</span></div></div><div class="row-deadline"><span class="column-label">DEADLINE</span><strong>${formatDate(p.deadline)}</strong><small class="${urgency!==null&&urgency<=5?'urgent':''}">${urgency===null?'No date':urgency<0?'Past due':urgency===0?'Due today':`${urgency} days left`}</small></div><div class="row-invoice"><span class="column-label">INVOICE</span><span class="invoice-tag ${p.invoiceStatus==='Paid'?'paid':''}">${esc(p.invoiceStatus||'Not invoiced')}</span></div><button class="row-arrow" aria-label="Open ${esc(p.name)}">↗</button></article>`;}).join('');
  $('#empty-state').classList.toggle('hidden', items.length>0); $('#project-list').classList.toggle('hidden',items.length===0);
}
function renderProject() {
  const p=getProject(); if(!p)return; $('#detail-name').innerHTML=`${esc(p.name)}<span class="heading-period">.</span>`; $('#project-category-eyebrow').textContent=`PROJECT / ${(p.category||'UNCATEGORISED').toUpperCase()}`; $('#detail-subtitle').textContent=p.category||'Project details and next steps.'; $('#detail-status').className=`status-badge ${statusClass(p.status)}`; $('#detail-status').innerHTML=`<i></i>${esc(p.status)}`; $('#detail-deadline').textContent=formatDate(p.deadline); $('#detail-deadline-relative').textContent=p.deadline?relativeDate(p.deadline):'No deadline set'; $('#detail-budget').textContent=formatMoney(p.budget); $('#detail-invoice').textContent=p.invoiceStatus||'Not invoiced';
  const tasks=p.tasks||[], done=tasks.filter(t=>t.done).length; $('#task-progress').textContent=tasks.length?`${done} OF ${tasks.length} DONE`:''; $('#task-list').innerHTML=tasks.length?tasks.map(t=>`<div class="task-row ${t.done?'task-done':''}"><button class="task-check ${t.done?'checked':''}" data-task-toggle="${esc(t.id)}" aria-label="${t.done?'Mark incomplete':'Mark complete'}">${t.done?'✓':''}</button><div class="task-copy"><strong>${esc(t.title)}</strong>${t.due?`<small>${formatDate(t.due)}</small>`:''}</div><button class="task-remove" data-task-remove="${esc(t.id)}" aria-label="Remove task">×</button></div>`).join(''):'<p class="no-tasks">No tasks yet. Add the next step when you’re ready.</p>';
  $$('[data-task-toggle]').forEach(b=>b.addEventListener('click',()=>toggleTask(b.dataset.taskToggle))); $$('[data-task-remove]').forEach(b=>b.addEventListener('click',()=>removeTask(b.dataset.taskRemove)));
  $('#team-list').innerHTML=(p.team||[]).length?p.team.map((m,i)=>`<div class="person-row"><span class="person-avatar avatar-${i%5}">${initials(m)}</span><span>${esc(m)}</span></div>`).join(''):'<p class="muted-copy">No team members yet.</p>';
  $('#contact-list').innerHTML=(p.contacts||[]).length?p.contacts.map(c=>`<div class="contact-entry"><strong>${esc(c.name)}</strong><span>${esc(c.role||'')}</span>${c.detail?`<a href="${safeLink(c.detail)}">${esc(c.detail)}</a>`:''}</div>`).join(''):'<p class="muted-copy">No contacts added yet.</p>';
}
async function submitProject(e) { e.preventDefault(); const id=$('#project-id').value||crypto.randomUUID(); const prior=projects.find(p=>p.id===id); const contacts=$('#form-contacts').value.split('\n').map(s=>s.split(',').map(x=>x.trim())).filter(x=>x[0]).map(([name,role='',detail=''])=>({name,role,detail})); const p={id,name:$('#form-name').value.trim(),category:$('#form-category').value.trim(),status:$('#form-status').value,deadline:$('#form-deadline').value,budget:Number($('#form-budget').value||0),invoiceStatus:$('#form-invoice').value,team:[...$('#form-team').selectedOptions].map(o=>o.value),contacts,tasks:prior?.tasks||[],updatedAt:Date.now()}; if(prior) projects=projects.map(x=>x.id===id?p:x); else projects.unshift(p); try { await save(id); $('#project-dialog').close(); activeProjectId=id; render(); notify('Project saved'); } catch(err){notify('Could not save project: '+err.message,true);} }
function openProjectForm(p=null) { $('#project-form').reset(); $('#project-id').value=p?.id||''; $('#project-form-title').textContent=p?'Fine tune the details.':'A new beginning.'; $('#form-name').value=p?.name||''; $('#form-category').value=p?.category||''; $('#form-status').value=p?.status||'Starting soon'; $('#form-deadline').value=p?.deadline||''; $('#form-budget').value=p?.budget||''; $('#form-invoice').value=p?.invoiceStatus||'Not invoiced'; $('#form-contacts').value=(p?.contacts||[]).map(c=>[c.name,c.role,c.detail].filter(Boolean).join(', ')).join('\n'); $('#form-team').innerHTML=members.map(m=>`<option value="${esc(m)}" ${(p?.team||[]).includes(m)?'selected':''}>${esc(m)}</option>`).join(''); $('#project-dialog').showModal(); }
async function deleteProject() { if(!confirm('Delete this project and its tasks?')) return; try { if(mode==='cloud'){const {error}=await db.from('projects').delete().eq('id',activeProjectId); if(error)throw error;} projects=projects.filter(p=>p.id!==activeProjectId); activeProjectId=null; if(mode==='local')localStorage.setItem(STORAGE_KEY,JSON.stringify({projects,members})); render(); notify('Project deleted'); } catch(e){notify('Could not delete project',true);} }
async function addTask(e) { e.preventDefault(); const p=getProject(), title=$('#quick-task-input').value.trim(); if(!title||!p)return; p.tasks.push({id:crypto.randomUUID(),title,done:false,due:''}); p.updatedAt=Date.now(); try{await save(p.id);$('#quick-task-input').value='';$('#quick-task-form').classList.add('hidden');}catch(err){notify('Could not save task',true);} }
async function toggleTask(id) { const p=getProject(); p.tasks=p.tasks.map(t=>t.id===id?{...t,done:!t.done}:t); p.updatedAt=Date.now(); try{await save(p.id);}catch(e){notify('Could not update task',true);} }
async function removeTask(id) { const p=getProject(); p.tasks=p.tasks.filter(t=>t.id!==id); p.updatedAt=Date.now(); try{await save(p.id);}catch(e){notify('Could not remove task',true);} }
function openTeamDialog() { $('#new-member-name').value=''; renderRoster(); $('#team-dialog').showModal(); }
function renderRoster() { $('#roster-list').innerHTML=members.length?members.map((m,i)=>`<div class="roster-row"><span class="person-avatar avatar-${i%5}">${initials(m)}</span><span>${esc(m)}</span><button type="button" class="roster-remove" data-member="${esc(m)}" aria-label="Remove ${esc(m)}">×</button></div>`).join(''):'<p class="muted-copy">No team members yet.</p>'; $$('[data-member]').forEach(b=>b.addEventListener('click',()=>removeMember(b.dataset.member))); }
async function addMember(e) { e.preventDefault(); const name=$('#new-member-name').value.trim(); if(!name||members.some(m=>m.toLowerCase()===name.toLowerCase()))return; if(mode==='cloud'){const {error}=await db.from('team_members').insert({name}); if(error){notify(error.code==='23505'?'That person is already on the list.':'Could not add team member.',true);return;}} members.push(name); if(mode==='local')localStorage.setItem(STORAGE_KEY,JSON.stringify({projects,members})); renderRoster(); $('#new-member-name').value=''; }
async function removeMember(name) { if(mode==='cloud'){const {error}=await db.from('team_members').delete().eq('name',name); if(error){notify('Could not remove team member.',true);return;}} members=members.filter(m=>m!==name); projects.forEach(p=>p.team=(p.team||[]).filter(n=>n!==name)); if(mode==='cloud'){const {error}=await db.from('projects').upsert(projects.map(toCloudRow)); if(error){notify('Roster updated, but some project assignments could not be refreshed.',true);}} else localStorage.setItem(STORAGE_KEY,JSON.stringify({projects,members})); renderRoster(); render(); }
function formatDate(date) { if(!date)return 'Not set'; const d=new Date(date+'T00:00:00'); return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
function relativeDate(date) { const n=Math.ceil((new Date(date+'T00:00:00')-new Date(isoToday+'T00:00:00'))/86400000); return n<0?`${Math.abs(n)} days overdue`:n===0?'Due today':`${n} days from now`; }
function formatMoney(value) { return Number(value||0).toLocaleString('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}); }
function initials(n) { return n.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(); }
function statusClass(s) { return ({'In progress':'status-progress','Starting soon':'status-soon','On hold':'status-hold','Complete':'status-complete'})[s]||''; }
function esc(s='') { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeLink(s='') { if(/^https?:\/\//i.test(s))return esc(s); if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))return `mailto:${esc(s)}`; if(/[+\d][\d\s().-]{6,}/.test(s))return `tel:${esc(s.replace(/[^+\d]/g,''))}`; return '#'; }
init();
