import express from "express";
import { z } from "zod";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.js";
import { decideNotification, developerEventSchema } from "./notification_policy.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const realtime = new InfraiRealtime(apiKey);
const app = express();
app.use(express.json());

const tokenRequestSchema = z.object({
  clientId: z.string().min(1),
  project: z.string().min(1),
  audience: z.enum(["activity", "on-call"])
});

app.post("/session", async (request, response, next) => {
  try {
    const input = tokenRequestSchema.parse(request.body);
    const channel = `devtools:${input.project}:${input.audience}`;
    const token = await realtime.issueToken(input.clientId, [channel], request.get("Idempotency-Key"));
    response.status(200).json({ channel, token });
  } catch (error) {
    next(error);
  }
});

app.post("/events", async (request, response, next) => {
  try {
    const input = developerEventSchema.parse(request.body);
    const decision = decideNotification(input, new Date().toISOString());
    const receipt = await realtime.publish(
      decision.channel,
      decision.event,
      decision.data,
      input.project,
      request.get("Idempotency-Key")
    );
    response.status(202).json({ decision, receipt });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: "Invalid request", issues: error.issues });
    return;
  }
  if (error instanceof InfraiError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    response.status(status).json({ error: error.message, detail: error.detail });
    return;
  }
  response.status(500).json({ error: "Unexpected service error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Developer notification service listening on http://localhost:${port}`));
