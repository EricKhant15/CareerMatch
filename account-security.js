const changePasswordForm = document.querySelector("#changePasswordForm");
const changePasswordButton = document.querySelector("#changePasswordButton");
const changePasswordMessage = document.querySelector("#changePasswordMessage");
const securityAccountEmail = document.querySelector("#securityAccountEmail");
const securityBackLink = document.querySelector("#securityBackLink");
const showChangePasswords = document.querySelector("#showChangePasswords");

let accountUser = null;

showChangePasswords.addEventListener("change", () => {
  changePasswordForm
    .querySelectorAll('input[type="password"], input[type="text"][name$="Password"]')
    .forEach((input) => {
      input.type = showChangePasswords.checked ? "text" : "password";
    });
});

async function initializeAccountSecurity() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    window.location.replace("login.html");
    return;
  }

  accountUser = data.user;
  securityAccountEmail.textContent = `Signed in as ${accountUser.email}`;
  changePasswordForm.hidden = false;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", accountUser.id)
    .maybeSingle();

  securityBackLink.href = profile?.role === "company"
    ? "company/dashboard.html"
    : profile?.role === "admin"
      ? "admin/analytics.html"
      : "student/profile.html";
}

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(changePasswordForm);
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (newPassword.length < 6) {
    changePasswordMessage.textContent = "Your new password must contain at least 6 characters.";
    return;
  }

  if (newPassword !== confirmPassword) {
    changePasswordMessage.textContent = "The two new passwords do not match.";
    return;
  }

  if (newPassword === currentPassword) {
    changePasswordMessage.textContent = "Choose a password different from your current password.";
    return;
  }

  changePasswordButton.disabled = true;
  changePasswordMessage.textContent = "Checking current password...";

  const { error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: accountUser.email,
    password: currentPassword,
  });

  if (signInError) {
    changePasswordMessage.textContent = "The current password is incorrect.";
    changePasswordButton.disabled = false;
    return;
  }

  changePasswordMessage.textContent = "Updating password...";
  const { error: updateError } = await supabaseClient.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    changePasswordMessage.textContent = updateError.message;
    changePasswordButton.disabled = false;
    return;
  }

  await supabaseClient.auth.signOut();
  window.location.replace("login.html?password=changed");
});

initializeAccountSecurity();
