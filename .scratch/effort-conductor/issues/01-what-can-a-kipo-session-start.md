# What can a session KiPo starts actually do?

Type: research
Status: open
Blocked by:
Map: [Each effort has a conductor](../map.md)

## Question

When KiPo starts a chat session (a gateway chat slot seeded with a KiPo skill), which Kiro Crew powers does that session have? It matters whether the conductor can be an agent that acts on its own, or must ask KiPo's backend to act for it.

Find out, from Kiro Crew's docs and by trying it in a throwaway session:

- Can it start sibling sessions (`session_create`, `work_dispatch`, `spawn_run`), and do they land in KiPo's `KiPo / <repo>` sidebar folder?
- Can it arm its own wake-ups (`monitor_start`, `monitor_watch`, `cron_add`, `register_hook`)? Do they survive KiPo being closed, and what does each cost per wake?
- Are the `goal-conductor` skill and the work ledger (`work_ledger_record`, `accept_eval.py`) available to it, and what approval prompts would they raise on every round?
- Can KiPo's backend post a message into an existing slot to wake it (the reverse direction)?
- Can it run `gh` against the effort's repo with the user's credentials (needed to merge)?

Record each answer with how it was verified: docs, or a live try.
