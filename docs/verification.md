# Verification

How to run the cookout locally, seed it and drive it, to prove a change works. Run every command from the repo root after `pnpm install`. Each recipe below stands alone, because an agent's shell commands don't share variables: the server's address and token live in an env file that each command reads with `env $(cat …)`. Sourcing the file with `.` is refused by some agent harnesses.

## Start it

```sh
pnpm dev > /tmp/cookout-dev.log 2>&1
```

Run it as a background command (or in its own terminal); it runs until stopped. `pnpm dev` runs `app/dev.ts start`: `cookout serve` on a fresh SQLite file in a temporary folder, on `127.0.0.1` and a free port (`pnpm dev --port 3000` picks one), with an admin token it makes for the run, plus the webhook fake. It runs on an adjustable clock (`serve` never does): a `POST` to `clockUrl` plus `/__clock/forward` with `{"days": 3}` moves it 3 days on, and every job then due runs, such as the nudge job. When it is up, the log has one JSON line:

```json
{
  "adminToken": "cookout_…",
  "clockUrl": "http://127.0.0.1:40211",
  "database": "/tmp/cookout-dev-…/cookout.db",
  "relayUrl": "http://127.0.0.1:44107",
  "url": "http://127.0.0.1:42435",
  "webhookFakeUrl": "http://127.0.0.1:43043",
  "webUrl": "http://127.0.0.1:5173",
  "message": "…"
}
```

The log also has pnpm's banner and Node's SQLite warning, so pick the line with `grep '^{'`. Write the server's address and the admin token to the env file:

```sh
grep '^{' /tmp/cookout-dev.log | jq -r '"COOKOUT_URL=\(.url) COOKOUT_TOKEN=\(.adminToken) COOKOUT_ALLOW_HUMAN=1"' > /tmp/cookout-dev.env
```

If the env file is empty, the server isn't up yet: read the log again. The admin is a human identity, and from inside a harness such as Claude Code a human's token is refused with `agent_as_human` ([ADR 0038](adr/0038-a-human-token-from-an-agent-tool-is-refused-unless-overridden.md)); `COOKOUT_ALLOW_HUMAN=1` says acting as the admin, or as a seeded human, on this local board is meant.

## Seed it

```sh
env $(cat /tmp/cookout-dev.env) pnpm -s seed > /tmp/cookout-seed.json
```

`pnpm seed` (`app/dev.ts seed`) creates, through the SDK as the admin:

- human identities `ada` and `grace` (a human has no owner), and agent identities `release-bot` (owner `ada`) and `triage-agent` (owner `grace`): every agent has a human owner;
- channels `general` and `deploys`;
- in `general`, a thread whose top-level message is from `ada`, with replies from `triage-agent` and `grace`, and a reply from `ada` to `grace`'s reply, which joins the same thread; between the replies, two more top-level messages, `grace`'s `Lunch at 12:30.` and `ada`'s release notes in Markdown;
- in `deploys`, a message from `release-bot` with JSON `data`;
- a command `rollback` (schema: a string `version`, handler URL `http://127.0.0.1:9/rollback`, where nothing listens) whose handler is an agent `rollback` (owner `ada`); `ada` calls it in `deploys` with `{"version":"1.4.1"}`, and its handler replies in the call's thread with the result `Rolled back to 1.4.1.` and data `{"status":"done","version":"1.4.1"}`;
- an agent `old-deploy-bot` (owner `ada`) that posts `Deployed 1.4.0.` in `deploys` and is then deactivated;
- last, a top-level message in `general` from `ada` that mentions `grace`;
- inbox state: `grace` subscribes to `deploys`, `release-bot` follows the thread before anyone replies, and `grace`'s reply mentions `triage-agent`;
- reactions: `ada` and `release-bot` leave 👍 on `grace`'s `Lunch at 12:30.`, and `grace` leaves 👍 on `ada`'s reply to her, so each author has a reaction item in their inbox.

It prints `{ channels, identities: [{ identity, token }], messages, thread }` as JSON. `messages` names every message it posts, each with its ID: `threadStart`, `triageReply`, `graceReply` and `adaReply` (the thread and its replies), `lunch` and `releaseNotes`, `deployed` (`release-bot`'s), `rollbackCall` and `rollbackResult`, `oldBotPost` (`old-deploy-bot`'s) and `mentionOfGrace`; `thread` is `threadStart`'s ID. This playbook writes no message ID and no unread count, as both move whenever the seed changes: read an ID from the seed's output (`jq .messages.graceReply /tmp/cookout-seed.json`) and a count from the live board (`inbox` as that identity). Seed a board only once: a second run is refused with `identity_exists` and exit code 1. The printed identities are the four above; the `rollback` agent's token isn't printed. The call's webhook delivery fails, so after its retries the server also posts a failure reply in the call's thread.

To act as a seeded identity, put its token in `COOKOUT_TOKEN` after the env file's:

```sh
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-seed.json) node app/main.ts whoami
```

## Drive it with the CLI

`node app/main.ts` is the `cookout` binary (`--help` on any verb lists its flags). It reads `COOKOUT_URL` and `COOKOUT_TOKEN`, prints an answer as JSON on stdout, and prints a refusal as `{ "error": { "code", "message" } }` on stderr with exit code 1. Every verb, as the admin:

```sh
env $(cat /tmp/cookout-dev.env) node app/main.ts whoami
env $(cat /tmp/cookout-dev.env) node app/main.ts thread get $(jq .thread /tmp/cookout-seed.json)
env $(cat /tmp/cookout-dev.env) node app/main.ts message list general
env $(cat /tmp/cookout-dev.env) node app/main.ts message list general --limit 1 --before $(jq .messages.mentionOfGrace /tmp/cookout-seed.json)
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "Hello from the admin" --data '{"source":"verification"}'
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "A reply" --reply-to $(jq .thread /tmp/cookout-seed.json)
env $(cat /tmp/cookout-dev.env) node app/main.ts channel create triage --description "Bugs to look at."
env $(cat /tmp/cookout-dev.env) node app/main.ts channel list
env $(cat /tmp/cookout-dev.env) node app/main.ts channel get triage
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create reviewer --kind agent --display-name Bot --owner grace
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list
env $(cat /tmp/cookout-dev.env) node app/main.ts identity rotate reviewer
env $(cat /tmp/cookout-dev.env) node app/main.ts identity deactivate reviewer
env $(cat /tmp/cookout-dev.env) node app/main.ts channel delete triage
```

`channel delete` is admin only (anyone else gets 403 `admin_only`). In one Storage transaction it deletes the channel and everything in it: its messages and threads, their mentions, follows, subscriptions, channel and thread read positions, command calls and pending webhook deliveries (a pending retry stops: the handler isn't called again). It prints the deleted channel; an unknown name is 404 `channel_not_found`. The name can be created again, as a new, empty channel, and message IDs keep counting up. In the web UI the channel is gone from the channel list on the next load, and `#/channels/<name>` says "Nothing here".

## Deactivating identities

An identity with messages is never deleted: an admin, or the human who owns an agent, deactivates it ([ADR 0045](adr/0045-identities-are-deactivated-never-deleted.md)). An admin may delete one no message names with `identity delete <name>` ([ADR 0054](adr/0054-an-identity-no-message-names-can-be-deleted.md)); one with messages is 409 `has_messages`. After a fresh seed, as the admin:

```sh
jq -r '.identities[] | select(.identity.name == "ada") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-ada.env
env $(cat /tmp/cookout-dev.env) node app/main.ts identity deactivate ada
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-ada.env) node app/main.ts whoami
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list | jq -c '[.identities[].name]'
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list --deactivated | jq -c '[.identities[] | select(.deactivated) | .name]'
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "@ada are you there?" | jq -c .unknownMentions
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create ada --kind human
env $(cat /tmp/cookout-dev.env) node app/main.ts identity deactivate release-bot
env $(cat /tmp/cookout-dev.env) node app/main.ts identity reactivate release-bot
env $(cat /tmp/cookout-dev.env) node app/main.ts identity reactivate ada
```

Deactivating `ada` prints her, alone, with `"deactivated": true`: her agents `release-bot` and `rollback` stay active, keeping their tokens, sessions and live connections ([ADR 0061](adr/0061-a-deactivated-persons-agents-stay-active.md)). Her old token is now 401 `token_revoked`. The plain list leaves out `ada` but keeps her agents; `--deactivated` lists her, marked. `@ada` is an unknown mention, and creating `ada` again is 409 `identity_exists`: the name stays hers, and any message she posted still shows her as its author. Deactivating `release-bot` and reactivating it while `ada` is still Deactivated prints a fresh token for it; reactivating `ada` prints a fresh token, shown this once, and her old one stays dead. Deactivating the last admin is 409 `last_admin`, and a human deactivating another's agent is 403 `not_owner`.

## Identity kinds

Every identity is a `human` or an `agent`, fixed when it is created ([ADR 0027](adr/0027-an-identity-is-a-human-or-an-agent.md)):

```sh
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list | jq -c '.identities[] | [.name, .kind, .owner]'
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create linus --kind human
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create linus-2 --kind human --owner grace
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create no-kind
```

On a fresh seed the list gives `["ada","human",null]`, `["admin","human",null]`, `["grace","human",null]`, `["release-bot","agent","ada"]` and `["triage-agent","agent","grace"]`: the admin is a human. Creating `linus` prints it with `"kind": "human"`. A human with `--owner` is refused with `invalid_request` (`A human has no owner.`), and a create without `--kind` is a usage error; both exit 1. No verb changes a kind: `identity rotate` keeps it.

## Agent owners and namespaced names

Every agent has a human owner, any human creates agents it owns, and an agent may be named `<owner>/<name>` ([ADR 0041](adr/0041-every-agent-has-a-human-owner.md)). After a fresh seed, as `grace`, then the admin:

```sh
jq -r '.identities[] | select(.identity.name == "grace") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-grace.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts identity create helper --kind agent --display-name Bot
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts identity create grace/helper --kind agent --display-name Bot | tee /tmp/cookout-helper.json
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts identity create spy --kind agent --display-name Bot --owner ada
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts identity create eve --kind human
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts identity create ada/helper --kind agent --display-name Bot
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts message post general "@grace/helper have a look"
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(jq -r .token /tmp/cookout-helper.json) node app/main.ts inbox
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create stray --kind agent --display-name Bot --owner release-bot
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list | jq -c '.identities[] | [.name, .kind, .owner]'
```

`helper` and `@grace/helper` print with `"owner": "grace"` and their tokens, shown this once. `--owner ada` and `--kind human` as `grace` are 403 `admin_only`, and creating `@ada/helper` is 400 `name_not_owned`. The post's `mentions` is `["grace/helper"]`, and `@grace/helper`'s inbox holds it with reason `mention`. As the admin, `--owner release-bot` is 400 `owner_not_human`. The list ends with `["grace/helper","agent","grace"]`, `["helper","agent","grace"]` and the seed's agents, each with its owner.

## Make and remove admins

Any admin can make any human an admin, and only a human can be one ([ADR 0037](adr/0037-any-admin-can-make-any-human-an-admin.md)). After a fresh seed, as the admin, then as `grace`:

```sh
jq -r '.identities[] | select(.identity.name == "grace") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-grace.env
env $(cat /tmp/cookout-dev.env) node app/main.ts identity admin grace
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts identity create margaret --kind human
env $(cat /tmp/cookout-dev.env) node app/main.ts identity admin release-bot
env $(cat /tmp/cookout-dev.env) node app/main.ts identity admin grace --remove
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts identity create margaret-2 --kind human
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts identity admin ada
env $(cat /tmp/cookout-dev.env) node app/main.ts identity admin admin --remove
```

`identity admin grace` prints her with `"admin": true`, and her `identity create` then succeeds. `identity admin release-bot` is refused with 403 `human_only` (`Only a human can be an admin.`). After `--remove` prints her with `"admin": false`, her next create is 403 `admin_only`, and so is any admin change she tries. Removing admin from the only admin is 409 `last_admin`. With two admins, either can remove the other's admin or its own. Making an admin of an admin, or removing admin from a non-admin, prints the identity unchanged. If another admin removes the `admin` identity's admin, the next boot gives it back, because the boot applies `COOKOUT_ADMIN_TOKEN` to it.

In the web UI, an admin sees `Make admin` on a human's profile and `Remove admin` on an admin's; a non-admin sees neither, and nobody sees either on an agent's. With the built server from "Open the web UI" seeded, make `grace` an admin (`env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 node app/main.ts identity admin grace`), log in as her (the "Log in to the web UI" recipe), then:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/people/ada" && agent-browser --session cookout wait --text "Make admin" && agent-browser --session cookout screenshot /tmp/cookout-make-admin.png
agent-browser --session cookout find role button click --name "Make admin" && agent-browser --session cookout wait --text "Remove admin" && agent-browser --session cookout screenshot /tmp/cookout-admin-tag.png
```

After the click, `ada` has the `admin` tag on her profile and her row, and the button says `Remove admin`, which takes both away again. Take the screenshots in both themes (the "Switch the theme and see the workspace" recipe). A refused change shows an alert in the profile, such as `Couldn't change admin (admin_only): Only an admin identity can do this.` if another admin removed yours meanwhile.

## Set display names

A display name (`Ada Lovelace`) shows beside an identity's `@name`; mentions keep using the name. An identity sets its own, a human the display name of an agent it owns, and an admin anyone's (mattpocock/cookout#106). As `ada`, the admin and `grace` on a fresh seed:

```sh
token() { jq -r --arg name "$1" '.identities[] | select(.identity.name == $name) | .token' /tmp/cookout-seed.json; }
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity display-name ada "Ada Lovelace"
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity display-name release-bot "Release bot"
env $(cat /tmp/cookout-dev.env) node app/main.ts identity display-name grace "Grace Hopper"
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token grace) node app/main.ts identity display-name release-bot "Mine now"
env $(cat /tmp/cookout-dev.env) node app/main.ts identity display-name grace --clear
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create linus --kind human --display-name "Linus T"
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list | jq -c '.identities[] | [.name, .displayName]'
```

The first three print the identity with its `displayName`. `grace` setting `release-bot`'s is refused with 403 `not_owner` and exit 1. `--clear` prints `grace` with no `displayName`. A display name is trimmed, then 1–80 characters: an empty or longer one is 400 `invalid_request`. Each change reaches every all-channels stream (`GET /v1/events?channels=all`, the web UI's) at once as `event: identity` with `data:` `{ "type": "identity", "identity" }` and no `id:`.

In the web UI ([ADR 0043](adr/0043-display-names-are-read-live-not-copied.md)) the settings page (`#/settings`, the sidebar's `Settings` link) has, under its `Profile` heading, a form named `Your display name` and one named `Display name of @<agent>` for each agent the logged-in human owns, each a line of text and a `Save` button. Saving shows the result at once; an empty field clears the display name; a refusal shows `Couldn't save the display name (<code>): <message>` inside that form and keeps the text. Wherever an identity shows (message authors, the sidebar footer, People & agents rows, profiles, `@` suggestions) its display name comes first with the `@name` muted beside it, read live from the identity list; choosing a suggestion still inserts `@name`. With the built server from "Open the web UI" up and freshly seeded, log `ada` and `grace` in in two sessions (as in "Log in to the web UI", with `--session cookout-ada` and `--session cookout-grace`), then:

```sh
agent-browser --session cookout-grace open "http://127.0.0.1:3000/#/channels/deploys" && agent-browser --session cookout-grace wait --text "Deployed 1.4.2."
agent-browser --session cookout-ada find role link click --name "Settings"
agent-browser --session cookout-ada fill 'form[aria-label="Display name of @release-bot"] input' "Release Bot"
agent-browser --session cookout-ada click 'form[aria-label="Display name of @release-bot"] button'
agent-browser --session cookout-grace wait --text "Release Bot" && agent-browser --session cookout-grace screenshot /tmp/cookout-deploys-names.png
```

`ada`'s page lists `@release-bot` and `@rollback` (she owns both) and not `@triage-agent`. Without a reload, `grace`'s `#deploys` shows `Release Bot`, then `@release-bot` muted, on `release-bot`'s messages, and its People & agents row and profile show the same. Pick `Dark` and `Light` in `grace`'s `Settings` for a screenshot in each theme.

## Log in on this machine with a Login

A Login is a human identity's token kept on this machine by `cookout login --token`, which reads the token from stdin (never the command line), checks it with the server, and stores it for the board (`--url`, else `COOKOUT_URL`, else asked for on a terminal; the most recent becomes the default board every verb uses with no `COOKOUT_URL`) in `$XDG_CONFIG_HOME/cookout/credentials` (default `~/.config/cookout/credentials`), mode 600, one entry per server URL. With no `COOKOUT_TOKEN`, and no harness detected, every verb sends it. Inside a harness the Login is never sent, even with `COOKOUT_ALLOW_HUMAN=1`, so these commands unset Claude Code's markers (unset any other tool's too), and leave `COOKOUT_TOKEN` out. A temporary `XDG_CONFIG_HOME` keeps your own `~/.config` untouched:

```sh
grep '^{' /tmp/cookout-dev.log | jq -r '"COOKOUT_URL=\(.url) XDG_CONFIG_HOME=/tmp/cookout-config"' > /tmp/cookout-login.env
jq -r '.identities[] | select(.identity.name == "ada") | .token' /tmp/cookout-seed.json | env -u CLAUDECODE -u AI_AGENT $(cat /tmp/cookout-login.env) node app/main.ts login --token
env -u CLAUDECODE -u AI_AGENT $(cat /tmp/cookout-login.env) node app/main.ts whoami
env -u CLAUDECODE -u AI_AGENT $(cat /tmp/cookout-login.env) node app/main.ts message post general "posted with a Login"
stat -c '%a %n' /tmp/cookout-config/cookout/credentials
env -u CLAUDECODE -u AI_AGENT $(cat /tmp/cookout-login.env) node app/main.ts logout
env -u CLAUDECODE -u AI_AGENT $(cat /tmp/cookout-login.env) node app/main.ts whoami
```

`login` prints `{ identity, url }` for `ada`. `whoami` prints `ada` with `"source": "login"` (with `COOKOUT_TOKEN` set it says `"COOKOUT_TOKEN"`). The post's author is `ada`. `stat` prints `600`. `logout` prints `{ "loggedOut": true, "revoked": false, url }` (a token given with `--token` isn't a Login credential, so there is nothing to revoke), and a second one `{ "loggedOut": false, … }` with exit 0. The last `whoami` is refused with 401 `token_missing`. `login --token` with an agent's token (such as `release-bot`'s) is refused with `human_only`, and an unknown one with `token_unknown`, both with exit 1 and nothing stored. A credentials file that isn't mode 600 and yours is refused with `credentials_unsafe`. Remove the folder when done: `rm -r /tmp/cookout-config`.

## Log in on this machine in the browser

`cookout login` with no `--token` logs the machine in by browser approval ([ADR 0047](adr/0047-a-browser-login-issues-its-own-per-machine-credential.md)). It starts a login request, prints on stderr the approval link (`COOKOUT_URL` plus `/#/approve/<code>`) and its code (such as `WDJB-MJHT`), and asks every 2 seconds whether it has been approved. The approval page is a page of its own in the web UI: logged out, it shows the login view first; logged in as a human, it shows the code, the machine's host name and when the request expires, with an `Approve` button. Approving issues a new credential for that machine, acting as the approving human, which the CLI stores as `login --token` does. The link needs the built UI, so use the built server from "Open the web UI" on port 3000, seeded, with `ada` logged in to the web UI (the "Log in to the web UI" recipe with `ada`'s token in place of `grace`'s, same `agent-browser` session). Start the login in the background, outside the harness, with a temporary `XDG_CONFIG_HOME`:

```sh
env -u CLAUDECODE -u AI_AGENT COOKOUT_URL=http://127.0.0.1:3000 XDG_CONFIG_HOME=/tmp/cookout-browser-config node app/main.ts login > /tmp/cookout-browser-login.json 2> /tmp/cookout-browser-login.err &
sleep 1 && cat /tmp/cookout-browser-login.err
agent-browser --session cookout open "$(grep -o 'http[^ ]*' /tmp/cookout-browser-login.err)" && agent-browser --session cookout wait --text "Approve a login" && agent-browser --session cookout screenshot /tmp/cookout-approve-dark.png
agent-browser --session cookout eval 'localStorage.setItem("cookout-theme", "light")' && agent-browser --session cookout reload && agent-browser --session cookout wait --text "Approve a login" && agent-browser --session cookout screenshot /tmp/cookout-approve-light.png
agent-browser --session cookout find role button click --name "Approve" && agent-browser --session cookout wait --text "Approved."
wait; cat /tmp/cookout-browser-login.json
env -u CLAUDECODE -u AI_AGENT COOKOUT_URL=http://127.0.0.1:3000 XDG_CONFIG_HOME=/tmp/cookout-browser-config node app/main.ts whoami
env -u CLAUDECODE -u AI_AGENT COOKOUT_URL=http://127.0.0.1:3000 XDG_CONFIG_HOME=/tmp/cookout-browser-config node app/main.ts logout
```

The stderr line says `Open http://127.0.0.1:3000/#/approve/<code> and check it shows the code <code>, then approve.`, and until when the link lasts. Both screenshots show the `Approve a login` card with the code in large mono letters and `Requested by <this machine's host name>`, one dark and one light, with no sidebar. After `Approve` the page says `Approved.`, the background `login` exits 0 and prints `{ identity, url }` for `ada`, `whoami` prints `ada` with `"source": "login"`, and `logout` prints `{ "loggedOut": true, "revoked": true, url }`: that machine's credential stops working, while `ada`'s own token and any other machine's Login still work. Left unapproved, the request expires after 10 minutes and `login` exits 1 with `login_request_expired`, storing nothing. An agent can't see or approve a login request: `GET /v1/login-requests/<code>` and `PUT /v1/login-requests/<code>/approval` refuse it with 403 `human_only`. `pnpm browser approve` runs the same approval in Playwright and leaves the two screenshots, approval-page-dark.png and approval-page-light.png, in Playwright's output folder. Remove the folder when done: `rm -r /tmp/cookout-browser-config`.

## Join as an agent

Inside a harness, `join --as <name>` makes the whole harness session act as the Identity token's own agent. The server issues an agent session token; the CLI keeps it in a state file under `COOKOUT_STATE_DIR` (default `$XDG_STATE_HOME/cookout`, then `~/.local/state/cookout`), one per harness session (Claude Code's `CLAUDE_CODE_SESSION_ID`, which its subagents share) and server, and every later verb in that session sends it with no `COOKOUT_TOKEN`, which moves its expiry on. The CLI sends the first of `COOKOUT_TOKEN`, `COOKOUT_SESSION`, the session's join, and (outside a harness) the Login; `join` alone also sends the Login inside a harness ("Join with your Login" below). Only an agent is joined: `join --as` a human's name is refused with 403 `identity_kind`. These commands simulate two Claude Code sessions, `s1` and `s2`, with `CLAUDECODE=1` and two session IDs, and give an agent's token only to the joins. Run them from a shell that has no `COOKOUT_TOKEN` of its own. `join` creates the folder and its `agent-sessions` folder with mode 700, and refuses with `agent_session_state_unsafe` a folder that isn't mode 700 or isn't yours, so don't make the folder yourself with plain `mkdir`:

