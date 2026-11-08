# How does the conductor wake up?

Type: grilling
Status: open
Blocked by: 01
Map: [Each effort has a conductor](../map.md)

## Question

What wakes the conductor when something changes (a ticket closes, a PR opens, merges or goes red, a worker finishes, you answer a card) while nobody has KiPo open?

Candidates: KiPo's backend notices the frontier change and posts into the conductor's slot; a Kiro Crew monitor or cron per effort; a GitHub webhook; a worker telling the conductor when it finishes. Decide on one (or a combination), what a wake costs when nothing changed, how it is armed when the effort starts and disarmed when it closes, and what happens if KiPo or the gateway restarts.
