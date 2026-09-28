
async function syncDailyLogsFromApi(){
  if(!navigator.onLine || typeof apiGetDailyLogs!=='function' || !getAuthToken()) return;

  try{
    // Lấy lại danh sách công trình từ PostgreSQL để làm nguồn chuẩn.
    if(typeof apiGetProjects==='function'){
      const remoteProjects = await apiGetProjects();
      if(Array.isArray(remoteProjects)){
        mergeProjectsFromServer(remoteProjects);
      }
    }

    const projects = Array.isArray(db.projects) ? db.projects : [];
    let added = 0;
    let updated = 0;

    for(const project of projects){
      if(!project?.id) continue;

      try{
        const remoteLogs = await apiGetDailyLogs(project.id);

        for(const remoteLog of remoteLogs){
          const serverId = remoteLog.id;

          const localIndex = db.logs.findIndex(
            x => x.serverId===serverId || x.id===serverId
          );

          const normalized = {
            ...remoteLog,
            serverId
          };

          if(localIndex >= 0){
            const localId = db.logs[localIndex].id;

            db.logs[localIndex] = {
              ...db.logs[localIndex],
              ...normalized,
              id: localId,
              serverId
            };

            updated++;
          }else{
            db.logs.push(normalized);
            added++;
          }
        }
      }catch(error){
        console.warn(
          'VINA-SUPERVISION: Không đồng bộ nhật ký công trình',
          project.id,
          error.message
        );
      }
    }

    persistLocal();
    renderAll();

    console.log(
      'VINA-SUPERVISION: Đồng bộ nhật ký PostgreSQL:',
      {added, updated, total: db.logs.length}
    );
  }catch(error){
    console.warn(
      'VINA-SUPERVISION: Không đồng bộ được nhật ký PostgreSQL:',
      error.message
    );
  }
}

window.syncDailyLogsFromApi = syncDailyLogsFromApi;

async function showLogPhotos(logId){
  const log=db.logs.find(x=>x.id===logId);
  if(!log)return;
  openModal('Ảnh hiện trường','<p id="photoGallery" class="muted">Đang tải ảnh...</p>');
  let photos=(log.photos||[]).filter(x=>x.data);
  if(navigator.onLine && getAuthToken() && (log.serverId||log.id)){
    try{
      const serverId=log.serverId||log.id;
      const files=await apiRequest('/daily-logs/'+encodeURIComponent(serverId)+'/attachments');
      photos=[];
      for(const file of files){
        const image=await apiRequest('/daily-logs/'+encodeURIComponent(serverId)+'/attachments/'+encodeURIComponent(file.id));
        photos.push({name:file.file_name,data:image.data_url});
      }
    }catch(error){console.warn('Không tải được ảnh từ máy chủ:',error.message)}
  }
  const gallery=document.getElementById('photoGallery');
  if(gallery)gallery.innerHTML=photos.length
    ? photos.map(p=>`<div><img class="photo" src="${p.data}" alt="${esc(p.name)}"><div class="muted">${esc(p.name)}</div></div>`).join('')
    : 'Nhật ký này chưa có ảnh.';
}

