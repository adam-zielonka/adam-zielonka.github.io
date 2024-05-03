import { Terminal } from "../main";

export declare global {
  interface Window {
    store: Store
    terminal: Terminal
  }
}
