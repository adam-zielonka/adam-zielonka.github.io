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
          if (action.key === "shutdown-start" && !window.terminal.isWindows) {
            // The terminal keeps its text-only shutdown. Only the desktop
            // continues through the graphical shutdown actions below.
            await store.system.wait(50);
            if (!store.system.isProcessing) return;
            await store.output.processLine({ value: "Wait ...", style });
            await store.system.wait(1000);
            if (store.system.isProcessing) store.system.setShutdown();
            return;
          }
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
    case "shutdown-start":
      window.terminal.enterShutdownAnimation();
      return [];
    case "shutdown-splash":
      window.terminal.showShutdownSplash();
      return [];
    case "shutdown":
      store.system.setShutdown();
      return [];
    case "windows-startup":
      window.terminal.enterWindowsStartup();
      return [];
    case "windows":
      window.terminal.enterWindows();
      return [];
    case "matrix":
      window.terminal.enterMatrix();
      return [];
    case "boot":
      window.terminal.enterBoot();
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
