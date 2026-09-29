const SHIFT_OPTIONS=[['CA1','Ca 1 (sáng)'],['CA2','Ca 2 (chiều)'],['CA3','Ca 3 (tối/đêm)']];
function shiftLabel(code){const c=String(code||'CA1').toUpperCase();const f=SHIFT_OPTIONS.find(x=>x[0]===c);return f?f[1]:c.replace(/^CA(\d+)$/,'Ca $1')}
const LOG_STATUS={DRAFT:'Nháp',SUBMITTED:'Chờ duyệt',APPROVED:'Đã duyệt',LOCKED:'Đã khóa'};
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
