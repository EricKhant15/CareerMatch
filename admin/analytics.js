const analyticsState = {
  profiles: [], students: [], companies: [], listings: [], applications: [],
  studentSkills: [], listingSkills: [], skills: [], saves: [], events: [], tests: [],
};

const analyticsElement = (id) => document.getElementById(id);
const uniqueCount = (values) => new Set(values.filter(Boolean)).size;
const percent = (value, total) => total ? `${Math.round((value / total) * 100)}%` : "0%";

function setAnalyticsMessage(message, type = "info") {
  const element = analyticsElement("analyticsMessage");
  element.textContent = message;
  element.style.color = { info: "#6329b7", error: "#c43d4d", success: "#16834a" }[type];
}

function withinWindow(dateValue) {
  const days = analyticsElement("analyticsWindow").value;
  if (days === "all" || !dateValue) return true;
  return new Date(dateValue) >= new Date(Date.now() - Number(days) * 86400000);
}

function includeDemoFlag(flag) {
  const mode = analyticsElement("analyticsDataMode").value;
  return mode === "all" || (mode === "demo" ? flag === true : flag !== true);
}

function analyticsRows() {
  const profilesById = new Map(analyticsState.profiles.map((row) => [row.id, row]));
  const studentsById = new Map(analyticsState.students.map((row) => [row.id, row]));
  const companiesById = new Map(analyticsState.companies.map((row) => [row.id, row]));
  const listingsById = new Map(analyticsState.listings.map((row) => [row.id, row]));
  const selectedMajor = analyticsElement("analyticsMajor").value;
  const selectedField = analyticsElement("analyticsField").value;

  const students = analyticsState.students.filter((student) => {
    const profile = profilesById.get(student.profile_id);
    return includeDemoFlag(profile?.is_demo) && (selectedMajor === "all" || student.major === selectedMajor);
  });
  const studentIds = new Set(students.map((row) => row.id));
  const companies = analyticsState.companies.filter((company) => includeDemoFlag(profilesById.get(company.profile_id)?.is_demo));
  const companyIds = new Set(companies.map((row) => row.id));
  const listings = analyticsState.listings.filter((listing) => companyIds.has(listing.company_id) && (selectedField === "all" || listing.target_field === selectedField));
  const listingIds = new Set(listings.map((row) => row.id));
  const applications = analyticsState.applications.filter((row) => studentIds.has(row.student_id) && listingIds.has(row.listing_id) && withinWindow(row.applied_at));

  return {
    profilesById, studentsById, companiesById, listingsById, students, studentIds,
    companies, companyIds, listings, listingIds, applications,
    saves: analyticsState.saves.filter((row) => studentIds.has(row.student_id) && listingIds.has(row.listing_id) && withinWindow(row.created_at)),
    events: analyticsState.events.filter((row) => listingIds.has(row.listing_id) && withinWindow(row.created_at)),
    tests: analyticsState.tests.filter((row) => studentIds.has(row.student_id) && withinWindow(row.created_at)),
  };
}

function renderStats(rows) {
  const activeListings = rows.listings.filter((row) => row.status === "Open" && (!row.application_deadline || row.application_deadline >= new Date().toISOString().slice(0, 10)));
  const interviews = rows.applications.filter((row) => row.interview_status === "Sent" || row.interview_status === "Completed");
  const offers = rows.applications.filter((row) => row.offer_status);
  const placements = rows.applications.filter((row) => row.offer_status === "Accepted");
  analyticsElement("metricStudents").textContent = rows.students.length;
  analyticsElement("metricCompanies").textContent = rows.companies.length;
  analyticsElement("metricListings").textContent = activeListings.length;
  analyticsElement("metricApplications").textContent = rows.applications.length;
  analyticsElement("metricInterviews").textContent = interviews.length;
  analyticsElement("metricOffers").textContent = offers.length;
  analyticsElement("metricPlacements").textContent = placements.length;
}

