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
  major: "",
  year: "",
  field: "",
  skills: [],
  skillKeys: [],
  skillLevels: {},
  goal: "",
  location: "",
  internshipType: "",
  workStyle: "",
  mentorship: "",
  availability: [],
};

function hasSupabase() {
  return typeof supabaseClient !== "undefined";
}

function getSavedProfile() {
  const savedProfile = localStorage.getItem(profileKey);

  if (!savedProfile) {
    return { ...defaultProfile };
  }

  try {
    return JSON.parse(savedProfile);
  } catch (error) {
    console.error("Could not read the saved profile:", error);
    return { ...defaultProfile };
  }
}

function saveProfileLocally(profile) {
  localStorage.setItem(profileKey, JSON.stringify(profile));
}

function getSavedInternships() {
  const saved = localStorage.getItem(savedInternshipsKey);

  if (!saved) return [];

  try {
    return JSON.parse(saved);
  } catch (error) {
    return [];
  }
}

function setSavedInternships(savedInternships) {
  localStorage.setItem(
    savedInternshipsKey,
    JSON.stringify(savedInternships)
  );
}

function collectCheckedValues(form, name) {
  return [
    ...form.querySelectorAll(
      `input[name="${name}"]:checked`
    ),
  ].map((input) => input.value);
}

function normalizeSkillKey(skillName) {
  return skillName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
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
  const skills = Array.isArray(profile.skills)
    ? profile.skills
    : [];

  const skillLevels = profile.skillLevels || {};

  return skills.map((skill) => ({
    name: skill,
    key: normalizeSkillKey(skill),
    level: skillLevels[skill] || "Beginner",
  }));
}

async function getCurrentUser() {
  if (!hasSupabase()) return null;

  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error.message);
    return null;
  }

  return data.session?.user || null;
}

async function loadStudentProfileFromSupabase() {
  if (!hasSupabase()) {
    return getSavedProfile();
  }

  const user = await getCurrentUser();

  if (!user) {
    return getSavedProfile();
  }

  const {
    data: profileData,
    error: profileError,
  } = await supabaseClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "Could not load account profile:",
      profileError.message
    );
  }

  const {
    data: studentData,
    error: studentError,
  } = await supabaseClient
    .from("students")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (studentError) {
    console.error(
      "Could not load student profile:",
      studentError.message
    );

    return getSavedProfile();
  }

  if (!studentData) {
    return {
      ...defaultProfile,
      name:
        profileData?.full_name ||
        defaultProfile.name,
    };
  }

  const {
    data: skillData,
    error: skillError,
  } = await supabaseClient
    .from("student_skills")
    .select(
      "skill_name, skill_key, skill_level, level_number"
    )
    .eq("student_id", studentData.id)
    .order("created_at", { ascending: true });

  if (skillError) {
    console.error(
      "Could not load student skills:",
      skillError.message
    );
  }

  const skills = skillData || [];
  const skillLevels = {};

  skills.forEach((skill) => {
    skillLevels[skill.skill_name] =
      skill.skill_level || "Beginner";
  });

  const profile = {
    name:
      profileData?.full_name ||
      defaultProfile.name,

    university:
      studentData.university || "",

    major:
      studentData.major || "",

    year:
      studentData.year_of_study || "",

    field:
      studentData.preferred_field || "",

    skills:
      skills.map((skill) => skill.skill_name),

    skillKeys:
      skills.map((skill) => skill.skill_key),

    skillLevels,

    goal:
      studentData.career_goal || "",

    location:
      studentData.preferred_location || "",

    internshipType:
      studentData.internship_type || "",

    workStyle:
      studentData.work_style || "",

    mentorship:
      studentData.mentorship || "",

    availability:
      Array.isArray(studentData.availability)
        ? studentData.availability
        : [],
  };

  saveProfileLocally(profile);

  return profile;
}

