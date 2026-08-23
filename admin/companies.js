const companyList = document.querySelector("#companyList");
const adminMessage = document.querySelector("#adminMessage");
const pendingCount = document.querySelector("#pendingCount");
const approvedCount = document.querySelector("#approvedCount");
const rejectedCount = document.querySelector("#rejectedCount");
const totalCount = document.querySelector("#totalCount");

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayValue(value) {
  return value
    ? escapeHTML(value)
    : "Not provided";
}

function getSafeWebsite(url) {
  if (!url) {
    return null;
  }

  try {
    const parsedURL = new URL(url);

    if (
      parsedURL.protocol !== "http:" &&
      parsedURL.protocol !== "https:"
    ) {
      return null;
    }

    return parsedURL.href;
  } catch {
    return null;
  }
}

function getCompanyDetails(profile, companyRecord) {
  return {
    profileId: profile.id,
    email: profile.email,
    accountStatus: profile.account_status,
    createdAt: profile.created_at,

    companyId: companyRecord?.id || null,
    companyName:
      companyRecord?.company_name ||
      profile.full_name ||
      "Unnamed company",

    industry: companyRecord?.industry,
    location: companyRecord?.location,
    website: companyRecord?.website,
    description: companyRecord?.description,
    contactName: companyRecord?.contact_name,
    contactEmail:
      companyRecord?.contact_email ||
      profile.email,
    companySize: companyRecord?.company_size,
    yearEstablished:
      companyRecord?.year_established,
    phoneNumber: companyRecord?.phone_number,
    contactPosition:
      companyRecord?.contact_position,
    registrationNumber:
      companyRecord?.registration_number,
    linkedinUrl: companyRecord?.linkedin_url,
    documentPath:
      companyRecord?.verification_document_url,
    submittedAt:
      companyRecord?.submitted_at ||
      profile.created_at,
  };
}

async function fetchCompanyApplications() {
  const {
    data: profiles,
    error: profilesError,
  } = await supabaseClient
    .from("profiles")
    .select(
      "id, full_name, email, account_status, created_at"
    )
    .eq("role", "company")
    .order("created_at", {
      ascending: false,
    });

  if (profilesError) {
    throw profilesError;
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  const profileIds = profiles.map(
    (profile) => profile.id
  );

  const {
    data: companyRecords,
    error: companiesError,
  } = await supabaseClient
    .from("companies")
    .select(`
      id,
      profile_id,
      company_name,
      industry,
      location,
      website,
      description,
      contact_name,
      contact_email,
      company_size,
      year_established,
      phone_number,
      contact_position,
      registration_number,
      linkedin_url,
      verification_document_url,
      submitted_at,
      approval_status
    `)
    .in("profile_id", profileIds);

  if (companiesError) {
    throw companiesError;
  }

  const companyMap = new Map();

  (companyRecords || []).forEach((company) => {
    companyMap.set(
      company.profile_id,
      company
    );
  });

  return profiles.map((profile) =>
    getCompanyDetails(
      profile,
      companyMap.get(profile.id)
    )
  );
}

function renderCompanyCard(company) {
  const companyInitial = company.companyName
    .charAt(0)
    .toUpperCase();

  const website = getSafeWebsite(
    company.website
  );

  const linkedin = getSafeWebsite(
    company.linkedinUrl
  );

  return `
    <article class="company-review-card">
      <header class="company-review-header">
        <div class="company-review-identity">
          <div class="job-icon">
            ${escapeHTML(companyInitial)}
          </div>

          <div>
            <span class="status review">
              Pending verification
            </span>

            <h2>
              ${escapeHTML(company.companyName)}
            </h2>

            <p>
              ${displayValue(company.industry)}
              ·
              ${displayValue(company.location)}
            </p>
          </div>
        </div>

        <div class="submitted-date">
          <span>Submitted</span>
          <strong>
            ${new Date(
              company.submittedAt
            ).toLocaleDateString()}
          </strong>
        </div>
      </header>

      <div class="company-review-grid">
        <section>
          <h3>Company background</h3>

          <dl class="verification-details">
            <div>
              <dt>Company size</dt>
              <dd>
                ${displayValue(company.companySize)}
              </dd>
            </div>

            <div>
              <dt>Year established</dt>
              <dd>
                ${displayValue(
                  company.yearEstablished
                )}
              </dd>
            </div>

            <div>
              <dt>Registration number</dt>
              <dd>
                ${displayValue(
                  company.registrationNumber
                )}
              </dd>
            </div>

            <div>
              <dt>Website</dt>
              <dd>
                ${
                  website
                    ? `
                      <a
                        href="${escapeHTML(website)}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Visit website
                      </a>
                    `
                    : "Not provided"
                }
              </dd>
            </div>

            <div>
              <dt>LinkedIn / social page</dt>
              <dd>
                ${
                  linkedin
                    ? `
                      <a
                        href="${escapeHTML(linkedin)}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open page
                      </a>
                    `
                    : "Not provided"
                }
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3>Company representative</h3>

          <dl class="verification-details">
            <div>
              <dt>Contact name</dt>
              <dd>
                ${displayValue(company.contactName)}
              </dd>
            </div>

            <div>
              <dt>Position</dt>
              <dd>
                ${displayValue(
                  company.contactPosition
                )}
              </dd>
            </div>

            <div>
              <dt>Email</dt>
              <dd>
                ${displayValue(
                  company.contactEmail
                )}
              </dd>
            </div>

            <div>
              <dt>Phone</dt>
              <dd>
                ${displayValue(
                  company.phoneNumber
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="company-description-review">
        <h3>About the company</h3>
        <p>
          ${displayValue(company.description)}
        </p>
      </section>

      <footer class="company-review-actions">
        <div>
          ${
            company.documentPath
              ? `
                <button
                  class="secondary-btn"
                  type="button"
                  data-document="${encodeURIComponent(
                    company.documentPath
                  )}"
                >
                  View verification document
                </button>
              `
              : `
                <span class="missing-document">
                  No verification document
                </span>
              `
          }
        </div>

        <div class="card-actions">
  <button
    class="danger-btn"
    type="button"
    data-reject="${company.profileId}"
    data-company-id="${company.companyId || ""}"
  >
    Reject
  </button>

  <button
    class="primary-btn"
    type="button"
    data-approve="${company.profileId}"
    data-company-id="${company.companyId || ""}"
  >
    Approve company
  </button>
</div>
      </footer>
    </article>
  `;
}

