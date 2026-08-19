const profileKey = "careermatchStudentProfile";
const savedInternshipsKey = "careermatchSavedInternships";

const internships = {
  google: {
    company: "Google",
    title: "Software Developer Intern",
    location: "Bangkok",
    duration: "3 months",
    allowance: "Paid",
    mode: "On-site",
    skills: "Python, SQL, Git",
    match: "85% match",
    detailsUrl: "google-details.html",
  },
  agoda: {
    company: "Agoda",
    title: "Frontend Developer Intern",
    location: "Bangkok",
    duration: "6 months",
    allowance: "Paid",
    mode: "Remote",
    skills: "React, JavaScript",
    match: "70% match",
    detailsUrl: "google-details.html",
  },
  microsoft: {
    company: "Microsoft",
    title: "Data Analyst Intern",
    location: "Bangkok",
    duration: "4 months",
    allowance: "Unpaid",
    mode: "Hybrid",
    skills: "Python, Excel",
    match: "65% match",
    detailsUrl: "google-details.html",
  },
};

const defaultProfile = {
  name: "Student",
  university: "",
  major: "Information Technology",
  year: "Final year",
  field: "Software Engineering",
  skills: [],
  skillKeys: [],
  skillLevels: {},
  goal: "",
  location: "Bangkok",
  internshipType: "Paid",
  workStyle: "Hybrid",
  mentorship: "Required",
  availability: [],
};

function hasSupabase() {
  return typeof supabaseClient !== "undefined";
}

function getSavedProfile() {
  const savedProfile = localStorage.getItem(profileKey);
  return savedProfile ? JSON.parse(savedProfile) : defaultProfile;
}

function saveProfile(profile) {
  localStorage.setItem(profileKey, JSON.stringify(profile));
}

function getSavedInternships() {
  const saved = localStorage.getItem(savedInternshipsKey);
  return saved ? JSON.parse(saved) : [];
}

function setSavedInternships(savedInternships) {
  localStorage.setItem(savedInternshipsKey, JSON.stringify(savedInternships));
}

function collectCheckedValues(form, name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function normalizeSkillKey(skillName) {
  return skillName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function formatSkillName(skillName) {
  return skillName
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getLevelNumber(level) {
  if (level === "Advanced") return 3;
  if (level === "Intermediate") return 2;
  return 1;
}

function getLevelClass(level) {
  return level ? level.toLowerCase() : "beginner";
}

function createSkillEntriesFromProfile(profile) {
  const skillLevels = profile.skillLevels || {};
  const skills = Array.isArray(profile.skills) ? profile.skills : [];

  return skills.map((skill) => ({
    name: skill,
    key: normalizeSkillKey(skill),
    level: skillLevels[skill] || "Beginner",
  }));
}

async function getCurrentUser() {
  if (!hasSupabase()) return null;

  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) return null;

  return data.session.user;
}

async function loadStudentProfileFromSupabase() {
  if (!hasSupabase()) return getSavedProfile();

  const user = await getCurrentUser();

  if (!user) return getSavedProfile();

  const { data: profileData } = await supabaseClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: studentData } = await supabaseClient
    .from("students")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!studentData) {
    return {
      ...defaultProfile,
      name: profileData?.full_name || defaultProfile.name,
    };
  }

  const { data: skillData, error: skillError } = await supabaseClient
    .from("student_skills")
    .select("skill_name, skill_key, skill_level")
    .eq("student_id", studentData.id)
    .order("created_at", { ascending: true });

  if (skillError) {
    console.error(skillError.message);
  }

  const skills = skillData || [];
  const skillLevels = {};

  skills.forEach((skill) => {
    skillLevels[skill.skill_name] = skill.skill_level;
  });

  const profile = {
    name: profileData?.full_name || defaultProfile.name,
    university: studentData.university || "",
    major: studentData.major || "",
    year: studentData.year_of_study || "",
    field: studentData.preferred_field || "",
    skills: skills.map((skill) => skill.skill_name),
    skillKeys: skills.map((skill) => skill.skill_key),
    skillLevels,
    goal: studentData.career_goal || "",
    location: studentData.preferred_location || "",
    internshipType: studentData.internship_type || "",
    workStyle: studentData.work_style || "",
    mentorship: studentData.mentorship || "",
    availability: studentData.availability || [],
  };

  saveProfile(profile);
  return profile;
}

