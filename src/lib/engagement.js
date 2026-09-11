export function getLikeCount(post) {
  if (Array.isArray(post?.liked_by)) return post.liked_by.length;
  return Math.max(0, Number(post?.likes || 0));
}
