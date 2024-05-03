import { Store } from "../store/store";
import { Terminal } from "../terminal";

export declare global {
  interface Window {
    store: Store
    terminal: Terminal
  }
}
