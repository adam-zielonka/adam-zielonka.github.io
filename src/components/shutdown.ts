export function Shutdown() {
  const div = document.createElement("div");
  div.className = "Shutdown";
  div.innerHTML =
    '<p>Sesja zakończona.<br />Do zobaczenia w kolejnym projekcie.</p><a href="">Uruchom terminal ponownie →</a>';
  return div;
}
