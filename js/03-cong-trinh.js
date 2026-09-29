let currentProjectId=null;
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
function logProjectsForCreate(){return (db.projects||[]).filter(p=>canCreateLogIn(p.id))}
function projectsOptions(idSel){return db.projects.map(p=>`<option value="${p.id}" ${p.id===idSel?'selected':''}>${esc(p.code)} - ${esc(p.name)}</option>`).join('')}
function projectMatchesPerson(person,project){
  if(!person||!project)return false;
  if(String(person.projectId||'')===String(project.id||''))return true;
  const normalize=v=>String(v||'').trim().toLowerCase();
  const pCode=normalize(person.projectCode||person.contractNo);
  const pName=normalize(person.projectName);
  return (pCode&&pCode===normalize(project.code||project.contractNo))||(pName&&pName===normalize(project.name));
}
function goProjects(){currentProjectId=null;goPage('projects');renderAll()}
function openProjectSection(page){
  if(!currentProjectId)return;
  goPage(page);
  const selectId={daily:'logProject',issues:'issueProject',docs:'docProject'}[page];
  if(selectId){const el=document.getElementById(selectId);if(el){el.value=currentProjectId;el.dispatchEvent(new Event('change'));}}
  
  renderAll();
}
function openProjectDetail(pid){currentProjectId=pid;goPage('projectDetail');renderProjectDetail();void syncDocumentsFromApi();void loadProjectDetailMembers(pid);void loadProjectProgressPlans(pid);if(typeof loadProjectHealth==='function')void loadProjectHealth(pid)}
function projectRows(arr,forDash=false){
return `<table><thead><tr><th>M&#x00e3;</th><th>C&#x00f4;ng tr&#x00ec;nh</th><th>&#x110;&#x1ecb;a b&#x00e0;n</th><th>H&#x1ee3;p &#x0111;&#x1ed3;ng</th><th>Ti&#x1ebfn &#x0111;&#x1ed9;</th><th>Tr&#x1ea1;ng th&#x00e1;i</th><th></th></tr></thead><tbody>${arr.map(p=>`<tr class="${forDash?'clickable':''}" ${forDash?`onclick="openProjectDetail('${p.id}')"`:''}><td>${esc(p.code)}</td><td><b>${esc(p.name)}</b>${p._localOnly?` <span class="chip warn" title="${esc(p._syncError||'')}">${p._syncError?'Máy chủ từ chối: '+esc(p._syncError):'Chưa đồng bộ'}</span>`:''}<br><span class="muted">${esc(p.client||'')}</span></td><td>${esc(p.province||'')}</td><td>${p.contractNo?esc(p.contractNo):'<span class="muted">—</span>'}${p.contractValue?`<br><span class="muted">${Number(p.contractValue).toLocaleString('vi-VN')} &#x0111;</span>`:''}</td><td>${p.progress||0}%</td><td>${statusBadge(p.status)}</td><td>${forDash?`<button onclick="event.stopPropagation();openProjectDetail('${p.id}')">Xem</button>`:`${canEditProject()?`<button onclick="openProject('${p.id}')">S&#x1eed;a</button> `:''}<button onclick="openProjectDetail('${p.id}')">Chi ti&#x1ebft</button>`}</td></tr>`).join('')}</tbody></table>`}
function renderProjects(){let q=(document.getElementById('projectSearch')?.value||'').toLowerCase();document.getElementById('projectsTable').innerHTML=projectRows(db.projects.filter(p=>(p.name+p.code+(p.province||'')+(p.contractNo||'')).toLowerCase().includes(q)))||'<p class="muted">Chưa có công trình.</p>'}
async function refreshProjectFromServer(projectId){try{const projects=await apiGetProjects();mergeProjectsFromServer(projects);save()}catch(_){}}

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
function serverProjects(){return (db.projects||[]).filter(p=>!p._localOnly)}
function projectLabel(p){return (p.code?p.code+' - ':'')+(p.name||'')}
function fillProjectSelect(select,old){
 const list=serverProjects();
 select.innerHTML='<option value="">Chọn công trình</option>'+list.map(p=>'<option value="'+p.id+'">'+esc(projectLabel(p))+'</option>').join('');
 const pid=list.some(p=>p.id===old)?old:(list[0]?.id||'');select.value=pid;return pid;
}
async function loadProjectDetailMembers(pid){
 const el=document.getElementById('pdPeople');if(!el||!pid)return;
 const cached=db.teamCache?.[pid]?.rows;if(cached)el.innerHTML=teamTableHtml(cached,pid,{compact:true});
 const rows=await fetchTeam(pid,{sync:false});
 if(currentProjectId===pid)el.innerHTML=teamErrorNotice(pid)+teamTableHtml(rows,pid,{compact:true});
}
