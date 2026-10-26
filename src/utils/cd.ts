export function cd(dir: string, newDir: string): string {
  const expand = (path: string) => path.replace(/^~(?=\/|$)/, "/root");
  const target = expand(newDir || "~");
  const absolute = target.startsWith("/") ? target : `${expand(dir)}/${target}`;
  const segments: string[] = [];
  for (const segment of absolute.split("/")) {
    if (segment === "..") segments.pop();
    else if (segment && segment !== ".") segments.push(segment);
  }
  return `/${segments.join("/")}`.replace(/^\/root(?=\/|$)/, "~");
}
