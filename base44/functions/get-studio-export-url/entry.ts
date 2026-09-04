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