function renderFunnel(rows) {
  const stages = [
    ["Applications", rows.applications.length],
    ["Shortlisted", rows.applications.filter((row) => ["Accepted", "Interview Scheduled"].includes(row.status)).length],
    ["Interviewed", rows.applications.filter((row) => ["Sent", "Completed"].includes(row.interview_status)).length],
    ["Offers", rows.applications.filter((row) => row.offer_status).length],
    ["Accepted", rows.applications.filter((row) => row.offer_status === "Accepted").length],
  ];
  const maximum = Math.max(stages[0][1], 1);
  analyticsElement("applicationFunnel").replaceChildren(...stages.map(([label, value]) => {
    const row = document.createElement("div");
    row.className = "analytics-bar-row";
    row.innerHTML = `<div><span>${label}</span><strong>${value}</strong></div><div class="analytics-bar-track"><span style="width:${Math.max(3, (value / maximum) * 100)}%"></span></div>`;
    return row;
  }));
}

function renderRecommender(rows) {
  const latestByStudent = new Map();
  [...rows.tests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach((test) => {
    if (!latestByStudent.has(test.student_id)) latestByStudent.set(test.student_id, test);
  });
  const tests = [...latestByStudent.values()];
  const metrics = [
    ["Scenarios", tests.length],
    ["Top-1 expected", percent(tests.filter((row) => row.top_1_pass).length, tests.length)],
    ["Expected in Top 3", percent(tests.filter((row) => row.top_3_pass).length, tests.length)],
    ["Rule filters passed", percent(tests.filter((row) => row.rule_filter_pass).length, tests.length)],
  ];
  const container = analyticsElement("recommenderHealth");
  container.replaceChildren(...metrics.map(([label, value]) => {
    const item = document.createElement("article");
    item.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    return item;
  }));
  if (!tests.length) {
    const note = document.createElement("p");
    note.className = "muted-text";
    note.textContent = "No recommender evaluation runs match the selected filters.";
    container.appendChild(note);
  }
}

function appendCells(row, values) {
  values.forEach((value) => {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
  });
}

function renderPopularListings(rows) {
  const records = rows.listings.map((listing) => {
    const views = rows.events.filter((event) => event.listing_id === listing.id && event.event_type === "detail_view").length;
    const saves = rows.saves.filter((save) => save.listing_id === listing.id).length;
    const applications = rows.applications.filter((application) => application.listing_id === listing.id);
    const accepted = applications.filter((application) => application.offer_status === "Accepted").length;
    return { listing, views, saves, applications: applications.length, accepted, score: views + saves * 3 + applications.length * 5 };
  }).sort((a, b) => b.score - a.score).slice(0, 10);
  const body = analyticsElement("popularListingsBody");
  body.replaceChildren(...records.map((record) => {
    const row = document.createElement("tr");
    appendCells(row, [record.listing.title, rows.companiesById.get(record.listing.company_id)?.company_name, record.views, record.saves, record.applications, record.accepted, percent(record.applications, record.views)]);
    return row;
  }));
}

function renderMajorOutcomes(rows) {
  const groups = new Map();
  rows.students.forEach((student) => groups.set(student.major || "Not provided", { applicants: new Set(), interviewed: new Set(), offers: new Set(), accepted: new Set() }));
  rows.applications.forEach((application) => {
    const student = rows.studentsById.get(application.student_id);
    if (!student || !rows.studentIds.has(student.id)) return;
    const group = groups.get(student.major || "Not provided");
    group.applicants.add(student.id);
    if (["Sent", "Completed"].includes(application.interview_status)) group.interviewed.add(student.id);
    if (application.offer_status) group.offers.add(student.id);
    if (application.offer_status === "Accepted") group.accepted.add(student.id);
  });
  const body = analyticsElement("majorOutcomesBody");
  body.replaceChildren(...[...groups.entries()].sort((a, b) => b[1].applicants.size - a[1].applicants.size).map(([major, group]) => {
    const row = document.createElement("tr");
    appendCells(row, [major, group.applicants.size, group.interviewed.size, group.offers.size, group.accepted.size, percent(group.accepted.size, group.applicants.size)]);
    return row;
  }));
}

function renderSkillGaps(rows) {
  const skillById = new Map(analyticsState.skills.map((skill) => [skill.id, skill]));
  const demand = new Map();
  analyticsState.listingSkills.filter((row) => rows.listingIds.has(row.listing_id)).forEach((row) => {
    const name = skillById.get(row.skill_id)?.name;
    if (name) demand.set(name, (demand.get(name) || 0) + 1);
  });
  const supplySets = new Map();
  analyticsState.studentSkills.filter((row) => rows.studentIds.has(row.student_id)).forEach((row) => {
    const set = supplySets.get(row.skill_name) || new Set();
    set.add(row.student_id);
    supplySets.set(row.skill_name, set);
  });
  const records = [...new Set([...demand.keys(), ...supplySets.keys()])].map((name) => {
    const needed = demand.get(name) || 0;
    const available = supplySets.get(name)?.size || 0;
    const ratio = needed ? available / needed : Infinity;
    return { name, needed, available, gap: needed === 0 ? "Student surplus" : ratio < 1 ? "High" : ratio < 2 ? "Medium" : "Low" };
  }).sort((a, b) => b.needed - a.needed || a.available - b.available).slice(0, 12);
  const body = analyticsElement("skillGapBody");
  body.replaceChildren(...records.map((record) => {
    const row = document.createElement("tr");
    appendCells(row, [record.name, record.needed, record.available, record.gap]);
    return row;
  }));
}

function renderFieldDemand(rows) {
  const groups = new Map();
  rows.listings.forEach((listing) => groups.set(listing.target_field || "Not provided", { listings: 0, applications: 0, accepted: 0 }));
  rows.listings.forEach((listing) => groups.get(listing.target_field || "Not provided").listings += 1);
  rows.applications.forEach((application) => {
    const field = rows.listingsById.get(application.listing_id)?.target_field || "Not provided";
    if (!groups.has(field)) return;
    groups.get(field).applications += 1;
    if (application.offer_status === "Accepted") groups.get(field).accepted += 1;
  });
  const body = analyticsElement("fieldDemandBody");
  body.replaceChildren(...[...groups.entries()].sort((a, b) => b[1].applications - a[1].applications).map(([field, item]) => {
    const row = document.createElement("tr");
    appendCells(row, [field, item.listings, item.applications, item.accepted]);
    return row;
  }));
}

function renderCompanyActivity(rows) {
  const body = analyticsElement("companyActivityBody");
  body.replaceChildren(...rows.companies.map((company) => {
    const listingIds = new Set(rows.listings.filter((listing) => listing.company_id === company.id).map((listing) => listing.id));
    const applications = rows.applications.filter((application) => listingIds.has(application.listing_id));
    const row = document.createElement("tr");
    appendCells(row, [company.company_name, listingIds.size, uniqueCount(applications.map((item) => item.student_id)), applications.filter((item) => ["Sent", "Completed"].includes(item.interview_status)).length, applications.filter((item) => item.offer_status === "Accepted").length]);
    return row;
  }));
}

function renderAlerts(rows) {
  const today = new Date().toISOString().slice(0, 10);
  const applicationCounts = new Map();
  rows.applications.forEach((row) => applicationCounts.set(row.listing_id, (applicationCounts.get(row.listing_id) || 0) + 1));
  const alerts = [];
  rows.listings.filter((row) => row.status === "Open" && row.application_deadline && row.application_deadline < today).forEach((row) => alerts.push(["Expired listing still open", row.title]));
  rows.listings.filter((row) => row.status === "Open" && !applicationCounts.get(row.id)).forEach((row) => alerts.push(["No applications", row.title]));
  rows.companies.filter((row) => row.approval_status === "Pending").forEach((row) => alerts.push(["Company awaiting approval", row.company_name]));
  const overdueByListing = new Map();
  rows.applications
    .filter((row) => row.status === "Under Review" && new Date(row.applied_at) < new Date(Date.now() - 21 * 86400000))
    .forEach((row) => {
      const group = overdueByListing.get(row.listing_id) || { count: 0, oldestAppliedAt: row.applied_at };
      group.count += 1;
      if (new Date(row.applied_at) < new Date(group.oldestAppliedAt)) group.oldestAppliedAt = row.applied_at;
      overdueByListing.set(row.listing_id, group);
    });
  [...overdueByListing.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .forEach(([listingId, group]) => {
      const waitingDays = Math.floor((Date.now() - new Date(group.oldestAppliedAt).getTime()) / 86400000);
      const label = group.count === 1
        ? "1 application waiting over 21 days"
        : `${group.count} applications waiting over 21 days`;
      const listingTitle = rows.listingsById.get(listingId)?.title || "Internship";
      alerts.push([label, `${listingTitle} · oldest ${waitingDays} days`]);
    });
  const container = analyticsElement("analyticsAlerts");
  if (!alerts.length) {
    container.innerHTML = '<div class="analytics-alert ok"><strong>No urgent issues</strong><span>The selected dataset has no operational alerts.</span></div>';
    return;
  }
  container.replaceChildren(...alerts.slice(0, 12).map(([title, detail]) => {
    const item = document.createElement("div");
    item.className = "analytics-alert";
    const heading = document.createElement("strong");
    const description = document.createElement("span");
    heading.textContent = title;
    description.textContent = detail;
    item.append(heading, description);
    return item;
  }));
}

function renderAnalytics() {
  const rows = analyticsRows();
  analyticsElement("demoDataBanner").hidden = analyticsElement("analyticsDataMode").value === "real";
  renderStats(rows); renderFunnel(rows); renderRecommender(rows); renderPopularListings(rows);
  renderMajorOutcomes(rows); renderSkillGaps(rows); renderFieldDemand(rows); renderCompanyActivity(rows); renderAlerts(rows);
  setAnalyticsMessage(`Showing ${analyticsElement("analyticsDataMode").selectedOptions[0].text.toLowerCase()} analytics.`, "success");
}

function populateAnalyticsFilters() {
  const major = analyticsElement("analyticsMajor");
  [...new Set(analyticsState.students.map((row) => row.major).filter(Boolean))].sort().forEach((value) => major.add(new Option(value, value)));
  const field = analyticsElement("analyticsField");
  [...new Set(analyticsState.listings.map((row) => row.target_field).filter(Boolean))].sort().forEach((value) => field.add(new Option(value, value)));
  ["analyticsDataMode", "analyticsWindow", "analyticsMajor", "analyticsField"].forEach((id) => analyticsElement(id).addEventListener("change", renderAnalytics));
}

async function loadAnalyticsData() {
  const queries = await Promise.all([
    supabaseClient.from("profiles").select("id, role, account_status, is_demo"),
    supabaseClient.from("students").select("id, profile_id, major, preferred_field"),
    supabaseClient.from("companies").select("id, profile_id, company_name, approval_status"),
    supabaseClient.from("internship_listings").select("id, company_id, title, target_field, status, application_deadline, openings"),
    supabaseClient.from("applications").select("id, student_id, listing_id, status, applied_at, interview_status, offer_status"),
    supabaseClient.from("student_skills").select("student_id, skill_name, level_number"),
    supabaseClient.from("listing_skills").select("listing_id, skill_id, requirement_type, minimum_level"),
    supabaseClient.from("skills").select("id, name"),
    supabaseClient.from("saved_internships").select("student_id, listing_id, created_at"),
    supabaseClient.from("listing_events").select("student_id, listing_id, event_type, created_at"),
    supabaseClient.from("recommender_test_runs").select("student_id, top_1_pass, top_3_pass, rule_filter_pass, created_at, metrics"),
  ]);
  const failure = queries.find((query) => query.error);
  if (failure) throw failure.error;
  ["profiles", "students", "companies", "listings", "applications", "studentSkills", "listingSkills", "skills", "saves", "events", "tests"].forEach((key, index) => { analyticsState[key] = queries[index].data || []; });
}

async function initializeAnalytics() {
  try {
    const profile = await protectPage("admin");
    if (!profile) return;
    analyticsElement("analyticsSignOut").addEventListener("click", async (event) => {
      event.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = "../index.html";
    });
    await loadAnalyticsData();
    populateAnalyticsFilters();
    renderAnalytics();
  } catch (error) {
    console.error(error);
    setAnalyticsMessage(error.message || "Analytics could not be loaded.", "error");
  }
}

document.addEventListener("DOMContentLoaded", initializeAnalytics);
