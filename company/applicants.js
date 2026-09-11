const applicantReviewState = {
  company: null,
  listing: null,
  requirements: [],
  applicants: [],
  selectedApplicationId: null,
};

function getApplicantElement(id) {
  return document.getElementById(id);
}

function normalizeApplicantText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeApplicantSkill(value) {
  return normalizeApplicantText(value).replace(/[^a-z0-9]/g, "");
}

function showApplicantMessage(elementId, message, type = "info") {
  const element = getApplicantElement(elementId);
  const colors = { error: "#d92d3e", success: "#169c4b", info: "#7224e8" };
  element.textContent = message;
  element.style.color = colors[type] || colors.info;
}

function getApplicantRequirements(type) {
  const rows = applicantReviewState.requirements.filter(
    (requirement) => requirement.requirement_type === type
  );
  if (rows.length > 0) return rows;

  const fallback = type === "required"
    ? applicantReviewState.listing.required_skills
    : applicantReviewState.listing.nice_to_have_skills;
  return (fallback || []).map((name) => ({
    skill_name: name,
    skill_key: normalizeApplicantSkill(name),
    minimum_level: 1,
    requirement_type: type,
  }));
}

function calculateApplicantSkillRatio(requirements, skills) {
  if (requirements.length === 0) return 1;
  const skillMap = new Map(
    skills.map((skill) => [
      normalizeApplicantSkill(skill.skill_key || skill.skill_name),
      Number(skill.level_number) || 1,
    ])
  );
  const total = requirements.reduce((sum, requirement) => {
    const level = skillMap.get(
      normalizeApplicantSkill(requirement.skill_key || requirement.skill_name)
    ) || 0;
    return sum + Math.min(level / (Number(requirement.minimum_level) || 1), 1);
  }, 0);
  return total / requirements.length;
}

function calculateApplicantQualification(student, skills) {
  const required = getApplicantRequirements("required");
  const nice = getApplicantRequirements("nice_to_have");
  const requiredRatio = calculateApplicantSkillRatio(required, skills);
  const niceRatio = calculateApplicantSkillRatio(nice, skills);

  const targetFieldRatio = applicantReviewState.listing.target_field
    ? normalizeApplicantText(student.preferred_field) ===
      normalizeApplicantText(applicantReviewState.listing.target_field) ? 1 : 0
    : 1;
  const majorRatio = applicantReviewState.listing.preferred_major
    ? normalizeApplicantText(student.major) ===
      normalizeApplicantText(applicantReviewState.listing.preferred_major) ? 1 : 0
    : 1;
  const yearRatio = applicantReviewState.listing.preferred_year
    ? normalizeApplicantText(student.year_of_study) ===
      normalizeApplicantText(applicantReviewState.listing.preferred_year) ? 1 : 0
    : 1;

  return Math.round(
    requiredRatio * 60 + niceRatio * 15 + targetFieldRatio * 15 + majorRatio * 5 + yearRatio * 5
  );
}

function getQualificationLabel(score) {
  if (score >= 80) return "Strong match";
  if (score >= 65) return "Good match";
  if (score >= 50) return "Partial match";
  return "Significant skill gaps";
}

function getSelectedApplicant() {
  return applicantReviewState.applicants.find(
    (applicant) => applicant.application.id === applicantReviewState.selectedApplicationId
  );
}

function renderSkillTags(containerId, values, className, emptyText) {
  const container = getApplicantElement(containerId);
  container.replaceChildren();
  if (values.length === 0) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = emptyText;
    container.appendChild(tag);
    return;
  }
  values.forEach((value) => {
    const tag = document.createElement("span");
    tag.className = className;
    tag.textContent = value;
    container.appendChild(tag);
  });
}

function getSkillComparison(applicant) {
  const skillMap = new Map(
    applicant.skills.map((skill) => [normalizeApplicantSkill(skill.skill_key || skill.skill_name), skill])
  );
  const matched = [];
  const gaps = [];

  getApplicantRequirements("required").forEach((requirement) => {
    const skill = skillMap.get(normalizeApplicantSkill(requirement.skill_key || requirement.skill_name));
    const needed = Number(requirement.minimum_level) || 1;
    const actual = Number(skill?.level_number) || 0;
    if (actual >= needed) {
      matched.push(`${requirement.skill_name} · Level ${actual}`);
    } else if (actual > 0) {
      gaps.push(`${requirement.skill_name} · Level ${actual}, needs ${needed}`);
    } else {
      gaps.push(`${requirement.skill_name} · Missing, needs Level ${needed}`);
    }
  });
  return { matched, gaps };
}