async function saveStudentProfileToSupabase(profile) {
  saveProfileLocally(profile);

  if (!hasSupabase()) {
    return profile;
  }

  const user = await getCurrentUser();

  if (!user) {
    throw new Error(
      "Your login session has expired. Please sign in again."
    );
  }

  const { error: profileError } =
    await supabaseClient
      .from("profiles")
      .update({
        full_name: profile.name,
      })
      .eq("id", user.id);

  if (profileError) {
    throw profileError;
  }

  const {
    data: studentData,
    error: studentError,
  } = await supabaseClient
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
    .select("*")
    .single();

  if (studentError) {
    throw studentError;
  }

  const skillEntries =
    createSkillEntriesFromProfile(profile);

  const skillRows = skillEntries.map((skill) => ({
    student_id: studentData.id,
    skill_name: skill.name,
    skill_key: skill.key,
    skill_level: skill.level,
    level_number: getLevelNumber(skill.level),
  }));

  const { error: deleteError } =
    await supabaseClient
      .from("student_skills")
      .delete()
      .eq("student_id", studentData.id);

  if (deleteError) {
    throw deleteError;
  }

  if (skillRows.length > 0) {
    const { error: insertError } =
      await supabaseClient
        .from("student_skills")
        .insert(skillRows);

    if (insertError) {
      throw insertError;
    }
  }

  const savedProfile =
    await loadStudentProfileFromSupabase();

  saveProfileLocally(savedProfile);

  return savedProfile;
}

function renderSkillList(containerSelector, skills) {
  const container =
    document.querySelector(containerSelector);

  if (!container) return;

  if (!skills.length) {
    container.innerHTML = `
      <p class="muted-text">
        No skills added yet.
      </p>
    `;

    return;
  }

  container.innerHTML = skills
    .map(
      (skill) => `
        <div class="skill-level-row ${getLevelClass(
          skill.level
        )}">
          <span>${skill.name}</span>

          <strong>
            ${skill.level} · Level
            ${getLevelNumber(skill.level)}
          </strong>

          <button
            class="danger-btn compact-btn"
            type="button"
            data-remove-skill="${skill.key}"
          >
            Remove
          </button>
        </div>
      `
    )
    .join("");
}

let skillCatalogCache = null;

async function loadSkillCatalog() {
  if (skillCatalogCache) {
    return skillCatalogCache;
  }

  const { data, error } = await supabaseClient
    .from("skills")
    .select("id, name, skill_key, fields")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Could not load skills:", error);
    throw error;
  }

  skillCatalogCache = data || [];
  return skillCatalogCache;
}

function addSkillsToOptionGroup(group, skills) {
  skills.forEach((skill) => {
    const option = document.createElement("option");

    option.value = skill.name;
    option.textContent = skill.name;
    option.dataset.skillKey = skill.skill_key;
    option.dataset.skillId = skill.id;

    group.appendChild(option);
  });
}

async function populateSkillDropdown(
  skillInput,
  selectedField
) {
  if (!skillInput) return;

  skillInput.disabled = true;
  skillInput.placeholder = "Loading skills...";

  try {
    const skills = await loadSkillCatalog();

    const recommendedSkills = skills.filter(
      (skill) =>
        Array.isArray(skill.fields) &&
        skill.fields.includes(selectedField)
    );

    const recommendedIds = new Set(
      recommendedSkills.map((skill) => skill.id)
    );

    const otherSkills = skills.filter(
      (skill) => !recommendedIds.has(skill.id)
    );

    if (skillInput.tagName === "INPUT") {
      const dataListId = skillInput.getAttribute("list");
      const dataList = dataListId
        ? document.getElementById(dataListId)
        : null;

      if (!dataList) {
        throw new Error("Skill suggestions list was not found.");
      }

      const orderedSkills = [
        ...recommendedSkills,
        ...otherSkills,
      ];

      dataList.innerHTML = "";

      orderedSkills.forEach((skill) => {
        const option = document.createElement("option");
        option.value = skill.name;
        dataList.appendChild(option);
      });

      skillInput.value = "";
      skillInput.placeholder = "Search skills, for example Python";
      skillInput.disabled = false;
      return;
    }

    skillInput.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a skill";
    placeholder.selected = true;
    skillInput.appendChild(placeholder);

    if (recommendedSkills.length) {
      const recommendedGroup = document.createElement("optgroup");
      recommendedGroup.label = `Recommended for ${selectedField}`;
      addSkillsToOptionGroup(recommendedGroup, recommendedSkills);
      skillInput.appendChild(recommendedGroup);
    }

    if (otherSkills.length) {
      const otherGroup = document.createElement("optgroup");
      otherGroup.label = "Other technical skills";
      addSkillsToOptionGroup(otherGroup, otherSkills);
      skillInput.appendChild(otherGroup);
    }

    skillInput.disabled = false;
  } catch (error) {
    skillInput.placeholder = "Could not load skills";
    console.error(error);
  }
}

