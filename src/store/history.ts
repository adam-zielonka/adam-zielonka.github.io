import { escape, unescape } from "../utils/escape";

export class History {
  private history: string[] = [];
  private position = 0;
  private temporaryValue = "";

  get value(): string {
    return unescape(this.history[this.position] || this.temporaryValue);
  }

  get lastCommand(): string {
    return this.history[this.history.length - 1] || "";
  }

  set(value: string): void {
    this.position = this.history.length;
    this.temporaryValue = value;
  }

  add(): void {
    if (this.value && this.value !== this.history[this.history.length - 1]) {
      this.history.push(escape(this.value));
    }
    this.set("");
  }

  up(): void {
    this.position - 1 >= 0 && --this.position;
  }

  down(): void {
    this.position + 1 <= this.history.length && ++this.position;
  }
}
