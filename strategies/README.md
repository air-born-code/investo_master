# Investment Strategies

A library of analytical lenses distilled from practitioners whose reasoning is worth borrowing.

Each file here is a **prompt**, not a portfolio. A lens supplies questions to ask of the store — it never supplies conclusions, positions, or a recommendation to copy what someone else owns.

## How a lens is used

Lenses are opt-in and deliberate, not applied every week:

```bash
npm run draft:issue -- --strategy situational-awareness
```

The lens is appended to the research prompt for that issue only. Running without `--strategy` produces the ordinary issue.

Apply one when you want to interrogate the universe from a specific angle, and say in the issue which lens was applied — a conclusion reached through a lens should be attributable to it.

## What belongs here

A lens earns a place if it supplies a **repeatable way of looking** that the core prompt does not already contain. It should be possible to state what the lens would make you notice that you would otherwise miss.

## What does not belong here

- **Position lists.** What someone owns is an output of their reasoning, their cost of capital, their time horizon, and their liquidity. Copying the output while lacking the reasoning is the purest form of the narrative-over-thesis error the core prompt warns against.
- **Track records as evidence.** A large return over a short period does not establish that a method is sound, and this project's horizon is 5–10+ years. Performance belongs in a lens only as context for what the practitioner was actually betting on.
- **Anything that cannot be falsified.** Every lens must state what would show it is wrong.

## Structure of a lens file

1. **Who and what** — the practitioner, the thesis, dated and sourced.
2. **Transferable lenses** — the questions, each phrased so it can be asked of the store.
3. **What does not transfer** — mechanics that depend on being a different kind of investor. Stated explicitly, so the lens is not silently over-applied.
4. **Falsification** — what evidence would show the thesis is wrong, and what has already been tested.

## Current lenses

| Lens | Practitioner | Core question |
|---|---|---|
| [situational-awareness.md](./situational-awareness.md) | Leopold Aschenbrenner | What is the binding physical constraint on the buildout, and who owns it? |
