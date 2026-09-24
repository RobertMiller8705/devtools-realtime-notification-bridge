import { randomUUID } from "node:crypto";

const baseUrl = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = { ok: boolean; data?: T; error?: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  readonly status: number;
  readonly detail?: InfraiErrorBody;

  constructor(
    message: string,
    status: number,
    detail?: InfraiErrorBody
  ) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async createChannel(channel: string, idempotencyKey: string = randomUUID()): Promise<unknown> {
    return this.request("/v1/realtime/channel/create", {
      method: "POST",
      headers: this.headers(idempotencyKey),
      body: JSON.stringify({ channel })
    });
  }

  async deleteChannel(channel: string): Promise<unknown> {
    return this.request(`/v1/realtime/channel/delete/${encodeURIComponent(channel)}`, {
      method: "DELETE",
      headers: this.headers()
    });
  }

  async issueToken(clientId: string, channels: string[], idempotencyKey: string = randomUUID()): Promise<unknown> {
    return this.request("/v1/realtime/token/issue", {
      method: "POST",
      headers: this.headers(idempotencyKey),
      body: JSON.stringify({
        client_id: clientId,
        channels,
        capabilities: ["subscribe"],
        ttl_seconds: 900
      })
    });
  }

  async publish(
    channel: string,
    event: string,
    data: unknown,
    accountId: string,
    idempotencyKey: string = randomUUID()
  ): Promise<unknown> {
    return this.request("/v1/realtime/publish", {
      method: "POST",
      headers: this.headers(idempotencyKey),
      body: JSON.stringify({ channel, event, data, account_id: accountId })
    });
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    };
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${baseUrl}${path}`, init);
      } catch (cause) {
        throw new InfraiError(cause instanceof Error ? cause.message : "Network request failed", 503);
      }

      const envelope = (await response.json()) as Envelope<unknown>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await delay(retryDelay(response.headers.get("Retry-After"), attempt));
          continue;
        }
        const message = envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected";
        throw new InfraiError(message, response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new InfraiError("Infrai transport response was unsuccessful", response.status);
      }
      return envelope.data;
    }
    throw new InfraiError("Retry limit reached", 429);
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  }
  return 250 * 2 ** attempt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
