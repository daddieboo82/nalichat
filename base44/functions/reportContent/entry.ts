import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const reporter = await base44.auth.me();
    if (!reporter) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (reporter.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (reporter.timeout_until && new Date(reporter.timeout_until).getTime() > Date.now()) {
      return Response.json(
        { error: 'timed_out', timeout_until: reporter.timeout_until },
        { status: 403 },
      );
    }

    const { content_type, content_id, reason } = await req.json();
    if (!content_type || !content_id) {
      return Response.json({ error: 'content_type and content_id are required' }, { status: 400 });
    }

    const validReasons = ['spam', 'harassment', 'hate_speech', 'violence', 'sexual_content', 'illegal_activity', 'misinformation', 'other'];
    const reportReason = validReasons.includes(reason) ? reason : 'other';
    const categoryMap: Record<string, string> = {
      spam: 'bullying',
      harassment: 'bullying',
      hate_speech: 'racism',
      violence: 'violence',
      sexual_content: 'sexual_violence',
      illegal_activity: 'illegal_activity',
      misinformation: 'bullying',
      other: 'bullying',
    };

    const entities = base44.asServiceRole.entities;
    const rate = await consumeHourlyLimit(entities, reporter.id, 'content_report', 30);
    if (!rate.allowed) {
      return Response.json({ error: 'Report rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    let reportedUserId = '';
    let reportedUserName = '';
    let authoritativeText = '';
    let authoritativeConversationId = null;

    if (content_type === 'message') {
      const message = await entities.Message.get(content_id);
      if (!message) return Response.json({ error: 'Content not found' }, { status: 404 });

      // A reporter must actually be a participant in the conversation.
      if (!Array.isArray(message.participant_ids) || !message.participant_ids.includes(reporter.id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      reportedUserId = message.sender_id || '';
      reportedUserName = message.sender_name || '';
      authoritativeText = message.text || message.file_name || '';
      authoritativeConversationId = message.conversation_id || null;
    } else if (content_type === 'art_post') {
      const post = await entities.ArtPost.get(content_id);
      if (!post) return Response.json({ error: 'Content not found' }, { status: 404 });
      reportedUserId = post.creator_id || '';
      reportedUserName = post.creator_name || '';
      authoritativeText = post.title || post.description || '';
    } else {
      return Response.json({ error: 'Unsupported content_type' }, { status: 400 });
    }

    if (!reportedUserId) {
      return Response.json({ error: 'Reported content has no owner' }, { status: 400 });
    }
    if (reportedUserId === reporter.id) {
      return Response.json({ error: 'You cannot report your own content' }, { status: 400 });
    }

    // Avoid duplicate reports from the same user for the same content while one
    // is still pending review.
    const existing = await entities.Violation.filter({
      reported_by_id: reporter.id,
      content_type,
      content_id,
      review_status: 'pending',
    });
    if (existing.length > 0) {
      return Response.json({ success: true, duplicate: true });
    }

    await entities.Violation.create({
      user_id: reportedUserId,
      user_name: reportedUserName || 'Unknown user',
      reported_by_id: reporter.id,
      reported_by_name: reporter.display_name || reporter.full_name || 'Reporter',
      content_type,
      content_id,
      category: categoryMap[reportReason] || 'bullying',
      severity: 'low',
      content: `[USER REPORT — ${reportReason}]\nContent type: ${content_type}\nContent ID: ${content_id}\n\n${authoritativeText.slice(0, 800)}`,
      conversation_id: authoritativeConversationId,
      message_id: content_type === 'message' ? content_id : null,
      action_taken: 'warning',
      review_status: 'pending',
      explanation: `Reported by user for: ${reportReason}. Awaiting admin review.`,
    });

    return Response.json({ success: true, message: 'Content reported. Thank you.' });
  } catch (error) {
    console.error('reportContent error:', error);
    return Response.json({ error: error?.message || 'Report failed' }, { status: 500 });
  }
});
