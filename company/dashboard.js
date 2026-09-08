const companyDashboardState = {
  company: null,
  listings: [],
  applications: [],
  students: new Map(),
  profiles: new Map(),
  skillsByStudent: new Map(),
  requirementsByListing: new Map(),
  scores: new Map(),
};

function dashboardElement(id) {
  return document.getElementById(id);
}

function normalizeDashboardText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDashboardSkill(value) {
  return normalizeDashboardText(value).replace(/[^a-z0-9]/g, "");
}

function setDashboardMessage(message, type = "info") {
  const element = dashboardElement("dashboardMessage");
  element.textContent = message;
  element.style.color = {
    error: "#d92d3e",
    success: "#169c4b",
    info: "#7224e8",
  }[type];
}

function getListingApplications(listingId) {
  return companyDashboardState.applications.filter(
    (application) => application.listing_id === listingId
  );
}

function getDashboardRequirements(listing, type) {
  const rows = (
    companyDashboardState.requirementsByListing.get(listing.id) || []
  ).filter((row) => row.requirement_type === type);

  if (rows.length) return rows;

  const fallback = type === "required"
    ? listing.required_skills
    : listing.nice_to_have_skills;

  return (fallback || []).map((name) => ({
    skill_name: name,
    skill_key: normalizeDashboardSkill(name),
    minimum_level: 1,
  }));
}

function calculateDashboardSkillRatio(requirements, skills) {
  if (!requirements.length) return 1;

  const levels = new Map(
    skills.map((skill) => [
      normalizeDashboardSkill(skill.skill_key || skill.skill_name),
      Number(skill.level_number) || 1,
    ])
  );

  return requirements.reduce((total, requirement) => {
    const studentLevel = levels.get(
      normalizeDashboardSkill(requirement.skill_key || requirement.skill_name)
    ) || 0;
    const requiredLevel = Number(requirement.minimum_level) || 1;
    return total + Math.min(studentLevel / requiredLevel, 1);
  }, 0) / requirements.length;
}

function calculateDashboardQualification(listing, student, skills) {
  if (!student) return 0;

  const requiredRatio = calculateDashboardSkillRatio(
    getDashboardRequirements(listing, "required"),
    skills
  );
  const niceRatio = calculateDashboardSkillRatio(
    getDashboardRequirements(listing, "nice_to_have"),
    skills
  );
  const targetFieldRatio = listing.target_field
    ? normalizeDashboardText(student.preferred_field) ===
      normalizeDashboardText(listing.target_field) ? 1 : 0
    : 1;
  const majorRatio = listing.preferred_major
    ? normalizeDashboardText(student.major) ===
      normalizeDashboardText(listing.preferred_major) ? 1 : 0
    : 1;
  const yearRatio = listing.preferred_year
    ? normalizeDashboardText(student.year_of_study) ===
      normalizeDashboardText(listing.preferred_year) ? 1 : 0
    : 1;

  return Math.round(
    requiredRatio * 60 + niceRatio * 15 + targetFieldRatio * 15 + majorRatio * 5 + yearRatio * 5
  );
}

function statusGroup(status) {
  const normalized = normalizeDashboardText(status);
  if (["accepted", "approved", "hired"].includes(normalized)) return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "interview scheduled") return "interview";
  return "review";
}

function scoreFor(application) {
  return companyDashboardState.scores.get(application.id) || 0;
}

