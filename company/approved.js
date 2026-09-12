const approvedState = {
  company: null,
  listings: new Map(),
  applications: [],
  students: new Map(),
  profiles: new Map(),
};

function approvedElement(id) {
  return document.getElementById(id);
}

function setApprovedMessage(message, type = "info") {
  const colors = { error: "#d92d3e", success: "#169c4b", info: "#7224e8" };
  const element = approvedElement("approvedMessage");
  element.textContent = message;
  element.style.color = colors[type] || colors.info;
}

function interviewLabel(application) {
  if (application.interview_status === "Completed") return "Completed";
  if (application.interview_status === "Sent") return "Scheduled";
  if (application.interview_status === "Draft") return "Draft";
  if (application.interview_status === "Cancelled") return "Cancelled";
  return "Not scheduled";
}

function applicationLabel(application) {
  if (application.offer_status === "Accepted") return "Offer Accepted";
  if (application.offer_status === "Declined") return "Offer Declined";
  if (application.offer_status === "Withdrawn") return "Offer Closed";
  if (application.offer_status === "Pending") return "Offer Sent";
  if (application.status === "Interview Scheduled") return "Interview Scheduled";
  return "Shortlisted";
}

function offerLabel(application) {
  if (!application.offer_status) return "Not sent";
  if (application.offer_status === "Pending") return "Waiting for student";
  if (application.offer_status === "Accepted") return "Accepted by student";
  if (application.offer_status === "Withdrawn") return "Closed because positions were filled";
  return application.offer_decline_reason
    ? `Declined — ${application.offer_decline_reason}`
    : "Declined";
}

function renderApprovedStats() {
  const applications = approvedState.applications;
  approvedElement("approvedCount").textContent = applications.length;
  approvedElement("waitingCount").textContent = applications.filter(
    (item) => !item.interview_status || item.interview_status === "Cancelled"
  ).length;
  approvedElement("scheduledCount").textContent = applications.filter(
    (item) => item.interview_status === "Sent"
  ).length;
  approvedElement("selectedCount").textContent = applications.filter(
    (item) => item.offer_status === "Accepted"
  ).length;
}

function renderApprovedApplicants() {
  const body = approvedElement("approvedApplicantsBody");
  body.replaceChildren();
  if (!approvedState.applications.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No shortlisted candidates yet. Shortlist a student from Manage Listings first.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  approvedState.applications.forEach((application) => {
    const listing = approvedState.listings.get(application.listing_id);
    const student = approvedState.students.get(application.student_id);
    const profile = student ? approvedState.profiles.get(student.profile_id) : null;
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = profile?.full_name || "Student";
    const roleCell = document.createElement("td");
    roleCell.textContent = listing?.title || "Listing unavailable";
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = application.status === "Interview Scheduled" ? "status interview" : "status accepted";
    status.textContent = applicationLabel(application);
    statusCell.appendChild(status);
    const interviewCell = document.createElement("td");
    interviewCell.textContent = interviewLabel(application);
    const offerCell = document.createElement("td");
    offerCell.textContent = offerLabel(application);
    const actionsCell = document.createElement("td");
    actionsCell.className = "table-actions";
    const schedule = document.createElement("a");
    schedule.className = "secondary-btn";
    schedule.href = `interviews.html?application_id=${encodeURIComponent(application.id)}`;
    schedule.textContent = application.interview_status === "Completed"
      ? "View Interview"
      : application.interview_status === "Sent" ? "Edit Interview" : "Schedule";
    const review = document.createElement("a");
    review.className = "secondary-btn";
    review.href = listing
      ? `applicants.html?listing_id=${encodeURIComponent(listing.id)}&application_id=${encodeURIComponent(application.id)}`
      : "job-posts.html";
    review.textContent = "Review";
    actionsCell.append(schedule, review);
    row.append(nameCell, roleCell, statusCell, interviewCell, offerCell, actionsCell);
    body.appendChild(row);
  });
}

async function loadApprovedData() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) throw userError || new Error("No signed-in company found.");
  const { data: company, error: companyError } = await supabaseClient
    .from("companies").select("id, company_name").eq("profile_id", userData.user.id).single();
  if (companyError) throw companyError;
  approvedState.company = company;

  const { data: listings, error: listingsError } = await supabaseClient
    .from("internship_listings").select("id, title").eq("company_id", company.id);
  if (listingsError) throw listingsError;
  approvedState.listings = new Map((listings || []).map((item) => [item.id, item]));
  const listingIds = [...approvedState.listings.keys()];
  if (!listingIds.length) return;

  const { data: applications, error: applicationsError } = await supabaseClient
    .from("applications")
    .select("id, listing_id, student_id, status, interview_status, interview_date, interview_time, applied_at, offer_status, offer_sent_at, offer_responded_at, offer_decline_reason")
    .in("listing_id", listingIds)
    .in("status", ["Accepted", "Interview Scheduled"])
    .order("applied_at", { ascending: false });
  if (applicationsError) throw applicationsError;
  approvedState.applications = applications || [];

  const studentIds = [...new Set(approvedState.applications.map((item) => item.student_id).filter(Boolean))];
  if (!studentIds.length) return;
  const { data: students, error: studentsError } = await supabaseClient
    .from("students").select("id, profile_id").in("id", studentIds);
  if (studentsError) throw studentsError;
  approvedState.students = new Map((students || []).map((item) => [item.id, item]));
  const profileIds = (students || []).map((item) => item.profile_id).filter(Boolean);
  if (!profileIds.length) return;
  const { data: profiles, error: profilesError } = await supabaseClient
    .from("profiles").select("id, full_name").in("id", profileIds);
  if (profilesError) throw profilesError;
  approvedState.profiles = new Map((profiles || []).map((item) => [item.id, item]));
}

async function setupApprovedPage() {
  try {
    const account = await protectPage("company");
    if (!account) return;
    approvedElement("signOutLink").addEventListener("click", async (event) => {
      event.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = "../index.html";
    });
    await loadApprovedData();
    const name = approvedState.company.company_name || "Company";
    approvedElement("companyName").textContent = name;
    approvedElement("companyAvatar").textContent = name.charAt(0).toUpperCase();
    renderApprovedStats();
    renderApprovedApplicants();
  } catch (error) {
    console.error(error);
    setApprovedMessage(error.message || "Shortlisted candidates could not be loaded.", "error");
  }
}

document.addEventListener("DOMContentLoaded", setupApprovedPage);