async function loadCompanies() {
  adminMessage.textContent =
    "Loading company applications...";

  try {
    const companies =
      await fetchCompanyApplications();

    const pending = companies.filter(
      (company) =>
        company.accountStatus === "pending"
    );

    const approved = companies.filter(
      (company) =>
        company.accountStatus === "approved"
    );

    const rejected = companies.filter(
      (company) =>
        company.accountStatus === "rejected"
    );

    pendingCount.textContent = pending.length;
    approvedCount.textContent =
      approved.length;
    rejectedCount.textContent =
      rejected.length;
    totalCount.textContent =
      companies.length;

    if (pending.length === 0) {
      companyList.innerHTML = `
        <div class="application-card empty-saved">
          <h2>No pending company applications</h2>
          <p class="muted-text">
            New company verification submissions
            will appear here.
          </p>
        </div>
      `;

      adminMessage.textContent = "";
      return;
    }

    companyList.innerHTML = pending
      .map(renderCompanyCard)
      .join("");

    adminMessage.textContent = "";
  } catch (error) {
    adminMessage.textContent =
      error.message ||
      "Could not load company applications.";
  }
}

async function updateCompanyStatus({
  profileId,
  companyId,
  profileStatus,
  companyStatus,
  notes = null,
}) {
  adminMessage.textContent =
    "Updating company status...";

  const {
    error: profileError,
  } = await supabaseClient
    .from("profiles")
    .update({
      account_status: profileStatus,
    })
    .eq("id", profileId);

  if (profileError) {
    throw profileError;
  }

  if (companyId) {
    const companyUpdate = {
      approval_status: companyStatus,
      updated_at: new Date().toISOString(),
    };

    if (notes !== null) {
      companyUpdate.verification_notes =
        notes;
    }

    if (profileStatus === "rejected") {
      companyUpdate.rejection_reason =
        notes;
    }

    const {
      error: companyError,
    } = await supabaseClient
      .from("companies")
      .update(companyUpdate)
      .eq("id", companyId);

    if (companyError) {
      throw companyError;
    }
  }

  await loadCompanies();
}

async function openVerificationDocument(path) {
  adminMessage.textContent =
    "Opening verification document...";

  const {
    data,
    error,
  } = await supabaseClient.storage
    .from("company-verification")
    .createSignedUrl(path, 300);

  if (error) {
    throw error;
  }

  window.open(
    data.signedUrl,
    "_blank",
    "noopener,noreferrer"
  );

  adminMessage.textContent = "";
}

companyList.addEventListener(
  "click",
  async (event) => {
    const button = event.target.closest(
      "button"
    );

    if (!button) {
      return;
    }

    button.disabled = true;

    try {
      if (button.dataset.document) {
        await openVerificationDocument(
          decodeURIComponent(
            button.dataset.document
          )
        );

        return;
      }

      if (button.dataset.approve) {
        const confirmed = window.confirm(
          "Approve this company and allow it to access the company dashboard?"
        );

        if (!confirmed) {
          return;
        }

        await updateCompanyStatus({
          profileId: button.dataset.approve,
          companyId:
            button.dataset.companyId,
          profileStatus: "approved",
          companyStatus: "Approved",
          notes:
            "Company verification approved.",
        });
      }

      if (button.dataset.reject) {
        const confirmed = window.confirm(
          "Reject this company and block access to the company dashboard?"
        );
      
        if (!confirmed) {
          return;
        }
      
        await updateCompanyStatus({
          profileId: button.dataset.reject,
          companyId: button.dataset.companyId,
          profileStatus: "rejected",
          companyStatus: "Rejected",
        });
      }

    } catch (error) {
      adminMessage.textContent =
        error.message ||
        "The admin action could not be completed.";
    } finally {
      button.disabled = false;
    }
  }
);

async function initializeAdminPage() {
  const adminProfile =
    await protectPage("admin");

  if (!adminProfile) {
    return;
  }

  await loadCompanies();
}

initializeAdminPage();