import logo from "../assets/portfolio98-logo.png";

/** Shared artwork for the Windows-style startup and shutdown screens. */
export function windowsSplash(mode: "startup" | "shutdown") {
  const starting = mode === "startup";
  return `<section class="WindowsSplash">
    <div class="WindowsSplashArtwork">
      <img class="PortfolioLogo" src="${logo}" alt="" draggable="false" width="1448" height="1086">
      <strong class="WindowsBrand">Portfolio<span>98</span></strong>
    </div>
    ${starting ? '<div class="WindowsProgress" aria-hidden="true"></div>' : '<p class="WindowsShutdownMessage">Portfolio98 is shutting down.</p>'}
  </section>`;
}
