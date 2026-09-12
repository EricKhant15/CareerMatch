const interviewState = {
  company: null,
  listings: new Map(),
  applications: [],
  students: new Map(),
  profiles: new Map(),
  selectedApplicationId: null,
};

function interviewElement(id) {
  return document.getElementById(id);
}

function setInterviewMessage(message, type = "info") {
  const colors = { error: "#d92d3e", success: "#169c4b", info: "#7224e8" };
  const element = interviewElement("interviewsMessage");
  element.textContent = message;
  element.style.color = colors[type] || colors.info;
}

function getInterviewApplication(id = interviewState.selectedApplicationId) {
  return interviewState.applications.find((item) => item.id === id);
}

function getCandidateName(application) {
  const student = interviewState.students.get(application?.student_id);
  return student
    ? interviewState.profiles.get(student.profile_id)?.full_name || "Student"
    : "Student";
}

function getListingTitle(application) {
  return interviewState.listings.get(application?.listing_id)?.title || "Internship";
}

function getSelectedCountForListing(listingId) {
  return interviewState.applications.filter(
    (item) =>
      item.listing_id === listingId &&
      item.offer_status === "Accepted"
  ).length;
}

function setInterviewFormValue(id, value) {
  interviewElement(id).value = value || "";
}

function normalizeInterviewStage(value) {
  const legacyStages = {
    "First Interview": "Initial Interview",
    "Technical Interview": "Technical / Portfolio Interview",
    "Portfolio Interview": "Technical / Portfolio Interview",
    "Second Interview": "Final Interview",
  };
  return legacyStages[value] || value || "Initial Interview";
}

function getNextInterviewStage(currentStage) {
  const stage = normalizeInterviewStage(currentStage);
  if (stage === "Initial Interview") return "Technical / Portfolio Interview";
  if (stage === "Technical / Portfolio Interview") return "Final Interview";
  return null;
}

function fillInterviewForm(application) {
  if (!application) return;
  interviewState.selectedApplicationId = application.id;
  setInterviewFormValue("interviewApplication", application.id);
  setInterviewFormValue("interviewRound", normalizeInterviewStage(application.interview_round));
  setInterviewFormValue("interviewDate", application.interview_date);
  setInterviewFormValue("interviewTime", String(application.interview_time || "").slice(0, 5));
  setInterviewFormValue("interviewType", application.interview_type || "Online");
  setInterviewFormValue("interviewerName", application.interviewer);
  setInterviewFormValue("meetingLink", application.meeting_link);
  setInterviewFormValue("interviewLocation", application.interview_location);
  setInterviewFormValue("interviewMessage", application.interview_message);
  interviewElement("inviteStatus").textContent = application.interview_status || "New invitation";
  const completed = application.interview_status === "Completed";
  interviewElement("sendInterviewButton").disabled = completed;
  interviewElement("saveInterviewDraftButton").disabled = completed;
  interviewElement("cancelInterviewButton").disabled = completed;
  renderFinalDecision(application);
}

function getInterviewPayload(interviewStatus) {
  return {
    interview_round: interviewElement("interviewRound").value,
    interview_date: interviewElement("interviewDate").value || null,
    interview_time: interviewElement("interviewTime").value || null,
    interview_type: interviewElement("interviewType").value,
    interviewer: interviewElement("interviewerName").value.trim() || null,
    meeting_link: interviewElement("meetingLink").value.trim() || null,
    interview_location: interviewElement("interviewLocation").value.trim() || null,
    interview_message: interviewElement("interviewMessage").value.trim() || null,
    interview_status: interviewStatus,
    interview_updated_at: new Date().toISOString(),
  };
}

function formatInterviewDate(application) {
  if (!application.interview_date) return "Not scheduled";
  const date = new Date(`${application.interview_date}T00:00:00`);
  const dateText = Number.isNaN(date.getTime())
    ? application.interview_date
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      }).format(date);
  return application.interview_time
    ? `${dateText}, ${String(application.interview_time).slice(0, 5)}`
    : dateText;
}