function setupSkillBuilder({
  skillNameInputId,
  skillLevelInputId,
  addButtonId,
  listId,
  skillEntries,
}) {
  const skillNameInput =
    document.querySelector(skillNameInputId);

  const skillLevelInput =
    document.querySelector(skillLevelInputId);

  const addSkillButton =
    document.querySelector(addButtonId);

  const skillList =
    document.querySelector(listId);

  let currentSkills = [...skillEntries];

  renderSkillList(listId, currentSkills);

  addSkillButton?.addEventListener(
    "click",
    () => {
      const enteredName = formatSkillName(
        skillNameInput.value
      );

      const enteredKey = normalizeSkillKey(enteredName);
      const level = skillLevelInput.value;

      if (!enteredKey) {
        alert("Choose a skill first.");
        return;
      }

      const catalogSkill = skillCatalogCache?.find(
        (skill) =>
          normalizeSkillKey(skill.name) === enteredKey
      );

      if (!catalogSkill) {
        alert("Please choose a skill from the suggestion list.");
        return;
      }

      const name = catalogSkill.name;
      const key = catalogSkill.skill_key;

      const existingSkill =
        currentSkills.find(
          (skill) =>
            skill.key === key ||
            normalizeSkillKey(skill.name) ===
              normalizeSkillKey(name)
        );

      if (existingSkill) {
        existingSkill.name = name;
        existingSkill.level = level;
      } else {
        currentSkills.push({
          name,
          key,
          level,
        });
      }

      skillNameInput.value = "";
      skillLevelInput.value = "Intermediate";

      renderSkillList(
        listId,
        currentSkills
      );
    }
  );

  skillList?.addEventListener(
    "click",
    (event) => {
      const removeButton =
        event.target.closest(
          "[data-remove-skill]"
        );

      if (!removeButton) return;

      const skillKey =
        removeButton.dataset.removeSkill;

      currentSkills =
        currentSkills.filter(
          (skill) => skill.key !== skillKey
        );

      renderSkillList(
        listId,
        currentSkills
      );
    }
  );

  return {
    getSkills() {
      return [...currentSkills];
    },
  };
}

function fillFormWithProfile(form, profile) {
  if (form.elements.name) {
    form.elements.name.value =
      profile.name || "";
  }

  if (form.elements.university) {
    form.elements.university.value =
      profile.university || "";
  }

  if (form.elements.major) {
    form.elements.major.value =
      profile.major || "";
  }

  if (form.elements.year) {
    form.elements.year.value =
      profile.year || "";
  }

  if (form.elements.goal) {
    form.elements.goal.value =
      profile.goal || "";
  }

  if (form.elements.location) {
    form.elements.location.value =
      profile.location || "";
  }

  if (form.elements.internshipType) {
    form.elements.internshipType.value =
      profile.internshipType || "";
  }

  if (form.elements.workStyle) {
    form.elements.workStyle.value =
      profile.workStyle || "";
  }

  if (form.elements.mentorship) {
    form.elements.mentorship.value =
      profile.mentorship || "";
  }

  form
    .querySelectorAll('input[name="field"]')
    .forEach((input) => {
      input.checked =
        input.value === profile.field;
    });

  form
    .querySelectorAll(
      'input[name="availability"]'
    )
    .forEach((input) => {
      input.checked =
        profile.availability.includes(
          input.value
        );
    });
}

function buildProfileFromForm(
  form,
  skillEntries
) {
  const formData = new FormData(form);
  const skillLevels = {};

  skillEntries.forEach((skill) => {
    skillLevels[skill.name] =
      skill.level;
  });

  return {
    name:
      formData.get("name")?.trim() || "",

    university:
      formData.get("university")?.trim() ||
      "",

    major:
      formData.get("major") || "",

    year:
      formData.get("year") || "",

    field:
      formData.get("field") || "",

    skills:
      skillEntries.map(
        (skill) => skill.name
      ),

    skillKeys:
      skillEntries.map(
        (skill) => skill.key
      ),

    skillLevels,

    goal:
      formData.get("goal")?.trim() || "",

    location:
      formData.get("location") || "",

    internshipType:
      formData.get("internshipType") || "",

    workStyle:
      formData.get("workStyle") || "",

    mentorship:
      formData.get("mentorship") || "",

    availability:
      collectCheckedValues(
        form,
        "availability"
      ),
  };
}

