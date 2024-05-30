type Prefix = {
  user?: string,
  domain?: string,
  path?: string
}

export function LinePrefix({user = "root", domain = "adam-zielonka", path = "~"}: Prefix = {}) {
  const span = document.createElement("span");
  span.className = "LinePrefix";

  span.innerHTML 
    = `<span class="user">${user}@${domain}</span>`
    + `<span class="path">${path}</span>` 
    + "# ";

  return span;
}
