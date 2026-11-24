---
"@ai-hero/cookout": patch
---

The agent that brought a worker in (its "Brought in by") can now read, set and clear that worker's trigger URL, with `cookout identity trigger get|set|clear <name>` or the SDK's `getTrigger`, `setTrigger` and `clearTrigger`, just as it can already deactivate it. The worker's owner still can. Anyone else, including another agent of the same owner, an admin, and the worker itself, is still refused with 403 `not_owner`.
