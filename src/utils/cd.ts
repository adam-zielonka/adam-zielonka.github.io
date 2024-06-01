export function cd(dir: string, newDir: string): string {
  console.log(dir, newDir);
  switch (newDir) {
    case "/":
      return "/";
    case "~":
      return "~";
    case ".":
      return dir;
    case "":
      return dir;
    case "..":
      return dir.split("/").slice(0, -1).join("/") || "/";
    default: 
      return (newDir.startsWith("/") ? newDir : `${dir}/${newDir}`)
        .replace(/\/+/g, "/")  
        .replace(/^\/root/, "~");
  }
}
