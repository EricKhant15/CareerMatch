const listingState = {
    company: null,
    skillCatalog: [],
    requiredSkills: [],
    niceSkills: [],
  };
  
  const SKILL_LEVELS = {
    1: {
      label: "Beginner",
      className: "beginner",
    },
    2: {
      label: "Intermediate",
      className: "intermediate",
    },
    3: {
      label: "Advanced",
      className: "advanced",
    },
  };
  
  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
  
  function normalizeSkillKey(value) {
    return normalizeText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  
  function getElement(id) {
    return document.getElementById(id);
  }
  
  function showListingMessage(message, type = "info") {
    const messageElement = getElement("listingMessage");
  
    if (!messageElement) {
      return;
    }
  
    const colors = {
      error: "#d92d3e",
      success: "#169c4b",
      info: "#7224e8",
    };
  
    messageElement.textContent = message;
    messageElement.style.color = colors[type] || colors.info;
  }
  
  function formatPreviewDate(value) {
    if (!value) {
      return "Not set";
    }
  
    const parts = value.split("-");
  
    if (parts.length !== 3) {
      return value;
    }
  
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
  
  function skillMatchesField(skill, targetField) {
    const selectedField = normalizeText(targetField);
  
    if (!selectedField) {
      return false;
    }
  
    const fields = Array.isArray(skill.fields)
      ? skill.fields
      : [];
  
    return fields.some(
      (field) => normalizeText(field) === selectedField
    );
  }
  
  function getOrderedSkillCatalog(targetField) {
    return [...listingState.skillCatalog].sort((first, second) => {
      const firstMatches = skillMatchesField(first, targetField);
      const secondMatches = skillMatchesField(second, targetField);
  
      if (firstMatches !== secondMatches) {
        return firstMatches ? -1 : 1;
      }
  
      return first.name.localeCompare(second.name);
    });
  }
  
  function populateSkillDatalist(datalistId) {
    const datalist = getElement(datalistId);
    const targetField = getElement("targetField")?.value || "";
  
    if (!datalist) {
      return;
    }
  
    datalist.replaceChildren();
  
    const fragment = document.createDocumentFragment();
  
    getOrderedSkillCatalog(targetField).forEach((skill) => {
      const option = document.createElement("option");
      option.value = skill.name;
  
      if (skillMatchesField(skill, targetField)) {
        option.label = `Recommended for ${targetField}`;
      }
  
      fragment.appendChild(option);
    });
  
    datalist.appendChild(fragment);
  }
  
  function populateBothSkillDatalists() {
    populateSkillDatalist("requiredSkillOptions");
    populateSkillDatalist("niceSkillOptions");
  }
  
  function findCatalogSkill(inputValue) {
    const normalizedValue = normalizeText(inputValue);
    const skillKey = normalizeSkillKey(inputValue);
  
    return listingState.skillCatalog.find((skill) => {
      return (
        normalizeText(skill.name) === normalizedValue ||
        normalizeSkillKey(skill.skill_key) === skillKey
      );
    });
  }
  
  function skillAlreadySelected(skillId) {
    return (
      listingState.requiredSkills.some(
        (entry) => entry.skill.id === skillId
      ) ||
      listingState.niceSkills.some(
        (entry) => entry.skill.id === skillId
      )
    );
  }
  
  function addSelectedSkill(type) {
    const isRequired = type === "required";
  
    const input = getElement(
      isRequired ? "requiredSkillInput" : "niceSkillInput"
    );
  
    const levelInput = getElement(
      isRequired ? "requiredSkillLevel" : "niceSkillLevel"
    );
  
    if (!input || !levelInput) {
      return;
    }
  
    input.setCustomValidity("");
  
    const skill = findCatalogSkill(input.value);
  
    if (!skill) {
      input.setCustomValidity(
        "Please select a skill from the suggestion list."
      );
      input.reportValidity();
      return;
    }
  
    if (skillAlreadySelected(skill.id)) {
      input.setCustomValidity(
        "This skill has already been added."
      );
      input.reportValidity();
      return;
    }
  
    const entry = {
      skill,
      level: Number(levelInput.value),
    };
  
    if (isRequired) {
      listingState.requiredSkills.push(entry);
    } else {
      listingState.niceSkills.push(entry);
    }
  
    input.value = "";
    renderSkillLists();
    updateListingPreview();
  }
  
  function createSkillRow(entry, type, index) {
    const level = SKILL_LEVELS[entry.level] || SKILL_LEVELS[1];
  
    const row = document.createElement("div");
    row.className = `skill-level-row ${level.className}`;
  
    const skillName = document.createElement("span");
    skillName.textContent = entry.skill.name;
  
    const levelLabel = document.createElement("strong");
    levelLabel.textContent =
      `${level.label} - Level ${entry.level}`;
  
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary-btn compact-btn";
    removeButton.textContent = "Remove";
  
    removeButton.addEventListener("click", () => {
      if (type === "required") {
        listingState.requiredSkills.splice(index, 1);
      } else {
        listingState.niceSkills.splice(index, 1);
      }
  
      renderSkillLists();
      updateListingPreview();
    });
  
    row.append(skillName, levelLabel, removeButton);
  
    return row;
  }
  
  function renderSkillList(elementId, entries, type) {
    const list = getElement(elementId);
  
    if (!list) {
      return;
    }
  
    list.replaceChildren();
  
    if (entries.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent =
        type === "required"
          ? "No required skills added yet."
          : "No optional skills added yet.";
  
      list.appendChild(emptyMessage);
      return;
    }
  
    entries.forEach((entry, index) => {
      list.appendChild(
        createSkillRow(entry, type, index)
      );
    });
  }
  
  function renderSkillLists() {
    renderSkillList(
      "requiredSkillList",
      listingState.requiredSkills,
      "required"
    );
  
    renderSkillList(
      "niceSkillList",
      listingState.niceSkills,
      "nice"
    );
  }
  
  function updatePreviewSkills() {
    const previewSkills = getElement("previewSkills");
  
    if (!previewSkills) {
      return;
    }
  
    previewSkills.replaceChildren();
  
    const visibleSkills = [
      ...listingState.requiredSkills,
      ...listingState.niceSkills,
    ].slice(0, 5);
  
    if (visibleSkills.length === 0) {
      const placeholder = document.createElement("span");
      placeholder.className = "tag";
      placeholder.textContent = "Skills not selected";
      previewSkills.appendChild(placeholder);
      return;
    }
  
    visibleSkills.forEach((entry) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = entry.skill.name;
      previewSkills.appendChild(tag);
    });
  }
  
  function updateListingPreview() {
    const title =
      getElement("listingTitle")?.value.trim() ||
      "Internship position";
  
    const location =
      getElement("listingLocation")?.value.trim() ||
      "Location";
  
    const workMode =
      getElement("listingWorkMode")?.value ||
      "Work mode";
  
    const duration =
      getElement("listingDuration")?.value ||
      "Duration";
  
    getElement("previewTitle").textContent = title;
    getElement("previewIcon").textContent =
      createPositionCode(title);
  
    getElement("previewMeta").textContent =
      `${location} - ${workMode} - ${duration}`;
  
    getElement("previewField").textContent =
      getElement("targetField")?.value || "Not selected";
  
    getElement("previewMentorship").textContent =
      getElement("listingMentorship")?.value ||
      "Not selected";
  
    getElement("previewOpenings").textContent =
      getElement("listingOpenings")?.value || "1";
  
    getElement("previewDeadline").textContent =
      formatPreviewDate(
        getElement("applicationDeadline")?.value
      );
  
    updatePreviewSkills();
  }
  
  async function loadCompanyProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
  
    if (userError || !user) {
      throw userError || new Error("No signed-in user found.");
    }
  
    const { data: company, error: companyError } =
      await supabaseClient
        .from("companies")
        .select("id, company_name, location")
        .eq("profile_id", user.id)
        .single();
  
    if (companyError) {
      throw companyError;
    }
  
    listingState.company = company;
  
    const companyName =
      company.company_name || "Company";
  
    getElement("companyName").textContent = companyName;
    getElement("companyAvatar").textContent =
      companyName.charAt(0).toUpperCase();
  
    const locationInput = getElement("listingLocation");
  
    if (
      locationInput &&
      !locationInput.value &&
      company.location
    ) {
      locationInput.value = company.location;
    }
  }
  
  async function loadSkillCatalog() {
    const { data, error } = await supabaseClient
      .from("skills")
      .select("id, name, skill_key, fields")
      .eq("is_active", true)
      .order("name", { ascending: true });
  
    if (error) {
      throw error;
    }
  
    listingState.skillCatalog = data || [];
    populateBothSkillDatalists();
  }
  
  function getListingPayload() {
    return {
      company_id: listingState.company.id,
      title: getElement("listingTitle").value.trim(),
      department:
        getElement("listingDepartment").value.trim(),
      location: getElement("listingLocation").value.trim(),
      work_mode: getElement("listingWorkMode").value,
      duration: getElement("listingDuration").value,
      allowance: getElement("listingAllowance").value,
      description:
        getElement("listingDescription").value.trim(),
  
      target_field: getElement("targetField").value,
      application_deadline:
        getElement("applicationDeadline").value,
      openings: Number(getElement("listingOpenings").value),
  
      preferred_major: getElement("preferredMajor").value,
      minimum_availability:
        getElement("minimumAvailability").value,
      preferred_year: getElement("preferredYear").value,
      mentorship: getElement("listingMentorship").value,
  
      required_skills: listingState.requiredSkills.map(
        (entry) => entry.skill.name
      ),
  
      nice_to_have_skills: listingState.niceSkills.map(
        (entry) => entry.skill.name
      ),
  
      status: "Open",
    };
  }
  
  function createListingSkillRows(listingId) {
    const requiredRows = listingState.requiredSkills.map(
      (entry) => ({
        listing_id: listingId,
        skill_id: entry.skill.id,
        requirement_type: "required",
        minimum_level: entry.level,
      })
    );
  
    const niceRows = listingState.niceSkills.map(
      (entry) => ({
        listing_id: listingId,
        skill_id: entry.skill.id,
        requirement_type: "nice_to_have",
        minimum_level: entry.level,
      })
    );
  
    return [...requiredRows, ...niceRows];
  }
  
  async function publishInternshipListing(event) {
    event.preventDefault();
  
    const form = event.currentTarget;
    const publishButton = getElement("publishListingButton");
  
    if (!form.reportValidity()) {
      return;
    }
  
    if (listingState.requiredSkills.length === 0) {
      showListingMessage(
        "Add at least one required skill before publishing.",
        "error"
      );
  
      getElement("requiredSkillInput").focus();
      return;
    }
  
    publishButton.disabled = true;
    publishButton.textContent = "Publishing...";
    showListingMessage("Publishing internship listing...");
  
    let createdListingId = null;
  
    try {
      const payload = getListingPayload();
  
      const { data: listing, error: listingError } =
        await supabaseClient
          .from("internship_listings")
          .insert(payload)
          .select("id")
          .single();
  
      if (listingError) {
        throw listingError;
      }
  
      createdListingId = listing.id;
  
      const skillRows =
        createListingSkillRows(createdListingId);
  
      const { error: skillsError } = await supabaseClient
        .from("listing_skills")
        .insert(skillRows);
  
      if (skillsError) {
        await supabaseClient
          .from("internship_listings")
          .delete()
          .eq("id", createdListingId);
  
        throw skillsError;
      }
  
      showListingMessage(
        "Internship listing published successfully.",
        "success"
      );
  
      window.setTimeout(() => {
        window.location.href = "job-posts.html?created=1";
      }, 700);
    } catch (error) {
      console.error(error);
  
      showListingMessage(
        error.message || "The internship could not be published.",
        "error"
      );
  
      publishButton.disabled = false;
      publishButton.textContent = "Publish Listing";
    }
  }
  
  function bindPostRoleEvents() {
    getElement("addRequiredSkillButton").addEventListener(
      "click",
      () => addSelectedSkill("required")
    );
  
    getElement("addNiceSkillButton").addEventListener(
      "click",
      () => addSelectedSkill("nice")
    );
  
    [
      "requiredSkillInput",
      "niceSkillInput",
    ].forEach((id) => {
      getElement(id).addEventListener("input", (event) => {
        event.currentTarget.setCustomValidity("");
      });
  
      getElement(id).addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
  
        event.preventDefault();
  
        addSelectedSkill(
          id === "requiredSkillInput"
            ? "required"
            : "nice"
        );
      });
    });
  
    getElement("targetField").addEventListener(
      "change",
      () => {
        populateBothSkillDatalists();
        updateListingPreview();
      }
    );
  
    [
      "listingTitle",
      "listingLocation",
      "listingWorkMode",
      "listingDuration",
      "listingOpenings",
      "applicationDeadline",
      "listingMentorship",
    ].forEach((id) => {
      const element = getElement(id);
  
      element.addEventListener("input", updateListingPreview);
      element.addEventListener("change", updateListingPreview);
    });
  
    getElement("internshipPostForm").addEventListener(
      "submit",
      publishInternshipListing
    );
  
    getElement("signOutLink").addEventListener(
      "click",
      async (event) => {
        event.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = "../index.html";
      }
    );
  }
  
  async function setupPostRolePage() {
    try {
      const profile = await protectPage("company");
  
      if (!profile) {
        return;
      }
  
      const deadlineInput = getElement("applicationDeadline");
      deadlineInput.min = new Date().toISOString().split("T")[0];
  
      bindPostRoleEvents();
  
      await Promise.all([
        loadCompanyProfile(),
        loadSkillCatalog(),
      ]);
  
      renderSkillLists();
      updateListingPreview();
    } catch (error) {
      console.error(error);
  
      showListingMessage(
        error.message || "The listing form could not be loaded.",
        "error"
      );
    }
  }
  
  document.addEventListener(
    "DOMContentLoaded",
    setupPostRolePage
  );
