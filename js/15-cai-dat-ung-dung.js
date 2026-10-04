let vinaInstallPrompt = null;

function vinaAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallAppButton() {
  const button = document.getElementById('installAppButton');
  const status = document.getElementById('installAppStatus');
  if (!button || !status) return;
  const installed = vinaAppInstalled();
  button.disabled = installed;
  button.textContent = installed ? 'Đã cài đặt' : 'Cài ứng dụng';
  status.textContent = installed
    ? 'Ứng dụng đang chạy ở chế độ độc lập trên thiết bị này.'
    : 'Dữ liệu vẫn được lưu tập trung trên máy chủ và đồng bộ cho mọi thiết bị.';
}

async function installVinaApp() {
  if (vinaAppInstalled()) return updateInstallAppButton();
  if (vinaInstallPrompt) {
    vinaInstallPrompt.prompt();
    await vinaInstallPrompt.userChoice;
    vinaInstallPrompt = null;
    return updateInstallAppButton();
  }

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const message = ios
    ? 'Trong Safari, mở menu Chia sẻ rồi chọn “Thêm vào Màn hình chính”.'
    : 'Mở menu của trình duyệt và chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.';
  openModal('Cài VINA-SUPERVISION', '<p>' + message + '</p><p class="muted">Thiết bị phải duy trì kết nối Tailscale để đọc và cập nhật dữ liệu tập trung.</p>');
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  vinaInstallPrompt = event;
  updateInstallAppButton();
});
window.addEventListener('appinstalled', () => {
  vinaInstallPrompt = null;
  updateInstallAppButton();
});
updateInstallAppButton();
