import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fileUri } = body;
    if (!fileUri || typeof fileUri !== 'string') {
      return Response.json({ error: 'Missing fileUri' }, { status: 400 });
    }

    // Security: this endpoint signs an arbitrary storage URI, so it must not
    // hand out a download for a file the caller didn't pay for. Require a
    // paid Base44Purchase, owned by this user, whose studio_export item was
    // bound to this exact fileUri at checkout time (see createCheckout).
    const purchases = await base44.asServiceRole.entities.Base44Purchase.filter({
      user_id: user.id,
      status: 'paid',
    });
    const owns = purchases.some((p) =>
      Array.isArray(p.items) &&
      p.items.some((it) => it?.type === 'studio_export' && it?.fileUri === fileUri)
    );
    if (!owns) {
      return Response.json({ error: 'Forbidden: no paid export found for this file' }, { status: 403 });
    }

    const signedRes = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 3600,
    });

    return Response.json({ signed_url: signedRes.signed_url });
  } catch (error) {
    console.error('get-studio-export-url error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}