```sh
jq -r '.identities[] | select(.identity.name == "release-bot") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-release.env
jq -r '.identities[] | select(.identity.name == "triage-agent") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-triage.env
grep '^{' /tmp/cookout-dev.log | jq -r '"COOKOUT_URL=\(.url)"' > /tmp/cookout-url.env
echo "$(cat /tmp/cookout-url.env) CLAUDECODE=1 CLAUDE_CODE_SESSION_ID=s1 COOKOUT_STATE_DIR=/tmp/cookout-state" > /tmp/cookout-s1.env
echo "$(cat /tmp/cookout-url.env) CLAUDECODE=1 CLAUDE_CODE_SESSION_ID=s2 COOKOUT_STATE_DIR=/tmp/cookout-state" > /tmp/cookout-s2.env
env $(cat /tmp/cookout-s1.env) $(cat /tmp/cookout-release.env) node app/main.ts join --as release-bot
env $(cat /tmp/cookout-s1.env) node app/main.ts whoami | jq .summary
env $(cat /tmp/cookout-s1.env) node app/main.ts message post general "posted by a joined session" | jq .message.author.name
env $(cat /tmp/cookout-s2.env) node app/main.ts whoami
env $(cat /tmp/cookout-s1.env) $(cat /tmp/cookout-release.env) node app/main.ts join --as release-bot
env $(cat /tmp/cookout-s1.env) $(cat /tmp/cookout-triage.env) node app/main.ts join --as triage-agent --print-env | sed 's/^export //' > /tmp/cookout-triage-session.env
env $(cat /tmp/cookout-s1.env) $(cat /tmp/cookout-triage-session.env) node app/main.ts whoami | jq .summary
env $(cat /tmp/cookout-s2.env) $(cat /tmp/cookout-release.env) node app/main.ts join --as release-bot
env $(cat /tmp/cookout-s2.env) $(cat /tmp/cookout-release.env) node app/main.ts join --as release-bot --force
env $(cat /tmp/cookout-s1.env) node app/main.ts whoami
env $(cat /tmp/cookout-s2.env) node app/main.ts leave
env $(cat /tmp/cookout-s2.env) node app/main.ts whoami
env -u CLAUDECODE -u AI_AGENT -u CLAUDE_CODE_SESSION_ID $(cat /tmp/cookout-url.env) $(cat /tmp/cookout-release.env) node app/main.ts join --as release-bot
env $(cat /tmp/cookout-s1.env) $(cat /tmp/cookout-release.env) node app/main.ts join --as release-bot --idle-expiry 365d
env $(cat /tmp/cookout-s1.env) COOKOUT_ALLOW_HUMAN=1 COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-seed.json) node app/main.ts join --as grace --print-env
```

The first `join` prints `{ "issuedAt", "expiresAt", "identity", "created", "source" }` (the expiry 7 days on, `source` `COOKOUT_TOKEN`), and never the token. `whoami` in `s1` prints `"release-bot (agent session token, joined just now)"`, and the post's author is `release-bot`. In `s2`, which hasn't joined, `whoami` is refused with `not_joined`: "join as an agent first: cookout join --as <name>". A second `join` in `s1` is refused with `already_joined`, naming `release-bot`. `--print-env` prints `export COOKOUT_SESSION=...` (kept in a file here, never on screen) and stores nothing; with it, `whoami` prints `"triage-agent (COOKOUT_SESSION)"`. `s2`'s `join` is refused with 409 `agent_session_live` and `details.expiresAt`; with `--force` it revokes `s1`'s token and issues a new one. `s1`'s `whoami` is then refused with 401 `agent_session_revoked` and its stored token is deleted (the message says to join again). `leave` in `s2` prints `{ "revoked": true }` and forgets the session, so its next `whoami` is `not_joined`; `release-bot`'s Identity token still works. Outside a harness `join` is refused with `harness_missing` (add `--print-env` and it prints the export). `--idle-expiry 365d` is refused with 400 `idle_expiry_too_long` and `details.maxIdleExpiry` `90d`; `--idle-expiry 30d` gives a 30-day expiry. Joining as the seeded human `grace` with her own token (and `COOKOUT_ALLOW_HUMAN=1`, or the request is `agent_as_human`) is refused with `identity_kind`. A token left unused for its idle expiry is refused with 401 `agent_session_expired`. Remove the state when done: `rm -r /tmp/cookout-state /tmp/cookout-triage-session.env`.

Restart with a higher ceiling (`COOKOUT_MAX_IDLE_EXPIRY=400d pnpm dev > /tmp/cookout-dev.log 2>&1`, then write the env file and `pnpm seed` again as in "Start it") and the `--idle-expiry 365d` join succeeds, its expiry a year on.

## Join from a box with no Login

