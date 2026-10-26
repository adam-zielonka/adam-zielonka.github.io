import { store } from "../store/store";
import { parseArgs } from "./args";
import {
  renderHome,
  renderProjects,
  renderProject,
  renderAbout,
  renderContact,
  renderDirectory,
} from "./portfolio";

export async function process(commandArgs: string): Promise<void> {
  const [command, ...args] = parseArgs(commandArgs);
  if (!command) {
    return;
  }
  store.output.context = { command, args, pwd: store.path.pwd };

  const style: Partial<CSSStyleDeclaration> = {};

  main: for (const line of store.commands.getLines(command)) {
    let animate = false;

    if (!store.system.isProcessing) return;

    for (const action of line.actions) {
      switch (action.namespace) {
        case "sleep":
          await store.system.wait(+action.key);
          continue;
        case "system":
          if (!store.system.isProcessing) return;
          for (const systemLine of system(action.key, args)) {
            await store.output.processLine({ value: systemLine, style });
          }
          continue;
        case "ui":
          if (action.key === "hide") continue main;
          if (action.key === "animate") animate = true;
          continue;
        case "css": {
          Object.assign(style, css(action.key, action.value));
          continue;
        }
      }
    }

    if (line.value)
      await store.output.processLine({ value: line.value, style }, animate);
  }
}

function css(key: string, value: string): Partial<CSSStyleDeclaration> {
  const newKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
  return { [newKey]: value };
}

function system(sysCommand: string, args: string[]): string[] {
  switch (sysCommand) {
    case "clear":
      store.output.clear();
      return [];
    case "shutdown":
      store.system.setShutdown();
      return [];
    case "matrix":
      window.terminal.enterMatrix();
      return [];
    case "freeze":
      store.system.setFreeze();
      return [];
    case "font":
      return store.style.set(args.join(" "));
    case "cd":
      return store.path.cd(args.join(" "));
    case "help":
      return store.commands.helpLines;
    case "home":
      return [renderHome()];
    case "projects":
      return [renderProjects()];
    case "project":
      return args.length ? [renderProject(args.join(" "))] : [renderProjects()];
    case "about":
      return [renderAbout()];
    case "contact":
      return [renderContact()];
    case "ls":
      return [renderDirectory(store.path.value)];
    default:
      return [];
  }
}
