const studentApplicationsState = {
  applications: [],
  listings: new Map(),
  companies: new Map(),
  notifications: [],
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

function getApplicationStatusClass(status) {
  const normalizedStatus = String(status || "").toLowerCase();
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
  status.className = `status ${getApplicationStatusClass(application.status)}`;
  status.textContent = application.status || "Under Review";
  top.append(identity, status);

  const details = document.createElement("ul");
  details.className = "detail-list";
  details.append(
    createApplicationDetail("Applied date", formatApplicationDate(application.applied_at)),
    createApplicationDetail("Location", listing?.location),
    createApplicationDetail("Work mode", listing?.work_mode),
    createApplicationDetail("CV submitted", application.cv_filename || "No CV attached")
  );

  if (listing?.status && listing.status !== "Open") {
    const listingMessage = document.createElement("p");
    listingMessage.className = "application-listing-notice";
    listingMessage.textContent = listing.status === "Filled"
      ? "All positions for this internship have been filled. Your application remains in your history."
      : `This internship is currently ${listing.status.toLowerCase()} and is not accepting new applications.`;
    card.append(top, details, listingMessage);
  } else {
    card.append(top, details);
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

function formatNotificationDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderStudentNotifications() {
  const panel = getApplicationsElement("studentNotificationsPanel");
  const list = getApplicationsElement("studentNotificationList");
  list.replaceChildren();

  if (!studentApplicationsState.notifications.length) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  studentApplicationsState.notifications.forEach((notification) => {
    const item = document.createElement("article");
    item.className = `notification-item${notification.is_read ? "" : " unread"}`;
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = notification.title;
    const message = document.createElement("p");
    message.textContent = notification.message;
    const date = document.createElement("small");
    date.textContent = formatNotificationDate(notification.created_at);
    content.append(title, message, date);
    item.appendChild(content);

    if (notification.listing_id) {
      const link = document.createElement("a");
      link.className = "secondary-btn";
      link.href = `google-details.html?listing_id=${encodeURIComponent(notification.listing_id)}`;
      link.textContent = "View Update";
      item.appendChild(link);
    }
    list.appendChild(item);
  });
}

async function loadStudentNotifications() {
  const { data, error } = await supabaseClient
    .from("notifications")
    .select("id, listing_id, title, message, is_read, created_at")
    .eq("recipient_profile_id", studentApplicationsState.profileId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  studentApplicationsState.notifications = data || [];
}

async function markNotificationsRead() {
  const unreadIds = studentApplicationsState.notifications
    .filter((notification) => !notification.is_read)
    .map((notification) => notification.id);
  if (!unreadIds.length) return;

  const { error } = await supabaseClient
    .from("notifications")
    .update({ is_read: true })
    .in("id", unreadIds);
  if (error) {
    showApplicationsMessage(error.message, "error");
    return;
  }
  studentApplicationsState.notifications.forEach((notification) => {
    notification.is_read = true;
  });
  renderStudentNotifications();
}

function renderApplicationStats() {
  const applications = studentApplicationsState.applications;
  getApplicationsElement("totalApplicationsCount").textContent = applications.length;
  getApplicationsElement("underReviewCount").textContent = applications.filter(
    (application) => application.status === "Under Review"
  ).length;
  getApplicationsElement("interviewCount").textContent = applications.filter(
    (application) => application.status === "Interview Scheduled"
  ).length;
  getApplicationsElement("acceptedCount").textContent = applications.filter(
    (application) => application.status === "Accepted"
  ).length;
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

  const { data, error } = await supabaseClient
    .from("applications")
    .select("id, listing_id, status, applied_at, cv_path, cv_filename")
    .eq("student_id", student.id)
    .order("applied_at", { ascending: false });
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

    getApplicationsElement("markNotificationsReadButton").addEventListener(
      "click",
      markNotificationsRead
    );

    await loadStudentApplications();
    await loadStudentNotifications();
    await loadApplicationListings();
    await loadApplicationCompanies();
    renderStudentNotifications();
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
