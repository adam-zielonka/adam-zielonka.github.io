export type Project = {
  id: string;
  name: string;
  category: "Narzędzie" | "Aplikacja" | "Gra" | "Eksperyment" | "Edukacja";
  summary: string;
  stack: string[];
  source: string;
  demo?: string;
  featured?: boolean;
  idea?: string;
  decisions?: string;
};

const github = "https://github.com/adam-zielonka";
const pages = "https://adam-zielonka.github.io";

export const projects: Project[] = [
  {
    id: "server-status",
    name: "Server Status",
    category: "Narzędzie",
    summary: "Stan serwera, metryki i historia w jednym dashboardzie.",
    stack: ["Go", "React", "TypeScript"],
    source: `${github}/server-status`,
    demo: `${pages}/server-status/`,
    featured: true,
    idea: "Jedno miejsce do sprawdzania kondycji serwera: od użycia zasobów po stan usług i historię pomiarów.",
    decisions:
      "API w Go i frontend w React są pakowane do jednego pliku wykonywalnego. Opcjonalny kolektor zbiera dane na Linuksie. Publiczne demo korzysta z danych przykładowych, więc można poznać interfejs bez dostępu do serwera.",
  },
  {
    id: "questions",
    name: "Questions",
    category: "Aplikacja",
    summary: "Własne zestawy pytań, nauka do egzaminu i zapis postępów.",
    stack: ["React", "MobX", "PWA"],
    source: `${github}/questions`,
    demo: `${pages}/questions/`,
    featured: true,
    idea: "Aplikacja powstała do nauki pytań przed egzaminem. Zestaw można przygotować samodzielnie i wczytać z pliku JSON.",
    decisions:
      "Pytania i postępy są przechowywane lokalnie w przeglądarce. Obsługa PWA pozwala zainstalować aplikację na telefonie. React odpowiada za interfejs, a MobX za stan nauki.",
  },
  {
    id: "game-of-life",
    name: "Game of Life",
    category: "Eksperyment",
    summary: "Proste reguły. Złożone zachowania. Automat komórkowy Conwaya.",
    stack: ["JavaScript", "Automat komórkowy"],
    source: `${github}/game-of-life`,
    demo: `${pages}/game-of-life/`,
    featured: true,
    idea: "Implementacja automatu Conwaya: kolejne pokolenia komórek powstają na podstawie stanu ich ośmiu sąsiadów.",
    decisions:
      "Kod oddziela silnik symulacji od planszy i ustawień. To niewielki eksperyment z tym, jak z kilku reguł wyłaniają się złożone wzory.",
  },
  {
    id: "portfolio",
    name: "To portfolio",
    category: "Eksperyment",
    summary: "Interaktywny terminal, który właśnie przeglądasz.",
    stack: ["TypeScript", "Vite", "SCSS"],
    source: `${github}/adam-zielonka.github.io`,
    idea: "Osobiste miejsce w sieci i przestrzeń do eksperymentów z interfejsem terminala.",
    decisions:
      "Interfejs korzysta z natywnego DOM, a komendy są definiowane w Markdown. Od pierwszej wersji w 2017 roku strona przeszła przez React i Svelte, by wrócić do prostego TypeScriptu.",
  },
  {
    id: "frontend-tutorial",
    name: "Frontend tutorial",
    category: "Edukacja",
    summary: "Materiały o budowaniu aplikacji z React i MobX.",
    stack: ["React", "MobX"],
    source: `${github}/frontend-tutorial`,
    demo: `${pages}/frontend-tutorial/`,
  },
  {
    id: "unit-converter",
    name: "Unit Converter",
    category: "Narzędzie",
    summary: "Projekt przelicznika jednostek.",
    stack: [],
    source: `${github}/unit-converter`,
  },
  {
    id: "paintaz",
    name: "paintAZ",
    category: "Aplikacja",
    summary: "Projekt aplikacji do rysowania.",
    stack: [],
    source: `${github}/paintaz`,
  },
  {
    id: "tiles",
    name: "Tiles",
    category: "Eksperyment",
    summary: "Eksperyment z interfejsem opartym na kafelkach.",
    stack: ["React", "TypeScript", "MobX"],
    source: `${github}/tiles`,
    demo: `${pages}/tiles/`,
  },
  {
    id: "mobx-example",
    name: "MobX example",
    category: "Edukacja",
    summary: "Przykład pracy ze stanem aplikacji w MobX.",
    stack: ["MobX"],
    source: `${github}/mobx-example`,
    demo: `${pages}/mobx-example/`,
  },
  {
    id: "svelte-example",
    name: "Svelte example",
    category: "Edukacja",
    summary: "Eksperyment z tworzeniem interfejsu w Svelte.",
    stack: ["Svelte"],
    source: `${github}/svelte-example`,
    demo: `${pages}/svelte-example/`,
  },
  {
    id: "deska",
    name: "Deska",
    category: "Gra",
    summary: "Gra dostępna bezpośrednio w przeglądarce.",
    stack: [],
    source: `${github}/deska`,
    demo: `${pages}/deska/`,
  },
  {
    id: "saper",
    name: "Saper",
    category: "Gra",
    summary: "Klasyczne szukanie min w przeglądarce.",
    stack: [],
    source: `${github}/saper`,
    demo: `${pages}/saper/`,
  },
  {
    id: "tetris",
    name: "Tetris",
    category: "Gra",
    summary: "Własna implementacja układania spadających klocków.",
    stack: [],
    source: `${github}/tetris`,
  },
  {
    id: "statki",
    name: "Ships",
    category: "Gra",
    summary: "Przeglądarkowa wersja gry w statki.",
    stack: [],
    source: `${github}/statki`,
    demo: `${pages}/statki/`,
  },
  {
    id: "pan",
    name: "Pan",
    category: "Gra",
    summary: "Projekt gry karcianej.",
    stack: [],
    source: `${github}/pan`,
    demo: `${pages}/pan/`,
  },
  {
    id: "chinczyk",
    name: "Chińczyk",
    category: "Gra",
    summary: "Klasyczna planszówka w wersji przeglądarkowej.",
    stack: [],
    source: `${github}/chinczyk`,
    demo: `${pages}/chinczyk/`,
  },
];

export const findProject = (id: string) =>
  projects.find(project => project.id === id);