function renderSelectedApplicant() {
  const applicant = getSelectedApplicant();
  if (!applicant) return;

  document.querySelectorAll(".applicant-item").forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.applicationId === applicant.application.id
    );
  });

  const name = applicant.profile?.full_name || "Student";
  getApplicantElement("selectedApplicantAvatar").textContent = name.charAt(0).toUpperCase();
  getApplicantElement("selectedApplicantName").textContent = name;
  getApplicantElement("selectedApplicantSummary").textContent =
    `${applicant.student.major || "Major not set"} · ${applicant.student.university || "University not set"}`;
  getApplicantElement("selectedApplicantGoal").textContent =
    applicant.student.career_goal || "No career goal was provided.";
  getApplicantElement("selectedApplicantScore").textContent = `${applicant.score}%`;
  getApplicantElement("selectedApplicantScoreLabel").textContent =
    `${getQualificationLabel(applicant.score)} · qualification score`;
  getApplicantElement("applicantScoreRing").style.background =
    `conic-gradient(var(--purple) ${applicant.score}%, var(--purple-soft) 0)`;

  const comparison = getSkillComparison(applicant);
  renderSkillTags("selectedApplicantSkills", comparison.matched, "tag good", "No required skills met yet");
  renderSkillTags("selectedApplicantGaps", comparison.gaps, "tag missing", "No required skill gaps");

  getApplicantElement("selectedApplicantEmail").textContent = applicant.profile?.email || "—";
  getApplicantElement("selectedApplicantMajor").textContent = applicant.student.major || "—";
  getApplicantElement("selectedApplicantYear").textContent = applicant.student.year_of_study || "—";
  getApplicantElement("selectedApplicantAvailability").textContent =
    (applicant.student.availability || []).join(", ") || "—";
  getApplicantElement("selectedApplicantLocation").textContent =
    applicant.student.preferred_location || "—";
  getApplicantElement("selectedApplicantWorkStyle").textContent =
    applicant.student.work_style || "—";

  const cvButton = getApplicantElement("viewApplicantCvButton");
  getApplicantElement("selectedApplicantCvName").textContent =
    applicant.application.cv_filename || "No CV was submitted with this application.";
  cvButton.disabled = !applicant.application.cv_path;

  getApplicantElement("acceptApplicantButton").disabled = false;
  getApplicantElement("rejectApplicantButton").disabled = false;
  showApplicantMessage("applicantActionMessage", `Current status: ${applicant.application.status}`);
}

function renderApplicantList() {
  const list = getApplicantElement("applicantList");
  list.replaceChildren();
  list.setAttribute("aria-busy", "false");

  if (applicantReviewState.applicants.length === 0) {
    const message = document.createElement("p");
    message.textContent = "No students have applied to this listing yet.";
    list.appendChild(message);
    return;
  }

  applicantReviewState.applicants.forEach((applicant, index) => {
    const item = document.createElement("button");
    item.className = `applicant-item${index === 0 ? " active" : ""}`;
    item.type = "button";
    item.dataset.applicationId = applicant.application.id;

    const avatar = document.createElement("div");
    avatar.className = "avatar small";
    const name = applicant.profile?.full_name || "Student";
    avatar.textContent = name.charAt(0).toUpperCase();

    const body = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = name;
    const summary = document.createElement("p");
    summary.textContent = `${applicant.student.major || "Major not set"} · ${applicant.student.year_of_study || "Year not set"}`;
    const score = document.createElement("span");
    score.className = applicant.score >= 65 ? "tag good" : "tag";
    score.textContent = `${applicant.score}% qualification`;
    body.append(heading, summary, score);
    item.append(avatar, body);

    item.addEventListener("click", () => {
      applicantReviewState.selectedApplicationId = applicant.application.id;
      renderSelectedApplicant();
    });
    list.appendChild(item);
  });

  applicantReviewState.selectedApplicationId =
    applicantReviewState.applicants[0].application.id;
  renderSelectedApplicant();
}

