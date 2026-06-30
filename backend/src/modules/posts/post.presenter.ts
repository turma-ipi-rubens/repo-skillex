/**
 * Camada de apresentação (DTO) das publicações: converte modelos do Prisma em
 * objetos seguros para a API, já com contagens e o estado de curtida do viewer.
 */

function presentAuthor(author: any) {
  if (!author) return null;
  return {
    id: author.id,
    name: author.name,
    avatarUrl: author.avatarUrl ?? null,
  };
}

export function presentPost(post: any, viewerId: string) {
  return {
    id: post.id,
    content: post.content,
    imageUrl: post.imageUrl ?? null,
    createdAt: post.createdAt,
    author: presentAuthor(post.author),
    likeCount: post._count?.likes ?? 0,
    commentCount: post._count?.comments ?? 0,
    // `likes` vem filtrado pelo viewer no include (length 0 ou 1).
    likedByMe: Array.isArray(post.likes) ? post.likes.length > 0 : false,
    isOwn: post.authorId === viewerId,
  };
}

export function presentComment(comment: any, viewerId: string) {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: presentAuthor(comment.author),
    isOwn: comment.authorId === viewerId,
  };
}