function updateStudentSidebar(profile) {
  document
    .querySelectorAll(
      ".user-card strong"
    )
    .forEach((element) => {
      element.textContent =
        profile.name || "Student";
    });

  document
    .querySelectorAll(".avatar")
    .forEach((element) => {
      element.textContent =
        profile.name
          ? profile.name
              .charAt(0)
              .toUpperCase()
          : "S";
    });
}

function updateProfileSummary(profile) {
  document
    .querySelectorAll(
      "[data-profile-text]"
    )
    .forEach((element) => {
      const key =
        element.dataset.profileText;

      element.textContent =
        profile[key] || "-";
    });

  document
    .querySelectorAll(
      "[data-profile-list]"
    )
    .forEach((element) => {
      const key =
        element.dataset.profileList;

      const values = profile[key];

      element.textContent =
        Array.isArray(values) &&
        values.length
          ? values.join(", ")
          : "-";
    });
}

function renderProfileSkillLevels(profile) {
  document
    .querySelectorAll(
      "[data-skill-level-list]"
    )
    .forEach((container) => {
      const skillEntries =
        createSkillEntriesFromProfile(
          profile
        );

      if (!skillEntries.length) {
        container.innerHTML = `
          <p class="muted-text">
            No skills added yet.
          </p>
        `;

        return;
      }

      container.innerHTML =
        skillEntries
          .map(
            (skill) => `
              <div
                class="skill-level-row ${getLevelClass(
                  skill.level
                )}"
              >
                <span>${skill.name}</span>

                <strong>
                  ${skill.level} · Level
                  ${getLevelNumber(
                    skill.level
                  )}
                </strong>
              </div>
            `
          )
          .join("");
    });
}

function calculateProfileCompletion(profile) {
  const checks = [
    Boolean(profile.name),
    Boolean(profile.university),
    Boolean(profile.major),
    Boolean(profile.year),
    Boolean(profile.field),
    Boolean(profile.goal),
    Boolean(profile.location),
    Boolean(profile.internshipType),
    Boolean(profile.workStyle),
    Boolean(profile.mentorship),

    Array.isArray(profile.skills) &&
      profile.skills.length > 0,

    Array.isArray(
      profile.availability
    ) &&
      profile.availability.length > 0,
  ];

  const completed =
    checks.filter(Boolean).length;

  return Math.round(
    (completed / checks.length) * 100
  );
}

function updateProgressRings(completion) {
  document
    .querySelectorAll(
      ".progress-ring"
    )
    .forEach((ring) => {
      ring.style.background = `
        conic-gradient(
          var(--purple) ${completion}%,
          var(--purple-soft) 0
        )
      `;
    });
}

async function setupStudentDashboard() {
  const dashboard =
    document.querySelector(
      "[data-student-dashboard]"
    );

  if (!dashboard) return;

  const profile =
    await loadStudentProfileFromSupabase();

  const completion =
    calculateProfileCompletion(profile);

  const skillCount =
    Array.isArray(profile.skills)
      ? profile.skills.length
      : 0;

  const availableDays =
    Array.isArray(profile.availability)
      ? profile.availability.length
      : 0;

  updateStudentSidebar(profile);

  document
    .querySelectorAll(
      '[data-dashboard-stat="completion"]'
    )
    .forEach((element) => {
      element.textContent =
        `${completion}%`;
    });

  document
    .querySelectorAll(
      '[data-dashboard-stat="skills"]'
    )
    .forEach((element) => {
      element.textContent =
        skillCount;
    });

  document
    .querySelectorAll(
      '[data-dashboard-stat="availableDays"]'
    )
    .forEach((element) => {
      element.textContent =
        availableDays;
    });

  document
    .querySelectorAll(
      '[data-dashboard-stat="field"]'
    )
    .forEach((element) => {
      element.textContent =
        profile.field || "-";
    });

  updateProgressRings(completion);

  const message =
    document.querySelector(
      "[data-dashboard-message]"
    );

  if (!message) return;

  if (completion === 100) {
    message.textContent =
      "Your profile is complete and ready for internship matching.";
  } else if (completion >= 75) {
    message.textContent =
      "Your profile is nearly complete. Review any missing information.";
  } else {
    message.textContent =
      "Complete your profile to improve your internship recommendations.";
  }
}

