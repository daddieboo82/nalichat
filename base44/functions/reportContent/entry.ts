import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Allows a user to report inappropriate user-generated content (messages,
 * art posts, challenge submissions, etc.) to the developer for review.
 *
 * Required by Microsoft Store Policy 11.12 (User Generated Content) and
 * 11.16 (Live Generative AI Content): users must have a means to report
 * inappropriate content within the product.
 *
 * Creates a Violation record with the reported content and the reporter's
 * reason. Admins can review violations in the Admin Dashboard.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content_type, content_id, content_text, reason, conversation_id } = await req.json();

    if (!content_type || !content_id) {
      return Response.json({ error: 'content_type and content_id are required' }, { status: 400 });
    }

    const validReasons = ['spam', 'harassment', 'hate_speech', 'violence', 'sexual_content', 'illegal_activity', 'misinformation', 'other'];
    const reportReason = validReasons.includes(reason) ? reason : 'other';

    // Create a Violation record for admin review.
    // The category field maps to the Violation entity's enum; "bullying" is used
    // as a general "reported by user" bucket since the enum is fixed.
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

    await base44.asServiceRole.entities.Violation.create({
      user_id: user.id,
      user_name: user.display_name || user.full_name,
      category: categoryMap[reportReason] || 'bullying',
      severity: 'low',
      content: `[USER REPORT — ${reportReason}]\nContent type: ${content_type}\nContent ID: ${content_id}\n\n${(content_text || '').slice(0, 800)}`,
      conversation_id: conversation_id || null,
      message_id: content_type === 'message' ? content_id : null,
      action_taken: 'warning',
      explanation: `Reported by user for: ${reportReason}. Awaiting admin review.`,
    });

    return Response.json({ success: true, message: 'Content reported. Thank you.' });
  } catch (error) {
    console.error('reportContent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});