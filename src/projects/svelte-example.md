---
id: "svelte-example"
name: "Svelte example"
category: "Learning"
summary: "Editable counters and a shared total built with Svelte stores."
stack: ["Svelte", "TypeScript"]
source: "https://github.com/adam-zielonka/svelte-example"
demo: "https://adam-zielonka.github.io/svelte-example/"
order: 13
---

### The idea

Explore reusable components and shared reactive state with a collection of counters. Add up to four counters, edit their values and watch the total change.

### How it works

A writable store holds the counter values. Derived stores calculate the sum and whether another counter can be added, so the interface reacts to updates without manually synchronizing each component.