function renderApplicantStats() {
  const applicants = applicantReviewState.applicants;
  getApplicantElement("applicantCount").textContent = applicants.length;
  getApplicantElement("strongMatchCount").textContent = applicants.filter((item) => item.score >= 80).length;
  getApplicantElement("interviewReadyCount").textContent = applicants.filter(
    (item) => item.score >= 65 && item.application.status === "Under Review"
  ).length;
  getApplicantElement("pendingDecisionCount").textContent = applicants.filter(
    (item) => item.application.status === "Under Review" || item.application.status === "Interview Scheduled"
  ).length;
}

async function updateSelectedApplication(status) {
  const applicant = getSelectedApplicant();
  if (!applicant) return;

  getApplicantElement("acceptApplicantButton").disabled = true;
  getApplicantElement("rejectApplicantButton").disabled = true;
  showApplicantMessage("applicantActionMessage", `Updating status to ${status}...`);

  const { error } = await supabaseClient
    .from("applications")
    .update({ status })
    .eq("id", applicant.application.id);

  if (error) {
    showApplicantMessage("applicantActionMessage", error.message, "error");
    renderSelectedApplicant();
    return;
  }

  applicant.application.status = status;
  let completionMessage = `Application marked ${status}.`;

  if (status === "Accepted") {
    const acceptedCount = applicantReviewState.applicants.filter(
      (item) => item.application.status === "Accepted"
    ).length;
    const openings = Number(applicantReviewState.listing.openings) || 1;

    if (
      acceptedCount >= openings &&
      applicantReviewState.listing.status === "Open" &&
      window.confirm(
        `All ${openings} available ${openings === 1 ? "position has" : "positions have"} been filled. Close this listing as Filled?`
      )
    ) {
      const { error: listingError } = await supabaseClient
        .from("internship_listings")
        .update({ status: "Filled", updated_at: new Date().toISOString() })
        .eq("id", applicantReviewState.listing.id)
        .eq("company_id", applicantReviewState.company.id);

      if (listingError) {
        console.error(listingError);
        completionMessage = `Application marked ${status}, but the listing could not be marked Filled: ${listingError.message}`;
      } else {
        applicantReviewState.listing.status = "Filled";
        const { error: notificationError } = await supabaseClient.rpc("notify_listing_applicants", {
          p_listing_id: applicantReviewState.listing.id,
          p_summary: "All available positions have been filled. This internship is no longer accepting applications.",
        });
        completionMessage = notificationError
          ? `Application marked ${status} and the listing was filled, but students could not be notified: ${notificationError.message}`
          : `Application marked ${status}. The listing is now Filled and applied students were notified.`;
        if (notificationError) console.error(notificationError);
      }
    }
  }

  renderApplicantStats();
  renderSelectedApplicant();
  showApplicantMessage(
    "applicantActionMessage",
    completionMessage,
    completionMessage.includes("could not") ? "error" : "success"
  );
}

async function viewSelectedApplicantCv() {
  const applicant = getSelectedApplicant();
  if (!applicant?.application.cv_path) return;

  const button = getApplicantElement("viewApplicantCvButton");
  const cvWindow = window.open("", "_blank");
  button.disabled = true;
  button.textContent = "Opening...";

  const { data, error } = await supabaseClient.storage
    .from("application-cvs")
    .createSignedUrl(applicant.application.cv_path, 300);

  button.disabled = false;
  button.textContent = "View CV";

  if (error) {
    cvWindow?.close();
    showApplicantMessage("applicantActionMessage", error.message, "error");
    return;
  }

  if (cvWindow) {
    cvWindow.opener = null;
    cvWindow.location = data.signedUrl;
  } else {
    window.location.href = data.signedUrl;
  }
}