function renderInterviewStats() {
  const applications = interviewState.applications;
  interviewElement("scheduledInterviewCount").textContent = applications.filter(
    (item) => item.interview_status === "Sent"
  ).length;
  interviewElement("draftInterviewCount").textContent = applications.filter(
    (item) => item.interview_status === "Draft"
  ).length;
  const today = new Date().toISOString().slice(0, 10);
  interviewElement("upcomingInterviewCount").textContent = applications.filter(
    (item) => item.interview_status === "Sent" && item.interview_date >= today
  ).length;
  interviewElement("completedInterviewCount").textContent = applications.filter(
    (item) => item.interview_status === "Completed"
  ).length;
}

function renderCandidateOptions() {
  const select = interviewElement("interviewApplication");
  const current = select.value;
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a shortlisted candidate";
  select.appendChild(placeholder);
  interviewState.applications
    .filter((item) => item.interview_status !== "Completed" && item.status !== "Rejected")
    .forEach((application) => {
      const option = document.createElement("option");
      option.value = application.id;
      option.textContent = `${getCandidateName(application)} — ${getListingTitle(application)}`;
      select.appendChild(option);
    });
  select.value = interviewState.selectedApplicationId || current || "";
}

function renderInterviewTable() {
  const body = interviewElement("interviewTableBody");
  body.replaceChildren();
  const interviews = interviewState.applications.filter((item) => item.interview_status);
  if (!interviews.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No interviews have been created yet.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  interviews.forEach((application) => {
    const row = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = getCandidateName(application);
    const role = document.createElement("td");
    role.textContent = getListingTitle(application);
    const date = document.createElement("td");
    date.textContent = formatInterviewDate(application);
    const type = document.createElement("td");
    type.textContent = application.interview_type || "Not set";
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = application.interview_status === "Sent" ? "status interview" : "status review";
    status.textContent = application.offer_status
      ? `Offer ${application.offer_status}`
      : application.interview_status;
    statusCell.appendChild(status);
    const action = document.createElement("td");
    const edit = document.createElement("button");
    edit.className = "secondary-btn";
    edit.type = "button";
    edit.textContent = application.interview_status === "Completed" ? "View Decision" : "Edit";
    edit.addEventListener("click", () => {
      fillInterviewForm(application);
      interviewElement("schedule-panel").scrollIntoView({ behavior: "smooth" });
    });
    action.appendChild(edit);
    row.append(name, role, date, type, statusCell, action);
    body.appendChild(row);
  });
}

function renderFinalDecision(application) {
  const panel = interviewElement("finalDecisionPanel");
  const eligible = application && ["Sent", "Completed"].includes(application.interview_status);
  panel.hidden = !eligible;
  if (!eligible) return;
  interviewElement("finalDecisionCandidate").textContent =
    `${getCandidateName(application)} — ${getListingTitle(application)}. Current status: ${application.status}.`;
  const completed = application.interview_status === "Completed";
  const listing = interviewState.listings.get(application.listing_id);
  const listingFull = listing && getSelectedCountForListing(listing.id) >= (Number(listing.openings) || 1);
  interviewElement("finalAcceptButton").disabled = completed || listingFull;
  interviewElement("finalAcceptButton").title = listingFull
    ? "All internship positions have already been filled."
    : "";
  interviewElement("finalRejectButton").disabled = completed;
  const nextStage = getNextInterviewStage(application.interview_round);
  const nextStageButton = interviewElement("secondInterviewButton");
  nextStageButton.disabled = completed || !nextStage;
  nextStageButton.textContent = nextStage ? `Schedule ${nextStage}` : "Final Stage Reached";
}

async function notifyInterviewStudent(applicationId, title, message) {
  const { error } = await supabaseClient.rpc("notify_application_student", {
    p_application_id: applicationId,
    p_title: title,
    p_message: message,
  });
  if (error) throw error;
}

async function saveInterview(interviewStatus) {
  const application = getInterviewApplication(interviewElement("interviewApplication").value);
  if (!application) {
    setInterviewMessage("Choose a shortlisted candidate first.", "error");
    return;
  }
  if (interviewStatus === "Sent" && !interviewElement("interviewForm").reportValidity()) return;
  if (
    interviewStatus === "Sent" &&
    interviewElement("interviewType").value === "Online" &&
    !interviewElement("meetingLink").value.trim()
  ) {
    setInterviewMessage("Add the online meeting link before sending the invitation.", "error");
    return;
  }

  const payload = getInterviewPayload(interviewStatus);
  payload.status = interviewStatus === "Sent" ? "Interview Scheduled" : "Accepted";
  setInterviewMessage(interviewStatus === "Sent" ? "Sending interview details..." : "Saving draft...");
  const { error } = await supabaseClient.from("applications").update(payload).eq("id", application.id);
  if (error) {
    setInterviewMessage(error.message, "error");
    return;
  }
  Object.assign(application, payload);

  if (interviewStatus === "Sent") {
    try {
      await notifyInterviewStudent(
        application.id,
        "Interview scheduled",
        `Your ${payload.interview_round} is scheduled for ${formatInterviewDate(application)}. Open your Applications page for the full details.`
      );
    } catch (notificationError) {
      console.error(notificationError);
      setInterviewMessage(`Interview saved, but the student notification failed: ${notificationError.message}`, "error");
      renderAllInterviewViews();
      return;
    }
  }
  renderAllInterviewViews();
  setInterviewMessage(interviewStatus === "Sent" ? "Interview details sent to the student." : "Interview draft saved.", "success");
}

async function cancelInterview() {
  const application = getInterviewApplication(interviewElement("interviewApplication").value);
  if (!application || !application.interview_status) {
    setInterviewMessage("Select an existing interview first.", "error");
    return;
  }
  if (!window.confirm(`Cancel the interview for ${getCandidateName(application)}?`)) return;
  const update = {
    status: "Accepted",
    interview_status: "Cancelled",
    interview_updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseClient.from("applications").update(update).eq("id", application.id);
  if (error) {
    setInterviewMessage(error.message, "error");
    return;
  }
  Object.assign(application, update);
  let notificationFailed = false;
  try {
    await notifyInterviewStudent(application.id, "Interview cancelled", "The company cancelled the scheduled interview. New details may be sent later.");
  } catch (notificationError) {
    console.error(notificationError);
    notificationFailed = true;
  }
  renderAllInterviewViews();
  fillInterviewForm(application);
  setInterviewMessage(
    notificationFailed
      ? "Interview cancelled, but the student notification could not be sent."
      : "Interview cancelled and the student was notified.",
    notificationFailed ? "error" : "success"
  );
}

async function makeFinalDecision(status) {
  const application = getInterviewApplication();
  if (!application || application.interview_status !== "Sent") {
    setInterviewMessage("Select a sent interview before recording a decision.", "error");
    return;
  }
  const action = status === "Accepted" ? "send an internship offer to" : "reject";
  if (!window.confirm(`${action === "reject" ? "Reject" : "Send an internship offer to"} ${getCandidateName(application)}?`)) return;
  const update = {
    status,
    interview_status: "Completed",
    interview_updated_at: new Date().toISOString(),
    offer_status: status === "Accepted" ? "Pending" : null,
    offer_sent_at: status === "Accepted" ? new Date().toISOString() : null,
    offer_responded_at: null,
    offer_decline_reason: null,
  };
  const { error } = await supabaseClient.from("applications").update(update).eq("id", application.id);
  if (error) {
    setInterviewMessage(error.message, "error");
    return;
  }
  Object.assign(application, update);
  const title = status === "Accepted" ? "Internship offer received" : "Application decision";
  const message = status === "Accepted"
    ? "The company sent you an internship offer. Open My Applications to accept or decline it."
    : "The company has decided not to continue with your application after the interview.";
  try {
    await notifyInterviewStudent(application.id, title, message);
  } catch (notificationError) {
    console.error(notificationError);
    setInterviewMessage(`Decision saved, but a follow-up action failed: ${notificationError.message}`, "error");
    renderAllInterviewViews();
    return;
  }
  renderAllInterviewViews();
  fillInterviewForm(application);
  setInterviewMessage(status === "Accepted" ? "Internship offer sent to the student." : "Applicant rejected and notified.", "success");
}

function prepareSecondInterview() {
  const application = getInterviewApplication();
  if (!application) return;
  const nextStage = getNextInterviewStage(application.interview_round);
  if (!nextStage) {
    setInterviewMessage("This candidate is already at the final interview stage.", "info");
    return;
  }
  application.interview_status = "Draft";
  application.status = "Accepted";
  setInterviewFormValue("interviewRound", nextStage);
  setInterviewFormValue("interviewDate", "");
  setInterviewFormValue("interviewTime", "");
  interviewElement("inviteStatus").textContent = `${nextStage} draft`;
  interviewElement("finalDecisionPanel").hidden = true;
  interviewElement("schedule-panel").scrollIntoView({ behavior: "smooth" });
  setInterviewMessage(`Enter the ${nextStage.toLowerCase()} details and send the new invitation.`);
}

function renderAllInterviewViews() {
  renderCandidateOptions();
  renderInterviewStats();
  renderInterviewTable();
  renderFinalDecision(getInterviewApplication());
}

async function loadInterviewData() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) throw userError || new Error("No signed-in company found.");
  const { data: company, error: companyError } = await supabaseClient
    .from("companies").select("id, company_name").eq("profile_id", userData.user.id).single();
  if (companyError) throw companyError;
  interviewState.company = company;
  const { data: listings, error: listingsError } = await supabaseClient
    .from("internship_listings").select("id, title, openings, status").eq("company_id", company.id);
  if (listingsError) throw listingsError;
  interviewState.listings = new Map((listings || []).map((item) => [item.id, item]));
  const listingIds = [...interviewState.listings.keys()];
  if (!listingIds.length) return;

  const { data: applications, error: applicationsError } = await supabaseClient
    .from("applications")
    .select("id, listing_id, student_id, status, interview_round, interview_date, interview_time, interview_type, interviewer, meeting_link, interview_location, interview_message, interview_status, interview_updated_at, offer_status, offer_sent_at, offer_responded_at, offer_decline_reason")
    .in("listing_id", listingIds);
  if (applicationsError) throw applicationsError;
  interviewState.applications = (applications || []).filter(
    (item) =>
      ["Accepted", "Interview Scheduled"].includes(item.status) ||
      Boolean(item.interview_status)
  );
  const studentIds = [...new Set(interviewState.applications.map((item) => item.student_id).filter(Boolean))];
  if (!studentIds.length) return;
  const { data: students, error: studentsError } = await supabaseClient
    .from("students").select("id, profile_id").in("id", studentIds);
  if (studentsError) throw studentsError;
  interviewState.students = new Map((students || []).map((item) => [item.id, item]));
  const profileIds = (students || []).map((item) => item.profile_id).filter(Boolean);
  if (!profileIds.length) return;
  const { data: profiles, error: profilesError } = await supabaseClient
    .from("profiles").select("id, full_name").in("id", profileIds);
  if (profilesError) throw profilesError;
  interviewState.profiles = new Map((profiles || []).map((item) => [item.id, item]));
}