function renderDashboardStats() {
  const applications = companyDashboardState.applications;
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const groupCount = (group) => applications.filter(
    (application) => statusGroup(application.status) === group
  ).length;
  const approved = groupCount("approved");
  const interviews = groupCount("interview");

  dashboardElement("activeListingsCount").textContent =
    companyDashboardState.listings.filter(
      (listing) => normalizeDashboardText(listing.status) === "open"
    ).length;
  dashboardElement("dashboardApplicantsCount").textContent = applications.length;
  dashboardElement("dashboardHighFitCount").textContent = applications.filter(
    (application) => scoreFor(application) >= 80
  ).length;
  dashboardElement("interviewCandidatesCount").textContent = approved + interviews;
  dashboardElement("newApplicationsCount").textContent = applications.filter(
    (application) => {
      const appliedAt = new Date(application.applied_at).getTime();
      return Number.isFinite(appliedAt) && now - appliedAt <= sevenDays;
    }
  ).length;
  dashboardElement("underReviewCount").textContent = groupCount("review");
  dashboardElement("dashboardApprovedCount").textContent = approved;
  dashboardElement("dashboardRejectedCount").textContent = groupCount("rejected");
  dashboardElement("scheduledInterviewsCount").textContent = interviews;
}

function renderDashboardActivity() {
  const container = dashboardElement("dashboardActivityList");
  container.replaceChildren();
  const recent = [...companyDashboardState.applications]
    .sort((first, second) => new Date(second.applied_at) - new Date(first.applied_at))
    .slice(0, 3);

  if (!recent.length) {
    const empty = document.createElement("article");
    empty.className = "activity-item";
    empty.innerHTML = "<div><h3>No applicant activity yet</h3><p>New applications will appear here.</p></div>";
    container.appendChild(empty);
    return;
  }

  recent.forEach((application) => {
    const student = companyDashboardState.students.get(application.student_id);
    const profile = student
      ? companyDashboardState.profiles.get(student.profile_id)
      : null;
    const listing = companyDashboardState.listings.find(
      (item) => item.id === application.listing_id
    );
    const group = statusGroup(application.status);
    const item = document.createElement("article");
    item.className = "activity-item";

    const dot = document.createElement("span");
    dot.className = `activity-dot ${group === "approved" || group === "interview" ? "green" : group === "rejected" ? "yellow" : "purple"}`;

    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `${profile?.full_name || "Student applicant"} — ${application.status || "Under Review"}`;
    const detail = document.createElement("p");
    detail.textContent = `${listing?.title || "Internship"} · ${scoreFor(application)}% qualification`;
    copy.append(title, detail);

    const status = document.createElement("span");
    status.className = `status ${group === "approved" || group === "interview" ? "accepted" : group === "rejected" ? "rejected" : "review"}`;
    status.textContent = application.status || "Under Review";
    item.append(dot, copy, status);
    container.appendChild(item);
  });
}

function renderPriorityListings() {
  const container = dashboardElement("priorityListings");
  container.replaceChildren();
  const listings = [...companyDashboardState.listings]
    .sort((first, second) =>
      getListingApplications(second.id).length - getListingApplications(first.id).length
    )
    .slice(0, 3);

  if (!listings.length) {
    const empty = document.createElement("article");
    empty.className = "job-mini-card";
    empty.innerHTML = "<div><h3>No internship listings yet</h3><p>Create a role to begin receiving applicants.</p></div>";
    container.appendChild(empty);
    return;
  }

  listings.forEach((listing) => {
    const applications = getListingApplications(listing.id);
    const highFit = applications.filter(
      (application) => scoreFor(application) >= 80
    ).length;
    const card = document.createElement("article");
    card.className = "job-mini-card";
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = listing.title || "Untitled internship";
    const detail = document.createElement("p");
    detail.textContent = `${applications.length} ${applications.length === 1 ? "applicant" : "applicants"} · ${highFit} high-fit`;
    copy.append(title, detail);
    const link = document.createElement("a");
    link.className = "secondary-btn";
    link.href = `applicants.html?listing_id=${encodeURIComponent(listing.id)}`;
    link.textContent = "Open";
    card.append(copy, link);
    container.appendChild(card);
  });
}

