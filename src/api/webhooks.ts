// ── Outbound Webhook Dispatcher ───────────────────────────────────────────────
// Fire-and-forget: errors are logged but never thrown so that primary API
// calls always succeed even if the webhook destination is unreachable.

export type WebhookEventName =
  | 'client.created'
  | 'client.updated'
  | 'psi.completed'
  | 'uptime.alert'
  | 'report.viewed'
  | 'report.emailed';

export interface WebhookPayload {
  event: WebhookEventName;
  timestamp: string;
  data: Record<string, any>;
}

export async function fireWebhook(
  url: string,
  secret: string,
  enabledEventsJson: string,
  event: WebhookEventName,
  data: Record<string, any>
): Promise<void> {
  // Parse enabled events; on error allow all events through
  let enabledEvents: WebhookEventName[] = [];
  try {
    enabledEvents = JSON.parse(enabledEventsJson);
  } catch {
    enabledEvents = ['client.created', 'client.updated', 'psi.completed', 'uptime.alert', 'report.viewed'];
  }

  if (!enabledEvents.includes(event)) return;
  if (!url) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Fire and forget — do not await, do not throw
  setImmediate(async () => {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secret || '',
        },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.warn(`[webhook] Failed to deliver "${event}" to ${url}: ${err.message}`);
    }
  });
}
