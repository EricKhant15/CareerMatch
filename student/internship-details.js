function getInternshipDetailElement(id) {
  return document.getElementById(id);
}

const internshipDetailState = {
  listing: null,
  studentId: null,
  application: null,
};

function showInternshipDetailMessage(message, type = "info") {
  const element = getInternshipDetailElement("detailPageMessage");

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

function setMatchBar(category, value) {
  const valueElement = getInternshipDetailElement(`${category}MatchValue`);
  const barElement = getInternshipDetailElement(`${category}MatchBar`);

  if (value === null) {
    valueElement.textContent = "Not assessed";
    barElement.style.width = "0";
    return;
  }

  const percentage = Math.max(0, Math.min(100, Number(value) || 0));

  valueElement.textContent = `${percentage}%`;
  barElement.style.width = `${percentage}%`;
}

function createDetailTag(text, className = "tag") {
  const tag = document.createElement("span");
  tag.className = className;
  tag.textContent = text;
  return tag;
}

function renderSkillGapList(elementId, skills, emptyMessage, className) {
  const container = getInternshipDetailElement(elementId);
  container.replaceChildren();

  if (skills.length === 0) {
    container.appendChild(createDetailTag(emptyMessage, "tag"));
    return;
  }

  skills.forEach((skill) => {
    container.appendChild(createDetailTag(skill, className));
  });
}

function createOverviewItem(label, value) {
  const item = document.createElement("li");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  labelElement.textContent = label;
  valueElement.textContent = value || "Not set";
  item.append(labelElement, valueElement);
  return item;
}

function addRecommendationReason(container, isMatch, message) {
  const item = document.createElement("li");
  const icon = document.createElement("span");
  const text = document.createElement("span");

  icon.className = isMatch ? "check" : "reason-warning";
  icon.textContent = isMatch ? "✓" : "!";
  text.textContent = message;
  item.append(icon, text);
  container.appendChild(item);
}

function getOverallMatchLabel(score) {
  if (score >= 80) return "Great match";
  if (score >= 60) return "Good match";
  if (score >= 40) return "Possible match";
  return "Profile gaps found";
}

function renderInternshipDetails(recommendation, profile) {
  const company = recommendationState.companies.get(
    recommendation.company_id
  );
  const companyName = company?.company_name || "Company";

  document.title = `${recommendation.title} - CareerMatch`;
  getInternshipDetailElement("detailPageTitle").textContent =
    recommendation.title;
  getInternshipDetailElement("detailListingTitle").textContent =
    recommendation.title;
  getInternshipDetailElement("detailCompanyName").textContent = companyName;
  getInternshipDetailElement("detailCompanyAvatar").textContent =
    companyName.charAt(0).toUpperCase();
  getInternshipDetailElement("detailDescription").textContent =
    recommendation.description || "No internship description was provided.";

  const tags = getInternshipDetailElement("detailListingTags");
  tags.replaceChildren(
    createDetailTag(recommendation.location || "Location not set"),
    createDetailTag(recommendation.duration || "Duration not set"),
    createDetailTag(recommendation.allowance || "Allowance not set"),
    createDetailTag(recommendation.work_mode || "Mode not set"),
    createDetailTag(recommendation.mentorship || "Mentorship not set")
  );

  getInternshipDetailElement("overallMatchScore").textContent =
    `${recommendation.score}%`;
  getInternshipDetailElement("overallMatchLabel").textContent =
    getOverallMatchLabel(recommendation.score);
  getInternshipDetailElement("overallMatchRing").style.background =
    `conic-gradient(var(--purple) ${recommendation.score}%, var(--purple-soft) 0)`;

  getInternshipDetailElement("qualificationScoreValue").textContent =
    `${recommendation.qualificationScore}%`;
  getInternshipDetailElement("compatibilityScoreValue").textContent =
    recommendation.compatibilityScore === null
      ? "Not assessed"
      : `${recommendation.compatibilityScore}%`;

  setMatchBar("requiredSkills", recommendation.breakdown.requiredSkills);
  setMatchBar("niceSkills", recommendation.breakdown.niceSkills);
  setMatchBar("fieldMajor", recommendation.breakdown.fieldMajor);
  setMatchBar("year", recommendation.breakdown.year);
  setMatchBar("availability", recommendation.breakdown.availability);
  setMatchBar("location", recommendation.breakdown.location);
  setMatchBar("workMode", recommendation.breakdown.workMode);
  setMatchBar("allowance", recommendation.breakdown.allowance);
  setMatchBar("mentorship", recommendation.breakdown.mentorship);

  renderSkillGapList(
    "matchedSkills",
    recommendation.matchedSkills,
    "No required skills matched yet",
    "tag good"
  );
  renderSkillGapList(
    "missingSkills",
    recommendation.missingSkills,
    "No required skill gaps",
    "tag missing"
  );

  const reasons = getInternshipDetailElement("recommendationReasons");
  reasons.replaceChildren();

  addRecommendationReason(
    reasons,
    recommendation.breakdown.requiredSkills >= 70,
    recommendation.breakdown.requiredSkills >= 70
      ? "Your technical skills meet most of the required skill levels."
      : "Some required technical skills or levels are missing from your profile."
  );
  addRecommendationReason(
    reasons,
    recommendation.breakdown.fieldMajor === 100,
    recommendation.breakdown.fieldMajor === 100
      ? `The internship matches your preferred field: ${profile.field}.`
      : `The internship field differs from your preference: ${profile.field || "not set"}.`
  );
  addRecommendationReason(
    reasons,
    recommendation.breakdown.availability === 100,
    recommendation.breakdown.availability === 100
      ? "Your available days meet the company's minimum availability."
      : "Your current availability is below the company's preference."
  );
  addRecommendationReason(
    reasons,
    recommendation.breakdown.location === 100,
    recommendation.breakdown.location === 100
      ? "The location is compatible with your preference."
      : "The internship location differs from your preferred location."
  );
  addRecommendationReason(
    reasons,
    recommendation.breakdown.workMode === 100,
    recommendation.breakdown.workMode === 100
      ? "The work mode matches your preference."
      : "The work mode differs from your preference."
  );

  const overview = getInternshipDetailElement("detailOverview");
  overview.replaceChildren(
    createOverviewItem("Target field", recommendation.target_field),
    createOverviewItem("Department", recommendation.department),
    createOverviewItem("Openings", String(recommendation.openings || 1)),
    createOverviewItem("Minimum availability", recommendation.minimum_availability),
    createOverviewItem("Preferred major", recommendation.preferred_major),
    createOverviewItem("Preferred year", recommendation.preferred_year),
    createOverviewItem("Application deadline", formatListingDateForDetails(recommendation.application_deadline))
  );

  const saveButton = getInternshipDetailElement("saveInternshipButton");
  saveButton.dataset.saveInternship = recommendation.id;
  setupSaveButtons();
  refreshHeartButtons();

}

function showApplicationActionMessage(message, type = "info") {
  const element = getInternshipDetailElement("applicationActionMessage");
  const colors = {
    error: "#d92d3e",
    success: "#169c4b",
    info: "#7224e8",
  };

  element.textContent = message;
  element.style.color = colors[type] || colors.info;
}

function renderApplicationAction() {
  const applyButton = getInternshipDetailElement("applyNowButton");
  const viewLink = getInternshipDetailElement("viewApplicationLink");

  if (internshipDetailState.application) {
    applyButton.hidden = true;
    viewLink.hidden = false;
    showApplicationActionMessage(
      `Application status: ${internshipDetailState.application.status}`,
      "success"
    );
    return;
  }

  applyButton.hidden = false;
  applyButton.disabled = false;
  applyButton.textContent = "Apply Now";
  viewLink.hidden = true;
}

async function loadStudentId() {
  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    throw userError || new Error("No signed-in student was found.");
  }

  const { data: student, error: studentError } = await supabaseClient
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (studentError) {
    throw studentError;
  }

  internshipDetailState.studentId = student.id;
}

