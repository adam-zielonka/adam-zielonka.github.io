import "./terminal";
import { store } from "./store/store";
import { commandFromHash } from "./utils/routes";

let routeRequest = 0;
async function runRoute() {
  const request = ++routeRequest;
  const command =
    commandFromHash(location.hash) ?? (location.hash ? undefined : "whoami");
  if (!command) return;
  if (!store.system.isInputAllowed) {
    await store.system.break();
    // Let the interrupted command settle before starting the new route.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (request !== routeRequest) return;
  await store.system.addCommand(command, { route: false });
}

window.addEventListener("hashchange", () => void runRoute());
document.addEventListener("click", event => {
  if (!(event.target instanceof Element)) return;
  const motion = event.target.closest("[data-toggle-motion]");
  if (motion) {
    store.system.toggleAnimations();
    return;
  }
  const skip = event.target.closest("[data-skip-animation]");
  if (skip) {
    store.system.skipAnimation();
    return;
  }
  const copy = event.target.closest<HTMLAnchorElement>("[data-copy-link]");
  if (copy) {
    event.preventDefault();
    const showAddress = () => {
      window.history.replaceState(null, "", copy.hash);
      copy.textContent = "Link in address bar ↑";
      window.terminal.announce("Copy the project link from the address bar.");
    };
    if (!navigator.clipboard?.writeText) {
      showAddress();
      return;
    }
    const url = new URL(`#project/${copy.dataset.copyLink}`, location.href)
      .href;
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        copy.textContent = "Link copied ✓";
        window.terminal.announce("Project link copied.");
      })
      .catch(showAddress);
    return;
  }
  const action = event.target.closest<HTMLElement>("[data-command]");
  if (
    !action ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  if (!store.system.isInputAllowed) return;
  event.preventDefault();
  if (!action.closest(".TerminalWindow")) {
    document.getElementById("terminal")?.scrollIntoView({
      block: "start",
      behavior: store.system.shouldAnimate ? "smooth" : "instant",
    });
  }
  void store.system.addCommand(action.dataset.command!);
});

document.getElementById("fallback")?.remove();
void store.system
  .start([commandFromHash(location.hash) ?? "whoami"])
  .then(() => {
    if (commandFromHash(location.hash))
      document
        .getElementById("terminal")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
  });
