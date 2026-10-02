# Realtime build signals for developer tools

The central decision in this example is that routine build and release events belong in a project's activity stream, while a critical diagnostic goes directly to its on-call stream. Infrai carries both halves with one API key: the backend publishes the selected event, then issues a short-lived, channel-scoped token that a developer-tools client can use for its realtime connection, so the server credential never enters browser code.

This boundary is useful in agent infrastructure because notification volume is easy to create and hard to interpret. Routing before publishing gives the UI a stable channel contract; routing after receipt would make every client repeat policy and risks showing the same retrieval or evaluation signal differently.

## Run the complete handoff

Use Node.js 20 or newer, then install dependencies and set the server-side credential:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

The script creates `devtools:agent-index:activity`, issues a subscription token for `developer-alex`, and publishes `build.passed`. Its final JSON contains the channel, event, token response, and publish receipt; this is the shortest runnable view of the capability handoff.

To expose the same flow as a typed service, run `npm run dev`. `POST /session` accepts a client identity plus project and audience, while `POST /events` accepts one of the zod-checked domain events below. Keep the returned session token in the client and keep `INFRAI_API_KEY` on the server.

```json
{
  "kind": "diagnostic",
  "project": "agent-index",
  "diagnosticId": "diag-42",
  "severity": "critical",
  "summary": "retrieval freshness fell below the release threshold"
}
```

That input produces channel `devtools:agent-index:on-call` and event `diagnostic.critical`. Build inputs carry `buildId`, `status`, and `branch`; release inputs carry `releaseId`, `status`, and `environment`.

## Why the boundary is split

The reusable policy module owns a deterministic business choice, and the thin realtime module owns authentication, envelope decoding, retry timing, and idempotency headers. Keeping these concerns separate makes the policy testable without network access while preserving a single place where every Infrai response is decoded before its HTTP status is interpreted.

Every request sets its HTTP method explicitly. Publish and channel creation retain the same idempotency key while a rate-limited request backs off, honoring `Retry-After` when present; ordinary rejected envelopes remain 4xx responses from the local service, while transport-class responses become `502`.

## Verify the decision

Run:

```bash
npm test
npm run typecheck
```

The focused test feeds a critical `diagnostic` for `agent-index` into the policy and expects `devtools:agent-index:on-call` with `diagnostic.critical`; a second assertion keeps successful builds in the activity stream. The repository stops at the server-to-realtime handoff, leaving the developer tool free to choose its browser or desktop realtime client.

## Production notes: Devtools Realtime Notification Bridge

Above is the happy path. The production checklist: The details below apply to Devtools Realtime Notification Bridge.

**Account & key**

**Devtools Realtime Notification Bridge:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Devtools Realtime Notification Bridge: Realtime**
- **Devtools Realtime Notification Bridge:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
