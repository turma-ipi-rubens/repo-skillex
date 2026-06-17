/**
 * Sala de vídeo chamada embutida (Jitsi self-hosted).
 *
 * Usa o `JitsiMeetExternalAPI` global direto (sem o wrapper `@jitsi/react-sdk`)
 * por dois motivos práticos:
 *
 *  1. O `init.js` do react-sdk hard-coda `https://${domain}/external_api.js`,
 *     o que quebra com a stack local servindo HTTP em `jitsi.localhost:8000`.
 *  2. O componente `<JitsiMeeting/>` do react-sdk **não** repassa a opção
 *     `noSSL` para o construtor da API — então o iframe interno também tenta
 *     `https://jitsi.localhost` (porta 80 implícita), resultando em
 *     "jitsi.localhost enviou uma resposta inválida".
 *
 * Com a API nativa controlamos os dois pontos: pré-carregamos o script com o
 * protocolo correto e passamos `noSSL: true` para domínios locais.
 *
 * Em produção (domínio público com TLS de verdade) tudo cai automaticamente
 * em HTTPS — sem ramo especial.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { Spinner } from './ui/Spinner';
import { Icon } from './ui/Icon';

type TokenResponse = {
  token: string;
  domain: string;
  room: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

type Props = {
  requestId: string;
  otherUserName?: string;
  onClose: () => void;
};

interface JitsiExternalApi {
  addListener(event: string, handler: () => void): void;
  dispose(): void;
}

type JitsiExternalApiCtor = new (
  domain: string,
  options: Record<string, unknown>,
) => JitsiExternalApi;

function getGlobalJitsi(): JitsiExternalApiCtor | undefined {
  return (window as unknown as { JitsiMeetExternalAPI?: JitsiExternalApiCtor })
    .JitsiMeetExternalAPI;
}

function isLocalDomain(domain: string): boolean {
  const host = domain.split(':')[0];
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.')
  );
}

function loadJitsiScript(domain: string): Promise<void> {
  if (getGlobalJitsi()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const protocol = isLocalDomain(domain) ? 'http' : 'https';
    const script = document.createElement('script');
    script.async = true;
    script.src = `${protocol}://${domain}/external_api.js`;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Falha ao carregar Jitsi (${protocol}://${domain})`));
    document.head.appendChild(script);
  });
}

export function VideoCall({ requestId, otherUserName, onClose }: Props) {
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiInstanceRef = useRef<JitsiExternalApi | null>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: JitsiExternalApi | null = null;

    (async () => {
      try {
        const data: TokenResponse = await api.get(`/requests/${requestId}/video-token`);
        if (cancelled) return;

        await loadJitsiScript(data.domain);
        if (cancelled) return;

        const JitsiCtor = getGlobalJitsi();
        if (!JitsiCtor) throw new Error('Jitsi não pôde ser inicializado');
        if (!containerRef.current) return;

        instance = new JitsiCtor(data.domain, {
          roomName: data.room,
          jwt: data.token,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          // Força HTTP para a stack local (jitsi.localhost:8000). Em produção
          // com domínio público, deixamos HTTPS — comportamento padrão.
          noSSL: isLocalDomain(data.domain),
          userInfo: { displayName: data.displayName, email: data.email },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableWelcomePage: false,
            enableClosePage: false,
            disableProfile: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_POWERED_BY: false,
            DEFAULT_BACKGROUND: '#0b0b0f',
            MOBILE_APP_PROMO: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            TOOLBAR_BUTTONS: [
              'microphone',
              'camera',
              'desktop',
              'fullscreen',
              'fodeviceselection',
              'hangup',
              'chat',
              'settings',
              'raisehand',
              'videoquality',
              'filmstrip',
              'tileview',
            ],
          },
        });

        instance.addListener('readyToClose', onClose);
        apiInstanceRef.current = instance;
        setReady(true);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Não foi possível abrir a sala';
        toast(message, 'error');
        onClose();
      }
    })();

    return () => {
      cancelled = true;
      if (instance) {
        try {
          instance.dispose();
        } catch {
          /* ignora — instância pode já ter sido derrubada pelo readyToClose */
        }
      }
      apiInstanceRef.current = null;
    };
  }, [requestId, onClose, toast]);

  return (
    <div className="video-modal" role="dialog" aria-label="Vídeo chamada">
      <div className="video-modal__header">
        <span>
          <Icon name="camera-video" /> Sala da troca
          {otherUserName ? ` · ${otherUserName}` : ''}
        </span>
        <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Encerrar">
          <Icon name="x-lg" /> Sair
        </button>
      </div>
      <div className="video-modal__body">
        {!ready && (
          <div className="video-modal__loading">
            <Spinner />
            <span>Preparando a sala…</span>
          </div>
        )}
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%', display: ready ? 'block' : 'none' }}
        />
      </div>
    </div>
  );
}
