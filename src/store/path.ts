import { cd } from "../utils/cd";

export class Path {
  value = "~";
  
  get pwd(): string {
    return this.value.replace(/^~/, "/root");
  }

  cd(newDir: string): void {
    this.value = cd(this.value, newDir);
  }
}
