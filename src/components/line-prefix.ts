type Prefix = { path?: string };

export function LinePrefix({ path = "~" }: Prefix = {}) {
  const span = document.createElement("span");
  span.className = "LinePrefix";
  const directory = document.createElement("span");
  directory.className = "path";
  directory.textContent = path;
  const arrow = document.createElement("span");
  arrow.className = "user";
  arrow.textContent = "❯";
  arrow.setAttribute("aria-hidden", "true");
  span.append(directory, " ", arrow, " ");
  return span;
}
