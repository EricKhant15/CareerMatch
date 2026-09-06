const manageListingsState = {
  company: null,
  listings: [],
  applications: [],
  qualificationScores: new Map(),
  requirementsByListing: new Map(),
};

function normalizeQualificationText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeQualificationSkill(value) {
  return normalizeQualificationText(value).replace(/[^a-z0-9]/g, "");
}

function getManageElement(id) {
  return document.getElementById(id);
}

function setManageMessage(message, type = "info") {
  const element = getManageElement("listingPageMessage");

  if (!element) {
    return;
  }

  const colors = {
    error: "#d92d3e",
    success: "#169c4b",
    info: "#7224e8",
  };

  element.textContent = message;
  element.style.color = colors[type] || colors.info;
}

function createPositionCode(title) {
  const words = String(title || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "IN";
  }

  return words
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function formatListingDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusClass(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (["open", "published", "active"].includes(normalizedStatus)) {
    return "accepted";
  }

  if (["closed", "archived", "rejected"].includes(normalizedStatus)) {
    return "rejected";
  }

  return "review";
}

function getApplicationScore(application) {
  const liveScore = manageListingsState.qualificationScores.get(application.id);

  if (liveScore !== undefined) {
    return liveScore;
  }

  const possibleScores = [
    application.match_score,
    application.match_percentage,
    application.score,
  ];

  const score = possibleScores.find(
    (value) => value !== null && value !== undefined
  );

  return Number(score) || 0;
}

function getManageListingRequirements(listing, requirementType) {
  const requirements = (
    manageListingsState.requirementsByListing.get(listing.id) || []
  ).filter((item) => item.requirement_type === requirementType);

  if (requirements.length > 0) {
    return requirements;
  }

  const fallbackSkills = requirementType === "required"
    ? listing.required_skills
    : listing.nice_to_have_skills;

  return (fallbackSkills || []).map((skillName) => ({
    skill_name: skillName,
    skill_key: normalizeQualificationSkill(skillName),
    minimum_level: 1,
  }));
}

function calculateManageSkillRatio(requirements, skills) {
  if (requirements.length === 0) {
    return 1;
  }

  const skillMap = new Map(
    skills.map((skill) => [
      normalizeQualificationSkill(skill.skill_key || skill.skill_name),
      Number(skill.level_number) || 1,
    ])
  );

  const earned = requirements.reduce((total, requirement) => {
    const level = skillMap.get(
      normalizeQualificationSkill(
        requirement.skill_key || requirement.skill_name
      )
    ) || 0;
    const requiredLevel = Number(requirement.minimum_level) || 1;
    return total + Math.min(level / requiredLevel, 1);
  }, 0);

  return earned / requirements.length;
}

function calculateManageQualification(listing, student, skills) {
  const requiredRatio = calculateManageSkillRatio(
    getManageListingRequirements(listing, "required"),
    skills
  );
  const niceRatio = calculateManageSkillRatio(
    getManageListingRequirements(listing, "nice_to_have"),
    skills
  );
  const profileRatios = [];

  if (listing.target_field) {
    profileRatios.push(
      normalizeQualificationText(student.preferred_field) ===
      normalizeQualificationText(listing.target_field) ? 1 : 0
    );
  }

  if (listing.preferred_major) {
    profileRatios.push(
      normalizeQualificationText(student.major) ===
      normalizeQualificationText(listing.preferred_major) ? 1 : 0
    );
  }

  const fieldMajorRatio = profileRatios.length
    ? profileRatios.reduce((total, ratio) => total + ratio, 0) /
      profileRatios.length
    : 1;
  const yearRatio = listing.preferred_year
    ? normalizeQualificationText(student.year_of_study) ===
      normalizeQualificationText(listing.preferred_year) ? 1 : 0
    : 1;

  return Math.round(
    requiredRatio * 60 +
    niceRatio * 15 +
    fieldMajorRatio * 15 +
    yearRatio * 10
  );
}

function getApplicationsForListing(listingId) {
  return manageListingsState.applications.filter(
    (application) => application.listing_id === listingId
  );
}

function isApprovedApplication(application) {
  const status = String(application.status || "").toLowerCase();
  return ["approved", "accepted", "hired"].includes(status);
}

function createDetailItem(label, value) {
  const item = document.createElement("li");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  labelElement.textContent = label;
  valueElement.textContent = value || "Not set";
  item.append(labelElement, valueElement);

  return item;
}

function createListingCard(listing) {
  const applications = getApplicationsForListing(listing.id);
  const highFitCount = applications.filter(
    (application) => getApplicationScore(application) >= 80
  ).length;

  const card = document.createElement("article");
  card.className = "job-post-card";

  const top = document.createElement("div");
  top.className = "job-post-top";

  const icon = document.createElement("div");
  icon.className = "job-icon";
  icon.textContent = createPositionCode(listing.title);

  const status = document.createElement("span");
  status.className = `status ${getStatusClass(listing.status)}`;
  status.textContent = listing.status || "Draft";

  const listingBadges = document.createElement("div");
  listingBadges.className = "listing-meta-badges";

  const applicantCount = document.createElement("span");
  applicantCount.className = "listing-applicant-count";
  applicantCount.setAttribute(
    "aria-label",
    `${applications.length} ${applications.length === 1 ? "applicant" : "applicants"}`
  );
  applicantCount.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
    </svg>
    <strong>${applications.length}</strong>
    <span>${applications.length === 1 ? "Applicant" : "Applicants"}</span>
  `;

  listingBadges.append(applicantCount, status);
  top.append(icon, listingBadges);

  const title = document.createElement("h2");
  title.textContent = listing.title || "Untitled internship";

  const description = document.createElement("p");
  description.textContent =
    listing.description || "No internship description provided.";

  const details = document.createElement("ul");
  details.className = "detail-list";
  details.append(
    createDetailItem("Location", listing.location),
    createDetailItem("Mode", listing.work_mode),
    createDetailItem("Duration", listing.duration),
    createDetailItem("Openings", String(listing.openings || 1)),
    createDetailItem("Deadline", formatListingDate(listing.application_deadline)),
    createDetailItem("High-fit", String(highFitCount))
  );

  const skills = document.createElement("div");
  skills.className = "skill-row";

  const requiredSkills = Array.isArray(listing.required_skills)
    ? listing.required_skills
    : [];

  if (requiredSkills.length === 0) {
    const noSkills = document.createElement("span");
    noSkills.className = "tag";
    noSkills.textContent = "No required skills";
    skills.appendChild(noSkills);
  } else {
    requiredSkills.forEach((skillName) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = skillName;
      skills.appendChild(tag);
    });
  }

  const detailsLink = document.createElement("a");
  detailsLink.className = "primary-btn";
  detailsLink.href = `applicants.html?listing_id=${encodeURIComponent(listing.id)}`;
  detailsLink.textContent = "View Applicants";

  const actions = document.createElement("div");
  actions.className = "job-post-actions";

  const deleteButton = document.createElement("button");
  deleteButton.className = "danger-btn";
  deleteButton.type = "button";
  deleteButton.dataset.deleteListing = listing.id;
  deleteButton.textContent = "Delete Listing";

  if (applications.length > 0) {
    deleteButton.title =
      "Listings with applications cannot be deleted. Close the listing instead.";
  }

  actions.append(detailsLink, deleteButton);
  card.append(top, title, description, details, skills, actions);
  return card;
}

function renderListings() {
  const jobBoard = getManageElement("jobBoard");
  jobBoard.replaceChildren();
  jobBoard.setAttribute("aria-busy", "false");

  if (manageListingsState.listings.length === 0) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "job-post-card listing-state-card";

    const title = document.createElement("h2");
    title.textContent = "No internship listings yet";

    const message = document.createElement("p");
    message.textContent =
      "Create your first internship listing and it will appear here.";

    const link = document.createElement("a");
    link.className = "primary-btn";
    link.href = "post-role.html";
    link.textContent = "Create Listing";

    emptyCard.append(title, message, link);
    jobBoard.appendChild(emptyCard);
    return;
  }

  const fragment = document.createDocumentFragment();
  manageListingsState.listings.forEach((listing) => {
    fragment.appendChild(createListingCard(listing));
  });
  jobBoard.appendChild(fragment);
}

function renderStats() {
  const applications = manageListingsState.applications;

  getManageElement("listedRolesCount").textContent =
    manageListingsState.listings.length;
  getManageElement("totalApplicantsCount").textContent =
    applications.length;
  getManageElement("highFitApplicantsCount").textContent =
    applications.filter(
      (application) => getApplicationScore(application) >= 80
    ).length;
  getManageElement("approvedApplicantsCount").textContent =
    applications.filter(isApprovedApplication).length;
}

async function loadCurrentCompany() {
  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    throw userError || new Error("No signed-in user found.");
  }

  const { data: company, error: companyError } = await supabaseClient
    .from("companies")
    .select("id, company_name")
    .eq("profile_id", user.id)
    .single();

  if (companyError) {
    throw companyError;
  }

  manageListingsState.company = company;

  const companyName = company.company_name || "Company";
  getManageElement("companyName").textContent = companyName;
  getManageElement("companyAvatar").textContent =
    companyName.charAt(0).toUpperCase();
}

async function loadCompanyListings() {
  const { data, error } = await supabaseClient
    .from("internship_listings")
    .select(
      "id, title, description, location, work_mode, duration, status, target_field, preferred_major, preferred_year, required_skills, nice_to_have_skills, openings, application_deadline, created_at"
    )
    .eq("company_id", manageListingsState.company.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  manageListingsState.listings = data || [];
}

async function loadListingApplications() {
  const listingIds = manageListingsState.listings.map(
    (listing) => listing.id
  );

  if (listingIds.length === 0) {
    manageListingsState.applications = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("applications")
    .select("*")
    .in("listing_id", listingIds);

  if (error) {
    console.warn("Applications could not be loaded yet:", error);
    manageListingsState.applications = [];
    return;
  }

  manageListingsState.applications = data || [];
}

async function loadQualificationScores() {
  manageListingsState.qualificationScores = new Map();
  manageListingsState.requirementsByListing = new Map();

  if (manageListingsState.applications.length === 0) {
    return;
  }

  const studentIds = [
    ...new Set(manageListingsState.applications.map((item) => item.student_id)),
  ];
  const listingIds = manageListingsState.listings.map((item) => item.id);

  const [studentsResult, skillsResult, requirementsResult] = await Promise.all([
    supabaseClient
      .from("students")
      .select("id, major, year_of_study, preferred_field")
      .in("id", studentIds),
    supabaseClient
      .from("student_skills")
      .select("student_id, skill_name, skill_key, level_number")
      .in("student_id", studentIds),
    supabaseClient
      .from("listing_skills")
      .select("listing_id, skill_id, requirement_type, minimum_level")
      .in("listing_id", listingIds),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (skillsResult.error) throw skillsResult.error;
  if (requirementsResult.error) throw requirementsResult.error;

  const skillIds = [
    ...new Set((requirementsResult.data || []).map((item) => item.skill_id)),
  ];
  let catalog = [];

  if (skillIds.length > 0) {
    const { data, error } = await supabaseClient
      .from("skills")
      .select("id, name, skill_key")
      .in("id", skillIds);

    if (error) throw error;
    catalog = data || [];
  }

  const catalogById = new Map(catalog.map((skill) => [skill.id, skill]));

  (requirementsResult.data || []).forEach((requirement) => {
    const listingRequirements =
      manageListingsState.requirementsByListing.get(requirement.listing_id) || [];
    const catalogSkill = catalogById.get(requirement.skill_id);

    listingRequirements.push({
      ...requirement,
      skill_name: catalogSkill?.name || "Required skill",
      skill_key: catalogSkill?.skill_key || "",
    });
    manageListingsState.requirementsByListing.set(
      requirement.listing_id,
      listingRequirements
    );
  });

  const studentsById = new Map(
    (studentsResult.data || []).map((student) => [student.id, student])
  );
  const listingsById = new Map(
    manageListingsState.listings.map((listing) => [listing.id, listing])
  );

  manageListingsState.applications.forEach((application) => {
    const student = studentsById.get(application.student_id);
    const listing = listingsById.get(application.listing_id);

    if (!student || !listing) {
      return;
    }

    const skills = (skillsResult.data || []).filter(
      (skill) => skill.student_id === application.student_id
    );
    manageListingsState.qualificationScores.set(
      application.id,
      calculateManageQualification(listing, student, skills)
    );
  });
}

async function deleteListing(listingId, button) {
  const listing = manageListingsState.listings.find(
    (item) => item.id === listingId
  );

  if (!listing) {
    setManageMessage("That listing could not be found.", "error");
    return;
  }

  const applications = getApplicationsForListing(listingId);

  if (applications.length > 0) {
    setManageMessage(
      "This listing has applications and cannot be deleted. Keep it for applicant history.",
      "error"
    );
    return;
  }

  const confirmed = window.confirm(
    `Permanently delete “${listing.title || "this internship listing"}”? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  button.disabled = true;
  button.textContent = "Deleting...";
  setManageMessage("Deleting internship listing...");

  try {
    const { data, error } = await supabaseClient
      .from("internship_listings")
      .delete()
      .eq("id", listingId)
      .eq("company_id", manageListingsState.company.id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "The listing was not deleted. Check the company delete policy in Supabase."
      );
    }

    manageListingsState.listings = manageListingsState.listings.filter(
      (item) => item.id !== listingId
    );
    renderStats();
    renderListings();
    setManageMessage("Internship listing deleted successfully.", "success");
  } catch (error) {
    console.error(error);
    button.disabled = false;
    button.textContent = "Delete Listing";
    setManageMessage(
      error.message || "The internship listing could not be deleted.",
      "error"
    );
  }
}

function bindManageListingsEvents() {
  getManageElement("jobBoard").addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-listing]");

    if (!deleteButton) {
      return;
    }

    deleteListing(deleteButton.dataset.deleteListing, deleteButton);
  });

  getManageElement("signOutLink").addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = "../index.html";
    }
  );
}

async function setupManageListingsPage() {
  try {
    const profile = await protectPage("company");

    if (!profile) {
      return;
    }

    bindManageListingsEvents();
    await loadCurrentCompany();
    await loadCompanyListings();
    await loadListingApplications();
    await loadQualificationScores();

    renderStats();
    renderListings();
    setManageMessage("");
  } catch (error) {
    console.error(error);
    getManageElement("jobBoard").setAttribute("aria-busy", "false");
    setManageMessage(
      error.message || "The internship listings could not be loaded.",
      "error"
    );
  }
}

document.addEventListener("DOMContentLoaded", setupManageListingsPage);
