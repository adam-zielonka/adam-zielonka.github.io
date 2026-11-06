// Measure the real rows, including wrapping and ASCII art, in their shuffled order.
export function fitHomeProjects(home: HTMLElement, viewport: HTMLElement) {
  if (home.hasAttribute("data-interrupted")) return;
  const rows = [...home.querySelectorAll<HTMLElement>(".ProjectRow")];
  for (const row of rows) row.hidden = false;

  // Restore all candidates before measuring an auto-height terminal's capacity.
  // A hidden/unlaid-out viewport will be measured when ResizeObserver fires.
  if (!viewport.clientHeight) return;
  const heights = rows.map(row => row.getBoundingClientRect().height);
  const style = getComputedStyle(viewport);
  const command = home.closest(".Line")?.previousElementSibling;
  let commandHeight = 0;
  if (command instanceof HTMLElement && command.matches(".CommandLine")) {
    const commandStyle = getComputedStyle(command);
    commandHeight =
      command.getBoundingClientRect().height +
      parseFloat(commandStyle.marginTop || "0") +
      parseFloat(commandStyle.marginBottom || "0");
  }
  const fixedHeight =
    home.getBoundingClientRect().height -
    heights.reduce((sum, height) => sum + height, 0) +
    commandHeight +
    parseFloat(style.paddingTop || "0") +
    parseFloat(style.paddingBottom || "0");
  const available = viewport.clientHeight - fixedHeight;
  let used = 0;
  let count = 0;
  for (const height of heights) {
    // Keep one useful entry on screens too short for the intro plus a whole row.
    if (count > 0 && used + height > available) break;
    used += height;
    count++;
  }
  rows.forEach((row, index) => {
    row.hidden = index >= count;
  });
  updateHomeCount(home);
}

export function updateHomeCount(home: HTMLElement) {
  const count = home.querySelector(".Count");
  if (count)
    count.textContent = String(
      home.querySelectorAll(".ProjectRow:not([hidden])").length,
    ).padStart(2, "0");
}