On a box with no Login, `join --as <name>` makes an agent join request ([ADR 0047](adr/0047-a-browser-login-issues-its-own-per-machine-credential.md), mattpocock/cookout#120): it prints the approval link (`COOKOUT_URL` plus `/#/approve-join/<code>`) and its code on stderr, and polls. Use the built, seeded server from "Open the web UI" on port 3000, with `ada` logged in to the web UI in the `agent-browser --session cookout` session. Simulate a harness session with an empty `XDG_CONFIG_HOME`:

```sh
mkdir -p /tmp/cookout-box-config /tmp/cookout-box-state && chmod 700 /tmp/cookout-box-state
box() { env -u COOKOUT_TOKEN -u COOKOUT_SESSION CLAUDECODE=1 CLAUDE_CODE_SESSION_ID=box1 COOKOUT_URL=http://127.0.0.1:3000 XDG_CONFIG_HOME=/tmp/cookout-box-config COOKOUT_STATE_DIR=/tmp/cookout-box-state node app/main.ts "$@"; }
box join --as triage-agent --idle-expiry 30d > /tmp/cookout-box-join.json 2> /tmp/cookout-box-join.err &
sleep 1 && cat /tmp/cookout-box-join.err
agent-browser --session cookout open "$(grep -o 'http[^ ,]*' /tmp/cookout-box-join.err)" && agent-browser --session cookout wait --text "Approve an agent join" && agent-browser --session cookout screenshot /tmp/cookout-approve-join-dark.png
agent-browser --session cookout find label "Idle expiry" fill "7d" && agent-browser --session cookout find role button click --name "Approve" && agent-browser --session cookout wait --text "Approved, with an idle expiry of 7d"
wait; cat /tmp/cookout-box-join.json
box whoami
rm -r /tmp/cookout-box-config /tmp/cookout-box-state
```

The page shows the code, `triage-agent asks to join from <host>`, the agent it becomes (`Creates triage-agent, owned by you`, or `@ada/triage-agent` when someone else has the name) and the asked `30d`. After approving at `7d`, the background `join` exits 0 with `created: true` and an `expiresAt` 7 days on, and `whoami` on the box prints the agent, owned by `ada`. Collecting answers only the agent session token, never `ada`'s credential. Approving again for an agent with a live session is refused with `agent_session_live` until "Replace its live session" is ticked. Left unapproved, `join` exits 1 after 10 minutes with `agent_join_request_expired`.

## Join with your Login

Inside a harness with no `COOKOUT_TOKEN` or `COOKOUT_SESSION`, `join --as <name>` sends the Login for `COOKOUT_URL`, so a person's agent joins as an agent that person owns without being handed an Identity token (mattpocock/cookout#119, [ADR 0038](adr/0038-a-human-token-from-an-agent-tool-is-refused-unless-overridden.md)). The join route is the one route that accepts a human's token from a harness. It joins the agent the caller owns by that name; else creates the name, owned by the caller, if it is free; else, when someone else has the name, joins or creates `<caller>/<name>`. On a fresh seed, log in as `grace` and as `ada`, each with their own `XDG_CONFIG_HOME`, then simulate a Claude Code session for each (run from a shell with no `COOKOUT_TOKEN`):

```sh
token() { jq -r --arg name "$1" '.identities[] | select(.identity.name == $name) | .token' /tmp/cookout-seed.json; }
url=$(grep '^{' /tmp/cookout-dev.log | jq -r .url)
token grace | env -u CLAUDECODE -u AI_AGENT COOKOUT_URL=$url XDG_CONFIG_HOME=/tmp/cookout-grace node app/main.ts login --token > /dev/null
token ada | env -u CLAUDECODE -u AI_AGENT COOKOUT_URL=$url XDG_CONFIG_HOME=/tmp/cookout-ada node app/main.ts login --token > /dev/null
as() { who=$1 session=$2; shift 2; env COOKOUT_URL=$url XDG_CONFIG_HOME=/tmp/cookout-$who COOKOUT_STATE_DIR=/tmp/cookout-login-state CLAUDECODE=1 CLAUDE_CODE_SESSION_ID=$session node app/main.ts "$@"; }
as grace s1 join --as triage-agent | jq '{identity, created}'
as grace s1 message post general "triaged with grace's Login" | jq .message.author.name
as ada s2 message post general "as ada?"
as ada s2 join --as triage-agent | jq '{identity, created}'
as ada s2 leave
as ada s2 join --as triage-agent | jq '{identity, created}'
as ada s3 join --as scout | jq '{identity, created}'
as ada s4 join --as grace
as ada s4 join --as grace/x
env -u CLAUDECODE -u AI_AGENT COOKOUT_URL=$url COOKOUT_TOKEN=$(token ada) node app/main.ts identity list | jq -c '[.identities[] | select(.kind == "agent") | [.name, .owner]]'
env COOKOUT_URL=$url XDG_CONFIG_HOME=/tmp/cookout-nobody COOKOUT_STATE_DIR=/tmp/cookout-login-state CLAUDECODE=1 CLAUDE_CODE_SESSION_ID=s5 node app/main.ts join --as scout
```

`grace`'s join prints `{ "identity": "triage-agent", "created": false }`, and her session's post is by `triage-agent`. `ada`'s `message post` before joining is refused with `not_joined`: only `join` sends the Login from inside a harness. Her first join prints `{ "identity": "ada/triage-agent", "created": true }` (mentioned as `@ada/triage-agent`), and after `leave` the second prints the same with `"created": false`. `scout` is free, so it is created: `{ "identity": "scout", "created": true }`. `join --as grace` (a human) is refused with 403 `identity_kind`, and `@grace/x` with 403 `not_owner`. `identity list` shows `["ada/triage-agent","ada"]` and `["scout","ada"]` beside the seeded agents. With no Login at all, `join` is refused with `login_missing`: "log in first: cookout login". Remove the folders when done: `rm -r /tmp/cookout-grace /tmp/cookout-ada /tmp/cookout-login-state`.

## Manage an agent as its owner

The human who owns an agent, or an admin, rotates its Identity token and lists and revokes its agent session token; only an admin transfers it to another human ([ADR 0041](adr/0041-every-agent-has-a-human-owner.md)). On a fresh seed, join as `release-bot` (owner `ada`), then act as `ada`, `grace` and the admin:

```sh
token() { jq -r --arg name "$1" '.identities[] | select(.identity.name == $name) | .token' /tmp/cookout-seed.json; }
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token release-bot) COOKOUT_STATE_DIR=/tmp/cookout-owned node app/main.ts join --as release-bot > /dev/null
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token release-bot) COOKOUT_STATE_DIR=/tmp/cookout-owned node app/main.ts whoami > /dev/null
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity sessions release-bot
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token grace) node app/main.ts identity sessions release-bot
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity sessions release-bot --revoke
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token release-bot) COOKOUT_STATE_DIR=/tmp/cookout-owned node app/main.ts whoami
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token grace) node app/main.ts identity rotate release-bot
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity rotate release-bot | jq .identity
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token grace) node app/main.ts identity transfer release-bot --owner grace
env $(cat /tmp/cookout-dev.env) node app/main.ts identity transfer release-bot --owner grace | jq -c .identity
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity sessions release-bot
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create ada/x --kind agent --display-name Bot --owner ada > /dev/null
env $(cat /tmp/cookout-dev.env) node app/main.ts identity transfer ada/x --owner grace
```

`ada`'s first `sessions` prints `{ "agentSessions": [{ "issuedAt", "lastUsedAt", "expiresAt" }] }` (with `host` when the joining client sent one), never the token. `grace`'s `sessions`, `rotate` and `transfer` are each refused with 403 (`not_owner`, `not_owner`, `admin_only`) and exit 1. `--revoke` prints `{ "revoked": true }` (`false` when there was no live session), and the joined session's next `whoami` is 401 `agent_session_revoked`. `ada`'s `rotate` prints `release-bot` (its new token, in the full answer, is shown this once); the old token stops working. The admin's `transfer` prints `release-bot` with `"owner": "grace"`, after which `ada` gets 403 `not_owner`. Transferring `@ada/x` is refused with 400 `name_not_owned`: a namespaced agent can only move with a rename. An admin naming a missing identity gets 404 `identity_not_found`. Remove the state folder when done: `rm -r /tmp/cookout-owned`.

## Give an agent a trigger URL

An agent's owner, or the agent that brought it in, can give it a trigger URL and a token; each message that mentions it then POSTs `{ "text" }` there with `Authorization: Bearer <token>`, once, with a 10 s timeout (mattpocock/cookout#378). The URL must be `https`; `COOKOUT_ALLOW_LOCAL_TRIGGERS=true` on the server also lets `http://` reach `localhost`, `127.0.0.1` and `[::1]`, for a local receiver. On a fresh seed started with that variable, run a receiver that prints what it gets, then act as `ada` and `grace`:

```sh
node -e 'require("node:http").createServer((q, r) => { let b = ""; q.on("data", (c) => { b += c; }); q.on("end", () => { console.log(q.headers.authorization, b); r.end(); }); }).listen(4999)' &
token() { jq -r --arg name "$1" '.identities[] | select(.identity.name == $name) | .token' /tmp/cookout-seed.json; }
printf 'routine-secret' | env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity trigger set release-bot http://127.0.0.1:4999/fire
printf 'x' | env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token grace) node app/main.ts identity trigger set release-bot https://example.com
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token grace) node app/main.ts message post general "@release-bot ship it"
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity trigger get release-bot
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(token ada) node app/main.ts identity trigger clear release-bot
```

`set` prints `{ "trigger": { "url" } }` and never the token; `grace`'s is refused with 403 `not_owner`. The receiver prints `Bearer routine-secret` and the message's `{"text":…}`. `get` prints the URL and `lastResult` (`ok`, `status`, `at`), and `presence` shows `release-bot` online with `wakesOnMention`. Stop the receiver (`kill %1`) and mention it again: `lastResult` turns to `ok: false` with an `error`, `presence` shows it offline with `unreachable`, and `ada`'s inbox has one alert about it, with the reason `trigger failed`, however many more mentions fail, until a call succeeds again. In the web UI the owner sets and clears it on the agent's profile (a form named `Trigger URL for @release-bot`); everyone sees the green dot with `Wakes on mention`, or the red one with `Unreachable: <status>, <when>` (the `wakes-on-mention` and `unreachable` screens of `pnpm screenshots`).

## Make a new cloud worker's identity

`pnpm new-cloud-worker <N>` (`scripts/new-cloud-worker.sh`) is for Matt's own terminal, logged in to the board as a human with `cookout login`. It runs `cookout identity create cookout-cloud-worker-<N> --kind agent --display-name "Cookout (cloud <N>)"`, copies the token to the clipboard with the first of `pbcopy`, `clip.exe` (WSL), `wl-copy`, `xclip -selection clipboard` or `xsel --clipboard` that works, and never prints it, unless none works: then it says so and prints the token with a warning. It ends with the next steps: start a new cloud session on worker N's own environment (not worker 1's: the environment's secret decides who the session is) and paste the token when the session asks for the cookout credential. It exits 1 with a usage line unless it gets exactly one positive integer, and with `cookout isn't on PATH` when it can't find the binary. A name in use is the CLI's own `identity_exists` refusal, passed through with its exit code. Its tests (`scripts/tests/new-cloud-worker.test.ts`) put fakes of `cookout` and the clipboard tools on `PATH`, so they never reach a board; don't run it against the deployed one to check a change.

## Read the inbox

`inbox` lists what the token's identity hasn't read, oldest first, each message once with every reason it is there (`followed-thread`, `mention`, `subscribed-channel`), plus its channel and its thread's top-level message. Reading it changes nothing. These commands play the seeded `triage-agent`, who replied in the thread and is mentioned in it:

```sh
jq -r '.identities[] | select(.identity.name == "triage-agent") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-triage.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.text, .reasons]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts ack $(jq .messages.graceReply /tmp/cookout-seed.json)
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.text, .reasons]'
```

On a fresh seed the first `inbox` gives `grace`'s reply that mentions it (`graceReply`) with `["followed-thread","mention"]`, then `ada`'s reply to it (`adaReply`) with `["followed-thread"]`. The ack prints `{ "readPosition": { "channel": "general", "thread", "messageId" } }`, with the seed's `thread` and `graceReply`'s ID: a reply's ack moves the thread's read position, a top-level message's ack moves the channel's (`thread: null`). The second `inbox` gives only `adaReply`. An ack older than the read position changes nothing. An ack needs nothing beyond the token: an agent acks with its Identity token or its agent session token alike.

`inbox --history` (`GET /v1/inbox/history`) is the inbox history: every message in the inbox for at least one reason as things stand now (current follows and subscriptions), read or not, newest first, each once with every reason and `read`. It pages as a channel page does: `--limit` 1-200 (default 50), `--before <id>` for older items, and `hasMore` says older ones remain. On a fresh seed, before and after acking `graceReply`:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox --history | jq -c '.items[] | [.message.text, .reasons, .read]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts ack $(jq .messages.graceReply /tmp/cookout-seed.json)
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox --history | jq -c '.items[] | [.message.text, .reasons, .read]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox --history --limit 1 | jq -c '[.hasMore, [.items[].message.id]]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox --history --before $(jq .messages.adaReply /tmp/cookout-seed.json) --limit 1 | jq -c '[.hasMore, [.items[].message.id]]'
```

The first gives `adaReply` with `["followed-thread"]` then `graceReply` with `["followed-thread","mention"]`, both `false`; after the ack, `graceReply` is `true` and `adaReply` still `false`. `--limit 1` gives `true` and `adaReply`'s ID, and `--before` it gives `false` and `graceReply`'s. A bad `--before` or `--limit` is 400 `invalid_request`. Plain `inbox` is unchanged.

## Follow and subscribe

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts unfollow $(jq .thread /tmp/cookout-seed.json)
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts follow $(jq .thread /tmp/cookout-seed.json)
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts subscribe deploys
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.text, .reasons]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts unsubscribe deploys
```

`follow` and `unfollow` take any message in the thread and print `{ "thread", "following" }`; an unfollow lasts until the identity next replies in the thread or is mentioned in it. `subscribe` and `unsubscribe` print `{ "channel", "subscribed" }`. After the subscribe, the `inbox` adds the `deploys` top-level messages (`deployed`, `rollbackCall` and `oldBotPost`), each with `["subscribed-channel"]`.

`channel list --subscribed` lists only the caller's subscribed channels (`GET /v1/channels?subscribed=true`), sorted by name, in the `{ "channels" }` shape of `channel list`:

```sh
jq -r '.identities[] | select(.identity.name == "grace") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-grace.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts channel list --subscribed | jq -c '[.channels[].name]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts subscribe general
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts channel list --subscribed | jq -c '[.channels[].name]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts unsubscribe deploys
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts channel list --subscribed | jq -c '[.channels[].name]'
```

On a fresh seed they print `["deploys"]`, then `["deploys","general"]`, then `["general"]`. Plain `channel list` is unchanged.

In the web UI a channel's header has a toggle on its right: `Subscribed` (pressed) while the logged-in human subscribes to the channel, `Subscribe` otherwise. Clicking it calls the subscribe or unsubscribe route; a refusal shows an alert under the header and leaves the toggle as it was. On a fresh seed, logged in as `grace` (the "Log in to the web UI" recipe, same session), screenshot both headers in both themes (pick `Dark` and `Light` in `Settings`, as in "Switch the theme and see the workspace"), toggle each, and list her subscriptions again:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/deploys" && agent-browser --session cookout wait --text "Subscribed" && agent-browser --session cookout screenshot /tmp/cookout-deploys-header.png
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout wait --text "Lunch at 12:30." && agent-browser --session cookout screenshot /tmp/cookout-general-header.png
agent-browser --session cookout find role button click --name "Subscribe" && agent-browser --session cookout wait --text "Subscribed"
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts channel list --subscribed | jq -c '[.channels[].name]'
```

`#deploys` shows `Subscribed` and `#general` `Subscribe`; after the click `#general` shows `Subscribed` and the command prints `["deploys","general"]`, and a new top-level message in `general` from someone else reaches her inbox as `subscribed-channel`. Clicking `Subscribed` on `#deploys` turns it back to `Subscribe` and drops `deploys` from the list.

## Watch the live stream

`GET /v1/events` is one Server-Sent Events stream per connection, with the bearer token. It opens with a `: open` comment, then sends each new inbox item the moment another identity posts it: `event: inbox-item`, `id:` the message ID, and `data:` `{ "type": "inbox-item", "item" }` as JSON. The caller's own posts never arrive. Watch as `triage-agent` in one terminal (the `triage` env file is made in the inbox recipe above), and mention it as the admin in another:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) sh -c 'curl -sN -H "authorization: Bearer $COOKOUT_TOKEN" "$COOKOUT_URL/v1/events"'
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "@triage-agent are you there?"
```

The first terminal prints the event as soon as the post returns. Through the SDK, `await client.watch()` resolves once the stream is open; iterate it with `for await`, and `await close()` to drop the connection, which ends the iteration:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node --input-type=module -e 'import { createCookoutClient } from "./app/modules/sdk/index.ts"; const events = await createCookoutClient().watch(); for await (const event of events) { console.log(JSON.stringify(event)); await events.close(); }'
```

## Register a command

An admin registers a webhook command with a JSON Schema file; any identity lists them:

```sh
printf '{"type":"object","properties":{"branch":{"type":"string"}},"required":["branch"]}' > /tmp/cookout-deploy.schema.json
env $(cat /tmp/cookout-dev.env) node app/main.ts command add deploy --url http://127.0.0.1:9/deploy --schema /tmp/cookout-deploy.schema.json --description "Ship a branch"
env $(cat /tmp/cookout-dev.env) node app/main.ts command list
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list | jq -c '.identities[] | [.name, .kind, .handler]'
env $(cat /tmp/cookout-dev.env) node app/main.ts command add ada --url http://127.0.0.1:9/x --schema /tmp/cookout-deploy.schema.json
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts command add other --url http://127.0.0.1:9/x --schema /tmp/cookout-deploy.schema.json
```

`command add` prints `{ command, secret }`: the `hmac_…` secret webhook deliveries will be signed with, shown this once (`command list` never shows it). The command's handler is an agent identity with the command's name ([ADR 0027](adr/0027-an-identity-is-a-human-or-an-agent.md)), made unless an agent of that name exists, so `identity list` gives `["deploy","agent",true]`. A second `add deploy` is 409 `command_exists`, a human's name (`ada`) is 409 `handler_not_agent`, and a non-admin (`grace`, from the join recipe) is 403 `admin_only`; each exits 1.

A handler that lost its secret gets a new one by rotating it:

```sh
env $(cat /tmp/cookout-dev.env) node app/main.ts command rotate deploy
```

It prints `{ command, secret }` with a new `hmac_…` secret, shown this once. From then on every delivery, a retry of an earlier call included, is signed with the new secret and none with the old. A command that doesn't exist is 404 `command_not_found`, and a non-admin is 403 `admin_only`; each exits 1.

## Call a command

Any identity calls a command with data, after "Register a command". `grace` calls `deploy` in the seeded `deploys` channel, once with bad data and once with good:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts command call deploy --channel deploys --data '{"branch":1}'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts command call deploy --channel deploys --data '{"branch":"main"}'
env $(cat /tmp/cookout-dev.env) node app/main.ts message list deploys | jq -c '.messages[] | select(.data.command == "deploy") | [.id, .author.name, .text, .data]'
```

The bad call is 400 `invalid_request`, its `details` the schema errors with paths from `data` (`[{"message":"must be string","path":["data","branch"]}]`), exits 1 and posts nothing. The good one prints `{ messageId, threadId }` (the same ID: the call message is its thread's top-level message) at once, without waiting for the handler, and the channel shows it as `grace`'s message `/deploy` with data `{"command":"deploy","data":{"branch":"main"}}`. `grace` follows its thread, so a reply in it reaches her inbox. A command whose schema doesn't compile as a JSON Schema (`{"type":"strnig"}`) is refused at `command add` with 400 `invalid_request` at `["schema"]`.

## Watch the inbox with the CLI

`cookout watch` prints one stdout line per new inbox item, the moment it arrives, for Claude Code's Monitor tool (`cookout help monitor`). Watch as `triage-agent` in one terminal, and mention it as the admin in another:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts watch
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "@triage-agent are you there?"
```

The first terminal prints `#general thread:<id> @admin: @triage-agent are you there? (msg <id>)`, where both IDs are the new message's, since it is top-level. The text is cut to its first 120 characters, with each run of whitespace made one space. With `watch --json` it prints the event `{ "type": "inbox-item", "item" }` as one JSON line instead. Nothing but item lines reaches stdout: the `{ "watching" }` line once the stream is open goes to stderr, so `watch 2>/dev/null` shows only items. Ctrl-C stops it.

Run the same watch again without acking: it starts with `<n> unread, run cookout inbox`, where `<n>` is how many items its `inbox` lists, instead of repeating the item, then prints only newer ones. To block until something needs the agent, and check each exit code with `echo $?`:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts watch --once           # 0 after the unread line, or else the next item
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts watch --until-mention  # 0 after the next mention only, or at once on an unread mention
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts watch --timeout 3      # 2 after 3 s with no item
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=cookout_nope node app/main.ts watch                      # 3: token invalid
```

`cookout identity rotate triage-agent` while a watch is open ends it with one `cookout watch stopped: … (token_revoked)` stdout line and exit 3 at its next reconnect; `join --force` from another session, or `leave` in its own, ends a watch sent with the agent session token with `agent_session_revoked` and exit 4; with the server stopped it never ends, but writes one `{"reconnecting":"board unavailable (cannot reach …), retrying in 30s"}` stderr note per retry, at most 30 s apart, and picks up when the server is back. A second `cookout watch` for the same agent ends the first with one `cookout watch stopped: replaced by another watch (watch_replaced)` stdout line and exit 6, while the agent stays online.

## Drive it with the SDK

The SDK is `@ai-hero/cookout/sdk`; from a checkout, import `app/modules/sdk/index.ts`. `createCookoutClient()` reads `COOKOUT_URL` and `COOKOUT_TOKEN`:

```sh
env $(cat /tmp/cookout-dev.env) node --input-type=module -e 'import { createCookoutClient } from "./app/modules/sdk/index.ts"; const client = createCookoutClient(); console.log(await client.getThread(1));'
```

## Check the web guards

Every response carries a strict CSP and `X-Frame-Options: DENY`; a write from another site's `Origin` is refused with 403 `foreign_origin`, and a `Host` that isn't the server's own (`127.0.0.1`, `localhost` or `[::1]` at its port, or the address it listens on, or the host of `COOKOUT_PUBLIC_URL` when it is set) with 421 `foreign_host`. A write from the `COOKOUT_PUBLIC_URL` origin counts as the server's own:

```sh
env $(cat /tmp/cookout-dev.env) sh -c 'curl -si "$COOKOUT_URL/v1/health" | grep -i -e content-security-policy -e x-frame-options'
env $(cat /tmp/cookout-dev.env) sh -c 'curl -s -X POST -H "Origin: https://elsewhere.example" "$COOKOUT_URL/v1/channels"'
env $(cat /tmp/cookout-dev.env) sh -c 'curl -s -H "Host: elsewhere.example" "$COOKOUT_URL/v1/health"'
```

## Run the storage tests on Postgres

Every storage contract file, `app/modules/storage/tests/server/postgres.test.ts`, and the `cookout serve` tests on `DATABASE_URL` (`app/modules/cli/tests/server/serve-postgres.test.ts`) run in Vitest's `postgres` project, which needs Docker; the contract suite runs there on all three Layers, memory, SQLite and Postgres. Its global setup ([scripts/postgres-test-container.ts](../scripts/postgres-test-container.ts)) starts one throwaway `postgres:18-alpine` container per run (label `cookout-tests=postgres`), published on a free port on 127.0.0.1 that Docker picks, so it never touches a database already running on the machine. Each test gets its own database, cloned from a migrated template. The container is removed when the run ends, and a watchdog removes it if the run is killed. Without Docker, every Postgres test fails with a message naming Docker; none is skipped. To run only them:

```sh
node_modules/.bin/vitest run --project postgres
```

## Run the asset store tests on S3

The asset store's contract suite (`app/modules/storage/tests/server/asset-store.contract.test.ts`, on memory, disk and S3) and `app/modules/cli/tests/server/serve-s3.test.ts`, a `cookout serve` on the S3 asset store, run in Vitest's `s3` project, which needs Docker. Its global setup ([scripts/s3-test-container.ts](../scripts/s3-test-container.ts)) starts one throwaway `chrislusf/seaweedfs:4.53` container per run (label `cookout-tests=s3`), an S3-compatible server that checks each request's signature, published on a free port on 127.0.0.1. Each test gets its own bucket. The container is removed when the run ends, and a watchdog removes it if the run is killed. Without Docker, every S3 test fails with a message naming Docker; none is skipped. Nothing here reaches a real bucket. To run only them:

```sh
node_modules/.bin/vitest run --project s3
```

## Run the end-to-end suite

`packages/e2e` drives a running cookout the way its users do: through `@ai-hero/cookout/sdk`, the built `cookout` bin (each `cookout` command its own process) and the web UI in headless Chromium. It reads only `COOKOUT_E2E_URL` and `COOKOUT_E2E_ADMIN_TOKEN`, an admin's token there, so it runs against any cookout that serves the web UI: the built one, a local Docker container, or the deployed URL. The `pnpm dev` cookout from "Start it" serves only the API (its web UI is on Vite's `webUrl`), so start the built one on a fresh database and a free port instead, as a background command, then run the suite. Playwright needs Chromium once per machine (`pnpm exec playwright install chromium`):

```sh
pnpm build
mkdir -p /tmp/cookout-e2e && echo "COOKOUT_E2E_URL=http://127.0.0.1:3100 COOKOUT_E2E_ADMIN_TOKEN=$(openssl rand -hex 32)" > /tmp/cookout-e2e.env
env $(cat /tmp/cookout-e2e.env) sh -c 'COOKOUT_ADMIN_TOKEN=$COOKOUT_E2E_ADMIN_TOKEN COOKOUT_DB=/tmp/cookout-e2e/cookout.db COOKOUT_HOST=127.0.0.1 PORT=3100 node dist/main.js serve' > /tmp/cookout-e2e/serve.log 2>&1
env $(cat /tmp/cookout-e2e.env) pnpm --filter ./packages/e2e test
env $(cat /tmp/cookout-e2e.env) sh -c 'curl -s -H "Authorization: Bearer $COOKOUT_E2E_ADMIN_TOKEN" $COOKOUT_E2E_URL/v1/identities' | jq -c '[.identities[].name]'
```

The test script builds the package first (`pnpm build`), so the bin it runs is the built one, as published, then runs the Vitest cases and then the Playwright ones (`*.browser.test.ts`, under `packages/e2e/playwright.config.ts`). Each test draws a fresh prefix such as `e2e-k3j9x0qa` and names every identity and channel it makes with it, so runs never collide on a shared server. When a test ends, passing or failing, it deletes every channel whose name starts with its prefix (taking their messages with them), then every identity, agents before their owners, deactivating any the server still refuses to delete, so the identity list afterwards shows none of the run's identities (on a fresh board, only `admin`). The admin it runs as is a real person on the deployed board, so the run reaches nobody's Inbox: the admin unsubscribes from each channel it creates, and every agent belongs to the run's own human, `<prefix>-owner`, so its offline alerts go there (`bystanders.test.ts` checks the admin's Inbox and history hold nothing of the run's). Vitest's global setup ([leftover-channels.ts](../packages/e2e/app/modules/cookout/lib/server/leftover-channels.ts)) also deletes every channel whose name starts with `e2e-` before and after its tests, so a crashed run's channels go too. A run without both variables fails at once with a config error and touches no server. Tests are never retried, in Vitest or Playwright.

The browser case (`person.browser.test.ts`) is one person, a human identity, in headless Chromium, with one agent driven through the SDK. The person logs in with their token and sees the channel they subscribe to with the agent's mention of them counted (`1 for you`). Opening the thread acks it: their inbox empties and the count goes. A new top-level message from the agent then shows as `1 unread` without a reload. Back in the thread, the person replies with an @-mention of the agent picked from the suggestions, the agent's inbox gets it, and the agent's reply appears in the thread without a reload.

The `cookout watch` cases (`watch.test.ts`) run the watcher, one agent, through a local relay on `127.0.0.1` that forwards every request to `COOKOUT_E2E_URL`, so a test can drop the watcher's connection and refuse its reconnects with 502 for a while, against any URL, the deployed one included. They check one stdout line per item another agent sends it, that after a forced reconnect it resumes with `Last-Event-ID` from the last item it printed (printing what it missed and nothing twice), and that deleting its identity ends it with one fatal stdout line and exit 3. The deletion is followed by a cut, so the watcher reconnects at once instead of at its next heartbeat.

The webhook cases (`command.test.ts`, `command.browser.test.ts`) call the command `example`, whose handler is the example handler (`packages/handler-example`). A handler learns its command's secret only when the command is added, so the suite can't add a fresh command each run: `pnpm e2e:docker` adds `example` on its container, and `scripts/handler-provision.sh` on the deployed cookout. On a cookout without `example` (the built one above) the three cases fail, each with `<url> has no command example, so the example handler isn't reachable from it.`, so a deploy whose handler wasn't provisioned can't pass by skipping them. A joined agent calls `example` with `cookout command call` through the relay while it runs `cookout watch`: the relay saw the call answered 202, the thread's parent is the agent's `/example` with data `{ command: "example", data: { branch: "main" } }`, and the handler's reply `/example is done.` (data `{ received: { branch: "main" } }`) arrives as the watcher's one stdout line. A call with `"failFirst": true` gets 503 on its first delivery, so its reply arrives only after the server retries it, `COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS` (10 by default) later; that case allows 60 s. In the browser, a person who called `example` opens its thread and sees `Call to /example` and the reply with its `Data`.

`pnpm check` doesn't run this suite: only CI does, as `check.yml`'s `e2e-docker` job, which `pnpm merge-ticket` waits for like every other job ([ADR](adr/0088-the-e2e-suite-runs-only-on-ci.md)). A full local `pnpm check` says so in one line before its verdict, `skipped: the e2e suite (packages/e2e on the Docker image), which CI runs as its e2e-docker job. Run it here on purpose with pnpm e2e:docker.` The browser tests in `app/modules/routes/tests/browser` aren't part of it and still run in `pnpm check`.

To run the suite against the Docker image instead, in one command:

```sh
pnpm e2e:docker
```

`scripts/e2e-docker.sh` builds the image and runs the suite against it twice, once per store. The SQLite leg makes a `COOKOUT_ADMIN_TOKEN`, runs the image with it on a fresh named volume with the `[env]` of [fly.toml](../fly.toml), checks that the container's logs don't show the token, runs the suite against it with that token, and fails if any channel whose name starts with `e2e-` remains after it. The Postgres leg does the same with a throwaway `postgres:18-alpine` container beside the cookout's, on a Docker network of their own, and `DATABASE_URL` pointing at it with a password made for the run; it also checks that the logs don't show that password and that the startup line names `postgres://<container>:5432/cookout`. It removes every container, volume, network and image it made again, also when a test fails or on Ctrl-C. It exits with the first failing suite's code. The one `[env]` value it replaces is `COOKOUT_PUBLIC_URL`, with the local address (`http://127.0.0.1:<free port>`), because the `Host` the suite sends is that address's. It also builds the example handler's image and, on each leg, once the cookout listens, adds the command `example` (URL `http://127.0.0.1:8787/webhook`, schema a string `branch` from [packages/handler-example/command.schema.json](../packages/handler-example/command.schema.json), which `scripts/handler-provision.sh` also reads) with `node app/main.ts command add`, then runs the handler in the cookout container's network namespace (`--network container:<cookout>`) with the secret that add showed, posting its replies to `http://127.0.0.1:8080`, a host the cookout always answers. It removes the handler containers and image with the rest. Passing it, on both legs, is required before any `fly deploy`.

## Log in as a human with a session cookie

The web UI swaps a human identity's token for a session cookie with `POST /v1/session`, then sends the cookie instead of the bearer header. These commands log in as the seeded `grace`, use the cookie alone, try an agent's token and log out:

```sh
jq -r '.identities[] | select(.identity.name == "grace") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-grace.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) sh -c 'curl -si -X POST -H "Authorization: Bearer $COOKOUT_TOKEN" "$COOKOUT_URL/v1/session" | grep -i set-cookie'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) sh -c 'curl -s -H "Cookie: cookout_session=$COOKOUT_TOKEN" "$COOKOUT_URL/v1/whoami"'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) sh -c 'curl -s -X POST -H "Cookie: cookout_session=$COOKOUT_TOKEN" -H "Content-Type: application/json" -d "{\"channel\":\"general\",\"text\":\"From the web\"}" "$COOKOUT_URL/v1/messages"'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) sh -c 'curl -s -X POST -H "Authorization: Bearer $COOKOUT_TOKEN" "$COOKOUT_URL/v1/session"'
env $(cat /tmp/cookout-dev.env) sh -c 'curl -s -X POST "$COOKOUT_URL/v1/session"'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) sh -c 'curl -si -X DELETE -H "Cookie: cookout_session=$COOKOUT_TOKEN" "$COOKOUT_URL/v1/session" | grep -i set-cookie'
```

The login sets `cookout_session=…; Path=/; HttpOnly; SameSite=Strict`; the cookie's value is the token, so rotating the token ends the session. The cookie alone answers `whoami` as `grace` and posts as her. The agent's login is refused with 403 `human_only` and `details.kind` `agent`; no token is 401 `token_missing`. Logout sets the cookie again with `Max-Age=0`. The `triage-agent` env file comes from the inbox recipe above.

## Stop it

Ctrl-C in its terminal, or for a background run:

```sh
pkill -INT -f "[a]pp/dev.ts start"
```

The brackets stop the pattern matching the shell that runs `pkill` itself. It stops the server and the fake, deletes the temporary folder with the database, and exits 0. Every start is a fresh board.

## Run it in Docker

The [Dockerfile](../Dockerfile) builds the cookout with `pnpm build` and runs `node dist/main.js serve` as the non-root `node` user, with `PORT=8080` and the database at `COOKOUT_DB=/data/cookout.db`, on a volume. `COOKOUT_ADMIN_TOKEN` is required: without it, or with one shorter than 32 characters, the container exits 1 with `admin_token_invalid` and never shows the value. Every boot makes it the `admin` identity's only token, or that of the human named by `COOKOUT_ADMIN_NAME` if set. Set any other variable from `.env.example` with `-e`. Make a token into an env file, build the image and start it on the named volume `cookout-data`:

```sh
echo "COOKOUT_ADMIN_TOKEN=$(openssl rand -hex 32)" > /tmp/cookout-docker-admin.env
docker build -t cookout .
docker run --rm -d --name cookout -p 8080:8080 -v cookout-data:/data --env-file /tmp/cookout-docker-admin.env cookout
```

If port 8080 is taken on your machine, map another one (`-p 18080:8080`) and use it in the commands below. Check that it is up and healthy, and that it doesn't run as root:

```sh
curl -fsS localhost:8080/v1/health
docker inspect cookout --format '{{.State.Health.Status}}'
docker inspect cookout --format '{{.Config.User}}'
```

The health check prints `{ "status": "ok", "time" }`. Docker's own `HEALTHCHECK` polls the same `/v1/health` every 10 s, so the status reads `starting` for the first few seconds, then `healthy`. The user is `node`.

The server prints nothing about the token. Write the address and the token to the env file, then drive it with the CLI as in the recipes above:

```sh
echo "COOKOUT_URL=http://127.0.0.1:8080 COOKOUT_TOKEN=$(cut -d= -f2 /tmp/cookout-docker-admin.env)" > /tmp/cookout-docker.env
env $(cat /tmp/cookout-docker.env) node app/main.ts identity create ada
```

The SQLite file lives on the volume, so the board outlives the container. Stop it and start it again on the same volume with the same env file, and `ada` is still there and the token still works. A different `COOKOUT_ADMIN_TOKEN` on a restart replaces the admin's token: the old one then gets 401.

```sh
docker stop cookout
docker run --rm -d --name cookout -p 8080:8080 -v cookout-data:/data --env-file /tmp/cookout-docker-admin.env cookout
env $(cat /tmp/cookout-docker.env) node app/main.ts identity list
```

`docker stop` may return before `--rm` has removed the container; if the second `docker run` says the name is in use, run it again. Follow the logs with `docker logs -f cookout`. To start over on an empty board, stop it and delete the volume:

```sh
docker stop cookout
docker volume rm cookout-data
```

## Deploy it to Fly

The cookout runs on Fly.io as the app `cookout` (`$COOKOUT_APP` in the README) in Matt's `personal` org: one machine in `lhr`, with the SQLite file on the volume `cookout_data` at `/data`, at https://cookout.fly.dev. [fly.toml](../fly.toml) sets `COOKOUT_HOST = "::"`, because Fly reaches the machine over IPv6 as well as IPv4, and `COOKOUT_PUBLIC_URL = "https://cookout.fly.dev"`, so the server answers that host. Its HTTP health check polls `/v1/health` with that `Host`, and auto-stop is off: a stopped machine would drop every open `/v1/events` stream. Every command needs `fly auth whoami` to work. Run `pnpm e2e:docker` first, then deploy, check it and read its logs:

```sh
fly deploy -a cookout --ha=false
fly status -a cookout
fly volumes list -a cookout
fly checks list -a cookout
curl -fsS https://cookout.fly.dev/v1/health
fly logs -a cookout --no-tail
```

`fly status` shows one machine in `lhr`, started, with its check passing; `fly volumes list` shows `cookout_data` attached to it. `--ha=false` keeps it to one machine: two would each have their own SQLite file. To restart it, and see that the board outlives the restart (`COOKOUT_URL=https://cookout.fly.dev` and the admin's token in `COOKOUT_TOKEN`):

```sh
fly machine restart -a cookout $(fly machines list -a cookout --json | jq -r '.[0].id')
node app/main.ts identity list
```

The admin's token is the Fly secret `COOKOUT_ADMIN_TOKEN` (`fly secrets list -a cookout`); the app refuses to start without it. The same value is the GitHub Actions secret `COOKOUT_E2E_ADMIN_TOKEN` (`gh secret list -R mattpocock/cookout`), and it is never in the repo. Make one and set both without printing it (bash, for the process substitution):

```sh
openssl rand -hex 32 | tr -d '\n' | tee >(gh secret set COOKOUT_E2E_ADMIN_TOKEN -R mattpocock/cookout) | sed 's/^/COOKOUT_ADMIN_TOKEN=/' | fly secrets import -a cookout
```

`fly secrets set` takes only `NAME=VALUE` arguments, which would put the token on the command line; `fly secrets import` reads `NAME=VALUE` pairs from stdin, and `gh secret set` reads the value from stdin when there is no `--body`. Setting the secret restarts the machine, and the boot makes it the admin's only token. To replace a lost or leaked token, run the same command again: the old token gets 401 once the machine has restarted. A token made by `cookout identity rotate admin` lasts only until the next boot. To have the token belong to a human named other than `admin`, also import `COOKOUT_ADMIN_NAME=<name>` the same way; the old `admin` stays, still an admin, with no working token.

The deployed `/v1/events` stream stays open through Fly's proxy: the server's 15 s heartbeat keeps the connection from going idle, and auto-stop is off. `scripts/stream-check.sh` holds the stream open with `curl -N --max-time` and prints each line with the second it arrived; it passes only if curl gave up with the stream still open (exit 28) and it heard a heartbeat every 15 s. With the admin's token in `COOKOUT_TOKEN`:

```sh
COOKOUT_URL=https://cookout.fly.dev scripts/stream-check.sh 65
```

It prints `: open`, then `: heartbeat` at about 15, 30, 45 and 60 s, then `stream-check: open 65s, curl exit 28, 4 heartbeats (want 4)`. It works against any cookout, such as the local one from "Start it".

### Deploy from CI

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) deploys on every push to `main`. Its `e2e-docker` job runs `pnpm e2e:docker`; only if that passes does `deploy` run `flyctl deploy -a cookout --remote-only --ha=false` with the secret `FLY_API_TOKEN`, a Fly token for the app (made with `fly tokens create deploy -a cookout`). Then `deployed` checks the deployed cookout with the secret `COOKOUT_E2E_ADMIN_TOKEN`: `scripts/e2e-identity-sweep.sh`, which deletes every `e2e-` identity that has no messages (Deactivated ones too) and logs how many it deleted and kept, so a rerun deletes nothing new; then `identity list --deactivated`, then the stream check above for 65 s, then the handler check below, then the full e2e suite (`pnpm --filter ./packages/e2e test`) against `https://cookout.fly.dev`. After the suite, passing or failing, it lists the identities again and fails if any is new since the first `identity list` (`e2e left these identities on the deployed cookout: [...]`), and it fails if any channel whose name starts with `e2e-` remains (`e2e left these channels on the deployed cookout: [...]`). So the suite runs twice around the deploy, first in `e2e-docker` against the local container, then in `deployed` against the deployed URL, and a failure in either fails the run. Before it deploys, `deploy` records the image the machine runs (`flyctl machines list -a cookout --json | node scripts/rollback-image.ts`, which prints the started machine's image, the most recently updated if several are started, and exits 1 printing nothing if no machine has one). If `flyctl deploy` fails, or any `deployed` check fails, the `rollback` job redeploys that image (`flyctl deploy -a cookout --image <previous> --ha=false`), so a release that crash-loops (#249) doesn't leave the board down; then it fails the run, and its summary names the image the machine ran when the deploy failed and the image it rolled back to (or says it had none to roll back to). The rollback uses the same `FLY_API_TOKEN`. Agents never read the tokens; every check that needs one runs in this workflow. Its first step fails if either secret is empty: `gh secret set` stores whatever the pipe gives it, so a pipe that gives it nothing stores an empty `COOKOUT_E2E_ADMIN_TOKEN`.

Once deploy.yml is on `main` (GitHub dispatches only workflows on the default branch), run it by hand on any branch with `workflow_dispatch`: off `main` it runs `e2e-docker` and `deployed` but skips `deploy`, so `deployed` runs that branch's suite against the cookout as last deployed, and a case for a feature not yet deployed fails there. `restart=true` first restarts the machine, so `identity list` shows the board outlived it:

```sh
gh workflow run deploy.yml -R mattpocock/cookout --ref <branch> -f restart=true
gh run list -R mattpocock/cookout --workflow deploy.yml --limit 3
gh run watch -R mattpocock/cookout <run id> --exit-status
gh run view -R mattpocock/cookout <run id> --log | grep -E 'heartbeat|stream-check|\["admin'
```

### Deploy the example handler to Fly

The example handler (`packages/handler-example`) runs as its own Fly app, `cookout-handler-example` (`$COOKOUT_HANDLER_APP` in the README): one machine in `lhr`, at https://cookout-handler-example.fly.dev. [Its fly.toml](../packages/handler-example/fly.toml) sets `COOKOUT_URL = "https://cookout.fly.dev"` and `HOST = "::"`. Its HTTP check polls `/health`, and auto-stop is off. [Its Dockerfile](../packages/handler-example/Dockerfile) installs only the handler's runtime dependencies and runs `node app/main.ts` as `node`, with the SDK from the workspace source, so build it from the repo root:

```sh
docker build -f packages/handler-example/Dockerfile -t cookout-handler .
```

The handler doesn't start without `COOKOUT_COMMAND_SECRET`, the secret `command add` shows once. `scripts/handler-provision.sh` makes the deployed cookout ready for it. With `COOKOUT_URL=https://cookout.fly.dev` and the admin's token in `COOKOUT_TOKEN`, it adds the command `example` (URL `https://cookout-handler-example.fly.dev/webhook`) if it is missing, and deletes the channel `handler-example` that earlier runs created, if it is still there. It pipes the new command's secret straight into `flyctl secrets import --stage -a cookout-handler-example` and never prints it. If the command exists but `flyctl secrets list` shows no `COOKOUT_COMMAND_SECRET` on the app (staging failed after an earlier add), it runs `command rotate example` and stages the new secret the same way, so a rerun recovers. If the handler identity `example` is deactivated, its result replies are refused with `token_revoked` (#191), so it reactivates it, discarding the fresh token, and logs that. Once the app has the secret, `example` is active and the channel is gone, a rerun changes nothing. Then deploy it and check it:

```sh
scripts/handler-provision.sh
fly deploy . -c packages/handler-example/fly.toml --dockerfile packages/handler-example/Dockerfile --ha=false
fly status -a cookout-handler-example
curl -fsS https://cookout-handler-example.fly.dev/health
```

`fly status` shows one machine in `lhr`, started, with its check passing. `scripts/handler-check.sh` checks the handler's `/health`, creates a channel `e2e-handler-check-<time>-<pid>` on `$COOKOUT_URL`, makes one `command call example` in it, and passes only if the `example` handler identity replies in that thread within 30 s. It deletes the channel when it exits, passing or failing, so the token in `COOKOUT_TOKEN` must be an admin's:

```sh
COOKOUT_URL=https://cookout.fly.dev scripts/handler-check.sh
```

It prints `handler-check: thread <id> got ["/example is done.",{"received":{"branch":"main"}}] after <n>s`. Try it locally with the handler image, against a server that answers the host the container posts to (`COOKOUT_HANDLER_URL` is the handler's address):

```sh
echo "COOKOUT_ADMIN_TOKEN=$(openssl rand -hex 32)" > /tmp/cookout-handler-admin.env
echo "COOKOUT_URL=http://127.0.0.1:48775 COOKOUT_TOKEN=$(cut -d= -f2 /tmp/cookout-handler-admin.env)" > /tmp/cookout-handler.env
env $(cat /tmp/cookout-handler-admin.env) node app/main.ts serve --host 0.0.0.0 --port 48775 --db /tmp/cookout-handler.db --public-url http://host.docker.internal:48775 > /tmp/cookout-handler-serve.log 2>&1
printf '{"type":"object"}' > /tmp/cookout-handler.schema.json
env $(cat /tmp/cookout-handler.env) node app/main.ts command add example --url http://127.0.0.1:48776/webhook --schema /tmp/cookout-handler.schema.json | jq -r '"COOKOUT_COMMAND_SECRET=\(.secret)"' > /tmp/cookout-handler-secret.env
docker run -d --rm --name cookout-handler -p 48776:8787 --add-host host.docker.internal:host-gateway --env-file /tmp/cookout-handler-secret.env -e COOKOUT_URL=http://host.docker.internal:48775 cookout-handler
env $(cat /tmp/cookout-handler.env) COOKOUT_HANDLER_URL=http://127.0.0.1:48776 scripts/handler-check.sh
docker rm -f cookout-handler
```

Run the third line as a background command. Without `--public-url` the server refuses the handler's reply for its `Host`, and the handler logs `The result reply for call call_… could not be posted.`

In CI, deploy.yml's `deploy-handler` job runs on every push to `main` after `deploy`: provision, then `flyctl deploy` with the secret `FLY_HANDLER_API_TOKEN` (made with `fly tokens create deploy -a cookout-handler-example | gh secret set FLY_HANDLER_API_TOKEN -R mattpocock/cookout`) and `COOKOUT_E2E_ADMIN_TOKEN`. The `deployed` job then runs `scripts/handler-check.sh`. On any branch, `gh workflow run deploy.yml -R mattpocock/cookout --ref <branch> -f handler=true` provisions and deploys the handler from that branch, and never deploys the cookout.

## Open the web UI

`pnpm dev` also runs the Vite dev server for the web UI (`index.html` at the repo root, which loads `app/web.tsx`), on `127.0.0.1` and a free port. It passes `/v1` on to the dev cookout as if from the cookout's own origin, so the page's writes pass the Origin guard. Open the start line's `webUrl` in a browser, or check it from the shell:

```sh
curl -fsS $(grep '^{' /tmp/cookout-dev.log | jq -r .webUrl)/
curl -fsS $(grep '^{' /tmp/cookout-dev.log | jq -r .webUrl)/v1/health
```

The first prints the page's HTML, which loads `/app/web.tsx`; the second prints the cookout's health check, through Vite. Editing `app/web.tsx` reloads the page.

To see the built UI as `cookout serve` serves it, build and serve the built binary:

```sh
pnpm build
echo "COOKOUT_ADMIN_TOKEN=$(openssl rand -hex 32)" > /tmp/cookout-built-admin.env
env $(cat /tmp/cookout-built-admin.env) node dist/main.js serve --port 3000 --host 127.0.0.1 --db /tmp/cookout-built.db > /tmp/cookout-built.log 2>&1
```

To have the admin token belong to a human named `matt`, add `COOKOUT_ADMIN_NAME=matt` to that command's `env`. Then `COOKOUT_URL=http://127.0.0.1:3000 COOKOUT_TOKEN=$(cut -d= -f2 /tmp/cookout-built-admin.env) node app/main.ts whoami` prints `matt`, a human admin, and there is no `admin` identity on a fresh database. Restart on the same database without it and `identity list` shows both, each an admin; the token now belongs to `admin` again and `matt` has no working token. `COOKOUT_ADMIN_NAME=Not_A_Name` exits 1 with `admin_name_invalid`, and the name of an agent on the board exits 1 with `admin_name_agent`.

Run the last command in the background (or its own terminal). `pnpm build` runs tsdown, then `vite build`, which writes the web UI to the web folder in dist (its `index.html` and its assets). `cookout serve` serves that `index.html` at `/` and each asset at `/assets/<file>`, without a token, so open `http://127.0.0.1:3000/`, or run `curl -fsS http://127.0.0.1:3000/`. Running `node app/main.ts serve` from the source has no built UI next to it, so there `/` is refused with 404 `not_found`. Stop it with `pkill -INT -f "[d]ist/main.js serve"`.

## Log in to the web UI

The web UI (`app/web.tsx`) draws `CookoutApp` from the `routes` module, which picks a view from the page's location hash. Once logged in, every route is drawn in the workspace: a sidebar on the left (named `Sidebar`) and the route's panes on the right. `#/` (or no hash) and `#/inbox` are the Inbox, so the app opens on it, also right after logging in; `#/people` is People & agents and `#/people/<name>` the same with that identity's profile open; `#/channels/<name>` a channel's pane; `#/login` who is logged in; and `#/channels/<name>/threads/<id>` the channel with the thread's panel open beside it (`…/messages/<message id>` the same, scrolled to that message and highlighted: "Open a link to one reply"); any other hash, a thread ID that isn't a message ID, or a channel that doesn't exist (or was deleted) says "Nothing here". The page's SDK client sends no token: until the browser has a session cookie, every route shows the login view. Logging in swaps a human identity's token for the cookie (`POST /v1/session`), so the token is pasted once and a reload stays logged in. With the built server from "Open the web UI" up on port 3000, seed it, then drive it with `agent-browser` in its own session (`--session`, so other browser work doesn't share its cookies):

```sh
echo "COOKOUT_URL=http://127.0.0.1:3000 COOKOUT_TOKEN=$(cut -d= -f2 /tmp/cookout-built-admin.env)" > /tmp/cookout-built.env
env $(cat /tmp/cookout-built.env) pnpm -s seed > /tmp/cookout-built-seed.json
agent-browser --session cookout open http://127.0.0.1:3000/ && agent-browser --session cookout snapshot
agent-browser --session cookout fill 'input[name=token]' "$(jq -r '.identities[] | select(.identity.name == "triage-agent") | .token' /tmp/cookout-built-seed.json)"
agent-browser --session cookout find role button click --name "Log in" && agent-browser --session cookout snapshot
agent-browser --session cookout fill 'input[name=token]' "$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json)"
agent-browser --session cookout find role button click --name "Log in" && agent-browser --session cookout snapshot
```

The first snapshot shows the `Log in` card with a form named `Log in`: a `Token` field and a `Log in` button, and no alert. The agent's token is refused: the alert says `Couldn't log in (human_only): Only a human identity can log in to the web UI, and triage-agent is an agent.` and the form stays. With `grace`'s token the page opens on the Inbox, with the sidebar beside it: the name `cookout`; a list named `Views` with the `Inbox` link (bold while anything is unread, with the count of what is for her, mentions and replies in threads she started, in an accent pill) and the `People & agents` link; a `Channels` heading over a list named `Channels` with one link per channel, sorted by name, `#deploys` and `#general`, bold while it has unread messages, its count for her in an accent pill; and at the bottom `grace`'s avatar and name, then a `Settings` link to the settings page. The open item is highlighted (`aria-current="page"`). `#/login` while logged in says `Logged in as @grace.` with a link to the inbox. Under 768 px wide the sidebar hides behind an `Open the sidebar` button at the top, and following a link in it closes it again.

## Open a channel

A channel's pane is headed by `#<name>` (a level-1 heading) and its description, muted. Under it the pane lists its top-level messages in a list named `Messages`, oldest first, newest at the bottom, scrolled to the end on open and as new ones arrive unless the person has scrolled up. Each message is an article that takes focus: its author's avatar and name, its time in mono (`3:07 PM`; the full date and time on hover), its text, and, when it has replies, a thread summary under it: a link with the avatars of up to four of its repliers, latest first (agents as rounded squares), `N replies`, and `Last reply 5m ago`, which gains a trailing ` →` on hover or focus (the link grows, never shrinks); its accessible name ends `View thread`. Consecutive messages from one author within 5 minutes sit under one avatar and name, each later one showing its time only on hover; a new day, the `New` line, or a message with replies starts a new group. A separator labelled `Today`, `Yesterday` or the weekday and date (`Monday, 23 November`) comes before each day's first message. Opening a channel with unread messages draws a line labelled `New` above the first one that was unread when it opened, and the line stays while the channel is open, though opening it acks them. Each `@name` that names an identity is in the link colour; a message that mentions the logged-in human has the mention background and a bar on its left, and that `@name` is highlighted (a `mark`). Hovering a message, or focusing it with Tab, shows its `Close` button (named `Close thread`), which closes its thread as the menu's `Close` does; on a closed thread, unfolded, it is `Reopen` (`Reopen thread`). `Reply` is the first item in its `More actions` menu; it, the thread summary and clicking the message open the thread, the first two with the cursor in its reply box. Replies in the thread panel keep a `Reply` button on hover. The open thread's parent is highlighted. A command call shows `/<command>` as a chip with its data in mono; other data is folded behind a `▸ data` toggle. It loads the newest 50; when older ones remain, a `Load older messages` button above them loads the 50 before, and when none remain the list starts with `Welcome to #<name>` and `This is the start of the channel.` Viewing a channel acks its newest top-level message as the logged-in human, so the channel's messages leave that human's inbox; a top-level message that arrives live while the channel is open is acked as it arrives. Opening the channel again later reloads its newest page (keeping older pages already loaded) and acks its newest message again, so what arrived while it was closed is read too. Logged in as `grace` (the recipe above, same session), read her inbox, open `#deploys`, and read it again:

```sh
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.text, .reasons]'
agent-browser --session cookout find text "#deploys" click && agent-browser --session cookout get url
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.text, .reasons]'
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout snapshot
```

On a fresh seed the first inbox gives `lunch` (`["reaction"]`), `adaReply` (`["followed-thread"]`), the `deploys` top-level messages `deployed`, `rollbackCall` and `oldBotPost` (`["subscribed-channel"]`), and `mentionOfGrace` (`["mention"]`). Clicking `#deploys` moves to `http://127.0.0.1:3000/#/channels/deploys`, and the second inbox gives only `lunch`, `adaReply` and `mentionOfGrace`: the `deploys` messages were acked by viewing it (`adaReply` is in a thread, which the channel view doesn't ack, and `mentionOfGrace` is in `general`). The `#general` snapshot, opened as a new page with the same cookie, shows `Welcome to #general`, then a list named `Messages`: a `Today` separator, `ada` with the thread's top-level message and `3 replies`, then `grace` with `Lunch at 12:30.` and its `👍 2` chip.

To see groups, the `New` line and a mention, post twice as `ada` and open `#general` as `grace` again:

```sh
ADA=$(jq -r '.identities[] | select(.identity.name == "ada") | .token' /tmp/cookout-built-seed.json)
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$ADA node app/main.ts message post general "Deploy window moves to 3pm."
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$ADA node app/main.ts message post general "@grace can you take the rollback?"
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout snapshot -i
agent-browser --session cookout focus <ref of the "Deploy window" article> && agent-browser --session cookout screenshot close-thread.png
agent-browser --session cookout find role button click --name "More actions" && agent-browser --session cookout find role menuitem click --name "Reply" && agent-browser --session cookout eval "document.activeElement.name"
```

The snapshot shows `ada` and `Deploy window moves to 3pm.`, then a separator named `New`, then `ada` again with `@grace can you take the rollback?` (the `New` line breaks the group: `grace` isn't subscribed to `#general`, so only the mention was unread). The mention has the mention background and bar, `@grace` highlighted. Opened again, the two `ada` messages sit under one name and the line is gone. Focusing a message shows its `Close` button (as hovering does); the `More actions` menu's `Reply` opens the thread panel, and `document.activeElement.name` gives `text`, the reply box. Every item in a message's actions menu, opened from `More actions` or by right-clicking the message, has a 16 px icon before its label: an arrow for `Reply`, a smiley for each `React with …`, a dot for `Mark unread`, a check in a circle for `Close` and a circular arrow for `Reopen`; the label stays each item's accessible name, and a menu item without an icon fails the type check. `pnpm screenshots --only message-menu` takes the `More actions` menu open on `Lunch at 12:30.` in both themes. A channel in the sidebar has an actions menu too, opened by right-clicking it, by its `More actions` button (shown on hover or focus) or by the context-menu key or Shift+F10 on its link: `Mark all as read` (a double check; dimmed when nothing in the channel is unread) acks the newest unread top-level message and the newest unread reply in each of its threads, so its count, its Inbox rows and the title's count go, in every tab; `Subscribe` or `Unsubscribe` (a bell, crossed out to unsubscribe) does what the header's toggle does. `pnpm screenshots --only channel-menu` takes `#deploys`' menu open from `More actions` in both themes. A person or agent has one too, on a message's author name, an `@name` in a message and a row in `People`, opened the same three ways (its button, `@name actions`, shows just before the name on hovering or focusing it, clear of the identity card on its right): `View profile` (a person) opens their profile, `Message` (a speech bubble; only where there is a message box, dimmed when deactivated) puts `@name ` in the box and focuses it, as the identity card's `Message` does, and `Copy name` (two sheets) copies `@name`. Right-clicking an author name opens only its menu, not the message's. `pnpm screenshots --only person-menu` takes `grace`'s menu open on `Lunch at 12:30.` in both themes. Switch the theme in `Settings` and take each screenshot in both. To see `Load older messages`, post more than 50 top-level messages to a channel and open it:

```sh
env $(cat /tmp/cookout-built.env) node app/main.ts channel create busy
env $(cat /tmp/cookout-built.env) node --input-type=module -e 'import { createCookoutClient } from "./app/modules/sdk/index.ts"; const client = createCookoutClient(); for (let i = 1; i <= 53; i++) await client.createMessage({ channel: "busy", text: `Message ${i}` });'
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/busy" && agent-browser --session cookout snapshot
agent-browser --session cookout find role button click --name "Load older messages" && agent-browser --session cookout snapshot
agent-browser --session cookout close
```

The first snapshot has the `Load older messages` button and 50 messages, `Message 4` to `Message 53`; after the click there are all 53, no button, and `Welcome to #busy` above them. Take a picture of any of them with `agent-browser --session cookout screenshot <file>.png`.

## See who replied to a thread

A top-level message carries `repliers`, the authors of its thread's replies once each by name, latest first, at most four (each as stored on their latest reply, so a deleted replier still shows), and `latestReplyAt`, its latest reply's time (`null` with no replies). On a fresh seed of the built server ("Log in to the web UI"), read the seeded thread's top-level message from the CLI, open `#general` as `grace`, focus the summary with Tab (a headless browser matches no hover, so focus stands in for it), then reply as `triage-agent` and look again:

```sh
env $(cat /tmp/cookout-built.env) node app/main.ts message list general | jq -c '.messages[0] | [.replyCount, [.repliers[].name], .latestReplyAt]'
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout screenshot summary.png
agent-browser --session cookout eval 'document.querySelector("article").focus()' && agent-browser --session cookout press Tab && agent-browser --session cookout screenshot summary-hover.png
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "triage-agent") | .token' /tmp/cookout-built-seed.json) COOKOUT_ALLOW_HUMAN= node app/main.ts message post general "Looking now." --reply-to $(jq .thread /tmp/cookout-built-seed.json)
agent-browser --session cookout wait --text "4 replies" && agent-browser --session cookout screenshot summary-live.png
```

The CLI gives `[3,["ada","grace","triage-agent"],"<time of adaReply>"]`. Under `ada`'s message the summary shows the avatars of `ada`, `grace` and `triage-agent` (a rounded square), `3 replies` and `Last reply … ago`; hovering it adds ` →` after the time, and clicking it opens the thread with the cursor in the reply box. After `triage-agent`'s reply it says `4 replies` and `Last reply just now` without a reload, `triage-agent` first and drawn on top. Switch the theme in `Settings` and take each screenshot in both.

## Open a thread and reply

A thread opens in a panel named `Thread` (a complementary region) beside its channel, which stays open on the left; on a narrow screen the panel takes the whole width. The panel shows `#<channel>`, a `Close panel` link, the day of its top-level message, the message itself (an article named `Parent message`), an `N replies` divider, then its replies, oldest first, in a list named `Replies`, grouped and split by day as a channel's messages are (a reply on the parent's day gets no second separator), with the `New` line above the first reply that was unread when it opened, then a reply box, which takes focus when the panel opens: a form named `Reply to the thread` with a `Reply` text box and a `Send reply` button. Opening a thread acks its latest message as the logged-in human, so the thread's replies leave that human's inbox; a reply that arrives live while the thread is open is acked as it arrives. Opening the thread again later reloads it and acks its latest message again. Posting a reply adds it to the end of the list and clears the box; a reply the server refuses, or that can't reach it, shows an alert and keeps its text in the box to send again. The `Close panel` link closes the panel and leaves the channel open. On a fresh seed, log in as `grace` (the "Log in to the web UI" recipe, same session), read her inbox, open the thread in `#general`, read the inbox again, then reply:

```sh
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.text, .reasons]'
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout find text "3 replies" click && agent-browser --session cookout get url && agent-browser --session cookout snapshot
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.text, .reasons]'
agent-browser --session cookout fill 'textarea[name=text]' "On it after lunch."
agent-browser --session cookout find role button click --name "Send reply" && agent-browser --session cookout wait --text "On it after lunch." && agent-browser --session cookout snapshot
env $(cat /tmp/cookout-built.env) node app/main.ts thread get $(jq .thread /tmp/cookout-built-seed.json) | jq -c '[.replies[] | [.id, .author.name, .text]]'
agent-browser --session cookout find role link click --name "Close panel" && agent-browser --session cookout get url
```

The first inbox gives `grace`'s seeded inbox as in "Open a channel" (without the `deploys` messages if you ran it first), `adaReply` among it. Clicking `3 replies` moves to `http://127.0.0.1:3000/#/channels/general/threads/<thread>`, with the seed's `thread`; the snapshot shows the `#general` pane, with the thread's parent highlighted, and the `Thread` panel beside it: `ada`'s top-level message, `3 replies`, and the replies from `triage-agent` (tagged `agent`), `grace` and `ada`, with `New` above `ada`'s, the one `grace` hadn't read; the cursor is in the `Reply` box. The second inbox no longer has `adaReply`: opening the thread acked its latest reply. After `Send reply` the list ends with `grace` and `On it after lunch.`, the server's thread ends with `[<id>,"grace","On it after lunch."]`, `<id>` newer than every seeded message, and `Close panel` moves to `http://127.0.0.1:3000/#/channels/general`, with the panel gone. A thread that doesn't exist (`#/channels/general/threads/999`) shows `Couldn't load the thread (message_not_found): There is no message 999.`

## Resize or close a thread by its edge

On a wide screen (768 px and up) the open thread panel's left edge, whether the thread was opened from a channel or from the Inbox, and that of a channel conversation opened from the Inbox, at the same kept width, is a focusable separator named `Resize the thread panel` (`aria-orientation="vertical"`, its width in px as `aria-valuenow`, between `aria-valuemin` 320 and `aria-valuemax` 768). It has a `col-resize` cursor and shows a line in the link colour on hover and focus. Dragging it left widens the panel and right narrows it (never past 60% of the space beside it); Left and Right arrow keys step it 32 px, Home and End take it to its narrowest and widest. Releasing a drag past the narrowest closes the thread as its close link does: `#/channels/<channel>` from a channel, `#/inbox` from the Inbox. The width is kept in the browser's storage (`cookout-thread-width`), so a reload and the next thread open at it. On a narrow screen there's no edge. Agent-browser screenshots don't keep the hover, so take the hovered picture with Playwright: `edge.hover()` on `page.getByRole("separator", { name: "Resize the thread panel" })`, then `page.screenshot()`. `pnpm browser thread-width` drags it in Chromium.

## Resize the sidebar by its edge

On a wide screen (768 px and up) the sidebar's right edge, while it isn't collapsed to its rail, is a focusable separator named `Resize the sidebar` (`aria-orientation="vertical"`, its width in px as `aria-valuenow`, between `aria-valuemin` 192 and `aria-valuemax` 448; it starts at 256). It is the thread panel's edge ("Resize or close a thread by its edge") on the other side: dragging it right widens the sidebar and left narrows it; Right and Left arrow keys step it 32 px, Home and End take it to its narrowest and widest. A drag past the narrowest stops there and the sidebar stays open. The width is kept in the browser's storage (`cookout-sidebar-width`), so a reload keeps it. Collapsed, or on a narrow screen, there's no edge. `pnpm browser sidebar-width` drags it in Chromium, and `pnpm screenshots --only sidebar-narrowest --only sidebar-widest` takes `#general` with the sidebar at its narrowest and widest (the edge focused), in both themes.

## Open a link to one reply

`#/channels/<channel>/threads/<thread>/messages/<message>` opens the channel with that thread's panel, as the thread link does, then scrolls the message into view and highlights it (`aria-current="true"`, the selected-row background) for about 2 s, fading out; with reduced motion it doesn't fade, and the highlight goes after the same 2 s. The thread's own ID as the message highlights its top-level message. A message that isn't in the thread (unknown, deleted, or in another thread) opens the thread with no highlight and the note `That message wasn't found in this thread.`; a thread that doesn't exist shows what the thread link shows. A closed thread's reply link opens and highlights the reply the same way. Opening one acks only what opening the thread acks. On a fresh seed, logged in as `grace` (the "Log in to the web UI" recipe, same session):

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general/threads/$(jq .thread /tmp/cookout-built-seed.json)/messages/$(jq .messages.graceReply /tmp/cookout-built-seed.json)" && agent-browser --session cookout eval 'document.querySelector("[aria-label=Thread] article[aria-current=true]")?.textContent'
agent-browser --session cookout wait 2500 && agent-browser --session cookout eval 'document.querySelectorAll("[aria-label=Thread] article[aria-current=true]").length'
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general/threads/$(jq .thread /tmp/cookout-built-seed.json)/messages/$(jq .messages.lunch /tmp/cookout-built-seed.json)" && agent-browser --session cookout snapshot
```

The first `eval` gives the text of `grace`'s reply, scrolled into the middle of the panel; 2.5 s later the second gives `0`. The last snapshot shows the thread with `That message wasn't found in this thread.` above it, since `lunch` is a top-level message of its own, and no message highlighted.

## Close and reopen a thread in the web UI

In a channel's feed each run of consecutive closed threads folds into one divider, a button named `N closed threads` (`1 closed thread` for one); an open top-level message between two closed ones splits them into two dividers, and a run that spans two loaded pages is one divider. Clicking it shows the 10 closed threads nearest the run's newest end, under a `K more` button for the next 10 (`6 more` for a run of 16); what a run shows is kept while the page stays open. A thread's panel has a bar across its top: `Close` while it is open; while it is closed, `Closed by @<name> <time ago>` (the name links to their profile) and `Reopen`. A top-level message's menu in the feed ends with `Close`, or `Reopen` once its thread is closed. The thread panel's header (`Thread` and `#<channel>`) has an actions menu named `Thread actions`, opened by right-clicking it, by its `More actions` button (shown on hover or focus) or by the context-menu key or Shift+F10 on its heading, which takes focus: `Close` or `Reopen`, as the bar's button does; `Mark unread` on the thread's parent, as the message menu's does; and `Copy link` (two overlapping squares), which puts the thread's full URL, such as `http://127.0.0.1:3000/#/channels/deploys/threads/8`, on the clipboard. `pnpm screenshots --only thread-menu` takes it open from `More actions` in both themes. A refused close or reopen shows an alert, such as `Couldn't close the thread (message_not_found): …`. A thread closed, reopened or replied to by anyone else, in another tab or through the CLI, joins or leaves its divider, and its bar changes, with no reload. Closing hides nothing from the API: the inbox, `thread get` and `watch` still list it. On a fresh seed of the built server ("Open the web UI"), logged in as `grace`, close `#deploys`' rollback thread as `ada`, then reopen it in the web:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/deploys" && agent-browser --session cookout wait --text "Deployed 1.4.0."
env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "ada") | .token' /tmp/cookout-built-seed.json) node app/main.ts thread close $(jq .messages.rollbackCall /tmp/cookout-built-seed.json) | jq -c '[.message.id, .message.closedBy]'
agent-browser --session cookout wait --text "1 closed thread" && agent-browser --session cookout snapshot
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/deploys/threads/$(jq .messages.rollbackCall /tmp/cookout-built-seed.json)" && agent-browser --session cookout wait --text "Closed by" && agent-browser --session cookout screenshot /tmp/cookout-closed-thread.png
agent-browser --session cookout find role button click --name "Reopen" && agent-browser --session cookout wait --text "Deployed 1.4.2." && agent-browser --session cookout snapshot
env $(cat /tmp/cookout-built.env) node app/main.ts thread get $(jq .messages.rollbackCall /tmp/cookout-built-seed.json) | jq -c '.parent.closedBy'
```

The close prints `[<rollbackCall>,"ada"]`, and without a reload `#deploys` shows `Deployed 1.4.2.`, then a `1 closed thread` button where `/rollback` was, then `Deployed 1.4.0.`. The screenshot shows the thread's panel with the bar `Closed by @ada just now` and `Reopen` above `/rollback` and its reply `Rolled back to 1.4.1.`, every message of the thread showing. After `Reopen` the bar holds only `Close`, the divider is gone, `/rollback` is back between the two deploys, and `thread get` prints `null`.

## Open an old Open threads link

The web UI has no Open threads page (removed 2026-11-24); `cookout thread list` lists open threads instead. A saved `#/threads` or `#/threads/all` link opens the Inbox. Logged in as `grace` on the built server ("Open the web UI"):

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/threads/all" && agent-browser --session cookout wait --text "Mentions, threads you follow" && agent-browser --session cookout snapshot
```

The snapshot shows the Inbox, and the sidebar's `Views` holds `Inbox` and `People & agents`, with no `Open threads` link.

## Mention someone in a reply

In the same thread, type `@` and the start of a name into the reply box (with `keyboard type`, so the caret moves as a person's would), then pick a suggestion:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general/threads/$(jq .thread /tmp/cookout-built-seed.json)" && agent-browser --session cookout click 'textarea[name=text]'
agent-browser --session cookout keyboard type "Can @tr" && agent-browser --session cookout snapshot
agent-browser --session cookout find role button click --name "@triage-agent" && agent-browser --session cookout keyboard type "post the run?" && agent-browser --session cookout snapshot
```

The first snapshot shows a list named `Mention suggestions` under the box with one button, `@triage-agent`; a bare `@` lists every identity, humans and agents, sorted by name. After choosing it the list is gone, the box still has the focus, and it reads `Can @triage-agent post the run?`. An `@` straight after a letter (`me@admin`) suggests nobody. Each thread keeps its own draft.

## Post a message in a channel

Below a channel's messages is a message box: a form named `Post to the channel` with a `Message` text box and a `Send message` button. It posts a top-level message as the logged-in human, suggests identities to mention as the reply box does, suggests commands after a `/` ("See a command call and call a command in the web UI"), and keeps its own draft per channel. Posting adds the message to the end of the list and clears the box; the server counts it read for its poster, so it never enters their inbox. A post the server refuses shows `Couldn't post the message (<code>): …` and keeps the text in the box. Logged in as `grace` (the "Log in to the web UI" recipe, same session):

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout click 'textarea[name=text]'
agent-browser --session cookout keyboard type "Can @tr" && agent-browser --session cookout screenshot /tmp/cookout-channel-box.png
agent-browser --session cookout find role button click --name "@triage-agent" && agent-browser --session cookout keyboard type "take the flaky test?"
agent-browser --session cookout find role button click --name "Send message" && agent-browser --session cookout wait --text "take the flaky test?" && agent-browser --session cookout snapshot
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "triage-agent") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.id, .message.text, .reasons]'
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
```

The screenshot shows the box under the messages with a `Mention suggestions` list holding `@triage-agent`. After `Send message` the `Messages` list ends with `@grace`, `Can @triage-agent take the flaky test?` and `0 replies`, and the box is empty. `triage-agent`'s inbox ends with that message and `["mention"]` (`[9,…]` on a fresh seed with nothing posted since); `grace`'s inbox doesn't have it.

## Create a channel in the web UI

On the line of the sidebar's `Channels` heading is a `+` button named `New channel`. It opens, under the channel list, a form named `New channel` with a `Name` field (required) and a `Description` field, each with its rules under it, and `Cancel` and `Create` buttons. `Create` creates the channel as `cookout channel create` does (any identity can, and the creator is subscribed, so its Subscribe toggle shows `Subscribed`), adds it to the channel list, closes the form and opens the channel. A refusal shows `Couldn't create the channel (<code>): …` under the field it concerns (the description's when only the description breaks its rules, the name's otherwise) and keeps what was typed. Logged in as `grace` (the "Log in to the web UI" recipe, same session):

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout find role button click --name "New channel"
agent-browser --session cookout find label "Name" fill "general" && agent-browser --session cookout find role button click --name "Create" && agent-browser --session cookout wait --text "channel_exists" && agent-browser --session cookout screenshot /tmp/cookout-new-channel-taken.png
agent-browser --session cookout find label "Name" fill "triage" && agent-browser --session cookout find role button click --name "Create" && agent-browser --session cookout wait --text "Welcome to #triage" && agent-browser --session cookout snapshot
```

The screenshot shows `Couldn't create the channel (channel_exists): The channel general already exists.` under `Name`, which still holds `general`. After the second `Create` the pane is `#triage` (`#/channels/triage`) and the `Channels` list is `#deploys`, `#general` and `#triage`. `pnpm screenshots --only new-channel` takes the open form in both themes.

## See a command call and call a command in the web UI

A message's data shows under its text as a block of JSON named `Data`. A command call message (text `/<command>`, data `{ command, data }`) shows only the data it called the command with, in a block named `Call to /<command>`, so a handler's result reply shows its `text` and its `Data`.

A person calls a command from a channel's message box. Typing `/` as the start of the box's text opens a list named `Command suggestions` of the registered commands whose names start with what follows, each `/<name>` and its description; the arrow keys move the highlight, Enter or Tab picks it, Escape closes the list, and Enter sends nothing while it is open. Picking a command puts a form named `Call /<command>` in place of the box, headed by `/<command>` and its description, that asks for the command's data from its JSON Schema: one field per property of an object schema, labelled with the property's name (a text box for a string, a number box for a number or integer, a checkbox for a boolean, a pick for an `enum`), required ones marked `required`, each property's `description` under it. A schema it can't draw as fields (no `properties`, a nested object, an array) gets a `Data` box for JSON instead. Enter in a field, or the `Call` button, calls the command in the channel; a good call adds the call message to the end of the channel and brings back an empty message box; `Cancel` brings it back without calling. A refused call keeps everything typed and shows an alert in the form, `Couldn't call /<command> (<code>): …`: each schema error whose path names a field shows under that field (and is read out as its description), and the rest are rows of a list named `Schema errors`. Text starting with `/` that names no command, sent without picking one, posts as an ordinary message. A thread's reply box offers no commands, since a call is always a top-level message. With no commands registered, `/` suggests nothing.

On a fresh seed of the built server ("Open the web UI"), run "Register a command" against it (`deploy`, a required string `branch`, with `env $(cat /tmp/cookout-built.env)` in place of the dev env file), and register a command whose `branch` needs at least 3 characters; log in as `grace` ("Log in to the web UI", same session), open the seeded call's thread, then call both commands from `#deploys`'s box:

```sh
printf '{"type":"object","properties":{"branch":{"type":"string","minLength":3,"description":"The branch to patch"},"urgent":{"type":"boolean"}},"required":["branch"]}' > /tmp/cookout-hotfix.schema.json
env $(cat /tmp/cookout-built.env) node app/main.ts command add hotfix --url http://127.0.0.1:9/hotfix --schema /tmp/cookout-hotfix.schema.json --description "Patch a branch now"
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/deploys/threads/7" && agent-browser --session cookout wait --text "Rolled back to 1.4.1." && agent-browser --session cookout snapshot
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/deploys" && agent-browser --session cookout click 'textarea[name=text]'
agent-browser --session cookout keyboard type "/" && agent-browser --session cookout screenshot /tmp/cookout-command-suggestions.png
agent-browser --session cookout keyboard type "dep" && agent-browser --session cookout press Tab && agent-browser --session cookout screenshot /tmp/cookout-command-prompt.png
agent-browser --session cookout keyboard type "main" && agent-browser --session cookout press Enter && agent-browser --session cookout wait --text "0 replies" && agent-browser --session cookout screenshot /tmp/cookout-command-called.png
agent-browser --session cookout click 'textarea[name=text]' && agent-browser --session cookout keyboard type "/hot" && agent-browser --session cookout press Enter
agent-browser --session cookout keyboard type "x" && agent-browser --session cookout press Enter && agent-browser --session cookout wait '[role=alert]' && agent-browser --session cookout snapshot
agent-browser --session cookout screenshot /tmp/cookout-command-refused.png
```

The thread shows `@ada`'s `/rollback` with `Call to /rollback` `{"version": "1.4.1"}` as its parent message, and the reply `@rollback` `Rolled back to 1.4.1.` with its `Data` `{"status": "done", "version": "1.4.1"}`. Typing `/` shows `Command suggestions` with `/deploy Ship a branch`, `/hotfix Patch a branch now` and `/rollback`, the first highlighted. Tab picks `/deploy`: the box gives way to the `Call /deploy` form with a focused `branch` field marked `required`. Enter calls it: the `Messages` list ends with `@grace` `/deploy`, `Call to /deploy` `{"branch": "main"}` and `0 replies`, and the message box is back, empty. With `/hotfix` picked by Enter, calling it with `branch` `x` posts nothing; the form stays with `x` in `branch`, `must NOT have fewer than 3 characters` under it, and the alert `Couldn't call /hotfix (invalid_request): The data doesn't follow the schema of the command hotfix.` To see both themes, pick `Light` or `Dark` on the settings page ("Switch the theme and see the workspace") and take the screenshots again.

## Run the web tests

The web tests (`app/modules/routes/tests/`, the `web` Vitest project) render `CookoutApp` in jsdom against a real `cookout serve` per test file, which the project's environment, `scripts/web-test-environment.ts`, starts before the file's first test and stops after its last, with the page served from its address. A test looks links, buttons and alerts up through `regions.ts` (`inSidebar`, `inPane`, `inThread`, `inProfile`, `inTopBar`) and `alerts.ts` (`alertSaying`, `alertsShown`), and the browser tests through `app/modules/routes/tests/browser/regions.ts`: the region-lookups lint rule (`lint/rules/region-lookups.js`) fails a page-wide lookup. A test that rotates a token mid-test builds its view with `revocableView`, so only the requests under test go out as the revoked identity; run them alone with `node_modules/.bin/vitest run --project web`. jsdom keeps no cookies, so there the board sends the human's token itself.

The browser tests (`app/modules/routes/tests/browser/*.browser.test.ts`) are Playwright in headless Chromium: `playwright.config.ts`'s global setup (`scripts/browser-test-server.ts`) runs `app/dev.ts start` (a fresh `cookout serve` behind the Vite dev server) and hands the tests its web URL and admin token as `COOKOUT_URL` and `COOKOUT_TOKEN`. They log in through the form with the real session cookie. A test that moves the clock runs on a dev cookout of its own: `clock.ts`'s `ownCookout` fixture starts one (`startDevCookout` from `scripts/lib/dev-cookout.ts`), points the test's page and clients at it, moves its clock with `daysPass` and stops it when the test ends, since days passing on the shared server would expire the other tests' sessions and command tokens and raise nudges in their inboxes. No browser test depends on run order. The own-clock lint rule (`lint/rules/own-clock.js`) fails any other browser test file that calls `moveClockForward`. Move the days before the page opens its live stream: each step of a moved clock wakes an open stream's heartbeat. Install the browser once, then run them (`pnpm check` runs them as its `browser` job):

```sh
pnpm exec playwright install --only-shell chromium
pnpm -s browser
```

## Other checks

- `pnpm pack:smoke` proves the published package works (CI runs it as its own job): it builds with tsdown and Vite, packs `@ai-hero/cookout`, installs the tarball in a temp directory, and drives `cookout serve` (its refusal without `COOKOUT_ADMIN_TOKEN`, its health check and the web UI at `/`), `cookout whoami` and `@ai-hero/cookout/sdk` from there. Nothing is published.
- `pnpm published-client` proves the newest published client still works against this commit's server (CI runs it as its own job, `published client`), so removing a response field too early fails ([ADR 0076](adr/0076-removing-a-response-field-takes-two-releases.md)). It installs `@ai-hero/cookout` at the version `npm view @ai-hero/cookout version` prints into a temp directory (the tarball is cached by version, in published-client under node_modules' cache directory), starts `app/dev.ts start`, and points the published `cookout` at it with `COOKOUT_URL`, with no harness variables and no Login. Through it, an agent joins (`join --print-env`), posts, is replied to, reads its inbox, acks, and watches for one mention; the admin adds and calls a command, then deactivates and reactivates the agent. Any non-zero exit fails it, including a `bad_response` from the published client's response validator. Last, its canary deactivates an agent with the field `identity` dropped from the answer (`scripts/drop-deactivate-identity.ts`, preloaded into the published CLI) and fails unless the published client refuses it. A change that has to break old clients on purpose adds a reviewed opt-out to `scripts/published-client-opt-outs.json`: `{ "step": "deactivate", "version": "0.2.1", "date": "YYYY-MM-DD", "reason": "why, with the ticket" }`. That step then runs with this commit's `cookout` instead. An opt-out holds only for the published version it names: once a newer version is published, the check refuses it until it is removed.
- The SDK's public surface is pinned by `api/sdk.api.md`. After a deliberate change to it, run `pnpm api:write` and commit the report.
- To run the server alone on a file you keep: `COOKOUT_ADMIN_TOKEN=<at least 32 characters> node app/main.ts serve --port 3000 --db cookout.db`. Every boot makes that the admin's token; it prints nothing about it.

## Deliver a call to the example handler

After "Start it", register a command whose URL is the example handler (`packages/handler-example`) on a free port, start the handler with the command's secret (the fourth line as a background command), and call it:

```sh
printf '{"type":"object","properties":{"branch":{"type":"string"}},"required":["branch"]}' > /tmp/cookout-ship.schema.json
env $(cat /tmp/cookout-dev.env) node app/main.ts command add ship --url http://127.0.0.1:48787/webhook --schema /tmp/cookout-ship.schema.json | jq -r '"COOKOUT_COMMAND_SECRET=\(.secret)"' > /tmp/cookout-ship.env
env $(cat /tmp/cookout-dev.env) node app/main.ts channel create ships
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-ship.env) HOST=127.0.0.1 PORT=48787 node packages/handler-example/app/main.ts > /tmp/cookout-handler.log 2>&1
env $(cat /tmp/cookout-dev.env) node app/main.ts command call ship --channel ships --data '{"branch":"main"}'
cat /tmp/cookout-handler.log
```

The call prints `{ messageId, threadId }` at once. In the background the server POSTs `{ command, data, channel, threadId, token, callId }` to the URL, signed in the `cookout-signature` header with the lowercase hex HMAC-SHA256 of the raw body, keyed with the command's secret (the scheme in `packages/handler-example/README.md`). The handler logs `call call_… of ship on thread …: 202` only for a signed call, then replies `/ship is done.` in the call's thread with data `{ received: { branch: "main" } }` (`message thread <threadId>`); a bad signature gets 401 and no line. With `"failFirst":true` in the data the first delivery logs `: 503` and the retry `: 202`. With the handler stopped, a call still answers 202 and the dev log gets a `WARN` line `An attempt at the webhook delivery call_… failed.` per attempt. The server retries 5 times with the same `callId`, waiting `COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS` (default 10) and then `COOKOUT_WEBHOOK_RETRY_FACTOR` (default 2.3) times longer each time, about 8 minutes in all; start it with `COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS=1 COOKOUT_WEBHOOK_RETRY_FACTOR=1` to see it in seconds. After the last failure the `ship` handler identity replies in the call's thread `The delivery of /ship to its handler failed after 5 retries.` (`message thread <threadId>`). `COOKOUT_WEBHOOK_TIMEOUT_SECONDS` (default 5) bounds each attempt. Pending deliveries are stored: stop the server (Ctrl-C) mid-backoff and start it again on the same `COOKOUT_DB`, and it resumes them on the same backoff with the same `callId` (the body carries a new command token).

## Version a release with Changesets

Changesets sets the version and CHANGELOG.md of `@ai-hero/cookout`. The private packages are never versioned.

A branch needs a changeset when it changes a file that ships in the package: a source the CLI or SDK build reaches through its imports (from `tsdown.config.ts`'s entries and package.json's `exports`), the web UI (`index.html`, what it loads, and `public/`), a path package.json's `files` lists, or the API report (`api/sdk.api.md`). Add one with `pnpm changeset`; for a change users never see, such as a refactor, add an empty one with `pnpm changeset --empty`. `pnpm check`'s hygiene check fails a branch that changes such a file and adds no `.changeset/*.md` since its merge base with v1, naming the files (#384). A change that deletes a changeset (the Version Packages pull request, or a branch carrying its commit) and a merge commit already on v1 are exempt. The canary in `lint/canary/changesets/` proves it fails. Only CI publishes, from the Version Packages pull request ([ADR 0050](adr/0050-the-cli-is-published-to-npm.md)). Never run `pnpm release`, `changeset publish` or `npm publish`. To prove the setup without changing anything, add a sample changeset on a throwaway branch, check the plan, version it, then discard the branch:

```sh
git checkout -b changeset-dry-run
printf -- '---\n"@ai-hero/cookout": minor\n---\n\nA sample changeset for the dry run.\n' > .changeset/dry-run.md
pnpm changeset status --verbose
pnpm run version
cat CHANGELOG.md
git status --short
git checkout -- package.json .changeset
rm -f CHANGELOG.md .changeset/dry-run.md
git checkout -
git branch -D changeset-dry-run
```

`pnpm changeset status --verbose` lists only `@ai-hero/cookout -> 0.1.0`. `pnpm run version` consumes the changeset, bumps `package.json` to 0.1.0, and writes a CHANGELOG.md with a `## 0.1.0` section under `### Minor Changes`. `git status --short` shows only `package.json`, the new CHANGELOG.md and the consumed changesets (the dry run's and the first-release changeset), so `packages/e2e` and `packages/handler-example` stay at 0.0.0. With no changeset, `pnpm changeset status` exits 1 ("Some packages have been changed but no changesets were found"), which is expected during the v1 build.

The release workflow, `.github/workflows/release.yml`, passes `actionlint` (for example `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest`). Its publish step runs only when no changesets are left, and has no npm token: it publishes by trusted publishing. `npm pack --dry-run` after `pnpm build` lists what would ship: `dist`, `docs/agents.md`, `skills`, README.md and package.json.

## Reply as the handler with the command token

Each delivery's `token` is a command token: it posts as the command's handler identity (an agent named after the command), only replies in that call's thread, for 24 h after the call. After "Deliver a call to the example handler", point a command at any receiver that prints the body it gets, call it, and post with the token it was sent (`TOKEN` and `THREAD` from the printed body):

```sh
curl -s -X POST "$COOKOUT_URL/v1/messages" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"channel\":\"ships\",\"replyTo\":$THREAD,\"text\":\"shipped main\"}"
curl -s -X POST "$COOKOUT_URL/v1/messages" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"channel":"ships","text":"top-level"}'
curl -s "$COOKOUT_URL/v1/channels" -H "Authorization: Bearer $TOKEN"
env $(cat /tmp/cookout-dev.env) node app/main.ts inbox
```

The reply is 201 with `author.name` the command's name. The top-level message and every other route get 403 `outside_command_thread`, as does a reply in another thread or channel. The caller started the thread, so follows it: their inbox lists the reply with the reason `followed-thread`. After 24 h the token gets 401 `token_expired` (the SDK test `command-token.test.ts` moves the test clock to show it).

## See messages from others arrive live

The web UI keeps the all-channels feed open (`GET /v1/events?channels=all`, an `EventSource` that sends the session cookie) once a logged-in view first loads, so a message another identity posts joins the open channel or thread without a reload; a reply also bumps its top-level message's reply count in the channel. A message in a channel the loaded channel list doesn't have (one created since it loaded) reloads the list, so that channel joins it. On a fresh seed of the built server ("Open the web UI" and "Log in to the web UI", logged in as `grace`), open `#general`, post as `ada` with the CLI, then open the thread and post a reply as `triage-agent`:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout wait --text "Lunch at 12:30."
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "ada") | .token' /tmp/cookout-built-seed.json) node app/main.ts message post general "Standup moved to 10."
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "ada") | .token' /tmp/cookout-built-seed.json) node app/main.ts message post general "Fixed it." --reply-to $(jq .thread /tmp/cookout-built-seed.json)
agent-browser --session cookout wait --text "Standup moved to 10." && agent-browser --session cookout snapshot
agent-browser --session cookout find text "4 replies" click && agent-browser --session cookout wait --text "Fixed it."
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "triage-agent") | .token' /tmp/cookout-built-seed.json) node app/main.ts message post general "Re-ran it: green." --reply-to $(jq .thread /tmp/cookout-built-seed.json)
agent-browser --session cookout wait --text "Re-ran it: green." && agent-browser --session cookout snapshot
```

Without a reload, the `#general` snapshot's `Messages` list ends with `@ada` and `Standup moved to 10.`, and the thread's first message now says `4 replies` (3 on the seed, plus `Fixed it.`). The thread's `Replies` list then ends with `@ada` `Fixed it.` and `@triage-agent` `Re-ran it: green.`. Stores read the stream through the `live` module (`app/modules/live/`), the one owner of `EventSource`, which checks each event with the SDK's `parseEvent` and drops one that doesn't match the protocol.

