import { windowsIcon } from "../data/windows-icons";

/** Shared artwork for the Windows-style startup and shutdown screens. */
export function windowsSplash(mode: "startup" | "shutdown") {
  const starting = mode === "startup";
  return `<section class="WindowsSplash">
    <div class="WindowsBrand">${windowsIcon("start")}<div><span>Portfolio edition</span><strong>Portfolio<span>98</span></strong></div></div>
    <h2>${starting ? "Starting Portfolio 98…" : "Portfolio 98 is shutting down…"}</h2>
    <p>${starting ? "Getting your desktop ready." : "Please wait."}</p>
    <div class="WindowsProgress" aria-hidden="true"><i></i></div>
  </section>`;
}
