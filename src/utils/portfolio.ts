import { projects, findProject } from "../data/projects.ts";
import type { Project } from "../data/projects.ts";
import { escape } from "./escape.ts";

export function commandLink(
  command: string,
  label: string,
  className = "CommandLink",
): string {
  return `<button type="button" class="${className}" data-command="${escape(command)}">${escape(label)}</button>`;
}

function projectRow(project: Project, index: number): string {
  return `<article class="ProjectRow"><span class="ProjectNumber" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div class="ProjectInfo"><span class="ProjectCategory">${escape(project.category)}</span><h3><a href="#project/${project.id}" data-command="project ${project.id}">${escape(project.name)}<span aria-hidden="true"> ↗</span></a></h3><p>${escape(project.summary)}</p><span class="ProjectStack">${project.stack.map(escape).join(" / ")}</span></div><a class="ProjectOpen" href="#project/${project.id}" data-command="project ${project.id}" aria-label="Poznaj projekt ${escape(project.name)}"><span aria-hidden="true">↗</span></a></article>`;
}

export function renderHome(): string {
  return `<section class="HomeOutput"><div class="OutputHeading"><h2>Wybrane projekty<span class="Count">03</span></h2><span class="OutputNote">z pomysłu do przeglądarki</span></div><div class="ProjectList">${projects
    .filter(project => project.featured)
    .map(projectRow)
    .join(
      "",
    )}</div><div class="OutputActions">${commandLink("projects", "Wszystkie projekty →")}${commandLink("help", "Co potrafi ten terminal?")}</div></section>`;
}

export function renderProjects(): string {
  return `<section><div class="OutputHeading"><h2>Katalog projektów<span class="Count">${projects.length}</span></h2></div><p class="OutputIntro">Narzędzia, aplikacje, gry i eksperymenty. Wybierz projekt albo wpisz <code>project server-status</code>.</p><div class="ProjectList ProjectList--compact">${projects.map(projectRow).join("")}</div></section>`;
}

export function renderProject(id: string): string {
  const project = findProject(id);
  if (!project)
    return `<p class="Error">Nie ma projektu „${escape(id)}”.</p><p>${commandLink("projects", "Pokaż dostępne projekty →")}</p>`;
  return `<article class="ProjectDetail"><div class="DetailBreadcrumb">${commandLink("projects", "projects")}<span aria-hidden="true"> / </span><span>${escape(project.id)}</span></div><span class="ProjectCategory">${escape(project.category)}</span><h2>${escape(project.name)}</h2><p class="DetailSummary">${escape(project.summary)}</p><p class="ProjectStack">${project.stack.map(escape).join(" / ")}</p>${project.idea ? `<h3>Pomysł</h3><p>${escape(project.idea)}</p>` : ""}${project.decisions ? `<h3>Jak to działa</h3><p>${escape(project.decisions)}</p>` : ""}<div class="DetailLinks">${project.demo ? `<a class="PrimaryLink" href="${project.demo}" target="_blank" rel="noopener noreferrer">${project.category === "Gra" ? "Zagraj" : "Otwórz demo"} <span aria-hidden="true">↗</span></a>` : ""}<a href="${project.source}" target="_blank" rel="noopener noreferrer">Kod na GitHubie <span aria-hidden="true">↗</span></a><a href="#project/${project.id}" data-copy-link="${project.id}">Kopiuj link <span aria-hidden="true">⤴</span></a></div>${project.id === "game-of-life" ? '<p class="OutputNote">Symulacja zawiera ruchome, zmieniające się wzory.</p>' : ""}</article>`;
}

export function renderAbout(): string {
  return `<section class="TextOutput"><span class="ProjectCategory">Cześć, jestem Adam</span><h2>Lubię wiedzieć, jak to działa.</h2><p>Tworzę aplikacje webowe, narzędzia i gry. W tych projektach jest miejsce zarówno na praktyczne rozwiązania, jak i na eksperymenty z interfejsem, stanem aplikacji czy prostymi regułami symulacji.</p><p>Pracuję m.in. z TypeScriptem, Reactem i Go. Dzielę się też wiedzą w materiałach o budowaniu frontendu z React i MobX.</p><h3>Ta strona też jest eksperymentem</h3><p>Pierwsza wersja powstała w 2017 roku. Później były React i Svelte, a dziś terminal działa na natywnym DOM i TypeScripcie. Komendy są zapisane w Markdown.</p><div class="OutputActions">${commandLink("project frontend-tutorial", "Zobacz materiały →")}${commandLink("project portfolio", "O tym portfolio →")}${commandLink("contact", "Kontakt →")}</div></section>`;
}

export function renderContact(): string {
  return `<section class="TextOutput"><span class="ProjectCategory">Porozmawiajmy o kodzie</span><h2>Znajdziesz mnie na GitHubie.</h2><p>Chcesz zapytać o projekt, zgłosić błąd albo zaproponować usprawnienie? Najlepiej zacząć od jego repozytorium.</p><div class="DetailLinks"><a class="PrimaryLink" href="https://github.com/adam-zielonka" target="_blank" rel="noopener noreferrer">Profil na GitHubie <span aria-hidden="true">↗</span></a>${commandLink("projects", "Wybierz repozytorium →")}</div></section>`;
}

export function renderDirectory(path: string): string {
  if (path === "/") return commandLink("cd /root", "root/", "DirectoryLink");
  if (path === "~")
    return `<div class="DirectoryList">${commandLink("cd projects", "projects/", "DirectoryLink")}${commandLink("about", "about.md", "DirectoryLink")}${commandLink("contact", "contact.md", "DirectoryLink")}</div>`;
  if (path === "~/projects")
    return `<div class="DirectoryList">${projects.map(project => commandLink(`cd ${project.id}`, `${project.id}/`, "DirectoryLink")).join("")}</div>`;
  const project = findProject(path.split("/").at(-1) ?? "");
  return project
    ? `<p>${escape(project.summary)}</p>${commandLink(`project ${project.id}`, "README.md →", "DirectoryLink")}`
    : "";
}
