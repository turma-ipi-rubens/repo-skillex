/** Caixa de criação de publicações (texto + imagem opcional). */
import { useState } from 'react';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { validateImageFile } from '../utils/files';

export function PostComposer({ onCreated }: { onCreated: (post: any) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const invalid = validateImageFile(f, 5);
    if (invalid) {
      toast(invalid, 'error');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = content.trim();
    if (!text) {
      toast('Escreva algo na publicação', 'error');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('content', text);
      if (file) fd.append('image', file);
      const res = await api.upload('/posts', fd);
      onCreated(res.post);
      setContent('');
      clearImage();
      toast('Publicado!', 'success');
    } catch {
      toast('Erro ao publicar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card post-composer" onSubmit={submit}>
      <div className="post-composer__head">
        <Avatar user={user} size="sm" />
        <textarea
          className="textarea"
          placeholder="Compartilhe algo com a comunidade..."
          maxLength={1000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {preview && (
        <div className="post-composer__preview">
          <img src={preview} alt="Pré-visualização" />
          <button
            type="button"
            className="post-composer__preview-remove"
            onClick={clearImage}
            aria-label="Remover imagem"
          >
            <Icon name="x-lg" />
          </button>
        </div>
      )}

      <div className="post-composer__actions">
        <label className="btn btn--ghost btn--sm">
          <Icon name="image" /> Imagem
          <input type="file" accept="image/*" hidden onChange={onPickImage} />
        </label>
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving || !content.trim()}>
          {saving ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </form>
  );
}
