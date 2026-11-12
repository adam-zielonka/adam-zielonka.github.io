import flag from "../assets/windows-flag.svg";

/** Shared artwork for the Windows-style startup and shutdown screens. */
export function windowsSplash(mode: "startup" | "shutdown") {
  const starting = mode === "startup";
  return `<section class="WindowsSplash">
    <div class="WindowsSplashArtwork">
      <img class="WindowsFlag" src="${flag}" alt="" draggable="false">
      <strong class="WindowsBrand">Portfolio<span>98</span></strong>
    </div>
    ${starting ? '<div class="WindowsProgress" aria-hidden="true"></div>' : '<p class="WindowsShutdownMessage">Portfolio98 is shutting down.</p>'}
  </section>`;
}