async function loadCompanyDashboardData() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) {
    throw userError || new Error("No signed-in company found.");
  }

  const { data: company, error: companyError } = await supabaseClient
    .from("companies")
    .select("id, company_name")
    .eq("profile_id", userData.user.id)
    .single();
  if (companyError) throw companyError;
  companyDashboardState.company = company;

  const { data: listings, error: listingsError } = await supabaseClient
    .from("internship_listings")
    .select("id, title, status, target_field, preferred_major, preferred_year, required_skills, nice_to_have_skills, created_at")
    .eq("company_id", company.id);
  if (listingsError) throw listingsError;
  companyDashboardState.listings = listings || [];

  const listingIds = companyDashboardState.listings.map((listing) => listing.id);
  if (!listingIds.length) return;

  const { data: applications, error: applicationsError } = await supabaseClient
    .from("applications")
    .select("id, listing_id, student_id, status, applied_at")
    .in("listing_id", listingIds);
  if (applicationsError) throw applicationsError;
  companyDashboardState.applications = applications || [];

  const studentIds = [...new Set(companyDashboardState.applications.map((item) => item.student_id))];
  const [requirementsResult, studentsResult, skillsResult] = await Promise.all([
    supabaseClient.from("listing_skills").select("listing_id, skill_id, requirement_type, minimum_level").in("listing_id", listingIds),
    studentIds.length
      ? supabaseClient.from("students").select("id, profile_id, major, year_of_study, preferred_field").in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabaseClient.from("student_skills").select("student_id, skill_name, skill_key, level_number").in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (requirementsResult.error) throw requirementsResult.error;
  if (studentsResult.error) throw studentsResult.error;
  if (skillsResult.error) throw skillsResult.error;

  const profileIds = (studentsResult.data || []).map((student) => student.profile_id);
  const skillIds = [...new Set((requirementsResult.data || []).map((item) => item.skill_id))];
  const [profilesResult, catalogResult] = await Promise.all([
    profileIds.length
      ? supabaseClient.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    skillIds.length
      ? supabaseClient.from("skills").select("id, name, skill_key").in("id", skillIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (catalogResult.error) throw catalogResult.error;

  companyDashboardState.students = new Map((studentsResult.data || []).map((student) => [student.id, student]));
  companyDashboardState.profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  (skillsResult.data || []).forEach((skill) => {
    const list = companyDashboardState.skillsByStudent.get(skill.student_id) || [];
    list.push(skill);
    companyDashboardState.skillsByStudent.set(skill.student_id, list);
  });

  const catalog = new Map((catalogResult.data || []).map((skill) => [skill.id, skill]));
  (requirementsResult.data || []).forEach((requirement) => {
    const list = companyDashboardState.requirementsByListing.get(requirement.listing_id) || [];
    const skill = catalog.get(requirement.skill_id);
    list.push({ ...requirement, skill_name: skill?.name || "Required skill", skill_key: skill?.skill_key || "" });
    companyDashboardState.requirementsByListing.set(requirement.listing_id, list);
  });

  companyDashboardState.applications.forEach((application) => {
    const listing = companyDashboardState.listings.find((item) => item.id === application.listing_id);
    const student = companyDashboardState.students.get(application.student_id);
    const skills = companyDashboardState.skillsByStudent.get(application.student_id) || [];
    companyDashboardState.scores.set(
      application.id,
      calculateDashboardQualification(listing, student, skills)
    );
  });
}

async function setupCompanyDashboard() {
  try {
    const account = await protectPage("company");
    if (!account) return;

    dashboardElement("signOutLink").addEventListener("click", async (event) => {
      event.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = "../index.html";
    });

    await loadCompanyDashboardData();
    const companyName = companyDashboardState.company.company_name || "Company";
    dashboardElement("companyName").textContent = companyName;
    dashboardElement("companyAvatar").textContent = companyName.charAt(0).toUpperCase();
    renderDashboardStats();
    renderDashboardActivity();
    renderPriorityListings();
    setDashboardMessage("");
  } catch (error) {
    console.error(error);
    setDashboardMessage(error.message || "The company dashboard could not be loaded.", "error");
  }
}

document.addEventListener("DOMContentLoaded", setupCompanyDashboard);
