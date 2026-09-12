export async function existingMediaUrlAccessAllowed(
  entities: any,
  user: any,
  mediaUrl: string,
): Promise<boolean> {
  if (!mediaUrl) return false;
  if (user?.role === 'admin') return true;

  const [filePosts, imagePosts, sharedFiles] = await Promise.all([
    entities.ArtPost.filter({ file_url: mediaUrl }, '-created_date', 20),
    entities.ArtPost.filter({ image_url: mediaUrl }, '-created_date', 20),
    entities.SharedFile.filter({ file_url: mediaUrl }, '-created_date', 20),
  ]);

  for (const post of [...filePosts, ...imagePosts]) {
    if (post?.creator_id && post.creator_id !== user?.id) return false;
  }

  for (const file of sharedFiles) {
    const allowed = file?.uploader_id === user?.id
      || (file?.access_user_ids || []).includes(user?.id)
      || (file?.edit_user_ids || []).includes(user?.id);
    if (!allowed) return false;
  }

  return true;
}
