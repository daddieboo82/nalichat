// A Studio owner can continue their cloud-saved session on a different device
// with the same signed-in NaliChat account. Never create a share/invite token
// or imply that copying a link makes a private project publicly accessible.
export function studioDesktopHandoffUrl(projectId, origin = 'https://nalichat.org') {
  if (typeof projectId !== 'string' || !/^[a-z0-9_-]{8,90}$/i.test(projectId)) {
    throw new Error('Save the Studio project before creating a desktop link.');
  }
  const parsed = new URL(origin);
  if (parsed.protocol !== 'https:') throw new Error('Studio handoff requires a secure link.');
  return `${parsed.origin}/studio?room=${encodeURIComponent(projectId)}`;
}
