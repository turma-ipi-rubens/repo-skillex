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
  /** Quando true, a chamada compartilha o viewport com outra view (ex.: quadro). */
  split?: boolean;
};

interface JitsiExternalApi {
  addListener(event: string, handler: () => void): void;
  executeCommand(command: string, ...args: unknown[]): void;
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

function loadScriptOnce(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => {
      // Remove a tag falhada antes de retentar para não poluir o DOM com
      // múltiplos `<script>` em estado de erro.
      script.remove();
      reject(new Error(`script onerror (${src})`));
    };
    document.head.appendChild(script);
  });
}

// Jitsi-web pode levar alguns segundos para responder logo depois do
// `docker compose up`. O `script.onerror` dispara imediato nessa janela
// transitória — então tentamos algumas vezes com backoff antes de desistir.
async function loadJitsiScript(domain: string, attempts = 4): Promise<void> {
  if (getGlobalJitsi()) return;
  const protocol = isLocalDomain(domain) ? 'http' : 'https';
  const src = `${protocol}://${domain}/external_api.js`;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await loadScriptOnce(src);
      if (getGlobalJitsi()) return;
      lastErr = new Error('Script carregou mas API global não foi exposta');
    } catch (err) {
      lastErr = err;
    }
    // Backoff: 0.5s · 1.5s · 3s entre tentativas
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * (i + 1) * (i + 1)));
    }
  }
  throw new Error(
    `Falha ao carregar Jitsi (${src}) após ${attempts} tentativas. ` +
      `Verifique se a stack Jitsi está rodando (docker compose ps). ` +
      (lastErr instanceof Error ? `Detalhe: ${lastErr.message}` : ''),
  );
}

