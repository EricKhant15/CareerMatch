const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const authModeInput = document.querySelector("#authMode");
const authTitle = document.querySelector("#authTitle");
const authSubtitle = document.querySelector("#authSubtitle");
const authSubmit = document.querySelector("#authSubmit");
const authHelper = document.querySelector("#authHelper");
const nameField = document.querySelector("#nameField");
const nameLabel = document.querySelector("#nameLabel");
const fullNameInput = document.querySelector("#fullNameInput");
const accountTypeInput = document.querySelector("#accountType");
const companyFields = document.querySelector("#companyFields");
const modeButtons = document.querySelectorAll("[data-auth-mode]");
const passwordInput = document.querySelector("#passwordInput");
const showPasswordInput = document.querySelector("#showPassword");

function isCompanySignup() {
  return (
    authModeInput.value === "signup" &&
    accountTypeInput.value === "company"
  );
}

function updateCompanyFields() {
  const showCompanyFields = isCompanySignup();

  companyFields.classList.toggle(
    "is-hidden",
    !showCompanyFields
  );

  nameLabel.textContent = showCompanyFields
    ? "Company name"
    : "Full name";

  fullNameInput.placeholder = showCompanyFields
    ? "Enter the registered company name"
    : "Enter your full name";

  companyFields
    .querySelectorAll("[data-company-required]")
    .forEach((input) => {
      input.required = showCompanyFields;
    });
}

function setAuthMode(mode) {
  const isSignup = mode === "signup";

  authModeInput.value = mode;

  authTitle.textContent = isSignup
    ? "Create account"
    : "Sign in";

  authSubtitle.textContent = isSignup
    ? "Create your account to continue to CareerMatch."
    : "Continue to your CareerMatch account.";

  authSubmit.textContent = isSignup
    ? "Create account"
    : "Sign in";

  authHelper.textContent = isSignup
    ? "Already have an account? Choose Sign in above."
    : "New to CareerMatch? Choose Create account above.";

  nameField.classList.toggle("is-hidden", !isSignup);
  fullNameInput.required = isSignup;

  modeButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.authMode === mode
    );
  });

  updateCompanyFields();
  authMessage.textContent = "";
}

function getSafeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-");
}

async function uploadVerificationDocument(userId, file) {
  const safeName = getSafeFileName(file.name);
  const filePath = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await supabaseClient.storage
    .from("company-verification")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
}

async function createProfile({
  userId,
  email,
  role,
  fullName,
}) {
  const { error } = await supabaseClient
    .from("profiles")
    .insert({
      id: userId,
      email,
      role,
      full_name: fullName,
      account_status:
        role === "company"
          ? "pending"
          : "approved",
    });

  if (error) {
    throw error;
  }
}

