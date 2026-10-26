export function Shutdown() {
  const div = document.createElement("div");
  div.className = "Shutdown";
  div.innerHTML =
    '<h2 id="experience-title">It\'s now safe to turn off<br />your computer.</h2><button type="button" class="ExperienceRestart">Restart terminal</button>';
  div
    .querySelector("button")!
    .addEventListener("click", () => window.location.reload());
  return div;
}
