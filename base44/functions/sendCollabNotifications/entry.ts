import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const notifications = [
      {
        recipient_id: "6a44e36c545dbf7110696284",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "Hey! Your project 'Chatting with lonely foreigner' is live on NaliChat 🎵 Want to take it further? Invite collaborators to your studio room, share your tracks, and get real-time feedback from other producers. The community rooms — Mixing & Mastering, Sound Design & Synths, EDM Production — are open and waiting for you.",
        read: false
      },
      {
        recipient_id: "6a472597a30a0a9e0f4ccf61",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "Hey! Your project 'Test track' is live on NaliChat 🎵 Ready to level up? Invite collaborators to your studio room, share your tracks, and mix together in real time. Join the community rooms — Mixing & Mastering, Beatmaking / Boom Bap, EDM Production — to connect with other producers.",
        read: false
      },
      {
        recipient_id: "6a231f1c02c4dd9f5d5500bc",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've been active on NaliChat — love to see it! Ready to take it up a notch? Open a studio room, invite a collaborator, and start sharing tracks in real time. The community rooms (Mixing & Mastering, EDM Production, Sound Design & Synths) are open — come drop in and connect with other producers.",
        read: false
      },
      {
        recipient_id: "6a2182ee479c0badf1c5905e",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've been connecting on NaliChat — awesome! Want to collaborate on something new? Open a studio room, share your tracks, and invite others to mix with you. The community rooms (Mixing & Mastering, Beatmaking, EDM Production) are ready for you to jump in.",
        read: false
      },
      {
        recipient_id: "6a230c6040ed55e31f71c438",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "NaliChat's studio rooms are open and ready for you! Create a project, upload your tracks, and invite collaborators to mix together in real time. Join the community rooms — Mixing & Mastering, Sound Design & Synths, EDM Production — to connect with other producers and share your sound.",
        read: false
      },
      {
        recipient_id: "6a2320b9baa9766659e9ec2b",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "NaliChat's studio rooms are open and ready for you! Create a project, upload your tracks, and invite collaborators to mix together in real time. Join the community rooms — Mixing & Mastering, Sound Design & Synths, EDM Production — to connect with other producers and share your sound.",
        read: false
      },
      {
        recipient_id: "6a23174f0c19b2f35fe031a4",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "NaliChat's studio rooms are open and ready for you! Create a project, upload your tracks, and invite collaborators to mix together in real time. Join the community rooms — Mixing & Mastering, Sound Design & Synths, EDM Production — to connect with other producers and share your sound.",
        read: false
      },
      {
        recipient_id: "6a919cd65dfaee68a2e484de",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "As a Pro member, you've got the full studio at your fingertips! Create a project, upload your tracks, and invite collaborators to mix together in real time. The community rooms — Mixing & Mastering, Sound Design & Synths, EDM Production — are open and waiting for you.",
        read: false
      },
      {
        recipient_id: "6a2a966db4147ce9e9fc40d7",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a4d3d950d947ebc9bcff434",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a92d191f33a97d5e9addf02",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a45231557aa21c61ad48e5b",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a92d12e70908d9be5115fc0",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a38ea9a97e3e6f00cd7aead",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a4368713edd80d36b9613a6",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a2e0ba444d44654961d9cd3",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a32777e68f07d0efb892354",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a2edf65268c68d74c1f5a43",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a26dcf34edfaf5e1d660586",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      },
      {
        recipient_id: "6a2e0b28cadf6cb13e73bb35",
        type: "comment",
        actor_id: "nali-system",
        actor_name: "Nali",
        message: "You've got tracks waiting for you on NaliChat! Come back to the studio to listen, collaborate, and share your own work. The community rooms are open — jump into Mixing & Mastering, Sound Design & Synths, or EDM Production to connect with other creators.",
        read: false
      }
    ];

    const created = await base44.asServiceRole.entities.Notification.bulkCreate(notifications);

    return Response.json({
      success: true,
      sent: created.length,
      message: `Sent ${created.length} collaboration encouragement notifications to active users.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}