async function saveStudentProfileToSupabase(profile) {
  if (!hasSupabase()) {
    saveProfile(profile);
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    saveProfile(profile);
    return;
  }

  const { error: profileError } = await supabaseClient
    .from("profiles")
    .update({
      full_name: profile.name,
    })
    .eq("id", user.id);

  if (profileError) throw profileError;

  const { data: studentData, error: studentError } = await supabaseClient
    .from("students")
    .upsert(
      {
        profile_id: user.id,
        university: profile.university,
        major: profile.major,
        year_of_study: profile.year,
        preferred_field: profile.field,
        preferred_location: profile.location,
        work_style: profile.workStyle,
        internship_type: profile.internshipType,
        mentorship: profile.mentorship,
        availability: profile.availability,
        career_goal: profile.goal,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "profile_id",
      }
    )
    .select()
    .single();

  if (studentError) throw studentError;

  const skillRows = createSkillEntriesFromProfile(profile).map((skill) => ({
    student_id: studentData.id,
    skill_name: skill.name,
    skill_key: skill.key,
    skill_level: skill.level,
    level_number: getLevelNumber(skill.level),
  }));

  const { error: deleteSkillError } = await supabaseClient
    .from("student_skills")
    .delete()
    .eq("student_id", studentData.id);

  if (deleteSkillError) throw deleteSkillError;

  if (skillRows.length) {
    const { error: skillError } = await supabaseClient.from("student_skills").insert(skillRows);

    if (skillError) throw skillError;
  }

  saveProfile(profile);
}

function renderSkillList(containerId, skillEntries) {
  const container = document.querySelector(containerId);

  if (!container) return;

  if (!skillEntries.length) {
    container.innerHTML = `<p class="muted-text">No skills added yet.</p>`;
    return;
  }

  container.innerHTML = skillEntries
    .map(
      (skill) => `
        <div class="skill-level-row ${getLevelClass(skill.level)}">
          <span>${skill.name}</span>
          <strong>${skill.level} · Level ${getLevelNumber(skill.level)}</strong>
          <button class="danger-btn compact-btn" type="button" data-remove-skill="${skill.key}">
            Remove
          </button>
        </div>
      `
    )
    .join("");
}

function renderProfileSkillLevels(profile) {
  document.querySelectorAll("[data-skill-level-list]").forEach((container) => {
    const skillEntries = createSkillEntriesFromProfile(profile);

    if (!skillEntries.length) {
      container.innerHTML = `<p class="muted-text">No skills added yet.</p>`;
      return;
    }

    container.innerHTML = skillEntries
      .map(
        (skill) => `
          <div class="skill-level-row ${getLevelClass(skill.level)}">
            <span>${skill.name}</span>
            <strong>${skill.level} · Level ${getLevelNumber(skill.level)}</strong>
          </div>
        `
      )
      .join("");
  });
}

function fillFormWithProfile(form, profile) {
  if (form.elements.name) form.elements.name.value = profile.name || "";
  if (form.elements.university) form.elements.university.value = profile.university || "";
  if (form.elements.major) form.elements.major.value = profile.major || "";
  if (form.elements.year) form.elements.year.value = profile.year || "";
  if (form.elements.goal) form.elements.goal.value = profile.goal || "";
  if (form.elements.location) form.elements.location.value = profile.location || "";
  if (form.elements.internshipType) form.elements.internshipType.value = profile.internshipType || "";
  if (form.elements.workStyle) form.elements.workStyle.value = profile.workStyle || "";
  if (form.elements.mentorship) form.elements.mentorship.value = profile.mentorship || "";

  form.querySelectorAll('input[name="field"]').forEach((input) => {
    input.checked = input.value === profile.field;
  });

  form.querySelectorAll('input[name="availability"]').forEach((input) => {
    input.checked = profile.availability?.includes(input.value);
  });
}