async function setupOnboardingForm() {
  const form =
    document.querySelector(
      "#studentSetupForm"
    );

  if (!form) return;

  const profile =
    await loadStudentProfileFromSupabase();

  fillFormWithProfile(form, profile);

  const skillSelect =
    document.querySelector(
      "#skillNameInput"
    );

  await populateSkillDropdown(
    skillSelect,
    profile.field
  );

  form
    .querySelectorAll(
      'input[name="field"]'
    )
    .forEach((fieldInput) => {
      fieldInput.addEventListener(
        "change",
        async () => {
          await populateSkillDropdown(
            skillSelect,
            fieldInput.value
          );
        }
      );
    });

  const skillBuilder =
    setupSkillBuilder({
      skillNameInputId:
        "#skillNameInput",

      skillLevelInputId:
        "#skillLevelInput",

      addButtonId:
        "#addSkillButton",

      listId:
        "#setupSkillList",

      skillEntries:
        createSkillEntriesFromProfile(
          profile
        ),
    });

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const submitButton =
        form.querySelector(
          'button[type="submit"]'
        );

      const originalText =
        submitButton.textContent;

      submitButton.textContent =
        "Saving...";

      submitButton.disabled = true;

      try {
        const updatedProfile =
          buildProfileFromForm(
            form,
            skillBuilder.getSkills()
          );

        await saveStudentProfileToSupabase(
          updatedProfile
        );

        window.location.href =
          "dashboard.html";
      } catch (error) {
        console.error(error);

        alert(
          `Could not save profile: ${error.message}`
        );

        submitButton.textContent =
          originalText;

        submitButton.disabled = false;
      }
    }
  );
}

async function setupStudentProfileForm() {
  const form =
    document.querySelector(
      "#studentProfileForm"
    );

  if (!form) return;

  const profile =
    await loadStudentProfileFromSupabase();

  updateStudentSidebar(profile);
  updateProfileSummary(profile);
  fillFormWithProfile(form, profile);

  const skillSelect =
    document.querySelector(
      "#profileSkillNameInput"
    );

  await populateSkillDropdown(
    skillSelect,
    profile.field
  );

  form
    .querySelectorAll(
      'input[name="field"]'
    )
    .forEach((fieldInput) => {
      fieldInput.addEventListener(
        "change",
        async () => {
          await populateSkillDropdown(
            skillSelect,
            fieldInput.value
          );
        }
      );
    });

  const skillBuilder =
    setupSkillBuilder({
      skillNameInputId:
        "#profileSkillNameInput",

      skillLevelInputId:
        "#profileSkillLevelInput",

      addButtonId:
        "#profileAddSkillButton",

      listId:
        "#profileSkillList",

      skillEntries:
        createSkillEntriesFromProfile(
          profile
        ),
    });

  const completion =
    calculateProfileCompletion(profile);

  document
    .querySelectorAll(
      ".progress-ring span"
    )
    .forEach((element) => {
      element.textContent =
        `${completion}%`;
    });

  updateProgressRings(completion);

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const submitButton =
        form.querySelector(
          'button[type="submit"]'
        );

      const originalText =
        submitButton.textContent;

      submitButton.textContent =
        "Saving...";

      submitButton.disabled = true;

      try {
        const updatedProfile =
          buildProfileFromForm(
            form,
            skillBuilder.getSkills()
          );

        const savedProfile =
          await saveStudentProfileToSupabase(
            updatedProfile
          );

        updateStudentSidebar(
          savedProfile
        );

        updateProfileSummary(
          savedProfile
        );

        const nextCompletion =
          calculateProfileCompletion(
            savedProfile
          );

        document
          .querySelectorAll(
            ".progress-ring span"
          )
          .forEach((element) => {
            element.textContent =
              `${nextCompletion}%`;
          });

        updateProgressRings(
          nextCompletion
        );

        submitButton.textContent =
          "Saved";

        setTimeout(() => {
          submitButton.textContent =
            originalText;

          submitButton.disabled = false;
        }, 1500);
      } catch (error) {
        console.error(error);

        alert(
          `Could not save profile: ${error.message}`
        );

        submitButton.textContent =
          originalText;

        submitButton.disabled = false;
      }
    }
  );
}

async function fillStudentDisplayData() {
  const hasStudentDisplay =
    document.querySelector(
      "[data-profile-text], [data-profile-list], [data-skill-level-list], .user-card"
    );

  if (!hasStudentDisplay) return;

  const profile =
    await loadStudentProfileFromSupabase();

  updateStudentSidebar(profile);
  updateProfileSummary(profile);
  renderProfileSkillLevels(profile);
}

