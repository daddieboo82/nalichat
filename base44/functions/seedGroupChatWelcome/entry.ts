import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const adminRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'admin_seed_group_welcome',
      2,
    );
    if (!adminRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const messages = [
      {
        conversation_id: "6a21429e02d2a36326a787fc",
        sender_id: "nali-system",
        sender_name: "Nali",
        sender_avatar: "https://nalichat.org/settings",
        text: "Welcome to Mixing & Mastering! 🎛️ This is the place to talk chain setups, loudness wars, stem mastering, and everything in between.\n\nTo kick things off: What's your go-to mastering chain? Drop your favorite plugin stack — limiters, EQs, saturators, the works. Let's compare notes.",
        type: "text",
        read_by: [],
        participant_ids: []
      },
      {
        conversation_id: "6a21429e02d2a36326a787fe",
        sender_id: "nali-system",
        sender_name: "Nali",
        sender_avatar: "https://nalichat.org/settings",
        text: "Welcome to Sound Design & Synths! 🎹 Whether you're patching modular, designing bass in Serum, or layering atmospheric pads, this is your room.\n\nConversation starter: What's your synth of choice right now — Serum, Vital, Diva, something else? Share a patch or preset you've been loving lately!",
        type: "text",
        read_by: [],
        participant_ids: []
      },
      {
        conversation_id: "6a21429e02d2a36326a787fd",
        sender_id: "nali-system",
        sender_name: "Nali",
        sender_avatar: "https://nalichat.org/settings",
        text: "Welcome to DAWs & VSTs! 💻 Your hub for workflow tips, plugin recommendations, and DAW comparisons.\n\nLet's get this going: What DAW are you running, and what's one plugin you can't live without? Bonus points if you share why it's essential to your workflow.",
        type: "text",
        read_by: [],
        participant_ids: []
      },
      {
        conversation_id: "6a21429e02d2a36326a787ff",
        sender_id: "nali-system",
        sender_name: "Nali",
        sender_avatar: "https://nalichat.org/settings",
        text: "Welcome to Beatmaking / Boom Bap! 🥁 Vinyl chops, MPC swings, dusty drums — this is where the groove lives.\n\nTo start: What's in your sample crate right now? Share the record or pack you've been chopping, or drop a beat you're proud of for feedback.",
        type: "text",
        read_by: [],
        participant_ids: []
      },
      {
        conversation_id: "6a21429e02d2a36326a78800",
        sender_id: "nali-system",
        sender_name: "Nali",
        sender_avatar: "https://nalichat.org/settings",
        text: "Welcome to EDM Production! ⚡ Big builds, heavy drops, and festival-ready mixes.\n\nLet's hear it: Drop the track you're most proud of this month — finished or work in progress. What genre are you pushing, and what's the biggest challenge you're working through?",
        type: "text",
        read_by: [],
        participant_ids: []
      }
    ];

    const created = await base44.asServiceRole.entities.Message.bulkCreate(messages);

    const conversations = [
      { id: "6a21429e02d2a36326a787fc", last_text: "Welcome to Mixing & Mastering! 🎛️ What's your go-to mastering chain?" },
      { id: "6a21429e02d2a36326a787fe", last_text: "Welcome to Sound Design & Synths! 🎹 What's your synth of choice?" },
      { id: "6a21429e02d2a36326a787fd", last_text: "Welcome to DAWs & VSTs! 💻 What DAW are you running?" },
      { id: "6a21429e02d2a36326a787ff", last_text: "Welcome to Beatmaking / Boom Bap! 🥁 What's in your sample crate?" },
      { id: "6a21429e02d2a36326a78800", last_text: "Welcome to EDM Production! ⚡ Drop your track of the month!" }
    ];

    for (const conv of conversations) {
      await base44.asServiceRole.entities.Conversation.update(conv.id, {
        last_message_text: conv.last_text,
        last_message_at: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      messages_sent: created.length,
      conversations_updated: conversations.length,
      message: `Seeded ${created.length} welcome messages across 5 community chat rooms.`
    });
  } catch (error) {
    console.error('seedGroupChatWelcome error:', error);
    return Response.json({ error: 'Unable to seed group chat welcome messages' }, { status: 500 });
  }
}