The same feed carries the board's other changes. A command registered (`cookout command add`) joins the `/` suggestions. Deleting a channel (`DELETE /v1/channels/<name>` as an admin) drops it from the sidebar, and a page open on it goes to the Inbox with a `#<name> was deleted` notice. An agent's owner and admins also hear each join, leave and revoke of its agent session, so Settings → My agents and its profile list the session again; a session that expires drops out within a second of its expiry.

## See unread counts in the sidebar

The sidebar's channel list shows each channel's unread messages for whoever is logged in, from their inbox (`GET /v1/inbox`, the `unread` module, `app/modules/unread/`): unread is at two levels (#152): for you (a mention, or a reply in a thread you started) and activity (the rest). A channel with any is bold, with the count of what is for them in a pill in the accent colour; its activity count is read out only, counted apart (a screen reader hears `2 unread` and `1 for you`). The `Inbox` link above does the same for the whole inbox. Each new inbox item on the live stream raises a count without a reload; each new read position drops what it covers, so opening the channel clears its top-level messages and opening a thread clears its replies. On a fresh seed of the built server ("Open the web UI" and "Log in to the web UI", logged in as `grace`), post to `#deploys` as `ada`, one message mentioning `grace`, then open `#deploys`, go to the Inbox, and open the thread in `#general`:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/" && agent-browser --session cookout snapshot
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "ada") | .token' /tmp/cookout-built-seed.json) node app/main.ts message post deploys "@grace can you check the 1.4.2 rollout?"
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "ada") | .token' /tmp/cookout-built-seed.json) node app/main.ts message post deploys "Rollback plan is in the doc."
agent-browser --session cookout wait 1000 && agent-browser --session cookout snapshot && agent-browser --session cookout screenshot unread.png
agent-browser --session cookout find text "#deploys" click && agent-browser --session cookout wait --text "Rollback plan is in the doc."
agent-browser --session cookout click 'a[href="#/inbox"]' && agent-browser --session cookout wait 1000 && agent-browser --session cookout snapshot
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout find text "3 replies" click && agent-browser --session cookout wait --text "Thanks, both of you."
agent-browser --session cookout open "http://127.0.0.1:3000/#/" && agent-browser --session cookout wait 1000 && agent-browser --session cookout snapshot
```

The first snapshot's `Channels` list has `#deploys` and `#general` bold, each with its unread count, matching her seeded inbox (`inbox` as `grace`, as in "Open a channel"): the `deploys` top-level messages are activity, and in `#general` `ada`'s reply in the thread is activity while `mentionOfGrace` is for her, so `#general` has a pill. Without a reload, the second has `#deploys`' count up by two and a pill for the new mention. After opening `#deploys` its link is `#deploys` again, no longer bold, while `#general` keeps its count. After opening the thread, `#general` drops the reply, as the thread view acks replies only, and keeps the pill for `mentionOfGrace`, a top-level message. A message that arrives live while its channel or thread is open counts as read: the open view acks it as it arrives, so the counts in every tab stay clear (board question #467, decided 2026-11-23 in #87).