function refreshHeartButtons() {
  const savedInternships =
    getSavedInternships();

  document
    .querySelectorAll(
      "[data-save-internship]"
    )
    .forEach((button) => {
      const internshipId =
        button.dataset.saveInternship;

      const isSaved =
        savedInternships.includes(
          internshipId
        );

      button.classList.toggle(
        "saved",
        isSaved
      );

      if (button.id === "saveInternshipButton") {
        button.textContent = isSaved
          ? "♥ Saved"
          : "♡ Save Internship";
      } else {
        button.textContent =
          isSaved ? "♥" : "♡";
      }
    });
}

function setupSaveButtons() {
  document
    .querySelectorAll(
      "[data-save-internship]"
    )
    .forEach((button) => {
      if (
        button.dataset.listenerAdded ===
        "true"
      ) {
        return;
      }

      button.dataset.listenerAdded =
        "true";

      button.addEventListener(
        "click",
        () => {
          const internshipId =
            button.dataset.saveInternship;

          const savedInternships =
            getSavedInternships();

          const nextSaved =
            savedInternships.includes(
              internshipId
            )
              ? savedInternships.filter(
                  (id) =>
                    id !== internshipId
                )
              : [
                  ...savedInternships,
                  internshipId,
                ];

          setSavedInternships(
            nextSaved
          );

          refreshHeartButtons();
          renderSavedInternships();
        }
      );
    });
}

function createSavedInternshipCard(
  internshipId
) {
  const internship =
    internships[internshipId];

  if (!internship) return "";

  return `
    <article class="intern-card">
      <button
        class="heart-btn saved"
        type="button"
        data-save-internship="${internshipId}"
      >
        ♥
      </button>

      <div class="company-image">
        ${internship.company}
      </div>

      <div class="intern-body">
        <h3>
          ${internship.company}
          (${internship.title})
        </h3>

        <ul class="detail-list">
          <li>
            <span>Location</span>
            <strong>
              ${internship.location}
            </strong>
          </li>

          <li>
            <span>Duration</span>
            <strong>
              ${internship.duration}
            </strong>
          </li>

          <li>
            <span>Allowance</span>
            <strong>
              ${internship.allowance}
            </strong>
          </li>

          <li>
            <span>Mode</span>
            <strong>
              ${internship.mode}
            </strong>
          </li>

          <li>
            <span>Skills</span>
            <strong>
              ${internship.skills}
            </strong>
          </li>
        </ul>

        <div class="card-actions">
          <a
            class="primary-btn"
            href="${internship.detailsUrl}"
          >
            See Details
          </a>

          <span class="match-pill">
            ${internship.match}
          </span>
        </div>
      </div>
    </article>
  `;
}

function renderSavedInternships() {
  const container =
    document.querySelector(
      "#savedInternships"
    );

  if (!container) return;

  const savedInternships =
    getSavedInternships();

  if (!savedInternships.length) {
    container.innerHTML = `
      <article class="panel empty-saved">
        <h2>
          No saved internships yet
        </h2>

        <p>
          Go to Recommended and click
          the heart on internships you
          want to keep.
        </p>
      </article>
    `;

    return;
  }

  container.innerHTML =
    savedInternships
      .map(
        createSavedInternshipCard
      )
      .join("");

  setupSaveButtons();
  refreshHeartButtons();
}

function setupSignOut() {
  document
    .querySelectorAll(
      '.sidebar-bottom a[href="../index.html"]'
    )
    .forEach((link) => {
      link.addEventListener(
        "click",
        async (event) => {
          event.preventDefault();

          if (hasSupabase()) {
            await supabaseClient.auth.signOut();
          }

          localStorage.removeItem(
            profileKey
          );

          window.location.href =
            "../index.html";
        }
      );
    });
}

async function startCareerMatch() {
  setupSignOut();
  setupSaveButtons();
  refreshHeartButtons();
  renderSavedInternships();

  await setupOnboardingForm();
  await setupStudentProfileForm();
  await setupStudentDashboard();

  const isProfileForm =
    document.querySelector(
      "#studentProfileForm"
    );

  const isOnboardingForm =
    document.querySelector(
      "#studentSetupForm"
    );

  const isDashboard =
    document.querySelector(
      "[data-student-dashboard]"
    );

  if (
    !isProfileForm &&
    !isOnboardingForm &&
    !isDashboard
  ) {
    await fillStudentDisplayData();
  }
}

startCareerMatch().catch((error) => {
  console.error(
    "CareerMatch startup error:",
    error
  );
});
