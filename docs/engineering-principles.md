# Transcript-derived progression principles

This roadmap is based on a human-centered evolution of AI developer workflows rather than a technology shopping list.

## Core observations

1. The basic unit is an engineer request, an agent execution, and engineer review.
2. The first autonomous loop should add one deterministic code check, such as linting.
3. Confidence should initially grow by adding formatter, linter, type checker, and tests—not by multiplying agents.
4. Agent execution and deterministic code must be separate steps so each can be tested and controlled.
5. Planning becomes explicit when vague intent causes build failures.
6. Specialist agents appear when context and expertise need separation.
7. Worktrees are an early parallelism technique, not the final isolation mechanism.
8. Sandboxes arrive when workers need computer-level isolation and inspectability.
9. Ticket systems and events should wrap a workflow that is already understood and trusted.
10. A software factory contains several specialized workflows for chores, bugs, features, security changes, and hotfixes.
11. Workflow routing should consider performance, price, speed, risk, and required expertise.
12. Human effort remains at planning and validation boundaries, with exceptions for high-risk or emergency paths.
13. Expertise should be templated into specialist workflows, prompts, skills, deterministic checks, and policies.
14. The team should manually walk every workflow before automating it.
15. Stable repeated behavior should move from agent instructions into ordinary code.

## Interpretation used by this repository

The transcript is a design philosophy, not a literal technical specification. The repository adds local robustness—clean-source checks, duplicate guards, typed ports, traces, idempotency, backups, and fault tests—without changing the human progression sequence.
