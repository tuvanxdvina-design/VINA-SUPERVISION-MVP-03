
const LEGACY_KEY='vina_supervision_mvp01';
const ACTIVE_USER=(()=>{try{return JSON.parse(localStorage.getItem('vina_supervision_auth')||'null')?.user?.id||''}catch(_){return ''}})();
const KEY=ACTIVE_USER ? `${LEGACY_KEY}:${ACTIVE_USER}` : `${LEGACY_KEY}:guest`;
// Không sao chép dữ liệu khách/thiết bị cũ sang phiên tài khoản mới.
// Danh sách công trình phải lấy từ API theo quyền phân công.
let db=JSON.parse(localStorage.getItem(KEY)||'{"projects":[],"logs":[],"issues":[],"docs":[],"people":[],"audit":[],"sync":[],"role":"Giám đốc"}');
db.progressPlans=db.progressPlans||{};
db.pendingInitialProgressPlans=db.pendingInitialProgressPlans||{};
let currentProjectId=null;
const qualityPermissionCache = new Map(Object.entries(db.myPermissions||{}).map(([pid,v])=>[String(pid),{permissions:Array.isArray(v?.permissions)?v.permissions:[]}]));
function qualityAuthUser(){try{return typeof getAuthUser==='function'?getAuthUser():null}catch(_){return null}}
function qualityAuthUserId(){return String(qualityAuthUser()?.id||'')}
function qualityRole(){const u=qualityAuthUser();return roleToken(u?.role_name||u?.roleName||u?.role||db.role)}
function qualityIsManager(){const r=qualityRole();return r==='ADMIN'||r==='DIRECTOR'||r==='GIAM DOC'}
function qualityPermissions(projectId){if(qualityIsManager())return ['VIEW','EDIT','CREATE','DOWNLOAD','APPROVE','DELETE'];const cached=qualityPermissionCache.get(String(projectId||''));const raw=cached?.permissions;return Array.isArray(raw)?raw.map(v=>String(v).toUpperCase()):[]}
function qualityIsLocked(x){const r=roleToken(x?.status);return ['SIGNED','CLOSED','RESOLVED','LOCKED','DA KY','DA DONG','DA KHOA'].some(v=>r===v||r.includes(v))}
function qualityIsOwner(x){if(!x)return false;const uid=qualityAuthUserId();if(uid&&[x.createdById,x.createdByUserId,x.created_by].some(v=>String(v||'')===uid))return true;const u=qualityAuthUser();if(u&&x.createdBy&&!x.createdById&&!x.createdByUserId){const owner=String(u.full_name||u.username||'').trim().toLowerCase();if(owner&&owner===String(x.createdBy).trim().toLowerCase())return true}if(!uid&&String(x.createdBy||'')===String(db.role||''))return true;return false}
function qualityCanCreate(projectId){if(qualityIsManager())return true;if(typeof getAuthToken!=='function'||!getAuthToken())return true;const p=qualityPermissions(projectId);return p.includes('CREATE')||p.includes('EDIT')}
function qualityCanEdit(x){if(!x)return false;if(qualityIsManager())return true;const p=qualityPermissions(x.projectId);if(p.includes('EDIT'))return true;return !qualityIsLocked(x)&&qualityIsOwner(x)}
function qualityCanClose(x){return !!x&&!qualityIsLocked(x)&&qualityCanEdit(x)}
function qualityCanReopen(x){return !!x&&qualityIsLocked(x)&&(qualityIsManager()||qualityPermissions(x.projectId).includes('EDIT'))}
async function loadQualityPermissions(force=false){if(typeof apiRequest!=='function'||typeof getAuthToken!=='function'||!getAuthToken()||!navigator.onLine)return;if(!force&&qualityPermissionCache.size)return;try{const map=await apiRequest('/project-members/my-permissions');qualityPermissionCache.clear();Object.entries(map||{}).forEach(([pid,v])=>qualityPermissionCache.set(String(pid),{permissions:Array.isArray(v.permissions)?v.permissions:[],memberId:v.member_id||'',source:v.source||''}));db.myPermissions=map;persistLocal()}catch(error){console.warn('Không tải được quyền theo công trình:',error.message);if(db.myPermissions)Object.entries(db.myPermissions).forEach(([pid,v])=>qualityPermissionCache.set(String(pid),{permissions:v.permissions||[]}))}renderIssues();renderLogs();if(typeof applyInboxNavVisibility==='function')applyInboxNavVisibility();if(typeof applyTrashNavVisibility==='function')applyTrashNavVisibility();if(typeof renderReports==='function')renderReports()}
window.addEventListener('load',()=>{void loadQualityPermissions(true)});
let storageWarned=false;
// Lưu bộ nhớ đệm trên thiết bị. Nếu vượt dung lượng trình duyệt (~5–10 MB) thì bỏ phần tệp nhúng base64
// thay vì làm hỏng thao tác (trước đây lỗi này làm hồ sơ vừa tạo "biến mất" khỏi danh sách).
function persistLocal(){
  try{localStorage.setItem(KEY,JSON.stringify(db));return true}
  catch(error){
    try{
      const slim=JSON.parse(JSON.stringify(db,(k,v)=>typeof v==='string'&&v.startsWith('data:')&&v.length>2000?undefined:v));
      localStorage.setItem(KEY,JSON.stringify(slim));
    }catch(_){}
    if(!storageWarned){storageWarned=true;alert('Bộ nhớ trình duyệt đã đầy nên không lưu được tệp đính kèm trên thiết bị. Dữ liệu trên máy chủ không bị ảnh hưởng; tệp mới hãy tải lên khi có mạng.')}
    return false;
  }
}
const save=()=>{persistLocal();renderAll()};
function queueSync(type,recordId,operation='UPSERT',payload={}){db.sync.push({id:id(),type,recordId,operation,payload,queuedAt:new Date().toISOString(),status:'PENDING'})}
function mergeProjectsFromServer(remoteProjects){
  const localQueue=db.sync.filter(x=>x.type==='project' && (x.status==='PENDING'||x.status==='CONFLICT'));
  const pendingIds=new Set(localQueue.filter(x=>x.status==='PENDING').map(x=>x.recordId));
  const queuedIds=new Set(localQueue.map(x=>x.recordId));
  const localById=new Map(db.projects.map(p=>[p.id,p]));
  const remoteById=new Map();remoteProjects.forEach(p=>{if(p&&p.id&&!remoteById.has(p.id))remoteById.set(p.id,p)});
  const conflicts=new Map(localQueue.filter(x=>x.status==='CONFLICT').map(x=>[x.recordId,x.lastError||'Bị máy chủ từ chối']));
  db.projects=[
    ...[...remoteById.values()].map(p=>pendingIds.has(p.id)?{...(localById.get(p.id)||p),_localOnly:false}:p),
    // Công trình tạo trên thiết bị nhưng chưa có trên máy chủ: giữ lại để không mất dữ liệu, gắn cờ để không đưa vào phân công.
    ...db.projects.filter(p=>queuedIds.has(p.id)&&!remoteById.has(p.id)).map(p=>({...p,_localOnly:true,_syncError:conflicts.get(p.id)||''}))
  ];
  const visibleIds=new Set(db.projects.map(p=>p.id));
  db.hidden=db.hidden||{};
  for(const collection of ['logs','issues','docs','people']){
    const records=new Map([...(db.hidden[collection]||[]),...(db[collection]||[])].map(x=>[x.id,x]));
    db[collection]=[...records.values()].filter(x=>!x.projectId||visibleIds.has(x.projectId));
    db.hidden[collection]=[...records.values()].filter(x=>x.projectId&&!visibleIds.has(x.projectId));
  }
}
const id=()=>crypto.randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=crypto.getRandomValues(new Uint8Array(1))[0]&15;
    return (c==='x'?r:(r&3|8)).toString(16);
  });