async function createCompanyVerification({
  userId,
  email,
  fullName,
  formData,
  documentPath,
}) {
  const yearEstablished =
    formData.get("yearEstablished");

  const { error } = await supabaseClient
    .from("companies")
    .insert({
      profile_id: userId,
      company_name: fullName,
      industry: formData.get("industry"),
      location: formData.get("companyLocation"),
      website: formData.get("website"),
      description: formData.get("companyDescription"),
      contact_name: formData.get("contactName"),
      contact_email: email,
      company_size: formData.get("companySize"),
      year_established: yearEstablished
        ? Number(yearEstablished)
        : null,
      phone_number: formData.get("phoneNumber"),
      contact_position: formData.get("contactPosition"),
      registration_number:
        formData.get("registrationNumber"),
      linkedin_url:
        formData.get("linkedinUrl") || null,
      verification_document_url: documentPath,
      approval_status: "Pending",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

async function handleSignup(formData) {
  const role = formData.get("role");
  const fullName = formData
    .get("fullName")
    .trim();

  const email = formData
    .get("email")
    .trim()
    .toLowerCase();

  const password = formData.get("password");

  if (!fullName) {
    throw new Error(
      role === "company"
        ? "Enter the company name."
        : "Enter your full name."
    );
  }

  let verificationDocument = null;

  if (role === "company") {
    verificationDocument = formData.get(
      "verificationDocument"
    );

    if (
      !verificationDocument ||
      verificationDocument.size === 0
    ) {
      throw new Error(
        "Upload a company verification document."
      );
    }

    if (verificationDocument.size > 5242880) {
      throw new Error(
        "The verification document must be 5 MB or smaller."
      );
    }

    const acceptedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
    ];

    if (
      !acceptedTypes.includes(
        verificationDocument.type
      )
    ) {
      throw new Error(
        "Upload a PDF, PNG, or JPG document."
      );
    }

    if (
      formData.get("informationConfirmed") !== "on"
    ) {
      throw new Error(
        "Confirm that the company information is accurate."
      );
    }
  }

  const { data, error } =
    await supabaseClient.auth.signUp({
      email,
      password,
    });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(
      "The account could not be created."
    );
  }

  await createProfile({
    userId: data.user.id,
    email,
    role,
    fullName,
  });

  if (role === "company") {
    const documentPath =
      await uploadVerificationDocument(
        data.user.id,
        verificationDocument
      );

    try {
      await createCompanyVerification({
        userId: data.user.id,
        email,
        fullName,
        formData,
        documentPath,
      });
    } catch (error) {
      await supabaseClient.storage
        .from("company-verification")
        .remove([documentPath]);

      throw error;
    }
  }

  await supabaseClient.auth.signOut();

  setAuthMode("login");

  authMessage.textContent =
    role === "company"
      ? "Your company verification was submitted. You can sign in after admin approval."
      : "Account created. You can now sign in.";
}

async function handleLogin(formData) {
  const email = formData
    .get("email")
    .trim()
    .toLowerCase();

  const password = formData.get("password");

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    throw error;
  }

  const {
    data: profile,
    error: profileError,
  } = await supabaseClient
    .from("profiles")
    .select("role, account_status")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  if (profile.role === "admin") {
    window.location.href =
      "admin/companies.html";
    return;
  }

  if (profile.role === "company") {
    if (profile.account_status === "pending") {
      await supabaseClient.auth.signOut();

      throw new Error(
        "Your company verification is waiting for admin approval."
      );
    }

    if (profile.account_status === "rejected") {
      await supabaseClient.auth.signOut();

      throw new Error(
        "Your company verification was rejected."
      );
    }

    if (profile.account_status !== "approved") {
      await supabaseClient.auth.signOut();

      throw new Error(
        "This company account cannot currently access CareerMatch."
      );
    }

    window.location.href =
      "company/dashboard.html";
    return;
  }

  if (profile.role === "student") {
    const {
      data: studentProfile,
      error: studentProfileError,
    } = await supabaseClient
      .from("students")
      .select("id")
      .eq("profile_id", data.user.id)
      .maybeSingle();

    if (studentProfileError) {
      throw studentProfileError;
    }

    window.location.href = studentProfile
      ? "student/dashboard.html"
      : "student/onboarding.html";
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAuthMode(button.dataset.authMode);
  });
});

accountTypeInput.addEventListener(
  "change",
  updateCompanyFields
);

showPasswordInput.addEventListener(
  "change",
  () => {
    passwordInput.type =
      showPasswordInput.checked
        ? "text"
        : "password";
  }
);

authForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (
      typeof supabaseClient === "undefined"
    ) {
      authMessage.textContent =
        "Connect Supabase first in supabase-config.js.";
      return;
    }

    const formData = new FormData(authForm);
    const mode = formData.get("mode");

    authSubmit.disabled = true;
    authMessage.textContent = "Please wait...";

    try {
      if (mode === "signup") {
        await handleSignup(formData);
      } else {
        await handleLogin(formData);
      }
    } catch (error) {
      authMessage.textContent =
        error.message ||
        "Something went wrong. Please try again.";
    } finally {
      authSubmit.disabled = false;
    }
  }
);

setAuthMode("login");