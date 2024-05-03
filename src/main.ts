document.querySelector("#noscript")?.remove();

import.meta.glob("./styles/*.scss", { eager: true });

import "./terminal";
import { store } from "./store/store";
void store.system.start(["whoami"]);