export function VideoCall({ requestId, otherUserName, onClose, split = false }: Props) {
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiInstanceRef = useRef<JitsiExternalApi | null>(null);
  // Marca quando a sala já foi deixada — seja pelo botão do Jitsi, seja pelo
  // executeCommand('hangup') do botão do cabeçalho. O cleanup usa esta flag
  // para não pedir hangup de novo e descartar o iframe imediatamente.
  const leftRef = useRef(false);

  // Estabilizamos onClose/toast via ref para que o efeito só rode quando o
  // requestId mudar. Sem isso, qualquer re-render do pai (ex.: abrir/fechar
  // o quadro colaborativo) recriava a função inline `onClose`, fazendo o
  // efeito disparar dispose + nova instância — e o Jitsi não desconecta de
  // imediato, deixando o participante "fantasma" na sala.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const toastRef = useRef(toast);
  toastRef.current = toast;

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

        // Patch defensivo: o `external_api.js` do `jitsi/web:stable-9779`
        // ignora a opção `noSSL` e sempre monta o iframe com `https://`,
        // mesmo quando passamos `noSSL: true`. Como a stack local serve
        // HTTP em `jitsi.localhost:8000`, isso causa
        // "jitsi.localhost enviou uma resposta inválida" (handshake TLS num
        // servidor texto-plano). O `_createIFrame` roda síncrono dentro do
        // construtor, então o iframe já está no DOM aqui — reescrevemos o
        // `src` antes que ele termine de navegar para a URL errada.
        if (isLocalDomain(data.domain) && containerRef.current) {
          const patchIframe = () => {
            const iframe = containerRef.current?.querySelector('iframe');
            if (!iframe) return false;
            if (iframe.src.startsWith('https://')) {
              const newSrc = iframe.src.replace(/^https:\/\//, 'http://');
              // eslint-disable-next-line no-console
              console.info('[VideoCall] Reescrevendo iframe src:', iframe.src, '→', newSrc);
              iframe.src = newSrc;
            }
            return true;
          };
          // Tenta imediato; se ainda não criado, observa o container até aparecer.
          if (!patchIframe()) {
            const observer = new MutationObserver(() => {
              if (patchIframe()) observer.disconnect();
            });
            observer.observe(containerRef.current, { childList: true, subtree: true });
            // Stop após 5s para não vazar
            setTimeout(() => observer.disconnect(), 5000);
          }
        }

        // Dois eventos fecham o modal:
        //  - `videoConferenceLeft`: dispara assim que o usuário sai da sala
        //    (hangup nativo do Jitsi). Sem isso, o iframe navega para a
        //    welcome page do servidor e o nosso modal fica preso.
        //  - `readyToClose`: dispara quando o Jitsi termina a transição
        //    pós-hangup. Cobre o caso em que algum config do servidor
        //    força close page antes do leave.
        // Marcamos `leftRef` para o cleanup saber que a sala já foi deixada
        // (não precisa de outro hangup) e o botão do cabeçalho não precisa
        // esperar o fallback de fechamento.
        const handleLeft = () => {
          leftRef.current = true;
          onCloseRef.current();
        };
        instance.addListener('videoConferenceLeft', handleLeft);
        instance.addListener('readyToClose', handleLeft);
        apiInstanceRef.current = instance;
        setReady(true);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Não foi possível abrir a sala';
        toastRef.current(message, 'error');
        onCloseRef.current();
      }
    })();

    // Refresh/fechar aba: sem isso, o iframe é destruído sem que o servidor
    // Jitsi receba o XMPP unavailable — o usuário fica fantasma para o outro
    // lado, e duplica a cada nova entrada. Hangup síncrono no beforeunload
    // garante que o servidor saiba que a sessão acabou.
    const handleBeforeUnload = () => {
      try {
        apiInstanceRef.current?.executeCommand('hangup');
      } catch {
        /* ignora */
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (!instance) {
        apiInstanceRef.current = null;
        return;
      }
      const inst = instance;
      let disposed = false;
      const disposeOnce = () => {
        if (disposed) return;
        disposed = true;
        try {
          inst.dispose();
        } catch {
          /* ignora */
        }
      };

      if (leftRef.current) {
        // Sala já foi deixada (botão do Jitsi ou botão do cabeçalho via
        // handleHeaderClose). O XMPP unavailable já saiu — pode descartar
        // o iframe imediatamente.
        disposeOnce();
      } else {
        // Componente está sendo desmontado sem passar pelos botões de
        // sair (navegação, refresh externo, troca de requestId). Pedimos
        // hangup para o Prosody registrar a saída via XMPP — senão o
        // outro lado vê fantasma e o próximo entrar duplica. Descartamos
        // assim que o evento de saída chegar, com fallback de 2 s caso
        // o iframe não responda a tempo.
        try {
          inst.addListener('videoConferenceLeft', disposeOnce);
          inst.addListener('readyToClose', disposeOnce);
        } catch {
          /* ignora */
        }
        try {
          inst.executeCommand('hangup');
        } catch {
          /* ignora */
        }
        setTimeout(disposeOnce, 2000);
      }
      apiInstanceRef.current = null;
    };
  }, [requestId]);

  // Botão "Sair" do cabeçalho da plataforma: NÃO desmonta direto. Pede
  // hangup ao Jitsi e deixa o listener de `videoConferenceLeft` disparar
  // o onClose (que então desmonta o componente). Assim o Prosody recebe
  // o XMPP unavailable antes do iframe sumir e o usuário não vira
  // fantasma na sala. Fallback de 1.5 s caso o evento não venha.
  const handleHeaderClose = () => {
    const inst = apiInstanceRef.current;
    if (!inst || leftRef.current) {
      onClose();
      return;
    }
    try {
      inst.executeCommand('hangup');
    } catch {
      onClose();
      return;
    }
    setTimeout(() => {
      if (!leftRef.current) onCloseRef.current();
    }, 1500);
  };

  return (
    <div
      className={`video-modal${split ? ' video-modal--split' : ''}`}
      role="dialog"
      aria-label="Vídeo chamada"
    >
      <div className="video-modal__header">
        <span>
          <Icon name="camera-video" /> Sala da troca
          {otherUserName ? ` · ${otherUserName}` : ''}
        </span>
        <button
          className="btn btn--ghost btn--sm"
          // Delega para handleHeaderClose: pede hangup primeiro e deixa o
          // listener `videoConferenceLeft` desmontar o modal. Sem isso, o
          // unmount imediato faria o iframe sumir antes do XMPP unavailable
          // chegar ao Prosody e o usuário viraria fantasma na próxima entrada.
          onClick={handleHeaderClose}
          aria-label="Encerrar"
        >
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
