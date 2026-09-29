import { readFile } from "node:fs/promises";

const PROJECT_REF = "nelbxmrmnkgnycbbddyh";
const BASE_URL = `https://${PROJECT_REF}.supabase.co`;
const password = process.env.CAREERMATCH_DEMO_PASSWORD;

if (!password || password.length < 6) {
  throw new Error("Set CAREERMATCH_DEMO_PASSWORD to at least 6 characters.");
}

const input = await new Promise((resolve, reject) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { value += chunk; });
  process.stdin.on("end", () => resolve(value));
  process.stdin.on("error", reject);
});

const keyPayload = JSON.parse(input);
const keyRows = Array.isArray(keyPayload)
  ? keyPayload
  : keyPayload.api_keys || keyPayload.data || [];
const secretRow = keyRows.find((item) =>
  item.name === "service_role" ||
  item.type === "secret" ||
  String(item.api_key || item.key || "").startsWith("sb_secret_")
);
const publicRow = keyRows.find((item) =>
  item.name === "anon" ||
  item.type === "publishable" ||
  String(item.api_key || item.key || "").startsWith("sb_publishable_")
);
const secretKey = secretRow?.api_key || secretRow?.key;
const publicKey = publicRow?.api_key || publicRow?.key;

if (!secretKey || !publicKey) {
  throw new Error("The Supabase CLI did not return both secret and publishable keys.");
}

const adminHeaders = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  "Content-Type": "application/json",
};

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...adminHeaders, ...(options.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path}: ${body?.message || body?.error_description || body?.error || text}`);
  }
  return body;
}

async function rest(table, { method = "GET", query = "", body, prefer } = {}) {
  return request(`/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: prefer ? { Prefer: prefer } : {},
  });
}

