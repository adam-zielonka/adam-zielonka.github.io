import { commandFromHash } from "./routes";

const powerOnKey = "portfolio.power-on";

export function requestPowerOnBoot() {
  // History state survives this reload without changing the shared URL.
  window.history.replaceState(
    { ...window.history.state, [powerOnKey]: true },
    "",
  );
}

export function startupCommands(hash: string): string[] {
  const state = window.history.state;
  const poweredOn = state?.[powerOnKey] === true;
  if (poweredOn) {
    const remaining = { ...state };
    delete remaining[powerOnKey];
    // Consume before rendering, so a refresh during boot does not replay it.
    window.history.replaceState(
      Object.keys(remaining).length ? remaining : null,
      "",
    );
  }
  const destination = commandFromHash(hash) ?? "whoami";
  return poweredOn ? ["boot", destination] : [destination];
}
