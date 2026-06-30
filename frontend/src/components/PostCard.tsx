/** Card de uma publicação: conteúdo, imagem, curtidas e comentários. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { timeAgo } from '../utils/format';

export function PostCard({
  post,
  onDeleted,
}: {
  post: any;
  onDeleted?: (id: string) => void;
}) {
  const { toast, confirm } = useToast();
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likeCount, setLikeCount] = useState<number>(post.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState<number>(post.commentCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const author = post.author || {};

  const toggleLike = async () => {
    const next = !liked;
    // Atualização otimista.
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      const res = next
        ? await api.post(`/posts/${post.id}/like`)
        : await api.del(`/posts/${post.id}/like`);
      if (typeof res?.likeCount === 'number') setLikeCount(res.likeCount);
    } catch {
      // Reverte em caso de erro.
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      toast('Erro ao curtir', 'error');
    }
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments === null) {
      setLoadingComments(true);
      try {
        const res = await api.get(`/posts/${post.id}/comments`);
        setComments(res.items);
        setCommentCount(res.items.length);
      } catch {
        toast('Erro ao carregar comentários', 'error');
        setComments([]);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const submitComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await api.post(`/posts/${post.id}/comments`, { content: text });
      setComments((prev) => [...(prev ?? []), res.comment]);
      setCommentCount((c) => c + 1);
      setCommentText('');
    } catch {
      toast('Erro ao comentar', 'error');
    } finally {
      setSending(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!(await confirm('Excluir este comentário?', 'Excluir'))) return;
    try {
      await api.del(`/posts/${post.id}/comments/${id}`);
      setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
      setCommentCount((c) => Math.max(0, c - 1));
    } catch {
      toast('Erro ao excluir comentário', 'error');
    }
  };

  const deletePost = async () => {
    if (!(await confirm('Excluir esta publicação?', 'Excluir'))) return;
    try {
      await api.del(`/posts/${post.id}`);
      onDeleted?.(post.id);
      toast('Publicação excluída', 'success');
    } catch {
      toast('Erro ao excluir publicação', 'error');
    }
  };

  return (
    <div className="card post-card">
      <div className="post-card__head">
        <Link to={`/profile/${author.id}`} className="post-card__author">
          <Avatar user={author} size="sm" />
          <div>
            <strong>{author.name}</strong>
            <div className="muted post-card__time">{timeAgo(post.createdAt)}</div>
          </div>
        </Link>
        {post.isOwn && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={deletePost}
            title="Excluir publicação"
            aria-label="Excluir publicação"
          >
            <Icon name="trash" />
          </button>
        )}
      </div>

      {post.content && <p className="post-card__content">{post.content}</p>}
      {post.imageUrl && (
        <img className="post-card__image" src={post.imageUrl} alt="Imagem da publicação" loading="lazy" />
      )}

      <div className="post-card__actions">
        <button
          className={`post-card__action${liked ? ' liked' : ''}`}
          onClick={toggleLike}
          aria-pressed={liked}
        >
          <Icon name={liked ? 'heart-fill' : 'heart'} /> Curtir
          {likeCount > 0 ? ` · ${likeCount}` : ''}
        </button>
        <button className="post-card__action" onClick={toggleComments}>
          <Icon name="chat" /> Comentar
          {commentCount > 0 ? ` · ${commentCount}` : ''}
        </button>
      </div>

      {showComments && (
        <div className="post-card__comments">
          {loadingComments ? (
            <p className="muted" style={{ fontSize: '.85rem' }}>
              Carregando comentários...
            </p>
          ) : (
            (comments ?? []).map((c) => (
              <div className="post-comment" key={c.id}>
                <Avatar user={c.author} size="sm" />
                <div className="post-comment__body">
                  <div className="post-comment__meta">
                    <Link to={`/profile/${c.author?.id}`}>
                      <strong>{c.author?.name}</strong>
                    </Link>
                    <span className="muted"> · {timeAgo(c.createdAt)}</span>
                  </div>
                  <p>{c.content}</p>
                </div>
                {c.isOwn && (
                  <button
                    className="post-comment__del"
                    onClick={() => deleteComment(c.id)}
                    aria-label="Excluir comentário"
                  >
                    <Icon name="x" />
                  </button>
                )}
              </div>
            ))
          )}
          {!loadingComments && (comments ?? []).length === 0 && (
            <p className="muted" style={{ fontSize: '.85rem' }}>
              Seja o primeiro a comentar.
            </p>
          )}
          <form className="post-card__comment-form" onSubmit={submitComment}>
            <input
              className="input"
              placeholder="Escreva um comentário..."
              maxLength={500}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button
              className="btn btn--primary btn--sm"
              type="submit"
              disabled={sending || !commentText.trim()}
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