async function loadApplicantReviewData(listingId) {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) throw userError || new Error("No signed-in company found.");

  const { data: company, error: companyError } = await supabaseClient
    .from("companies")
    .select("id, company_name")
    .eq("profile_id", userData.user.id)
    .single();
  if (companyError) throw companyError;
  applicantReviewState.company = company;

  const { data: listing, error: listingError } = await supabaseClient
    .from("internship_listings")
    .select("*")
    .eq("id", listingId)
    .eq("company_id", company.id)
    .single();
  if (listingError) throw listingError;
  applicantReviewState.listing = listing;

  const { data: applications, error: applicationsError } = await supabaseClient
    .from("applications")
    .select("id, student_id, status, applied_at, cv_path, cv_filename")
    .eq("listing_id", listingId);
  if (applicationsError) throw applicationsError;

  const studentIds = (applications || []).map((item) => item.student_id);
  if (studentIds.length === 0) return;

  const [studentsResult, skillsResult, requirementsResult] = await Promise.all([
    supabaseClient.from("students").select("*").in("id", studentIds),
    supabaseClient.from("student_skills").select("student_id, skill_name, skill_key, skill_level, level_number").in("student_id", studentIds),
    supabaseClient.from("listing_skills").select("listing_id, skill_id, requirement_type, minimum_level").eq("listing_id", listingId),
  ]);
  if (studentsResult.error) throw studentsResult.error;
  if (skillsResult.error) throw skillsResult.error;
  if (requirementsResult.error) throw requirementsResult.error;

  const profileIds = (studentsResult.data || []).map((student) => student.profile_id);
  const skillIds = (requirementsResult.data || []).map((row) => row.skill_id);
  const [profilesResult, catalogResult] = await Promise.all([
    supabaseClient.from("profiles").select("id, full_name, email").in("id", profileIds),
    skillIds.length
      ? supabaseClient.from("skills").select("id, name, skill_key").in("id", skillIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (catalogResult.error) throw catalogResult.error;

  const catalog = new Map((catalogResult.data || []).map((skill) => [skill.id, skill]));
  applicantReviewState.requirements = (requirementsResult.data || []).map((row) => ({
    ...row,
    skill_name: catalog.get(row.skill_id)?.name || "Required skill",
    skill_key: catalog.get(row.skill_id)?.skill_key || "",
  }));
  const students = new Map((studentsResult.data || []).map((student) => [student.id, student]));
  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));

  applicantReviewState.applicants = (applications || []).map((application) => {
    const student = students.get(application.student_id);
    const skills = (skillsResult.data || []).filter((skill) => skill.student_id === application.student_id);
    return {
      application,
      student,
      profile: profiles.get(student.profile_id),
      skills,
      score: calculateApplicantQualification(student, skills),
    };
  }).sort((first, second) => second.score - first.score);
}

function bindApplicantReviewEvents() {
  getApplicantElement("acceptApplicantButton").addEventListener("click", () => updateSelectedApplication("Accepted"));
  getApplicantElement("rejectApplicantButton").addEventListener("click", () => updateSelectedApplication("Rejected"));
  getApplicantElement("viewApplicantCvButton").addEventListener("click", viewSelectedApplicantCv);
  getApplicantElement("signOutLink").addEventListener("click", async (event) => {
    event.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "../index.html";
  });
}

async function setupApplicantReviewPage() {
  try {
    const account = await protectPage("company");
    if (!account) return;

    const listingId = new URLSearchParams(window.location.search).get("listing_id");
    if (!listingId) throw new Error("No internship listing was selected.");

    bindApplicantReviewEvents();
    await loadApplicantReviewData(listingId);

    const companyName = applicantReviewState.company.company_name || "Company";
    getApplicantElement("companyName").textContent = companyName;
    getApplicantElement("companyAvatar").textContent = companyName.charAt(0).toUpperCase();
    getApplicantElement("applicantPageTitle").textContent = `${applicantReviewState.listing.title} Applicants`;
    getApplicantElement("selectedListingTitle").textContent = applicantReviewState.listing.title;
    renderApplicantStats();
    renderApplicantList();
  } catch (error) {
    console.error(error);
    showApplicantMessage("applicantsPageMessage", error.message || "Applicants could not be loaded.", "error");
  }
}

document.addEventListener("DOMContentLoaded", setupApplicantReviewPage);
