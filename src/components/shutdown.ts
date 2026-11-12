import { windowsSplash } from "./windows-splash";

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
    <div class="ShutdownDesktop" aria-hidden="true"></div>
    ${windowsSplash("shutdown")}`;
  return div;
}