### Mark a message unread

Every message's actions menu (right-click the message, or its `More actions` button) has `Mark unread`, whose tooltip reads `Mark unread (Alt-click)`. It marks that message unread with everything after it in its thread or channel (`POST /v1/read-positions/unread`): the `New` line moves above it, its channel's count in the sidebar shows them, and they are back in the Inbox, in every open tab. An Alt-click (Option-click on macOS) on a message does the same at once, in a channel, the thread panel or an Inbox conversation, and focuses and selects nothing; an Alt-click on a link, button or reaction inside the message does only what that element does, and a plain click marks nothing. A refused one shows an alert saying why. Still logged in as `grace`, open `#deploys` and Alt-click its `Deployed 1.4.0.` message (agent-browser can't hold Alt through a click, so dispatch it):

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/deploys" && agent-browser --session cookout wait --text "Deployed 1.4.0."
agent-browser --session cookout eval '[...document.querySelectorAll("article")].find((a) => a.textContent.includes("Deployed 1.4.0.")).dispatchEvent(new MouseEvent("click", { altKey: true, bubbles: true }))'
agent-browser --session cookout wait 1000 && agent-browser --session cookout snapshot
```

The snapshot has a separator named `New` just above `Deployed 1.4.0.`, and `#deploys` in the sidebar bold with its count; `inbox` as `grace` from the CLI lists it again. `app/modules/routes/tests/alt-click-unread.test.tsx` drives the feed, the thread panel, a link and a plain click.

## See the web UI in both themes

```sh
pnpm screenshots
```

It takes every standard screen in the light theme, then every one in the dark theme. For each theme it starts a fresh `app/dev.ts start` (as "Start it" does, so on the adjustable clock), seeds it as "Seed it" does and logs in as `grace` and as the admin in headless Chromium, so both themes start from the same seed and each pair shows the same state, even after a screen reads a thread: `inbox`, `inbox-nudge` (the inbox with the nudge row the nudge job raises under `For you` for `grace`'s quiet thread; it is taken after every other screen of its theme, once that board's clock has moved 3 days on, in a fresh login), `inbox-offer` (the admin's inbox with the Deactivation offer the offer job raises under `For you` about a person quiet for 30 days, once the clock has moved on to 30 days), `inbox-deactivated` (`grace`'s inbox with the entry about `triage-agent`, the agent she owns, deactivated after 90 days with no activity, under `For you`, taken last, once the clock has moved on to 90 days), `channel` (`#general`), `channel-hover` (`#general` with `grace`'s `Lunch at 12:30.` focused, showing its hover buttons and `Close`), `thread` (`general`'s seeded thread), `identity-card` (that thread with `@triage-agent` focused in a reply, opening its card), `identity-card-person` (`#general` with the `@grace` mention focused, opening a person's card), `people`, `profile` (`release-bot`, which the run gives a trigger URL, so it shows `Wakes on mention`), `wakes-on-mention` (the same profile, waiting for that line), `unreachable` (`rollback`, whose trigger URL refuses the connection, mentioned once in `#general`: the red dot and `Unreachable: …`), `admin-profile` (`release-bot` seen as the admin, with `Deactivate` and `Transfer`), `admin-deactivated` (the deactivated `old-deploy-bot` seen as the admin, with `Reactivate`), `confirm` (the admin's `Deactivate @release-bot?` dialog over `release-bot`'s profile), `settings` (`#/settings`), `new-channel` (`#general` with the sidebar's new channel form open) `narrow` (600 px wide with the sidebar open), `closed-threads` (`#deploys`, whose `deployed` and `rollbackCall` threads `grace` closes once the board is seeded, folded into `2 closed threads`), `closed-thread` (the closed `rollbackCall` thread's panel, with its `Closed by @grace` bar and `Reopen`), `sidebar-narrowest` and `sidebar-widest` (`#general` with the sidebar's edge focused and Home or End pressed; the width is kept for the rest of the run) and `collapsed` (`#general` with the sidebar collapsed to its rail; it comes last, as the collapse is kept for the rest of the run). Each is a file `<screen>-<theme>.png`, such as `thread-dark.png`, in a new temporary folder whose path is the last line it prints; read the PNGs from there. After each theme it stops that dev cookout, which deletes its database, leaving nothing running. `--only <screen>` (repeatable) takes only those screens, and `--out <dir>` writes to that folder instead:

```sh
pnpm -s screenshots --only thread --only narrow --out /tmp/cookout-shots
```

A screen whose text doesn't show within 15 s, or whose page throws, is listed on stderr as `<screen>-<theme>: <reason>`, and the command exits 1 after taking the rest. The screens and the text each waits for are `SCREENS` in [scripts/lib/screenshots.ts](../scripts/lib/screenshots.ts). Playwright needs Chromium once per machine, as in "Run the web tests".

## Switch the theme and see the workspace

The look is Vercel-like and neutral with small pops of colour: sans text, mono only for times and channel names. Its colours are design-system tokens in `app/modules/design-system/styles.css`: dark by default, light under `data-theme="light"` on the page's root, and light under `prefers-color-scheme: light` unless `data-theme="dark"`. The sidebar's `Settings` link opens the settings page (`#/settings`), a region named `Settings` with a section each, headed `Profile`, `Theme` and `My agents`; each heading links to its own section (`#/settings/profile`, `#/settings/theme`, `#/settings/agents`), and opening such a link puts the focus on that heading. `Theme` is a group of radios, `System`, `Light` and `Dark`: a choice applies at once, is kept in the browser's local storage (`cookout-theme`), and is applied before the first paint by `public/assets/theme.js` (the CSP allows no inline script); `System` removes it, so the theme follows the operating system with no script. Each author has an avatar of their initials in one of eight hues hashed from the name, the same on every screen: a circle for a human, a rounded square with a badge and an `agent` tag for an agent (from `GET /v1/identities`; an author no longer listed is an agent if the message carries an owner). In a message box, Enter sends, Shift+Enter starts a new line, and while the `@` (or, in a channel's box, `/`) suggestions show, the arrow keys move the highlight, Enter or Tab picks it and Escape closes the list; a hint line under the box says how to send and mention. `pnpm screenshots` takes the workspace in both themes ("See the web UI in both themes"). By hand, logged in as `grace` (the "Log in to the web UI" recipe, same session), pick `Light` or `Dark` in `Settings`:

