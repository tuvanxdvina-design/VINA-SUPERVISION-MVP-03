
window.addEventListener('load', async () => {
  if(typeof getAuthToken!=='function' || !getAuthToken()) return;
  try {
    const projects = await apiGetProjects();
    if (Array.isArray(projects)) {
      mergeProjectsFromServer(projects);
      save();
      console.log('VINA-SUPERVISION: Đã đồng bộ công trình từ PostgreSQL:', projects.length);
    }
  } catch (error) {
    console.warn('VINA-SUPERVISION: Không đồng bộ được PostgreSQL, tiếp tục dùng dữ liệu local:', error.message);
  }
});
