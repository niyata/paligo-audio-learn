/**
 * Renders home grid from PaligoNavConfig.menu (single source of truth).
 */
(function () {
  const CHEVRON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function getIcon(name) {
    return window.PaligoSidebar?.getIcon?.(name) || "";
  }

  function renderHome() {
    const config = window.PaligoNavConfig;
    const root = document.getElementById("paligo-home-sections");
    if (!config?.menu || !root) return;

    const brand = config.brand || {};
    const titleEl = document.querySelector(".paligo-home__title");
    const taglineEl = document.querySelector(".paligo-home__tagline");
    if (titleEl && brand.title) titleEl.textContent = brand.title;
    if (taglineEl && brand.subtitle) {
      taglineEl.textContent = brand.subtitle || "เรียนบาลีออนไลน์";
    }

    const sorted = [...config.menu].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const fragment = document.createDocumentFragment();

    sorted.forEach((section) => {
      const sectionEl = document.createElement("section");
      sectionEl.className = "paligo-home__section";
      sectionEl.setAttribute("aria-labelledby", `home-section-${section.id}`);

      const header = document.createElement("div");
      header.className = "paligo-home__section-header";
      header.innerHTML = `
        <span class="paligo-home__section-icon" aria-hidden="true">${getIcon(section.icon)}</span>
        <div>
          <h2 class="paligo-home__section-title" id="home-section-${section.id}">${section.label}</h2>
          <p class="paligo-home__section-caption">${section.children.length} รายการ</p>
        </div>`;

      const grid = document.createElement("div");
      grid.className = "paligo-home__grid";
      grid.setAttribute("role", "list");

      section.children.forEach((item) => {
        const tile = document.createElement("a");
        tile.className = "paligo-home__tile";
        tile.href = item.href;
        tile.setAttribute("role", "listitem");
        tile.innerHTML = `
          <span class="paligo-home__tile-body">
            <span class="paligo-home__tile-title">${item.label}</span>
            <span class="paligo-home__tile-desc">${item.description || ""}</span>
          </span>
          <span class="paligo-home__tile-chevron" aria-hidden="true">${CHEVRON}</span>`;
        grid.appendChild(tile);
      });

      sectionEl.append(header, grid);
      fragment.appendChild(sectionEl);
    });

    root.replaceChildren(fragment);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHome);
  } else {
    renderHome();
  }
})();
