---
id: "tysiac"
name: "Tysiąc"
category: "Game"
summary: "The Polish card game Thousand with Monte Carlo, ISMCTS and alpha-beta bots."
stack: ["Svelte", "TypeScript", "Game AI"]
source: "https://github.com/adam-zielonka/tysiac"
demo: "https://adam-zielonka.github.io/tysiac/"
order: 20
---

### The idea

Play Tysiąc, the Polish trick-taking game for three, against computer opponents or watch them play each other. Every deal goes through the forced opening bid of 100, an auction backed by marriages, the revealed musik, passing one card to each opponent and raising the contract. Play follows the Polish rules with compulsory overtaking and marriages that change trumps, and the match runs to 1000 with the 800 lock. The responsive interface works in Polish and English and keeps a score sheet and a move history.

### How it works

A pure deal engine shares one set of rules with the bots. Fair opponents see only their own cards and what the table has revealed: the auction, played cards, the musik, declared marriages and the cards a player has shown not to hold. Monte Carlo opponents sample hidden hands consistent with that knowledge and simulate the rest of the deal; one of them grows an information-set Monte Carlo tree. The experimental Ada deliberately sees every hand and searches the play with alpha-beta. It grew out of the table and opponents of Pan.
