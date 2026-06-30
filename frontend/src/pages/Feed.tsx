/** Feed principal: pessoas por compatibilidade (match) e publicações da comunidade. */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCard } from '../components/UserCard';
import { PostCard } from '../components/PostCard';
import { PostComposer } from '../components/PostComposer';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { SkeletonCards } from '../components/ui/SkeletonCards';
import { api } from '../services/api';

type FeedMode = 'all' | 'matches' | 'posts';

// Persiste o segmento escolhido entre navegações (paridade com a SPA antiga)
let lastMode: FeedMode = 'all';

export function Feed() {
  const [mode, setMode] = useState<FeedMode>(lastMode);

  // Feed de pessoas (match)
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Feed de publicações
  const [posts, setPosts] = useState<any[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(false);

  const load = useCallback(async (m: FeedMode, p: number, append: boolean) => {
    if (!append) setLoading(true);
    setError(false);
    try {
      const data = await api.get(
        `/feed?limit=30&page=${p}${m === 'matches' ? '&onlyMatches=true' : ''}`,
      );
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setHasMore(Boolean(data.hasMore));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPosts = useCallback(async (p: number, append: boolean) => {
    if (!append) setPostsLoading(true);
    setPostsError(false);
    try {
      const data = await api.get(`/posts?limit=10&page=${p}`);
      setPosts((prev) => (append ? [...prev, ...data.items] : data.items));
      setPostsHasMore(Boolean(data.hasMore));
    } catch {
      setPostsError(true);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    lastMode = mode;
    if (mode === 'posts') {
      setPostsPage(1);
      loadPosts(1, false);
    } else {
      setPage(1);
      load(mode, 1, false);
    }
  }, [mode, load, loadPosts]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(mode, next, true);
  };

  const loadMorePosts = () => {
    const next = postsPage + 1;
    setPostsPage(next);
    loadPosts(next, true);
  };

  const onPostCreated = (post: any) => setPosts((prev) => [post, ...prev]);
  const onPostDeleted = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id));

  return (
    <>
      <h1 className="page-title">Para você</h1>
      <p className="page-subtitle">Pessoas compatíveis e novidades da comunidade</p>
      <div className="chips mb-16">
        <Link className="chip" to="/trends">
          <Icon name="fire" /> Tendências
        </Link>
        <Link className="chip" to="/ranking">
          <Icon name="trophy" /> Ranking
        </Link>
      </div>
      <div className="segmented" id="feed-seg">
        <button
          data-mode="all"
          className={mode === 'all' ? 'active' : ''}
          onClick={() => setMode('all')}
        >
          Todos
        </button>
        <button
          data-mode="matches"
          className={mode === 'matches' ? 'active' : ''}
          onClick={() => setMode('matches')}
        >
          Melhores matches
        </button>
        <button
          data-mode="posts"
          className={mode === 'posts' ? 'active' : ''}
          onClick={() => setMode('posts')}
        >
          Publicações
        </button>
      </div>

      {mode === 'posts' ? (
        <div id="posts-list">
          <PostComposer onCreated={onPostCreated} />
          {postsLoading && posts.length === 0 ? (
            <SkeletonCards count={3} />
          ) : postsError ? (
            <EmptyState
              icon="exclamation-triangle"
              title="Erro ao carregar as publicações"
              subtitle="Tente novamente mais tarde."
            />
          ) : posts.length === 0 ? (
            <EmptyState
              icon="card-text"
              title="Nenhuma publicação ainda"
              subtitle="Seja o primeiro a compartilhar algo com a comunidade."
            />
          ) : (
            <>
              {posts.map((p) => (
                <PostCard key={p.id} post={p} onDeleted={onPostDeleted} />
              ))}
              {postsHasMore && (
                <button
                  className="btn btn--secondary btn--block"
                  onClick={loadMorePosts}
                  disabled={postsLoading}
                >
                  {postsLoading ? 'Carregando...' : 'Carregar mais'}
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div id="feed-list">
          {loading ? (
            <SkeletonCards count={3} />
          ) : error ? (
            <EmptyState
              icon="exclamation-triangle"
              title="Erro ao carregar o feed"
              subtitle="Tente novamente mais tarde."
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="puzzle"
              title="Nenhuma recomendação ainda"
              subtitle="Adicione habilidades ao seu perfil para melhorar os matches."
            />
          ) : (
            <>
              {items.map((u) => (
                <UserCard key={u.id} user={u} />
              ))}
              {hasMore && (
                <button className="btn btn--secondary btn--block" id="feed-more" onClick={loadMore}>
                  Carregar mais
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
