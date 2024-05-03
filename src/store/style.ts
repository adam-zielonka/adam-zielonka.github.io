import { isFontExist } from "../utils/font";

export class Style {
  font = "";

  set(font: string): string[] {
    if (!isFontExist(font) && font) {
      return [`Font family <b>'${font}'</b> is not installed`];
    }

    this.font = `${font ? font + ", " : ""}"Courier New", Courier, monospace`;
    return [];
  }
}
