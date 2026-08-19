const companyList = document.querySelector("#companyList");
const adminMessage = document.querySelector("#adminMessage");
const pendingCount = document.querySelector("#pendingCount");
const approvedCount = document.querySelector("#approvedCount");
const rejectedCount = document.querySelector("#rejectedCount");
const totalCount = document.querySelector("#totalCount");

async function loadCompanies() {
  adminMessage.textContent = "Loading companies...";

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, account_status, created_at")
    .eq("role", "company")
    .order("created_at", { ascending: false });

  if (error) {
    adminMessage.textContent = error.message;
    return;
  }

  const companies = data || [];

  const pending = companies.filter((company) => company.account_status === "pending");
  const approved = companies.filter((company) => company.account_status === "approved");
  const rejected = companies.filter((company) => company.account_status === "rejected");

  pendingCount.textContent = pending.length;
  approvedCount.textContent = approved.length;
  rejectedCount.textContent = rejected.length;
  totalCount.textContent = companies.length;

  if (pending.length === 0) {
    companyList.innerHTML = `
      <div class="application-card empty-saved">
        <h2>No pending company accounts</h2>
        <p class="muted-text">New company registrations will appear here.</p>
      </div>
    `;

    adminMessage.textContent = "";
    return;
  }

  companyList.innerHTML = pending
    .map(
      (company) => `
        <article class="job-post-card">
          <div class="job-post-top">
            <div class="job-icon">
              ${company.full_name ? company.full_name.charAt(0) : "C"}
            </div>

            <span class="status review">Pending</span>
          </div>

          <div>
            <h2>${company.full_name || "Unnamed company"}</h2>
            <p>${company.email}</p>
          </div>

          <ul class="detail-list">
            <li>
              <span>Account type</span>
              <strong>Company</strong>
            </li>

            <li>
              <span>Submitted</span>
              <strong>${new Date(company.created_at).toLocaleDateString()}</strong>
            </li>
          </ul>

          <div class="card-actions">
            <button class="primary-btn" type="button" data-approve="${company.id}">
              Approve
            </button>

            <button class="danger-btn" type="button" data-reject="${company.id}">
              Reject
            </button>
          </div>
        </article>
      `
    )
    .join("");

  adminMessage.textContent = "";
}

async function updateCompanyStatus(companyId, status) {
  adminMessage.textContent = "Updating company status...";

  const { error } = await supabaseClient
    .from("profiles")
    .update({ account_status: status })
    .eq("id", companyId);

  if (error) {
    adminMessage.textContent = error.message;
    return;
  }

  await loadCompanies();
}

companyList.addEventListener("click", async (event) => {
  const approveId = event.target.dataset.approve;
  const rejectId = event.target.dataset.reject;

  if (approveId) {
    await updateCompanyStatus(approveId, "approved");
  }

  if (rejectId) {
    await updateCompanyStatus(rejectId, "rejected");
  }
});

loadCompanies();