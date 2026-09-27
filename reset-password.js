const resetPasswordForm = document.querySelector("#resetPasswordForm");
const resetPasswordStatus = document.querySelector("#resetPasswordStatus");
const resetPasswordMessage = document.querySelector("#resetPasswordMessage");
const resetPasswordButton = document.querySelector("#resetPasswordButton");
const showResetPasswords = document.querySelector("#showResetPasswords");
const recoveryCallbackUrl = new URL(
  window.careerMatchRecoveryCallback || window.location.href
);
const recoveryQuery = recoveryCallbackUrl.searchParams;
const recoveryHash = new URLSearchParams(
  recoveryCallbackUrl.hash.replace(/^#/, "")
);
const recoveryCode = recoveryQuery.get("code");
const recoveryTokenHash = recoveryQuery.get("token_hash");
const recoveryAccessToken = recoveryHash.get("access_token");
const recoveryRefreshToken = recoveryHash.get("refresh_token");
const recoveryType = recoveryQuery.get("type") || recoveryHash.get("type");
const recoveryError =
  recoveryQuery.get("error_description") ||
  recoveryHash.get("error_description");
const hasRecoveryProof = Boolean(
  recoveryCode ||
  recoveryTokenHash ||
  recoveryAccessToken ||
  recoveryType === "recovery"
);

let recoveryReady = false;

showResetPasswords.addEventListener("change", () => {
  resetPasswordForm
    .querySelectorAll('input[type="password"], input[type="text"][name$="Password"]')
    .forEach((input) => {
      input.type = showResetPasswords.checked ? "text" : "password";
    });
});

function enableResetForm() {
  recoveryReady = true;
  resetPasswordForm.hidden = false;
  resetPasswordStatus.textContent = "Your link is verified. Enter your new password below.";
  window.history.replaceState({}, document.title, window.location.pathname);
}

function rejectResetLink(message) {
  recoveryReady = false;
  resetPasswordForm.hidden = true;
  resetPasswordStatus.textContent = message;
}

async function initializePasswordReset() {
  if (recoveryError) {
    rejectResetLink(
      "This reset link is invalid, expired, or has already been used. Request a new link and open only the newest email."
    );
    return;
  }

  const { data: authListener } = supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        enableResetForm();
      }
    }
  );

  let { data, error } = await supabaseClient.auth.getSession();

  if ((!data.session || error) && recoveryCode) {
    const exchangeResult = await supabaseClient.auth.exchangeCodeForSession(
      recoveryCode
    );
    data = exchangeResult.data;
    error = exchangeResult.error;
  }

  if (
    (!data.session || error) &&
    recoveryAccessToken &&
    recoveryRefreshToken
  ) {
    const sessionResult = await supabaseClient.auth.setSession({
      access_token: recoveryAccessToken,
      refresh_token: recoveryRefreshToken,
    });
    data = sessionResult.data;
    error = sessionResult.error;
  }

  if ((!data.session || error) && recoveryTokenHash) {
    const verificationResult = await supabaseClient.auth.verifyOtp({
      token_hash: recoveryTokenHash,
      type: "recovery",
    });
    data = verificationResult.data;
    error = verificationResult.error;
  }

  if (!error && data.session && hasRecoveryProof) {
    enableResetForm();
    authListener.subscription.unsubscribe();
    return;
  }

  rejectResetLink(
    "This reset link is invalid, expired, or has already been used. Request a new link and open only the newest email."
  );
  authListener.subscription.unsubscribe();
}

resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(resetPasswordForm);
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (newPassword.length < 6) {
    resetPasswordMessage.textContent = "Your password must contain at least 6 characters.";
    return;
  }

  if (newPassword !== confirmPassword) {
    resetPasswordMessage.textContent = "The two passwords do not match.";
    return;
  }

  resetPasswordButton.disabled = true;
  resetPasswordMessage.textContent = "Updating password...";

  const { data: sessionData } = await supabaseClient.auth.getSession();

  if (!sessionData.session || !recoveryReady) {
    rejectResetLink(
      "Your reset session has expired. Request a new reset email and try again."
    );
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    resetPasswordMessage.textContent = error.message;
    resetPasswordButton.disabled = false;
    return;
  }

  await supabaseClient.auth.signOut();
  window.location.replace("login.html?password=changed");
});

initializePasswordReset();