function bindInterviewEvents() {
  interviewElement("interviewApplication").addEventListener("change", (event) => {
    fillInterviewForm(getInterviewApplication(event.target.value));
  });
  interviewElement("interviewForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveInterview("Sent");
  });
  interviewElement("saveInterviewDraftButton").addEventListener("click", () => saveInterview("Draft"));
  interviewElement("cancelInterviewButton").addEventListener("click", cancelInterview);
  interviewElement("finalAcceptButton").addEventListener("click", () => makeFinalDecision("Accepted"));
  interviewElement("finalRejectButton").addEventListener("click", () => makeFinalDecision("Rejected"));
  interviewElement("secondInterviewButton").addEventListener("click", prepareSecondInterview);
  interviewElement("signOutLink").addEventListener("click", async (event) => {
    event.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "../index.html";
  });
}

async function setupInterviewsPage() {
  try {
    const account = await protectPage("company");
    if (!account) return;
    bindInterviewEvents();
    await loadInterviewData();
    const name = interviewState.company.company_name || "Company";
    interviewElement("companyName").textContent = name;
    interviewElement("companyAvatar").textContent = name.charAt(0).toUpperCase();
    renderAllInterviewViews();
    const requestedId = new URLSearchParams(window.location.search).get("application_id");
    const requested = getInterviewApplication(requestedId);
    if (requested) fillInterviewForm(requested);
  } catch (error) {
    console.error(error);
    setInterviewMessage(error.message || "Interview data could not be loaded.", "error");
  }
}

document.addEventListener("DOMContentLoaded", setupInterviewsPage);