```sh
agent-browser --session cookout find role link click --name "Settings" && agent-browser --session cookout find text "Light" click && agent-browser --session cookout screenshot /tmp/cookout-settings-light.png
```

Each screenshot shows the sidebar on the left (on the narrow one, over the page once opened). After `Light`, the page turns light at once, and a reload keeps it light.

## Read the inbox in the web UI

The inbox is the homepage: `#/`, no hash, any hash no page has, and the `cookout` name at the top of the sidebar (a real link, so Cmd/Ctrl-click opens a new tab) all open it, while a link to a channel, thread or message still opens that page. The sidebar's `Inbox` link (`#/inbox`) opens the logged-in human's inbox, headed `Inbox` with the muted line `Mentions, threads you follow, and channels you subscribe to`. It lists rows, not messages: one per thread (all its unread replies) and one per channel (all its unread top-level messages), grouped by the `unread` store from the same query as the API (`GET /v1/inbox`). First `For you` with how many rows it holds (a level-2 heading) and a list named `For you` of the rows with a mention or a reply in a thread they started, then `Activity` and a list named `Activity` of the other rows, each newest first by its latest message and shown only when it has rows; with none it says `You're all caught up.` Then an `Earlier` divider and a list named `Earlier` of the read rows, grouped the same way and newest first, from the inbox history (`GET /v1/inbox/history`), a page of 50 messages at a time: the full-width `Show earlier` button (a spinner and `Loading…` while it reads) merges the next page into the rows already shown, so a thread never shows twice, and `That's everything.` shows at the end; with none it says `Nothing read yet.` `pnpm screenshots --only inbox --only inbox-more --only inbox-loading` takes the inbox, its `Show earlier` button and the button loading, in both themes (the last two pretend the history has an older page). Each row is a link leading with its strongest reason, worded for a person (`Mentioned you`, then `Replied to you`, then `New reply in a thread you follow`, then `New in #general`; in the accent colour for a For you row), then its latest message's author's avatar and name, `posted in` or `replied in a thread in`, the channel in mono, `N new` when more than one of its messages is unread, and a short time (`just now`, `5m ago`, `2h ago`, `3d ago`); for a thread a muted `re:` line with the start of its top-level message; up to two lines of the latest message's text, each `@` mention styled (the reader's own in the mention colour). A For you row has an accent dot, an Activity row a muted dot, both with a bold name; a read row is muted. The Inbox is a split view: a thread's row links to its address in the Inbox, `#/inbox/<channel>/<thread>`, which selects it (the row is highlighted and its link marked as the current page; the sidebar's `Inbox` link stays active), and its conversation shows beside the list in a column named `Conversation`: a header with `Conversation`, the channel in mono and an `Open thread` link to `#/channels/<channel>/threads/<thread>`, then the thread's first message, then `N earlier replies` (the replies up to the reader's read position when the conversation opened; clicking it shows them in place), then the unread replies in full, rendered as the thread panel renders them, with new replies arriving live. With nothing selected the column says `Pick a conversation`; an address whose thread doesn't exist says `Nothing here` there, beside the list. Opening a thread's conversation reads nothing: once it has been on screen for 2 s with the tab visible and the window focused, it acks its newest message. A background tab, another window in front, or selecting another row before then leaves it unread, and the 2 s start again on return; a reply arriving live restarts them, and the next ack covers it. A reply of your own arriving in it, or the header's `Mark read` button (named `Mark conversation read`, so a screen reader tells it from an offline alert's `Mark read`), reads it at once and shows `Marked as read` with an `Undo` button for 5 s; `Undo` marks it unread from its first message that was unread when the row was selected, putting the row back. The header's `Mark unread` does the same (from the newest message if the row was already read), and while the row stays selected the 2 s rule doesn't read it again. Check the timing with `inbox` as the reader through the CLI: its replies are still listed a second after selecting the row, and gone after 2 s. Opening the thread from its channel still reads it at once. A row read while selected stays in its section, muted and without its `N new`, until another row is selected, and only then moves to Earlier. Under 768 px the conversation replaces the list, with a back arrow (`Back to the inbox`) to `#/inbox`. A channel's row links to `#/inbox/<channel>`, which selects it the same way: its conversation has a header with `Conversation`, the channel in mono and an `Open in #<channel>` link to `#/channels/<channel>`, then the one top-level message just before the row's first post (none when that post is the channel's first), a `New` line, and the row's posts, with new posts in the channel arriving live and joining the row. It reads by the same rule as a thread's conversation, with the same `Mark read`, `Mark unread` and `Undo`: the ack is of the row's newest post, which reads every top-level message up to it, and a reply of your own sent from its box reads it at once; the row stays put while selected. A read channel row selected from `Earlier` shows every post it holds. An address whose channel has been deleted (or has no posts in the Inbox) says `Nothing here` beside the list. `pnpm screenshots --only inbox-thread --only inbox-narrow --only inbox-channel --only inbox-marked` takes the seeded thread selected, wide and at 600 px, the seeded `#deploys` row selected, and the thread with `Marked as read` and `Undo` after clicking `Mark read`, in both themes. Both follow the live stream: a new message joins its row (its latest line and count change and it moves to the top of its section) or adds one, and a read position from any session of the same identity, such as another tab acking by opening a channel, moves the rows it covers to Earlier in every open tab without a reload.

On a fresh seed of the built server ("Open the web UI" and "Log in to the web UI"), post 52 mentions of `grace` from the CLI as `ada`, have `grace` ack the fiftieth (which reads every top-level message in `general` up to it), then post two more:

```sh
jq -r '.identities[] | select(.identity.name == "ada") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-built-seed.json > /tmp/cookout-built-ada.env
jq -r '.identities[] | select(.identity.name == "grace") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-built-seed.json > /tmp/cookout-built-grace.env
for i in $(seq 1 52); do
  id=$(env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 $(cat /tmp/cookout-built-ada.env) node app/main.ts message post general "@grace build $i is green" | jq .message.id)
  if [ "$i" = 50 ]; then env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 $(cat /tmp/cookout-built-grace.env) node app/main.ts ack "$id"; fi
done
env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 $(cat /tmp/cookout-built-ada.env) node app/main.ts message post general "@grace can you review the rollout notes?"
env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 $(cat /tmp/cookout-built-ada.env) node app/main.ts message post general "@grace standup moved to 10:30"
```

Then, logged in as `grace` in the dark theme, screenshot the inbox, its foot before and after `Show earlier`, then the same in the light theme:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/inbox" && agent-browser --session cookout wait --text "standup moved to 10:30" && agent-browser --session cookout snapshot
agent-browser --session cookout screenshot /tmp/cookout-inbox-dark.png
agent-browser --session cookout eval '{ const a = document.querySelector("section[aria-label=Inbox]"); a.scrollTop = a.scrollHeight; }' && agent-browser --session cookout screenshot /tmp/cookout-inbox-more-dark.png
agent-browser --session cookout find role button click --name "Show earlier" && agent-browser --session cookout wait --text "That's everything."
agent-browser --session cookout eval '{ const a = document.querySelector("section[aria-label=Inbox]"); a.scrollTop = a.scrollHeight; }' && agent-browser --session cookout screenshot /tmp/cookout-inbox-end-dark.png
```

The snapshot's `For you 1` list holds one `#general` row, `Mentioned you ada posted in #general 4 new … @grace standup moved to 10:30` (the review request and builds 52 and 51 are in it too); the `Activity` list holds the seeded `#deploys` row (`New in #deploys`, `3 new`, for `deployed`, `rollbackCall` and `oldBotPost`) and the thread's row, `New reply in a thread you follow ada replied in a thread in #general re: Morning! Who is looking at the flaky login test? Thanks, both of you.` The `Earlier` list's `#general` row shows build 50, above `Show earlier`; after it, that row is still the only `#general` row (builds 1 to 50 and the seeded `@grace can you check the notes before we ship?` merged into it), the read thread replies sit in their thread's row, `That's everything.` ends the list, and the button is gone. Switch to `Light` in Settings and take the same screenshots. Open `#general` in a second tab (`tab new "http://127.0.0.1:3000/#/channels/general"`) and go back to the first: without a reload the `#general` row has moved to the top of `Earlier`, leaving the thread's row in `Activity`, and the sidebar's `#general` pill is gone.

To check selecting a row, open the thread's row from the first tab's Inbox (`find role link click --name "New reply in a thread you follow"`): the address becomes `#/inbox/general/1`, the `Conversation` column shows `Morning! Who is looking at the flaky login test?`, then `2 earlier replies`, then `Thanks, both of you.`, and the row stays in `Activity`, muted. Click `2 earlier replies` and the two earlier replies show above it. Open `#/inbox`, so nothing is selected, and the thread's row moves to `Earlier`. At 600 px wide (`agent-browser --session cookout set viewport 600 900`), `#/inbox/general/1` shows only the conversation, and its back arrow returns to the list. To check a channel row, open the `#deploys` row (`find role link click --name "New in #deploys"`): the address becomes `#/inbox/deploys`, the `Conversation` column shows the row's unread `deploys` posts, ending with `Deployed 1.4.0.`, after the one top-level message before the first of them (with a `New` line between), and nothing older, and `Open in #deploys` goes to `#/channels/deploys`. Post to `deploys` from the CLI as `ada` while it is open and the post joins the conversation and the row without a reload.

The Inbox works from the keyboard. With nothing selected, `j` (or `↓`) selects the first row that opens beside the list, and each press after selects the next one in on-screen order (`For you`, then `Activity`, then `Earlier`), changing the address and focusing the row, which scrolls it into view with a focus ring; `k` (or `↑`) selects the previous one. Both stop at the ends. `Enter` or `r` puts the cursor in the conversation's reply box, if it has one; `Esc` there returns focus to the selected row and keeps the draft. `e` presses the conversation's `Mark read` button (reading the row at once, with the Undo note) and `u` its `Mark unread` button, and `o` the `Open thread` (or `Open in #<channel>`) link; each names its key in its tooltip, as in `Mark read (e)`, and in `aria-keyshortcuts`. Under 768 px, `Esc` in a conversation goes back to `#/inbox`; at full width it does nothing outside a text field. The keys do nothing while typing in a text field (other than `Esc`), with Ctrl, Alt or Meta held, or when another handler took the press, such as the `@` suggestions taking `↑`, `↓` and `Enter`. To check, open `#/inbox` and press `j` (`agent-browser --session cookout press j`): the address becomes the first row's and its row has the focus ring; press `e` and the row is read at once, `u` and it is unread again, then `o` and the thread opens in its channel. `pnpm screenshots --only inbox-thread` shows the selected row's focus ring in both themes.

A `For you` or `Activity` row has an actions menu, `Inbox row actions`, opened by right-clicking it, by its `More actions` button (shown on hover or focus) or by the context-menu key or Shift+F10 on its link; `Earlier` rows have none. `Mark read` (a double check) acks the row's latest message, as the conversation's ack does, so the row moves to Earlier; on the selected row once read it is `Mark unread` (a dot) instead, which marks it unread from its first message, as the header's button does. `Open in channel` (a `#`) leads to the latest message in its thread (`#/channels/<channel>/threads/<thread>/messages/<id>`) when it is a reply, or to its channel. `pnpm screenshots --only inbox-row-menu` takes the thread row's menu open from `More actions` in both themes.

The Inbox shows a closed thread's unread messages like any other: its row stays in `For you` or `Activity`, counted there, in the sidebar's `Inbox` pill and its channel's pill, and in the page title, with a small `Closed` marker after its channel while the thread is closed (by its top-level message's `closedAt`). Opening the row shows the thread in the conversation, with `Reopen` in its header. It follows the `thread` event live, so someone else's close or reopen adds or takes off the marker without a reload, and the row stays. Still logged in as `grace` on the Inbox, close the seeded thread as `ada`, read `grace`'s inbox, then reopen it:

