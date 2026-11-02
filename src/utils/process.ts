import { store } from "../store/store";
import { parseArgs } from "./args";
import {
  renderHome,
  renderProjects,
  renderProject,
  renderAbout,
  renderContact,
  renderDirectory,
  renderCat,
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
            const output =
              typeof systemLine === "string"
                ? { value: systemLine }
                : systemLine;
            await store.output.processLine(
              { value: output.value, style },
              "animate" in output && output.animate,
            );
            if ("pause" in output) await store.system.wait(output.pause);
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

type SystemOutput = string | { value: string; animate: boolean; pause: number };

function system(sysCommand: string, args: string[]): SystemOutput[] {
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
    case "cd": {
      const result = store.path.cd(args.join(" "));
      return result.length
        ? [
            ...result,
            { value: "There is nothing.", animate: true, pause: 500 },
            {
              value: "Only warm, primordial blackness.",
              animate: true,
              pause: 500,
            },
          ]
        : result;
    }
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
    case "cat":
      return renderCat(store.path.value, args);
    default:
      return [];
  }
}
