import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import type { Store } from "../store/store";
import { History } from "../store/history";

let store: Store;
const output = () => document.querySelector(".TerminalOutput")!;
const input = () =>
  document.querySelector<HTMLInputElement>('input[name="command"]')!;
const enter = async (text: string) => {
  input().value = text;
  input().dispatchEvent(new Event("input", { bubbles: true }));
  input().form!.dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
  await vi.waitFor(() => expect(store.system.state).toBe(""));
};

beforeAll(async () => {
  document.body.innerHTML =
    '<button data-toggle-motion></button><button data-skip-animation hidden></button><nav class="SiteNav"><a href="#about" data-command="about">About</a></nav><div id="root"></div><p id="command-status"></p>';
  localStorage.setItem("portfolio-animations", "false");
  await import("../main");
  store = window.store;
  await vi.waitFor(() => expect(store.system.state).toBe(""));
});

beforeEach(() => {
  store.system.animations = false;
  store.history = new History();
  store.path.value = "~";
  window.terminal.clear();
  window.terminal.hideInput();
  window.terminal.showInput();
});
afterEach(async () => {
  if (store.system.isProcessing) await store.system.break();
  vi.useRealTimers();
  await vi.waitFor(() => expect(store.system.state).not.toBe("interrupted"));
});

describe("interactive terminal", () => {
  test("executes a typed command and renders HTML-like input as text", async () => {
    const text = '<img src=x onerror="alert(1)"> & $&';
    await enter(`echo '${text}'`);
    expect(output().querySelector("img")).toBeNull();
    expect(output().lastElementChild?.lastElementChild?.textContent).toBe(text);
    expect(store.history.lastCommand).toBe(`echo '${text}'`);
  });

  test("does not intercept Tab or Enter on a navigation link", () => {
    const link = document.querySelector<HTMLAnchorElement>(".SiteNav a")!;
    link.focus();
    for (const key of ["Tab", "Enter"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      expect(link.dispatchEvent(event)).toBe(true);
      expect(document.activeElement).toBe(link);
    }
  });

  test("lets an empty input and Shift+Tab leave the prompt", () => {
    input().focus();
    expect(
      input().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        }),
      ),
    ).toBe(true);
    input().value = "pro";
    input().dispatchEvent(new Event("input", { bubbles: true }));
    expect(
      input().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    ).toBe(true);
  });

  test("completes project names and executes them on Enter", async () => {
    input().value = "project ser";
    input().dispatchEvent(new Event("input", { bubbles: true }));
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    input().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(input().value).toBe("project server-status ");
    await enter(input().value);
    expect(output().querySelector(".ProjectDetail h2")?.textContent).toBe(
      "Server Status",
    );
    expect(location.hash).toBe("#project/server-status");
  });

  test("clicking a navigation shortcut opens its content", async () => {
    document.querySelector<HTMLAnchorElement>(".SiteNav a")!.click();
    await vi.waitFor(() => expect(store.system.state).toBe(""));
    expect(output().querySelector("h2")?.textContent).toContain(
      "I like understanding",
    );
    expect(
      document.querySelector(".SiteNav a")?.getAttribute("aria-current"),
    ).toBe("page");
  });

  test("unknown commands cannot resolve inherited object properties", async () => {
    await store.system.addCommand("__proto__");
    expect(output().textContent).toContain("not found");
    expect(document.getElementById("command-status")?.textContent).toContain(
      "Finished",
    );
  });

  test("navigates actual project directories and rejects unknown paths", async () => {
    await store.system.addCommand("cd projects");
    await store.system.addCommand("cd server-status");
    expect(store.path.value).toBe("~/projects/server-status");
    await store.system.addCommand("ls");
    expect(
      output().querySelector('[data-command="project server-status"]'),
    ).not.toBeNull();
    await store.system.addCommand("cd '<svg onload=alert(1)>'");
    expect(store.path.value).toBe("~/projects/server-status");
    expect(output().querySelector("svg")).toBeNull();
    expect(output().textContent).toContain("no such directory");
  });

  test("keeps literal entities and avoids duplicate history entries", async () => {
    await enter('echo "&amp; <b>text</b>"');
    await enter('echo "&amp; <b>text</b>"');
    store.history.up();
    expect(store.history.value).toBe('echo "&amp; <b>text</b>"');
    store.history.up();
    expect(store.history.value).toBe('echo "&amp; <b>text</b>"');
  });

  test("restores input focus after a keyboard submission", async () => {
    input().focus();
    await enter("ping");
    expect(document.activeElement).toBe(input());
  });

  test("preserves native copy when part of the input is selected", () => {
    input().value = "copy this text";
    input().focus();
    input().setSelectionRange(0, 4);
    const event = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    expect(input().dispatchEvent(event)).toBe(true);
    expect(input().value).toBe("copy this text");
  });

  test("cancels a running animation immediately and restores the input", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("matrix Neo", { focus: true });
    await vi.advanceTimersByTimeAsync(550);
    expect(store.system.isProcessing).toBe(true);
    const event = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector("dialog.Experience--matrix")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await task;
    expect(store.system.state).toBe("");
    expect(input()).not.toBeNull();
    expect(document.activeElement).toBe(input());
  });

  test("skips remaining animation waits without cancelling the command", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("matrix Neo");
    await vi.advanceTimersByTimeAsync(100);
    store.system.skipAnimation();
    await task;
    expect(store.system.state).toBe("");
    expect(input()).not.toBeNull();
  });

  test.each(["neo", "matrix"])(
    "%s opens a modal above the portfolio and Escape restores it",
    async command => {
      await store.system.addCommand("whoami", { route: false });
      vi.useFakeTimers();
      store.system.animations = true;
      input().focus();
      const task = store.system.addCommand(command, { focus: true });
      await vi.advanceTimersByTimeAsync(600);
      expect(store.system.isProcessing).toBe(true);
      const dialog = document.querySelector<HTMLDialogElement>(
        "dialog.Experience--matrix",
      )!;
      expect(dialog.open).toBe(true);
      expect(dialog.parentElement).toBe(document.body);
      expect(document.activeElement).toBe(dialog);
      expect(document.body.classList.contains("has-experience")).toBe(true);
      expect(output().querySelectorAll(".ProjectRow")).toHaveLength(3);
      const cancel = new Event("cancel", { cancelable: true });
      dialog.dispatchEvent(cancel);
      await task;
      expect(cancel.defaultPrevented).toBe(true);
      expect(document.querySelector("dialog")).toBeNull();
      expect(document.body.classList.contains("has-experience")).toBe(false);
      expect(output().querySelectorAll(".ProjectRow")).toHaveLength(3);
      expect(document.activeElement).toBe(input());
    },
  );

  test("finishing the movie restores the portfolio without clearing its content", async () => {
    await store.system.addCommand("about", { route: false });
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("neo");
    await vi.runAllTimersAsync();
    await task;
    expect(document.querySelector("dialog")).toBeNull();
    expect(store.system.isInputAllowed).toBe(true);
    expect(output().querySelector("h2")?.textContent).toContain(
      "I like understanding",
    );
  });

  test("reduced motion keeps all movie messages readable until dismissed", async () => {
    const task = store.system.addCommand('neo "<b>Trinity</b>"');
    await vi.waitFor(() =>
      expect(document.querySelector(".MatrixOutput")?.textContent).toContain(
        "Knock, knock",
      ),
    );
    const dialog = document.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelectorAll(".Line")).toHaveLength(4);
    expect(dialog.textContent).toContain("Wake up, <b>Trinity</b>...");
    expect(dialog.querySelector("b")).toBeNull();
    dialog.querySelector<HTMLButtonElement>(".ExperienceClose")!.click();
    await task;
    expect(document.querySelector("dialog")).toBeNull();
    expect(store.system.isInputAllowed).toBe(true);
  });

  test("exit shows the persistent Windows shutdown message on a separate screen", async () => {
    await store.system.addCommand("whoami", { route: false });
    await store.system.addCommand("exit");
    const dialog = document.querySelector<HTMLDialogElement>(
      "dialog.Experience--shutdown",
    )!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector("h2")?.textContent).toBe(
      "It's now safe to turn offyour computer.",
    );
    expect(dialog.querySelector("h2 br")).not.toBeNull();
    expect(dialog.querySelector(".ExperienceRestart")?.textContent).toBe(
      "Restart terminal",
    );
    expect(output().querySelectorAll(".ProjectRow")).toHaveLength(3);
    expect(store.system.shutdown).toBe(true);
    expect(document.activeElement).toBe(dialog);
    expect(store.commands.getLines("shutdown")).toEqual(
      store.commands.getLines("exit"),
    );
  });
});
