---
id: "mobx-example"
name: "MobX example"
category: "Learning"
summary: "An example of managing application state with MobX."
stack: ["React", "TypeScript", "MobX"]
source: "https://github.com/adam-zielonka/mobx-example"
demo: "https://adam-zielonka.github.io/mobx-example/"
order: 12
---

### The idea

A small, focused example of reactive application state. A counter makes it easy to see how a change travels from a user action through a store to the interface.

### How it works

An observable counter is updated by an action, while a computed value derives its double. React observer components update when the values they use change, keeping the example small enough to read alongside its unit tests.
