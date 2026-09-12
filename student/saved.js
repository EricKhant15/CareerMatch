const savedPageState = {
  listings: [],
  companies: new Map(),
};

function savedElement(id) {
  return document.getElementById(id);
}

function setSavedMessage(message, type = "info") {
  const colors = { error: "#d92d3e", success: "#169c4b", info: "#7224e8" };
  const element = savedElement("savedMessage");
  element.textContent = message;
  element.style.color = colors[type] || colors.info;
}

function createSavedDetail(label, value) {
  const item = document.createElement("li");
  const name = document.createElement("span");
  name.textContent = label;
  const content = document.createElement("strong");
  content.textContent = value || "Not set";
  item.append(name, content);
  return item;
}

function removeSavedListing(listingId) {
  const nextIds = getSavedInternships().filter((id) => id !== listingId);
  setSavedInternships(nextIds);
  savedPageState.listings = savedPageState.listings.filter((item) => item.id !== listingId);
  renderSavedListings();
  setSavedMessage("Internship removed from Saved.", "success");
}

function createSavedListingCard(listing) {
  const company = savedPageState.companies.get(listing.company_id);
  const companyName = company?.company_name || "Company";
  const card = document.createElement("article");
  card.className = "intern-card";
  const removeButton = document.createElement("button");
  removeButton.className = "heart-btn saved";
  removeButton.type = "button";
  removeButton.textContent = "♥";
  removeButton.setAttribute("aria-label", `Remove ${listing.title} from saved internships`);
  removeButton.addEventListener("click", () => removeSavedListing(listing.id));
  const image = document.createElement("div");
  image.className = "company-image";
  image.textContent = companyName;
  const body = document.createElement("div");
  body.className = "intern-body";
  const title = document.createElement("h3");
  title.textContent = `${companyName} (${listing.title})`;
  const details = document.createElement("ul");
  details.className = "detail-list";
  details.append(
    createSavedDetail("Location", listing.location),
    createSavedDetail("Duration", listing.duration),
    createSavedDetail("Allowance", listing.allowance),
    createSavedDetail("Mode", listing.work_mode),
    createSavedDetail("Status", listing.status)
  );
  const link = document.createElement("a");
  link.className = "primary-btn";
  link.href = `google-details.html?listing_id=${encodeURIComponent(listing.id)}`;
  link.textContent = "See Details";
  body.append(title, details, link);
  card.append(removeButton, image, body);
  return card;
}

function renderSavedListings() {
  const container = savedElement("savedInternships");
  container.replaceChildren();
  container.setAttribute("aria-busy", "false");
  if (!savedPageState.listings.length) {
    const empty = document.createElement("article");
    empty.className = "panel empty-saved";
    const title = document.createElement("h2");
    title.textContent = "No saved internships yet";
    const message = document.createElement("p");
    message.textContent = "Use the heart button on Recommended internships to save them here.";
    const link = document.createElement("a");
    link.className = "primary-btn";
    link.href = "matches.html";
    link.textContent = "Browse Recommendations";
    empty.append(title, message, link);
    container.appendChild(empty);
    return;
  }
  savedPageState.listings.forEach((listing) => {
    container.appendChild(createSavedListingCard(listing));
  });
}

async function loadSavedListings() {
  const ids = getSavedInternships().filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
  if (!ids.length) return;
  const { data: listings, error: listingsError } = await supabaseClient
    .from("internship_listings")
    .select("id, company_id, title, location, duration, allowance, work_mode, status")
    .in("id", ids);
  if (listingsError) throw listingsError;
  savedPageState.listings = listings || [];
  const companyIds = [...new Set(savedPageState.listings.map((item) => item.company_id).filter(Boolean))];
  if (!companyIds.length) return;
  const { data: companies, error: companiesError } = await supabaseClient
    .from("companies")
    .select("id, company_name")
    .in("id", companyIds);
  if (companiesError) throw companiesError;
  savedPageState.companies = new Map((companies || []).map((item) => [item.id, item]));
}

async function setupSavedPage() {
  try {
    const account = await protectPage("student");
    if (!account) return;
    const profile = await loadStudentProfileFromSupabase();
    const name = profile.name || "Student";
    savedElement("studentName").textContent = name;
    savedElement("studentAvatar").textContent = name.charAt(0).toUpperCase();
    await loadSavedListings();
    renderSavedListings();
  } catch (error) {
    console.error(error);
    savedElement("savedInternships").setAttribute("aria-busy", "false");
    setSavedMessage(error.message || "Saved internships could not be loaded.", "error");
  }
}

document.addEventListener("DOMContentLoaded", setupSavedPage);
