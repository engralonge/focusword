import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Push delivery is not configured' }, 503);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let requestedDeliveryId: string | null = null;
  try {
    const body = await request.json() as { deliveryId?: string };
    requestedDeliveryId = body.deliveryId?.trim() || null;
  } catch {
    // An empty body means flush the oldest pending deliveries.
  }

  let query = admin
    .from('notification_deliveries')
    .select(
      'id, activity_event_id, user_id, status, attempt_count, activity_events(title, body, url, kind)',
    )
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(requestedDeliveryId ? 1 : 100);
  if (requestedDeliveryId) {
    query = query.eq('id', requestedDeliveryId);
  }
  const { data: deliveries, error: deliveryError } = await query;
  if (deliveryError) return json({ error: deliveryError.message }, 500);

  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries ?? []) {
    const claimed = await admin
      .from('notification_deliveries')
      .update({
        status: 'sending',
        attempt_count: delivery.attempt_count + 1,
        last_error: null,
      })
      .eq('id', delivery.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle();
    if (claimed.error || !claimed.data) continue;

    const { data: tokens, error: tokenError } = await admin
      .from('push_tokens')
      .select('id, expo_push_token')
      .eq('user_id', delivery.user_id)
      .eq('enabled', true);
    if (tokenError || !tokens?.length) {
      await admin
        .from('notification_deliveries')
        .update({
          status: tokenError ? 'failed' : 'skipped',
          last_error: tokenError?.message ?? 'No active push token',
        })
        .eq('id', delivery.id);
      if (tokenError) failed += 1;
      continue;
    }

    const event = Array.isArray(delivery.activity_events)
      ? delivery.activity_events[0]
      : delivery.activity_events;
    const messages = tokens.map((token) => ({
      to: token.expo_push_token,
      sound: 'default',
      title: event?.title ?? 'Citizens Bible Community',
      body: event?.body ?? undefined,
      data: {
        url: event?.url ?? 'focusword://activity',
        activityEventId: delivery.activity_event_id,
      },
      channelId: event?.kind === 'live_reminder' ? 'live-study-reminders' : 'community-updates',
      priority: event?.kind === 'stage_invitation' ? 'high' : 'default',
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const result = await response.json() as {
        data?: Array<{ status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } }>;
        errors?: Array<{ message?: string }>;
      };
      if (!response.ok || result.errors?.length) {
        throw new Error(result.errors?.[0]?.message ?? `Expo push returned ${response.status}`);
      }

      const tickets = result.data ?? [];
      const invalidTokens = tickets.flatMap((ticket, index) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? [tokens[index]?.id]
          : [],
      ).filter(Boolean);
      if (invalidTokens.length) {
        await admin.from('push_tokens').update({ enabled: false }).in('id', invalidTokens);
      }
      const ticketIds = tickets.flatMap((ticket) => ticket.id ? [ticket.id] : []);
      const errorMessages = tickets.flatMap((ticket) =>
        ticket.status === 'error' ? [ticket.message ?? 'Push rejected'] : [],
      );
      await admin
        .from('notification_deliveries')
        .update({
          status: errorMessages.length
            ? ticketIds.length ? 'partial' : 'failed'
            : 'sent',
          provider_ticket_ids: ticketIds,
          last_error: errorMessages.join('; ').slice(0, 1000) || null,
          sent_at: ticketIds.length ? new Date().toISOString() : null,
        })
        .eq('id', delivery.id);
      if (ticketIds.length) sent += 1;
      if (errorMessages.length) failed += 1;
    } catch (error) {
      failed += 1;
      await admin
        .from('notification_deliveries')
        .update({
          status: 'failed',
          last_error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        })
        .eq('id', delivery.id);
    }
  }

  console.info(JSON.stringify({
    event: 'push_delivery_completed',
    processed: deliveries?.length ?? 0,
    sent,
    failed,
  }));
  return json({ processed: deliveries?.length ?? 0, sent, failed });
});
