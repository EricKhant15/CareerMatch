const landingMenuButton = document.querySelector(".landing-menu-button");
const landingNavigation = document.querySelector(".landing-navigation");

landingMenuButton?.addEventListener("click", () => {
  const isOpen = landingMenuButton.getAttribute("aria-expanded") === "true";
  landingMenuButton.setAttribute("aria-expanded", String(!isOpen));
  landingNavigation?.classList.toggle("is-open", !isOpen);
});

landingNavigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    landingMenuButton?.setAttribute("aria-expanded", "false");
    landingNavigation.classList.remove("is-open");
  });
});

const landingYear = document.getElementById("landingYear");
if (landingYear) landingYear.textContent = String(new Date().getFullYear());
