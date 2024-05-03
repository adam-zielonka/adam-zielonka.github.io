export function Shutdown() {
  const div = document.createElement("div");
  div.className = "Shutdown";

  const p = document.createElement("p");
  p.innerHTML = "It's now safe to turn off<br />your computer.";
  div.appendChild(p);

  return div;
}
