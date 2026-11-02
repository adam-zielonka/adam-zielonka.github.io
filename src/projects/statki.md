---
id: "statki"
name: "Ships"
category: "Game"
summary: "Browser Battleship with four computer opponents to choose from."
stack: ["JavaScript", "Game AI"]
source: "https://github.com/adam-zielonka/statki"
demo: "https://adam-zielonka.github.io/statki/"
order: 17
---

### The idea

A browser version of Battleship with Polish and English interfaces: find the opposing fleet on a coordinate grid before the computer sinks yours.

### How it works

Four opponents use random shots, targeted follow-up, checkerboard search or counts of legal ship placements. Each uses only previous shot results and the sizes of remaining ships. Hits keep the turn going; a miss passes it to the opponent. Pause, rematches, shot history and accuracy summaries help follow the game, and the board supports keyboard controls.
