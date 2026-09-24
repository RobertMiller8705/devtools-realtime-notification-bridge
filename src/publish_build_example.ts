import { randomUUID } from "node:crypto";
import { InfraiRealtime } from "./infrai_realtime.js";
import { decideNotification } from "./notification_policy.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");

const realtime = new InfraiRealtime(apiKey);
const decision = decideNotification(
  { kind: "build", project: "agent-index", buildId: "build-184", status: "passed", branch: "main" },
  new Date().toISOString()
);

await realtime.createChannel(decision.channel, `channel-${decision.channel}`);
try {
  const token = await realtime.issueToken("developer-alex", [decision.channel], `session-${decision.channel}`);
  const receipt = await realtime.publish(
    decision.channel,
    decision.event,
    decision.data,
    "agent-index",
    randomUUID()
  );

  console.log(JSON.stringify({ channel: decision.channel, event: decision.event, token, receipt }, null, 2));
} finally {
  await realtime.deleteChannel(decision.channel);
}