async function loadExistingApplication() {
  const { data, error } = await supabaseClient
    .from("applications")
    .select("id, status, applied_at")
    .eq("student_id", internshipDetailState.studentId)
    .eq("listing_id", internshipDetailState.listing.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  internshipDetailState.application = data || null;
  renderApplicationAction();
}

async function submitApplication() {
  const applyButton = getInternshipDetailElement("applyNowButton");
  applyButton.disabled = true;
  applyButton.textContent = "Submitting...";
  showApplicationActionMessage("Submitting your application...");

  try {
    const { data, error } = await supabaseClient
      .from("applications")
      .insert({
        student_id: internshipDetailState.studentId,
        listing_id: internshipDetailState.listing.id,
        status: "Under Review",
      })
      .select("id, status, applied_at")
      .single();

    if (error) {
      throw error;
    }

    internshipDetailState.application = data;
    renderApplicationAction();
    showApplicationActionMessage(
      "Application submitted successfully.",
      "success"
    );
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      await loadExistingApplication();
      return;
    }

    applyButton.disabled = false;
    applyButton.textContent = "Apply Now";
    showApplicationActionMessage(
      error.message || "Your application could not be submitted.",
      "error"
    );
  }
}

function bindApplicationAction() {
  getInternshipDetailElement("applyNowButton").addEventListener(
    "click",
    submitApplication
  );
}

function formatListingDateForDetails(value) {
  if (!value) return "Not set";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function loadSelectedInternship(listingId) {
  const { data, error } = await supabaseClient
    .from("internship_listings")
    .select(
      "id, company_id, title, department, description, location, work_mode, duration, allowance, target_field, minimum_availability, preferred_major, preferred_year, mentorship, required_skills, nice_to_have_skills, status, application_deadline, openings, created_at"
    )
    .eq("id", listingId)
    .eq("status", "Open")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function setupInternshipDetailsPage() {
  try {
    const account = await protectPage("student");

    if (!account) {
      return;
    }

    const listingId = new URLSearchParams(window.location.search).get(
      "listing_id"
    );

    if (!listingId) {
      throw new Error("No internship listing was selected.");
    }

    const profile = await loadStudentProfileFromSupabase();
    const listing = await loadSelectedInternship(listingId);
    internshipDetailState.listing = listing;

    recommendationState.listings = [listing];
    recommendationState.companies.clear();
    recommendationState.requirementsByListing.clear();

    await Promise.all([loadListingCompanies(), loadListingRequirements()]);

    const recommendation = calculateRecommendation(listing, profile);
    renderInternshipDetails(recommendation, profile);
    await loadStudentId();
    await loadExistingApplication();
    bindApplicationAction();
    showInternshipDetailMessage("");
  } catch (error) {
    console.error(error);
    showInternshipDetailMessage(
      error.message || "The internship details could not be loaded.",
      "error"
    );
  }
}

document.addEventListener("DOMContentLoaded", setupInternshipDetailsPage);
