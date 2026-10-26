export function Shutdown() {
  const div = document.createElement("div");
  div.className = "Shutdown";
  div.innerHTML =
    '<p>Session ended.<br />See you in the next project.</p><a href="">Restart terminal →</a>';
  return div;
}
