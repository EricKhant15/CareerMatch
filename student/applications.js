const studentApplicationsState = {
  applications: [],
  listings: new Map(),
  companies: new Map(),
  profileId: null,
};

function getApplicationsElement(id) {
  return document.getElementById(id);
}

function isValidApplicationUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function showApplicationsMessage(message, type = "info") {
  const element = getApplicationsElement("applicationsMessage");
  const colors = {
    error: "#d92d3e",
    success: "#169c4b",
    info: "#7224e8",
  };

  element.textContent = message;
  element.style.color = colors[type] || colors.info;
}

function getApplicationStatusClass(application) {
  if (["Declined", "Withdrawn"].includes(application.offer_status)) return "rejected";
  if (application.offer_status === "Accepted") return "accepted";
  if (application.offer_status === "Pending") return "interview";
  const normalizedStatus = String(application.status || "").toLowerCase();
  if (normalizedStatus === "accepted") return "accepted";
  if (normalizedStatus === "rejected") return "rejected";
  if (normalizedStatus === "interview scheduled") return "interview";
  return "review";
}

function formatApplicationDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatApplicationInterviewDate(application) {
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

function getStudentInterviewStage(value) {
  const legacyStages = {
    "First Interview": "Initial Interview",
    "Technical Interview": "Technical / Portfolio Interview",
    "Portfolio Interview": "Technical / Portfolio Interview",
    "Second Interview": "Final Interview",
  };
  return legacyStages[value] || value || "Interview Scheduled";
}

function getStudentApplicationLabel(application) {
  if (application.offer_status === "Accepted") return "Internship Accepted";
  if (application.offer_status === "Declined") return "Offer Declined";
  if (application.offer_status === "Withdrawn") return "Offer Closed";
  if (application.offer_status === "Pending") return "Offer Received";
  if (application.status === "Accepted" && application.interview_status === "Completed") return "Offer Received";
  if (application.status === "Accepted") return "Shortlisted for Interview";
  return application.status || "Under Review";
}

function createApplicationDetail(label, value) {
  const item = document.createElement("li");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");
  labelElement.textContent = label;
  valueElement.textContent = value || "Not set";
  item.append(labelElement, valueElement);
  return item;
}

function createApplicationCard(application) {
  const listing = studentApplicationsState.listings.get(application.listing_id);
  const company = listing
    ? studentApplicationsState.companies.get(listing.company_id)
    : null;

  const card = document.createElement("article");
  card.className = "application-card";

  const top = document.createElement("div");
  top.className = "application-top";

  const identity = document.createElement("div");
  const companyName = document.createElement("h2");
  companyName.textContent = company?.company_name || "Company";
  const title = document.createElement("p");
  title.textContent = listing?.title || "Internship listing";
  identity.append(companyName, title);

  const status = document.createElement("span");
  status.className = `status ${getApplicationStatusClass(application)}`;
  status.textContent = getStudentApplicationLabel(application);
  top.append(identity, status);

  const details = document.createElement("ul");
  details.className = "detail-list";
  details.append(
    createApplicationDetail("Applied date", formatApplicationDate(application.applied_at)),
    createApplicationDetail("Location", listing?.location),
    createApplicationDetail("Work mode", listing?.work_mode),
    createApplicationDetail("CV submitted", application.cv_filename || "No CV attached")
  );

  let interviewPanel = null;
  if (application.interview_status && application.interview_status !== "Draft") {
    interviewPanel = document.createElement("section");
    interviewPanel.className = "application-interview-summary";
    const interviewTitle = document.createElement("h3");
    interviewTitle.textContent = application.interview_status === "Cancelled"
      ? "Interview Cancelled"
      : application.interview_status === "Completed"
        ? "Interview Completed"
        : getStudentInterviewStage(application.interview_round);
    const interviewDetails = document.createElement("ul");
    interviewDetails.className = "detail-list";
    interviewDetails.append(
      createApplicationDetail("Date and time", formatApplicationInterviewDate(application)),
      createApplicationDetail("Format", application.interview_type),
      createApplicationDetail("Interviewer", application.interviewer),
      createApplicationDetail("Location", application.interview_location)
    );
    interviewPanel.append(interviewTitle, interviewDetails);
    if (application.meeting_link && application.interview_status === "Sent") {
      const meetingLink = document.createElement("a");
      meetingLink.className = "secondary-btn";
      meetingLink.href = application.meeting_link;
      meetingLink.target = "_blank";
      meetingLink.rel = "noopener noreferrer";
      meetingLink.textContent = "Open Meeting Link";
      interviewPanel.appendChild(meetingLink);
    }
    if (application.interview_message) {
      const message = document.createElement("p");
      message.textContent = application.interview_message;
      interviewPanel.appendChild(message);
    }
  }

  let offerPanel = null;
  if (application.offer_status) {
    offerPanel = document.createElement("section");
    offerPanel.className = `application-offer-panel ${application.offer_status.toLowerCase()}`;
    const offerTitle = document.createElement("h3");
    const offerMessage = document.createElement("p");
    if (application.offer_status === "Pending") {
      offerTitle.textContent = "Internship Offer";
      offerMessage.textContent = "The company has selected you. Accepting this offer will automatically decline any other pending internship offers.";
      const actions = document.createElement("div");
      actions.className = "decision-actions left";
      const acceptButton = document.createElement("button");
      acceptButton.className = "primary-btn";
      acceptButton.type = "button";
      acceptButton.textContent = "Accept Offer";
      acceptButton.addEventListener("click", () => respondToOffer(application, "Accepted", acceptButton, declineButton));
      const declineButton = document.createElement("button");
      declineButton.className = "danger-btn";
      declineButton.type = "button";
      declineButton.textContent = "Decline Offer";
      declineButton.addEventListener("click", () => respondToOffer(application, "Declined", acceptButton, declineButton));
      actions.append(acceptButton, declineButton);
      offerPanel.append(offerTitle, offerMessage, actions);
    } else {
      offerTitle.textContent = application.offer_status === "Accepted"
        ? "Offer Accepted"
        : application.offer_status === "Declined" ? "Offer Declined" : "Offer Closed";
      offerMessage.textContent = application.offer_status === "Accepted"
        ? "You accepted this internship. The company has been notified."
        : application.offer_decline_reason || "This offer is no longer active.";
      offerPanel.append(offerTitle, offerMessage);
    }
  }

  if (listing?.status && listing.status !== "Open") {
    const listingMessage = document.createElement("p");
    listingMessage.className = "application-listing-notice";
    listingMessage.textContent = listing.status === "Filled"
      ? application.offer_status === "Accepted"
        ? "You accepted this internship and one position is reserved for you."
        : "All positions for this internship have been filled. Your application remains in your history."
      : `This internship is currently ${listing.status.toLowerCase()} and is not accepting new applications.`;
    card.append(top, details);
    if (interviewPanel) card.appendChild(interviewPanel);
    if (offerPanel) card.appendChild(offerPanel);
    card.appendChild(listingMessage);
  } else {
    card.append(top, details);
    if (interviewPanel) card.appendChild(interviewPanel);
    if (offerPanel) card.appendChild(offerPanel);
  }

  const link = document.createElement("a");
  link.className = "secondary-btn";
  link.href = listing
    ? `google-details.html?listing_id=${encodeURIComponent(listing.id)}`
    : "matches.html";
  link.textContent = "View Internship";

  card.append(link);
  return card;
}

function renderApplicationStats() {
  const applications = studentApplicationsState.applications;
  getApplicationsElement("totalApplicationsCount").textContent = applications.length;
  getApplicationsElement("underReviewCount").textContent = applications.filter(
    (application) => application.status === "Under Review"
  ).length;
  getApplicationsElement("shortlistedCount").textContent = applications.filter(
    (application) => application.status === "Accepted" && application.interview_status !== "Completed"
  ).length;
  getApplicationsElement("interviewCount").textContent = applications.filter(
    (application) => application.status === "Interview Scheduled"
  ).length;
  getApplicationsElement("offerCount").textContent = applications.filter(
    (application) => application.offer_status === "Pending"
  ).length;
  getApplicationsElement("selectedCount").textContent = applications.filter(
    (application) => application.offer_status === "Accepted"
  ).length;
}

async function respondToOffer(application, response, acceptButton, declineButton) {
  let reason = null;
  if (response === "Accepted") {
    const confirmed = window.confirm(
      "Accept this internship offer? Any other pending offers will be declined automatically."
    );
    if (!confirmed) return;
  } else {
    reason = window.prompt("Optional: tell the company why you are declining this offer.", "");
    if (reason === null) return;
  }

  acceptButton.disabled = true;
  declineButton.disabled = true;
  showApplicationsMessage(`${response === "Accepted" ? "Accepting" : "Declining"} offer...`);
  const { data, error } = await supabaseClient.rpc("respond_to_internship_offer", {
    p_application_id: application.id,
    p_response: response,
    p_reason: reason || null,
  });
  if (error) {
    acceptButton.disabled = false;
    declineButton.disabled = false;
    showApplicationsMessage(error.message, "error");
    return;
  }

  application.offer_status = response;
  application.offer_responded_at = new Date().toISOString();
  application.offer_decline_reason = response === "Declined" ? reason : null;
  if (response === "Accepted") {
    studentApplicationsState.applications.forEach((otherApplication) => {
      if (otherApplication.id !== application.id && otherApplication.offer_status === "Pending") {
        otherApplication.offer_status = "Declined";
        otherApplication.offer_decline_reason = "Accepted another internship offer";
      }
    });
  }
  if (data?.listing_status === "Filled") {
    const listing = studentApplicationsState.listings.get(application.listing_id);
    if (listing) listing.status = "Filled";
  }
  renderApplicationStats();
  renderApplications();
  showApplicationsMessage(
    response === "Accepted"
      ? "Internship offer accepted. The company has been notified."
      : "Internship offer declined. The company has been notified.",
    "success"
  );
}

function renderApplications() {
  const board = getApplicationsElement("applicationsBoard");
  board.replaceChildren();
  board.setAttribute("aria-busy", "false");

  if (studentApplicationsState.applications.length === 0) {
    const empty = document.createElement("article");
    empty.className = "application-card application-state-card";
    const title = document.createElement("h2");
    title.textContent = "No applications yet";
    const message = document.createElement("p");
    message.textContent = "Browse your recommendations and apply to an internship.";
    const link = document.createElement("a");
    link.className = "primary-btn";
    link.href = "matches.html";
    link.textContent = "Browse Recommendations";
    empty.append(title, message, link);
    board.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  studentApplicationsState.applications.forEach((application) => {
    fragment.appendChild(createApplicationCard(application));
  });
  board.appendChild(fragment);
}

async function loadStudentApplications() {
  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();
  if (userError || !user) throw userError || new Error("No signed-in student found.");
  studentApplicationsState.profileId = user.id;

  const { data: student, error: studentError } = await supabaseClient
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (studentError) throw studentError;

  let { data, error } = await supabaseClient
    .from("applications")
    .select("id, listing_id, status, applied_at, cv_path, cv_filename, interview_round, interview_date, interview_time, interview_type, interviewer, meeting_link, interview_location, interview_message, interview_status, offer_status, offer_sent_at, offer_responded_at, offer_decline_reason")
    .eq("student_id", student.id)
    .order("applied_at", { ascending: false });

  if (error && /offer_\w+.*does not exist/i.test(error.message || "")) {
    const offerFallbackResult = await supabaseClient
      .from("applications")
      .select("id, listing_id, status, applied_at, cv_path, cv_filename, interview_round, interview_date, interview_time, interview_type, interviewer, meeting_link, interview_location, interview_message, interview_status")
      .eq("student_id", student.id)
      .order("applied_at", { ascending: false });
    data = offerFallbackResult.data;
    error = offerFallbackResult.error;
    if (!error) {
      showApplicationsMessage(
        "Applications loaded. Run the offer workflow SQL to enable student offer responses.",
        "info"
      );
    }
  }

  if (error && /interview_\w+.*does not exist/i.test(error.message || "")) {
    const fallbackResult = await supabaseClient
      .from("applications")
      .select("id, listing_id, status, applied_at, cv_path, cv_filename")
      .eq("student_id", student.id)
      .order("applied_at", { ascending: false });
    data = fallbackResult.data;
    error = fallbackResult.error;
    if (!error) {
      showApplicationsMessage(
        "Applications loaded. Run the interview workflow SQL to enable interview scheduling.",
        "info"
      );
    }
  }
  if (error) throw error;

  studentApplicationsState.applications = data || [];
}

async function loadApplicationListings() {
  const listingIds = [
    ...new Set(
      studentApplicationsState.applications
        .map((item) => item.listing_id)
        .filter(isValidApplicationUuid)
    ),
  ];
  if (listingIds.length === 0) return;

  const { data, error } = await supabaseClient
    .from("internship_listings")
    .select("id, company_id, title, location, work_mode, status")
    .in("id", listingIds);
  if (error) throw error;

  studentApplicationsState.listings = new Map(
    (data || []).map((listing) => [listing.id, listing])
  );
}

async function loadApplicationCompanies() {
  const companyIds = [
    ...new Set(
      [...studentApplicationsState.listings.values()].map(
        (listing) => listing.company_id
      ).filter(isValidApplicationUuid)
    ),
  ];
  if (companyIds.length === 0) return;

  const { data, error } = await supabaseClient
    .from("companies")
    .select("id, company_name")
    .in("id", companyIds);
  if (error) throw error;

  studentApplicationsState.companies = new Map(
    (data || []).map((company) => [company.id, company])
  );
}

async function setupApplicationsPage() {
  try {
    const account = await protectPage("student");
    if (!account) return;

    const profile = await loadStudentProfileFromSupabase();
    const studentName = profile.name || "Student";
    getApplicationsElement("studentName").textContent = studentName;
    getApplicationsElement("studentAvatar").textContent =
      studentName.charAt(0).toUpperCase();

    await loadStudentApplications();
    await loadApplicationListings();
    await loadApplicationCompanies();
    renderApplicationStats();
    renderApplications();

    if (new URLSearchParams(window.location.search).get("created") === "1") {
      showApplicationsMessage("Your application was submitted successfully.", "success");
    }
  } catch (error) {
    console.error(error);
    getApplicationsElement("applicationsBoard").setAttribute("aria-busy", "false");
    showApplicationsMessage(
      error.message || "Your applications could not be loaded.",
      "error"
    );
  }
}

document.addEventListener("DOMContentLoaded", setupApplicationsPage);
