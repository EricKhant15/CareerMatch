const profileKey = "careermatchStudentProfile";
const savedInternshipsKey = "careermatchSavedInternships";

const defaultProfile = {
  name: "Eric #12H4E",
  university: "Assumption University",
  major: "Information Technology",
  year: "Final year",
  field: "Software Engineering",
  skills: ["Python", "JavaScript", "SQL", "Git"],
  proficiency: "Intermediate",
  goal: "Become a software developer intern",
  location: "Bangkok",
  internshipType: "Paid",
  workStyle: "Hybrid",
  mentorship: "Required",
  availability: ["Tue", "Wed", "Fri"],
};

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
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
}

function setupOnboardingForm() {
  const form = document.querySelector("#studentSetupForm");
  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const formData = new FormData(form);

    const profile = {
      name: formData.get("name"),
      university: formData.get("university"),
      major: formData.get("major"),
      year: formData.get("year"),
      field: formData.get("field"),
      skills: collectCheckedValues(form, "skills"),
      proficiency: formData.get("proficiency"),
      goal: formData.get("goal"),
      location: formData.get("location"),
      internshipType: formData.get("internshipType"),
      workStyle: formData.get("workStyle"),
      mentorship: formData.get("mentorship"),
      availability: collectCheckedValues(form, "availability"),
    };

    saveProfile(profile);
    window.location.href = "profile.html";
  });
}

function fillProfilePage() {
  const profile = getSavedProfile();

  document.querySelectorAll("[data-profile]").forEach(input => {
    input.value = profile[input.dataset.profile] || "";
  });

  document.querySelectorAll("[data-profile-text]").forEach(element => {
    element.textContent = profile[element.dataset.profileText] || "";
  });

  document.querySelectorAll("[data-profile-list]").forEach(element => {
    const value = profile[element.dataset.profileList];
    element.textContent = Array.isArray(value) ? value.join(", ") : "";
  });
}

function refreshHeartButtons() {
  const savedInternships = getSavedInternships();

  document.querySelectorAll("[data-save-internship]").forEach(button => {
    const internshipId = button.dataset.saveInternship;
    const isSaved = savedInternships.includes(internshipId);

    button.classList.toggle("saved", isSaved);
    button.textContent = isSaved ? "♥" : "♡";
  });
}

function setupSaveButtons() {
  document.querySelectorAll("[data-save-internship]").forEach(button => {
    button.addEventListener("click", () => {
      const internshipId = button.dataset.saveInternship;
      const savedInternships = getSavedInternships();

      const nextSavedInternships = savedInternships.includes(internshipId)
        ? savedInternships.filter(id => id !== internshipId)
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
      <button class="heart-btn saved" type="button" data-save-internship="${internshipId}">♥</button>
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
    : `<article class="panel empty-saved"><h2>No saved internships yet</h2><p>Go to Recommended and click the heart.</p></article>`;

  setupSaveButtons();
  refreshHeartButtons();
}

setupOnboardingForm();
fillProfilePage();
setupSaveButtons();
refreshHeartButtons();
renderSavedInternships();