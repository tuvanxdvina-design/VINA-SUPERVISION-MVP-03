
(function(){
  const AUTH_KEY = 'vina_supervision_auth';

  function getAuth(){
    try{
      return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    }catch(_){
      return null;
    }
  }

  function setLoginVisibility(){
    const screen=document.getElementById('loginScreen');
    if(!screen) return;

    const auth=getAuth();
    screen.style.display=auth?.token ? 'none' : 'flex';
  }

  window.vinaDoLogin = async function(){
    const username=document.getElementById('loginUsername')?.value.trim();
    const password=document.getElementById('loginPassword')?.value || '';
    const button=document.getElementById('loginButton');
    const error=document.getElementById('loginError');

    if(error){
      error.style.display='none';
      error.textContent='';
    }

    if(!username || !password){
      if(error){
        error.textContent='Nhập đầy đủ tên đăng nhập và mật khẩu.';
        error.style.display='block';
      }
      return;
    }

    button.disabled=true;
    button.textContent='Đang đăng nhập...';

    try{
      const data=await apiLogin(username,password);

      if(data?.user){
        let backendRole =
          data.user.role_name ||
          data.user.roleName ||
          data.user.role ||
          data.user.role_name_vi ||
          '';

        if(!backendRole && data.user.role_id && typeof apiRequest==='function'){
          try{
            const roleData = await apiRequest(
              '/roles/' + encodeURIComponent(data.user.role_id)
            );
            backendRole = roleData?.name || '';
          }catch(_){}
        }

        const roleMap = {
          DIRECTOR: '\u0047i\u00e1m \u0111\u1ed1c',
          ADMIN: 'Admin',
          TVGS_LEAD: '\u0054r\u01b0\u1edfng TVGS',
          ENGINEER: 'K\u1ef9 s\u01b0 TVGS',
        MANAGER: 'Qu\u1ea3n l\u00fd'
        };

        const role = roleMap[backendRole] || backendRole;

        if(role && typeof db!=='undefined'){
          db.role=role;
          persistLocal();
        }
      }

      setLoginVisibility();
      location.reload();
    }catch(errorObj){
      if(error){
        error.textContent=errorObj?.message || 'Đăng nhập thất bại.';
        error.style.display='block';
      }
    }finally{
      button.disabled=false;
      button.textContent='Đăng nhập';
    }
  };

  window.vinaLogout = function(){
    if(typeof clearAuthSession==='function'){
      clearAuthSession();
    }
    location.reload();
  };

  async function syncAuthenticatedRole(){
    try{
      const user = getAuthUser && getAuthUser();
      const token = getAuthToken && getAuthToken();

      if(!user || !token || !user.role_id || typeof apiRequest!=='function'){
        return;
      }

      const roleData = await apiRequest(
        '/roles/' + encodeURIComponent(user.role_id)
      );

      const backendRole = roleData?.name || '';

      const roleMap = {
        DIRECTOR: '\u0047i\u00e1m \u0111\u1ed1c',
        ADMIN: 'Admin',
        TVGS_LEAD: '\u0054r\u01b0\u1edfng TVGS',
        ENGINEER: 'K\u1ef9 s\u01b0 TVGS',
        MANAGER: 'Qu\u1ea3n l\u00fd'
      };

      const role = roleMap[backendRole] || backendRole;

      if(role && typeof db!=='undefined'){
        db.role = role;
        persistLocal();
        renderAll();
      }
    }catch(error){
      console.warn(
        'VINA-SUPERVISION: Không đồng bộ role đăng nhập:',
        error.message
      );
    }
  }

  window.addEventListener('load',async()=>{
    setLoginVisibility();
    await syncAuthenticatedRole();
  });
})();