async function ensureAuthUser(account) {
  const listing = await request("/auth/v1/admin/users?page=1&per_page=1000");
  let user = (listing.users || []).find((item) => item.email?.toLowerCase() === account.email);
  const payload = {
    email: account.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: account.name, is_demo: true },
    app_metadata: { provider: "email", providers: ["email"], demo_role: account.role },
  };
  if (user) {
    user = await request(`/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  } else {
    user = await request("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  return user;
}

function uuid(group, number) {
  return `${group}0000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function isoDaysFromNow(days, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function dateDaysFromNow(days) {
  return isoDaysFromNow(days).slice(0, 10);
}

const companies = [
  { name: "ByteBridge Technologies", email: "demo.company@careermatch.test", industry: "Software Development", location: "Bangkok", website: "https://example.com/bytebridge" },
  { name: "DataSphere Analytics", email: "demo.datasphere@careermatch.test", industry: "Data Analytics", location: "Bangkok", website: "https://example.com/datasphere" },
  { name: "SecureWave Systems", email: "demo.securewave@careermatch.test", industry: "Cybersecurity", location: "Remote", website: "https://example.com/securewave" },
  { name: "CloudNest Solutions", email: "demo.cloudnest@careermatch.test", industry: "Cloud Services", location: "Bangkok", website: "https://example.com/cloudnest" },
  { name: "PixelCraft Studio", email: "demo.pixelcraft@careermatch.test", industry: "Product Design", location: "Bangkok", website: "https://example.com/pixelcraft" },
].map((item, index) => ({ ...item, role: "company", companyId: uuid("1", index + 1) }));

const people = [
  ["Maya Chen", "Computer Science", "Software Engineering"],
  ["Narin Sutham", "Cybersecurity", "Cybersecurity"],
  ["Sofia Reyes", "Data Science", "Data Analytics"],
  ["Liam Patel", "Design", "UI/UX Design"],
  ["Amina Hassan", "Information Technology", "Cloud Computing"],
  ["Noah Williams", "Software Engineering", "Software Engineering"],
  ["Pimchanok Saelim", "Information Technology", "Cybersecurity"],
  ["Daniel Kim", "Computer Science", "AI/Machine Learning"],
  ["Isabella Cruz", "Data Science", "AI/Machine Learning"],
  ["Thanawat Chaiya", "Computer Science", "Software Engineering"],
  ["Emma Johnson", "Software Engineering", "Software Engineering"],
  ["Krit Wongsa", "Information Technology", "Cloud Computing"],
  ["Olivia Martin", "Computer Science", "Data Analytics"],
  ["Arun Mehta", "Cybersecurity", "Cybersecurity"],
  ["Grace Lee", "Design", "UI/UX Design"],
  ["Pakorn Intara", "Software Engineering", "Software Engineering"],
  ["Zara Ahmed", "Data Science", "Data Analytics"],
  ["Ethan Brown", "Computer Science", "Cloud Computing"],
  ["Nicha Rattan", "Information Technology", "Software Engineering"],
  ["Lucas Silva", "Computer Science", "AI/Machine Learning"],
  ["Mei Lin", "Data Science", "Data Analytics"],
  ["Jacob Miller", "Software Engineering", "Software Engineering"],
  ["Siriporn Kaew", "Information Technology", "Cloud Computing"],
  ["Fatima Noor", "Cybersecurity", "Cybersecurity"],
  ["Henry Wilson", "Computer Science", "Software Engineering"],
  ["Ananya Rao", "Data Science", "AI/Machine Learning"],
  ["Ben Thompson", "Information Technology", "Cloud Computing"],
  ["Rin Nakamura", "Design", "UI/UX Design"],
  ["Omar Khalid", "Computer Science", "Cybersecurity"],
  ["Chanya Boonmee", "Software Engineering", "Software Engineering"],
];

const fieldSkills = {
  "Software Engineering": ["JavaScript", "HTML", "CSS", "Git", "SQL"],
  "Data Analytics": ["Python", "Pandas", "SQL", "Excel", "Git"],
  Cybersecurity: ["Linux", "Python", "SQL", "Git", "C"],
  "Cloud Computing": ["Linux", "Git", "Python", "SQL", "Java"],
  "UI/UX Design": ["Figma", "HTML", "CSS", "JavaScript", "Git"],
  "AI/Machine Learning": ["Python", "Pandas", "SQL", "Git", "Java"],
};

const students = people.map(([name, major, field], index) => ({
  name,
  major,
  field,
  role: "student",
  email: index === 0
    ? "demo.student@careermatch.test"
    : `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}.demo@careermatch.test`,
  studentId: uuid("2", index + 1),
  year: index % 4 === 0 ? "Second year" : index % 3 === 0 ? "Third year" : "Final year",
  skills: fieldSkills[field].map((skill, skillIndex) => ({
    name: skill,
    level: 1 + ((index + skillIndex) % 3),
  })),
}));

const listingTemplates = [
  [0, "Software Developer Intern", "Engineering", "Software Engineering", ["JavaScript", "HTML", "CSS", "Git"], ["SQL"]],
  [0, "Backend API Intern", "Platform Engineering", "Software Engineering", ["Python", "SQL", "Git"], ["Linux"]],
  [0, "QA Automation Intern", "Quality Engineering", "Software Engineering", ["Java", "Git", "SQL"], ["Python"]],
  [1, "Data Analyst Intern", "Analytics", "Data Analytics", ["Python", "Pandas", "SQL", "Excel"], ["Git"]],
  [1, "Machine Learning Intern", "AI Lab", "AI/Machine Learning", ["Python", "Pandas", "SQL"], ["Java"]],
  [1, "Business Intelligence Intern", "Business Analytics", "Data Analytics", ["SQL", "Excel", "Python"], ["Pandas"]],
  [2, "Cybersecurity Analyst Intern", "Security Operations", "Cybersecurity", ["Linux", "Python", "SQL"], ["Git"]],
  [2, "SOC Monitoring Intern", "Threat Operations", "Cybersecurity", ["Linux", "Python", "Git"], ["C"]],
  [3, "Cloud Support Intern", "Cloud Operations", "Cloud Computing", ["Linux", "Git", "Python"], ["SQL"]],
  [3, "DevOps Intern", "Infrastructure", "Cloud Computing", ["Linux", "Git", "Python", "Java"], ["SQL"]],
  [4, "UI/UX Design Intern", "Product Design", "UI/UX Design", ["Figma", "HTML", "CSS"], ["JavaScript"]],
  [4, "Product Design Intern", "Experience Design", "UI/UX Design", ["Figma", "CSS", "HTML"], ["Git"]],
  [0, "Legacy Systems Intern", "Engineering", "Software Engineering", ["C", "Linux"], ["Git"]],
  [1, "Expired Reporting Intern", "Analytics", "Data Analytics", ["Excel", "SQL"], ["Python"]],
  [0, "Filled Frontend Intern", "Web Engineering", "Software Engineering", ["HTML", "CSS", "JavaScript"], ["Git"]],
];

const listings = listingTemplates.map(([companyIndex, title, department, field, required, nice], index) => ({
  id: uuid("3", index + 1),
  companyIndex,
  title,
  department,
  field,
  required,
  nice,
  status: index === 12 ? "Closed" : index === 14 ? "Filled" : "Open",
  deadline: index === 13 ? dateDaysFromNow(-30) : dateDaysFromNow(120 + index),
}));

console.log(`Ensuring ${companies.length + students.length} Supabase Auth demo users...`);
for (const account of [...companies, ...students]) {
  account.auth = await ensureAuthUser(account);
}

await rest("profiles", {
  method: "POST",
  query: "on_conflict=id",
  body: [...companies, ...students].map((account) => ({
    id: account.auth.id,
    email: account.email,
    role: account.role,
    full_name: account.name,
    account_status: "approved",
    is_demo: true,
  })),
  prefer: "resolution=merge-duplicates,return=minimal",
});

await rest("companies", {
  method: "POST",
  query: "on_conflict=id",
  body: companies.map((company, index) => ({
    id: company.companyId,
    profile_id: company.auth.id,
    company_name: company.name,
    industry: company.industry,
    location: company.location,
    approval_status: "Approved",
    company_size: index % 2 ? "51-200 employees" : "11-50 employees",
    year_established: 2014 + index,
    phone_number: `+66 2 555 10${index + 1}`,
    contact_position: "Talent Acquisition Manager",
    registration_number: `DEMO-TH-${2026001 + index}`,
    website: company.website,
    contact_name: `${company.name} Recruitment Team`,
    contact_email: company.email,
    description: `${company.name} is a fictional demonstration company used to test CareerMatch workflows.`,
    verification_notes: "Synthetic company approved for the CareerMatch exhibition.",
    submitted_at: isoDaysFromNow(-90 + index),
    updated_at: new Date().toISOString(),
  })),
  prefer: "resolution=merge-duplicates,return=minimal",
});

await rest("students", {
  method: "POST",
  query: "on_conflict=id",
  body: students.map((student, index) => ({
    id: student.studentId,
    profile_id: student.auth.id,
    university: "Assumption University",
    major: student.major,
    year_of_study: student.year,
    preferred_field: student.field,
    preferred_location: index % 4 === 0 ? "Remote" : "Bangkok",
    work_style: index % 3 === 0 ? "Remote" : index % 3 === 1 ? "Hybrid" : "On-site",
    internship_type: index % 5 === 0 ? "Either" : "Paid",
    mentorship: index % 3 === 0 ? "High" : index % 3 === 1 ? "Medium" : "Low",
    availability: index % 2
      ? ["Monday", "Tuesday", "Wednesday", "Thursday"]
      : ["Tuesday", "Wednesday", "Thursday", "Friday"],
    career_goal: `Build practical experience in ${student.field.toLowerCase()} and contribute to real project delivery.`,
    updated_at: new Date().toISOString(),
  })),
  prefer: "resolution=merge-duplicates,return=minimal",
});

const catalog = await rest("skills", { query: "select=id,name,skill_key&is_active=eq.true" });
const skillByName = new Map(catalog.map((skill) => [skill.name.toLowerCase(), skill]));

const studentSkillRows = [];
students.forEach((student, studentIndex) => {
  student.skills.forEach((skill, skillIndex) => {
    const levelName = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" }[skill.level];
    studentSkillRows.push({
      id: uuid("7", studentIndex * 10 + skillIndex + 1),
      student_id: student.studentId,
      skill_name: skill.name,
      skill_key: skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      skill_level: levelName,
      level_number: skill.level,
    });
  });
});
await rest("student_skills", {
  method: "POST",
  query: "on_conflict=id",
  body: studentSkillRows,
  prefer: "resolution=merge-duplicates,return=minimal",
});

await rest("internship_listings", {
  method: "POST",
  query: "on_conflict=id",
  body: listings.map((listing, index) => ({
    id: listing.id,
    company_id: companies[listing.companyIndex].companyId,
    title: listing.title,
    department: listing.department,
    location: companies[listing.companyIndex].location,
    work_mode: index % 3 === 0 ? "Remote" : index % 3 === 1 ? "Hybrid" : "On-site",
    duration: index % 2 ? "6 months" : "4 months",
    allowance: "Paid",
    description: `Join the ${listing.department} team to solve practical ${listing.field.toLowerCase()} problems, collaborate with mentors, and deliver production-focused work.`,
    learning_outcomes: `Develop applied ${listing.field.toLowerCase()} skills, teamwork, documentation, and professional communication.`,
    internship_benefits: "Monthly allowance, mentor support, flexible learning sessions, and a completion certificate.",
    completion_documents: ["Certificate", "Performance evaluation"],
    required_skills: listing.required,
    nice_to_have_skills: listing.nice,
    preferred_major: listing.field === "UI/UX Design" ? "Design" : listing.field === "Data Analytics" ? "Data Science" : "Computer Science",
    minimum_availability: "4 days per week",
    preferred_year: "Final year",
    mentorship: index % 2 ? "Medium" : "High",
    status: listing.status,
    target_field: listing.field,
    application_deadline: listing.deadline,
    openings: 8,
    updated_at: new Date().toISOString(),
  })),
  prefer: "resolution=merge-duplicates,return=minimal",
});

const listingSkillRows = [];
listings.forEach((listing, listingIndex) => {
  [...listing.required.map((name) => [name, "required"]), ...listing.nice.map((name) => [name, "nice_to_have"])]
    .forEach(([name, type], skillIndex) => {
      const catalogSkill = skillByName.get(name.toLowerCase());
      if (!catalogSkill) return;
      listingSkillRows.push({
        id: uuid("8", listingIndex * 10 + skillIndex + 1),
        listing_id: listing.id,
        skill_id: catalogSkill.id,
        requirement_type: type,
        minimum_level: type === "required" ? 2 : 1,
      });
    });
});
await rest("listing_skills", {
  method: "POST",
  query: "on_conflict=id",
  body: listingSkillRows,
  prefer: "resolution=merge-duplicates,return=minimal",
});

const openByField = new Map();
listings.filter((listing) => listing.status === "Open" && listing.deadline >= dateDaysFromNow(0))
  .forEach((listing) => {
    const items = openByField.get(listing.field) || [];
    items.push(listing);
    openByField.set(listing.field, items);
  });
const eligibleListings = listings.filter((listing) => listing.status === "Open" && listing.deadline >= dateDaysFromNow(0));

const applications = [];
students.forEach((student, studentIndex) => {
  const relevant = openByField.get(student.field) || eligibleListings;
  const selected = [relevant[studentIndex % relevant.length]];
  selected.push(eligibleListings[(studentIndex * 3 + 1) % eligibleListings.length]);
  selected.push(eligibleListings[(studentIndex * 5 + 4) % eligibleListings.length]);
  if (studentIndex < 10) selected.push(eligibleListings[(studentIndex * 7 + 6) % eligibleListings.length]);
  [...new Map(selected.map((listing) => [listing.id, listing])).values()].forEach((listing, applicationIndex) => {
    let status = applicationIndex === 0
      ? ["Accepted", "Interview Scheduled", "Accepted", "Under Review", "Accepted"][studentIndex % 5]
      : (studentIndex + applicationIndex) % 4 === 0 ? "Rejected" : "Under Review";
    const completed = applicationIndex === 0 && studentIndex % 5 === 2;
    const offered = completed;
    applications.push({
      id: uuid("4", studentIndex * 10 + applicationIndex + 1),
      student_id: student.studentId,
      listing_id: listing.id,
      status,
      applied_at: isoDaysFromNow(-(40 - ((studentIndex * 3 + applicationIndex) % 35))),
      cv_filename: `${student.name.replace(/\s+/g, "-")}-Demo-CV.pdf`,
      interview_round: status === "Accepted" || status === "Interview Scheduled" ? "First interview" : null,
      interview_date: status === "Interview Scheduled" ? dateDaysFromNow(7 + (studentIndex % 10)) : completed ? dateDaysFromNow(-4) : null,
      interview_time: status === "Accepted" || status === "Interview Scheduled" ? "10:00:00" : null,
      interview_type: status === "Accepted" || status === "Interview Scheduled" ? "Online" : null,
      interviewer: status === "Accepted" || status === "Interview Scheduled" ? "Demo Hiring Manager" : null,
      meeting_link: status === "Interview Scheduled" ? "https://meet.example.com/careermatch-demo" : null,
      interview_message: status === "Accepted" || status === "Interview Scheduled" ? "Please prepare to discuss your projects and technical interests." : null,
      interview_status: completed ? "Completed" : status === "Interview Scheduled" ? "Sent" : status === "Accepted" ? "Draft" : null,
      interview_updated_at: status === "Accepted" || status === "Interview Scheduled" ? isoDaysFromNow(-2) : null,
      offer_status: offered ? (studentIndex % 2 ? "Accepted" : "Pending") : null,
      offer_sent_at: offered ? isoDaysFromNow(-3) : null,
      offer_responded_at: offered && studentIndex % 2 ? isoDaysFromNow(-2) : null,
    });
  });
});
await rest("applications", {
  method: "POST",
  query: "on_conflict=id",
  body: applications,
  prefer: "resolution=merge-duplicates,return=minimal",
});

const cvSlugs = ["maya-chen", "narin-sutham", "sofia-reyes", "liam-patel", "amina-hassan", "noah-williams"];
for (let index = 0; index < cvSlugs.length; index += 1) {
  const student = students[index];
  const application = applications.find((item) => item.student_id === student.studentId);
  if (!application) continue;
  const filename = `demo-cv-${cvSlugs[index]}.pdf`;
  const file = await readFile(new URL(`../output/pdf/${filename}`, import.meta.url));
  const cvPath = `${student.auth.id}/${application.listing_id}/${filename}`;
  await request(`/storage/v1/object/application-cvs/${cvPath}`, {
    method: "POST",
    body: file,
    headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
  });
  await rest("applications", {
    method: "PATCH",
    query: `id=eq.${application.id}`,
    body: { cv_path: cvPath, cv_filename: filename },
    prefer: "return=minimal",
  });
}
console.log(`Uploaded ${cvSlugs.length} synthetic PDF CVs to private storage.`);

const saves = [];
const events = [];
students.forEach((student, studentIndex) => {
  eligibleListings.forEach((listing, listingIndex) => {
    const popularity = 1 + ((studentIndex + listingIndex) % 4);
    if ((studentIndex + listingIndex) % 3 === 0) {
      saves.push({ student_id: student.studentId, listing_id: listing.id, created_at: isoDaysFromNow(-(listingIndex + 2)) });
    }
    for (let view = 0; view < popularity; view += 1) {
      events.push({
        id: uuid("9", studentIndex * 100 + listingIndex * 5 + view + 1),
        student_id: student.studentId,
        listing_id: listing.id,
        event_type: view % 3 === 0 ? "recommendation_view" : "detail_view",
        created_at: isoDaysFromNow(-((studentIndex + listingIndex + view) % 45)),
      });
    }
  });
});
await rest("saved_internships", {
  method: "POST",
  query: "on_conflict=student_id,listing_id",
  body: saves,
  prefer: "resolution=merge-duplicates,return=minimal",
});
await rest("listing_events", {
  method: "POST",
  query: "on_conflict=id",
  body: events,
  prefer: "resolution=merge-duplicates,return=minimal",
});

const notificationRows = students.slice(0, 12).map((student, index) => ({
  id: uuid("6", index + 1),
  recipient_profile_id: student.auth.id,
  listing_id: applications.find((application) => application.student_id === student.studentId)?.listing_id,
  notification_type: "application_update",
  title: index % 3 === 0 ? "Interview update" : "Application received",
  message: index % 3 === 0
    ? "A demonstration company has updated your interview stage."
    : "Your demonstration application is now under review.",
  is_read: index % 2 === 0,
  created_at: isoDaysFromNow(-(index + 1)),
}));
await rest("notifications", {
  method: "POST",
  query: "on_conflict=id",
  body: notificationRows,
  prefer: "resolution=merge-duplicates,return=minimal",
});

console.log(`Seeded ${companies.length} companies, ${students.length} students, ${listings.length} listings, and ${applications.length} applications.`);

const invalidListingIds = listings.filter((listing) => listing.status !== "Open" || listing.deadline < dateDaysFromNow(0)).map((listing) => listing.id);
const evaluationStudents = students.slice(0, 6);
const testRows = [];

async function loginDemoAccount(account) {
  const loginResponse = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publicKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password }),
  });
  const login = await loginResponse.json();
  if (!loginResponse.ok) throw new Error(`Demo login failed for ${account.email}: ${login.error_description || login.msg}`);
  return login;
}