function buildProfileFromForm(form, skillEntries) {
  const formData = new FormData(form);
  const skillLevels = {};

  skillEntries.forEach((skill) => {
    skillLevels[skill.name] = skill.level;
  });

  return {
    name: formData.get("name"),
    university: formData.get("university"),
    major: formData.get("major"),
    year: formData.get("year"),
    field: formData.get("field"),
    skills: skillEntries.map((skill) => skill.name),
    skillKeys: skillEntries.map((skill) => skill.key),
    skillLevels,
    goal: formData.get("goal"),
    location: formData.get("location"),
    internshipType: formData.get("internshipType"),
    workStyle: formData.get("workStyle"),
    mentorship: formData.get("mentorship"),
    availability: collectCheckedValues(form, "availability"),
  };
}

function setupSkillBuilder({ skillNameInputId, skillLevelInputId, addButtonId, listId, skillEntries }) {
  const skillNameInput = document.querySelector(skillNameInputId);
  const skillLevelInput = document.querySelector(skillLevelInputId);
  const addSkillButton = document.querySelector(addButtonId);
  const skillList = document.querySelector(listId);

  let currentSkills = [...skillEntries];

  renderSkillList(listId, currentSkills);

  addSkillButton?.addEventListener("click", () => {
    const name = formatSkillName(skillNameInput.value);
    const key = normalizeSkillKey(name);
    const level = skillLevelInput.value;

    if (!key) return;

    const existingSkill = currentSkills.find((skill) => skill.key === key);

    if (existingSkill) {
      existingSkill.name = name;
      existingSkill.level = level;
    } else {
      currentSkills.push({ name, key, level });
    }

    skillNameInput.value = "";
    skillLevelInput.value = "Intermediate";
    renderSkillList(listId, currentSkills);
  });

  skillList?.addEventListener("click", (event) => {
    const skillKey = event.target.dataset.removeSkill;

    if (!skillKey) return;

    currentSkills = currentSkills.filter((skill) => skill.key !== skillKey);
    renderSkillList(listId, currentSkills);
  });

  return {
    getSkills() {
      return currentSkills;
    },
  };
}

function updateStudentSidebar(profile) {
  document.querySelectorAll(".user-card strong").forEach((element) => {
    element.textContent = profile.name || "Student";
  });

  document.querySelectorAll(".avatar").forEach((element) => {
    element.textContent = profile.name ? profile.name.charAt(0).toUpperCase() : "S";
  });
}

function updateProfileSummary(profile) {
  document.querySelectorAll("[data-profile-text]").forEach((element) => {
    const key = element.dataset.profileText;
    element.textContent = profile[key] || "-";
  });

  document.querySelectorAll("[data-profile-list]").forEach((element) => {
    const key = element.dataset.profileList;
    element.textContent =
      Array.isArray(profile[key]) && profile[key].length ? profile[key].join(", ") : "-";
  });
}

