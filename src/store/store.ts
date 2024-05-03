import { Commands } from "./commands";
import { Completion } from "./completion";
import { History } from "./history";
import { Output } from "./output";
import { Path } from "./path";
import { Style } from "./style";
import { System } from "./system";

export class Store {
  commands = new Commands();
  completion = new Completion();
  history = new History();
  output = new Output();
  path = new Path();
  style = new Style();
  system = new System();
}

export const store = window.store = new Store();
void store.system.start(["whoami"]);
