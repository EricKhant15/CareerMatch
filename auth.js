const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const authModeInput = document.querySelector("#authMode");
const authTitle = document.querySelector("#authTitle");
const authSubtitle = document.querySelector("#authSubtitle");
const authSubmit = document.querySelector("#authSubmit");
const authHelper = document.querySelector("#authHelper");
const nameField = document.querySelector("#nameField");
const fullNameInput = document.querySelector("input[name='fullName']");
const modeButtons = document.querySelectorAll("[data-auth-mode]");

function setAuthMode(mode) {
  const isSignup = mode === "signup";

  authModeInput.value = mode;
  authTitle.textContent = isSignup ? "Create account" : "Sign in";
  authSubtitle.textContent = isSignup
    ? "Create your account, then continue to CareerMatch."
    : "Continue to your CareerMatch account.";
  authSubmit.textContent = isSignup ? "Create account" : "Sign in";
  authHelper.textContent = isSignup
    ? "Already have an account? Choose Sign in above."
    : "New to CareerMatch? Choose Create account above.";

  nameField.classList.toggle("is-hidden", !isSignup);
  fullNameInput.required = isSignup;

  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });

  authMessage.textContent = "";
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (typeof supabaseClient === "undefined") {
    authMessage.textContent = "Connect Supabase first in supabase-config.js.";
    return;
  }

  const formData = new FormData(authForm);
  const mode = formData.get("mode");
  const role = formData.get("role");
  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const password = formData.get("password");

  authMessage.textContent = "Please wait...";

  if (mode === "signup") {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      authMessage.textContent = error.message;
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabaseClient.from("profiles").insert({
        id: data.user.id,
        email,
        role,
        full_name: fullName,
        account_status: role === "company" ? "pending" : "approved",
      });

      if (profileError) {
        authMessage.textContent = profileError.message;
        return;
      }
    }

    setAuthMode("login");
    authMessage.textContent =
      role === "company"
        ? "Company account created. Please wait for admin approval."
        : "Account created. You can sign in now.";

    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, account_status")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    authMessage.textContent = profileError.message;
    return;
  }

  if (profile.role === "company" && profile.account_status !== "approved") {
    await supabaseClient.auth.signOut();
    authMessage.textContent = "Your company account is waiting for admin approval.";
    return;
  }

  if (profile.role === "admin") {
    window.location.href = "admin/companies.html";
    return;
  }

  if (profile.role === "student") {
    const { data: studentProfile, error: studentProfileError } = await supabaseClient
      .from("students")
      .select("id")
      .eq("profile_id", data.user.id)
      .maybeSingle();
  
    if (studentProfileError) {
      authMessage.textContent = studentProfileError.message;
      return;
    }
  
    window.location.href = studentProfile ? "student/dashboard.html" : "student/onboarding.html";
    return;
  }
  
  window.location.href = "company/dashboard.html";
});