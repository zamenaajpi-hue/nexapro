import React, { useState, useEffect } from 'react';
import * as e2ee from '../utils/e2ee';
import { ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface DecryptedTextProps {
  text: string;
  isGroupChat: boolean;
  isOutgoing: boolean;
  userPublicKey?: string | null;
  senderPublicKey?: string | null;
  showLockIcon?: boolean;
  plainTextFormat?: boolean;
}

const ENCRYPTED_PLACEHOLDER = '[Старое сообщение недоступно]';

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
        const privKey = e2ee.getLocalPrivateKey();

        try {
          const parsed = JSON.parse(text.replace('[E2EE]', ''));

          if (isOutgoing && privKey && userPublicKey) {
            const dec = await e2ee.decryptMessage(parsed.s, userPublicKey, privKey);
            if (active) {
              setDecrypted(dec || ENCRYPTED_PLACEHOLDER);
            }
            return;
          }

          if (!isOutgoing && privKey && senderPublicKey) {
            const dec = await e2ee.decryptMessage(parsed.r, senderPublicKey, privKey);
            if (active) {
              setDecrypted(dec || ENCRYPTED_PLACEHOLDER);
            }
            return;
          }
        } catch (e) {
          console.warn('Decryption decode failed:', e);
        }

        if (active) {
          setDecrypted(ENCRYPTED_PLACEHOLDER);
        }
      };

      run();
    } else {
      setIsEncrypted(false);
      setDecrypted(text);
    }

    return () => {
      active = false;
    };
  }, [text, isGroupChat, isOutgoing, userPublicKey, senderPublicKey]);

  const lockIcon = showLockIcon && isEncrypted ? (
    <span
      title="Зашифровано"
      style={{ display: 'inline-flex', alignSelf: plainTextFormat ? 'center' : 'flex-start' }}
    >
      <ShieldCheck size={14} style={{ color: '#34d399' }} />
    </span>
  ) : null;

  return plainTextFormat ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {lockIcon}
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {decrypted}
      </span>
    </span>
  ) : (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
      {lockIcon}
      <div style={{ wordBreak: 'break-word', width: '100%' }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  {...props}
                  style={atomDark}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-md"
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code {...props} className={`${className} bg-black/20 rounded px-1 py-0.5 text-sm`}>
                  {children}
                </code>
              );
            },
          }}
        >
          {decrypted}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default DecryptedText;
