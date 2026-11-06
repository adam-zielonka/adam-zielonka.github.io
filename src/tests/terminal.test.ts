import {
  beforeAll,
  beforeEach,
  afterAll,
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
    '<div class="CRTScreen"><button data-toggle-motion></button><button data-skip-animation hidden></button><nav class="QuickCommands"><a href="#about" data-command="about">About</a></nav><div id="root"></div></div><p id="command-status"></p>';
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
afterAll(() => document.body.replaceChildren());
afterEach(async () => {
  if (store.system.isProcessing) await store.system.break();
  vi.useRealTimers();
  await vi.waitFor(() => expect(store.system.state).not.toBe("interrupted"));
  vi.restoreAllMocks();
});

describe("interactive terminal", () => {
  test("follows appended and typed output and stays at the end after completion", async () => {
    const height = vi
      .spyOn(output(), "scrollHeight", "get")
      .mockReturnValue(900);
    window.terminal.push({ value: "first", style: {} });
    expect(output().scrollTop).toBe(900);
    height.mockReturnValue(1200);
    window.terminal.updateLast({ value: "more text", style: {} });
    expect(output().scrollTop).toBe(1200);
    output().scrollTop = 0;
    await store.system.addCommand("ping", { animateCommand: false });
    expect(output().scrollTop).toBe(1200);
  });

  test("follows every newly revealed project row", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    vi.spyOn(output(), "scrollHeight", "get").mockImplementation(
      () =>
        300 +
        output().querySelectorAll(".ProjectRow:not([hidden])").length * 100,
    );
    const task = store.system.addCommand("projects", {
      route: false,
      animateCommand: false,
    });
    await vi.advanceTimersByTimeAsync(240);
    expect(output().scrollTop).toBe(400);
    await vi.advanceTimersByTimeAsync(80);
    expect(output().scrollTop).toBe(500);
    store.system.skipAnimation();
    await task;
    expect(output().scrollTop).toBe(output().scrollHeight);
  });

  test("follows Matrix text inside the CRT without scrolling its background", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("neo", { animateCommand: false });
    await vi.advanceTimersByTimeAsync(500);
    const dialog = document.querySelector<HTMLDialogElement>(".Experience")!;
    vi.spyOn(dialog, "scrollHeight", "get").mockReturnValue(750);
    output().scrollTop = 123;
    await vi.advanceTimersByTimeAsync(100);
    expect(dialog.scrollTop).toBe(750);
    expect(output().scrollTop).toBe(123);
    await store.system.break();
    await task;
  });

  test("interrupted home output stays partial when the viewport is remeasured", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("whoami", {
      route: false,
      animateCommand: false,
    });
    // Three intro blocks, heading, then the first project.
    await vi.advanceTimersByTimeAsync(400);
    expect(output().querySelectorAll(".ProjectRow:not([hidden])")).toHaveLength(
      1,
    );
    await store.system.break();
    await task;
    window.terminal.showInput();
    expect(output().querySelectorAll(".ProjectRow")).toHaveLength(1);
    expect(output().querySelector(".HomeOutput .Count")?.textContent).toBe(
      "01",
    );
  });

  test("executes a typed command and renders HTML-like input as text", async () => {
    const text = '<img src=x onerror="alert(1)"> & $&';
    await enter(`echo '${text}'`);
    expect(output().querySelector("img")).toBeNull();
    expect(output().lastElementChild?.lastElementChild?.textContent).toBe(text);
    expect(store.history.lastCommand).toBe(`echo '${text}'`);
  });

  test("does not intercept Tab or Enter on a navigation link", () => {
    const link = document.querySelector<HTMLAnchorElement>(".QuickCommands a")!;
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
    document.querySelector<HTMLAnchorElement>(".QuickCommands a")!.click();
    await vi.waitFor(() => expect(store.system.state).toBe(""));
    expect(output().querySelector("h2")?.textContent).toContain(
      "I like understanding",
    );
    expect(
      document.querySelector(".QuickCommands a")?.getAttribute("aria-current"),
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
      output().querySelector('[data-command="cat README.md"]'),
    ).not.toBeNull();
    await store.system.addCommand("cd '<svg onload=alert(1)>'");
    expect(store.path.value).toBe("~/projects/server-status");
    expect(output().querySelector("svg")).toBeNull();
    expect(output().textContent).toContain("no such directory");
    expect(output().textContent).toContain("There is nothing.");
    expect(output().textContent).toContain("Only warm, primordial blackness.");
  });

  test("the missing-directory Easter egg types both phrases and can be skipped", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("cd void", { animateCommand: false });
    await vi.advanceTimersByTimeAsync(180);
    expect(output().lastElementChild?.lastElementChild?.textContent).toBe("T");
    expect(store.path.value).toBe("~");
    await vi.advanceTimersByTimeAsync(1600);
    expect(output().textContent).toContain("There is nothing.");
    expect(output().textContent).not.toContain("Only warm");
    store.system.skipAnimation();
    await task;
    expect(output().textContent).toContain("Only warm, primordial blackness.");
    expect(store.system.isInputAllowed).toBe(true);
  });

  test("keeps the hidden ping/pong exchange and classic aliases", async () => {
    await store.system.addCommand("ping");
    expect(output().lastElementChild?.lastElementChild?.textContent).toBe(
      "pong",
    );
    await store.system.addCommand("pong");
    expect(output().lastElementChild?.lastElementChild?.textContent).toBe(
      "ping",
    );
    expect(store.commands.getLines("neo")).toEqual(
      store.commands.getLines("matrix"),
    );
    expect(store.commands.getLines("cls")).toEqual(
      store.commands.getLines("clear"),
    );
    expect(
      store.commands
        .getLines("panic")
        .some(line => line.value.includes("Kernel panic")),
    ).toBe(true);
    await store.system.addCommand("description");
    expect(output().querySelector("h2")?.textContent).toContain(
      "I like understanding",
    );
    await store.system.addCommand("cls");
    expect(output().textContent).toBe("");
  });

  test("reads several quoted, absolute and home-relative files in order", async () => {
    await enter(
      'cat "./about.md" /root/contact.md "~/projects/server-status/README.md"',
    );
    expect(
      [...output().querySelectorAll("h2")].map(heading => heading.textContent),
    ).toEqual([
      "I like understanding how things work.",
      "Find me on GitHub.",
      "Server Status",
    ]);
    expect(store.path.value).toBe("~");
  });

  test("reads a README from the current project and from its sibling", async () => {
    await store.system.addCommand("cd projects/questions");
    await enter("cat ./README.md ../server-status/README.md");
    expect(
      [...output().querySelectorAll(".ProjectDetail h2")].map(
        heading => heading.textContent,
      ),
    ).toEqual(["Questions", "Server Status"]);
    expect(store.path.value).toBe("~/projects/questions");
  });

  test("cat explains missing arguments and rejects directories and missing files safely", async () => {
    await enter("cat");
    expect(output().textContent).toContain("Usage: cat <file> [file ...]");
    await enter(
      'cat projects missing.md "<svg onload=alert(1)>" README.md/ contact.md',
    );
    expect(output().textContent).toContain("Is a directory");
    expect(output().textContent).toContain("No such file or directory");
    expect(output().textContent).toContain("Not a directory");
    expect(output().querySelector("svg")).toBeNull();
    expect(output().querySelector(".TextOutput h2")?.textContent).toBe(
      "Find me on GitHub.",
    );
    expect(store.path.value).toBe("~");
  });

  test("cd completion continues into subdirectories without inserting a space", async () => {
    input().value = "cd pro";
    input().dispatchEvent(new Event("input", { bubbles: true }));
    input().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(input().value).toBe("cd projects/");
    input().value += "ser";
    input().dispatchEvent(new Event("input", { bubbles: true }));
    input().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(input().value).toBe("cd projects/server-status/");
    await enter(input().value);
    expect(store.path.value).toBe("~/projects/server-status");
  });

  test("Enter accepts a directory choice without prematurely executing cd", async () => {
    input().value = "cd projects/s";
    input().dispatchEvent(new Event("input", { bubbles: true }));
    input().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(
      document.querySelectorAll(".Completion button").length,
    ).toBeGreaterThan(1);
    input().form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(input().value).toBe("cd projects/saper/");
    expect(store.path.value).toBe("~");
    await enter(input().value);
    expect(store.path.value).toBe("~/projects/saper");
  });

  test("clicking a directory suggestion keeps its trailing slash", async () => {
    input().value = "cd projects/s";
    input().dispatchEvent(new Event("input", { bubbles: true }));
    input().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    document
      .querySelector<HTMLButtonElement>(
        '[data-complete="cd projects/statki/"]',
      )!
      .click();
    expect(input().value).toBe("cd projects/statki/");
    await enter(input().value);
    expect(store.path.value).toBe("~/projects/statki");
  });

  test("Tab completes a cat path and Enter opens the project", async () => {
    input().value = "cat projects/ser";
    input().dispatchEvent(new Event("input", { bubbles: true }));
    input().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(input().value).toBe("cat projects/server-status/README.md ");
    await enter(input().value);
    expect(output().querySelector(".ProjectDetail h2")?.textContent).toBe(
      "Server Status",
    );
    expect(store.commands.getCompletions("cat about.md cont")).toEqual([
      "cat about.md contact.md",
    ]);
  });

  test("files shown by ls can be clicked to run cat", async () => {
    await store.system.addCommand("ls");
    output()
      .querySelector<HTMLButtonElement>('[data-command="cat about.md"]')!
      .click();
    await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
    expect(output().querySelector(".TextOutput h2")?.textContent).toContain(
      "I like understanding",
    );
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

  test("types clicked commands and reveals complete project rows progressively", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    // Happy DOM emits hashchange for pushState; browsers do not.
    // Keep the animation clock independent of that emulated navigation.
    const task = store.system.addCommand("projects", { route: false });
    await vi.advanceTimersByTimeAsync(50);
    expect(output().querySelector(".CommandLine")?.textContent).toMatch(/p_$/);
    expect(store.system.isProcessing).toBe(true);
    expect(output().querySelector(".ProjectRow")).toBeNull();
    await vi.advanceTimersByTimeAsync(350);
    const rows = [...output().querySelectorAll<HTMLElement>(".ProjectRow")];
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every(row => row.hidden)).toBe(true);
    await vi.advanceTimersByTimeAsync(240);
    expect(rows[0].hidden).toBe(false);
    expect(rows[1].hidden).toBe(true);
    expect(rows[0].querySelector("a")?.dataset.command).toBe(
      "project server-status",
    );
    store.system.skipAnimation();
    await task;
    expect(rows.every(row => !row.hidden)).toBe(true);
    expect(store.system.isInputAllowed).toBe(true);
  });

  test("prints typed commands immediately but animates their results", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    input().value = "ls";
    input().form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(output().querySelector(".CommandLine")?.textContent).toMatch(/ls$/);
    const entries = [
      ...output().querySelectorAll<HTMLElement>(".DirectoryLink"),
    ];
    expect(entries.every(entry => entry.hidden)).toBe(true);
    await vi.advanceTimersByTimeAsync(80);
    expect(entries[0].hidden).toBe(false);
    expect(entries[1].hidden).toBe(true);
    await vi.runAllTimersAsync();
    expect(entries.every(entry => !entry.hidden)).toBe(true);
    expect(store.system.isInputAllowed).toBe(true);
  });

  test("interrupting result output removes unrevealed links and restores input", async () => {
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("projects", {
      animateCommand: false,
      focus: true,
      route: false,
    });
    await vi.advanceTimersByTimeAsync(240);
    expect(output().querySelectorAll(".ProjectRow:not([hidden])")).toHaveLength(
      1,
    );
    await store.system.break();
    await task;
    expect(output().querySelectorAll(".ProjectRow")).toHaveLength(1);
    expect(output().querySelector("[hidden]")).toBeNull();
    expect(document.activeElement).toBe(input());
    store.system.animations = false;
    await store.system.addCommand("ping");
    expect(output().textContent).toContain("pong");
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
    "%s fills the CRT screen and Escape restores the terminal controls",
    async command => {
      await store.system.addCommand("whoami", { route: false });
      const homeRows = output().querySelectorAll(".ProjectRow").length;
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
      expect(dialog.parentElement).toBe(document.querySelector(".CRTScreen"));
      expect(document.activeElement).toBe(dialog);
      expect(document.getElementById("root")!.inert).toBe(true);
      expect(document.querySelector<HTMLElement>(".QuickCommands")!.inert).toBe(
        true,
      );
      expect(output().querySelectorAll(".ProjectRow")).toHaveLength(homeRows);
      const escape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      dialog
        .querySelector<HTMLButtonElement>(".ExperienceClose")!
        .dispatchEvent(escape);
      await task;
      expect(escape.defaultPrevented).toBe(true);
      expect(document.querySelector("dialog")).toBeNull();
      expect(document.getElementById("root")!.inert).toBe(false);
      expect(document.querySelector<HTMLElement>(".QuickCommands")!.inert).toBe(
        false,
      );
      expect(output().querySelectorAll(".ProjectRow")).toHaveLength(homeRows);
      expect(document.activeElement).toBe(input());
    },
  );

  test("finishing the movie restores the portfolio without clearing its content", async () => {
    await store.system.addCommand("about", { route: false });
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("neo", { animateCommand: false });
    await vi.advanceTimersByTimeAsync(500);
    const matrix = document.querySelector(".MatrixOutput")!;
    expect(matrix.textContent).toBe("");
    await vi.advanceTimersByTimeAsync(100);
    expect(matrix.textContent).toBe("W");
    await vi.advanceTimersByTimeAsync(99);
    expect(matrix.textContent).toBe("W");
    await vi.advanceTimersByTimeAsync(1);
    expect(matrix.textContent).toBe("Wa");
    await vi.runAllTimersAsync();
    await task;
    expect(document.querySelector("dialog")).toBeNull();
    expect(store.system.isInputAllowed).toBe(true);
    expect(document.getElementById("root")!.inert).toBe(false);
    expect(document.activeElement).toBe(output());
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

  test("exit shows the persistent Windows shutdown message inside the CRT", async () => {
    await store.system.addCommand("whoami", { route: false });
    const homeRows = output().querySelectorAll(".ProjectRow").length;
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("exit", { animateCommand: false });
    await vi.advanceTimersByTimeAsync(130);
    expect(output().textContent).toContain("Wait ...");
    expect(document.querySelector("dialog")).toBeNull();
    await vi.advanceTimersByTimeAsync(999);
    expect(document.querySelector("dialog")).toBeNull();
    expect(store.system.isProcessing).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await task;
    const dialog = document.querySelector<HTMLDialogElement>(
      "dialog.Experience--shutdown",
    )!;
    expect(dialog.open).toBe(true);
    expect(dialog.parentElement).toBe(document.querySelector(".CRTScreen"));
    expect(document.getElementById("root")!.inert).toBe(true);
    expect(dialog.querySelector("h2")?.textContent).toBe(
      "It's now safe to turn offyour computer.",
    );
    expect(dialog.querySelector("h2 br")).not.toBeNull();
    expect(dialog.querySelector(".ExperienceRestart")?.textContent).toBe(
      "Restart terminal",
    );
    expect(output().querySelectorAll(".ProjectRow")).toHaveLength(homeRows);
    expect(store.system.shutdown).toBe(true);
    expect(document.activeElement).toBe(dialog);
    expect(store.commands.getLines("shutdown")).toEqual(
      store.commands.getLines("exit"),
    );
  });
});
