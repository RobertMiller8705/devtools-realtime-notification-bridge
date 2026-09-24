import assert from "node:assert/strict";
import test from "node:test";
import { decideNotification } from "../src/notification_policy.js";

test("critical diagnostics reach the on-call channel", () => {
  const decision = decideNotification(
    {
      kind: "diagnostic",
      project: "agent-index",
      diagnosticId: "diag-42",
      severity: "critical",
      summary: "retrieval freshness fell below the release threshold"
    },
    "2026-09-04T12:00:00.000Z"
  );

  assert.equal(decision.channel, "devtools:agent-index:on-call");
  assert.equal(decision.event, "diagnostic.critical");
  assert.equal(decision.data.emittedAt, "2026-09-04T12:00:00.000Z");
});

test("successful builds stay in the project activity stream", () => {
  const decision = decideNotification(
    { kind: "build", project: "agent-index", buildId: "build-184", status: "passed", branch: "main" },
    "2026-09-04T12:00:00.000Z"
  );

  assert.equal(decision.channel, "devtools:agent-index:activity");
  assert.equal(decision.event, "build.passed");
});
