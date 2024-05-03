import { isFontExist } from "../utils/font";

export class Style {
  set(font: string): string[] {
    if (!isFontExist(font) && font) {
      return [`Font family <b>'${font}'</b> is not installed`];
    }

    window.terminal.font(`${font ? font + ", " : ""}"Courier New", Courier, monospace`);
    return [];
  }
}
