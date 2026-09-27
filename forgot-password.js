const forgotPasswordForm = document.querySelector("#forgotPasswordForm");
const forgotPasswordMessage = document.querySelector("#forgotPasswordMessage");
const resetEmailButton = document.querySelector("#resetEmailButton");

forgotPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = new FormData(forgotPasswordForm).get("email")?.trim();
  resetEmailButton.disabled = true;
  forgotPasswordMessage.textContent = "Sending reset link...";

  try {
    const redirectTo = new URL("reset-password.html", window.location.href).href;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("Password reset email could not be sent:", error.message);
    }

    forgotPasswordMessage.textContent =
      "If that email belongs to a CareerMatch account, a reset link has been sent. Check your inbox and spam folder.";
    forgotPasswordForm.reset();
  } catch (error) {
    console.error("Password reset request failed:", error);
    forgotPasswordMessage.textContent =
      "We could not send the reset email right now. Please try again shortly.";
  } finally {
    resetEmailButton.disabled = false;
  }
});