async function setupOnboardingForm() {
  const form = document.querySelector("#studentSetupForm");

  if (!form) return;

  const profile = await loadStudentProfileFromSupabase();

  fillFormWithProfile(form, profile);

  const skillBuilder = setupSkillBuilder({
    skillNameInputId: "#skillNameInput",
    skillLevelInputId: "#skillLevelInput",
    addButtonId: "#addSkillButton",
    listId: "#setupSkillList",
    skillEntries: createSkillEntriesFromProfile(profile),
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    submitButton.textContent = "Saving...";
    submitButton.disabled = true;

    try {
      const profile = buildProfileFromForm(form, skillBuilder.getSkills());

      await saveStudentProfileToSupabase(profile);

      window.location.href = "profile.html";
    } catch (error) {
      alert(error.message);
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });
}

async function setupStudentProfileForm() {
  const form = document.querySelector("#studentProfileForm");

  if (!form) return;

  const profile = await loadStudentProfileFromSupabase();

  updateStudentSidebar(profile);
  updateProfileSummary(profile);
  fillFormWithProfile(form, profile);

  const skillBuilder = setupSkillBuilder({
    skillNameInputId: "#profileSkillNameInput",
    skillLevelInputId: "#profileSkillLevelInput",
    addButtonId: "#profileAddSkillButton",
    listId: "#profileSkillList",
    skillEntries: createSkillEntriesFromProfile(profile),
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    submitButton.textContent = "Saving...";
    submitButton.disabled = true;

    try {
      const updatedProfile = buildProfileFromForm(form, skillBuilder.getSkills());

      await saveStudentProfileToSupabase(updatedProfile);

      updateStudentSidebar(updatedProfile);
      updateProfileSummary(updatedProfile);

      submitButton.textContent = "Saved";

      setTimeout(() => {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }, 1200);
    } catch (error) {
      alert(error.message);
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });
}

async function fillStudentDisplayData() {
  const profile = await loadStudentProfileFromSupabase();

  updateStudentSidebar(profile);
  updateProfileSummary(profile);
  renderProfileSkillLevels(profile);

  document.querySelectorAll("[data-profile]").forEach((input) => {
    const key = input.dataset.profile;
    input.value = profile[key] || "";
  });
}

function refreshHeartButtons() {
  const savedInternships = getSavedInternships();

  document.querySelectorAll("[data-save-internship]").forEach((button) => {
    const internshipId = button.dataset.saveInternship;
    const isSaved = savedInternships.includes(internshipId);

    button.classList.toggle("saved", isSaved);
    button.textContent = isSaved ? "♥" : "♡";
  });
}

function setupSaveButtons() {
  document.querySelectorAll("[data-save-internship]").forEach((button) => {
    button.addEventListener("click", () => {
      const internshipId = button.dataset.saveInternship;
      const savedInternships = getSavedInternships();

      const nextSavedInternships = savedInternships.includes(internshipId)
        ? savedInternships.filter((id) => id !== internshipId)
        : [...savedInternships, internshipId];

      setSavedInternships(nextSavedInternships);
      refreshHeartButtons();
      renderSavedInternships();
    });
  });
}

function createSavedInternshipCard(internshipId) {
  const internship = internships[internshipId];

  if (!internship) return "";

  return `
    <article class="intern-card">
      <button class="heart-btn saved" type="button" data-save-internship="${internshipId}">
        ♥
      </button>

      <div class="company-image">${internship.company}</div>

      <div class="intern-body">
        <h3>${internship.company} (${internship.title})</h3>

        <ul class="detail-list">
          <li><span>Location</span><strong>${internship.location}</strong></li>
          <li><span>Duration</span><strong>${internship.duration}</strong></li>
          <li><span>Allowance</span><strong>${internship.allowance}</strong></li>
          <li><span>Mode</span><strong>${internship.mode}</strong></li>
          <li><span>Skills</span><strong>${internship.skills}</strong></li>
        </ul>

        <div class="card-actions">
          <a class="primary-btn" href="${internship.detailsUrl}">See Details</a>
          <span class="match-pill">${internship.match}</span>
        </div>
      </div>
    </article>
  `;
}

function renderSavedInternships() {
  const savedContainer = document.querySelector("#savedInternships");

  if (!savedContainer) return;

  const savedInternships = getSavedInternships();

  savedContainer.innerHTML = savedInternships.length
    ? savedInternships.map(createSavedInternshipCard).join("")
    : `
      <article class="panel empty-saved">
        <h2>No saved internships yet</h2>
        <p>Go to Recommended and click the heart on internships you want to keep.</p>
      </article>
    `;

  setupSaveButtons();
  refreshHeartButtons();
}

setupOnboardingForm();
setupStudentProfileForm();
fillStudentDisplayData();
setupSaveButtons();
refreshHeartButtons();
renderSavedInternships();