// ============================================================================
// NHÂN SỰ & QUYỀN THEO CÔNG TRÌNH — một nguồn dữ liệu duy nhất
// Máy chủ trả danh sách hợp nhất /project-personnel/project/:id/team
// (mỗi người MỘT dòng; tài khoản liên kết bằng user_id, không ghép theo tên).
// ============================================================================
const PERM_LABELS={VIEW:'Xem',CREATE:'Thêm',EDIT:'Sửa',DOWNLOAD:'Tải xuống / in',APPROVE:'Duyệt',DELETE:'Xóa'};
const PERM_ORDER=['VIEW','CREATE','EDIT','DOWNLOAD','APPROVE','DELETE'];
// Quyền mặc định của TVGS trưởng tại công trình — KHÔNG gồm Xóa (Xóa chỉ cấp bằng Tùy chỉnh)
const LEAD_DEFAULT_PERMS=['VIEW','CREATE','EDIT','DOWNLOAD','APPROVE'];
// Phải khớp backend/src/services/permissionService.js (isLeadTitle / effective)
function isLeadTitle(title){const t=String(title||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();if(!t||/\bpho\b/.test(t))return false;return /\btruong\b/.test(t)&&/(tvgs|giam sat)/.test(t)}
function defaultPermsFor(roleName,title){
 if(['ADMIN','DIRECTOR'].includes(roleName))return PERM_ORDER;
 if(roleName!=='MANAGER'&&String(title||'').trim())return isLeadTitle(title)?LEAD_DEFAULT_PERMS:['VIEW','CREATE','DOWNLOAD'];
 if(roleName==='TVGS_LEAD')return LEAD_DEFAULT_PERMS;
 return ROLE_DEFAULT_PERMS[roleName]||['VIEW'];
}
const ROLE_LABELS={ADMIN:'Admin',DIRECTOR:'Giám đốc',MANAGER:'Quản lý (giúp việc GĐ)',TVGS_LEAD:'Trưởng TVGS',ENGINEER:'TVGS'};
const ACCOUNT_TYPES=['TVGS_LEAD','ENGINEER','MANAGER','DIRECTOR','ADMIN'];
// Phải khớp backend/src/services/permissionService.js
const ROLE_DEFAULT_PERMS={ADMIN:PERM_ORDER,DIRECTOR:PERM_ORDER,MANAGER:['VIEW','DOWNLOAD'],TVGS_LEAD:['VIEW','CREATE','EDIT','DOWNLOAD'],ENGINEER:['VIEW','CREATE','DOWNLOAD']};
const TITLE_OPTIONS=['TVGS trưởng','GS viên','GS hiện trường','Kỹ sư TVGS','Phụ trách hồ sơ','An toàn lao động','Khác'];
let assignmentUsers=[];
let teamRowsByProject={};
let teamErrorByProject={};
function cleanPersonName(v){return String(v||'').normalize('NFC').replace(/\s+/g,' ').trim()}
function serverProjects(){return (db.projects||[]).filter(p=>!p._localOnly)}
function projectLabel(p){return (p.code?p.code+' - ':'')+(p.name||'')}
function permChips(list,source){
 if(!list||!list.length)return '<span class="muted">—</span>';
 const chips=PERM_ORDER.filter(k=>list.includes(k)).map(k=>'<span class="chip">'+esc(PERM_LABELS[k])+'</span>').join(' ');
 const tag=source==='ROLE_DEFAULT'?' <span class="muted">(mặc định theo chức danh)</span>':source==='GLOBAL_ROLE'?' <span class="muted">(toàn quyền)</span>':'';
 return chips+tag;
}
function accountCell(r,pid){
 if(!canManageAssignments()&&!r.is_me)return r.account_status==='LINKED'?'<span class="muted">Có tài khoản</span>':'<span class="muted">—</span>';
 if(r.account_status==='PENDING_SYNC')return '<span class="chip warn">Chờ đồng bộ</span>';
 if(r.account_status==='LINKED')return esc(r.username)+' <span class="muted">· '+esc(ROLE_LABELS[r.role_name]||r.role_name)+'</span>'+(r.account_name&&cleanPersonName(r.account_name).toLocaleLowerCase('vi')!==cleanPersonName(r.full_name).toLocaleLowerCase('vi')?' <button type="button" class="chip danger" style="border:0;cursor:pointer" title="Họ tên của tài khoản là '+esc(r.account_name)+', khác tên nhân sự. Bấm để sửa." onclick="event.stopPropagation();openAccountFix(\''+encodeURIComponent(r.key)+'\',\''+esc(pid||'')+'\')">⚠ Tài khoản mang tên '+esc(r.account_name)+' — bấm để sửa</button>':'');
 if(r.account_status==='LINKED_NO_ACCESS')return esc(r.username||'')+' <span class="chip warn">Đã thu hồi quyền</span>';
 return '<span class="muted">Không có tài khoản</span>';
}
async function syncProjectPersonnel(projectId){
 if(!projectId||!canManageAssignments()||typeof getAuthToken!=='function'||!getAuthToken()||!navigator.onLine)return;
 const project=(db.projects||[]).find(p=>p.id===projectId);if(!project||project._localOnly)return;
 const pending=(db.people||[]).filter(x=>projectMatchesPerson(x,project)&&x.name&&x.role&&!x.syncedAt);
 let changed=false;
 for(const person of pending){
  try{
   await apiRequest('/project-personnel',{method:'POST',body:JSON.stringify({project_id:projectId,full_name:cleanPersonName(person.name),assignment_title:person.role,certificate:person.certs||''})});
   db.people=db.people.filter(x=>x.id!==person.id);changed=true; // đã lên máy chủ: máy chủ là nguồn chuẩn
  }catch(error){person.lastError=error.message;console.warn('Chưa đồng bộ được nhân sự công trình:',error.message)}
 }
 if(changed)persistLocal();
}
async function fetchTeam(pid,{sync=true}={}){
 const project=(db.projects||[]).find(p=>p.id===pid)||{};
 const pending=(db.people||[]).filter(x=>projectMatchesPerson(x,project)&&!x.syncedAt).map(x=>({key:'l:'+x.id,localId:x.id,full_name:cleanPersonName(x.name),assignment_title:x.role||'',certificate:x.certs||'',account_status:'PENDING_SYNC',access_permissions:[],permission_source:'NONE'}));
 let rows=null;
 if(navigator.onLine&&typeof getAuthToken==='function'&&getAuthToken()&&!project._localOnly){
  try{
   if(sync)await syncProjectPersonnel(pid);
   rows=await apiRequest('/project-personnel/project/'+encodeURIComponent(pid)+'/team');
   delete teamErrorByProject[pid];
   db.teamCache=db.teamCache||{};db.teamCache[pid]={at:new Date().toISOString(),rows};persistLocal();
  }catch(error){teamErrorByProject[pid]=error.message;console.warn('Không tải được danh sách nhân sự:',error.message)}
 }
 if(!rows)rows=db.teamCache?.[pid]?.rows||[];
 const stillPending=pending.filter(l=>!rows.some(r=>cleanPersonName(r.full_name).toLocaleLowerCase('vi')===l.full_name.toLocaleLowerCase('vi')));
 const all=[...rows,...stillPending].sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'vi'));
 teamRowsByProject[pid]=all;
 return all;
}
function teamTableHtml(allRows,pid,{compact=false}={}){
 const mgr=allRows.filter(r=>r.role_name==='MANAGER'&&!r.personnel_id);const rows=allRows.filter(r=>!mgr.includes(r));
 if(!rows.length&&!mgr.length)return '<p class="muted">Chưa có nhân sự được phân công.</p>';
 const mgrHtml=mgr.length?'<h4 style="margin:14px 0 6px">Cấp quản lý theo dõi công trình</h4><table><tbody>'+mgr.map(r=>'<tr class="clickable" onclick="openTeamMember(\''+encodeURIComponent(r.key)+'\',\''+pid+'\')"><td><b>'+esc(r.full_name)+'</b></td><td>'+accountCell(r,pid)+'</td><td>'+permChips(r.access_permissions,r.permission_source)+'</td></tr>').join('')+'</tbody></table>':'';
 if(!rows.length)return '<p class="muted">Chưa có nhân sự TVGS.</p>'+mgrHtml;
 const head=compact?'<tr><th>Nhân sự</th><th>Chức danh tại công trình</th><th>Tài khoản</th></tr>':'<tr><th>Nhân sự</th><th>Chức danh tại công trình</th><th>Tài khoản</th><th>'+(canManageAssignments()?'Quyền truy cập':'Quyền của tôi')+'</th><th>Chứng chỉ</th></tr>';
 const body=rows.map(r=>{
  const click=' class="clickable" onclick="openTeamMember(\''+encodeURIComponent(r.key)+'\',\''+pid+'\')" title="Bấm để xem / chọn quyền truy cập"';
  const title=r.assignment_title?esc(r.assignment_title):'<span class="muted">Chưa nhập</span>';
  return compact?'<tr'+click+'><td><b>'+esc(r.full_name)+'</b></td><td>'+title+'</td><td>'+accountCell(r,pid)+'</td></tr>'
   :'<tr'+click+'><td><b>'+esc(r.full_name)+'</b>'+(r.work_scope?'<br><span class="muted">'+esc(r.work_scope)+'</span>':'')+'</td><td>'+title+'</td><td>'+accountCell(r,pid)+'</td><td>'+(canManageAssignments()?permChips(r.access_permissions,r.permission_source)+(r.account_status==='LINKED'&&isLeadTitle(r.assignment_title)&&!(r.access_permissions||[]).includes('APPROVE')?' <span class="chip danger" title="Quyền tùy chỉnh chưa có Duyệt — bấm để cấp">⚠ TVGS trưởng chưa có quyền Duyệt</span>':''):(r.is_me?permChips(r.access_permissions,r.permission_source)+' <span class="chip">Tài khoản của tôi</span>':''))+'</td><td>'+esc(r.certificate||'')+'</td></tr>';
 }).join('');
 return '<table><thead>'+head+'</thead><tbody>'+body+'</tbody></table>'+mgrHtml;
}
function teamErrorNotice(pid){
 const e=teamErrorByProject[pid];if(!e)return '';
 const cached=db.teamCache?.[pid]?.at;
 return '<div class="notice" style="margin-bottom:10px;background:#fef3f2;border-color:#fecdca"><b>Không tải được danh sách nhân sự từ máy chủ:</b> '+esc(e)+(cached?'<br>Đang hiển thị bản lưu lúc '+esc(fmt(cached))+'.':'<br>Danh sách dưới đây chỉ gồm dữ liệu trên thiết bị.')+(/user_id|column|relation/i.test(e)?'<br>Nguyên nhân thường gặp: cơ sở dữ liệu chưa chạy migration. Chạy <code>migrate-db.ps1</code> rồi khởi động lại.':'')+'</div>';
}
async function unassignedAuthorsHtml(pid){
 if(!canManageAssignments()||!apiOnline())return '';
 try{
  const list=await apiRequest('/project-personnel/project/'+encodeURIComponent(pid)+'/unassigned-authors');
  if(!Array.isArray(list)||!list.length)return '';
  return '<div class="notice" style="margin-top:12px"><b>Đã lập nhật ký/văn bản tại công trình nhưng hiện chưa được phân công</b> (không xem được công trình này):<table style="margin-top:6px"><tbody>'+list.map(u=>'<tr><td><b>'+esc(u.username)+'</b> · '+esc(ROLE_LABELS[u.role_name]||u.role_name)+'</td><td>'+u.record_count+' bản ghi, gần nhất '+progressDate(u.last_at)+'</td><td><button onclick="quickAssign(\''+pid+'\',\''+u.user_id+'\')">Phân công vào công trình</button></td></tr>').join('')+'</tbody></table></div>';
 }catch(_){return ''}
}
async function quickAssign(pid,userId){
 const title=prompt('Chức danh tại công trình (công việc được giao):','GS viên');if(title===null)return;
 try{await apiRequest('/project-members',{method:'POST',body:JSON.stringify({project_id:pid,user_id:userId,assignment_title:title.trim()})});await refreshTeamViews(pid)}
 catch(error){alert('Không phân công được: '+error.message)}
}
function accountOptionsHtml(users,selectedId){
 const order=ACCOUNT_TYPES;const groups={};
 users.forEach(u=>{(groups[u.role_name]=groups[u.role_name]||[]).push(u)});
 return Object.keys(groups).sort((a,b)=>(order.indexOf(a)+99*(order.indexOf(a)<0))-(order.indexOf(b)+99*(order.indexOf(b)<0))).map(role=>'<optgroup label="'+esc(ROLE_LABELS[role]||role)+'">'+groups[role].sort((a,b)=>a.username.localeCompare(b.username)).map(u=>'<option value="'+u.id+'"'+(u.id===selectedId?' selected':'')+'>'+esc(u.username)+'</option>').join('')+'</optgroup>').join('');
}
function fillProjectSelect(select,old){
 const list=serverProjects();
 select.innerHTML='<option value="">Chọn công trình</option>'+list.map(p=>'<option value="'+p.id+'">'+esc(projectLabel(p))+'</option>').join('');
 const pid=list.some(p=>p.id===old)?old:(list[0]?.id||'');select.value=pid;return pid;
}
function localOnlyNotice(){
 const n=(db.projects||[]).filter(p=>p._localOnly).length;
 return n?'<div class="notice" style="margin-bottom:10px">'+n+' công trình chỉ có trên thiết bị (chưa đồng bộ hoặc bị từ chối do trùng mã/số hợp đồng) nên không phân công được. Xem mục Công trình.</div>':'';
}
async function loadProjectTeamDirectory(projectId=''){
 const el=document.getElementById('projectTeamDirectory');const select=document.getElementById('directoryProject');if(!el||!select)return;
 const addBtn=document.getElementById('addPersonButton');if(addBtn)addBtn.style.display=canManageAssignments()?'':'none';
 const pid=fillProjectSelect(select,projectId||select.value||currentProjectId||'');
 if(!pid){el.innerHTML=localOnlyNotice()+'<p class="muted">Chưa chọn công trình.</p>';return}
 el.innerHTML='<p class="muted">Đang tải...</p>';
 const rows=await fetchTeam(pid);if(select.value!==pid)return;
 el.innerHTML=localOnlyNotice()+teamErrorNotice(pid)+'<p class="muted">Mỗi nhân sự hiển thị một lần. '+(canManageAssignments()?'Bấm vào một người để sửa chức danh, liên kết tài khoản và chọn quyền truy cập.':'Bấm vào một người để xem chi tiết.')+'</p>'+teamTableHtml(rows,pid);
 const extra=await unassignedAuthorsHtml(pid);if(extra&&select.value===pid)el.insertAdjacentHTML('beforeend',extra);
}
async function loadProjectDetailMembers(pid){
 const el=document.getElementById('pdPeople');if(!el||!pid)return;
 const cached=db.teamCache?.[pid]?.rows;if(cached)el.innerHTML=teamTableHtml(cached,pid,{compact:true});
 const rows=await fetchTeam(pid,{sync:false});
 if(currentProjectId===pid)el.innerHTML=teamErrorNotice(pid)+teamTableHtml(rows,pid,{compact:true});
}
async function loadAssignableUsers(force=false){
 if(!canManageAssignments()||!getAuthToken())return [];
 if(assignmentUsers.length&&!force)return assignmentUsers;
 try{assignmentUsers=(await apiRequest('/users')).filter(u=>u.is_active!==false)}catch(error){console.warn('Không tải được tài khoản:',error.message)}
 return assignmentUsers;
}
function titleSelectHtml(prefix,value){
 const legacy={'Trưởng TVGS':'TVGS trưởng','Tư vấn giám sát viên':'GS viên'};const v=legacy[value]||value||'';
 const sel=TITLE_OPTIONS.includes(v)?v:(v?'Khác':'GS viên');
 return '<select id="'+prefix+'Title" onchange="document.getElementById(\''+prefix+'TitleOther\').style.display=this.value===\'Khác\'?\'\':\'none\'">'+TITLE_OPTIONS.map(o=>'<option'+(o===sel?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select><input id="'+prefix+'TitleOther" maxlength="120" placeholder="Nhập chức danh khác" style="margin-top:6px;display:'+(sel==='Khác'?'':'none')+'" value="'+esc(sel==='Khác'?v:'')+'">';
}
function readTitle(prefix){const s=document.getElementById(prefix+'Title')?.value||'';return s==='Khác'?(document.getElementById(prefix+'TitleOther')?.value||'').trim():s}
function defaultsLabel(roleName,title){
 const d=defaultPermsFor(roleName,title);
 const basis=roleName!=='MANAGER'&&String(title||'').trim()?'chức danh "'+title+'"':(ROLE_LABELS[roleName]||roleName||'chưa chọn tài khoản');
 return basis+': '+d.map(k=>PERM_LABELS[k]).join(', ');
}
// Đổi chức danh trong cửa sổ → cập nhật quyền mặc định hiển thị (Trưởng TVGS tại công trình = có quyền Duyệt)
function refreshPermDefaults(){
 const span=document.getElementById('tmDefaultsText');if(!span)return;
 const roleName=span.dataset.role||'';const title=readTitle('tm');
 span.textContent='('+defaultsLabel(roleName,title)+')';
 const mode=document.querySelector('input[name="tmPermMode"]:checked')?.value;
 if(mode==='DEFAULT'){const d=defaultPermsFor(roleName,title);document.querySelectorAll('.tmPerm').forEach(c=>c.checked=d.includes(c.value))}
 // Tùy chỉnh + chuyển sang chức danh TVGS trưởng → tự tích Duyệt (Trưởng TVGS quyết định tại công trình)
 else if(mode==='CUSTOM'&&isLeadTitle(title)){['CREATE','EDIT','APPROVE'].forEach(k=>{const c=document.querySelector('.tmPerm[value='+k+']');if(c)c.checked=true})}
 const warn=document.getElementById('tmLeadWarn');if(warn)warn.style.display=mode==='CUSTOM'&&isLeadTitle(title)&&!document.querySelector('.tmPerm[value=APPROVE]')?.checked?'':'none';
}
function grantApproveNow(){const c=document.querySelector('.tmPerm[value=APPROVE]');if(c){c.disabled=false;c.checked=true}const w=document.getElementById('tmLeadWarn');if(w)w.innerHTML='✔ Đã tích quyền <b>Duyệt</b> — bấm <b>Lưu thay đổi</b> để áp dụng.'}
function permEditorHtml(r,roleName,titleArg){
 const global=['ADMIN','DIRECTOR'].includes(roleName);
 const custom=r&&r.permission_source==='CUSTOM';
 const title=titleArg!==undefined?titleArg:(document.getElementById('tmTitle')?readTitle('tm'):(r?.assignment_title||''));
 const defaults=defaultPermsFor(roleName,title);
 const current=custom&&r.access_permissions&&r.access_permissions.length?r.access_permissions:defaults;
 if(global)return '<fieldset class="perm-box"><legend>Quyền truy cập tại công trình</legend><p class="muted">Tài khoản '+esc(ROLE_LABELS[roleName])+' có toàn quyền trên mọi công trình.</p></fieldset>';
 const disabled=custom?'':' disabled';
 return '<fieldset class="perm-box"><legend>Quyền truy cập tại công trình</legend>'
  +'<label class="inline"><input type="radio" name="tmPermMode" value="DEFAULT"'+(custom?'':' checked')+' onchange="toggleTeamPermMode();refreshPermDefaults()"> Theo mặc định <span class="muted" id="tmDefaultsText" data-role="'+esc(roleName||'')+'">('+esc(defaultsLabel(roleName,title))+')</span></label>'
  +'<label class="inline"><input type="radio" name="tmPermMode" value="CUSTOM"'+(custom?' checked':'')+' onchange="toggleTeamPermMode();refreshPermDefaults()"> Tùy chỉnh cho công trình này</label>'
  +'<div id="tmLeadWarn" class="review-note reject" style="margin:6px 0;display:'+(custom&&isLeadTitle(title)&&!current.includes('APPROVE')?'':'none')+'">⚠ Chức danh là <b>'+esc(title)+'</b> nhưng quyền tùy chỉnh <b>chưa có "Duyệt"</b> → người này chưa phê duyệt được và không có mục "Việc cần duyệt". <button type="button" class="primary" onclick="grantApproveNow()">Cấp quyền Duyệt</button> hoặc chọn "Theo mặc định".</div>'
  +'<div class="perm-grid">'+PERM_ORDER.map(k=>'<label class="inline"><input type="checkbox" class="tmPerm" value="'+k+'"'+(current.includes(k)?' checked':'')+(k==='APPROVE'?' onchange="refreshPermDefaults()"':'')+(k==='VIEW'?' onclick="return false"':k==='EDIT'?' onchange="if(this.checked){const c=document.querySelector(\'.tmPerm[value=CREATE]\');if(c)c.checked=true}"':k==='CREATE'?' onchange="if(!this.checked){const e=document.querySelector(\'.tmPerm[value=EDIT]\');if(e)e.checked=false}"':'')+disabled+'> '+esc(PERM_LABELS[k])+'</label>').join('')+'</div>'
  +'<p class="muted" style="margin:4px 0 0">Xem: xem dữ liệu · Thêm: lập nhật ký/văn bản và sửa bản nháp của mình · Sửa (bao gồm Thêm): sửa, đóng/mở lại bản ghi của người khác · Tải xuống / in: xuất, in, tải tệp · <b>Duyệt</b>: phê duyệt / yêu cầu chỉnh sửa / trình công ty tại công trình này (mặc định có khi chức danh là TVGS trưởng) · <b>Xóa</b>: xóa nhật ký, hồ sơ, báo cáo, văn bản chất lượng, bảng tiến độ (vào Thùng rác, khôi phục được) — mặc định chỉ Admin/Giám đốc, người khác chỉ có khi được tích ở đây.</p>'
  +'<label>Làm việc ở đâu</label><input id="tmScope" maxlength="240" value="'+esc(r?.work_scope||'')+'" placeholder="Ví dụ: Hiện trường, hồ sơ, nhật ký"></fieldset>';
}
function toggleTeamPermMode(){const custom=document.querySelector('input[name="tmPermMode"]:checked')?.value==='CUSTOM';document.querySelectorAll('.tmPerm').forEach(el=>el.disabled=!custom)}
function readPermEditor(){
 const mode=document.querySelector('input[name="tmPermMode"]:checked')?.value;if(!mode)return {};
 const scope=(document.getElementById('tmScope')?.value||'').trim();
 if(mode==='DEFAULT')return {access_permissions:null,work_scope:scope};
 const list=[...document.querySelectorAll('.tmPerm:checked')].map(x=>x.value);if(!list.includes('VIEW'))list.unshift('VIEW');
 return {access_permissions:list,work_scope:scope};
}
// Tên đăng nhập tự đặt (khớp backend userService.normalizeUsername)
const USERNAME_RE=/^[a-z0-9][a-z0-9._@-]{2,49}$/;
const USERNAME_RULE='Tên đăng nhập 3–50 ký tự: chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang, @ (không bắt đầu bằng ký hiệu).';
function usernameSuggestions(name){
 const parts=String(name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);
 if(!parts.length)return [];
 const last=parts[parts.length-1],first=parts[0],mid=parts.slice(1,-1);
 const out=[suggestUsername(name),parts.join(''),parts.join('.'),mid.concat(last).join('')+(parts.length>1?'.'+first[0]:''),last+first];
 return [...new Set(out.filter(u=>u&&u.length>=3).map(u=>u.slice(0,50)))].slice(0,5);
}
let usernameTimer=null;
function checkUsernameInput(input,exceptId){
 const hint=input.parentElement.querySelector('#tmUserHint,#tmRenameHint');const v=String(input.value||'').trim().toLowerCase();
 if(!hint)return;hint.dataset.taken='';
 if(!USERNAME_RE.test(v)){hint.style.color='#b42318';hint.textContent=v?USERNAME_RULE:'';return}
 hint.style.color='';hint.textContent='Đang kiểm tra...';clearTimeout(usernameTimer);
 usernameTimer=setTimeout(async()=>{try{const r=await apiRequest('/users/username-available?username='+encodeURIComponent(v)+(exceptId?'&except='+encodeURIComponent(exceptId):''));if(input.value.trim().toLowerCase()!==v)return;hint.dataset.taken=r.available?'':'1';hint.style.color=r.available?'#067647':'#b42318';hint.textContent=r.available?'✔ Dùng được':'✖ '+(r.reason||'Đã có người dùng')}catch(_){hint.textContent=''}},350);
}
function showRenameUsername(userId,current,encodedKey,pid){
 const box=document.getElementById('tmRenameBox');if(!box)return;
 const r=(teamRowsByProject[pid]||[]).find(x=>x.key===decodeURIComponent(encodedKey));
 const mismatch=r&&r.account_name&&cleanPersonName(r.account_name).toLocaleLowerCase('vi')!==cleanPersonName(r.full_name).toLocaleLowerCase('vi');
 box.innerHTML='<div class="row" style="align-items:end"><div><label>Tên đăng nhập mới</label><input id="tmRenameInput" maxlength="50" autocomplete="off" value="'+esc(current)+'" oninput="checkUsernameInput(this,\''+esc(userId)+'\')"><div id="tmRenameHint" class="muted" style="font-size:12px;margin-top:4px">Mật khẩu giữ nguyên; người dùng đăng nhập bằng tên mới.</div>'
  +(mismatch?'<label class="inline"><input type="checkbox" id="tmRenameSyncName" checked> Đồng thời đổi họ tên tài khoản "'+esc(r.account_name)+'" → "'+esc(r.full_name)+'"</label>':'')+'</div><div><button type="button" class="primary" onclick="saveRenameUsername(\''+esc(userId)+'\',\''+encodedKey+'\',\''+pid+'\')">Lưu tên đăng nhập</button> <button type="button" onclick="document.getElementById(\'tmRenameBox\').innerHTML=\'\'">Hủy</button></div></div>';
 document.getElementById('tmRenameInput').focus();
}
async function saveRenameUsername(userId,encodedKey,pid){
 const input=document.getElementById('tmRenameInput');const hint=document.getElementById('tmRenameHint');const v=String(input?.value||'').trim().toLowerCase();
 if(!USERNAME_RE.test(v)){hint.style.color='#b42318';hint.textContent=USERNAME_RULE;return}
 const r=(teamRowsByProject[pid]||[]).find(x=>x.key===decodeURIComponent(encodedKey));
 const body={username:v};if(document.getElementById('tmRenameSyncName')?.checked&&r?.full_name){body.full_name=r.full_name;body.keep_history_name=true}
 try{const u=await apiRequest('/users/'+encodeURIComponent(userId),{method:'PATCH',body:JSON.stringify(body)});
  const a=assignmentUsers.find(x=>x.id===userId);if(a)a.username=u.username;audit('RENAME_USERNAME','users',userId,u.username);save();
  await refreshTeamViews(pid);openTeamMember(encodedKey,pid);alert('Đã đổi tên đăng nhập thành "'+u.username+'". Báo cho người dùng đăng nhập bằng tên mới.')}
 catch(error){hint.style.color='#b42318';hint.textContent=error.message}
}
// Tài khoản đúng là của nhân sự này nhưng họ tên tài khoản còn tên cũ → đồng bộ họ tên tài khoản theo hồ sơ nhân sự
// Họ tên tài khoản khác tên nhân sự → cửa sổ sửa riêng (mở từ nhãn ⚠ trên bảng hoặc trong cửa sổ nhân sự)
async function openAccountFix(encodedKey,pid){
 const r=(teamRowsByProject[pid]||[]).find(x=>x.key===decodeURIComponent(encodedKey));if(!r||!r.user_id)return;
 let u={daily_logs:0,documents:0,issues:0};try{u=await apiRequest('/users/'+encodeURIComponent(r.user_id)+'/usage')}catch(_){}
 const n=(u.daily_logs||0)+(u.documents||0)+(u.issues||0);
 const recs=[u.daily_logs?u.daily_logs+' nhật ký'+(u.first_log?' ('+progressDate(u.first_log)+' – '+progressDate(u.last_log)+')':''):'',u.documents?u.documents+' hồ sơ/báo cáo':'',u.issues?u.issues+' văn bản chất lượng':''].filter(Boolean).join(', ');
 openModal('Tài khoản '+r.username+' mang họ tên khác nhân sự',
  '<div class="review-note reject">Nhân sự: <b>'+esc(r.full_name)+'</b> · Tài khoản: <b>'+esc(r.username)+'</b> đang mang họ tên <b>'+esc(r.account_name)+'</b>.<br><span class="muted">Đổi <i>tên đăng nhập</i> không đổi <i>họ tên của tài khoản</i> — cảnh báo so sánh họ tên.</span></div>'
  +'<div class="card"><h4 style="margin-top:0">① Tài khoản này nay là của '+esc(r.full_name)+'</h4><p>Đổi họ tên tài khoản từ "'+esc(r.account_name)+'" thành "<b>'+esc(r.full_name)+'</b>".</p>'
  +(n?'<label class="inline"><input type="checkbox" id="afKeep" checked> Giữ tên người lập "<b>'+esc(r.account_name)+'</b>" trên '+esc(recs)+' đã lập trước đây bằng tài khoản này</label><p class="muted" style="font-size:12px;margin:2px 0 8px 26px">Nên giữ: các bản đó do '+esc(r.account_name)+' lập. Bỏ chọn chỉ khi chúng thực ra do '+esc(r.full_name)+' lập.</p>':'<p class="muted">Tài khoản chưa lập nhật ký/hồ sơ nào — không ảnh hưởng lịch sử.</p>')
  +'<button class="primary" onclick="confirmAccountOwner(\''+esc(r.user_id)+'\',\''+encodedKey+'\',\''+esc(pid)+'\')">Đúng người — đổi họ tên tài khoản</button></div>'
  +'<div class="card" style="margin-top:10px"><h4 style="margin-top:0">② Gắn nhầm tài khoản</h4><p>Thu hồi quyền của tài khoản '+esc(r.username)+' tại công trình (vẫn giữ '+esc(r.full_name)+' trong danh sách), rồi tạo tài khoản mới cho '+esc(r.full_name)+'.</p>'
  +(r.personnel_id?'<button class="danger" onclick="closeModal();unlinkTeamAccount(\''+encodedKey+'\',\''+esc(pid)+'\')">Thu hồi quyền truy cập</button>':'')+'</div>');
}
async function confirmAccountOwner(userId,encodedKey,pid){
 const r=(teamRowsByProject[pid]||[]).find(x=>x.key===decodeURIComponent(encodedKey));if(!r)return;
 const keep=document.getElementById('afKeep')?.checked!==false;
 try{const u=await apiRequest('/users/'+encodeURIComponent(userId),{method:'PATCH',body:JSON.stringify({full_name:r.full_name,keep_history_name:keep})});
  const a=assignmentUsers.find(x=>x.id===userId);if(a)a.full_name=r.full_name;audit('CONFIRM_ACCOUNT_OWNER','users',userId,r.username+' → '+r.full_name+(u.history_name_kept_on?' (giữ tên cũ trên '+u.history_name_kept_on+' bản ghi)':''));save();
  closeModal();await refreshTeamViews(pid);
  alert('Đã đổi họ tên tài khoản '+r.username+' thành "'+r.full_name+'".'+(u.history_name_kept_on?'\n'+u.history_name_kept_on+' bản ghi cũ vẫn ghi người lập là "'+r.account_name+'".':''))}
 catch(error){alert('Không cập nhật được: '+error.message)}
}
function suggestUsername(name){const parts=String(name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);if(!parts.length)return '';const last=parts.pop();return (last+(parts.length?'.'+parts.map(x=>x[0]).join(''):'')).slice(0,50)}
function onTeamAccountChange(){
 const type=document.getElementById('tmAccType')?.value||'';const modeWrap=document.getElementById('tmAccModeWrap');const detail=document.getElementById('tmAccDetail');const box=document.getElementById('tmPermWrap');
 if(!modeWrap||!detail||!box)return;
 if(!type){modeWrap.innerHTML='';detail.innerHTML='<p class="muted">Nhân sự không có tài khoản vẫn nằm trong danh sách tổ TVGS nhưng không đăng nhập được.</p>';box.innerHTML='';return}
 const prev=document.getElementById('tmPrevUser')?.value||'';
 const linked=new Set(Object.values(teamRowsByProject).flat().filter(x=>x.account_status==='LINKED'&&x.user_id!==prev).map(x=>x.user_id));
 const existing=assignmentUsers.filter(u=>u.role_name===type&&u.is_active!==false);
 // Người chưa có tài khoản → mặc định TẠO MỚI. Trước đây mặc định "Dùng tài khoản có sẵn" và chọn sẵn
 // tài khoản đầu danh sách (của người khác) → bấm Lưu là gắn nhầm tài khoản.
 const mode=document.querySelector('input[name="tmAccMode"]:checked')?.value||(prev&&existing.some(u=>u.id===prev)?'EXISTING':'NEW');
 const personName=cleanPersonName(document.getElementById('tmName')?.value||'').toLocaleLowerCase('vi');
 const nameMatch=existing.find(u=>!linked.has(u.id)&&personName&&cleanPersonName(u.full_name||'').toLocaleLowerCase('vi')===personName);
 const selId=prev||nameMatch?.id||'';
 modeWrap.innerHTML='<label>Cách gán</label><label class="inline"><input type="radio" name="tmAccMode" value="NEW"'+(mode==='NEW'?' checked':'')+' onchange="onTeamAccountChange()"> Tạo tài khoản mới</label><label class="inline"><input type="radio" name="tmAccMode" value="EXISTING"'+(mode==='EXISTING'?' checked':'')+(existing.length?'':' disabled')+' onchange="onTeamAccountChange()"> Dùng tài khoản có sẵn ('+existing.length+')</label>';
 if(mode==='EXISTING'){
  detail.innerHTML='<label>Tài khoản '+esc(ROLE_LABELS[type])+'</label><select id="tmAccount"><option value="">— Chọn tài khoản —</option>'+existing.map(u=>'<option value="'+u.id+'"'+(u.id===selId?' selected':'')+(linked.has(u.id)&&u.id!==prev?' disabled':'')+'>'+esc(u.username)+(u.full_name?' — '+esc(u.full_name):'')+(linked.has(u.id)?' (đã gán người khác)':'')+'</option>').join('')+'</select>'
   +(nameMatch||prev?'':'<p class="muted">Không có tài khoản nào trùng họ tên người này. Kiểm tra kỹ trước khi gán, hoặc chọn "Tạo tài khoản mới".</p>');
 }else{
  const name=document.getElementById('tmName')?.value||'';
  const oldUser=document.getElementById('tmNewUsername')?.value,oldPw=document.getElementById('tmNewPassword')?.value;
  detail.innerHTML='<div class="row"><div><label>Tên đăng nhập (tự đặt)</label><input id="tmNewUsername" maxlength="50" autocomplete="off" value="'+esc(oldUser||suggestUsername(name))+'" placeholder="vd. thanhb, b.nt, 0912345678, ten@congty.vn" oninput="checkUsernameInput(this)">'
   +'<div id="tmUserHint" class="muted" style="font-size:12px;margin-top:4px"></div><div style="margin-top:4px">'+usernameSuggestions(name).map(u=>'<button type="button" class="chip" style="border:0;cursor:pointer;margin:2px" onclick="const i=document.getElementById(\'tmNewUsername\');i.value=\''+esc(u)+'\';checkUsernameInput(i)">'+esc(u)+'</button>').join('')+'</div></div>'
   +'<div><label>Mật khẩu ban đầu (≥ 8 ký tự)</label><div style="display:flex;gap:6px"><input id="tmNewPassword" type="text" autocomplete="off" maxlength="72" value="'+esc(oldPw||randomPassword())+'"><button type="button" title="Tạo mật khẩu ngẫu nhiên khác" onclick="document.getElementById(\'tmNewPassword\').value=randomPassword()">↻</button></div></div></div>'
   +'<p class="muted">Sau khi lưu, hệ thống hiện <b>phiếu tài khoản</b> để in/sao chép gửi người dùng. Lần đăng nhập đầu tiên người dùng <b>bắt buộc đổi mật khẩu</b>.</p>';
 }
 box.innerHTML=permEditorHtml(null,type);
}
async function openTeamMember(encodedKey,pid){
 const key=decodeURIComponent(encodedKey||'');
 const r=key?(teamRowsByProject[pid]||[]).find(x=>x.key===key):null;
 if(key&&!r)return alert('Không tìm thấy nhân sự. Hãy tải lại danh sách.');
 const p=(db.projects||[]).find(x=>x.id===pid)||{};
 const manager=canManageAssignments();
 if(!manager){
  if(!r)return;
  openModal('Nhân sự: '+r.full_name,'<div class="card"><p><b>Công trình:</b> '+esc(projectLabel(p))+'</p><p><b>Chức danh:</b> '+esc(r.assignment_title||'Chưa nhập')+'</p><p><b>Chứng chỉ:</b> '+esc(r.certificate||'—')+'</p>'+(r.is_me?'<p><b>Tài khoản:</b> '+accountCell(r,pid)+'</p><p><b>Quyền của tôi tại công trình:</b> '+permChips(r.access_permissions,r.permission_source)+'</p><p><b>Làm việc ở đâu:</b> '+esc(r.work_scope||'—')+'</p>':'')+'</div>');
  return;
 }
 if(r&&r.account_status==='PENDING_SYNC')return alert('Nhân sự này đang chờ đồng bộ lên máy chủ. Hãy kết nối mạng và tải lại trang.');
 const users=await loadAssignableUsers();
 const linkedIds=new Set((teamRowsByProject[pid]||[]).filter(x=>x.user_id&&x.account_status==='LINKED'&&x!==r).map(x=>x.user_id));
 const accountOptions=accountOptionsHtml(users.filter(u=>!linkedIds.has(u.id)),r?.user_id);
 const isMemberOnly=r&&!r.personnel_id;
 const info='<div class="row">'
  +'<div><label>Họ tên</label><input id="tmName" maxlength="255" value="'+esc(r?.full_name||'')+'"'+(isMemberOnly?' disabled title="Lấy theo tên tài khoản"':'')+'></div>'
  +'<div><label>Chức danh tại công trình (công việc được giao)</label>'+titleSelectHtml('tm',r?.assignment_title||'')+'</div>'
  +'<div class="full"><label>Chứng chỉ</label><input id="tmCert" value="'+esc(r?.certificate||'')+'"'+(isMemberOnly?' disabled placeholder="Thêm hồ sơ nhân sự để nhập chứng chỉ"':'')+'></div></div>';
 let account='';
 if(r&&r.account_status==='LINKED'){
  const mismatch=r.account_name&&cleanPersonName(r.account_name).toLocaleLowerCase('vi')!==cleanPersonName(r.full_name).toLocaleLowerCase('vi');
  account='<fieldset class="perm-box"><legend>Tài khoản đăng nhập</legend><p id="tmAccLine">Đã liên kết: <b>'+esc(r.username)+'</b>'+(r.account_name?' ('+esc(r.account_name)+')':'')+' · '+esc(ROLE_LABELS[r.role_name]||r.role_name)+'</p>'
   +(mismatch?'<div class="review-note reject" style="margin:6px 0">⚠ Tài khoản <b>'+esc(r.username)+'</b> đang mang họ tên <b>'+esc(r.account_name)+'</b>, khác với nhân sự <b>'+esc(r.full_name)+'</b>.<br>'
     +'• Nếu tài khoản này <b>đúng là của '+esc(r.full_name)+'</b>: <button type="button" class="primary" onclick="openAccountFix(\''+encodedKey+'\',\''+pid+'\')">Đúng người — đổi họ tên tài khoản thành "'+esc(r.full_name)+'"</button><br>'
     +'• Nếu <b>gắn nhầm</b>: bấm "Thu hồi quyền truy cập", rồi mở lại người này để Tạo tài khoản mới.</div>':'')
   +'<div id="tmRenameBox"></div>'
   +'<div class="toolbar" style="margin:6px 0 0"><button type="button" onclick="showRenameUsername(\''+esc(r.user_id)+'\',\''+esc(r.username)+'\',\''+encodedKey+'\',\''+pid+'\')">Đổi tên đăng nhập</button><button type="button" onclick="resetTeamPassword(\''+esc(r.user_id)+'\',\''+encodedKey+'\',\''+pid+'\')">Đặt lại mật khẩu</button>'
   +(r.personnel_id?'<button type="button" onclick="unlinkTeamAccount(\''+encodedKey+'\',\''+pid+'\')">Thu hồi quyền truy cập (giữ trong danh sách)</button>':'')+'</div></fieldset>'+permEditorHtml(r,r.role_name,r.assignment_title||'');
 }else{
  account='<fieldset class="perm-box"><legend>Tài khoản đăng nhập</legend>'+(r?.account_status==='LINKED_NO_ACCESS'?'<p class="muted">Tài khoản <b>'+esc(r.username)+'</b> đã bị thu hồi quyền tại công trình. Chọn lại để cấp lại.</p>':'')
   +'<div class="row"><div><label>Loại tài khoản</label><select id="tmAccType" onchange="onTeamAccountChange()"><option value="">— Không có tài khoản —</option>'+ACCOUNT_TYPES.filter(t=>t!=='ADMIN'||roleToken(qualityAuthUser()?.role_name||'')==='ADMIN').map(t=>'<option value="'+t+'"'+(r?.role_name===t&&r?.user_id?' selected':'')+'>'+esc(ROLE_LABELS[t])+'</option>').join('')+'</select></div><div id="tmAccModeWrap"></div></div><div id="tmAccDetail"></div>'
   +'<input type="hidden" id="tmPrevUser" value="'+esc(r?.user_id||'')+'"></fieldset><div id="tmPermWrap"></div>';
 }
 const actions='<div class="toolbar"><button class="primary" onclick="saveTeamMember(\''+encodedKey+'\',\''+pid+'\')">Lưu thay đổi</button>'
  +(r?'<button class="danger" onclick="removeTeamMember(\''+encodedKey+'\',\''+pid+'\')">Rút khỏi công trình</button>':'')+'</div><div id="tmMessage" class="muted"></div>';
 openModal((r?'Nhân sự: '+r.full_name:'Thêm nhân sự')+' — '+(p.name||''),info+account+actions);
 if(!r||r.account_status!=='LINKED')onTeamAccountChange();
 document.getElementById('tmTitle')?.addEventListener('change',refreshPermDefaults);
 document.getElementById('tmTitleOther')?.addEventListener('input',refreshPermDefaults);
 document.getElementById('tmNewUsername')?.dispatchEvent(new Event('input'));
}
async function saveTeamMember(encodedKey,pid){
 const key=decodeURIComponent(encodedKey||'');const r=key?(teamRowsByProject[pid]||[]).find(x=>x.key===key):null;
 const msg=document.getElementById('tmMessage');const say=t=>{if(msg)msg.textContent=t};
 const name=cleanPersonName(document.getElementById('tmName')?.value);const title=readTitle('tm');const cert=(document.getElementById('tmCert')?.value||'').trim();
 if(!name)return say('Nhập họ tên.');if(!title)return say('Chọn hoặc nhập chức danh tại công trình.');
 if(!r){const dup=(teamRowsByProject[pid]||[]).find(x=>cleanPersonName(x.full_name).toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi'));if(dup)return say('Đã có "'+dup.full_name+'" trong danh sách công trình. Đóng cửa sổ này và bấm vào tên đó để sửa.')}
 const perm=readPermEditor();const accType=document.getElementById('tmAccType')?.value||'';const accMode=document.querySelector('input[name="tmAccMode"]:checked')?.value||'';
 let accountId=accType&&accMode==='EXISTING'?(document.getElementById('tmAccount')?.value||''):'';
 const newAccount=accType&&accMode==='NEW'?{username:(document.getElementById('tmNewUsername')?.value||'').trim().toLowerCase(),password:document.getElementById('tmNewPassword')?.value||'',role_name:accType}:null;
 if(newAccount){if(!USERNAME_RE.test(newAccount.username))return say(USERNAME_RULE);if(document.getElementById('tmUserHint')?.dataset.taken==='1')return say('Tên đăng nhập đã có người dùng — chọn tên khác.');if(newAccount.password.length<8)return say('Mật khẩu ban đầu tối thiểu 8 ký tự.')}
 if(accType&&accMode==='EXISTING'&&!accountId)return say('Chọn tài khoản có sẵn.');
 if(!navigator.onLine){
  if(r)return say('Đang mất mạng: chỉ thêm mới được khi offline, sửa/cấp quyền cần kết nối.');
  const p=(db.projects||[]).find(x=>x.id===pid)||{};
  db.people=db.people||[];db.people.push({id:id(),name,role:title,certs:cert,projectId:pid,projectCode:p.code||'',projectName:p.name||''});
  audit('CREATE','person','',name);save();closeModal();return loadProjectTeamDirectory(pid);
 }
 let createdSlip=null;
 try{
  say('Đang lưu...');
  let personnelId=r?.personnel_id||null;
  if(!r||r.personnel_id){
   const body={project_id:pid,full_name:name,assignment_title:title,certificate:cert};
   const row=r?await apiRequest('/project-personnel/'+encodeURIComponent(r.personnel_id),{method:'PUT',body:JSON.stringify(body)})
            :await apiRequest('/project-personnel',{method:'POST',body:JSON.stringify(body)});
   personnelId=row.id;
  }
  if(r&&r.account_status==='LINKED'){
   const body={...perm};if(!r.personnel_id)body.assignment_title=title;
   await apiRequest('/project-members/'+encodeURIComponent(r.member_id),{method:'PUT',body:JSON.stringify(body)});
  }else if((accountId||newAccount)&&personnelId){
   if(newAccount){const u=await apiRequest('/users',{method:'POST',body:JSON.stringify({...newAccount,full_name:name})});accountId=u.id;assignmentUsers.push(u);createdSlip={fullName:name,username:u.username,password:newAccount.password,role:ROLE_LABELS[u.role_name]||u.role_name,project:(db.projects||[]).find(x=>x.id===pid)?.name||'',title};say('Đã tạo tài khoản '+u.username+'. Đang cấp quyền...')}
   await apiRequest('/project-personnel/'+encodeURIComponent(personnelId)+'/link-account',{method:'POST',body:JSON.stringify({user_id:accountId,...perm})});
  }
  audit(r?'UPDATE':'CREATE','project_personnel',personnelId||r?.member_id||'',name+' — '+title);save();
  closeModal();await refreshTeamViews(pid);
  if(createdSlip)showAccountSlip(createdSlip);
 }catch(error){say('Không lưu được: '+error.message)}
}
async function unlinkTeamAccount(encodedKey,pid){
 const r=(teamRowsByProject[pid]||[]).find(x=>x.key===decodeURIComponent(encodedKey));if(!r?.personnel_id)return;
 if(!confirm('Thu hồi quyền truy cập công trình của tài khoản '+r.username+'? '+r.full_name+' vẫn nằm trong danh sách nhân sự.'))return;
 try{await apiRequest('/project-personnel/'+encodeURIComponent(r.personnel_id)+'/unlink-account',{method:'POST'});audit('UNLINK_ACCOUNT','project_personnel',r.personnel_id,r.full_name);save();closeModal();await refreshTeamViews(pid)}
 catch(error){alert('Không thu hồi được: '+error.message)}
}
async function removeTeamMember(encodedKey,pid){
 const r=(teamRowsByProject[pid]||[]).find(x=>x.key===decodeURIComponent(encodedKey));if(!r)return;
 if(!confirm('Rút '+r.full_name+' khỏi công trình? Nếu có tài khoản, quyền truy cập công trình cũng kết thúc.'))return;
 try{
  if(r.personnel_id)await apiRequest('/project-personnel/'+encodeURIComponent(r.personnel_id),{method:'DELETE'});
  else if(r.member_id)await apiRequest('/project-members/'+encodeURIComponent(r.member_id),{method:'DELETE'});
  audit('REMOVE','project_personnel',r.personnel_id||r.member_id,r.full_name);save();closeModal();await refreshTeamViews(pid);
 }catch(error){alert('Không rút được nhân sự: '+error.message)}
}
async function refreshTeamViews(pid){
 await fetchTeam(pid,{sync:false});
 const dir=document.getElementById('directoryProject');if(dir&&document.getElementById('people')?.classList.contains('active'))await loadProjectTeamDirectory(pid);
 const st=document.getElementById('settingsProject');if(st&&document.getElementById('settings')?.classList.contains('active'))await loadSettingsTeam();
 if(currentProjectId===pid)await loadProjectDetailMembers(pid);
 void loadQualityPermissions(true);
}
// ---- Thiết lập → Quản lý quyền theo công trình --------------------------------
async function loadSettingsProjects(){
 const box=document.getElementById('settingsAssignments');if(!box)return;
 box.style.display=canManageAssignments()?'':'none';if(!canManageAssignments()||!getAuthToken())return;
 const sel=document.getElementById('settingsProject');fillProjectSelect(sel,sel.value||currentProjectId||'');
 const users=await loadAssignableUsers(true);
 const userSelect=document.getElementById('assignmentUser');
 if(userSelect)userSelect.innerHTML='<option value="">Chọn tài khoản</option>'+accountOptionsHtml(users.filter(u=>!['ADMIN','DIRECTOR'].includes(u.role_name)));
 await loadSettingsTeam();
}
function loadAssignments(){return loadSettingsProjects()}
function openChangePassword(){
 openModal('Đổi mật khẩu','<div class="row"><div class="full"><label>Mật khẩu hiện tại</label><input id="cpOld" type="password" autocomplete="current-password"></div><div><label>Mật khẩu mới (≥ 8 ký tự)</label><input id="cpNew" type="password" autocomplete="new-password"></div><div><label>Nhập lại mật khẩu mới</label><input id="cpNew2" type="password" autocomplete="new-password"></div><div class="full"><button class="primary" onclick="saveChangePassword()">Đổi mật khẩu</button><div id="cpMsg" class="muted"></div></div></div>');
}
async function saveChangePassword(){
 const o=document.getElementById('cpOld').value,n=document.getElementById('cpNew').value,n2=document.getElementById('cpNew2').value;const m=document.getElementById('cpMsg');
 if(n.length<8){m.textContent='Mật khẩu mới tối thiểu 8 ký tự.';return}if(n!==n2){m.textContent='Hai lần nhập không khớp.';return}
 try{await apiRequest('/auth/change-password',{method:'POST',body:JSON.stringify({old_password:o,new_password:n})});alert('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.');if(typeof clearAuthSession==='function')clearAuthSession();location.reload()}
 catch(error){m.textContent=error.message}
}
const APP_BUILD='2026-10-07.1';
async function checkServerMigrations(){
 if(!apiOnline())return;
 try{const base=API_BASE.replace(/\/api$/,'');const h=await (await fetch(base+'/health',{cache:'no-store'})).json();
  window.serverHealth=h;
  if(h.build!==APP_BUILD){const main=document.querySelector('main');if(main&&!document.getElementById('buildBanner'))main.insertAdjacentHTML('afterbegin','<div id="buildBanner" class="notice" style="margin-bottom:12px;background:#fef3f2;border-color:#fecdca"><b>Máy chủ đang chạy phiên bản khác giao diện</b> (máy chủ: '+esc(h.build||'cũ, chưa có mã phiên bản')+' · giao diện: '+APP_BUILD+'). Các chức năng mới (hồ sơ trên máy chủ, nhân sự, tiến độ) sẽ lỗi. '+(canManageAssignments()?'Trên máy chủ: đóng cửa sổ/tiến trình backend rồi chạy lại <code>.\\run.bat</code> (bản mới tự khởi động lại khi lệch phiên bản).':'Hãy báo quản trị khởi động lại máy chủ.')+'</div>')}
  if(!canManageAssignments())return;
  if((h.security_warnings||[]).includes('JWT_SECRET_DEFAULT')){const main=document.querySelector('main');if(main&&!document.getElementById('secretBanner'))main.insertAdjacentHTML('afterbegin','<div id="secretBanner" class="notice" style="margin-bottom:12px;background:#fef3f2;border-color:#fecdca"><b>Khóa bảo mật đăng nhập đang là chuỗi mẫu.</b> Ai biết chuỗi này có thể giả mạo tài khoản Admin. Trên máy chủ: sửa <code>JWT_SECRET</code> trong <code>backend\\.env</code> thành chuỗi ngẫu nhiên ≥ 32 ký tự rồi chạy lại <code>.\\run.bat</code> (mọi người đăng nhập lại).</div>')}
  if(Array.isArray(h.migrations_pending)&&h.migrations_pending.length){const main=document.querySelector('main');if(main&&!document.getElementById('migrationBanner'))main.insertAdjacentHTML('afterbegin','<div id="migrationBanner" class="notice" style="margin-bottom:12px;background:#fef3f2;border-color:#fecdca"><b>Cơ sở dữ liệu chưa cập nhật cấu trúc</b> ('+h.migrations_pending.length+' bản: '+esc(h.migrations_pending.join(', '))+'). Một số chức năng (nhân sự, hồ sơ, tiến độ) sẽ lỗi. Trên máy chủ chạy: <code>powershell -ExecutionPolicy Bypass -File .\\migrate-db.ps1</code> rồi khởi động lại.</div>')}}
 catch(_){}
}
window.addEventListener('load',()=>setTimeout(checkServerMigrations,1500));
async function loadSettingsTeam(){
 const pid=document.getElementById('settingsProject')?.value||'';const el=document.getElementById('settingsTeam');if(!el)return;
 if(!pid){el.innerHTML=localOnlyNotice()+'<p class="muted">Chưa có công trình trên máy chủ để phân công.</p>';return}
 el.innerHTML='<p class="muted">Đang tải...</p>';
 const rows=await fetchTeam(pid);if(document.getElementById('settingsProject')?.value!==pid)return;
 el.innerHTML=localOnlyNotice()+teamErrorNotice(pid)+'<h3>Nhân sự của công trình</h3><p class="muted">Bấm vào một người để chọn quyền truy cập.</p>'+teamTableHtml(rows,pid);
 const extra=await unassignedAuthorsHtml(pid);if(extra&&document.getElementById('settingsProject')?.value===pid)el.insertAdjacentHTML('beforeend',extra);
}
async function addAssignment(){
 const project_id=document.getElementById('settingsProject').value;const user_id=document.getElementById('assignmentUser').value;
 const assignment_title=document.getElementById('assignmentTitle').value.trim();const message=document.getElementById('assignmentMessage');
 const user=assignmentUsers.find(u=>u.id===user_id);
 if(!project_id||!user){message.textContent='Hãy chọn công trình và tài khoản.';return}
 const existing=(teamRowsByProject[project_id]||[]).find(r=>r.user_id===user_id&&r.account_status==='LINKED');
 if(existing){message.textContent='Tài khoản '+user.username+' đã được phân công ('+existing.full_name+'). Bấm vào tên trong danh sách để sửa quyền.';return}
 try{
  await apiRequest('/project-members',{method:'POST',body:JSON.stringify({project_id,user_id,assignment_title})});
  message.textContent='Đã phân công tài khoản '+user.username+(assignment_title?' — '+assignment_title:'')+'. Quyền đang theo mặc định vai trò; bấm vào tên để tùy chỉnh.';
  document.getElementById('assignmentTitle').value='';
  await refreshTeamViews(project_id);
 }catch(error){message.textContent='Không phân công được: '+error.message}
}
// Tương thích lời gọi cũ
function openPerson(){const pid=document.getElementById('directoryProject')?.value||currentProjectId||serverProjects()[0]?.id||'';if(!pid)return alert('Chưa có công trình trên máy chủ.');openTeamMember('',pid)}

function saveIssue(){return saveQualityDocument('')}

const saveIssueLocal = saveIssue;
saveIssue = function(...args){
  saveIssueLocal(...args);
  if(window.syncPendingIssues) void window.syncPendingIssues();
};
const closeIssueLocal = closeIssue;
closeIssue = function(...args){
  closeIssueLocal(...args);
  if(window.syncPendingIssues) void window.syncPendingIssues();
};
window.addEventListener('online',()=>{
  if(window.syncPendingIssues) void window.syncPendingIssues();
});

window.addEventListener('load', async ()=>{
  if(window.syncPendingProjects) await window.syncPendingProjects();
  await syncDailyLogsFromApi();
  await syncDocumentsFromApi();
  if(window.syncPendingDailyLogs) await window.syncPendingDailyLogs();
  if(window.syncPendingIssues) await window.syncPendingIssues();
  await syncInitialProgressPlans();
  if(window.syncIssuesFromApi) await window.syncIssuesFromApi();
});