```sh
env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 $(cat /tmp/cookout-built-ada.env) node app/main.ts thread close $(jq .thread /tmp/cookout-built-seed.json)
agent-browser --session cookout snapshot
env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 $(cat /tmp/cookout-built-grace.env) node app/main.ts inbox | jq -c '[.items[].parent.closedAt != null] | any'
env $(cat /tmp/cookout-built.env) COOKOUT_ALLOW_HUMAN=1 $(cat /tmp/cookout-built-ada.env) node app/main.ts thread reopen $(jq .thread /tmp/cookout-built-seed.json)
agent-browser --session cookout snapshot
```

After the close, the thread's row (`re: Morning! Who is looking at the flaky login test?`) is still in `Activity`, now marked `Closed`, without a reload, and the CLI prints `true`: the server's inbox holds the thread's replies, its parent closed. After the reopen, the row is unchanged but for the marker, which is gone.

Each unread Nudge (`nudges` in `GET /v1/inbox`) is a row of its own at the top of `For you`, counted in its heading and in the sidebar's `Inbox` pill as `for you`: the nudge's text (`Quiet for 3 days: close it, or follow up?`) in the accent colour, the thread's starter, `started a thread in`, the channel, when it was raised and the thread's first line, linking to the thread, with `Close` (closes the thread as the reader, which reads the nudge) and `Mark read` (`POST /v1/inbox/nudges/:id/read`). `Mark all as read` covers them too. A read nudge shows, muted and without buttons, in a list named `Earlier nudges` under `Earlier`, from the inbox history's `nudges`. Live, a `nudge` event adds a row, and a `thread` event closing its thread or a new reply in it (a `message` event) moves it to Earlier, as the server reads it then; so does a `nudge-read` event, which the server sends to every stream of the recipient when a nudge is marked read in another session or tab. `app/modules/routes/tests/server/inbox-nudge-tabs.clock.test.tsx` drives two pages for one person. A nudge takes 3 quiet days: after "Start it" and "Seed it", move the dev cookout's clock 3 days on (`curl -X POST -H 'content-type: application/json' -d '{"days": 3}' "$(grep '^{' /tmp/cookout-dev.log | jq -r .clockUrl)/__clock/forward"`) and `grace`'s Inbox has one. `app/modules/routes/tests/server/inbox-nudges.clock.test.tsx` drives the rows under `TestClock`, and `pnpm screenshots --only inbox-nudge` takes the Inbox with the nudge the nudge job raised once the clock moved, in both themes.

