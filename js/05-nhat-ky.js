const SHIFT_OPTIONS=[['CA1','Ca 1 (sáng)'],['CA2','Ca 2 (chiều)'],['CA3','Ca 3 (tối/đêm)']];
function shiftLabel(code){const c=String(code||'CA1').toUpperCase();const f=SHIFT_OPTIONS.find(x=>x[0]===c);return f?f[1]:c.replace(/^CA(\d+)$/,'Ca $1')}
const LOG_STATUS={DRAFT:'Nháp',SUBMITTED:'Chờ duyệt',APPROVED:'Đã duyệt',LOCKED:'Đã khóa'};
const WEATHER_OPTIONS=['Nắng','Nắng nóng','Có mây','Âm u','Mưa nhỏ','Mưa vừa','Mưa to','Giông','Gió mạnh'];
let pendingLogPhotoFiles=[];
let logSaveRunning=false;
function weatherOptionsHtml(current=''){const values=WEATHER_OPTIONS.includes(current)?WEATHER_OPTIONS:(current?[current,...WEATHER_OPTIONS]:WEATHER_OPTIONS);return '<option value="">Chọn thời tiết</option>'+values.map(v=>'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>').join('')}
function addLogPhotoFiles(files){const known=new Set(pendingLogPhotoFiles.map(f=>[f.name,f.size,f.lastModified].join('|')));for(const file of [...(files||[])]){const key=[file.name,file.size,file.lastModified].join('|');if(!known.has(key)){pendingLogPhotoFiles.push(file);known.add(key)}}renderLogPhotoQueue()}
function removeLogPhotoFile(index){pendingLogPhotoFiles.splice(index,1);renderLogPhotoQueue()}
function renderLogPhotoQueue(){const box=document.getElementById('logPhotoQueue');if(!box)return;box.innerHTML=pendingLogPhotoFiles.length?'<b>Ảnh sẽ lưu: '+pendingLogPhotoFiles.length+'</b>'+pendingLogPhotoFiles.map((f,i)=>'<div class="toolbar" style="margin:4px 0"><span style="min-width:0;overflow-wrap:anywhere">'+esc(f.name)+' <span class="muted">('+fileSize(f.size)+')</span></span><button type="button" title="Bỏ ảnh" onclick="removeLogPhotoFile('+i+')">Bỏ</button></div>').join(''):'<span class="muted">Chưa chọn ảnh mới.</span>'}
function renderLogs(){
  const pid=document.getElementById('logProject')?.value||'';
  const addButton=document.getElementById('newLogButton');if(addButton)addButton.style.display=canEditDailyLog()?'':'none';
  if(typeof updateProjectContext==='function')updateProjectContext(pid,'logContextRole');
  const projectLogs=db.logs.filter(x=>!pid||x.projectId===pid);
  const authorSelect=document.getElementById('logAuthor');const oldAuthor=authorSelect?.value||'';
  const authors=[...new Map(projectLogs.map(x=>[x.createdById||x.createdBy||'',{id:x.createdById||x.createdBy||'',name:x.createdBy||'Chưa xác định'}])).values()].filter(x=>x.id).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  if(authorSelect){authorSelect.innerHTML='<option value="">Tất cả người lập</option>'+authors.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');authorSelect.value=authors.some(x=>x.id===oldAuthor)?oldAuthor:''}
  const author=authorSelect?.value||'';
  const list=projectLogs.filter(x=>!author||(x.createdById||x.createdBy||'')===author).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.shift).localeCompare(String(b.shift)));
  const rows=list.map(x=>{
    const project=db.projects.find(p=>p.id===x.projectId)||{};
    return '<tr><td>'+esc(x.date||'')+'<br><span class="muted">'+esc(shiftLabel(x.shift))+'</span></td><td>'+esc(project.name||'')+'</td><td>'+(x.workItem?'<b>'+esc(x.workItem)+'</b><br>':'')+esc(x.work||'')+(x.weather?'<br><span class="muted">Thời tiết: '+esc(x.weather)+'</span>':'')+
      '</td><td>'+esc(x.createdBy||'Chưa xác định')+'</td><td>'+Number(x.workers||0)+'</td><td>'+Number(x.machines||0)+
      '</td><td>'+logStatusBadge(x.status)+returnedChip(x)+syncConflictChip('daily_log',x.id)+'</td><td style="white-space:nowrap">'+logActionsHtml(x)+'</td></tr>';
  }).join('');
  const mySubmit=list.filter(canSubmitLog).map(x=>x.id);
  const toApprove=list.filter(x=>x.serverId&&x.status==='SUBMITTED'&&isLogLead(x.projectId)&&(canManageAssignments()||x.lastReview?.action!=='ESCALATE')).map(x=>x.id);
  const toLock=list.filter(x=>x.serverId&&x.status==='APPROVED'&&isLogLead(x.projectId)).map(x=>x.id);
  const latestDate=list[0]?.date||todayIso();
  const consolidate=pid&&isLogLead(pid)?'<button onclick="openDailyConsolidation(\''+pid+'\',\''+latestDate+'\')">Tổng hợp báo cáo ngày</button>':'';
  const bar=(mySubmit.length||toApprove.length||toLock.length||consolidate)?'<div class="toolbar" style="margin:0 0 10px">'+(mySubmit.length?'<button class="primary" onclick="logBulk(\'submit\','+esc(JSON.stringify(mySubmit))+')">Gửi duyệt tất cả nháp ('+mySubmit.length+')</button>':'')+(toApprove.length?'<button class="primary" onclick="logBulk(\'approve\','+esc(JSON.stringify(toApprove))+')">Duyệt tất cả đang chờ ('+toApprove.length+')</button>':'')+(toLock.length?'<button onclick="logBulk(\'lock\','+esc(JSON.stringify(toLock))+')">Khóa tất cả đã duyệt ('+toLock.length+')</button>':'')+consolidate+'</div>':'';
  const guide='<p class="muted" style="margin:0 0 8px">Quy trình: <b>Nháp</b> (người lập còn sửa) → <b>Gửi duyệt</b> → Trưởng TVGS <b>Duyệt</b> hoặc <b>Trả lại</b> → <b>Khóa</b> (hồ sơ chính thức).</p>';
  document.getElementById('logsTable').innerHTML=guide+bar+(rows?'<table><thead><tr><th>Ngày / ca</th><th>Công trình</th><th>Công việc</th><th>Người lập</th><th>NL</th><th>Máy</th><th>Trạng thái</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="muted">Chưa có báo cáo ngày.</p>');
}
function logResourceRows(kind,rows,total){const list=Array.isArray(rows)&&rows.length?rows:(Number(total)>0?[{type:'Tổng số',count:Number(total)}]:[{type:'',count:0}]);return list.map(x=>'<div class="log-resource-row" style="display:grid;grid-template-columns:minmax(0,1fr) 100px auto;gap:8px;margin:6px 0"><input class="lr-type" value="'+esc(x.type||'')+'" placeholder="'+(kind==='workforce'?'Loại thợ / nhân lực':'Loại máy, thiết bị')+'"><input class="lr-count" type="number" min="0" step="1" value="'+Number(x.count||0)+'" aria-label="Số lượng"><button type="button" title="Xóa dòng" onclick="this.parentElement.remove()">✕</button></div>').join('')}
function addLogResourceRow(kind){const box=document.getElementById(kind+'Rows');if(!box)return;const wrap=document.createElement('div');wrap.className='log-resource-row';wrap.style='display:grid;grid-template-columns:minmax(0,1fr) 100px auto;gap:8px;margin:6px 0';wrap.innerHTML='<input class="lr-type" placeholder="'+(kind==='workforce'?'Loại thợ / nhân lực':'Loại máy, thiết bị')+'"><input class="lr-count" type="number" min="0" step="1" value="0" aria-label="Số lượng"><button type="button" title="Xóa dòng" onclick="this.parentElement.remove()">✕</button>';box.appendChild(wrap);wrap.querySelector('input')?.focus()}
function readLogResourceRows(kind){return [...document.querySelectorAll('#'+kind+'Rows .log-resource-row')].map(r=>({type:(r.querySelector('.lr-type')?.value||'').trim(),count:Math.max(0,Number(r.querySelector('.lr-count')?.value||0))})).filter(x=>x.type||x.count)}
function resourceTotal(rows){return rows.reduce((sum,row)=>sum+Number(row.count||0),0)}
function fillLogProjectDefaults(){const p=db.projects.find(x=>x.id===document.getElementById('lproj')?.value);const unit=document.getElementById('lcontractorUnit');if(unit&&p&&!unit.value.trim())unit.value=p.contractorName||''}
function openLog(lid=''){
pendingLogPhotoFiles=[];
logSaveRunning=false;
if(!canEditDailyLog())return alert('Tài khoản hiện tại không được lập hoặc sửa báo cáo ngày.');
if(!db.projects.length)return alert('Hãy tạo công trình trước.');
let x=db.logs.find(l=>l.id===lid)||{};const isEdit=!!lid;
if(isEdit&&!canEditLog(x))return alert('Báo cáo ngày này không còn được phép sửa.');
const logProjects=isEdit?(db.projects||[]).filter(p=>p.id===x.projectId):logProjectsForCreate();if(!logProjects.length)return alert('Tài khoản chưa được cấp quyền "Thêm" báo cáo ngày ở công trình nào.');
openModal(isEdit?'Sửa báo cáo ngày':'Lập báo cáo ngày',`${isEdit?reviewBlockHtml(x,{history:false}):''}<div class="row"><div><label>C&#x00f4;ng tr&#x00ec;nh</label><select id="lproj">${logProjects.map(p=>`<option value="${p.id}" ${p.id===x.projectId?'selected':''}>${esc(p.code)} - ${esc(p.name)}</option>`).join('')}</select></div><div><label>Ng&#x00e0;y</label><input id="ldate" type="date" value="${x.date||new Date().toISOString().slice(0,10)}"></div><div><label>Ca l&#224;m vi&#7879;c</label><select id="lshift">${SHIFT_OPTIONS.map(([v,t])=>`<option value="${v}" ${(x.shift||'CA1')===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="full"><label>C&#x00f4;ng vi&#x1ec7;c</label><textarea id="lwork" rows="3">${esc(x.work||'')}</textarea></div><div><label>Nh&#x00e2;n l&#x1ef1;c</label><input id="lworkers" type="number" value="${x.workers??0}"></div><div><label>M&#x00e1;y m&#x00f3;c</label><input id="lmachines" type="number" value="${x.machines??0}"></div><div><label>Thời tiết</label><select id="lweather">${weatherOptionsHtml(x.weather||'')}</select></div><div><label>Ghi ch&#x00fa</label><textarea id="lnote" rows="2">${esc(x.note||'')}</textarea></div><div class="full"><label>&#x1ea2;nh hi&#x1ec7;n tr&#x01b0;&#x1edd;ng</label><div class="toolbar"><label class="btn" style="margin:0">Chọn nhiều ảnh<input id="lphotos" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onchange="addLogPhotoFiles(this.files);this.value=''"></label><label class="btn" style="margin:0">Chụp ảnh<input id="lcamera" type="file" accept="image/*" capture="environment" hidden onchange="addLogPhotoFiles(this.files);this.value=''"></label></div><div id="logPhotoQueue"></div><div class="muted">Có thể chọn nhiều ảnh một lần hoặc chụp liên tiếp; mỗi ảnh mới được cộng vào danh sách.</div></div><div class="full"><label>T&#x00e0;i li&#x1ec7;u k&#x00e8;m theo</label><input id="ldocuments" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,image/*" multiple><div class="muted">Cho ph&#x00e9;p t&#x1ea3;i bi&#x00ean b&#x1ea3;n, th&#x01b0; k&#x1ef9; thu&#x1ead;t ho&#x1eb7;c t&#x00e0;i li&#x1ec7;u li&#x00ean quan.</div></div><div class="full toolbar"><button class="primary" onclick="saveLog('${lid}',false)">${isEdit?'Lưu thay đổi':'Lưu nháp'}</button><button onclick="saveLog('${lid}',true)">${isEdit?'Lưu và gửi duyệt':'Lưu và gửi duyệt'}</button><span class="muted">Nháp: còn sửa được. Gửi duyệt: chuyển Trưởng TVGS duyệt, không sửa được nữa.</span></div></div>`);
renderLogPhotoQueue();
const shiftWrap=document.getElementById('lshift')?.parentElement;
shiftWrap?.insertAdjacentHTML('afterend','<div><label>Đơn vị thi công</label><input id="lcontractorUnit" value="'+esc(x.contractorUnit||'')+'" placeholder="Tự điền theo công trình"></div><div class="full"><label>Hạng mục</label><input id="lworkItem" value="'+esc(x.workItem||'')+'" placeholder="Hạng mục được giám sát trong ca"></div><div><label>Cán bộ kỹ thuật (người)</label><input id="ltechnicalStaff" type="number" min="0" step="1" value="'+Number(x.technicalStaff||0)+'"></div><div class="full"><label>Kiến nghị</label><textarea id="lrecommendation" rows="2">'+esc(x.recommendation||'')+'</textarea></div>');
const workersWrap=document.getElementById('lworkers')?.parentElement;const machinesWrap=document.getElementById('lmachines')?.parentElement;
if(workersWrap)workersWrap.innerHTML='<label>Nhân lực theo loại thợ</label><input id="lworkers" type="hidden" value="'+Number(x.workers||0)+'"><div id="workforceRows">'+logResourceRows('workforce',x.workforceDetails,x.workers)+'</div><button type="button" onclick="addLogResourceRow(\'workforce\')">+ Thêm loại thợ</button>';
if(machinesWrap)machinesWrap.innerHTML='<label>Máy móc theo chủng loại</label><input id="lmachines" type="hidden" value="'+Number(x.machines||0)+'"><div id="machineRows">'+logResourceRows('machine',x.machineDetails,x.machines)+'</div><button type="button" onclick="addLogResourceRow(\'machine\')">+ Thêm loại máy</button>';
const ordered=['lcontractorUnit','lworkItem','lweather','ltechnicalStaff','lworkers','lmachines','lwork','lrecommendation','lnote'];let anchor=shiftWrap;for(const fieldId of ordered){const wrap=document.getElementById(fieldId)?.parentElement;if(anchor&&wrap){anchor.after(wrap);anchor=wrap}}
document.getElementById('ldate')?.parentElement?.querySelector('label')?.replaceChildren('Báo cáo ngày');
document.getElementById('lworkers')?.parentElement?.querySelector('label')?.replaceChildren('Nhân công (người)');
document.getElementById('lnote')?.parentElement?.querySelector('label')?.replaceChildren('Ghi chú khác');
document.getElementById('lproj')?.addEventListener('change',fillLogProjectDefaults);if(!isEdit)fillLogProjectDefaults();
}
async function saveLog(lid='',submitAfter=false){
if(!canEditDailyLog())return alert('Bạn không có quyền sửa hoặc lập báo cáo ngày.');
let existing=db.logs.find(l=>l.id===lid);if(existing&&!canEditLog(existing))return alert('Báo cáo ngày không còn được phép sửa.');
let photos=[...(existing?.photos||[])];const photoFiles=[...pendingLogPhotoFiles];
if(photoFiles.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>20*1024*1024))return alert('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 20 MB trước khi tối ưu.');
let documents=[...(existing?.documents||[])];const docFiles=[...(document.getElementById('ldocuments')?.files||[])];
for(const f of docFiles)if(f.size>25*1024*1024)return alert('Tài liệu tối đa 25 MB mỗi tệp.');
const shift=document.getElementById('lshift')?.value||'CA1';
const actor=typeof getAuthUser==='function'?getAuthUser():null;const actorId=existing?.createdById||(actor?.id||'');
const dupLog=db.logs.find(l=>l.id!==existing?.id&&l.projectId===lproj.value&&l.date===ldate.value&&String(l.shift||'CA1')===shift&&(l.createdById||'')===actorId);if(dupLog)return alert('Tài khoản này đã có báo cáo '+shiftLabel(shift)+' ngày '+ldate.value+'. Hãy mở báo cáo đó để sửa.');
if(logSaveRunning)return;logSaveRunning=true;document.querySelectorAll('#modal button').forEach(button=>button.disabled=true);
try{
const workforceDetails=readLogResourceRows('workforce');const machineDetails=readLogResourceRows('machine');
const data={projectId:lproj.value,date:ldate.value,shift,contractorUnit:(document.getElementById('lcontractorUnit')?.value||'').trim(),workItem:(document.getElementById('lworkItem')?.value||'').trim(),technicalStaff:+(document.getElementById('ltechnicalStaff')?.value||0),workforceDetails,machineDetails,work:lwork.value,weather:(document.getElementById('lweather')?.value||'').trim(),workers:resourceTotal(workforceDetails),machines:resourceTotal(machineDetails),recommendation:(document.getElementById('lrecommendation')?.value||'').trim(),note:lnote.value,photos,documents,status:existing?.status||'DRAFT',createdBy:existing?.createdBy||(actor?.full_name||db.role),createdById:actorId,version:(existing?.version||0)+1,expectedRowVersion:existing?.rowVersion??null,updatedAt:new Date().toISOString()};
if(existing){Object.assign(existing,data);audit('UPDATE','daily_log',existing.id,`v${existing.version}`);queueSync('daily_log',existing.id,'UPDATE',data)}else{const x={id:id(),...data,createdAt:new Date().toISOString(),version:1};db.logs.unshift(x);queueSync('daily_log',x.id,'CREATE',data);audit('CREATE_AND_CONFIRM','daily_log',x.id,'v1')}
const savedId=existing?.id||db.logs[0]?.id;
const queuedEntries=[...photoFiles.map(file=>({file,kind:'PHOTO',category:'Ảnh hiện trường'})),...docFiles.map(file=>({file,kind:'DOCUMENT',category:'Tài liệu nhật ký'}))];if(queuedEntries.length)await queueOfflineFiles('daily_log',savedId,queuedEntries);
closeModal();save();if(navigator.onLine&&typeof getAuthToken==='function'&&getAuthToken()&&window.syncPendingDailyLogs)await window.syncPendingDailyLogs();
if(submitAfter){const l=db.logs.find(v=>v.id===savedId);if(l?.serverId&&l.status==='DRAFT')await logAction(l.id,'submit',true);else if(l&&!l.serverId)alert('Báo cáo đã lưu trên thiết bị nhưng chưa lên máy chủ (mất mạng?). Sẽ gửi duyệt được sau khi đồng bộ.')}
if(currentProjectId)renderProjectDetail();
}catch(error){alert('Không lưu được báo cáo: '+(error?.message||error))}finally{logSaveRunning=false;document.querySelectorAll('#modal button').forEach(button=>button.disabled=false)}
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
`Đơn vị thi công: ${x.contractorUnit||''}`,
`Hạng mục: ${x.workItem||''}`,
`Cán bộ kỹ thuật: ${x.technicalStaff||0} người`,
`Nhân lực: ${(x.workforceDetails||[]).map(r=>(r.type||'Nhân lực')+': '+r.count).join('; ')||x.workers||0}`,
`Máy móc: ${(x.machineDetails||[]).map(r=>(r.type||'Máy')+': '+r.count).join('; ')||x.machines||0}`,
`Công việc: ${x.work||''}`,
`Thời tiết: ${x.weather||''}`,
`Trạng thái: ${LOG_STATUS[x.status]||x.status||''}`,
`Kiến nghị: ${x.recommendation||''}`,
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
function fillReportFromLogs(){const pid=document.getElementById('dproj')?.value||'';const logs=db.logs.filter(x=>x.projectId===pid);if(!logs.length)return alert('Chưa có nhật ký để tổng hợp.');const latest=logs.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];const avg=logs.reduce((n,x)=>n+Number(x.workers||0),0)/logs.length;const planned=Number(document.getElementById('dplanned')?.value||0);const actual=Number(latest.progress||0);document.getElementById('dactual').value=actual;document.getElementById('dmanpower').value=Math.round(avg);document.getElementById('dschedule').value=actual>planned?'AHEAD':(actual<planned?'DELAYED':'ON_TRACK')}

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
    const protectedIds = new Set((db.sync || []).filter(x => x.type === 'daily_log' && (x.status === 'PENDING' || x.status === 'CONFLICT')).map(x => x.recordId));
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
          if(protectedIds.has(serverId) || (localIndex >= 0 && protectedIds.has(db.logs[localIndex].id))) continue;

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
