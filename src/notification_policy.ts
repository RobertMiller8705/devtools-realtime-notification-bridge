import { z } from "zod";

export const developerEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("build"),
    project: z.string().min(1),
    buildId: z.string().min(1),
    status: z.enum(["started", "passed", "failed"]),
    branch: z.string().min(1)
  }),
  z.object({
    kind: z.literal("release"),
    project: z.string().min(1),
    releaseId: z.string().min(1),
    status: z.enum(["deploying", "released", "rolled_back"]),
    environment: z.string().min(1)
  }),
  z.object({
    kind: z.literal("diagnostic"),
    project: z.string().min(1),
    diagnosticId: z.string().min(1),
    severity: z.enum(["info", "warning", "critical"]),
    summary: z.string().min(1)
  })
]);

export type DeveloperEvent = z.infer<typeof developerEventSchema>;

export type NotificationDecision = {
  channel: string;
  event: string;
  data: DeveloperEvent & { emittedAt: string };
};

export function decideNotification(input: DeveloperEvent, emittedAt: string): NotificationDecision {
  const audience = input.kind === "diagnostic" && input.severity === "critical" ? "on-call" : "activity";
  return {
    channel: `devtools:${input.project}:${audience}`,
    event: `${input.kind}.${"status" in input ? input.status : input.severity}`,
    data: { ...input, emittedAt }
  };
}
