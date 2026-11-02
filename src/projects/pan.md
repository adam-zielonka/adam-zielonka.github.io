---
id: "pan"
name: "Pan"
category: "Game"
summary: "The Polish card game with tactical, Monte Carlo and tree-search bots."
stack: ["Svelte", "TypeScript", "Game AI"]
source: "https://github.com/adam-zielonka/pan"
demo: "https://adam-zielonka.github.io/pan/"
order: 18
---

### The idea

Bring the Polish card game Pan to a shared virtual table for two to four players. Play against computer opponents or watch them compete, with a responsive interface in Polish and English and a history of moves. Players try to empty their hands; the last player holding cards loses.

### How it works

Opponents range from random and greedy strategies to tactical evaluation, flat Monte Carlo simulation, MCTS with UCT and MaxN search. Monte Carlo bots sample unknown hands; the experimental MaxN opponent deliberately sees every hand. Simulations run separately from the live game with bounded search, and repeated-state memory helps some bots reduce loops. These are experiments with different decision strategies, with no verified ranking of playing strength.
