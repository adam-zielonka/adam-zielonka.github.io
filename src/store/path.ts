import { cd } from "../utils/cd";
import { projects } from "../data/projects";
import { escape } from "../utils/escape";

export class Path {
  value = "~";

  get pwd(): string {
    return this.value.replace(/^~/, "/root");
  }

  cd(newDir: string): string[] {
    const next = cd(this.value, newDir);
    const directories = [
      "/",
      "~",
      "~/projects",
      ...projects.map(project => `~/projects/${project.id}`),
    ];
    if (!directories.includes(next))
      return [
        `<span class="Error">cd: no such directory: “${escape(newDir)}”.</span> Type <code>ls</code> to see available directories.`,
      ];
    this.value = next;
    return [];
  }
}
