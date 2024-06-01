type Prefix = {
  path?: string
}

export function LinePrefix({path = "~"}: Prefix = {}) {
  const span = document.createElement("span");
  span.className = "LinePrefix";

  span.innerHTML = ""
    + `<span class="path">${path}</span>` 
    + "&nbsp;"
    + "<span class=\"user\">&gt;</span>"
    + "&nbsp;";

  return span;
}
