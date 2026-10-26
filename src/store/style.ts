import { isFontExist } from "../utils/font";
import { escape } from "../utils/escape";

export class Style {
  set(font: string): string[] {
    if (!isFontExist(font) && font) {
      return [`Czcionka <b>„${escape(font)}”</b> nie jest zainstalowana.`];
    }

    window.terminal.font(
      `${font ? font + ", " : ""}"Courier New", Courier, monospace`,
    );
    return [];
  }
}
