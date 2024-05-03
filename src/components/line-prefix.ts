type Prefix = {
  user?: string,
  domain?: string,
  path?: string
}

export function LinePrefix({user = "root", domain = "adamzielonka.pro", path = "~"}: Prefix = {}) {
  const prefixSpan = document.createElement("span");
  prefixSpan.className = "LinePrefix";

  const userSpan = document.createElement("span");
  userSpan.className = "user";
  userSpan.innerHTML = `${user}@${domain}`;
  prefixSpan.appendChild(userSpan);

  const pathSpan = document.createElement("span");
  pathSpan.className = "path";
  pathSpan.innerHTML = path;
  prefixSpan.appendChild(pathSpan);
  
  prefixSpan.append("# ");

  return prefixSpan;
}
