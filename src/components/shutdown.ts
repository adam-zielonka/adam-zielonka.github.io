export function Shutdown() {
  const div = document.createElement("div");
  div.className = "Shutdown";
  div.innerHTML = `<p>
    It's now safe to turn off<br />your computer.
  </p>`;
  return div;
}
