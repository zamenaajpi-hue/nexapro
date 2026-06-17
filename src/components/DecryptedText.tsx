import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface DecryptedTextProps {
  text: string;
  isGroupChat: boolean;
  isOutgoing: boolean;
  userPublicKey?: string | null;
  senderPublicKey?: string | null;
  showLockIcon?: boolean;
  plainTextFormat?: boolean;
}

const MarkdownMessageContent = lazy(() => import('./MarkdownMessageContent'));
const ENCRYPTED_PLACEHOLDER = '[Encrypted message unavailable]';
const MARKDOWN_PATTERN =
  /(^|\n)\s{0,3}(#{1,6}|\* |- |\d+\. |> )|```|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~/m;

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  isGroupChat,
  isOutgoing,
  userPublicKey,
  senderPublicKey,
  showLockIcon = false,
  plainTextFormat = false,
}) => {
  const [decrypted, setDecrypted] = useState(text);
  const [isEncrypted, setIsEncrypted] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isGroupChat && text?.startsWith('[E2EE]')) {
      setIsEncrypted(true);

      const run = async () => {
        try {
          const e2ee = await import('../utils/e2ee');
          const privKey = await e2ee.getLocalPrivateKeyAsync();
          const parsed = JSON.parse(text.replace('[E2EE]', ''));

          if (isOutgoing && privKey && userPublicKey) {
            const decryptedText = await e2ee.decryptMessage(parsed.s, userPublicKey, privKey);
            if (active) {
              setDecrypted(decryptedText || ENCRYPTED_PLACEHOLDER);
            }
            return;
          }

          if (!isOutgoing && privKey && senderPublicKey) {
            const decryptedText = await e2ee.decryptMessage(parsed.r, senderPublicKey, privKey);
            if (active) {
              setDecrypted(decryptedText || ENCRYPTED_PLACEHOLDER);
            }
            return;
          }
        } catch (error) {
          console.warn('Decryption decode failed:', error);
        }

        if (active) {
          setDecrypted(ENCRYPTED_PLACEHOLDER);
        }
      };

      void run();
    } else {
      setIsEncrypted(false);
      setDecrypted(text);
    }

    return () => {
      active = false;
    };
  }, [text, isGroupChat, isOutgoing, userPublicKey, senderPublicKey]);

  const shouldRenderMarkdown = useMemo(() => {
    if (plainTextFormat) return false;
    return MARKDOWN_PATTERN.test(decrypted);
  }, [decrypted, plainTextFormat]);

  const lockIcon = showLockIcon && isEncrypted ? (
    <span
      title="Encrypted"
      style={{ display: 'inline-flex', alignSelf: plainTextFormat ? 'center' : 'flex-start' }}
    >
      <ShieldCheck size={14} style={{ color: '#34d399' }} />
    </span>
  ) : null;

  if (plainTextFormat) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
        {lockIcon}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {decrypted}
        </span>
      </span>
    );
  }

  const plainTextContent = (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', width: '100%' }}>{decrypted}</div>
  );

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
      {lockIcon}
      <div style={{ wordBreak: 'break-word', width: '100%' }}>
        {shouldRenderMarkdown ? (
          <Suspense fallback={plainTextContent}>
            <MarkdownMessageContent text={decrypted} />
          </Suspense>
        ) : (
          plainTextContent
        )}
      </div>
    </div>
  );
};

export default DecryptedText;
