const input = await new Promise((resolve, reject) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { value += chunk; });
  process.stdin.on("end", () => resolve(value));
  process.stdin.on("error", reject);
});

const payload = JSON.parse(input);
const rows = Array.isArray(payload) ? payload : payload.api_keys || payload.data || [];
const elevated = rows.find((item) => item.name === "service_role" || item.type === "secret" || String(item.api_key || item.key || "").startsWith("sb_secret_"));
const key = elevated?.api_key || elevated?.key;
if (!key) throw new Error("No elevated Supabase key was provided.");

const base = "https://nelbxmrmnkgnycbbddyh.supabase.co/rest/v1";
async function select(table, query) {
  const response = await fetch(`${base}/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${table}: ${body.message || body.error}`);
  return body;
}

const [profiles, companies, students, listings, applications, tests] = await Promise.all([
  select("profiles", "select=id,role,account_status,is_demo"),
  select("companies", "select=id,profile_id"),
  select("students", "select=id,profile_id"),
  select("internship_listings", "select=id,company_id,status,application_deadline"),
  select("applications", "select=id,student_id,listing_id,status,interview_status,offer_status,cv_path"),
  select("recommender_test_runs", "select=student_id,top_1_pass,top_3_pass,rule_filter_pass,created_at&run_label=eq.synthetic-hybrid-v1&order=created_at.desc"),
]);

const demoProfileIds = new Set(profiles.filter((row) => row.is_demo).map((row) => row.id));
const demoStudents = students.filter((row) => demoProfileIds.has(row.profile_id));
const demoCompanies = companies.filter((row) => demoProfileIds.has(row.profile_id));
const demoStudentIds = new Set(demoStudents.map((row) => row.id));
const demoCompanyIds = new Set(demoCompanies.map((row) => row.id));
const demoListings = listings.filter((row) => demoCompanyIds.has(row.company_id));
const demoListingIds = new Set(demoListings.map((row) => row.id));
const demoApplications = applications.filter((row) => demoStudentIds.has(row.student_id) && demoListingIds.has(row.listing_id));
const latestByStudent = new Map();
tests.forEach((row) => { if (!latestByStudent.has(row.student_id)) latestByStudent.set(row.student_id, row); });
const latestTests = [...latestByStudent.values()].filter((row) => demoStudentIds.has(row.student_id));
const adminStatuses = profiles.filter((row) => row.role === "admin").map((row) => row.account_status || "missing");

const checks = {
  demo_students: demoStudents.length,
  demo_companies: demoCompanies.length,
  demo_listings: demoListings.length,
  demo_applications: demoApplications.length,
  demo_applications_with_cv: demoApplications.filter((row) => row.cv_path).length,
  evaluation_scenarios: latestTests.length,
  top_1_rate: latestTests.length ? Math.round(latestTests.filter((row) => row.top_1_pass).length / latestTests.length * 100) : 0,
  top_3_rate: latestTests.length ? Math.round(latestTests.filter((row) => row.top_3_pass).length / latestTests.length * 100) : 0,
  rule_filter_rate: latestTests.length ? Math.round(latestTests.filter((row) => row.rule_filter_pass).length / latestTests.length * 100) : 0,
  admin_account_statuses: adminStatuses,
};

if (checks.demo_students < 30 || checks.demo_companies < 5 || checks.demo_listings < 15 || checks.demo_applications < 90) {
  throw new Error(`Demo data verification failed: ${JSON.stringify(checks)}`);
}
if (checks.top_3_rate !== 100 || checks.rule_filter_rate !== 100) {
  throw new Error(`Recommender verification failed: ${JSON.stringify(checks)}`);
}

console.log(JSON.stringify(checks, null, 2));
