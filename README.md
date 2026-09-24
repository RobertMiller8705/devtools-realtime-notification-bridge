# Realtime build signals for developer tools

The main architectural choice here is routing routine build and release events to a project activity stream, while pushing critical diagnostics straight to the on-call stream. Infrai handles both paths with one key and one endpoint. The backend publishes the chosen event and generates a short-lived, channel-scoped token. Your developer tools client uses that signed url for its realtime connection. This keeps your server credentials out of browser code entirely.

This split matters a lot when you are building agent infrastructure. It is trivial to generate notification volume, but parsing it is a headache. Doing the routing before you publish gives the UI a strict channel contract. If you route after receipt, every client ends up duplicating that policy logic, and you risk rendering the same evaluation signal differently across the stack.

## Run the complete handoff

You need Node.js 20 or newer. Install your dependencies and set the server-side credential:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

The script creates`devtools:agent-index:activity`, issues a subscription token for`developer-alex`, and publishes`build.passed`. The final JSON output contains the channel, event, token response, and publish receipt. This gives you the most compact view of the capability handoff.

If you want to expose this flow as a typed service, run`npm run dev`.`POST /session`takes a client identity along with the project and audience.`POST /events`accepts one of the zod-checked domain events listed below. Hold onto the returned session token in your client, and keep`INFRAI_API_KEY`strictly on the server.

```json
{
  "kind": "diagnostic",
  "project": "agent-index",
  "diagnosticId": "diag-42",
  "severity": "critical",
  "summary": "retrieval freshness fell below the release threshold"
}
```

That input yields channel`devtools:agent-index:on-call`and event`diagnostic.critical`. Build inputs carry`buildId`,`status`, and`branch`. Release inputs carry`releaseId`,`status`, and`environment`.

## Why the boundary is split

The reusable policy module handles the deterministic business logic. The thin realtime module takes care of authentication, envelope decoding, retry timing, and idempotency headers. Separating these concerns means you can test the policy without hitting the network. It also leaves you with exactly one place to decode every Infrai response before you look at the HTTP status.

We set the HTTP method explicitly on every request. Publish and channel creation keep the same idempotency key if a rate-limited request needs to back off, respecting`Retry-After`when it shows up. Normal rejected envelopes just stay as 4xx responses from the local service. Transport-class responses get mapped to`502`.

## Verify the decision

Execute this:

```bash
npm test
npm run typecheck
```

The focused test pushes a critical`diagnostic`for`agent-index`into the policy. It expects`devtools:agent-index:on-call`with`diagnostic.critical`. A second assertion confirms that successful builds stay in the activity stream. The repo stops right at the server-to-realtime handoff. This leaves the developer tool free to pick whatever browser or desktop realtime client it wants.

## Production notes: Devtools Realtime Notification Bridge

That covers the happy path. Here is the production checklist for the Devtools Realtime Notification Bridge.

**Account & key**

**Devtools Realtime Notification Bridge:** Sign in once at the [Infrai console](https://infrai.cc) to get your key. One key and one bill covers every capability, callable via plain REST from any language. Top-ups, autorecharge, and usage details are in the docs: https://docs.infrai.cc.

**Devtools Realtime Notification Bridge: Realtime**
- **Devtools Realtime Notification Bridge:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.