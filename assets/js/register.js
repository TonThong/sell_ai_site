const STORAGE_KEY = "sell_ai_registered_user";

const registerForm = document.getElementById("register-form");
const savedProfile = document.getElementById("saved-profile");
const storageJson = document.getElementById("storage-json");
const formStatus = document.getElementById("form-status");
const clearStorageButton = document.getElementById("clear-storage");

function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function renderStoredProfile(user) {
  if (!user) {
    savedProfile.innerHTML = `
      <div class="saved-empty">
        Chưa có dữ liệu đăng ký nào trong local storage.
      </div>
    `;
    storageJson.textContent = "No data saved yet.";
    return;
  }

  savedProfile.innerHTML = `
    <div class="saved-item">
      <strong>${user.fullName}</strong>
      <div class="saved-list">
        <div class="saved-list-row"><span>Email</span><span>${user.email}</span></div>
        <div class="saved-list-row"><span>Phone</span><span>${user.phone}</span></div>
        <div class="saved-list-row"><span>Plan</span><span>${user.plan}</span></div>
        <div class="saved-list-row"><span>Company</span><span>${user.company || "-"}</span></div>
        <div class="saved-list-row"><span>Password</span><span>${user.hasPassword ? "Configured" : "Not set"}</span></div>
        <div class="saved-list-row"><span>Updated</span><span>${user.savedAt}</span></div>
        <div class="saved-list-row"><span>Note</span><span>${user.note || "-"}</span></div>
      </div>
    </div>
  `;

  storageJson.textContent = JSON.stringify(user, null, 2);
}

function fillForm(user) {
  if (!user) {
    return;
  }

  registerForm.fullName.value = user.fullName || "";
  registerForm.email.value = user.email || "";
  registerForm.phone.value = user.phone || "";
  registerForm.plan.value = user.plan || "Claude PRO";
  registerForm.company.value = user.company || "";
  registerForm.note.value = user.note || "";
}

function setStatus(message) {
  formStatus.textContent = message;
}

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const password = registerForm.password.value.trim();
  const confirmPassword = registerForm.confirmPassword.value.trim();

  if (password.length < 6) {
    setStatus("Password cần ít nhất 6 ký tự.");
    return;
  }

  if (password !== confirmPassword) {
    setStatus("Password và Confirm password chưa khớp.");
    return;
  }

  const user = {
    fullName: registerForm.fullName.value.trim(),
    email: registerForm.email.value.trim(),
    phone: registerForm.phone.value.trim(),
    plan: registerForm.plan.value,
    company: registerForm.company.value.trim(),
    note: registerForm.note.value.trim(),
    hasPassword: true,
    savedAt: new Date().toLocaleString("vi-VN")
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  renderStoredProfile(user);
  registerForm.password.value = "";
  registerForm.confirmPassword.value = "";
  setStatus("Đã lưu thông tin đăng ký vào local storage.");
});

clearStorageButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  registerForm.reset();
  renderStoredProfile(null);
  setStatus("Đã xóa dữ liệu đăng ký khỏi local storage.");
});

const storedUser = getStoredUser();
fillForm(storedUser);
renderStoredProfile(storedUser);
