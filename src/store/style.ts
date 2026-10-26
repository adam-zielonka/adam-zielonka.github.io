import { isFontExist } from "../utils/font";
import { escape } from "../utils/escape";

export class Style {
  set(font: string): string[] {
    if (!isFontExist(font) && font) {
      return [`Font <b>“${escape(font)}”</b> is not installed.`];
    }

    window.terminal.font(
      `${font ? font + ", " : ""}"Courier New", Courier, monospace`,
    );
    return [];
  }
}
