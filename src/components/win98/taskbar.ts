import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import { rovingToolbar } from "./shared";

const quickLaunch = (action: string, label: string, icon: string) =>
  `<button type="button" class="WinQuickButton" data-win-action="${action}" data-crt-hit aria-label="${label}" data-tip="${label}" tabindex="-1">${windowsIcon(icon, 16)}</button>`;

export const taskbarMarkup = () => `
    <footer class="WinTaskbar">
      <button type="button" class="WinButton WinStart" data-win-action="start" data-crt-hit aria-haspopup="menu" aria-expanded="false">${windowsIcon("portfolio-start", 16)}<b>Start</b></button>
      <div class="WinQuickLaunch" role="toolbar" aria-label="Quick Launch">
        ${quickLaunch("desktop", "Show Desktop", "desktop")}
        ${quickLaunch("folder:projects", "My Projects", "folder")}
        ${quickLaunch("find", "Find Projects", "find")}
      </div>
      <div class="WinTasks" role="toolbar" aria-label="Running applications"></div>
      <div class="WinTray">${windowsIcon("computer", 16)}<span class="WinClock" data-crt-hit><time aria-hidden="true"></time><span class="VisuallyHidden"></span></span></div>
    </footer>`;

/** The clock's next update: just after the coming minute boundary. */
export const nextMinuteDelay = (now = Date.now()) =>
  60_000 - (now % 60_000) + 50;

export type Taskbar = ReturnType<typeof createTaskbar>;

/**
 * Wires the taskbar rendered by taskbarMarkup(): Start, Quick Launch, task
 * buttons and the tray clock.
 */
export function createTaskbar(root: HTMLElement) {
  const element = root.querySelector<HTMLElement>(".WinTaskbar")!;
  const start = element.querySelector<HTMLButtonElement>(".WinStart")!;
  const launch = element.querySelector<HTMLElement>(".WinQuickLaunch")!;
  const tasks = element.querySelector<HTMLElement>(".WinTasks")!;
  // The clock is not a control (Date/Time Properties is not offered): the
  // full date is read with it, and shown in its tooltip on hover.
  const clockTray = element.querySelector<HTMLElement>(".WinClock")!;
  const clock = clockTray.querySelector("time")!;
  const clockText = clockTray.querySelector<HTMLElement>(".VisuallyHidden")!;
  const abort = new AbortController();
  rovingToolbar(launch, abort.signal);
  rovingToolbar(tasks, abort.signal);
  // Show Desktop, the one button kept on phones, is Quick Launch's Tab stop.
  launch.querySelector<HTMLButtonElement>("button")!.tabIndex = 0;

  function updateClock() {
    const now = new Date();
    clock.dateTime = now.toISOString();
    // Short time without a leading zero, e.g. 9:05 PM in en-US.
    clock.textContent = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const full = now.toLocaleString([], {
      dateStyle: "full",
      timeStyle: "short",
    });
    clockText.textContent = full;
    clockTray.dataset.tip = now.toLocaleDateString([], { dateStyle: "full" });
  }
  let timer: number | undefined;
  function tick() {
    updateClock();
    timer = window.setTimeout(tick, nextMinuteDelay());
  }
  tick();

  return {
    element,
    start,
    tasks,
    addTask(title: string, icon: string, onClick: () => void) {
      const task = document.createElement("button");
      task.type = "button";
      task.className = "WinButton WinTask";
      // Small edge controls follow the CRT picture's hit compensation.
      task.dataset.crtHit = "";
      task.innerHTML = `${windowsIcon(icon, 16)}<span>${escape(title)}</span>`;
      // The full title as a tooltip, shown only when the label is cut off.
      task.dataset.tip = title;
      task.setAttribute("data-tip-overflow", "");
      task.setAttribute("aria-label", title);
      task.tabIndex = -1;
      task.addEventListener("click", onClick);
      tasks.append(task);
      return task;
    },
    /**
     * Makes the foreground window's task (or else the first one) the band's
     * Tab stop and scrolls it into the band; call after activation changes
     * or tasks are removed.
     */
    updateTabStop() {
      const buttons = [...tasks.querySelectorAll<HTMLButtonElement>("button")];
      const pressed = buttons.find(
        task => task.getAttribute("aria-pressed") === "true",
      );
      const stop = pressed ?? buttons[0];
      for (const task of buttons) task.tabIndex = task === stop ? 0 : -1;
      // The band has no scrollbar; keep the foreground task visible. Only the
      // band scrolls (scrollIntoView could move the whole desktop).
      if (!pressed) return;
      const band = tasks.getBoundingClientRect();
      const task = pressed.getBoundingClientRect();
      if (task.left < band.left) tasks.scrollLeft -= band.left - task.left;
      else if (task.right > band.right)
        tasks.scrollLeft += task.right - band.right;
    },
    dispose() {
      window.clearTimeout(timer);
      abort.abort();
    },
  };
}