async function invokeFunction(name, accessToken, body) {
  const response = await fetch(`${BASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${name} failed: ${result.error || response.status}`);
  return result;
}

console.log("Precomputing semantic embeddings for demo listings...");
for (const company of companies) {
  const login = await loginDemoAccount(company);
  const companyListings = listings.filter((listing) => listing.companyIndex === companies.indexOf(company));
  for (const listing of companyListings) {
    await invokeFunction("generate-embedding", login.access_token, {
      type: "internship",
      id: listing.id,
    });
  }
}

console.log("Running live hybrid recommender evaluations...");
for (const student of evaluationStudents) {
  const login = await loginDemoAccount(student);
  await invokeFunction("generate-embedding", login.access_token, {
    type: "student",
    id: student.studentId,
  });

  const recommendationBody = await invokeFunction(
    "recommend-internships",
    login.access_token,
    {}
  );

  const actual = recommendationBody.recommendations || [];
  const actualIds = actual.map((item) => item.id);
  const expected = (openByField.get(student.field) || []).map((item) => item.id);
  const top1Pass = expected.includes(actualIds[0]);
  const top3Pass = actualIds.slice(0, 3).some((id) => expected.includes(id));
  const ruleFilterPass = invalidListingIds.every((id) => !actualIds.includes(id));
  testRows.push({
    run_label: "synthetic-hybrid-v1",
    student_id: student.studentId,
    expected_listing_ids: expected,
    actual_listing_ids: actualIds,
    top_1_pass: top1Pass,
    top_3_pass: top3Pass,
    rule_filter_pass: ruleFilterPass,
    metrics: {
      algorithm: recommendationBody.algorithm,
      recommendation_count: actual.length,
      top_score: actual[0]?.score ?? null,
      top_qualification: actual[0]?.qualificationScore ?? null,
      top_compatibility: actual[0]?.compatibilityScore ?? null,
      top_semantic: actual[0]?.semanticScore ?? null,
    },
    notes: `Expected ${student.field} listings near the top of the ranking.`,
  });
  console.log(`${student.name}: top-1=${top1Pass ? "PASS" : "CHECK"}, top-3=${top3Pass ? "PASS" : "FAIL"}, rules=${ruleFilterPass ? "PASS" : "FAIL"}`);
}

await rest("recommender_test_runs", {
  method: "POST",
  body: testRows,
  prefer: "return=minimal",
});

const top1Rate = Math.round((testRows.filter((row) => row.top_1_pass).length / testRows.length) * 100);
const top3Rate = Math.round((testRows.filter((row) => row.top_3_pass).length / testRows.length) * 100);
const ruleRate = Math.round((testRows.filter((row) => row.rule_filter_pass).length / testRows.length) * 100);
console.log(`Hybrid evaluation: Top-1 ${top1Rate}%, Top-3 ${top3Rate}%, Rule filtering ${ruleRate}%.`);
console.log("Demo logins:");
console.log(`  Student: ${students[0].email}`);
console.log(`  Company: ${companies[0].email}`);
console.log("  Password: supplied through CAREERMATCH_DEMO_PASSWORD (not stored in Git)");
