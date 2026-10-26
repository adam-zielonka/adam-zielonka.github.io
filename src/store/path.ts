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
        `<span class="Error">cd: nie ma katalogu „${escape(newDir)}”.</span> Wpisz <code>ls</code>, aby zobaczyć dostępne katalogi.`,
      ];
    this.value = next;
    return [];
  }
}
