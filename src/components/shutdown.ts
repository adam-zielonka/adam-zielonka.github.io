import { windowsSplash } from "./windows-splash";
import { windowsIcon } from "../data/windows-icons";

export function Shutdown() {
  const div = document.createElement("div");
  div.className = "Shutdown";
  div.innerHTML =
    '<h2 id="experience-title">It\'s now safe to turn off<br />your computer.</h2>';
  return div;
}

export function ShutdownAnimation() {
  const div = document.createElement("div");
  div.className = "ShutdownTransition";
  div.innerHTML = `
    <section class="ShutdownDesktop">
      <div class="ShutdownPanel">
        <header>Shut Down Portfolio 98</header>
        <div>${windowsIcon("shutdown")}<p>Please wait while your computer<br>shuts down.</p></div>
      </div>
    </section>
    ${windowsSplash("shutdown")}
    <span class="WindowsSkip">Esc · skip animation</span>`;
  return div;
}
