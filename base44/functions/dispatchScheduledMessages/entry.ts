import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  ScheduledRecord,
  claimScheduledMessage,
  selectFairDueCandidates,
} from '../../shared/scheduledMessages.ts';
import {
  deliverClaimedScheduledMessage,
  reconcileClaimedScheduledDelivery,
  repairScheduledMessagePreview,
  releaseClaimForRetry,
} from '../../shared/scheduledDelivery.ts';

const DISPATCH_BATCH_SIZE = 25;
const DUE_CANDIDATE_LIMIT = 125;

export default async function(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const entities = base44.asServiceRole.entities;
  const now = new Date();
  const nowIso = now.toISOString();
  const dueCandidates: ScheduledRecord[] = await entities.ScheduledMessage.filter(
    {
      $or: [
        { status: 'scheduled', dispatch_after: { $lte: nowIso } },
        { status: 'processing', claim_expires_at: { $lte: nowIso } },
      ],
    },
    'dispatch_after',
    DUE_CANDIDATE_LIMIT,
  );
  const candidates = selectFairDueCandidates(dueCandidates, DISPATCH_BATCH_SIZE, 5);

  const results = [];
  for (const candidate of candidates) {
    const claimToken = crypto.randomUUID();
    let claimed = null;
    try {
      const claimNow = new Date();
      claimed = await claimScheduledMessage(
        entities.ScheduledMessage,
        candidate,
        claimNow,
        claimToken,
      );
      if (!claimed) {
        results.push({ id: candidate.id, outcome: 'claim_lost' });
        continue;
      }
      results.push(await deliverClaimedScheduledMessage({
        dependencies: {
          entities,
          integrations: base44.asServiceRole.integrations,
        },
        record: claimed,
        claimToken,
        now: claimNow,
      }));
    } catch (error) {
      console.error('Scheduled message dispatch failed', {
        scheduled_message_id: candidate.id,
        error: error instanceof Error ? error.message : 'Unknown dispatch error',
      });
      if (claimed) {
        let reconciliationConfirmedAbsent = false;
        let reconciled = null;
        try {
          reconciled = await reconcileClaimedScheduledDelivery({
            entities,
            record: claimed,
            claimToken,
            now: new Date(),
          });
          reconciliationConfirmedAbsent = reconciled === null;
        } catch (reconciliationError) {
          console.error('Scheduled delivery reconciliation failed', {
            scheduled_message_id: candidate.id,
            error: reconciliationError instanceof Error
              ? reconciliationError.message
              : 'Unknown reconciliation error',
          });
        }
        if (reconciled) {
          results.push(reconciled);
        } else {
          results.push(await releaseClaimForRetry({
            entity: entities.ScheduledMessage,
            record: claimed,
            claimToken,
            now: new Date(),
            allowExhaustion: reconciliationConfirmedAbsent,
          }));
        }
      } else {
        results.push({ id: candidate.id, outcome: 'claim_error' });
      }
    }
  }

  const pendingPreviews = await entities.ScheduledMessage.filter(
    { status: 'sent', preview_pending: true },
    'sent_at',
    DISPATCH_BATCH_SIZE,
  );
  let previewRepaired = 0;
  for (const record of pendingPreviews) {
    try {
      if (await repairScheduledMessagePreview(entities, record)) previewRepaired += 1;
    } catch (error) {
      console.error('Scheduled message preview repair failed', {
        scheduled_message_id: record.id,
        error: error instanceof Error ? error.message : 'Unknown preview repair error',
      });
    }
  }

  return Response.json({
    processed: results.length,
    sent: results.filter((result) => result.outcome === 'sent').length,
    failed: results.filter((result) => result.outcome === 'failed').length,
    retrying: results.filter((result) => result.outcome === 'retrying').length,
    claim_lost: results.filter((result) => result.outcome === 'claim_lost').length,
    preview_repaired: previewRepaired,
  });
}