function audit(action,entity,entityId,detail){db.audit.unshift({id:id(),at:new Date().toISOString(),actor:db.role,action,entity,entityId,detail})}
function setRole(v){db.role=v;audit('CHANGE_ROLE','system','',v);save()}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmt(d){return d?new Date(d).toLocaleString('vi-VN'):''}
function fmtDate(d){return d?new Date(d).toLocaleDateString('vi-VN'):''}
function executionDays(start,end){if(!start||!end)return '';const a=new Date(start),b=new Date(end);const days=Math.round((b-a)/86400000)+1;return days>0?days:''}
function statusBadge(s){return `<span class="badge ${String(s||'').toLowerCase().replace(/\s+/g,'')}">${esc(s)}</span>`}
function canViewDashboard(){
  let user=null;
  try{ user=typeof getAuthUser==='function' ? getAuthUser() : null; }catch(_){}
  const code=String(user?.role_name||user?.roleName||user?.role||'').toUpperCase();
  if(['ADMIN','DIRECTOR','MANAGER'].includes(code)) return true;
  // Tổng quan tiến độ: mọi tài khoản đã đăng nhập đều xem được — máy chủ chỉ trả công trình được phân công
  if(user&&typeof getAuthToken==='function'&&getAuthToken()) return true;
  if(user?.dashboard_access===true || user?.dashboardAccess===true) return true;
  if(Array.isArray(user?.permissions) && user.permissions.some(x=>String(x).toUpperCase()==='DASHBOARD_VIEW')) return true;
  return ['\u0047i\u00e1m \u0111\u1ed1c','Admin'].includes(db.role);
}
function enforceDashboardAccess(){
  const allowed=canViewDashboard();
  const btn=document.querySelector('nav button[data-page="dashboard"]');
  const page=document.getElementById('dashboard');
  if(btn) btn.style.display=allowed?'':'none';
  if(page) page.style.display=allowed?'':'none';
  if(!allowed && page?.classList.contains('active')){
    page.classList.remove('active');
    document.getElementById('projects')?.classList.add('active');
    document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
    document.querySelector('nav button[data-page="projects"]')?.classList.add('active');
  }
}
function canEdit(){return [
'\u0047i\u00e1m \u0111\u1ed1c',
'Admin',
'\u0054r\u01b0\u1edfng TVGS',
'K\u1ef9 s\u01b0 TVGS'
].includes(db.role)}
function roleToken(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase().trim()}
function canManageAssignments(){
  let authRole='';try{authRole=typeof getAuthUser==='function'?(getAuthUser()?.role_name||getAuthUser()?.roleName||getAuthUser()?.role||''):''}catch(_){ }
  const raw=String(db.role||'')+' '+String(authRole||'');const token=roleToken(authRole||db.role);
  return token==='ADMIN'||token==='DIRECTOR'||token==='GIAM DOC'||/ADMIN|DIRECTOR|GI[AÃ]M/.test(raw.toUpperCase());
}
function canEditProject(){return canManageAssignments()||roleToken(db.role)==='TRUONG TVGS'}
function canCreateLogIn(projectId){if(canManageAssignments())return true;return qualityPermissions(projectId).includes('CREATE')}
function logProjectsForCreate(){return (db.projects||[]).filter(p=>canCreateLogIn(p.id))}
function canEditDailyLog(){
  if(canManageAssignments())return true;
  return logProjectsForCreate().length>0||(db.logs||[]).some(l=>canEditLog(l));
}
const SHIFT_OPTIONS=[['CA1','Ca 1 (sáng)'],['CA2','Ca 2 (chiều)'],['CA3','Ca 3 (tối/đêm)']];
function shiftLabel(code){const c=String(code||'CA1').toUpperCase();const f=SHIFT_OPTIONS.find(x=>x[0]===c);return f?f[1]:c.replace(/^CA(\d+)$/,'Ca $1')}
function isPrivilegedLogEditor(){return canManageAssignments()}
function canEditLog(log){
  if(!log) return false;
  if(isPrivilegedLogEditor()) return true;
  if(log.status!=='DRAFT') return false;
  if(typeof log.canEdit==='boolean') return log.canEdit;
  const uid=typeof getAuthUser==='function' ? (getAuthUser()?.id||'') : '';
  if(uid && log.createdById) return log.createdById===uid;
  return !log.serverId && db.sync.some(x=>x.type==='daily_log' && x.recordId===log.id && x.operation==='CREATE' && x.status==='PENDING');
}
function projectsOptions(idSel){return db.projects.map(p=>`<option value="${p.id}" ${p.id===idSel?'selected':''}>${esc(p.code)} - ${esc(p.name)}</option>`).join('')}
function projectMatchesPerson(person,project){
  if(!person||!project)return false;
  if(String(person.projectId||'')===String(project.id||''))return true;
  const normalize=v=>String(v||'').trim().toLowerCase();
  const pCode=normalize(person.projectCode||person.contractNo);
  const pName=normalize(person.projectName);
  return (pCode&&pCode===normalize(project.code||project.contractNo))||(pName&&pName===normalize(project.name));
}
function renderSelects(){['logProject','issueProject','docProject'].forEach(sid=>{let el=document.getElementById(sid);if(el){let old=el.value;el.innerHTML='<option value="">Tất cả công trình</option>'+projectsOptions(old);el.value=old||''}})}
function goPage(page){if(page==='dashboard'&&!canViewDashboard())page='projects';if(page==='settings'&&!canManageAssignments())page='projects';document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));const btn=document.querySelector(`nav button[data-page="${page}"]`);if(btn)btn.classList.add('active');document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById(page).classList.add('active')}
function goDashboard(){currentProjectId=null;goPage('dashboard');renderAll()}
function goProjects(){currentProjectId=null;goPage('projects');renderAll()}
function openProjectSection(page){
  if(!currentProjectId)return;
  goPage(page);
  const selectId={daily:'logProject',issues:'issueProject',docs:'docProject'}[page];
  if(selectId){const el=document.getElementById(selectId);if(el){el.value=currentProjectId;el.dispatchEvent(new Event('change'));}}
  
  renderAll();
}
function openProjectDetail(pid){currentProjectId=pid;goPage('projectDetail');renderProjectDetail();void syncDocumentsFromApi();void loadProjectDetailMembers(pid);void loadProjectProgressPlans(pid);if(typeof loadProjectHealth==='function')void loadProjectHealth(pid)}
function renderDashboard(){
document.getElementById('kProjects').textContent=db.projects.length;document.getElementById('kLogs').textContent=db.logs.length;
document.getElementById('kIssues').textContent=db.issues.filter(x=>x.status!=='ĐÃ ĐÓNG').length;document.getElementById('kDocs').textContent=db.docs.filter(x=>x.status==='APPROVED'||x.status==='LOCKED').length;
let st={};db.projects.forEach(p=>st[p.status]=(st[p.status]||0)+1);document.getElementById('projectStats').innerHTML=Object.entries(st).map(([k,v])=>`<p>${esc(k)}: <b>${v}</b></p>`).join('')||'<span class="muted">&#x43;h&#x01b0;a c&#x00f3; d&#x1eef; li&#x1ec7;u</span>';
document.getElementById('syncStats').innerHTML=`<p>&#x110;ang ch&#x1edd;: <b>${db.sync.filter(x=>x.status!=='CONFLICT').length}</b></p>${db.sync.some(x=>x.status==='CONFLICT')?`<p style="color:#b42318">Bị từ chối: <b>${db.sync.filter(x=>x.status==='CONFLICT').length}</b> (xem mục Công trình)</p>`:''}<p>Tr&#x1ea1;ng th&#x00e1;i m&#x1ea1;ng: <b>${navigator.onLine?'ONLINE':'OFFLINE'}</b></p>`;
document.getElementById('projectProgress').innerHTML=db.projects.length?db.projects.slice(0,8).map(p=>`<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(p.name)}</b><span>${Number(p.progress||0)}%</span></div><div class="progress-track"><span class="progress-fill" style="width:${Math.max(0,Math.min(100,Number(p.progress)||0))}%"></span></div><div class="muted">${esc(p.status||'')}</div></div>`).join(''):'<span class="muted">&#x43;h&#x01b0;a c&#x00f3; c&#x00f4;ng tr&#x00ec;nh</span>';
document.getElementById('dashProjects').innerHTML=projectRows(db.projects.slice(0,20),true);
}
function projectRows(arr,forDash=false){
return `<table><thead><tr><th>M&#x00e3;</th><th>C&#x00f4;ng tr&#x00ec;nh</th><th>&#x110;&#x1ecb;a b&#x00e0;n</th><th>H&#x1ee3;p &#x0111;&#x1ed3;ng</th><th>Ti&#x1ebfn &#x0111;&#x1ed9;</th><th>Tr&#x1ea1;ng th&#x00e1;i</th><th></th></tr></thead><tbody>${arr.map(p=>`<tr class="${forDash?'clickable':''}" ${forDash?`onclick="openProjectDetail('${p.id}')"`:''}><td>${esc(p.code)}</td><td><b>${esc(p.name)}</b>${p._localOnly?` <span class="chip warn" title="${esc(p._syncError||'')}">${p._syncError?'Máy chủ từ chối: '+esc(p._syncError):'Chưa đồng bộ'}</span>`:''}<br><span class="muted">${esc(p.client||'')}</span></td><td>${esc(p.province||'')}</td><td>${p.contractNo?esc(p.contractNo):'<span class="muted">—</span>'}${p.contractValue?`<br><span class="muted">${Number(p.contractValue).toLocaleString('vi-VN')} &#x0111;</span>`:''}</td><td>${p.progress||0}%</td><td>${statusBadge(p.status)}</td><td>${forDash?`<button onclick="event.stopPropagation();openProjectDetail('${p.id}')">Xem</button>`:`${canEditProject()?`<button onclick="openProject('${p.id}')">S&#x1eed;a</button> `:''}<button onclick="openProjectDetail('${p.id}')">Chi ti&#x1ebft</button>`}</td></tr>`).join('')}</tbody></table>`}
function renderProjects(){let q=(document.getElementById('projectSearch')?.value||'').toLowerCase();document.getElementById('projectsTable').innerHTML=projectRows(db.projects.filter(p=>(p.name+p.code+(p.province||'')+(p.contractNo||'')).toLowerCase().includes(q)))||'<p class="muted">Chưa có công trình.</p>'}
const LOG_STATUS={DRAFT:'Nháp',SUBMITTED:'Chờ duyệt',APPROVED:'Đã duyệt',LOCKED:'Đã khóa'};
function logStatusBadge(st){return '<span class="badge '+String(st||'').toLowerCase()+'">'+esc(LOG_STATUS[st]||st||'')+'</span>'}
function isLogLead(pid){return canApproveIn(pid)}
function canSubmitLog(l){if(!l?.serverId||l.status!=='DRAFT')return false;if(canManageAssignments())return true;const p=qualityPermissions(l.projectId);return p.includes('EDIT')||(l.createdById===qualityAuthUserId()&&p.includes('CREATE'))}
function logActionsHtml(x){
 const b=[];
 if(canEditLog(x))b.push('<button onclick="openLog(\''+x.id+'\')">Sửa</button>');
 if(!x.serverId)b.push('<span class="chip warn">Chờ đồng bộ</span>');
 if(canSubmitLog(x))b.push('<button class="primary" onclick="logAction(\''+x.id+'\',\'submit\')">Gửi duyệt</button>');
 if(x.serverId&&x.status==='SUBMITTED'&&isLogLead(x.projectId)&&(canManageAssignments()||x.lastReview?.action!=='ESCALATE'))b.push('<button class="primary" onclick="logAction(\''+x.id+'\',\'approve\')">Duyệt</button>','<button onclick="logAction(\''+x.id+'\',\'reject\')">Trả lại</button>');
 if(x.serverId&&x.status==='APPROVED'&&isLogLead(x.projectId))b.push('<button onclick="logAction(\''+x.id+'\',\'lock\')">Khóa</button>');
 if(x.serverId&&(x.fileCount||x.photoCount))b.push('<button onclick="showLogFiles(\''+x.id+'\')">Tệp ('+((x.fileCount||0)+(x.photoCount||0))+')</button>');
 b.push('<button onclick="exportDailyLog(\''+x.id+'\')">Xuất</button>');
 if(x.serverId)b.push(deleteBtn('log',x.serverId,x.projectId,'Nhật ký '+progressDate(x.date)+' — '+shiftLabel(x.shift)));
 return b.join(' ');
}
async function showLogFiles(logId){
 const l=db.logs.find(v=>v.id===logId);if(!l?.serverId)return;
 try{const files=await apiRequest('/daily-logs/'+encodeURIComponent(l.serverId)+'/files');
  openModal('Tệp kèm nhật ký '+progressDate(l.date)+' — '+shiftLabel(l.shift),'<div class="card">'+(files.length?'<ul>'+files.map(f=>'<li><a href="#" onclick="openServerFile(\'/daily-logs/'+l.serverId+'/files/'+f.id+'\','+esc(JSON.stringify({name:f.file_name,type:f.file_type}))+',false);return false">'+esc(f.file_name)+'</a> <span class="muted">('+fileSize(f.file_size)+')</span></li>').join('')+'</ul>':'<p class="muted">Không có tài liệu.</p>')+(l.photoCount?'<button onclick="showLogPhotos(\''+l.id+'\')">Xem '+l.photoCount+' ảnh hiện trường</button>':'')+'</div>')}
 catch(error){alert('Không tải được danh sách tệp: '+error.message)}
}
async function logAction(logId,action,silent){
 const l=db.logs.find(v=>v.id===logId);if(!l?.serverId)return alert('Nhật ký chưa lên máy chủ.');
 if((action==='approve'||action==='reject')&&!silent)return openReviewDecision('daily_logs',l.serverId,action);
 const ask={submit:'Gửi nhật ký này cho Trưởng TVGS duyệt? Sau khi gửi sẽ không sửa được (trừ khi bị trả lại).',reject:'Trả lại nhật ký cho người lập sửa?',lock:'Khóa nhật ký? Nhật ký đã khóa là hồ sơ chính thức.'}[action];
 if(ask&&!silent&&!confirm(ask))return;
 try{const r=await apiRequest('/daily-logs/'+encodeURIComponent(l.serverId)+'/'+action,{method:'POST'});l.status=r.status;l.version=Number(r.version||l.version||1);l.canEdit=false;audit(action.toUpperCase(),'daily_log',l.serverId,l.date+' '+shiftLabel(l.shift));save()}
 catch(error){alert('Không thực hiện được: '+error.message)}
}
async function logBulk(action,ids){
 if(!ids.length)return;
 const label={submit:'Gửi duyệt',approve:'Duyệt',lock:'Khóa'}[action];
 if(!confirm(label+' '+ids.length+' nhật ký?'))return;
 try{const r=await apiRequest('/daily-logs/bulk',{method:'POST',body:JSON.stringify({action,ids:ids.map(id=>db.logs.find(l=>l.id===id)?.serverId).filter(Boolean)})});
  r.done.forEach(x=>{const l=db.logs.find(v=>v.serverId===x.id);if(l){l.status=x.status;l.canEdit=false}});save();
  alert(label+' thành công '+r.done.length+'/'+ids.length+(r.failed.length?'.\nKhông thực hiện được:\n'+r.failed.map(f=>{const l=db.logs.find(v=>v.serverId===f.id);return '- '+(l?l.date+' '+shiftLabel(l.shift):f.id)+': '+f.error}).join('\n'):'.'))}
 catch(error){alert('Không thực hiện được: '+error.message)}
}
function renderLogs(){
  const pid=document.getElementById('logProject')?.value||'';
  const list=db.logs.filter(x=>!pid||x.projectId===pid).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.shift).localeCompare(String(b.shift)));
  const rows=list.map(x=>{
    const project=db.projects.find(p=>p.id===x.projectId)||{};
    return '<tr><td>'+esc(x.date||'')+'<br><span class="muted">'+esc(shiftLabel(x.shift))+'</span></td><td>'+esc(project.name||'')+'</td><td>'+esc(x.work||'')+(x.weather?'<br><span class="muted">Thời tiết: '+esc(x.weather)+'</span>':'')+
      '</td><td>'+esc(x.createdBy||'Chưa xác định')+'</td><td>'+Number(x.workers||0)+'</td><td>'+Number(x.machines||0)+
      '</td><td>'+logStatusBadge(x.status)+returnedChip(x)+'</td><td style="white-space:nowrap">'+logActionsHtml(x)+'</td></tr>';
  }).join('');
  const mySubmit=list.filter(canSubmitLog).map(x=>x.id);
  const toApprove=list.filter(x=>x.serverId&&x.status==='SUBMITTED'&&isLogLead(x.projectId)&&(canManageAssignments()||x.lastReview?.action!=='ESCALATE')).map(x=>x.id);
  const toLock=list.filter(x=>x.serverId&&x.status==='APPROVED'&&isLogLead(x.projectId)).map(x=>x.id);
  const bar=(mySubmit.length||toApprove.length||toLock.length)?'<div class="toolbar" style="margin:0 0 10px">'+(mySubmit.length?'<button class="primary" onclick="logBulk(\'submit\','+esc(JSON.stringify(mySubmit))+')">Gửi duyệt tất cả nháp ('+mySubmit.length+')</button>':'')+(toApprove.length?'<button class="primary" onclick="logBulk(\'approve\','+esc(JSON.stringify(toApprove))+')">Duyệt tất cả đang chờ ('+toApprove.length+')</button>':'')+(toLock.length?'<button onclick="logBulk(\'lock\','+esc(JSON.stringify(toLock))+')">Khóa tất cả đã duyệt ('+toLock.length+')</button>':'')+'</div>':'';
  const guide='<p class="muted" style="margin:0 0 8px">Quy trình: <b>Nháp</b> (người lập còn sửa) → <b>Gửi duyệt</b> → Trưởng TVGS <b>Duyệt</b> hoặc <b>Trả lại</b> → <b>Khóa</b> (hồ sơ chính thức).</p>';
  document.getElementById('logsTable').innerHTML=guide+bar+(rows?'<table><thead><tr><th>Ngày / ca</th><th>Công trình</th><th>Công việc</th><th>Người lập</th><th>NL</th><th>Máy</th><th>Trạng thái</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="muted">Chưa có nhật ký.</p>');
}
const qualityType=x=>x.documentType==='LETTER'||String(x.sourceType||'').toLowerCase().includes('th\u01b0')?'LETTER':(x.documentType==='MINUTES'||String(x.sourceType||'').toLowerCase().includes('bi\u00ean')?'MINUTES':'UNKNOWN');
const typeLabel=x=>qualityType(x)==='LETTER'?'Th\u01b0 k\u1ef9 thu\u1eadt':(qualityType(x)==='MINUTES'?'Bi\u00ean b\u1ea3n hi\u1ec7n tr\u01b0\u1eddng':'Ch\u01b0a x\u00e1c \u0111\u1ecbnh');
function renderIssues(){
let pid=document.getElementById('issueProject')?.value||'';
let a=db.issues.filter(x=>!pid||x.projectId===pid);
const cleanQualityText=v=>String(v||'').replace(/\u00c4\u0090/g,'\u0110').replace(/\u00c4\u0091/g,'\u0111');
const statusRaw=x=>qualityIsLocked(x)?'CLOSED':(String(x.status||'').toUpperCase().includes('RESOLVED')?'CLOSED':'OPEN');
const statusText=x=>statusRaw(x)==='CLOSED'?'ĐÃ ĐÓNG':'ĐANG XỬ LÝ';
const actions=x=>{const canChange=qualityIsManager()||qualityCanEdit(x);let html='<button onclick="viewIssue(&quot;'+x.id+'&quot;)">Xem</button>';if(canChange)html+='<button onclick="openIssue(&quot;'+x.id+'&quot;)">Sửa</button>';if(qualityIsLocked(x)){if(qualityCanReopen(x))html+='<button onclick="reopenQualityDocument(&quot;'+x.id+'&quot;)">Mở lại</button>'}else if(canChange)html+='<button onclick="closeIssue(&quot;'+x.id+'&quot;)">Đóng</button>';return html};
document.getElementById('issuesTable').innerHTML='<table><thead><tr><th>Mã</th><th>Tên văn bản</th><th>Loại văn bản</th><th>Hạn</th><th>Trạng thái</th><th>Người tạo</th><th></th></tr></thead><tbody>'+a.map(x=>'<tr><td>'+esc(cleanQualityText(x.code||''))+'</td><td>'+esc(x.title||typeLabel(x))+'</td><td>'+esc(typeLabel(x))+'</td><td>'+esc(x.due||'')+'</td><td><span class="badge">'+statusText(x)+'</span></td><td>'+esc(x.createdBy||x.created_by_name||'Chưa xác định')+'</td><td>'+actions(x)+'</td></tr>').join('')+'</tbody></table>';
if(!a.length)document.getElementById('issuesTable').innerHTML='<p class="muted">Ch&#x01b0;a c&#x00f3; v&#x1ea5;n &#x0111;&#x1ec1;.</p>';
}
function renderPeople(){}
function renderAudit(){document.getElementById('auditTable').innerHTML=`<table><thead><tr><th>Th&#x1edd;i gian</th><th>Ng&#x01b0;&#x1eddi th&#x1ef1;c hi&#x1ec7;n</th><th>H&#x00e0;nh &#x0111;&#x1ed9;ng</th><th>&#x0110;&#x1ed1;i t&#x01b0;&#x1ee3ng</th><th>Chi ti&#x1ebft</th></tr></thead><tbody>${db.audit.slice(0,100).map(x=>`<tr><td>${fmt(x.at)}</td><td>${esc(x.actor)}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table>`}
// ============================================================================
// TIẾN ĐỘ THI CÔNG — bảng tiến độ có cấu trúc, so sánh kế hoạch/thực tế theo hạng mục
// Số liệu so sánh lấy từ danh sách hạng mục (nhập từ Excel/dán/nhập tay).
// Tệp gốc (PDF/ảnh/Excel) chỉ là căn cứ đính kèm, mở qua API (không dùng data: URL).
// ============================================================================
const WEIGHT_BASIS_LABELS={VALUE:'Theo giá trị dự toán',MANUAL:'Theo tỷ trọng % nhập tay',DURATION:'Theo thời gian thực hiện'};
const ITEM_STATUS={CHUA_DEN_HAN:['Chưa đến hạn','#667085','#f2f4f7'],DUNG_TIEN_DO:['Đúng tiến độ','#027a48','#ecfdf3'],VUOT:['Vượt tiến độ','#175cd3','#eff8ff'],CHAM:['Chậm','#b54708','#fffaeb'],QUA_HAN:['Quá hạn','#b42318','#fef3f2'],HOAN_THANH:['Hoàn thành','#027a48','#ecfdf3']};
let progressEditor=null; // trạng thái cửa sổ sửa bảng tiến độ
function progressDate(value){if(!value)return '—';const s=String(value).slice(0,10);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:s}
function todayIso(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function daysBetween(a,b){if(!a||!b)return '';return Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/86400000)+1}
function numVN(n,k=0){if(n===null||n===undefined||n==='')return '';return Number(n).toLocaleString('vi-VN',{maximumFractionDigits:k})}
function statusChip(s){const x=ITEM_STATUS[s]||[s,'#344054','#f2f4f7'];return '<span class="chip" style="color:'+x[1]+';background:'+x[2]+'">'+esc(x[0])+'</span>'}
function canUpdateActual(pid){return canManageAssignments()||(typeof canCreateLogIn==='function'&&canCreateLogIn(pid))}
function apiOnline(){return navigator.onLine&&typeof getAuthToken==='function'&&!!getAuthToken()}

async function loadProjectProgressPlans(projectId,asOf){
 if(!projectId||!apiOnline())return;
 try{
  const plans=await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans');
  db.progressPlans=db.progressPlans||{};db.progressPlans[projectId]=Array.isArray(plans)?plans:[];
  const current=db.progressPlans[projectId].find(x=>x.is_current)||db.progressPlans[projectId][0];
  db.progressDetail=db.progressDetail||{};
  if(current){db.progressDetail[projectId]=await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(current.id)+(asOf?'?as_of='+asOf:''))}
  else delete db.progressDetail[projectId];
  persistLocal();
  if(currentProjectId===projectId){const p=db.projects.find(x=>x.id===projectId);if(p)renderProjectProgress(p)}
 }catch(error){console.warn('Không tải được bảng tiến độ:',error.message)}
}
async function syncInitialProgressPlans(){
 if(!apiOnline())return;const pending=db.pendingInitialProgressPlans||{};
 for(const [projectId,plan] of Object.entries(pending)){
  try{await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans',{method:'POST',body:JSON.stringify(plan)});delete db.pendingInitialProgressPlans[projectId];save()}
  catch(error){console.warn('Chưa đồng bộ được bảng tiến độ cơ sở:',error.message)}
 }
}
function sCurveSvg(curve,asOf){
 if(!curve||curve.length<2)return '';
 const W=640,H=200,P={l:34,r:10,t:10,b:24};const n=curve.length;
 const x=i=>P.l+(W-P.l-P.r)*i/(n-1),y=v=>P.t+(H-P.t-P.b)*(1-v/100);
 const line=(key,color,dash)=>{const pts=curve.map((c,i)=>c[key]===undefined?null:[x(i),y(c[key])]).filter(Boolean);if(pts.length<2)return '';return '<polyline fill="none" stroke="'+color+'" stroke-width="2.5"'+(dash?' stroke-dasharray="6 4"':'')+' points="'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')+'"/>'};
 let grid='';for(const v of [0,25,50,75,100])grid+='<line x1="'+P.l+'" x2="'+(W-P.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#eaecf0"/><text x="'+(P.l-6)+'" y="'+(y(v)+4)+'" font-size="10" text-anchor="end" fill="#667085">'+v+'%</text>';
 const labels=[0,Math.floor((n-1)/2),n-1].map(i=>'<text x="'+x(i)+'" y="'+(H-6)+'" font-size="10" text-anchor="'+(i===0?'start':i===n-1?'end':'middle')+'" fill="#667085">'+progressDate(curve[i].date)+'</text>').join('');
 let marker='';const idx=curve.findIndex(c=>c.date>=asOf);if(idx>=0)marker='<line x1="'+x(idx)+'" x2="'+x(idx)+'" y1="'+P.t+'" y2="'+(H-P.b)+'" stroke="#98a2b3" stroke-dasharray="2 3"/>';
 return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:720px;height:auto" role="img" aria-label="Đường cong tiến độ kế hoạch và thực tế">'+grid+marker+line('planned','#98a2b3',true)+line('actual','#155eef')+labels+'</svg><div class="muted"><span style="color:#667085">- - - Kế hoạch</span> &nbsp; <span style="color:#155eef">━ Thực tế</span></div>';
}
function renderProjectProgress(p){
 const box=document.getElementById('pdProgress');if(!box)return;
 const plans=db.progressPlans?.[p.id]||[];const detail=db.progressDetail?.[p.id];const current=plans.find(x=>x.is_current)||plans[0]||null;
 const edit=canEditProject();
 let html='<div class="toolbar" style="margin:0 0 10px"><h3 style="margin:0">Tiến độ thi công</h3>'
  +(current&&detail?.summary?.mode==='ITEMS'&&canUpdateActual(p.id)?'<button class="primary" onclick="openProgressActuals(&quot;'+p.id+'&quot;)">Cập nhật thực tế</button>':'')
  +(current&&edit?'<button onclick="openProgressPlan(&quot;'+p.id+'&quot;,&quot;'+current.id+'&quot;)">Sửa bảng tiến độ</button>':'')
  +(edit?'<button onclick="openProgressPlan(&quot;'+p.id+'&quot;)">+ Bảng tiến độ mới / gia hạn</button>':'')+'</div>';
 if(!current){box.innerHTML=html+'<p class="muted">Chưa có bảng tiến độ. '+(edit?'Bấm "+ Bảng tiến độ mới" và nhập hạng mục từ Excel để hệ thống tính tiến độ kế hoạch và so sánh với thực tế.':'')+'</p>';return}
 const s=detail?.summary||{};
 if(s.mode==='ITEMS'){
  const v=Number(s.variance||0);
  html+='<div class="toolbar" style="margin:0 0 8px"><label style="margin:0">So sánh tại ngày</label><input type="date" style="max-width:170px" value="'+esc(s.as_of||todayIso())+'" onchange="loadProjectProgressPlans(&quot;'+p.id+'&quot;,this.value)"><span class="muted">Bảng hiện hành: <b>'+esc(current.plan_name)+'</b> · '+esc(WEIGHT_BASIS_LABELS[s.weight_basis_used]||'')+'</span></div>'
   +'<div class="detail-meta"><div class="item"><b>Kế hoạch lũy kế</b>'+s.planned_percent+'%</div><div class="item"><b>Thực tế lũy kế</b>'+s.actual_percent+'%</div><div class="item"><b>Chênh lệch</b><span style="color:'+(v<0?'#b42318':'#027a48')+'">'+(v>0?'+':'')+v.toFixed(2)+' điểm %</span></div><div class="item"><b>Chỉ số tiến độ (SPI)</b>'+(s.spi??'—')+'</div><div class="item"><b>Thời gian</b>'+progressDate(s.start_date)+' → '+progressDate(s.end_date)+'</div><div class="item"><b>Hạng mục chậm/quá hạn</b>'+s.late_items+' / '+s.item_count+'</div></div>'
   +(s.warning?'<div class="notice">'+esc(s.warning)+'</div>':'')
   +(v<-5?'<div class="notice" style="margin:8px 0"><b>Cảnh báo:</b> Nhà thầu chậm '+Math.abs(v).toFixed(2)+' điểm % so với kế hoạch tại ngày '+progressDate(s.as_of)+'.</div>':'')
   +sCurveSvg(detail.curve,s.as_of)
   +'<table style="margin-top:10px"><thead><tr><th>STT</th><th>Hạng mục</th><th>Tỷ trọng</th><th>Thời gian</th><th>KH</th><th>TT</th><th>Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>'
   +detail.items.map(r=>'<tr><td>'+esc(r.code||r.seq)+'</td><td>'+esc(r.name)+(r.actual_date?'<br><span class="muted">TT cập nhật '+progressDate(r.actual_date)+'</span>':'')+'</td><td>'+r.weight_share+'%</td><td>'+progressDate(r.start_date)+' → '+progressDate(r.end_date)+'</td><td>'+r.planned_percent+'%</td><td>'+r.actual_percent+'%</td><td style="color:'+(r.variance<0?'#b42318':'#027a48')+'">'+(r.variance>0?'+':'')+r.variance+'</td><td>'+statusChip(r.status)+'</td></tr>').join('')+'</tbody></table>';
 }else{
  html+='<div class="detail-meta"><div class="item"><b>Kế hoạch (nhập tay)</b>'+(s.planned_percent??current.planned_percent??0)+'%</div><div class="item"><b>Thực tế (nhập tay)</b>'+(s.actual_percent??current.actual_percent??0)+'%</div></div><div class="notice">'+esc(s.note||'Bảng tiến độ chưa có danh sách hạng mục.')+(edit?' Bấm "Sửa bảng tiến độ" → "Đọc từ Excel" hoặc "Dán từ Excel".':'')+'</div>';
 }
 html+='<h4 style="margin:16px 0 6px">Các bảng tiến độ</h4><table><thead><tr><th>Bảng tiến độ</th><th>Ngày lập</th><th>Hạng mục</th><th>Thời hạn</th><th>Tệp gốc</th><th></th></tr></thead><tbody>'
  +plans.map(x=>'<tr><td>'+esc(x.plan_name)+(x.is_current?' <span class="chip">Hiện hành</span>':'')+'</td><td>'+progressDate(x.report_date)+'</td><td>'+(x.item_count||0)+'</td><td>'+(x.is_extension?'Gia hạn đến '+progressDate(x.revised_end_date):(x.original_end_date?'Hạn '+progressDate(x.original_end_date):'Theo hợp đồng'))+'</td><td>'+(x.has_attachment?'<a href="#" onclick="viewProgressFile(&quot;'+p.id+'&quot;,&quot;'+x.id+'&quot;,false);return false">Xem</a> · <a href="#" onclick="viewProgressFile(&quot;'+p.id+'&quot;,&quot;'+x.id+'&quot;,true);return false">Tải</a><br><span class="muted">'+esc(x.attachment_name||'')+'</span>':'<span class="muted">Chưa có</span>')+'</td><td>'+(edit?'<button onclick="openProgressPlan(&quot;'+p.id+'&quot;,&quot;'+x.id+'&quot;)">Sửa</button>':'')+(edit&&!x.is_current?' <button onclick="setCurrentProgressPlan(&quot;'+p.id+'&quot;,&quot;'+x.id+'&quot;)">Đặt hiện hành</button>':'')+'</td></tr>').join('')+'</tbody></table>';
 box.innerHTML=html;
}
async function viewProgressFile(projectId,planId,download){
 if(!apiOnline())return alert('Cần kết nối mạng để mở tệp gốc.');
 const meta=(db.progressPlans?.[projectId]||[]).find(x=>x.id===planId)||{};
 const viewable=/^(application\/pdf|image\/)/i.test(meta.attachment_type||'')||/\.(pdf|png|jpe?g|webp|gif)$/i.test(meta.attachment_name||'');
 if(!viewable)download=true; // Excel/Word: trình duyệt không hiển thị được → tải về
 const win=download?null:window.open('','_blank'); // mở ngay trong thao tác bấm để không bị chặn cửa sổ bật lên
 try{
  const res=await fetch(API_BASE+'/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(planId)+'/file',{headers:{Authorization:'Bearer '+getAuthToken()}});
  if(!res.ok){let m='HTTP '+res.status;try{m=(await res.json()).error||m}catch(_){}throw new Error(m)}
  const cd=res.headers.get('Content-Disposition')||'';const name=meta.attachment_name||decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/)||[])[1]||'bang-tien-do');
  const f=await safeFileBlob(res);if(!f.inline){download=true;if(win)win.close()}
  const url=URL.createObjectURL(f.blob);
  if(download||!win){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove()}
  else win.location.href=url;
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){if(win)win.close();alert('Không mở được tệp: '+error.message)}
}
async function setCurrentProgressPlan(projectId,planId){
 try{await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(planId),{method:'PATCH',body:JSON.stringify({is_current:true})});await loadProjectProgressPlans(projectId);await refreshProjectFromServer(projectId)}
 catch(error){alert('Không đặt được bảng hiện hành: '+error.message)}
}
async function refreshProjectFromServer(projectId){try{const projects=await apiGetProjects();mergeProjectsFromServer(projects);save()}catch(_){}}
// ---- Cửa sổ tạo/sửa bảng tiến độ ---------------------------------------------
async function openProgressPlan(projectId,planId=''){
 if(!canEditProject())return alert('Tài khoản hiện tại không có quyền sửa bảng tiến độ.');
 if(!apiOnline())return alert('Cần kết nối mạng để tạo/sửa bảng tiến độ.');
 const p=db.projects.find(x=>x.id===projectId);if(!p)return;
 let plan={plan_name:'Bảng tiến độ thi công',report_date:todayIso(),weight_basis:'VALUE',original_end_date:p.endDate||''},items=[];
 if(planId){try{const d=await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(planId));plan=d.plan;items=(d.items||[]).map(i=>({id:i.id,hasActual:!!i.actual_date,code:i.code||'',name:i.name,unit:i.unit||'',quantity:i.quantity,weight:i.weight,start_date:i.start_date,end_date:i.end_date,include:true}))}catch(error){return alert('Không tải được bảng tiến độ: '+error.message)}}
 progressEditor={projectId,planId,items,warnings:[],removeAttachment:false,originalWithActual:items.filter(i=>i.hasActual).map(i=>i.id)};
 const bases=Object.entries(WEIGHT_BASIS_LABELS).map(([k,t])=>'<option value="'+k+'"'+((plan.weight_basis||'VALUE')===k?' selected':'')+'>'+t+'</option>').join('');
 openModal((planId?'Sửa bảng tiến độ':'Bảng tiến độ mới')+' — '+(p.name||''),
  '<div class="row"><div class="full"><label>Tên bảng tiến độ</label><input id="ppName" value="'+esc(plan.plan_name||'')+'"></div>'
  +'<div><label>Ngày lập / phê duyệt</label><input id="ppDate" type="date" value="'+esc(String(plan.report_date||todayIso()).slice(0,10))+'"></div>'
  +'<div><label>Cách tính tỷ trọng hạng mục</label><select id="ppBasis">'+bases+'</select></div>'
  +'<div><label>Hạn hoàn thành theo hợp đồng</label><input id="ppOriginalEnd" type="date" value="'+esc(String(plan.original_end_date||'').slice(0,10))+'"></div>'
  +'<div><label class="inline"><input id="ppExtension" type="checkbox"'+(plan.is_extension?' checked':'')+' onchange="document.getElementById(&quot;ppExtensionFields&quot;).style.display=this.checked?&quot;&quot;:&quot;none&quot;"> Bảng tiến độ gia hạn</label></div>'
  +'<div id="ppExtensionFields" class="full" style="display:'+(plan.is_extension?'':'none')+'"><div class="row"><div><label>Hạn hoàn thành mới</label><input id="ppRevisedEnd" type="date" value="'+esc(String(plan.revised_end_date||'').slice(0,10))+'"></div><div><label>Căn cứ gia hạn</label><input id="ppReason" value="'+esc(plan.extension_reason||'')+'" placeholder="Quyết định gia hạn số..."></div></div></div>'
  +'<div class="full"><label>Tệp gốc (PDF, ảnh hoặc Excel — tối đa 10 MB)</label>'+(plan.has_attachment?'<p class="muted" id="ppCurrentFile">Đang lưu: <b>'+esc(plan.attachment_name||'')+'</b> · <a href="#" onclick="viewProgressFile(&quot;'+projectId+'&quot;,&quot;'+planId+'&quot;,false);return false">Xem</a> · <a href="#" onclick="progressEditor.removeAttachment=true;document.getElementById(&quot;ppCurrentFile&quot;).innerHTML=&quot;Tệp sẽ bị gỡ khi lưu&quot;;return false">Gỡ tệp</a></p>':'')+'<input id="ppFile" type="file" accept="application/pdf,image/*,.xlsx" onchange="onProgressFileChosen(this)"><div class="muted">Hệ thống không đọc số liệu từ PDF/ảnh quét (dễ sai). Số liệu so sánh lấy từ bảng hạng mục bên dưới; tệp Excel (.xlsx) sẽ được đọc tự động.</div></div>'
  +'<div class="full"><label>Ghi chú</label><input id="ppNote" value="'+esc(plan.note||'')+'"></div></div>'
  +'<fieldset class="perm-box"><legend>Hạng mục tiến độ (dùng để tính và so sánh)</legend>'
  +'<div class="toolbar" style="margin:4px 0"><a class="btn" href="/assets/mau-bang-tien-do.xlsx" download>Tải tệp mẫu Excel</a><label class="btn" style="margin:0;font-weight:400;color:inherit">Đọc từ Excel (.xlsx)<input type="file" accept=".xlsx" style="display:none" onchange="importProgressXlsx(this.files[0]);this.value=&quot;&quot;"></label><button type="button" onclick="toggleProgressPaste()">Dán từ Excel</button><button type="button" onclick="addProgressItem()">+ Thêm dòng</button></div>'
  +'<div id="ppPasteBox" style="display:none"><textarea id="ppPaste" rows="5" placeholder="Bôi đen vùng bảng trong Excel (gồm cả dòng tiêu đề) → Ctrl+C → dán vào đây"></textarea><button type="button" class="primary" onclick="importProgressText()">Đọc bảng đã dán</button></div>'
  +'<div id="ppWarnings"></div><div id="ppItems" style="overflow-x:auto"></div></fieldset>'
  +'<div class="toolbar"><button class="primary" onclick="saveProgressPlan()">Lưu bảng tiến độ</button>'+(planId&&canDeleteIn(projectId)?'<button class="danger" onclick="deleteProgressPlan()">🗑 Xóa bảng này</button>':'')+'</div><div id="ppMessage" class="muted"></div>');
 document.querySelector('#modal .modalbox')?.classList.add('wide');
 renderProgressItems();
}
function toggleProgressPaste(){const b=document.getElementById('ppPasteBox');if(b)b.style.display=b.style.display==='none'?'':'none'}
function readProgressGrid(){
 if(!progressEditor)return;
 document.querySelectorAll('#ppItems tr[data-i]').forEach(tr=>{const it=progressEditor.items[+tr.dataset.i];if(!it)return;
  const g=c=>tr.querySelector('[data-f="'+c+'"]');
  it.include=g('include').checked;it.code=g('code').value.trim();it.name=g('name').value.trim();it.unit=g('unit').value.trim();
  it.quantity=g('quantity').value===''?null:Number(g('quantity').value);it.weight=g('weight').value===''?null:Number(g('weight').value);
  it.start_date=g('start_date').value||null;it.end_date=g('end_date').value||null});
}
function renderProgressItems(){
 const box=document.getElementById('ppItems');if(!box||!progressEditor)return;const items=progressEditor.items;
 const warn=document.getElementById('ppWarnings');if(warn)warn.innerHTML=progressEditor.warnings.length?'<div class="notice" style="margin:6px 0"><b>Kiểm tra trước khi lưu:</b><ul style="margin:4px 0 0 16px;padding:0">'+progressEditor.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>':'';
 if(!items.length){box.innerHTML='<p class="muted">Chưa có hạng mục. Tải tệp mẫu, điền theo bảng tiến độ của nhà thầu rồi bấm "Đọc từ Excel".</p>';return}
 const basis=document.getElementById('ppBasis')?.value||'VALUE';const wLabel=basis==='DURATION'?'Giá trị (không dùng)':basis==='MANUAL'?'Tỷ trọng %':'Giá trị (đồng)';
 const inc=items.filter(i=>i.include);const totalW=inc.reduce((s,i)=>s+(Number(i.weight)||0),0);
 const starts=inc.map(i=>i.start_date).filter(Boolean).sort(),ends=inc.map(i=>i.end_date).filter(Boolean).sort();
 box.innerHTML='<table class="pp-grid"><thead><tr><th>Tính</th><th>STT</th><th style="min-width:200px">Hạng mục</th><th>ĐV</th><th>KL</th><th>'+wLabel+'</th><th>Bắt đầu</th><th>Kết thúc</th><th>Ngày</th><th></th></tr></thead><tbody>'
  +items.map((it,i)=>{const bad=(it.problems&&it.problems.length)||!it.start_date||!it.end_date||(it.end_date<it.start_date);
   return '<tr data-i="'+i+'" style="'+(it.is_group?'background:#f9fafb;color:#667085':bad?'background:#fef3f2':'')+'"><td><input type="checkbox" data-f="include"'+(it.include?' checked':'')+' onchange="readProgressGrid();renderProgressItems()" title="'+(it.is_group?'Dòng nhóm/tổng — không nên tính':'Tính vào tiến độ')+'"></td>'
   +'<td><input data-f="code" value="'+esc(it.code||'')+'" style="width:56px"></td><td><input data-f="name" value="'+esc(it.name||'')+'"></td><td><input data-f="unit" value="'+esc(it.unit||'')+'" style="width:60px"></td>'
   +'<td><input data-f="quantity" type="number" step="any" value="'+(it.quantity??'')+'" style="width:90px"></td><td><input data-f="weight" type="number" step="any" min="0" value="'+(it.weight??'')+'" style="width:130px"></td>'
   +'<td><input data-f="start_date" type="date" value="'+esc(it.start_date||'')+'" onchange="readProgressGrid();renderProgressItems()"></td><td><input data-f="end_date" type="date" value="'+esc(it.end_date||'')+'" onchange="readProgressGrid();renderProgressItems()"></td>'
   +'<td>'+daysBetween(it.start_date,it.end_date)+'</td><td><button type="button" onclick="readProgressGrid();progressEditor.items.splice('+i+',1);renderProgressItems()">✕</button></td></tr>'}).join('')
  +'</tbody></table><p class="muted">Tính: <b>'+inc.length+'</b>/'+items.length+' dòng'+(basis!=='DURATION'?' · Tổng '+(basis==='MANUAL'?'tỷ trọng':'giá trị')+': <b>'+numVN(totalW,2)+'</b>'+(basis==='MANUAL'&&Math.abs(totalW-100)>0.01&&totalW>0?' (khác 100% — hệ thống tự quy đổi theo tỷ lệ)':''):'')+(starts.length?' · Thời gian: <b>'+progressDate(starts[0])+' → '+progressDate(ends[ends.length-1])+'</b> ('+daysBetween(starts[0],ends[ends.length-1])+' ngày)':'')+'</p>';
}
function addProgressItem(){readProgressGrid();progressEditor.items.push({code:'',name:'',unit:'',quantity:null,weight:null,start_date:'',end_date:'',include:true});renderProgressItems()}
function applyParsed(result){
 if(!result.items?.length&&result.error){alert(result.error);return}
 if(progressEditor.items.some(i=>i.hasActual)&&!confirm('Bảng này đã có số liệu thực tế. Nạp danh sách mới sẽ thay toàn bộ hạng mục và XÓA số liệu thực tế cũ khi lưu. Nên tạo "Bảng tiến độ mới / gia hạn" thay vì ghi đè. Vẫn tiếp tục?'))return;
 progressEditor.items=result.items.map(i=>({code:i.code||'',name:i.name,unit:i.unit||'',quantity:i.quantity,weight:i.weight,start_date:i.start_date,end_date:i.end_date,include:i.include,is_group:i.is_group,problems:i.problems}));
 progressEditor.warnings=[...(result.header_row?['Đã đọc tiêu đề ở dòng '+result.header_row+': '+Object.values(result.columns||{}).join(' | ')]:[]),...(result.warnings||[])];
 const basisSel=document.getElementById('ppBasis');if(basisSel&&result.columns&&!result.columns.weight)basisSel.value='DURATION';
 renderProgressItems();
}
async function importProgressXlsx(file){
 if(!file)return;if(!/\.xlsx$/i.test(file.name))return alert('Chỉ đọc được tệp .xlsx.');if(file.size>10*1024*1024)return alert('Tệp tối đa 10 MB.');
 try{const data=await toDataURL(file);const r=await apiRequest('/projects/'+encodeURIComponent(progressEditor.projectId)+'/progress-plans/parse',{method:'POST',body:JSON.stringify({file:{name:file.name,data}})});applyParsed(r)}
 catch(error){alert(error.message)}
}
async function onProgressFileChosen(input){const f=input.files?.[0];if(f&&/\.xlsx$/i.test(f.name)&&confirm('Đọc luôn danh sách hạng mục từ tệp Excel này?'))await importProgressXlsx(f)}
async function importProgressText(){
 const text=document.getElementById('ppPaste')?.value||'';if(!text.trim())return;
 try{const r=await apiRequest('/projects/'+encodeURIComponent(progressEditor.projectId)+'/progress-plans/parse',{method:'POST',body:JSON.stringify({text})});applyParsed(r);toggleProgressPaste()}
 catch(error){alert(error.message)}
}
async function saveProgressPlan(){
 const ed=progressEditor;if(!ed)return;readProgressGrid();const msg=document.getElementById('ppMessage');const say=t=>{if(msg)msg.textContent=t};
 const items=ed.items.filter(i=>i.include);
 const lost=(ed.originalWithActual||[]).filter(id=>!items.some(i=>i.id===id));
 if(lost.length&&!confirm(lost.length+' hạng mục đã có số liệu thực tế sẽ bị xóa cùng số liệu đó (do bạn bỏ khỏi danh sách hoặc bỏ tích "Tính"). Tiếp tục?'))return;
 for(const [n,it] of items.entries()){if(!it.name)return say('Dòng tính thứ '+(n+1)+' chưa có tên hạng mục.');if(!it.start_date||!it.end_date)return say('"'+it.name+'": thiếu ngày bắt đầu/kết thúc.');if(it.end_date<it.start_date)return say('"'+it.name+'": ngày kết thúc trước ngày bắt đầu.')}
 const file=document.getElementById('ppFile')?.files?.[0];if(file&&file.size>10*1024*1024)return say('Tệp gốc tối đa 10 MB.');
 const extension=!!document.getElementById('ppExtension')?.checked;
 const body={plan_name:document.getElementById('ppName').value.trim()||'Bảng tiến độ thi công',report_date:document.getElementById('ppDate').value||todayIso(),weight_basis:document.getElementById('ppBasis').value,original_end_date:document.getElementById('ppOriginalEnd').value||null,is_extension:extension,revised_end_date:extension?(document.getElementById('ppRevisedEnd').value||null):null,extension_reason:extension?(document.getElementById('ppReason').value.trim()||null):null,note:document.getElementById('ppNote').value.trim()||null,items:items.map(i=>({id:i.id||null,code:i.code,name:i.name,unit:i.unit,quantity:i.quantity,weight:i.weight,start_date:i.start_date,end_date:i.end_date}))};
 if(extension&&!body.revised_end_date)return say('Nhập hạn hoàn thành mới cho bảng gia hạn.');
 if(file)body.attachment={name:file.name,type:file.type,size:file.size,data:await toDataURL(file)};
 if(ed.removeAttachment&&!file)body.remove_attachment=true;
 try{
  say('Đang lưu...');
  const url='/projects/'+encodeURIComponent(ed.projectId)+'/progress-plans'+(ed.planId?'/'+encodeURIComponent(ed.planId):'');
  await apiRequest(url,{method:ed.planId?'PATCH':'POST',body:JSON.stringify(body)});
  audit(ed.planId?'UPDATE':'CREATE','project_progress_plan',ed.planId||'',body.plan_name+' ('+items.length+' hạng mục)');
  closeModal();progressEditor=null;await loadProjectProgressPlans(ed.projectId);await refreshProjectFromServer(ed.projectId);
 }catch(error){say('Không lưu được: '+error.message)}
}
async function deleteProgressPlan(){
 const ed=progressEditor;if(!ed?.planId)return;
 if(!canDeleteIn(ed.projectId))return alert('Tài khoản chưa được cấp quyền "Xóa" tại công trình này.');
 deleteContent('plan',ed.planId,'Bảng tiến độ (kèm hạng mục và số liệu thực tế)',ed.projectId);
}
// ---- Cập nhật thực tế theo hạng mục --------------------------------------------
async function openProgressActuals(projectId,dateIso){
 if(!apiOnline())return alert('Cần kết nối mạng để cập nhật thực tế.');
 const plans=db.progressPlans?.[projectId]||[];const current=plans.find(x=>x.is_current)||plans[0];if(!current)return;
 const date=dateIso||todayIso();
 let d;try{d=await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(current.id)+'?as_of='+date)}catch(error){return alert(error.message)}
 openModal('Cập nhật thực tế — '+current.plan_name,
  '<div class="toolbar"><label style="margin:0">Ngày báo cáo</label><input id="paDate" type="date" style="max-width:170px" value="'+date+'" onchange="openProgressActuals(&quot;'+projectId+'&quot;,this.value)"><span class="muted">Kế hoạch lũy kế tại ngày này: <b>'+d.summary.planned_percent+'%</b> · Thực tế: <b>'+d.summary.actual_percent+'%</b></span></div>'
  +'<p class="muted">Nhập % khối lượng đã hoàn thành lũy kế của từng hạng mục (0–100). Để trống = giữ số đã báo cáo gần nhất.</p>'
  +'<div style="overflow-x:auto"><table><thead><tr><th>Hạng mục</th><th>Thời gian</th><th>KH tại ngày</th><th>TT gần nhất</th><th>TT mới (%)</th><th>Ghi chú</th></tr></thead><tbody>'
  +d.items.map(r=>'<tr data-item="'+r.id+'"><td>'+esc(r.name)+'</td><td>'+progressDate(r.start_date)+' → '+progressDate(r.end_date)+'</td><td>'+r.planned_percent+'%</td><td>'+r.actual_percent+'%'+(r.actual_date?'<br><span class="muted">'+progressDate(r.actual_date)+'</span>':'')+'</td><td><input class="paValue" type="number" min="0" max="100" step="0.1" style="width:90px" placeholder="'+r.actual_percent+'"></td><td><input class="paNote" style="min-width:140px"></td></tr>').join('')
  +'</tbody></table></div><div class="toolbar"><button class="primary" onclick="saveProgressActuals(&quot;'+projectId+'&quot;,&quot;'+current.id+'&quot;)">Lưu số liệu thực tế</button></div><div id="paMessage" class="muted"></div>');wideModal();
}
function wideModal(){document.querySelector('#modal .modalbox')?.classList.add('wide')}
async function saveProgressActuals(projectId,planId){
 const date=document.getElementById('paDate')?.value;const msg=document.getElementById('paMessage');
 const rows=[...document.querySelectorAll('tr[data-item]')].map(tr=>({item_id:tr.dataset.item,v:tr.querySelector('.paValue').value,note:tr.querySelector('.paNote').value.trim()})).filter(r=>r.v!=='').map(r=>({item_id:r.item_id,actual_percent:Number(r.v),note:r.note}));
 if(!rows.length){msg.textContent='Chưa nhập số liệu nào.';return}
 if(rows.some(r=>!(r.actual_percent>=0&&r.actual_percent<=100))){msg.textContent='Tỷ lệ phải trong khoảng 0–100%.';return}
 try{msg.textContent='Đang lưu...';await apiRequest('/projects/'+encodeURIComponent(projectId)+'/progress-plans/'+encodeURIComponent(planId)+'/actuals',{method:'POST',body:JSON.stringify({report_date:date,rows})});
  audit('UPDATE_ACTUALS','project_progress_plan',planId,rows.length+' hạng mục, ngày '+date);closeModal();await loadProjectProgressPlans(projectId,date);await refreshProjectFromServer(projectId)}
 catch(error){msg.textContent='Không lưu được: '+error.message}
}

function renderProjectDetail(){
if(!currentProjectId)return;
const p=db.projects.find(x=>x.id===currentProjectId);
if(!p){goDashboard();return}
document.getElementById('pdEditBtn').style.display=canEditProject()?'':'none';
document.getElementById('pdTitle').textContent=`${p.code} — ${p.name}`;
document.getElementById('pdSub').textContent=`${p.client||''} · ${p.province||''} · Tiến độ ${p.progress||0}%`;
document.getElementById('pdMeta').innerHTML=`
<div class="item"><b>Tr&#x1ea1;ng th&#x00e1;i</b>${statusBadge(p.status)}</div>
<div class="item"><b>&#x0110;&#x1ecb;a ch&#x1ec9;</b>${esc(p.address||'—')}</div>
<div class="item"><b>Ch&#x1ee7; &#x0111;&#x1ea7;u t&#x01b0;</b>${esc(p.client||'—')}</div>
<div class="item"><b>&#x0110;&#x1ecb;a b&#x00e0;n</b>${esc(p.province||'—')}</div>
<div class="item"><b>Ti&#x1ebfn &#x0111;&#x1ed9;</b>${p.progress||0}%</div>
<div class="item"><b>Ng&#x00e0;y t&#x1ea1;o</b>${fmt(p.createdAt)}</div>`;
const tvgsLink=p.contractFileTvgs?.data?`<p><a href="${p.contractFileTvgs.data}" download="${esc(p.contractFileTvgs.name||'hop-dong-tvgs')}">Tải hợp đồng TVGS: ${esc(p.contractFileTvgs.name||'Tệp hợp đồng')}</a></p>`:'';
const contractorLink=p.contractFileContractor?.data?`<p><a href="${p.contractFileContractor.data}" download="${esc(p.contractFileContractor.name||'hop-dong-nha-thau')}">Tải hợp đồng nhà thầu: ${esc(p.contractFileContractor.name||'Tệp hợp đồng')}</a></p>`:'';
document.getElementById('pdContract').innerHTML=`
<h4 style="margin:8px 0 6px">Thông tin hợp đồng</h4>
<h5>Tư vấn giám sát</h5><div class="detail-meta">
<div class="item"><b>Số hợp đồng</b>${esc(p.contractNo||'—')}</div><div class="item"><b>Ngày ký</b>${p.contractDate?fmtDate(p.contractDate):'—'}</div><div class="item"><b>Giá trị</b>${p.contractValue!=null&&p.contractValue!==''?Number(p.contractValue).toLocaleString('vi-VN')+' đ':'—'}</div></div>
${p.contractContent?`<p><b>Nội dung</b><br>${esc(p.contractContent).replace(/\n/g,'<br>')}</p>`:''}${tvgsLink}
<h5>Nhà thầu</h5><div class="detail-meta"><div class="item"><b>Số hợp đồng</b>${esc(p.contractorContractNo||'—')}</div><div class="item"><b>Ngày ký</b>${p.contractorContractDate?fmtDate(p.contractorContractDate):'—'}</div><div class="item"><b>Giá trị</b>${p.contractorContractValue!=null&&p.contractorContractValue!==''?Number(p.contractorContractValue).toLocaleString('vi-VN')+' đ':'—'}</div></div>
${p.contractorContractContent?`<p><b>Nội dung</b><br>${esc(p.contractorContractContent).replace(/\n/g,'<br>')}</p>`:''}${contractorLink}`;
renderProjectProgress(p);
const logs=db.logs.filter(x=>x.projectId===p.id);
const issues=db.issues.filter(x=>x.projectId===p.id);
const docs=db.docs.filter(x=>x.projectId===p.id);

document.getElementById('pdLogs').innerHTML=logs.length?`<table><thead><tr><th>Ngày</th><th>Công việc</th><th>NL</th><th>Máy</th><th>Trạng thái</th><th></th></tr></thead><tbody>${logs.map(x=>`<tr><td>${esc(x.date)}<br><span class="muted">${esc(shiftLabel(x.shift))}</span></td><td>${esc(x.work)}</td><td>${x.workers}</td><td>${x.machines}</td><td>${logStatusBadge(x.status)}</td><td>${canEditLog(x)?`<button onclick="openLog('${x.id}')">Sửa</button>`:'<span class="muted">Chỉ xem</span>'}</td></tr>`).join('')}</tbody></table>`:'<span class="muted">Chưa có nhật ký</span>';
document.getElementById('pdIssues').innerHTML=issues.length?`<table><thead><tr><th>Mã</th><th>Tên văn bản</th><th>Loại văn bản</th><th>Trạng thái</th><th>Người tạo</th></tr></thead><tbody>${issues.map(x=>`<tr><td>${esc(x.code||'')}</td><td><b>${esc(x.title||typeLabel(x))}</b></td><td>${esc(typeLabel(x))}</td><td>${statusBadge(x.status)}</td><td>${esc(x.createdBy||x.created_by_name||'Chưa xác định')}</td></tr>`).join('')}</tbody></table>`:'<span class="muted">Không có nội dung chất lượng</span>';
document.getElementById('pdDocs').innerHTML=docs.length?`<table><thead><tr><th>Mã</th><th>Hồ sơ</th><th>Ver</th><th>TT</th><th></th></tr></thead><tbody>${docs.map(x=>`<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>v${x.version}</td><td>${docStatusBadge(x.status)}</td><td><button onclick="viewDoc('${x.id}')">Xem</button>${canModifyDoc(x)?` <button onclick="openDoc('${x.id}')">Sửa</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<span class="muted">Chưa có hồ sơ</span>';
{const pdPeople=document.getElementById('pdPeople');const cachedTeam=db.teamCache?.[p.id]?.rows;if(pdPeople)pdPeople.innerHTML=cachedTeam&&typeof teamTableHtml==='function'?teamTableHtml(cachedTeam,p.id,{compact:true}):'<span class="muted">Đang tải nhân sự...</span>'}
}
function editCurrentProject(){if(currentProjectId)openProject(currentProjectId)}
function qualitySelfCheck(){const bad=(db.issues||[]).filter(x=>x.documentType&&x.documentType!=='MINUTES'&&x.documentType!=='LETTER');if(bad.length)console.warn('QUALITY_SELF_CHECK invalid document types',bad.map(x=>x.id));return {total:(db.issues||[]).filter(x=>x.documentType).length,minutes:(db.issues||[]).filter(x=>x.documentType==='MINUTES').length,letters:(db.issues||[]).filter(x=>x.documentType==='LETTER').length,invalid:bad.length}}
function renderAll(){
const qualityNav=document.querySelector('nav button[data-page="issues"]');if(qualityNav)qualityNav.innerHTML='⚠ <span>Chất lượng công trình</span>';const qualityHeading=document.querySelector('#issues h2');if(qualityHeading)qualityHeading.textContent='Chất lượng công trình';
const addPersonButton=document.getElementById('addPersonButton');if(addPersonButton)addPersonButton.style.display=canManageAssignments()?'':'none';
const settingsNav=document.querySelector('nav button[data-page="settings"]');if(settingsNav)settingsNav.style.display=canManageAssignments()?'':'none';if(!canManageAssignments()&&document.getElementById('settings')?.classList.contains('active'))goPage('projects');
if(typeof applyInboxNavVisibility==='function')applyInboxNavVisibility();
if(typeof applyTrashNavVisibility==='function')applyTrashNavVisibility();
enforceDashboardAccess();renderSelects();if(canViewDashboard())renderDashboard();renderProjects();renderLogs();renderIssues();renderDocs();if(typeof renderReports==='function')renderReports();renderPeople();renderAudit();
document.getElementById('role').value=db.role;updateNet();
if(currentProjectId&&document.getElementById('projectDetail').classList.contains('active'))renderProjectDetail();
}
function openModal(title,body){if(window.__forcePw)return;document.querySelector('#modal .modalbox')?.classList.remove('wide');document.getElementById('mtitle').textContent=title;document.getElementById('mbody').innerHTML=body;document.getElementById('modal').classList.add('show')}
function closeModal(){if(window.__forcePw)return;document.getElementById('modal').classList.remove('show')}
function openProject(pid=''){
if(!canEditProject()){alert('Tài khoản chỉ được xem công trình được phân công.');return;}
let p=db.projects.find(x=>x.id===pid)||{};
const tvgsFile=p.contractFileTvgs?.name?'<p class="muted">Tệp hiện tại: '+esc(p.contractFileTvgs.name)+'</p>':'';
const contractorFile=p.contractFileContractor?.name?'<p class="muted">Tệp hiện tại: '+esc(p.contractFileContractor.name)+'</p>':'';
openModal(pid?'Sửa công trình':'Thêm công trình',`<div class="row">
<h3 class="full" style="margin:0">TƯ VẤN GIÁM SÁT</h3>
<div><label>Mã công trình</label><input id="fcode" value="${esc(p.code||'CT-2026-001')}"></div>
<div><label>Tên công trình</label><input id="fname" value="${esc(p.name||'')}"></div>
<div><label>Địa điểm</label><input id="fprovince" value="${esc(p.province||'')}"></div>
<div><label>Chủ đầu tư</label><input id="fclient" value="${esc(p.client||'')}"></div>
<div><label>Số hợp đồng</label><input id="fcontractNo" value="${esc(p.contractNo||'')}"></div>
<div><label>Ngày ký hợp đồng</label><input id="fcontractDate" type="date" value="${p.contractDate||''}"></div>
<div><label>Giá trị hợp đồng (VNĐ)</label><input id="fcontractValue" type="number" min="0" step="1000" value="${p.contractValue??''}"></div>
<div class="full"><label>Nội dung hợp đồng</label><textarea id="fcontractContent" rows="3">${esc(p.contractContent||'')}</textarea></div>
<div class="full"><label>Tệp hợp đồng TVGS</label><input id="fcontractFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,image/*">${tvgsFile}</div>
<h3 class="full" style="margin:8px 0 0">NHÀ THẦU</h3>
<div><label>Tên nhà thầu</label><input id="fcontractor" value="${esc(p.contractorName||'')}"></div>
<div><label>Số hợp đồng nhà thầu</label><input id="fcontractorContractNo" value="${esc(p.contractorContractNo||'')}"></div>
<div><label>Ngày ký hợp đồng nhà thầu</label><input id="fcontractorContractDate" type="date" value="${p.contractorContractDate||''}"></div>
<div><label>Giá trị hợp đồng nhà thầu (VNĐ)</label><input id="fcontractorContractValue" type="number" min="0" step="1000" value="${p.contractorContractValue??''}"></div>
<div class="full"><label>Nội dung hợp đồng nhà thầu</label><textarea id="fcontractorContractContent" rows="3">${esc(p.contractorContractContent||'')}</textarea></div>
<div class="full"><label>Tệp hợp đồng nhà thầu</label><input id="fcontractorContractFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,image/*">${contractorFile}</div>
<div><label>Ngày khởi công</label><input id="fstartDate" type="date" value="${p.startDate||''}"></div>
<div><label>Ngày kết thúc</label><input id="fendDate" type="date" value="${p.endDate||''}"></div>
<div><label>Số ngày thực hiện</label><input id="fexecutionDays" type="number" value="${executionDays(p.startDate,p.endDate)||''}" readonly></div><div><label>Tiến độ kế hoạch hiện hành (%)</label><input id="fplannedProgress" type="number" min="0" max="100" step="0.1" value="${p.plannedProgress??''}"></div><div class="full"><label>Bảng tiến độ cơ sở của Nhà thầu (PDF hoặc ảnh)</label><input id="fbaselineProgressFile" type="file" accept="application/pdf,image/*"><div class="muted">Tệp là căn cứ đối chiếu. Nhập tỷ lệ kế hoạch tại mốc báo cáo để hệ thống cảnh báo chậm tiến độ.</div></div>
<div><label>Tiến độ (%)</label><input id="fprogress" type="number" min="0" max="100" value="${p.progress||0}"></div>
<div><label>Trạng thái</label><select id="fstatus"><option>ĐANG THI CÔNG</option><option>CHUẨN BỊ</option><option>TẠM DỪNG</option><option>HOÀN THÀNH</option></select></div>
<div class="full"><label>Địa chỉ chi tiết</label><input id="faddress" value="${esc(p.address||'')}"></div>
<div class="full"><button class="primary" onclick="saveProject('${pid}')">Lưu công trình</button></div>
</div>`);
if(p.status)document.getElementById('fstatus').value=p.status;
}
async function saveProject(pid){
if(!canEdit())return alert('Bạn không có quyền sửa công trình.');
let p=db.projects.find(x=>x.id===pid);
const readContractFile=async(id,category,existing)=>{const file=document.getElementById(id)?.files?.[0];if(!file)return existing||null;if(file.size>15*1024*1024){alert('Mỗi tệp hợp đồng tối đa 15 MB.');return existing||null}return {name:file.name,type:file.type,size:file.size,data:await toDataURL(file),category,uploadedAt:new Date().toISOString()}};
const tvgsFile=await readContractFile('fcontractFile','TVGS',p?.contractFileTvgs);const contractorFile=await readContractFile('fcontractorContractFile','NHÀ THẦU',p?.contractFileContractor);
const baselineFileInput=document.getElementById('fbaselineProgressFile')?.files?.[0];
if(baselineFileInput&&baselineFileInput.size>10*1024*1024)return alert('Bảng tiến độ tối đa 10 MB.');
const baselineAttachment=baselineFileInput?{name:baselineFileInput.name,type:baselineFileInput.type,size:baselineFileInput.size,data:await toDataURL(baselineFileInput)}:null;
let data={code:fcode.value.trim(),name:fname.value.trim(),province:fprovince.value.trim(),client:fclient.value.trim(),contractorName:fcontractor.value.trim(),progress:+fprogress.value,plannedProgress:fplannedProgress.value===''?null:+fplannedProgress.value,address:faddress.value.trim(),status:fstatus.value,contractNo:fcontractNo.value.trim(),contractDate:fcontractDate.value||'',startDate:fstartDate.value||'',endDate:fendDate.value||'',contractValue:fcontractValue.value===''?null:+fcontractValue.value,contractContent:fcontractContent.value.trim(),contractFileTvgs:tvgsFile,contractorContractNo:fcontractorContractNo.value.trim(),contractorContractDate:fcontractorContractDate.value||'',contractorContractValue:fcontractorContractValue.value===''?null:+fcontractorContractValue.value,contractorContractContent:fcontractorContractContent.value.trim(),contractFileContractor:contractorFile};
if(!data.name)return alert('Nhập tên công trình');
if(p){Object.assign(p,data);p.updatedAt=new Date().toISOString()}else{p={id:id(),...data,createdAt:new Date().toISOString()};db.projects.push(p)}
if(baselineAttachment){db.pendingInitialProgressPlans[p.id]={plan_name:'Bảng tiến độ cơ sở Nhà thầu',report_date:new Date().toISOString().slice(0,10),planned_percent:Number(data.plannedProgress??0),actual_percent:Number(data.progress||0),original_end_date:data.endDate||null,is_extension:false,is_current:true,attachment:baselineAttachment};p.baselineProgressFile=baselineAttachment}audit(pid?'UPDATE':'CREATE','project',p.id,data.name+(data.contractNo?' / '+data.contractNo:''));queueSync('project',p.id,pid?'UPDATE':'CREATE',data);closeModal();save();if(currentProjectId===p.id)renderProjectDetail();if(navigator.onLine&&window.syncPendingProjects){await window.syncPendingProjects();await syncInitialProgressPlans();}
}
function openLog(lid=''){
if(!canEditDailyLog())return alert('Tài khoản hiện tại không được lập hoặc sửa nhật ký.');
if(!db.projects.length)return alert('Hãy tạo công trình trước.');
let x=db.logs.find(l=>l.id===lid)||{};const isEdit=!!lid;
if(isEdit&&!canEditLog(x))return alert('Nhật ký này không còn được phép sửa.');
const logProjects=isEdit?(db.projects||[]).filter(p=>p.id===x.projectId):logProjectsForCreate();if(!logProjects.length)return alert('Tài khoản chưa được cấp quyền "Thêm" nhật ký ở công trình nào.');
openModal(isEdit?'Sửa nhật ký':'Lập nhật ký',`${isEdit?reviewBlockHtml(x,{history:false}):''}<div class="row"><div><label>C&#x00f4;ng tr&#x00ec;nh</label><select id="lproj">${logProjects.map(p=>`<option value="${p.id}" ${p.id===x.projectId?'selected':''}>${esc(p.code)} - ${esc(p.name)}</option>`).join('')}</select></div><div><label>Ng&#x00e0;y</label><input id="ldate" type="date" value="${x.date||new Date().toISOString().slice(0,10)}"></div><div><label>Ca l&#224;m vi&#7879;c</label><select id="lshift">${SHIFT_OPTIONS.map(([v,t])=>`<option value="${v}" ${(x.shift||'CA1')===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="full"><label>C&#x00f4;ng vi&#x1ec7;c</label><textarea id="lwork" rows="3">${esc(x.work||'')}</textarea></div><div><label>Nh&#x00e2;n l&#x1ef1;c</label><input id="lworkers" type="number" value="${x.workers??0}"></div><div><label>M&#x00e1;y m&#x00f3;c</label><input id="lmachines" type="number" value="${x.machines??0}"></div><div><label>Thời tiết</label><input id="lweather" list="weatherList" value="${esc(x.weather||'')}" placeholder="Nắng / Mưa / Âm u..."><datalist id="weatherList"><option>Nắng</option><option>Nắng nóng</option><option>Mây</option><option>Mưa nhỏ</option><option>Mưa to</option><option>Âm u</option></datalist></div><div><label>Ghi ch&#x00fa</label><textarea id="lnote" rows="2">${esc(x.note||'')}</textarea></div><div class="full"><label>&#x1ea2;nh hi&#x1ec7;n tr&#x01b0;&#x1edd;ng</label><input id="lphotos" type="file" accept="image/jpeg,image/png,image/webp" multiple><div class="muted">C&#x00f3; th&#x1ec3; th&#x00eam &#x1ea3;nh khi ch&#x1ec9;nh s&#x1eeda nh&#x1ead;t k&#x00fd.</div></div><div class="full"><label>T&#x00e0;i li&#x1ec7;u k&#x00e8;m theo</label><input id="ldocuments" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,image/*" multiple><div class="muted">Cho ph&#x00e9;p t&#x1ea3;i bi&#x00ean b&#x1ea3;n, th&#x01b0; k&#x1ef9; thu&#x1ead;t ho&#x1eb7;c t&#x00e0;i li&#x1ec7;u li&#x00ean quan.</div></div><div class="full toolbar"><button class="primary" onclick="saveLog('${lid}',false)">${isEdit?'Lưu thay đổi':'Lưu nháp'}</button><button onclick="saveLog('${lid}',true)">${isEdit?'Lưu và gửi duyệt':'Lưu và gửi duyệt'}</button><span class="muted">Nháp: còn sửa được. Gửi duyệt: chuyển Trưởng TVGS duyệt, không sửa được nữa.</span></div></div>`);
}
async function saveLog(lid='',submitAfter=false){
if(!canEditDailyLog())return alert('Bạn không có quyền sửa hoặc lập nhật ký.');
let existing=db.logs.find(l=>l.id===lid);if(existing&&!canEditLog(existing))return alert('Nhật ký không còn được phép sửa.');
let photos=[...(existing?.photos||[])];const photoFiles=[...(document.getElementById('lphotos')?.files||[])];
if(photoFiles.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024))return alert('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.');
for(const f of photoFiles)photos.push({name:f.name,data:await toDataURL(f)});
let documents=[...(existing?.documents||[])];const docFiles=[...(document.getElementById('ldocuments')?.files||[])];
for(const f of docFiles){if(f.size>15*1024*1024)return alert('Tài liệu tối đa 15 MB mỗi tệp.');documents.push({name:f.name,type:f.type,size:f.size,data:await toDataURL(f),uploadedAt:new Date().toISOString()})}
const shift=document.getElementById('lshift')?.value||'CA1';
const dupLog=db.logs.find(l=>l.id!==existing?.id&&l.projectId===lproj.value&&l.date===ldate.value&&String(l.shift||'CA1')===shift);if(dupLog)return alert('Đã có nhật ký '+shiftLabel(shift)+' ngày '+ldate.value+' của công trình này. Chọn ca khác hoặc mở nhật ký đó để sửa.');
const data={projectId:lproj.value,date:ldate.value,shift,work:lwork.value,weather:(document.getElementById('lweather')?.value||'').trim(),workers:+lworkers.value,machines:+lmachines.value,note:lnote.value,photos,documents,status:existing?.status||'DRAFT',createdBy:existing?.createdBy||(typeof getAuthUser==='function'?(getAuthUser()?.full_name||db.role):db.role),createdById:existing?.createdById||(typeof getAuthUser==='function'?(getAuthUser()?.id||''):''),version:(existing?.version||0)+1,updatedAt:new Date().toISOString()};
if(existing){Object.assign(existing,data);audit('UPDATE','daily_log',existing.id,`v${existing.version}`);queueSync('daily_log',existing.id,'UPDATE',data)}else{const x={id:id(),...data,createdAt:new Date().toISOString(),version:1};db.logs.unshift(x);queueSync('daily_log',x.id,'CREATE',data);audit('CREATE_AND_CONFIRM','daily_log',x.id,'v1')}
const savedId=existing?.id||db.logs[0]?.id;
closeModal();save();if(navigator.onLine&&typeof getAuthToken==='function'&&getAuthToken()&&window.syncPendingDailyLogs)await window.syncPendingDailyLogs();
if(submitAfter){const l=db.logs.find(v=>v.id===savedId);if(l?.serverId&&l.status==='DRAFT')await logAction(l.id,'submit',true);else if(l&&!l.serverId)alert('Nhật ký đã lưu trên thiết bị nhưng chưa lên máy chủ (mất mạng?). Sẽ gửi duyệt được sau khi đồng bộ.')}
if(currentProjectId)renderProjectDetail();
}
function exportDailyLog(lid){
const x=db.logs.find(l=>l.id===lid);
if(!x)return;
const project=db.projects.find(p=>p.id===x.projectId)||{};
const lines=[
'VINA-SUPERVISION - NHẬT KÝ CÔNG TRÌNH',
`Công trình: ${project.code||''} - ${project.name||''}`,
`Ngày: ${x.date||''} — ${shiftLabel(x.shift)}`,
`Người lập: ${x.createdBy||'Chưa xác định'}`,
`Công việc: ${x.work||''}`,
`Nhân lực: ${x.workers||0}`,
`Máy móc: ${x.machines||0}`,
`Thời tiết: ${x.weather||''}`,
`Trạng thái: ${LOG_STATUS[x.status]||x.status||''}`,
`Ghi chú: ${x.note||''}`
];
const text='\ufeff'+lines.join('\r\n');
const safe=String(project.code||'cong-trinh').replace(/[^\w-]+/g,'-');
const file=new File([text],`nhat-ky-${safe}-${x.date||'export'}-${x.shift||'CA1'}.txt`,{type:'text/plain;charset=utf-8'});
const download=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
 navigator.share({title:'Nhật ký công trình',text:`Nhật ký ${project.name||''} ngày ${x.date||''}`,files:[file]}).catch(()=>download());
}else download();
}
function toDataURL(file){return new Promise(r=>{let a=new FileReader();a.onload=()=>r(a.result);a.readAsDataURL(file)})}
function qualityParticipantsHtml(items=[]){const rows=(items.length?items:[{group:'TVGS',name:'',role:''}]).map((v,i)=>`<div class="participant-row" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin:6px 0"><input class="q-group" value="${esc(v.group||'TVGS')}" placeholder="Nhóm"><input class="q-name" value="${esc(v.name||'')}" placeholder="Họ tên"><input class="q-role" value="${esc(v.role||'')}" placeholder="Chức vụ"><button type="button" onclick="this.parentElement.remove()">Xóa</button></div>`).join('');return `<div id="qualityParticipants">${rows}</div><button type="button" onclick="addQualityParticipant()">+ Thêm thành phần</button>`}
function addQualityParticipant(){const box=document.getElementById('qualityParticipants');if(!box)return;const d=document.createElement('div');d.className='participant-row';d.style='display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin:6px 0';d.innerHTML='<input class="q-group" value="TVGS" placeholder="Nhóm"><input class="q-name" placeholder="Họ tên"><input class="q-role" placeholder="Chức vụ"><button type="button" onclick="this.parentElement.remove()">Xóa</button>';box.appendChild(d)}
function toggleQualityTemplateFields(){const letter=document.getElementById('idocType')?.value==='LETTER';document.querySelectorAll('.minutes-only').forEach(e=>e.style.display=letter?'none':'');document.querySelectorAll('.letter-only').forEach(e=>e.style.display=letter?'':'none');const set=(id,text)=>{const e=document.getElementById(id);if(e)e.textContent=text};set('qualityFormHeading',letter?'ĐOÀN TƯ VẤN GIÁM SÁT - THƯ KỸ THUẬT':'BIÊN BẢN KIỂM TRA HIỆN TRƯỜNG');set('qualitySection2Title',letter?'2. Nội dung thư kỹ thuật':'2. Đối tượng và thời gian kiểm tra');set('qualityTitleLabel',letter?'Tiêu đề thư':'Đối tượng (công việc kiểm tra)');set('qualityContentLabel',letter?'Nội dung thư':'Nội dung và kết quả kiểm tra');set('qualityConclusionLabel',letter?'Ý kiến / yêu cầu phản hồi':'Kết luận');set('qualitySection3Title',letter?'3. Người gửi, người tiếp nhận':'3. Thành phần trực tiếp tham gia');set('qualitySection4Title',letter?'':'4. Đại diện ký');set('qualitySection5Title',letter?'4. Phát hành và lưu hồ sơ':'5. Phát hành và lưu hồ sơ')}
function openIssue(issueId=''){const existingIssue=issueId?db.issues.find(v=>v.id===issueId):null;if(existingIssue&&!qualityCanEdit(existingIssue))return alert('Bạn chỉ được sửa văn bản do mình lập hoặc văn bản được cấp quyền Sửa.');if(!db.projects.length)return alert('Hãy tạo công trình trước.');const x=db.issues.find(v=>v.id===issueId)||{};const members=x.participants||[];const edit=!!issueId;const type=x.documentType||'MINUTES';openModal(edit?'Sửa văn bản chất lượng':'Tạo văn bản chất lượng',`<div id="qualityFormShell" class="quality-form-sheet"><div class="quality-form-head"><img src="/assets/vicoad-logo.png" alt="Logo Vicoad"><div><b>CÔNG TY TNHH TƯ VẤN XÂY DỰNG VÀ QUẢNG CÁO VINA</b><small>Số 58 ngõ 291 phố Khương Trung, Khương Đình, Hà Nội · Tel: 0988355580</small></div><div class="quality-form-national"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><span>Độc lập - Tự do - Hạnh phúc</span></div></div><div class="quality-form-title"><label>Loại văn bản</label><select id="idocType" onchange="toggleQualityTemplateFields()"><option value="MINUTES">Biên bản hiện trường</option><option value="LETTER">Thư kỹ thuật</option></select><h3 id="qualityFormHeading">${type==='LETTER'?'ĐOÀN TƯ VẤN GIÁM SÁT - THƯ KỸ THUẬT':'BIÊN BẢN KIỂM TRA HIỆN TRƯỜNG'}</h3><input id="iref" value="${esc(x.reference||x.code||'')}" placeholder="Số biên bản / lần phát hành"></div><div class="quality-form-block"><h4>1. Thông tin công trình</h4><div class="row"><div><label>Dự án / Công trình</label><select id="iproj">${projectsOptions(x.projectId)}</select></div><div><label>Tên hiển thị dự án</label><input id="iprojectName" value="${esc(x.projectName||'')}" placeholder="Tự lấy theo công trình"></div><div><label>Gói thầu</label><input id="ipackage" value="${esc(x.packageName||'')}"></div><div><label>Địa điểm xây dựng</label><input id="ilocation" value="${esc(x.location||'')}"></div><div><label>Ngày lập</label><input id="idate" type="date" value="${esc(x.documentDate||new Date().toISOString().slice(0,10))}"></div><div><label>Mức độ</label><select id="ipri"><option>THẤP</option><option>TRUNG BÌNH</option><option>CAO</option><option>KHẨN</option></select></div></div></div><div class="quality-form-block"><h4 id="qualitySection2Title">${type==='LETTER'?'2. Nội dung thư kỹ thuật':'2. Đối tượng và thời gian kiểm tra'}</h4><div><label id="qualityTitleLabel">${type==='LETTER'?'Tiêu đề thư':'Đối tượng (công việc kiểm tra)'}</label><input id="ititle" value="${esc(x.title||'')}"></div><div class="minutes-only"><div class="row"><div><label>Bắt đầu</label><input id="istart" type="datetime-local" value="${esc(x.startTime||'')}"></div><div><label>Kết thúc</label><input id="iend" type="datetime-local" value="${esc(x.endTime||'')}"></div></div></div><div><label id="qualityContentLabel">${type==='LETTER'?'Nội dung thư':'Nội dung và kết quả kiểm tra'}</label><textarea id="idetail" rows="8">${esc(x.detail||'')}</textarea></div><div><label id="qualityConclusionLabel">${type==='LETTER'?'Ý kiến / yêu cầu phản hồi':'Kết luận'}</label><textarea id="iconclusion" rows="5">${esc(x.conclusion||'')}</textarea></div></div><div class="quality-form-block"><h4 id="qualitySection3Title">${type==='LETTER'?'3. Người gửi, người tiếp nhận':'3. Thành phần trực tiếp tham gia'}</h4><div class="minutes-only">${qualityParticipantsHtml(x.participants||[])}</div><div class="letter-only"><div class="row"><div><label>Người gửi / đại diện TVGS</label><input id="isender" value="${esc(x.sender||'')}"></div><div><label>Chức vụ người gửi</label><input id="isenderRole" value="${esc(x.senderRole||'Trưởng/Phó Đoàn TVGS')}"></div><div><label>Người tiếp nhận</label><input id="ireceiver" value="${esc(x.receiver||'')}"></div><div><label>Ngày tiếp nhận</label><input id="ireceiveDate" type="datetime-local" value="${esc(x.receiveDate||'')}"></div></div></div></div><div class="quality-form-block minutes-only"><h4 id="qualitySection4Title">4. Đại diện ký</h4><div class="row"><div><label>Đ/D Chủ đầu tư</label><input id="sigInvestor" value="${esc(x.signatures?.investor||members.find(v=>{const g=String(v.group||'').toLowerCase();return g.includes('chủ')||g.includes('chu')||g.includes('qlda')||g.includes('ban')})?.name||'')}"></div><div><label>Đ/D TVGS</label><input id="sigTvgs" value="${esc(x.signatures?.tvgs||'')}"></div><div><label>Đ/D Nhà thầu thi công</label><input id="sigContractor" value="${esc(x.signatures?.contractor||'')}"></div></div></div><div class="quality-form-block"><h4 id="qualitySection5Title">${type==='LETTER'?'4. Phát hành và lưu hồ sơ':'5. Phát hành và lưu hồ sơ'}</h4><div class="row"><div><label>Hạn xử lý</label><input id="idue" type="date" value="${esc(x.due||'')}"></div><div><label>Trạng thái</label><select id="istatus"><option value="DRAFT">Bản nháp</option><option value="ISSUED">Đã phát hành</option><option value="SIGNED">Đã ký và lưu</option><option value="CLOSED">Đã đóng</option></select></div></div><label>Bản ký / tài liệu đính kèm</label><input id="isignedFile" type="file" accept=".pdf,.doc,.docx,image/*"></div><div class="toolbar"><button class="primary" onclick="saveQualityDocument('${issueId}')">Lưu văn bản</button>${edit?`<button type="button" onclick="printQualityDocument('${issueId}')">In / Xuất PDF</button>`:''}</div></div>`);document.getElementById('idocType').value=type;if(x.priority)document.getElementById('ipri').value=x.priority;if(x.status)document.getElementById('istatus').value=['SIGNED','ISSUED','CLOSED'].includes(x.status)?x.status:'DRAFT';toggleQualityTemplateFields()}
function qualityFormData(existing){const p=db.projects.find(v=>v.id===document.getElementById('iproj')?.value)||{};const val=id=>document.getElementById(id)?.value?.trim()||'';const rows=[...document.querySelectorAll('#qualityParticipants .participant-row')].map(r=>({group:r.querySelector('.q-group')?.value.trim()||'',name:r.querySelector('.q-name')?.value.trim()||'',role:r.querySelector('.q-role')?.value.trim()||''})).filter(v=>v.name);const docType=document.getElementById('idocType')?.value||'MINUTES';return {projectId:val('iproj'),documentType:docType,sourceType:docType==='LETTER'?'Thư kỹ thuật':'Biên bản hiện trường',reference:val('iref'),code:existing?.code||('CL-'+new Date().getFullYear()+'-'+String(db.issues.length+1).padStart(4,'0')),title:val('ititle'),projectName:val('iprojectName')||p.name||'',packageName:val('ipackage'),location:val('ilocation')||p.province||'',documentDate:document.getElementById('idate')?.value||'',startTime:document.getElementById('istart')?.value||'',endTime:document.getElementById('iend')?.value||'',detail:val('idetail'),conclusion:val('iconclusion'),sender:val('isender'),senderRole:val('isenderRole'),receiver:val('ireceiver'),receiveDate:document.getElementById('ireceiveDate')?.value||'',due:document.getElementById('idue')?.value||'',status:document.getElementById('istatus')?.value||'DRAFT',priority:document.getElementById('ipri')?.value||'THẤP',participants:rows,signatures:{investor:val('sigInvestor'),tvgs:val('sigTvgs'),contractor:val('sigContractor')},createdById:existing?.createdById||qualityAuthUserId(),createdBy:existing?.createdBy||(typeof getAuthUser==='function'?(getAuthUser()?.full_name||db.role):db.role),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}}
async function saveQualityDocument(issueId=''){
const existing=db.issues.find(v=>v.id===issueId);const projectId=document.getElementById('iproj')?.value||existing?.projectId||'';
if(existing&&!qualityCanEdit(existing))return alert('Văn bản này chỉ được sửa bởi người lập khi chưa đóng hoặc người được cấp quyền Sửa.');
if(!existing&&!qualityCanCreate(projectId))return alert('Tài khoản chưa được cấp quyền Thêm/Sửa nội dung chất lượng tại công trình này.');
const data=qualityFormData(existing);if(!data.title)return alert('Hãy nhập tiêu đề hoặc đối tượng kiểm tra.');
const f=document.getElementById('isignedFile')?.files?.[0];if(f){if(f.size>15*1024*1024)return alert('Tệp ký tối đa 15 MB.');data.signedFile={name:f.name,type:f.type,size:f.size,data:await toDataURL(f),uploadedAt:new Date().toISOString()};data.status='SIGNED'}else if(existing?.signedFile)data.signedFile=existing.signedFile;
if(existing){Object.assign(existing,data);audit('UPDATE','quality_document',existing.id,data.title);queueSync('issue',existing.id,'UPDATE',data)}else{const x={id:id(),...data};db.issues.unshift(x);audit('CREATE','quality_document',x.id,x.title);queueSync('issue',x.id,'CREATE',data)}closeModal();save()
}
function viewIssue(issueId){
const x=db.issues.find(v=>v.id===issueId);if(!x)return;const project=db.projects.find(p=>p.id===x.projectId)||{};const canEditDoc=qualityCanEdit(x);const canReopen=qualityCanReopen(x);let actions='<button onclick="printQualityDocument(\''+issueId+'\')">In / Xuất PDF</button>';if(canEditDoc)actions+='<button class="primary" onclick="closeModal();openIssue(\''+issueId+'\')">Sửa</button>';if(canReopen)actions+='<button onclick="reopenQualityDocument(\''+issueId+'\')">Mở lại cho người lập</button>';actions+=deleteBtn('issue',x.serverId,x.projectId,x.title||x.code||'');openModal('Xem '+(qualityType(x)==='LETTER'?'Thư kỹ thuật':(qualityType(x)==='MINUTES'?'Biên bản hiện trường':'Nội dung chất lượng')), '<div class="card"><h2 style="text-align:center">'+(qualityType(x)==='LETTER'?'THƯ KỸ THUẬT':(qualityType(x)==='MINUTES'?'BIÊN BẢN KIỂM TRA HIỆN TRƯỜNG':'NỘI DUNG CHẤT LƯỢNG CÔNG TRÌNH'))+'</h2><p><b>Số / lần:</b> '+esc(x.reference||x.code||'')+'</p><p><b>Dự án / công trình:</b> '+esc(x.projectName||project.name||'')+'</p><p><b>Gói thầu:</b> '+esc(x.packageName||'')+' &nbsp; <b>Địa điểm:</b> '+esc(x.location||project.province||'')+'</p><p><b>Ngày lập:</b> '+esc(x.documentDate||'')+'</p><h3>'+esc(x.title||'')+'</h3><h4>Thành phần tham gia</h4><ul>'+((x.participants||[]).map(v=>'<li>'+esc(v.group)+': '+esc(v.name)+(v.role?' - '+esc(v.role):'')+'</li>').join('')||'<li>Chưa khai báo</li>')+'</ul><h4>Nội dung</h4><p style="white-space:pre-wrap">'+esc(x.detail||'')+'</p><h4>Kết luận / ý kiến</h4><p style="white-space:pre-wrap">'+esc(x.conclusion||'')+'</p><p><b>Người lập:</b> '+esc(x.createdBy||'')+' &nbsp; <b>Người gửi:</b> '+esc(x.sender||'')+' &nbsp; <b>Người tiếp nhận:</b> '+esc(x.receiver||'')+'</p>'+(x.signedFile?'<p><a download="'+esc(x.signedFile.name)+'" href="'+x.signedFile.data+'">Tải bản đã ký: '+esc(x.signedFile.name)+'</a></p>':'')+'</div><div class="toolbar">'+actions+'</div>')
}
function reopenQualityDocument(issueId){const x=db.issues.find(v=>v.id===issueId);if(!x)return;if(!qualityCanReopen(x))return alert('Chỉ người được cấp quyền Sửa mới được mở lại văn bản.');x.status='DRAFT';x.reopenedAt=new Date().toISOString();x.reopenedById=qualityAuthUserId();audit('REOPEN','quality_document',x.id,x.title);queueSync('issue',x.id,'UPDATE',{...x,status:'DRAFT',reopenedAt:x.reopenedAt});save();viewIssue(issueId)}
function qualityLetterhead(x,project){const kind=qualityType(x);const isLetter=kind==='LETTER';const members=x.participants||[];const norm=v=>{const g=String(v.group||'').toLowerCase();if(g.includes('ql')||g.includes('ban')||g.includes('chủ đầu tư')||g.includes('chu dau tu'))return 'Ban QLDA';if(g.includes('tvgs')||g.includes('tư vấn')||g.includes('tu van'))return 'Tư vấn giám sát';if(g.includes('nhà')||g.includes('nha')||g.includes('thầu')||g.includes('thau'))return 'Nhà thầu thi công';return v.group||'Khác'};const rowsFor=g=>members.filter(v=>norm(v)===g).map(v=>`<p class="participant-line">- Ông/Bà ${esc(v.name||'')} &nbsp;&nbsp; Chức vụ: ${esc(v.role||'')}</p>`).join('')||'<p class="participant-line">- ........................................................</p>';const minutesBody=`<p><b>1. Đối tượng (công việc kiểm tra):</b></p><p class="pre indent">${esc(x.title||'')}</p><p><b>2. Thành phần trực tiếp tham gia:</b></p><p class="subheading">2.1. Ban QLDA (nếu có):</p><div class="participants-plain">${rowsFor('Ban QLDA')}</div><p class="subheading">2.2. Tư vấn giám sát:</p><div class="participants-plain">${rowsFor('Tư vấn giám sát')}</div><p class="subheading">2.3. Nhà thầu thi công:</p><div class="participants-plain">${rowsFor('Nhà thầu thi công')}</div><p><b>3. Thời gian kiểm tra:</b></p><p class="indent">- Bắt đầu: ${esc(x.startTime||'................................')}</p><p class="indent">- Kết thúc: ${esc(x.endTime||'................................')}</p><p><b>4. Nội dung và kết quả kiểm tra</b></p><p class="pre indent">${esc(x.detail||'')}</p><p><b>5. Kết luận</b></p><p class="pre indent">${esc(x.conclusion||'')}</p><div class="signatures"><div><b>Đ/D CHỦ ĐẦU TƯ</b><br>(Ký, ghi rõ họ tên)<br><br><br>${esc(x.signatures?.investor||members.find(v=>{const g=String(v.group||'').toLowerCase();return g.includes('chủ')||g.includes('chu')||g.includes('qlda')||g.includes('ban')})?.name||'')}</div><div><b>Đ/D TVGS</b><br>(Ký, ghi rõ họ tên)<br><br><br>${esc(x.signatures?.tvgs||'')}</div><div><b>Đ/D NHÀ THẦU THI CÔNG</b><br>(Ký, ghi rõ họ tên)<br><br><br>${esc(x.signatures?.contractor||'')}</div></div>`;const letterBody=`<p><b>Người gửi:</b> ${esc(x.sender||'')}</p><p><b>Chức vụ:</b> ${esc(x.senderRole||'Trưởng/Phó Đoàn TVGS')}</p><p><b>Chữ ký:</b></p><p class="signature-line">&nbsp;</p><p><b>Nơi nhận:</b></p><p class="pre indent">${esc(x.receiver||'')}</p><p><b>Nội dung:</b></p><p class="pre indent">${esc(x.detail||'')}</p><p><b>Người tiếp nhận:</b> ${esc(x.receiver||'')}</p><p><b>Ngày tiếp nhận:</b> ${esc(x.receiveDate||'')}</p><p><b>Ý kiến:</b></p><p class="pre indent">${esc(x.conclusion||'')}</p>`;const unknownBody=`<p><b>Nội dung chất lượng công trình:</b></p><p class="pre indent">${esc(x.detail||'')}</p><p><b>Kết luận / trạng thái:</b></p><p class="pre indent">${esc(x.conclusion||x.status||'')}</p>`;return `<div class="quality-document"><div class="letterhead"><div class="brand"><img class="brand-mark vicoad-print-logo" src="/assets/vicoad-logo.png" alt="Logo Vicoad"><div><b>CÔNG TY TNHH TƯ VẤN XÂY DỰNG VÀ QUẢNG CÁO VINA</b><small>Số 58 ngõ 291 phố Khương Trung, Khương Đình, Hà Nội<br>Tel: 0988355580 · Email: tuvanxdvina@gmail.com</small></div></div><div class="national"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><span>Độc lập - Tự do - Hạnh phúc</span></div></div><hr><h2>${isLetter?'ĐOÀN TƯ VẤN GIÁM SÁT<br>THƯ KỸ THUẬT':(kind==='MINUTES'?'BIÊN BẢN KIỂM TRA HIỆN TRƯỜNG':'NỘI DUNG CHẤT LƯỢNG CÔNG TRÌNH')}</h2><p class="center"><b>${esc(x.reference||x.code||'')}</b></p><div class="project-info"><p><b>Dự án / Công trình:</b> ${esc(x.projectName||project.name||'')}</p><p><b>Gói thầu:</b> ${esc(x.packageName||'')}</p><p><b>Địa điểm xây dựng:</b> ${esc(x.location||project.province||'')}</p>${x.documentDate?`<p><b>Ngày lập:</b> ${esc(x.documentDate)}</p>`:''}</div>${isLetter?letterBody:(kind==='MINUTES'?minutesBody:unknownBody)}</div>`}
function printQualityDocument(issueId){const x=db.issues.find(v=>v.id===issueId);if(!x)return;const project=db.projects.find(p=>p.id===x.projectId)||{};const w=window.open('','_blank');if(!w)return;w.document.write('<!doctype html><meta charset="utf-8"><title>'+esc(x.title||'Chất lượng công trình')+'</title><style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#111;line-height:1.45;font-size:13px}.quality-document{max-width:190mm;margin:auto}.letterhead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.brand{display:flex;gap:10px;align-items:center;max-width:58%}.brand-mark{width:58px;height:58px;object-fit:contain}.vicoad-print-logo{border:0!important}.brand small{display:block;font-size:9px;font-weight:400;margin-top:4px}.national{text-align:center;font-size:11px;max-width:40%}.national span{text-decoration:underline}.center{text-align:center}.quality-document h2{text-align:center;margin:18px 0 2px;font-size:17px}.quality-document h3{font-size:15px;margin:16px 0 8px}.quality-document h4{font-size:13px;margin:14px 0 5px}.project-info{margin:12px 0}.project-info p{margin:3px 0}.pre{white-space:pre-wrap;min-height:24px}.indent{margin-left:18px}.participants-plain{margin:4px 0 8px 18px}.subheading{margin:8px 0 3px 18px;font-weight:600}.participant-line{margin:3px 0}.muted-print{font-size:10px;color:#667085}.signature-line{height:42px;border-bottom:1px solid #667085;width:55%}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:28px}.signatures>div{text-align:center;vertical-align:top;font-size:11px;min-height:115px}.signatures b{font-size:11px}@media print{button{display:none}}</style>'+qualityLetterhead(x,project));w.document.close();const printNow=()=>{w.focus();w.print()};const logo=w.document.querySelector('img');if(logo&&!logo.complete){logo.onload=printNow;logo.onerror=printNow}else setTimeout(printNow,120)}
function closeIssue(i){let x=db.issues.find(x=>x.id===i);if(!x)return;const quality=['LETTER','MINUTES'].includes(qualityType(x));if(quality){if(!qualityCanClose(x))return alert('Chỉ người lập khi văn bản chưa đóng hoặc người được cấp quyền Sửa mới được đóng.');x.status='CLOSED'}else{if(!qualityIsManager())return alert('Chỉ quản trị hoặc giám đốc được đóng nội dung này.');x.status='CLOSED';}x.closedAt=new Date().toISOString();audit('CLOSE','issue',i,x.title);queueSync('issue',i,'UPDATE',{status:x.status,closedAt:x.closedAt});save()}
function personnelChangeRows(value){const arr=Array.isArray(value)?value:(value?[{date:'',removed:'',added:'',decision:String(value)}]:[]);return (arr.length?arr:[{date:'',removed:'',added:'',decision:''}]).map(v=>`<div class="personnel-change-row" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;margin:6px 0"><input class="pc-date" type="date" value="${esc(v.date||'')}" placeholder="Ngày"><input class="pc-removed" value="${esc(v.removed||'')}" placeholder="Người rút"><input class="pc-added" value="${esc(v.added||'')}" placeholder="Người thay thế"><input class="pc-decision" value="${esc(v.decision||'')}" placeholder="Số quyết định"><button type="button" onclick="this.parentElement.remove()">Xóa</button></div>`).join('')}
function addPersonnelChangeRow(){const box=document.getElementById('personnelChangesList');if(!box)return;const d=document.createElement('div');d.className='personnel-change-row';d.style='display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;margin:6px 0';d.innerHTML='<input class="pc-date" type="date" placeholder="Ngày"><input class="pc-removed" placeholder="Người rút"><input class="pc-added" placeholder="Người thay thế"><input class="pc-decision" placeholder="Số quyết định"><button type="button" onclick="this.parentElement.remove()">Xóa</button>';box.appendChild(d)}
// ============================================================================
// HỒ SƠ PHÁP LÝ / BÁO CÁO — lưu trên máy chủ (dùng chung mọi tài khoản được phân công)
// Tệp tải thẳng lên máy chủ (không lưu base64 trong trình duyệt → không vượt dung lượng localStorage).
// ============================================================================
const DOC_TYPES=[['HS','Hồ sơ pháp lý'],['BB','Biên bản'],['NK','Nhật ký'],['TK','Thiết kế kỹ thuật'],['TKT','Tiêu chuẩn kỹ thuật'],['BC','Báo cáo'],['KHAC','Khác']];
const DOC_STATUS={DRAFT:'Bản nháp',SUBMITTED:'Chờ duyệt',APPROVED:'Đã duyệt',LOCKED:'Đã khóa'};
const LEGAL_FILE_SLOTS=[['Hồ sơ dự thầu / HSĐX','d_hs_sdt','.pdf,.doc,.docx,.xls,.xlsx,.zip,image/*',true],['Đề cương giám sát','d_de_cuong','.pdf,.doc,.docx',true],['Biểu mẫu kèm theo đề cương giám sát','d_bieu_mau','.pdf,.doc,.docx,.xls,.xlsx,.zip',true],['Quyết định phê duyệt tổ tư vấn giám sát','d_quyet_dinh','.pdf,.doc,.docx,image/*',true],['Chứng chỉ của các thành viên tổ giám sát','d_chung_chi','.pdf,.doc,.docx,.zip,image/*',true],['Tài liệu khác','d_khac','*/*',true]];
const REPORT_FILE_SLOTS=[['Nguồn báo cáo nhà thầu','d_reportFile','.pdf,.doc,.docx,.xls,.xlsx,image/*',true],['Tài liệu khác','d_khac','*/*',true]];
const MAX_DOC_FILE=15*1024*1024;
function docTypeLabel(code){return (DOC_TYPES.find(x=>x[0]===code)||[code,code||'Tài liệu'])[1]}
function docGroup(x){return x?.group==='REPORT'?'REPORT':'LEGAL'}
function docStatusBadge(s){return '<span class="badge '+String(s||'').toLowerCase()+'">'+esc(DOC_STATUS[s]||s||'')+'</span>'}
function myPerms(pid){return canManageAssignments()?['VIEW','CREATE','EDIT','DOWNLOAD','APPROVE','DELETE']:qualityPermissions(pid)}
// Quyền Xóa theo công trình: Admin/Giám đốc luôn có; người khác chỉ khi được cấp tùy chỉnh
function canDeleteIn(pid){return myPerms(pid).includes('DELETE')}
function deleteBtn(kind,id,pid,label){return canDeleteIn(pid)&&id?' <button class="danger" onclick="event.stopPropagation();deleteContent(\''+kind+'\',\''+id+'\',\''+esc(String(label||'').replace(/'/g,'’'))+'\')" title="Chuyển vào Thùng rác (khôi phục được)">🗑 Xóa</button>':''}
// Quyền duyệt theo TỪNG CÔNG TRÌNH (Trưởng TVGS tại công trình đó) — không theo loại tài khoản
function canApproveIn(pid){return canManageAssignments()||qualityPermissions(pid).includes('APPROVE')}
// Bản đã "Trình công ty" thì chỉ Giám đốc/Admin quyết định
function docCanDecide(x){return !!x&&canApproveIn(x.projectId)&&(canManageAssignments()||x.status!=='SUBMITTED'||x.lastReview?.action!=='ESCALATE')}
function canCreateDocIn(pid){return myPerms(pid).includes('CREATE')}
function canModifyDoc(x){if(!x)return false;if(canManageAssignments())return true;if(x.serverId&&x.status&&x.status!=='DRAFT')return false;if(x.status==='LOCKED')return false;const p=myPerms(x.projectId);return p.includes('EDIT')||(x.createdById&&x.createdById===qualityAuthUserId()&&p.includes('CREATE'))}
function fileSize(n){n=Number(n||0);return n>1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB'}
// Chỉ PDF/ảnh thường được mở trực tiếp. Tệp mở bằng blob: chạy cùng nguồn với ứng dụng,
// nên HTML/SVG do người khác tải lên có thể đọc token đăng nhập → luôn tải về dạng nhị phân.
async function safeFileBlob(res){
 const t=String(res.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
 const inline=/^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(t);
 return {blob:new Blob([await res.arrayBuffer()],{type:inline?t:'application/octet-stream'}),inline};
}
// Mở/tải tệp từ máy chủ có kèm token đăng nhập
async function openServerFile(apiPath,meta,download){
 if(!apiOnline())return alert('Cần kết nối mạng để mở tệp.');
 const viewable=/^(application\/pdf|image\/)/i.test(meta?.type||'')||/\.(pdf|png|jpe?g|webp|gif)$/i.test(meta?.name||'');
 if(!viewable)download=true;
 const win=download?null:window.open('','_blank');
 try{
  const res=await fetch(API_BASE+apiPath,{headers:{Authorization:'Bearer '+getAuthToken()}});
  if(!res.ok){let m='HTTP '+res.status;try{m=(await res.json()).error||m}catch(_){}throw new Error(m)}
  const f=await safeFileBlob(res);if(!f.inline){download=true;if(win)win.close()}
  const url=URL.createObjectURL(f.blob);
  if(download||!win){const a=document.createElement('a');a.href=url;a.download=meta?.name||'tai-lieu';document.body.appendChild(a);a.click();a.remove()}else win.location.href=url;
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){if(win)win.close();alert('Không mở được tệp: '+error.message)}
}
function docFileLinks(x,{withDelete=false}={}){
 const files=x.files||[];if(!files.length)return '<span class="muted">Chưa có tệp</span>';
 const groups={};files.forEach(f=>{(groups[f.category||'Tài liệu']=groups[f.category||'Tài liệu']||[]).push(f)});
 return Object.entries(groups).map(([cat,list])=>'<div style="margin:3px 0"><b>'+esc(cat)+'</b>: '+list.map(f=>'<a href="#" onclick="openServerFile(\'/documents/'+x.id+'/files/'+f.id+'\','+esc(JSON.stringify({name:f.name,type:f.type}))+',false);return false">'+esc(f.name)+'</a> <span class="muted">('+fileSize(f.size)+')</span>'+(withDelete?' <button type="button" class="danger" style="padding:2px 6px" onclick="deleteDocFile(\''+x.id+'\',\''+f.id+'\')">✕</button>':'')).join(', ')+'</div>').join('');
}
function renderDocs(){
 const pid=document.getElementById('docProject')?.value||'';const group=document.getElementById('docGroup')?.value||'';
 const a=(db.docs||[]).filter(x=>!x.pendingUpload&&(!pid||x.projectId===pid)&&(!group||docGroup(x)===group));
 const addBtn=document.querySelector('#docs .toolbar .primary');if(addBtn)addBtn.style.display=(db.projects||[]).some(p=>canCreateDocIn(p.id))?'':'none';
 const rows=a.map(x=>{const p=db.projects.find(v=>v.id===x.projectId)||{};return '<tr><td>'+esc(x.code||'')+(x.pendingUpload?' <span class="chip warn">Chưa lên máy chủ</span>':'')+'</td><td>'+esc(p.name||'')+'</td><td>'+(docGroup(x)==='REPORT'?'Báo cáo':'Hồ sơ pháp lý')+'</td><td><b>'+esc(x.name||'')+'</b><br><span class="muted">'+esc(docTypeLabel(x.type))+'</span></td><td>'+docStatusBadge(x.status)+returnedChip(x)+'</td><td>'+esc(x.createdBy||'')+(x.updatedBy&&x.updatedBy!==x.createdBy?'<br><span class="muted">Sửa: '+esc(x.updatedBy)+'</span>':'')+'<br><span class="muted">'+esc(fmt(x.updatedAt||x.createdAt))+'</span></td><td>'+docFileLinks(x)+'</td><td><button onclick="viewDoc(\''+x.id+'\')">Xem</button>'+(canModifyDoc(x)?' <button onclick="openDoc(\''+x.id+'\')">Sửa</button>':'')+deleteBtn('doc',x.serverId,x.projectId,(x.code||'')+' '+(x.name||''))+'</td></tr>'}).join('');
 const el=document.getElementById('docsTable');if(!el)return;
 const stuck=(db.docs||[]).filter(x=>x.pendingUpload&&(!pid||x.projectId===pid));
 const stuckHtml=stuck.length?'<div class="notice" style="margin-bottom:12px;background:#fef3f2;border-color:#fecdca"><b>'+stuck.length+' hồ sơ còn nằm trên thiết bị này, chưa lên máy chủ</b> (tài khoản khác chưa thấy):<table style="margin-top:6px"><tbody>'+stuck.map(x=>'<tr><td><b>'+esc(x.code||'')+'</b> '+esc(x.name||'')+'<br><span style="color:#b42318">Lý do: '+esc(x.lastError||'chưa thử đồng bộ')+'</span></td><td style="white-space:nowrap"><button onclick="retryLegacyDocs()">Thử lại</button> <button onclick="downloadLegacyDoc(\''+x.id+'\')">Tải tệp về</button> <button class="danger" onclick="discardLegacyDoc(\''+x.id+'\')">Bỏ bản này</button></td></tr>').join('')+'</tbody></table></div>':'';
 el.innerHTML=stuckHtml+(rows?'<table><thead><tr><th>Mã</th><th>Công trình</th><th>Nhóm</th><th>Tên hồ sơ</th><th>Trạng thái</th><th>Người lập</th><th>Tài liệu</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="muted">Chưa có hồ sơ.'+(apiOnline()?'':' (Đang ngoại tuyến — danh sách lấy từ lần tải gần nhất)')+'</p>');
}
function viewDoc(docId){
 const x=db.docs.find(v=>v.id===docId);if(!x)return;if(x.details?.snapshot&&typeof viewReport==='function')return viewReport(docId);const p=db.projects.find(v=>v.id===x.projectId)||{};const d=x.details||{};const role=roleToken(qualityAuthUser()?.role_name||'');
 const lead=['ADMIN','DIRECTOR','TVGS_LEAD'].includes(role);
 const flow=[x.status==='DRAFT'&&canModifyDoc(x)?['submit','Gửi duyệt']:null,x.status==='SUBMITTED'&&docCanDecide(x)?['approve','Duyệt']:null,x.status==='SUBMITTED'&&docCanDecide(x)?['reject','Trả lại']:null,x.status==='APPROVED'&&docCanDecide(x)?['lock','Khóa hồ sơ']:null,x.status==='LOCKED'&&docCanDecide(x)?['reopen','Mở khóa (tăng phiên bản)']:null].filter(Boolean);
 const pc=Array.isArray(d.personnelChanges)?d.personnelChanges:[];
 setTimeout(()=>loadReviewHistory('documents',x.id),0);
 openModal('Xem '+(docGroup(x)==='REPORT'?'báo cáo':'hồ sơ pháp lý'),reviewBlockHtml(x)+'<div class="card"><p><b>Công trình:</b> '+esc((p.code||'')+' - '+(p.name||''))+'</p><p><b>Mã:</b> '+esc(x.code||'')+' &nbsp; <b>Loại:</b> '+esc(docTypeLabel(x.type))+'</p><p><b>Tên:</b> '+esc(x.name||'')+'</p><p><b>Phiên bản:</b> '+Number(x.version||1)+' &nbsp; <b>Trạng thái:</b> '+docStatusBadge(x.status)+'</p><p><b>Người lập:</b> '+esc(x.createdBy||'')+(x.updatedBy?' &nbsp; <b>Cập nhật cuối:</b> '+esc(x.updatedBy)+' — '+esc(fmt(x.updatedAt)):'')+'</p>'
  +(docGroup(x)==='REPORT'?'<div class="notice"><b>Báo cáo '+esc({DAILY:'ngày',WEEKLY:'tuần',MONTHLY:'tháng',FINAL:'hoàn thành'}[d.reportType]||'')+'</b> · Kỳ: '+esc(d.period||'')+' · Kế hoạch: '+(d.plannedProgress??0)+'% · Thực tế: '+(d.actualProgress??0)+'%<br>Nhân lực: '+(d.manpower??0)+' · Khối lượng: '+esc(d.volumeCompleted||'')+'</div>':'')
  +(pc.length?'<p><b>Biến động nhân sự tổ TVGS:</b></p><ol>'+pc.map(v=>'<li>'+esc(v.date||'')+' — rút: '+esc(v.removed||'')+' → thay: '+esc(v.added||'')+(v.decision?' ('+esc(v.decision)+')':'')+'</li>').join('')+'</ol>':'')
  +'<hr><h4>Tài liệu tải lên</h4>'+docFileLinks(x)+'</div><div class="toolbar">'+(canModifyDoc(x)?'<button class="primary" onclick="closeModal();openDoc(\''+x.id+'\')">Sửa hồ sơ</button>':'')+flow.map(([a,t])=>'<button onclick="docWorkflow(\''+x.id+'\',\''+a+'\')">'+t+'</button>').join('')+deleteBtn('doc',x.serverId,x.projectId,(x.code||'')+' '+(x.name||''))+'</div>');
}
async function docWorkflow(docId,action){
 if(action==='approve'||action==='reject')return openReviewDecision('documents',docId,action);
 let body={};if(action==='reopen'){const reason=prompt('Lý do mở khóa hồ sơ:');if(!reason)return;body={reason}}
 try{const r=await apiRequest('/documents/'+encodeURIComponent(docId)+'/'+action,{method:'POST',body:JSON.stringify(body)});upsertLocalDoc(mapDocumentFromApi(r));save();viewDoc(docId);if(typeof renderReports==='function')renderReports()}
 catch(error){alert('Không thực hiện được: '+error.message)}
}
function upsertLocalDoc(doc){db.docs=db.docs||[];const i=db.docs.findIndex(x=>x.id===doc.id);if(i>=0)db.docs[i]=doc;else db.docs.unshift(doc)}
function openDoc(docId=''){
 if(!apiOnline())return alert('Cần kết nối mạng để tạo/sửa hồ sơ (tệp được lưu trên máy chủ để mọi tài khoản cùng xem).');
 const x=db.docs.find(v=>v.id===docId)||{};const edit=!!docId;
 if(edit&&!canModifyDoc(x))return alert('Bạn không có quyền sửa hồ sơ này.');
 const projects=edit?(db.projects||[]).filter(p=>p.id===x.projectId):serverProjects().filter(p=>canCreateDocIn(p.id));
 if(!projects.length)return alert('Tài khoản chưa được cấp quyền "Thêm" hồ sơ ở công trình nào.');
 const d=x.details||{};const cur=document.getElementById('docProject')?.value;
 const slotHtml=(slots,cls)=>slots.map(([label,id,accept,multi])=>'<div class="full '+cls+'"><label>'+esc(label)+'</label><input id="'+id+'" data-category="'+esc(label)+'" type="file" accept="'+accept+'"'+(multi?' multiple':'')+'></div>').join('');
 openModal(edit?'Sửa hồ sơ '+(x.code||''):'Tạo hồ sơ',(edit?reviewBlockHtml(x,{history:false}):'')+'<div class="row">'
  +'<div><label>Công trình</label><select id="dproj">'+projects.map(p=>'<option value="'+p.id+'"'+((x.projectId||cur)===p.id?' selected':'')+'>'+esc(p.code)+' - '+esc(p.name)+'</option>').join('')+'</select></div>'
  +'<div><label>Nhóm hồ sơ</label><select id="dgroup" onchange="toggleReportFields()"><option value="LEGAL">Hồ sơ pháp lý</option>'+(docGroup(x)==='REPORT'?'<option value="REPORT">Báo cáo (kiểu cũ)</option>':'')+'</select><div class="muted">Báo cáo ngày/tuần/tháng lập ở mục <b>Báo cáo</b>.</div></div>'
  +'<div><label>Loại hồ sơ</label><select id="dtype">'+DOC_TYPES.map(([c,t])=>'<option value="'+c+'">'+t+'</option>').join('')+'</select></div>'
  +'<div><label>Mã hồ sơ</label><input value="'+esc(x.code||'Máy chủ tự cấp khi lưu')+'" disabled></div>'
  +'<div class="full"><label>Tên hồ sơ</label><input id="dname" maxlength="255" value="'+esc(x.name||'')+'" placeholder="Ví dụ: Hồ sơ pháp lý công trình"></div>'
  +'<div class="full report-only"><h4>Thông tin báo cáo</h4><div class="row"><div><label>Loại báo cáo</label><select id="dreportType"><option value="DAILY">Ngày</option><option value="WEEKLY">Tuần</option><option value="MONTHLY">Tháng</option><option value="FINAL">Hoàn thành</option></select></div><div><label>Kỳ báo cáo</label><input id="dperiod" type="month" value="'+esc(d.period||'')+'"></div><div><label>Tiến độ kế hoạch (%)</label><input id="dplanned" type="number" min="0" max="100" value="'+(d.plannedProgress??'')+'"></div><div><label>Tiến độ thực tế (%)</label><input id="dactual" type="number" min="0" max="100" value="'+(d.actualProgress??'')+'"></div><div><label>Nhân lực</label><input id="dmanpower" type="number" min="0" value="'+(d.manpower??'')+'"></div><div><label>Khối lượng hoàn thành</label><input id="dvolume" value="'+esc(d.volumeCompleted||'')+'"></div><div><label>Đánh giá tiến độ</label><select id="dschedule"><option value="ON_TRACK">Đúng tiến độ</option><option value="AHEAD">Nhanh hơn</option><option value="DELAYED">Chậm tiến độ</option></select></div></div><button type="button" onclick="fillReportFromLogs()">Tổng hợp từ nhật ký</button></div>'
  +'<div class="full legal-only"><label>Biến động nhân sự trong Quyết định tổ TVGS</label><div id="personnelChangesList">'+personnelChangeRows(d.personnelChanges)+'</div><button type="button" onclick="addPersonnelChangeRow()">+ Thêm lần thay đổi</button></div>'
  +slotHtml(LEGAL_FILE_SLOTS.slice(0,5),'legal-only')+slotHtml(REPORT_FILE_SLOTS.slice(0,1),'report-only')+slotHtml([LEGAL_FILE_SLOTS[5]],'')
  +'<div class="full muted">Mỗi tệp tối đa 15 MB. Tệp được lưu trên máy chủ; mọi tài khoản được phân công công trình đều xem được.</div>'
  +(edit?'<div class="full"><label>Tệp đã lưu</label><div id="docExistingFiles">'+docFileLinks(x,{withDelete:true})+'</div></div>':'')
  +'<div class="full"><button class="primary" id="docSaveBtn" onclick="saveDoc(\''+docId+'\')">'+(edit?'Lưu thay đổi':'Tạo và tải tệp lên')+'</button><div id="docMessage" class="muted" style="margin-top:6px;white-space:pre-line"></div></div></div>');
 document.getElementById('dgroup').value=docGroup(x);document.getElementById('dtype').value=x.type||'HS';
 if(d.reportType)document.getElementById('dreportType').value=d.reportType;if(d.scheduleStatus)document.getElementById('dschedule').value=d.scheduleStatus;
 toggleReportFields();
}
async function deleteDocFile(docId,fileId){
 if(!confirm('Xóa tệp này khỏi hồ sơ?'))return;
 try{await apiRequest('/documents/'+encodeURIComponent(docId)+'/files/'+encodeURIComponent(fileId),{method:'DELETE'});const r=await apiRequest('/documents/'+encodeURIComponent(docId));const doc=mapDocumentFromApi(r);upsertLocalDoc(doc);save();const box=document.getElementById('docExistingFiles');if(box)box.innerHTML=docFileLinks(doc,{withDelete:true})}
 catch(error){alert('Không xóa được: '+error.message)}
}
async function uploadDocFile(docId,file,category){
 const res=await fetch(API_BASE+'/documents/'+encodeURIComponent(docId)+'/files?category='+encodeURIComponent(category)+'&name='+encodeURIComponent(file.name),{method:'POST',headers:{Authorization:'Bearer '+getAuthToken(),'Content-Type':file.type||'application/octet-stream'},body:file});
 if(!res.ok){let m='HTTP '+res.status;try{m=(await res.json()).error||m}catch(_){}throw new Error(m)}
 return res.json();
}
async function saveDoc(docId=''){
 const msg=document.getElementById('docMessage');const btn=document.getElementById('docSaveBtn');const say=t=>{if(msg)msg.textContent=t};
 const group=document.getElementById('dgroup').value;const report=group==='REPORT';
 const name=document.getElementById('dname').value.trim();if(!name)return say('Nhập tên hồ sơ.');
 const details=report?{reportType:document.getElementById('dreportType').value,period:document.getElementById('dperiod').value,plannedProgress:Number(document.getElementById('dplanned').value||0),actualProgress:Number(document.getElementById('dactual').value||0),manpower:Number(document.getElementById('dmanpower').value||0),volumeCompleted:document.getElementById('dvolume').value.trim(),scheduleStatus:document.getElementById('dschedule').value}
  :{personnelChanges:[...document.querySelectorAll('#personnelChangesList .personnel-change-row')].map(r=>({date:r.querySelector('.pc-date')?.value||'',removed:r.querySelector('.pc-removed')?.value.trim()||'',added:r.querySelector('.pc-added')?.value.trim()||'',decision:r.querySelector('.pc-decision')?.value.trim()||''})).filter(v=>v.date||v.removed||v.added||v.decision)};
 const slots=[...document.querySelectorAll('#mbody input[type=file][data-category]')].filter(i=>i.closest('.full')?.style.display!=='none');
 const files=[];slots.forEach(i=>[...(i.files||[])].forEach(f=>files.push({file:f,category:i.dataset.category})));
 const big=files.find(f=>f.file.size>MAX_DOC_FILE);if(big)return say('Tệp "'+big.file.name+'" vượt 15 MB.');
 if(btn)btn.disabled=true;
 try{
  say('Đang lưu thông tin hồ sơ...');
  const body={project_id:document.getElementById('dproj').value,doc_group:group,type:document.getElementById('dtype').value,name,details};
  let doc=docId?await apiRequest('/documents/'+encodeURIComponent(docId),{method:'PATCH',body:JSON.stringify(body)}):await apiRequest('/documents',{method:'POST',body:JSON.stringify(body)});
  const errors=[];
  for(const [n,f] of files.entries()){say('Đang tải tệp '+(n+1)+'/'+files.length+': '+f.file.name);try{await uploadDocFile(doc.id,f.file,f.category)}catch(error){errors.push(f.file.name+': '+error.message)}}
  doc=await apiRequest('/documents/'+encodeURIComponent(doc.id));
  upsertLocalDoc(mapDocumentFromApi(doc));audit(docId?'UPDATE':'CREATE','docs',doc.id,doc.auto_code+' — '+doc.name);save();renderDocs();
  if(errors.length){say('Đã lưu hồ sơ '+doc.auto_code+' nhưng '+errors.length+' tệp lỗi:\n'+errors.join('\n'));if(btn)btn.disabled=false;return}
  closeModal();if(currentProjectId)renderProjectDetail();
 }catch(error){say('Không lưu được: '+error.message);if(btn)btn.disabled=false}
}
// Lấy hồ sơ từ máy chủ cho mọi công trình được xem; đồng thời đẩy hồ sơ cũ còn nằm trong trình duyệt lên máy chủ.
async function syncDocumentsFromApi(){
 if(!apiOnline()||typeof apiGetDocuments!=='function')return;
 await syncLegacyLocalDocs();
 const fetched=[];let failed=false;
 for(const project of serverProjects()){try{fetched.push(...await apiGetDocuments(project.id))}catch(error){failed=true;console.warn('Không tải được hồ sơ công trình:',project.id,error.message)}}
 const leftover=(db.docs||[]).filter(x=>x.pendingUpload);
 if(!failed||fetched.length)db.docs=[...fetched,...leftover];
 save();
}
const LEGACY_TYPE={'HỒ SƠ PHÁP LÝ':'HS','BIÊN BẢN':'BB','NHẬT KÝ':'NK','THIẾT KẾ THUẬT':'TK','BÁO CÁO':'BC'};
async function syncLegacyLocalDocs(){
 const queue=(db.sync||[]).filter(x=>x.type==='docs'&&x.status==='PENDING');
 const legacy=(db.docs||[]).filter(x=>(!x.serverId||x.legacyServerId)&&(queue.some(q=>q.recordId===x.id)||x.pendingUpload));
 if(!legacy.length)return;
 if(!canManageAssignments()&&!qualityPermissionCache.size)await loadQualityPermissions(true); // chờ có quyền rồi mới quyết định
 for(const x of legacy){
  x.pendingUpload=true;
  if(!serverProjects().some(p=>p.id===x.projectId)){x.lastError='Công trình của hồ sơ không có trên máy chủ hoặc tài khoản không được phân công công trình này';continue}
  if(!canCreateDocIn(x.projectId)){x.lastError='Tài khoản chưa có quyền "Thêm" hồ sơ tại công trình này';continue}
  try{
   // Bước 1: tạo hồ sơ trên máy chủ đúng 1 lần (ghi lại id để lần thử sau không tạo trùng)
   if(!x.legacyServerId){
    const created=await apiRequest('/documents',{method:'POST',body:JSON.stringify({project_id:x.projectId,doc_group:x.group==='REPORT'?'REPORT':'LEGAL',type:LEGACY_TYPE[x.type]||(x.group==='REPORT'?'BC':'HS'),name:x.name||'Hồ sơ',details:{personnelChanges:x.personnelChanges||[],reportType:x.reportType,period:x.period,plannedProgress:x.plannedProgress,actualProgress:x.actualProgress,manpower:x.manpower,volumeCompleted:x.volumeCompleted,scheduleStatus:x.scheduleStatus,legacyLocalCode:x.code}})});
    x.legacyServerId=created.id;persistLocal();
   }
   // Bước 2: tải từng tệp; tệp đã tải được đánh dấu để không tải lại
   const missing=[];
   for(const a of x.attachments||[]){
    if(a.uploaded)continue;
    if(!a?.data){missing.push(a?.name||'tệp');continue}
    const blob=await (await fetch(a.data)).blob();
    if(blob.size>MAX_DOC_FILE)throw new Error('Tệp "'+a.name+'" vượt 15 MB — hãy tải tệp về rồi nén/tách trước khi tải lại');
    await uploadDocFile(x.legacyServerId,new File([blob],a.name||'tai-lieu',{type:a.type||blob.type}),a.category||'Tài liệu');
    a.uploaded=true;delete a.data;persistLocal();
   }
   db.docs=db.docs.filter(v=>v.id!==x.id);db.sync=db.sync.filter(q=>!(q.type==='docs'&&q.recordId===x.id));
   audit('SYNC','docs',x.legacyServerId,'Đưa hồ sơ '+(x.code||'')+' lên máy chủ'+(missing.length?' (thiếu tệp đã mất trên thiết bị: '+missing.join(', ')+')':''));
   if(missing.length)alert('Hồ sơ '+(x.code||x.name)+' đã lên máy chủ nhưng '+missing.length+' tệp không còn trên thiết bị (bộ nhớ trình duyệt đã đầy trước đây): '+missing.join(', ')+'. Hãy mở hồ sơ trên máy chủ và tải lại các tệp này.');
  }catch(error){x.lastError=(/failed to fetch|networkerror|load failed/i.test(error.message)?'Mất kết nối tới máy chủ khi đang tải tệp (sẽ tự thử lại)':error.message)+(error.status===403?' — nếu tài khoản là Admin/Giám đốc thì máy chủ đang chạy mã cũ, cần khởi động lại backend':'');console.warn('Chưa đưa được hồ sơ lên máy chủ:',x.code,error.message)}
 }
 persistLocal();
}
async function retryLegacyDocs(){await loadQualityPermissions(true);await syncDocumentsFromApi();renderDocs()}
function downloadLegacyDoc(docId){const x=(db.docs||[]).find(v=>v.id===docId);(x?.attachments||[]).filter(a=>a.data).forEach(a=>{const l=document.createElement('a');l.href=a.data;l.download=a.name||'tai-lieu';document.body.appendChild(l);l.click();l.remove()});if(!(x?.attachments||[]).some(a=>a.data))alert('Hồ sơ này không còn tệp trên thiết bị.')}
function discardLegacyDoc(docId){const x=(db.docs||[]).find(v=>v.id===docId);if(!x)return;if(!confirm('Bỏ bản "'+(x.code||x.name)+'" chỉ nằm trên thiết bị này? Tệp chưa lên máy chủ sẽ mất. Nên bấm "Tải tệp về" trước.'))return;db.docs=db.docs.filter(v=>v.id!==docId);db.sync=db.sync.filter(q=>!(q.type==='docs'&&q.recordId===docId));audit('DISCARD','docs',docId,x.code||x.name);save()}
function downloadDocumentFile(docId,index){const x=db.docs.find(v=>v.id===docId);const f=x?.files?.[index];if(f)openServerFile('/documents/'+x.id+'/files/'+f.id,{name:f.name,type:f.type},true)}

// ============================================================================
// BÁO CÁO TVGS: ngày / tuần / tháng / hoàn thành
// Số liệu tổng hợp tự động từ nhật ký, văn bản chất lượng, hồ sơ, bảng tiến độ → người lập bổ sung
// nhận xét, kiến nghị → lưu thành hồ sơ nhóm "Báo cáo" (dùng chung quy trình Gửi duyệt/Duyệt/Khóa).
// ============================================================================
const REPORT_TYPES={DAILY:'Báo cáo ngày',WEEKLY:'Báo cáo tuần',MONTHLY:'Báo cáo tháng',FINAL:'Báo cáo hoàn thành'};
const REPORT_SECTIONS={
 DEFAULT:[['quality','Đánh giá chất lượng thi công'],['schedule','Đánh giá tiến độ'],['safety','An toàn lao động, vệ sinh môi trường'],['issues','Tồn tại và kiến nghị'],['next','Kế hoạch kỳ tới']],
 FINAL:[['quality','Đánh giá chất lượng công trình'],['schedule','Đánh giá tiến độ thực hiện'],['safety','An toàn lao động, vệ sinh môi trường'],['issues','Tồn tại đã/chưa khắc phục'],['conclusion','Kết luận và đề nghị nghiệm thu']]
};
let reportDraft=null;
function reportPeriodLabel(type,from,to){
 if(type==='DAILY')return 'ngày '+progressDate(from);
 if(type==='WEEKLY')return 'tuần '+progressDate(from)+' – '+progressDate(to);
 if(type==='MONTHLY'){const m=String(from).match(/^(\d{4})-(\d{2})/);return m?'tháng '+m[2]+'/'+m[1]:''}
 return progressDate(from)+' – '+progressDate(to);
}
function isReportDoc(x){return docGroup(x)==='REPORT'}
function renderReports(){
 const el=document.getElementById('reportsTable');if(!el)return;
 const sel=document.getElementById('reportProject');if(sel){const old=sel.value;sel.innerHTML='<option value="">Tất cả công trình</option>'+(db.projects||[]).map(p=>'<option value="'+p.id+'">'+esc(p.code||'')+' - '+esc(p.name||'')+'</option>').join('');sel.value=old||''}
 const pid=sel?.value||'';const type=document.getElementById('reportType')?.value||'';
 const addBtn=document.getElementById('newReportButton');if(addBtn)addBtn.style.display=(db.projects||[]).filter(p=>!p._localOnly).some(p=>canCreateDocIn(p.id))?'':'none';
 const list=(db.docs||[]).filter(x=>isReportDoc(x)&&!x.pendingUpload&&(!pid||x.projectId===pid)&&(!type||x.details?.reportType===type))
  .sort((a,b)=>String(b.details?.to||b.createdAt).localeCompare(String(a.details?.to||a.createdAt)));
 if(!list.length){el.innerHTML='<p class="muted">Chưa có báo cáo.'+(apiOnline()?'':' (Đang ngoại tuyến)')+'</p>';return}
 const role=roleToken(qualityAuthUser()?.role_name||'');const lead=['ADMIN','DIRECTOR','TVGS_LEAD'].includes(role);
 el.innerHTML='<table><thead><tr><th>Mã</th><th>Loại</th><th>Kỳ báo cáo</th><th>Công trình</th><th>Trạng thái</th><th>Người lập</th><th></th></tr></thead><tbody>'+list.map(x=>{
  const d=x.details||{};const p=db.projects.find(v=>v.id===x.projectId)||{};
  const flow=[x.status==='DRAFT'&&canModifyDoc(x)?['submit','Gửi duyệt']:null,x.status==='SUBMITTED'&&docCanDecide(x)?['approve','Duyệt']:null,x.status==='SUBMITTED'&&docCanDecide(x)?['reject','Trả lại']:null,x.status==='APPROVED'&&docCanDecide(x)?['lock','Khóa']:null].filter(Boolean);
  return '<tr><td>'+esc(x.code)+'</td><td>'+esc(REPORT_TYPES[d.reportType]||'Báo cáo')+'</td><td>'+esc(d.from?reportPeriodLabel(d.reportType,d.from,d.to):(d.period||''))+'</td><td>'+esc(p.name||'')+'</td><td>'+docStatusBadge(x.status)+returnedChip(x)+'</td><td>'+esc(x.createdBy||'')+'</td><td style="white-space:nowrap"><button onclick="viewReport(\''+x.id+'\')">Xem / In</button>'+(canModifyDoc(x)&&x.status==='DRAFT'&&d.snapshot?' <button onclick="openReport(\''+x.id+'\')">Sửa</button>':'')+flow.map(([a,t])=>' <button onclick="reportWorkflow(\''+x.id+'\',\''+a+'\')">'+t+'</button>').join('')+deleteBtn('doc',x.serverId,x.projectId,(x.code||'')+' '+(x.name||''))+'</td></tr>'}).join('')+'</tbody></table>';
}
async function reportWorkflow(id,action){await docWorkflow(id,action)}
function periodInputsHtml(type,d){
 const today=todayIso();
 if(type==='MONTHLY')return '<label>Tháng báo cáo</label><input id="rpFrom" type="month" value="'+esc((d.from||today).slice(0,7))+'">';
 if(type==='FINAL')return '<div class="row"><div><label>Từ ngày (để trống = ngày khởi công)</label><input id="rpFrom" type="date" value="'+esc(d.from||'')+'"></div><div><label>Đến ngày</label><input id="rpTo" type="date" value="'+esc(d.to||today)+'"></div></div>';
 return '<label>'+(type==='WEEKLY'?'Một ngày bất kỳ trong tuần (Thứ Hai – Chủ nhật)':'Ngày báo cáo')+'</label><input id="rpFrom" type="date" value="'+esc(d.from||today)+'">';
}
function openReport(docId=''){
 if(!apiOnline())return alert('Cần kết nối mạng để lập báo cáo (số liệu tổng hợp từ máy chủ).');
 const x=docId?db.docs.find(v=>v.id===docId):null;const d=x?.details||{};
 const projects=x?(db.projects||[]).filter(p=>p.id===x.projectId):serverProjects().filter(p=>canCreateDocIn(p.id));
 if(!projects.length)return alert('Tài khoản chưa được cấp quyền "Thêm" tại công trình nào.');
 const cur=document.getElementById('reportProject')?.value;const type=d.reportType||'WEEKLY';
 reportDraft={docId,snapshot:d.snapshot||null,sections:d.sections||{}};
 openModal(x?'Sửa '+(REPORT_TYPES[type]||'báo cáo')+' '+x.code:'Lập báo cáo',
  (x?reviewBlockHtml(x,{history:false}):'')+'<div class="row"><div><label>Công trình</label><select id="rpProject"'+(x?' disabled':'')+'>'+projects.map(p=>'<option value="'+p.id+'"'+((x?.projectId||cur)===p.id?' selected':'')+'>'+esc(p.code)+' - '+esc(p.name)+'</option>').join('')+'</select></div>'
  +'<div><label>Loại báo cáo</label><select id="rpType"'+(x?' disabled':'')+' onchange="document.getElementById(\'rpPeriod\').innerHTML=periodInputsHtml(this.value,{});reportDraft.snapshot=null;renderReportEditor()">'+Object.entries(REPORT_TYPES).map(([k,t])=>'<option value="'+k+'"'+(k===type?' selected':'')+'>'+t+'</option>').join('')+'</select></div>'
  +'<div class="full" id="rpPeriod">'+periodInputsHtml(type,d)+'</div>'
  +'<div class="full"><button type="button" class="primary" onclick="compileReport()">Tổng hợp số liệu</button> <span class="muted">Số liệu lấy từ nhật ký, văn bản chất lượng, hồ sơ và bảng tiến độ trên máy chủ.</span></div></div>'
  +'<div id="rpEditor" style="margin-top:12px"></div><div id="rpMessage" class="muted" style="white-space:pre-line"></div>');
 document.querySelector('#modal .modalbox')?.classList.add('wide');
 renderReportEditor();
}
async function compileReport(){
 const msg=document.getElementById('rpMessage');const pid=document.getElementById('rpProject').value;const type=document.getElementById('rpType').value;
 let from=document.getElementById('rpFrom')?.value||'';const to=document.getElementById('rpTo')?.value||'';
 if(type!=='FINAL'&&!from){msg.textContent='Chọn kỳ báo cáo.';return}
 try{msg.textContent='Đang tổng hợp...';
  const snap=await apiRequest('/reports/compile?project_id='+encodeURIComponent(pid)+'&type='+type+'&from='+encodeURIComponent(from)+(to?'&to='+encodeURIComponent(to):''));
  readReportSections();reportDraft.snapshot=snap;msg.textContent='';
  const dup=(db.docs||[]).find(x=>isReportDoc(x)&&x.id!==reportDraft.docId&&x.projectId===pid&&x.details?.reportType===type&&x.details?.from===snap.period.from&&x.details?.to===snap.period.to);
  if(dup)msg.textContent='Lưu ý: đã có '+REPORT_TYPES[type].toLowerCase()+' cùng kỳ ('+dup.code+').';
  renderReportEditor();
 }catch(error){msg.textContent='Không tổng hợp được: '+error.message}
}
function readReportSections(){document.querySelectorAll('#rpEditor textarea[data-sec]').forEach(t=>{reportDraft.sections[t.dataset.sec]=t.value})}
function renderReportEditor(){
 const box=document.getElementById('rpEditor');if(!box||!reportDraft)return;const s=reportDraft.snapshot;
 if(!s){box.innerHTML='<p class="muted">Chọn kỳ rồi bấm "Tổng hợp số liệu".</p>';return}
 const secs=REPORT_SECTIONS[s.type==='FINAL'?'FINAL':'DEFAULT'];
 box.innerHTML='<div class="card" style="max-height:45vh;overflow:auto">'+reportBodyHtml(s,{})+'</div>'
  +'<h4 style="margin:14px 0 6px">Nhận xét của Tư vấn giám sát</h4>'
  +secs.map(([k,t],i)=>'<label>'+(i+1)+'. '+esc(t)+'</label><textarea rows="3" data-sec="'+k+'" placeholder="'+esc(suggestSection(k,s))+'">'+esc(reportDraft.sections[k]||'')+'</textarea>').join('')
  +reportProgressInputHtml(s)
  +'<label>Tài liệu đính kèm (tùy chọn, mỗi tệp ≤ 15 MB)</label><input id="rpFiles" type="file" multiple>'
  +'<div class="toolbar"><button class="primary" id="rpSave" onclick="saveReport(false)">Lưu nháp</button><button onclick="saveReport(true)">Lưu và gửi duyệt</button></div>';
}
function suggestSection(k,s){
 const p=s.progress;
 if(k==='schedule'&&p)return 'Gợi ý: Kế hoạch lũy kế '+p.planned_percent+'%, thực tế '+p.actual_percent+'% ('+(p.variance>=0?'+':'')+p.variance+' điểm %).'+(p.late_items.length?' Hạng mục chậm: '+p.late_items.map(i=>i.name).join(', ')+'.':'');
 if(k==='issues'&&s.issues.open_total)return 'Gợi ý: còn '+s.issues.open_total+' nội dung chất lượng chưa đóng.';
 if(k==='quality')return 'Nhận xét về vật liệu, công tác nghiệm thu, biên bản kiểm tra trong kỳ...';
 return '';
}
async function saveReport(submit){
 const s=reportDraft?.snapshot;const msg=document.getElementById('rpMessage');if(!s){msg.textContent='Chưa tổng hợp số liệu.';return}
 readReportSections();
 const pid=document.getElementById('rpProject').value;const type=s.type;
 const name=REPORT_TYPES[type]+' '+reportPeriodLabel(type,s.period.from,s.period.to);
 const files=[...(document.getElementById('rpFiles')?.files||[])];if(files.some(f=>f.size>MAX_DOC_FILE)){msg.textContent='Có tệp vượt 15 MB.';return}
 const body={project_id:pid,doc_group:'REPORT',type:'BC',name,details:{reportType:type,from:s.period.from,to:s.period.to,snapshot:s,sections:reportDraft.sections}};
 const btn=document.getElementById('rpSave');if(btn)btn.disabled=true;
 try{
  // Nhập/điều chỉnh % thực tế trong báo cáo → ghi vào bảng tiến độ tại ngày so sánh, rồi tổng hợp lại số liệu
  const manual=collectReportActuals();
  if(manual&&manual.length){
   msg.textContent='Đang cập nhật tiến độ thực tế ('+manual.length+' hạng mục)...';
   await apiRequest('/projects/'+encodeURIComponent(pid)+'/progress-plans/'+encodeURIComponent(s.progress.plan_id)+'/actuals',{method:'POST',body:JSON.stringify({report_date:s.progress.as_of,rows:manual})});
   const snap=await apiRequest('/reports/compile?project_id='+encodeURIComponent(pid)+'&type='+s.type+'&from='+encodeURIComponent(s.period.from)+(s.type==='FINAL'?'&to='+encodeURIComponent(s.period.to):''));
   reportDraft.snapshot=snap;body.details.snapshot=snap;
  }
  msg.textContent='Đang lưu...';
  let doc=reportDraft.docId?await apiRequest('/documents/'+encodeURIComponent(reportDraft.docId),{method:'PATCH',body:JSON.stringify(body)}):await apiRequest('/documents',{method:'POST',body:JSON.stringify(body)});
  for(const f of files){msg.textContent='Đang tải tệp '+f.name;await uploadDocFile(doc.id,f,'Tài liệu kèm báo cáo')}
  if(submit)doc=await apiRequest('/documents/'+encodeURIComponent(doc.id)+'/submit',{method:'POST',body:'{}'});
  doc=await apiRequest('/documents/'+encodeURIComponent(doc.id));
  upsertLocalDoc(mapDocumentFromApi(doc));audit(reportDraft.docId?'UPDATE':'CREATE','report',doc.id,doc.auto_code+' — '+name);save();
  closeModal();reportDraft=null;renderReports();
 }catch(error){msg.textContent='Không lưu được: '+error.message;if(btn)btn.disabled=false}
}
function sumByDay(logs){const m={};logs.forEach(l=>{const x=m[l.date]=m[l.date]||{date:l.date,shifts:[],work:[],workers:0,machines:0,weather:[]};x.shifts.push(shiftLabel(l.shift));if(l.work)x.work.push(l.work);if(l.weather)x.weather.push(l.weather);x.workers+=Number(l.workers||0);x.machines+=Number(l.machines||0)});return Object.values(m)}
function reportBodyHtml(s,{sections,code,title}={}){
 const P=s.project||{},st=s.stats||{},pr=s.progress,iss=s.issues||{opened:[],closed:[],open_total:0};
 const t=(rows,head)=>rows.length?'<table class="rp"><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>':'<p class="muted">Không có.</p>';
 const td=v=>'<td>'+esc(v??'')+'</td>';
 let exec='';
 if(s.type==='DAILY')exec=t(s.logs.map(l=>'<tr>'+td(shiftLabel(l.shift))+td(l.work)+td(l.weather)+td(l.workers)+td(l.machines)+td(l.note)+td(l.created_by)+'</tr>'),['Ca','Công việc thực hiện','Thời tiết','Nhân lực','Máy','Ghi chú','Người lập']);
 else if(s.type==='FINAL'){const m={};s.logs.forEach(l=>{const k=l.date.slice(0,7);const x=m[k]=m[k]||{days:new Set(),n:0,w:0};x.days.add(l.date);x.n++;x.w+=Number(l.workers||0)});exec=t(Object.entries(m).map(([k,x])=>'<tr>'+td(k.slice(5)+'/'+k.slice(0,4))+td(x.days.size)+td(x.n)+td(Math.round(x.w/Math.max(1,x.days.size)))+'</tr>'),['Tháng','Số ngày có nhật ký','Số nhật ký','Nhân lực TB/ngày'])}
 else exec=t(sumByDay(s.logs).map(x=>'<tr>'+td(progressDate(x.date))+td(x.shifts.join(', '))+td(x.work.join('; '))+td(x.weather.join(', '))+td(x.workers)+td(x.machines)+'</tr>'),['Ngày','Ca','Công việc thực hiện','Thời tiết','Nhân lực','Máy']);
 const secs=REPORT_SECTIONS[s.type==='FINAL'?'FINAL':'DEFAULT'];
 return (title?'<h2 class="rp-title">'+esc(title)+'</h2>'+(code?'<p class="center"><b>Số: '+esc(code)+'</b></p>':''):'')
  +'<h3>I. Thông tin chung</h3><table class="rp kv"><tbody>'
  +[['Công trình',(P.code?P.code+' - ':'')+(P.name||'')],['Địa điểm',P.location],['Chủ đầu tư',P.owner],['Nhà thầu thi công',P.contractor],['Hợp đồng TVGS số',P.contract_no+(P.contract_date?' ngày '+progressDate(P.contract_date):'')],['Thời gian thực hiện',(P.start_date?progressDate(P.start_date):'—')+' → '+(P.end_date?progressDate(P.end_date):'—')],['Kỳ báo cáo',reportPeriodLabel(s.type,s.period.from,s.period.to)]].map(([k,v])=>'<tr><th style="width:30%">'+k+'</th><td>'+esc(v||'—')+'</td></tr>').join('')+'</tbody></table>'
  +'<h3>II. Tình hình thi công trong kỳ</h3><p>Số nhật ký: <b>'+st.log_count+'</b> · Số ngày có nhật ký: <b>'+st.days_with_logs+'/'+st.days_in_period+'</b> · Nhân lực bình quân: <b>'+st.workers_avg+'</b> người/ngày (cao nhất '+st.workers_max+') · Máy bình quân: <b>'+st.machines_avg+'</b> · Ảnh hiện trường: <b>'+st.photos+'</b></p>'
  +(st.missing_days?.length?'<p style="color:#b54708">Ngày chưa có nhật ký: '+st.missing_days.map(progressDate).join(', ')+'</p>':'')
  +(st.by_status?.DRAFT||st.by_status?.SUBMITTED?'<p style="color:#b54708">Nhật ký chưa được duyệt trong kỳ: '+((st.by_status.DRAFT||0)+(st.by_status.SUBMITTED||0))+'</p>':'')
  +exec
  +'<h3>III. Tiến độ</h3>'+(pr?'<p>Bảng tiến độ: <b>'+esc(pr.plan_name)+'</b>'+(pr.is_extension&&pr.revised_end_date?' (gia hạn đến '+progressDate(pr.revised_end_date)+')':'')+'</p><table class="rp"><thead><tr><th>Kế hoạch lũy kế</th><th>Thực tế lũy kế</th><th>Chênh lệch</th><th>SPI</th>'+(pr.period_actual_gain!==null?'<th>KH tăng trong kỳ</th><th>TT tăng trong kỳ</th>':'')+'</tr></thead><tbody><tr>'+td(pr.planned_percent+'%')+td(pr.actual_percent+'%')+td((pr.variance>0?'+':'')+pr.variance+' điểm %')+td(pr.spi??'—')+(pr.period_actual_gain!==null?td(pr.period_planned_gain+'%')+td(pr.period_actual_gain+'%'):'')+'</tr></tbody></table>'+(pr.mode!=='ITEMS'?'<p class="muted">Bảng tiến độ chưa có hạng mục: tỷ lệ là số nhập tay.</p>':'')+(pr.late_items.length?'<p><b>Hạng mục chậm/quá hạn:</b></p>'+t(pr.late_items.map(i=>'<tr>'+td(i.name)+td(i.planned+'%')+td(i.actual+'%')+td(progressDate(i.end_date))+'</tr>'),['Hạng mục','KH','TT','Hạn']):''):'<p class="muted">Chưa có bảng tiến độ.</p>')
  +reportItemsTableHtml(s)
  +'<h3>IV. Chất lượng công trình</h3><p>Văn bản/biên bản chất lượng phát sinh trong kỳ: <b>'+iss.opened.length+'</b> · Đã đóng trong kỳ: <b>'+iss.closed.length+'</b> · Còn tồn tại đến cuối kỳ: <b>'+iss.open_total+'</b></p>'
  +(iss.opened.length?t(iss.opened.map(i=>'<tr>'+td(i.issue_code)+td(i.title)+td(progressDate(i.created))+td(i.status==='RESOLVED'?'Đã đóng':'Đang xử lý')+'</tr>'),['Mã','Nội dung','Ngày','Trạng thái']):'')
  +'<h3>V. Hồ sơ phát sinh trong kỳ</h3>'+t((s.documents||[]).map(d=>'<tr>'+td(d.auto_code)+td(d.name)+td(DOC_STATUS[d.status]||d.status)+'</tr>'),['Mã','Tên hồ sơ','Trạng thái'])
  +reportAlertsHtml(s)
  +(sections?'<h3>VI. Nhận xét, đánh giá của Tư vấn giám sát</h3>'+secs.map(([k,tt],i)=>'<p><b>'+(i+1)+'. '+esc(tt)+':</b></p><p class="pre">'+esc(sections[k]||'—')+'</p>').join(''):'');
}
function viewReport(docId){
 const x=db.docs.find(v=>v.id===docId);if(!x)return;const d=x.details||{};
 if(!d.snapshot)return viewDoc(docId); // báo cáo kiểu cũ
 const role=roleToken(qualityAuthUser()?.role_name||'');const lead=['ADMIN','DIRECTOR','TVGS_LEAD'].includes(role);
 const flow=[x.status==='DRAFT'&&canModifyDoc(x)?['submit','Gửi duyệt']:null,x.status==='SUBMITTED'&&docCanDecide(x)?['approve','Duyệt']:null,x.status==='SUBMITTED'&&docCanDecide(x)?['reject','Trả lại']:null,x.status==='APPROVED'&&docCanDecide(x)?['lock','Khóa']:null].filter(Boolean);
 setTimeout(()=>loadReviewHistory('documents',x.id),0);
 openModal(x.name,reviewBlockHtml(x)+'<div class="card">'+reportBodyHtml(d.snapshot,{sections:d.sections||{}})+'<hr><p class="muted">Trạng thái: '+docStatusBadge(x.status)+' · Người lập: '+esc(x.createdBy)+' · Số liệu chốt lúc '+esc(fmt(d.snapshot.generated_at))+'</p>'+((x.files||[]).length?'<h4>Tài liệu đính kèm</h4>'+docFileLinks(x):'')+'</div><div class="toolbar"><button class="primary" onclick="printReport(\''+x.id+'\')">In / Xuất PDF</button>'+(canModifyDoc(x)&&x.status==='DRAFT'?'<button onclick="closeModal();openReport(\''+x.id+'\')">Sửa</button>':'')+flow.map(([a,t])=>'<button onclick="reportWorkflow(\''+x.id+'\',\''+a+'\')">'+t+'</button>').join('')+deleteBtn('doc',x.serverId,x.projectId,(x.code||'')+' '+(x.name||''))+'</div>');
 document.querySelector('#modal .modalbox')?.classList.add('wide');
}
function printReport(docId){
 const x=db.docs.find(v=>v.id===docId);if(!x?.details?.snapshot)return;const d=x.details;const w=window.open('','_blank');if(!w)return alert('Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên.');
 const title='BÁO CÁO TƯ VẤN GIÁM SÁT'+({DAILY:' NGÀY',WEEKLY:' TUẦN',MONTHLY:' THÁNG',FINAL:' HOÀN THÀNH'}[d.reportType]||'');
 w.document.write('<!doctype html><meta charset="utf-8"><title>'+esc(x.name)+'</title><style>@page{size:A4;margin:15mm}body{font-family:"Times New Roman",serif;font-size:13px;color:#111;line-height:1.4}.letterhead{display:flex;justify-content:space-between;gap:16px}.brand{display:flex;gap:10px;align-items:center;max-width:58%}.brand img{width:56px;height:56px;object-fit:contain}.brand small{display:block;font-size:9px}.national{text-align:center;font-size:11px}.national span{text-decoration:underline}.rp-title{text-align:center;font-size:17px;margin:16px 0 2px}.center{text-align:center}h3{font-size:14px;margin:14px 0 6px}table.rp{width:100%;border-collapse:collapse;margin:4px 0 8px}table.rp th,table.rp td{border:1px solid #666;padding:4px 6px;font-size:12px;text-align:left;vertical-align:top}table.rp th{background:#f2f2f2}.pre{white-space:pre-wrap;margin:2px 0 8px 14px}.muted{color:#666}.signs{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;margin-top:28px;font-size:12px}.signs div{min-height:110px}</style>'
  +'<div class="letterhead"><div class="brand"><img src="'+location.origin+'/assets/vicoad-logo.png" alt=""><div><b>CÔNG TY TNHH TƯ VẤN XÂY DỰNG VÀ QUẢNG CÁO VINA</b><small>Số 58 ngõ 291 phố Khương Trung, Khương Đình, Hà Nội · Tel: 0988355580</small></div></div><div class="national"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><span>Độc lập - Tự do - Hạnh phúc</span></div></div><hr>'
  +reportBodyHtml(d.snapshot,{sections:d.sections||{},code:x.code,title})
  +'<div class="signs"><div><b>NGƯỜI LẬP</b><br>(Ký, ghi rõ họ tên)<br><br><br><br>'+esc(x.createdBy||'')+'</div><div><b>TƯ VẤN GIÁM SÁT TRƯỞNG</b><br>(Ký, ghi rõ họ tên)</div><div><b>GIÁM ĐỐC</b><br>(Ký tên, đóng dấu)</div></div>');
 w.document.close();setTimeout(()=>{w.focus();w.print()},400);
}

function toggleReportFields(){const report=document.getElementById('dgroup')?.value==='REPORT';document.querySelectorAll('.report-only').forEach(e=>e.style.display=report?'':'none');document.querySelectorAll('.legal-only').forEach(e=>e.style.display=report?'none':'')}
function fillReportFromLogs(){const pid=document.getElementById('dproj')?.value||'';const logs=db.logs.filter(x=>x.projectId===pid);if(!logs.length)return alert('Chưa có nhật ký để tổng hợp.');const latest=logs.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];const avg=logs.reduce((n,x)=>n+Number(x.workers||0),0)/logs.length;const planned=Number(document.getElementById('dplanned')?.value||0);const actual=Number(latest.progress||0);document.getElementById('dactual').value=actual;document.getElementById('dmanpower').value=Math.round(avg);document.getElementById('dschedule').value=actual>planned?'AHEAD':(actual<planned?'DELAYED':'ON_TRACK')}
function seed(){
if(db.projects.length)return alert('Đã có dữ liệu.');
let p1={id:id(),code:'CT-2026-001',name:'Công trình mẫu Hà Nội',province:'Hà Nội',client:'Chủ đầu tư A',address:'Hà Nội',progress:62,status:'ĐANG THI CÔNG',
contractNo:'HĐ-TVGS-2026-001',contractDate:'2026-01-15',contractValue:2500000000,contractContent:'Giám sát thi công phần móng và thân nhà cao tầng. Thời hạn 18 tháng. Bao gồm giám sát chất lượng, an toàn, tiến độ.'};
let p2={id:id(),code:'CT-2026-002',name:'Công trình mẫu Phú Yên',province:'Phú Yên',client:'Chủ đầu tư B',address:'Phú Yên',progress:48,status:'ĐANG THI CÔNG',
contractNo:'HĐ-TVGS-2026-002',contractDate:'2026-03-01',contractValue:1800000000,contractContent:'Giám sát hạ tầng giao thông và hệ thống thoát nước.'};
p1.createdAt=p2.createdAt=new Date().toISOString(); db.projects.push(p1,p2);
db.people.push({id:id(),name:'Nguyễn Văn A',role:'Trưởng TVGS',certs:'CCGS',projectId:p1.id},{id:id(),name:'Trần Văn B',role:'Kỹ sư TVGS',certs:'',projectId:p1.id});
db.logs.push({id:id(),projectId:p1.id,date:new Date().toISOString().slice(0,10),work:'Thi công bê tông móng M1',workers:35,machines:8,progress:62,note:'Bình thường',photos:[],status:'ĐÃ KIỂM TRA',version:1,createdBy:'Trưởng TVGS'});
db.issues.push({id:id(),code:'VĐ-2026-0001',projectId:p1.id,title:'Chậm cung cấp vật liệu',detail:'Nhà thầu cần bổ sung kế hoạch cung ứng.',priority:'CAO',due:'2026-09-17',status:'ĐANG XỬ LÝ'});
db.docs.push({id:id(),code:'HS-2026-0001',projectId:p1.id,type:'BÁO CÁO',name:'Báo cáo tuần mẫu',version:1,status:'ĐÃ KHÓA',createdBy:'Trưởng TVGS'});
audit('SEED','system','', 'Dữ liệu mẫu');
save();
}
function exportJSON(){let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vina-supervision-backup.json';a.click()}
function clearAll(){if(confirm('Xóa toàn bộ dữ liệu cục bộ?')){localStorage.removeItem(KEY);location.reload()}}
function updateNet(){let el=document.getElementById('net');el.textContent=navigator.onLine?'● ONLINE':'● OFFLINE';el.style.background=navigator.onLine?'#027a48':'#b54708'}
window.addEventListener('online',async()=>{updateNet();if(db.sync.length){audit('SYNC','system','',db.sync.length+' mục chờ đồng bộ');save();if(window.syncPendingProjects)await window.syncPendingProjects();if(window.syncPendingDailyLogs)await window.syncPendingDailyLogs();}});window.addEventListener('offline',updateNet);
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{if(b.dataset.page==='settings'&&!canManageAssignments())return;currentProjectId=null;document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById(b.dataset.page).classList.add('active');renderAll();if(b.dataset.page==='people'){void loadProjectTeamDirectory()}if(b.dataset.page==='settings'){void loadSettingsProjects()}if(b.dataset.page==='docs'||b.dataset.page==='reports'){void syncDocumentsFromApi().then(()=>{if(typeof renderReports==='function')renderReports()})}});
renderAll();
qualitySelfCheck();
