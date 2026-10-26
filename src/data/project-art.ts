export type ProjectArt = {
  description: string;
  drawing: string;
};

export const projectArt = {
  "server-status": {
    description:
      "A server dashboard with CPU and memory bars and a resource history chart",
    drawing: String.raw` .----------------------.
 | [o] CPU [||||......] |
 | [o] RAM [|||||||...] |
 |----------------------|
 |     /\      /\       |
 | ___/  \____/  \___   |
 '----------------------'
         [ online ]`,
  },
  questions: {
    description:
      "An exam sheet with multiple-choice answers and saved progress",
    drawing: String.raw` .----------------------.
 |    EXAM PRACTICE     |
 |                      |
 |  [x] Answer A        |
 |  [ ] Answer B        |
 |  [ ] Answer C        |
 |  progress [|||||..]  |
 '----------------------'`,
  },
  "game-of-life": {
    description:
      "A Game of Life glider evolving from one generation to the next",
    drawing: String.raw`  CONWAY'S GAME OF LIFE

. O . . .       . . . . .
. . O . .       O . O . .
O O O . .  -->  . O O . .
. . . . .       . O . . .
. . . . .       . . . . .
    n             n + 1`,
  },
  portfolio: {
    description: "A terminal window with whoami and projects commands",
    drawing: String.raw` .----------------------.
 | o o o    portfolio   |
 |----------------------|
 | ~ > whoami           |
 | Adam Zielonka        |
 | ~ > projects         |
 | _                    |
 '----------------------'`,
  },
  "frontend-tutorial": {
    description: "Two programming books about React components and MobX stores",
    drawing: String.raw`   _________ _________
  / React  /|  MobX  /|
 /________/ |_______/ |
 | <App/> | | store | |
 |        | /       | /
 |________|/|_______|/

     LEARN + BUILD`,
  },
  "unit-converter": {
    description:
      "A unit converter turning one metre into one hundred centimetres",
    drawing: String.raw` .----------------------.
 |   UNIT CONVERTER     |
 |                      |
 |   1 m  ->  100 cm    |
 |                      |
 |   [7] [8] [9] [+]    |
 |   [4] [5] [6] [=]    |
 '----------------------'`,
  },
  paintaz: {
    description: "A painted mountain landscape on an easel with a paintbrush",
    drawing: String.raw` .--------------------.
 |    /\         .    |
 |   /  \   /\        |
 |  /____\ /__\       |
 '--------------------'
       /      \     //
      /        \   //
                   \/`,
  },
  tiles: {
    description:
      "Four dashboard tiles for planning, transfers, picking and posting",
    drawing: String.raw`.----------. .----------.
| PLAN     | | TRANSFER |
|    12    | |    08    |
'----------' '----------'
.----------. .----------.
| PICK     | | POST     |
|    05    | |    03    |
'----------' '----------'`,
  },
  "mobx-example": {
    description:
      "An action updates an observable counter, which updates its view",
    drawing: String.raw`     [ action: +1 ]
            |
            v
    .---------------.
    |   count = 1   |
    '---------------'
            |
       [ view: 1 ]`,
  },
  "svelte-example": {
    description:
      "Svelte counter components with increment buttons and a computed sum",
    drawing: String.raw` .----------------------.
 |  <Counter />   [+]   |
 |  <Counter />   [+]   |
 |                      |
 |       SUM = 2        |
 |                      |
 |   <App /> -> update  |
 '----------------------'`,
  },
  deska: {
    description: "Breakout-style bricks above a ball and a paddle",
    drawing: String.raw` .----------------------.
 | [] [] [] [] [] [] [] |
 | [] [] [] [] [] [] [] |
 |             .        |
 |           o          |
 |                      |
 |        ======        |
 '----------------------'`,
  },
  saper: {
    description: "A Minesweeper board with numbered clues and two mines",
    drawing: String.raw`  +---+---+---+---+
  | 1 | 1 | 1 |   |
  +---+---+---+---+
  | 1 | * | 2 | 1 |
  +---+---+---+---+
  | 1 | 2 | * | 1 |
  +---+---+---+---+
       MINESWEEPER`,
  },
  tetris: {
    description: "A falling T-shaped tetromino above a stack of blocks",
    drawing: String.raw`   |      []        |
   |    [][][]      |
   |                |
   |                |
   |[][]    []      |
   |[][][][][][][]  |
   +----------------+
         TETRIS`,
  },
  statki: {
    description:
      "A battleship above water and a coordinate grid with hits and misses",
    drawing: String.raw`          |>
       ___|____
   ___/  [] [] \___
  /________________\
 ~~~ ~~~ ~~~ ~~~ ~~~
      A  B  C  D
   1  .  X  .  .
   2  .  X  .  O`,
  },
  pan: {
    description:
      "Three overlapping playing cards showing an ace, king and queen",
    drawing: String.raw` .------.
 | A    |------.
 |  /\  | K    |------.
 |  \/  |  <>  | Q    |
 |    A |      |  ()  |
 '------|    K |      |
        '------|    Q |
               '------'`,
  },
  chinczyk: {
    description:
      "A Ludo board with four groups of pieces, a route to the centre and a die",
    drawing: String.raw` [o o] . . . [x x]
 [o o] . + . [x x]
   . . . . . . .
 . . . [>] . . . .
   . . . . . . .
 [* *] . + . [# #]
 [* *] . . . [# #]
       [:::] 6`,
  },
} satisfies Record<string, ProjectArt>;