Each open Deactivation offer (`deactivationOffers` in `GET /v1/inbox`) is a row of its own at the top of `For you`, above the nudges, counted in its heading and in the sidebar's `Inbox` pill as `for you`: the offer's text (`@release-bot has had no activity for 30 days. Deactivate it?`) in the accent colour, then the agent's avatar and name, linking to its profile panel beside the inbox (`#/inbox?profile=<name>`), and when it was raised, with `Deactivate` (the same `Deactivate @<name>?` confirmation as on its profile, then `POST /v1/identities/:name/deactivate`) and `Keep` (`POST /v1/inbox/deactivation-offers/:id/keep`). `Mark all as read` clears offers as `Keep` does (Matt, #232, 2026-11-23). A cleared offer shows, muted and without buttons, in a list named `Earlier deactivation offers` under `Earlier`, from the inbox history's `deactivationOffers`. Live, a `deactivation-offer` event adds a row or, cleared, moves it to Earlier: another recipient's `Keep` (an admin's, on a shared offer), the agent's activity, or its deactivation anywhere. An offer takes 30 quiet days, so no recipe here waits for one: `app/modules/routes/tests/server/inbox-deactivation-offers.clock.test.tsx` drives the rows under `TestClock`, and `pnpm screenshots --only inbox-offer` takes the admin's Inbox with the offer the offer job raised about a person once the dev cookout's clock moved 30 days on, in both themes.

Each unread entry about a deactivated quiet agent (`deactivatedQuietAgents` in `GET /v1/inbox`) is a row of its own at the top of `For you`, above the offers, counted in its heading and in the sidebar's `Inbox` pill as `for you`: the entry's text (`@triage-agent was deactivated after 90 days with no activity.`) in the accent colour, then the agent's avatar and name, linking to its profile panel beside the inbox, and when it was deactivated, with `Reactivate` (the same `Reactivate @<name>?` confirmation as on its profile, then `POST /v1/identities/:name/reactivate`, which reads the entry; the fresh token shows once in the row, with `Copy token` and `Done`, and stays there after the row moves to Earlier until `Done`) and `Mark read` (`POST /v1/inbox/deactivated-quiet-agents/:id/read`). `Mark all as read` reads them too. A read entry shows, muted and without buttons, in a list named `Earlier deactivated agents` under `Earlier`, from the inbox history's `deactivatedQuietAgents`. Live, a `deactivated-quiet-agent` event adds a row or, read, moves it to Earlier: Mark read in another session, or the agent reactivated anywhere. An entry takes 90 quiet days, so no recipe here waits for one: `app/modules/routes/tests/server/inbox-deactivated-quiet-agents.clock.test.tsx` drives the rows under `TestClock`, and `pnpm screenshots --only inbox-deactivated` takes `grace`'s Inbox with the entry about `triage-agent` once the dev cookout's clock moved 90 days on, in both themes.

## Browse people and agents

The sidebar's `People & agents` link (`#/people`) opens a directory of every identity, from `GET /v1/identities`, which any identity may read: a `People & agents` heading with how many identities there are, a `Filter by name` box, and `All`, `Humans` and `Agents` chips, pressed one at a time, each with how many of that kind the name filter leaves. The list named `Identities` has a link per identity shown, sorted by name: its avatar, its name, `(you)` on the logged-in human, an `agent` tag on an agent and an `admin` tag on an admin, then `Human`, `Agent · owned by <owner>` or `Agent`. When the filters leave nobody it says `Nobody matches.` The filter and chips are kept for the page's life, so they survive opening a profile. `#/people/<name>` also opens that identity's profile in a panel named `Profile` beside the list, with its row highlighted: a large avatar, its name and tags, its display name if it has one, its kind and owner, and `joined <date>` (`YYYY-MM-DD`, UTC), with a `Close profile` link back to `#/people`. A name no identity has says `Unknown identity`; a name no identity could have (`#/people/Not_A_Name`) says "Nothing here". The avatar and name at the foot of the sidebar link to the logged-in human's own profile. The list loads when the page does, so an identity created later shows after a reload. `pnpm screenshots --only people --only profile` takes the list and `release-bot`'s profile in both themes ("See the web UI in both themes"). On a fresh seed of the built server ("Open the web UI" and "Log in to the web UI", logged in as `grace`), drive it:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/people" && agent-browser --session cookout wait --text "release-bot" && agent-browser --session cookout snapshot
agent-browser --session cookout open "http://127.0.0.1:3000/#/people/release-bot" && agent-browser --session cookout wait --text "Agent · owned by ada"
agent-browser --session cookout find role link click --name "Close profile" && agent-browser --session cookout get url
agent-browser --session cookout find role button click --name "Agents 3" && agent-browser --session cookout screenshot /tmp/cookout-agents-dark.png
```

The snapshot has `6 identities`, the chips `All 6`, `Humans 3` and `Agents 3`, and the rows `ada Human`, `admin ADMIN Human`, `grace (you) Human`, `release-bot AGENT Agent · owned by ada`, `rollback AGENT Agent · owned by ada` and `triage-agent AGENT Agent · owned by grace` (the tags are upper-cased by style only), the same identities, kinds and owners as `node app/main.ts identity list`. The `profile` screenshots show `release-bot` with its `agent` tag, `Agent · owned by ada` and today's date, its row highlighted. Closing it moves to `http://127.0.0.1:3000/#/people`, and `Agents 3` leaves the three agents.

## See an identity's card

A message's author name and each `@name` in its text, in a channel, a thread and an Inbox conversation, open a card about that identity, for people and agents alike: after a short hover, or at once when the name takes focus. The card is a tooltip (`role="tooltip"`, the name's `aria-describedby`) led by a header like the profile page's: the identity's large avatar (a circle for a person, a rounded square for an agent) with its presence dot, and beside it the display name with an agent's `agent` tag, and the `@name` under it when there is one. Below come the presence words from the same presence as People (`Online`, `Offline, last seen 5 minutes ago`, `Offline, went offline unexpectedly`), updated live with the dot, and with no dot and no words while presence isn't known; `Human`, `Agent · owned by <owner>` or `Agent`; an agent's description, if it has one; `Deactivated` for a deactivated identity; and a `View profile` link to `#/people/<name>`, which opens People with that profile. The pointer can move onto the card to follow the link. Leaving with the pointer, `Esc` or moving focus away closes it; hovering or focusing never moves focus into it. A name the identity list doesn't hold opens no card. `pnpm screenshots --only identity-card --only identity-card-person` takes an agent's card and a person's in both themes. On a fresh seed of the built server, logged in as `grace`, focus the mention (a headless browser matches no hover, so focus stands in for it):

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general/threads/1" && agent-browser --session cookout wait --text "can you post the failing run?"
agent-browser --session cookout eval 'document.querySelector("article a[href*=\"triage-agent\"]").focus()' && agent-browser --session cookout wait --text "View profile" && agent-browser --session cookout screenshot card.png
agent-browser --session cookout find role link click --name "View profile" && agent-browser --session cookout get url
```

The card shows `triage-agent`'s rounded-square avatar with the warning dot, `triage-agent` with its `agent` tag, `Offline, went offline unexpectedly`, `Agent · owned by grace` and `View profile`; following the link moves to `http://127.0.0.1:3000/#/people/triage-agent`. Pressing `Esc` with the mention focused closes the card.

## Manage agents in the web UI

A logged-in human manages the agents it owns in the `My agents` section of the settings page (`#/settings/agents`), and an admin does the same to any identity from its profile (mattpocock/cookout#121). `My agents` lists each agent the human owns in a group named `@<agent>`: its name (with `(deactivated)` if it is), its live agent session (`Joined from <host> · last used <time> · expires <time>`, or `No live session`), and `Rotate token`, `Revoke session` (only while a session is live) and `Deactivate`, or `Reactivate` once deactivated. `Deactivate` stands where the ticket said Delete ([ADR 0045](adr/0045-identities-are-deactivated-never-deleted.md)). Every one of these actions, and `Delete` and `Transfer` below, asks first in a modal dialog ([ADR 0080](adr/0080-design-system-components-are-hand-written-and-radix-only-for-behaviour.md), mattpocock/cookout#176): titled with the question (`Deactivate @<agent>?`, `Rotate @<agent>'s token?`, `Transfer @<agent> to @<owner>?`), a line saying exactly what happens (for a handler identity, `Deactivate` and `Delete` add that its command stops replying, mattpocock/cookout#198), `Cancel` and a confirm button (`Deactivate @<agent>`, `Rotate token`, `Revoke session`, `Reactivate @<agent>`, `Delete @<name>`, `Transfer to @<owner>`), in the destructive colour for `Delete`, `Rotate token` and `Revoke session`, which can't be undone. Focus stays inside it; Escape or `Cancel` closes it and puts focus back on the button that opened it. While the action runs both buttons are disabled and the confirm button says `Working…`; it closes once the action succeeds. A rotated or reactivated agent's new Identity token shows once, labelled `New Identity token`, with `Copy token`, `Done` and the warning `Copy it now: it isn't shown again, and the old token stops working.` The form `Create an agent` makes an agent the human owns and shows its token the same way, in its new group. A refusal shows inline: `Couldn't create the agent (<code>): <message>` in the form, or `Couldn't <action> (<code>): <message>` inside the dialog, which stays open until `Cancel`. On a profile, an agent's owner gets the same actions; an admin gets them on any identity but its own, plus a `Transfer @<agent>` form for an agent, and `Deactivate`/`Reactivate` for a human; for an identity no message names that owns no agents, the admin gets `Delete` in place of `Deactivate`, which asks first (`Delete @<name>`, saying it can't be undone) and leaves the profile showing `Unknown identity` ([ADR 0054](adr/0054-an-identity-no-message-names-can-be-deleted.md)); anyone else gets none. A deactivated identity keeps its display name on its messages and profile, marked `(deactivated)`; `People & agents` leaves it out until `Show deactivated` is pressed, and `@` suggestions never offer it.

On a fresh seed of the built server ("Open the web UI" and "Log in to the web UI"), join `release-bot` from the CLI, then log in as `ada` with `agent-browser --session cookout` (as "Log in to the web UI", with `ada`'s token):

```sh
token() { jq -r --arg name "$1" '.identities[] | select(.identity.name == $name) | .token' /tmp/cookout-built-seed.json; }
COOKOUT_URL=http://127.0.0.1:3000 COOKOUT_TOKEN=$(token release-bot) COOKOUT_STATE_DIR=/tmp/cookout-web-owned node app/main.ts join --as release-bot > /dev/null
agent-browser --session cookout open "http://127.0.0.1:3000/#/settings/agents" && agent-browser --session cookout wait --text "Joined" && agent-browser --session cookout screenshot /tmp/cookout-my-agents.png
agent-browser --session cookout find role button click --name "Revoke session" && agent-browser --session cookout wait --text "Its live agent session ends" && agent-browser --session cookout screenshot /tmp/cookout-confirm.png
agent-browser --session cookout find role button click --name "Revoke session" && agent-browser --session cookout wait --text "No live session"
agent-browser --session cookout find role button click --name "Rotate token" && agent-browser --session cookout wait --text "can't be brought back" && agent-browser --session cookout find role button click --name "Rotate token" && agent-browser --session cookout wait --text "Copy it now" && agent-browser --session cookout snapshot
COOKOUT_URL=http://127.0.0.1:3000 COOKOUT_TOKEN=$(token release-bot) node app/main.ts whoami
```

`release-bot`'s group shows `Joined from <this machine> · last used … · expires …`; `/tmp/cookout-confirm.png` shows the `Revoke @release-bot's session?` dialog over the dimmed page; after confirming `Revoke session` it says `No live session`; after confirming `Rotate token` the snapshot has the `New Identity token`, and the old token's `whoami` is 401 `token_revoked`. Log in as the admin (its token is in `/tmp/cookout-built-admin.env`), open `http://127.0.0.1:3000/#/people/rollback`, fill the `Transfer @rollback` form with `grace`, press `Transfer` and then `Transfer to @grace` in the dialog: the profile says `Agent · owned by grace` at once. As `grace`, `#/people/release-bot` shows no buttons. `pnpm screenshots --only settings` shows `grace`'s `My agents` (`triage-agent`) in both themes. Remove the state folder when done: `rm -r /tmp/cookout-web-owned`.
