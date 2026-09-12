const careerMatchNotificationState = {
  items: [],
  profileRole: null,
};

const careerMatchIdentityKey = "careermatchAccountIdentity";

function applyCareerMatchIdentity(identity) {
  if (!identity?.name || !identity?.role) return;
  const expectedRole = window.location.pathname.includes("/company/")
    ? "company"
    : window.location.pathname.includes("/student/") ? "student" : null;
  if (expectedRole && identity.role !== expectedRole) return;
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  const nameElement = sidebar.querySelector(".user-card strong");
  const avatar = sidebar.querySelector(".user-card .avatar");
  if (nameElement) nameElement.textContent = identity.name;
  if (avatar) avatar.textContent = identity.name.charAt(0).toUpperCase();
}

function applyCachedCareerMatchIdentity() {
  try {
    applyCareerMatchIdentity(JSON.parse(localStorage.getItem(careerMatchIdentityKey) || "null"));
  } catch (error) {
    console.error("Saved account identity could not be read:", error);
  }
}

function formatBellNotificationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getNotificationDestination() {
  return careerMatchNotificationState.profileRole === "company"
    ? "approved.html"
    : "applications.html";
}

function renderNotificationBell() {
  const list = document.getElementById("notificationBellList");
  const count = document.getElementById("notificationUnreadCount");
  if (!list || !count) return;

  const unreadCount = careerMatchNotificationState.items.filter((item) => !item.is_read).length;
  count.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  count.hidden = unreadCount === 0;
  list.replaceChildren();

  if (!careerMatchNotificationState.items.length) {
    const empty = document.createElement("p");
    empty.className = "notification-bell-empty";
    empty.textContent = "No notifications yet.";
    list.appendChild(empty);
    return;
  }

  careerMatchNotificationState.items.forEach((notification) => {
    const item = document.createElement("a");
    item.className = `notification-bell-item${notification.is_read ? "" : " unread"}`;
    item.href = getNotificationDestination();
    item.addEventListener("click", async (event) => {
      if (notification.is_read) return;
      event.preventDefault();
      const destination = item.href;
      const { error } = await supabaseClient
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);
      if (error) console.error("Notification could not be marked as read:", error);
      window.location.href = destination;
    });
    const title = document.createElement("strong");
    title.textContent = notification.title;
    const message = document.createElement("span");
    message.textContent = notification.message;
    const date = document.createElement("small");
    date.textContent = formatBellNotificationDate(notification.created_at);
    item.append(title, message, date);
    list.appendChild(item);
  });
}

async function markBellNotificationsRead() {
  const unreadIds = careerMatchNotificationState.items
    .filter((item) => !item.is_read)
    .map((item) => item.id);
  if (!unreadIds.length) return;

  const { error } = await supabaseClient
    .from("notifications")
    .update({ is_read: true })
    .in("id", unreadIds);
  if (error) {
    console.error("Notifications could not be marked as read:", error);
    return;
  }
  careerMatchNotificationState.items.forEach((item) => {
    item.is_read = true;
  });
  renderNotificationBell();
}

function createNotificationBell() {
  const pageHeader = document.querySelector(".main .page-header");
  if (!pageHeader || document.getElementById("notificationBellButton")) return;

  let headerActions = pageHeader.querySelector(":scope > .page-header-actions");
  if (!headerActions) {
    headerActions = document.createElement("div");
    headerActions.className = "page-header-actions";
    [...pageHeader.children].slice(1).forEach((child) => headerActions.appendChild(child));
    pageHeader.appendChild(headerActions);
  }

  const wrapper = document.createElement("div");
  wrapper.className = "notification-bell-wrapper";
  wrapper.innerHTML = `
    <button class="notification-bell-button" id="notificationBellButton" type="button" aria-label="Open notifications" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      <span class="notification-unread-count" id="notificationUnreadCount" hidden>0</span>
    </button>
    <section class="notification-bell-menu" id="notificationBellMenu" hidden>
      <div class="notification-bell-heading">
        <h2>Notifications</h2>
        <button type="button" id="markBellNotificationsRead">Mark all read</button>
      </div>
      <div class="notification-bell-list" id="notificationBellList"></div>
    </section>
  `;
  headerActions.appendChild(wrapper);

  const button = document.getElementById("notificationBellButton");
  const menu = document.getElementById("notificationBellMenu");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
  });
  menu.addEventListener("click", (event) => event.stopPropagation());
  document.getElementById("markBellNotificationsRead").addEventListener("click", markBellNotificationsRead);
  document.addEventListener("click", () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
}

async function setupNotificationBell() {
  if (typeof supabaseClient === "undefined") return;
  createNotificationBell();
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) return;

  const [{ data: profile }, { data: notifications, error }] = await Promise.all([
    supabaseClient.from("profiles").select("role, full_name").eq("id", userData.user.id).maybeSingle(),
    supabaseClient
      .from("notifications")
      .select("id, listing_id, notification_type, title, message, is_read, created_at")
      .eq("recipient_profile_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (error) {
    console.error("Notifications could not be loaded:", error);
    return;
  }
  careerMatchNotificationState.profileRole = profile?.role || null;
  let accountName = profile?.full_name || (profile?.role === "company" ? "Company" : "Student");
  if (profile?.role === "company") {
    const { data: company } = await supabaseClient
      .from("companies")
      .select("company_name")
      .eq("profile_id", userData.user.id)
      .maybeSingle();
    accountName = company?.company_name || accountName;
  }
  const identity = { userId: userData.user.id, role: profile?.role, name: accountName };
  localStorage.setItem(careerMatchIdentityKey, JSON.stringify(identity));
  applyCareerMatchIdentity(identity);
  careerMatchNotificationState.items = notifications || [];
  renderNotificationBell();
}

applyCachedCareerMatchIdentity();
document.addEventListener("DOMContentLoaded", setupNotificationBell);
