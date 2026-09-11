const recommendationState = {
  profile: null,
  listings: [],
  companies: new Map(),
  requirementsByListing: new Map(),
};

const QUALIFICATION_WEIGHTS = {
  requiredSkills: 60,
  niceSkills: 15,
  targetField: 15,
  major: 5,
  year: 5,
};

const COMPATIBILITY_WEIGHTS = {
  availability: 30,
  location: 20,
  workMode: 20,
  allowance: 15,
  mentorship: 15,
};

function getRecommendationElement(id) {
  return document.getElementById(id);
}

function normalizeMatchText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeMatchSkill(value) {
  return normalizeMatchText(value).replace(/[^a-z0-9]/g, "");
}

function showRecommendationsMessage(message, type = "info") {
  const element = getRecommendationElement("recommendationsMessage");

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

function getStudentSkillMap(profile) {
  const skillMap = new Map();

  (profile.skills || []).forEach((skillName) => {
    const levelName = profile.skillLevels?.[skillName] || "Beginner";
    skillMap.set(normalizeMatchSkill(skillName), {
      name: skillName,
      level: getLevelNumber(levelName),
    });
  });

  return skillMap;
}

function getRequiredAvailability(value) {
  if (normalizeMatchText(value) === "full-time") {
    return 5;
  }

  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getMentorshipMatch(studentPreference, companyOption) {
  const preference = normalizeMatchText(studentPreference);
  const option = normalizeMatchText(companyOption);

  if (!preference || preference === "not needed") {
    return 1;
  }

  if (preference === "required") {
    if (option === "provided") return 1;
    if (option === "limited") return 0.5;
    return 0;
  }

  if (preference === "preferred") {
    if (option === "provided") return 1;
    if (option === "limited") return 0.75;
    return 0.25;
  }

  return 0.5;
}

function getListingRequirements(listing, requirementType) {
  const databaseRequirements =
    recommendationState.requirementsByListing.get(listing.id) || [];

  const requirements = databaseRequirements.filter(
    (requirement) => requirement.requirement_type === requirementType
  );

  if (requirements.length > 0) {
    return requirements;
  }

  const fallbackSkills =
    requirementType === "required"
      ? listing.required_skills
      : listing.nice_to_have_skills;

  return (fallbackSkills || []).map((skillName) => ({
    skill_name: skillName,
    skill_key: normalizeMatchSkill(skillName),
    minimum_level: 1,
    requirement_type: requirementType,
  }));
}

function calculateSkillMatch(requirements, studentSkillMap, trackGaps = false) {
  if (requirements.length === 0) {
    return {
      ratio: 1,
      matchedSkills: [],
      missingSkills: [],
      skillStatuses: [],
    };
  }

  let earnedRatio = 0;
  const matchedSkills = [];
  const missingSkills = [];
  const skillStatuses = [];

  requirements.forEach((requirement) => {
    const key = normalizeMatchSkill(
      requirement.skill_key || requirement.skill_name
    );
    const studentSkill = studentSkillMap.get(key);
    const requiredLevel = Number(requirement.minimum_level) || 1;
    const skillName = requirement.skill_name || studentSkill?.name || "Required skill";

    if (!studentSkill) {
      skillStatuses.push({
        name: skillName,
        matched: false,
        studentLevel: 0,
        requiredLevel,
      });
      if (trackGaps) {
        missingSkills.push(skillName);
      }
      return;
    }

    const levelRatio = Math.min(studentSkill.level / requiredLevel, 1);
    earnedRatio += levelRatio;

    if (studentSkill.level >= requiredLevel) {
      skillStatuses.push({
        name: skillName,
        matched: true,
        studentLevel: studentSkill.level,
        requiredLevel,
      });
      if (trackGaps) {
        matchedSkills.push(skillName);
      }
    } else if (trackGaps) {
      skillStatuses.push({
        name: skillName,
        matched: false,
        studentLevel: studentSkill.level,
        requiredLevel,
      });
      missingSkills.push(
        `${skillName} (higher level needed)`
      );
    } else {
      skillStatuses.push({
        name: skillName,
        matched: false,
        studentLevel: studentSkill.level,
        requiredLevel,
      });
    }
  });

  return {
    ratio: earnedRatio / requirements.length,
    matchedSkills,
    missingSkills,
    skillStatuses,
  };
}

function averageRatios(ratios) {
  if (ratios.length === 0) {
    return 1;
  }

  return ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length;
}

function calculateWeightedCompatibility(criteria) {
  const applicableCriteria = criteria.filter(
    (criterion) => criterion.ratio !== null
  );

  if (applicableCriteria.length === 0) {
    return null;
  }

  const availableWeight = applicableCriteria.reduce(
    (total, criterion) => total + criterion.weight,
    0
  );

  return (
    applicableCriteria.reduce(
      (total, criterion) => total + criterion.ratio * criterion.weight,
      0
    ) / availableWeight
  );
}

function calculateRecommendation(listing, profile) {
  const studentSkillMap = getStudentSkillMap(profile);
  const requiredSkillResult = calculateSkillMatch(
    getListingRequirements(listing, "required"),
    studentSkillMap,
    true
  );
  const niceSkillResult = calculateSkillMatch(
    getListingRequirements(listing, "nice_to_have"),
    studentSkillMap
  );

  const targetFieldRatio = listing.target_field
    ? normalizeMatchText(profile.field) ===
      normalizeMatchText(listing.target_field) ? 1 : 0
    : 1;
  const majorRatio = listing.preferred_major
    ? normalizeMatchText(profile.major) ===
      normalizeMatchText(listing.preferred_major) ? 1 : 0
    : 1;
  const yearRatio = listing.preferred_year
    ? normalizeMatchText(profile.year) ===
      normalizeMatchText(listing.preferred_year)
      ? 1
      : 0
    : 1;

  const qualificationScore = Math.round(
    requiredSkillResult.ratio * QUALIFICATION_WEIGHTS.requiredSkills +
      niceSkillResult.ratio * QUALIFICATION_WEIGHTS.niceSkills +
      targetFieldRatio * QUALIFICATION_WEIGHTS.targetField +
      majorRatio * QUALIFICATION_WEIGHTS.major +
      yearRatio * QUALIFICATION_WEIGHTS.year
  );

  const requiredDays = getRequiredAvailability(
    listing.minimum_availability
  );
  const availableDays = Array.isArray(profile.availability)
    ? profile.availability.length
    : 0;
  const availabilityRatio = listing.minimum_availability
    ? Math.min(availableDays / requiredDays, 1)
    : null;

  const isRemote = normalizeMatchText(listing.work_mode) === "remote";
  const locationRatio =
    listing.location && profile.location
      ? isRemote ||
        normalizeMatchText(profile.location) ===
          normalizeMatchText(listing.location)
        ? 1
        : 0
      : null;

  const workModeRatio = listing.work_mode && profile.workStyle
    ? normalizeMatchText(profile.workStyle) ===
      normalizeMatchText(listing.work_mode)
      ? 1
      : 0
    : null;

  const allowanceRatio = listing.allowance && profile.internshipType
    ? normalizeMatchText(profile.internshipType) === "either" ||
      normalizeMatchText(profile.internshipType) ===
        normalizeMatchText(listing.allowance)
      ? 1
      : 0
    : null;

  const mentorshipRatio = listing.mentorship && profile.mentorship
    ? getMentorshipMatch(profile.mentorship, listing.mentorship)
    : null;

  const compatibilityRatio = calculateWeightedCompatibility([
    {
      ratio: availabilityRatio,
      weight: COMPATIBILITY_WEIGHTS.availability,
    },
    { ratio: locationRatio, weight: COMPATIBILITY_WEIGHTS.location },
    { ratio: workModeRatio, weight: COMPATIBILITY_WEIGHTS.workMode },
    { ratio: allowanceRatio, weight: COMPATIBILITY_WEIGHTS.allowance },
    { ratio: mentorshipRatio, weight: COMPATIBILITY_WEIGHTS.mentorship },
  ]);
  const compatibilityScore =
    compatibilityRatio === null
      ? null
      : Math.round(compatibilityRatio * 100);

  const breakdown = {
    requiredSkills: Math.round(requiredSkillResult.ratio * 100),
    niceSkills: Math.round(niceSkillResult.ratio * 100),
    targetField: Math.round(targetFieldRatio * 100),
    major: Math.round(majorRatio * 100),
    year: Math.round(yearRatio * 100),
    availability:
      availabilityRatio === null ? null : Math.round(availabilityRatio * 100),
    location:
      locationRatio === null ? null : Math.round(locationRatio * 100),
    workMode:
      workModeRatio === null ? null : Math.round(workModeRatio * 100),
    allowance:
      allowanceRatio === null ? null : Math.round(allowanceRatio * 100),
    mentorship:
      mentorshipRatio === null ? null : Math.round(mentorshipRatio * 100),
  };

  const score = compatibilityScore === null
    ? qualificationScore
    : Math.round(qualificationScore * 0.7 + compatibilityScore * 0.3);

  return {
    ...listing,
    score,
    qualificationScore,
    compatibilityScore,
    breakdown,
    matchedSkills: requiredSkillResult.matchedSkills,
    missingSkills: requiredSkillResult.missingSkills,
    requiredSkillStatuses: requiredSkillResult.skillStatuses,
  };
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

function createRecommendationCard(recommendation) {
  const company = recommendationState.companies.get(
    recommendation.company_id
  );
  const companyName = company?.company_name || "Company";

  const card = document.createElement("article");
  card.className = "intern-card";

  const saveButton = document.createElement("button");
  saveButton.className = "heart-btn";
  saveButton.type = "button";
  saveButton.dataset.saveInternship = recommendation.id;
  saveButton.setAttribute("aria-label", `Save ${recommendation.title}`);
  saveButton.textContent = "♡";

  const companyImage = document.createElement("div");
  companyImage.className = "company-image";
  companyImage.textContent = companyName;

  const body = document.createElement("div");
  body.className = "intern-body";

  const title = document.createElement("h3");
  title.textContent = `${companyName} (${recommendation.title})`;

  const details = document.createElement("ul");
  details.className = "detail-list";
  details.append(
    createDetailItem("Location", recommendation.location),
    createDetailItem("Duration", recommendation.duration),
    createDetailItem("Allowance", recommendation.allowance),
    createDetailItem("Mode", recommendation.work_mode)
  );

  const requiredSkillsItem = document.createElement("li");
  requiredSkillsItem.className = "required-skills-detail";
  const requiredSkillsLabel = document.createElement("span");
  requiredSkillsLabel.textContent = "Required skills";
  const requiredSkillsText = document.createElement("strong");
  requiredSkillsText.className = "required-skills-text";

  if (recommendation.requiredSkillStatuses.length) {
    recommendation.requiredSkillStatuses.forEach((skill, index) => {
      const skillText = document.createElement("span");
      skillText.className = `skill-fit-text ${skill.matched ? "matched" : "unmatched"}`;
      skillText.textContent = `${index ? ", " : ""}${skill.name}`;
      skillText.title = skill.matched
        ? `${skill.name}: required level met`
        : skill.studentLevel
          ? `${skill.name}: your level ${skill.studentLevel}, required level ${skill.requiredLevel}`
          : `${skill.name}: not listed in your profile`;
      requiredSkillsText.appendChild(skillText);
    });
  } else {
    requiredSkillsText.textContent = "None listed";
  }

  requiredSkillsItem.append(requiredSkillsLabel, requiredSkillsText);
  details.appendChild(requiredSkillsItem);

  const skillSummary = document.createElement("div");
  skillSummary.className = "recommendation-skill-summary";

  const matched = document.createElement("span");
  matched.className = "tag good";
  matched.textContent = `${recommendation.matchedSkills.length} skills matched`;

  const missing = document.createElement("span");
  missing.className = recommendation.missingSkills.length ? "tag missing" : "tag good";
  missing.textContent = recommendation.missingSkills.length
    ? `${recommendation.missingSkills.length} skill gaps`
    : "No required skill gaps";
  skillSummary.append(matched, missing);

  const scoreSummary = document.createElement("p");
  scoreSummary.className = "recommendation-score-summary";
  scoreSummary.textContent = `${recommendation.qualificationScore}% qualification · ${
    recommendation.compatibilityScore === null
      ? "Compatibility not assessed"
      : `${recommendation.compatibilityScore}% compatibility`
  }`;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const detailsLink = document.createElement("a");
  detailsLink.className = "primary-btn";
  detailsLink.href = `google-details.html?listing_id=${encodeURIComponent(
    recommendation.id
  )}`;
  detailsLink.textContent = "See Details";

  const matchPill = document.createElement("span");
  matchPill.className = "match-pill";
  matchPill.textContent = `${recommendation.score}% match`;

  actions.append(detailsLink, matchPill);
  body.append(title, details, skillSummary, scoreSummary, actions);
  card.append(saveButton, companyImage, body);

  return card;
}

function renderRecommendations(recommendations) {
  const grid = getRecommendationElement("recommendationsGrid");
  grid.replaceChildren();
  grid.setAttribute("aria-busy", "false");

  if (recommendations.length === 0) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "panel recommendation-state-card";

    const title = document.createElement("h2");
    title.textContent = "No open internships yet";

    const message = document.createElement("p");
    message.textContent =
      "New company listings will appear here as soon as they are published.";

    emptyCard.append(title, message);
    grid.appendChild(emptyCard);
    return;
  }

  const fragment = document.createDocumentFragment();
  recommendations.forEach((recommendation) => {
    fragment.appendChild(createRecommendationCard(recommendation));
  });
  grid.appendChild(fragment);

  setupSaveButtons();
  refreshHeartButtons();
}

async function loadOpenListings() {
  const { data, error } = await supabaseClient
    .from("internship_listings")
    .select(
      "id, company_id, title, description, location, work_mode, duration, allowance, target_field, minimum_availability, preferred_major, preferred_year, mentorship, required_skills, nice_to_have_skills, status, application_deadline, openings, created_at"
    )
    .eq("status", "Open")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  recommendationState.listings = data || [];
}

async function loadListingCompanies() {
  const companyIds = [
    ...new Set(recommendationState.listings.map((listing) => listing.company_id)),
  ];

  if (companyIds.length === 0) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("companies")
    .select("id, company_name")
    .in("id", companyIds);

  if (error) {
    throw error;
  }

  recommendationState.companies = new Map(
    (data || []).map((company) => [company.id, company])
  );
}

async function loadListingRequirements() {
  const listingIds = recommendationState.listings.map((listing) => listing.id);

  if (listingIds.length === 0) {
    return;
  }

  const { data: requirementRows, error: requirementsError } =
    await supabaseClient
      .from("listing_skills")
      .select("listing_id, skill_id, requirement_type, minimum_level")
      .in("listing_id", listingIds);

  if (requirementsError) {
    console.warn(
      "Detailed skill requirements could not be loaded; using listing skill names.",
      requirementsError
    );
    return;
  }

  const skillIds = [
    ...new Set((requirementRows || []).map((row) => row.skill_id)),
  ];

  if (skillIds.length === 0) {
    return;
  }

  const { data: skills, error: skillsError } = await supabaseClient
    .from("skills")
    .select("id, name, skill_key")
    .in("id", skillIds);

  if (skillsError) {
    console.warn(
      "Skill names could not be loaded; using listing skill names.",
      skillsError
    );
    return;
  }

  const skillsById = new Map((skills || []).map((skill) => [skill.id, skill]));

  (requirementRows || []).forEach((row) => {
    const skill = skillsById.get(row.skill_id);

    if (!skill) {
      return;
    }

    const listingRequirements =
      recommendationState.requirementsByListing.get(row.listing_id) || [];

    listingRequirements.push({
      ...row,
      skill_name: skill.name,
      skill_key: skill.skill_key,
    });

    recommendationState.requirementsByListing.set(
      row.listing_id,
      listingRequirements
    );
  });
}

async function setupRecommendationsPage() {
  if (!getRecommendationElement("recommendationsGrid")) {
    return;
  }

  try {
    const account = await protectPage("student");

    if (!account) {
      return;
    }

    recommendationState.profile = await loadStudentProfileFromSupabase();

    const studentName = recommendationState.profile.name || "Student";
    getRecommendationElement("studentName").textContent = studentName;
    getRecommendationElement("studentAvatar").textContent =
      studentName.charAt(0).toUpperCase();

    await loadOpenListings();
    await Promise.all([loadListingCompanies(), loadListingRequirements()]);

    const recommendations = recommendationState.listings
      .map((listing) =>
        calculateRecommendation(listing, recommendationState.profile)
      )
      .sort((first, second) => second.score - first.score);

    renderRecommendations(recommendations);
    showRecommendationsMessage(
      recommendations.length
        ? `${recommendations.length} open internship${
            recommendations.length === 1 ? "" : "s"
          } ranked for your profile.`
        : ""
    );
  } catch (error) {
    console.error(error);
    getRecommendationElement("recommendationsGrid").setAttribute(
      "aria-busy",
      "false"
    );
    showRecommendationsMessage(
      error.message || "Recommendations could not be loaded.",
      "error"
    );
  }
}

document.addEventListener("DOMContentLoaded", setupRecommendationsPage);
