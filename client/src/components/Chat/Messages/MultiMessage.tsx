import { useRecoilState } from 'recoil';
import { useEffect, useCallback, useRef } from 'react';
import { isAssistantsEndpoint } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { TMessageProps } from '~/common';

import MessageContent from '~/components/Messages/MessageContent';

import MessageParts from './MessageParts';

import Message from './Message';
import store from '~/store';

export default function MultiMessage({
  // messageId is used recursively here
  messageId,
  messagesTree,
  currentEditId,
  setCurrentEditId,
}: TMessageProps) {
  const [siblingIdx, setSiblingIdx] = useRecoilState(store.messagesSiblingIdxFamily(messageId));
  const prevMessagesLengthRef = useRef<number | null>(null);

  const setSiblingIdxRev = useCallback(
    (value: number) => {
      setSiblingIdx((messagesTree?.length ?? 0) - value - 1);
    },
    [messagesTree?.length, setSiblingIdx],
  );

  useEffect(() => {
    // Только сбрасываем siblingIdx при изменении количества сообщений в дереве
    const currentLength = messagesTree?.length ?? 0;
    if (prevMessagesLengthRef.current !== currentLength) {
      prevMessagesLengthRef.current = currentLength;
      // Сбрасываем индекс только если он не 0
      if (siblingIdx !== 0) {
        setSiblingIdx(0);
      }
    }
  }, [messagesTree?.length, setSiblingIdx, siblingIdx]);

  useEffect(() => {
    if (messagesTree?.length && siblingIdx >= messagesTree.length) {
      setSiblingIdx(0);
    }
  }, [siblingIdx, messagesTree?.length, setSiblingIdx]);

  if (!(messagesTree && messagesTree.length)) {
    return null;
  }

  const message = messagesTree[messagesTree.length - siblingIdx - 1] as TMessage | undefined;

  if (!message) {
    return null;
  }

  if (isAssistantsEndpoint(message.endpoint) && message.content) {
    return (
      <MessageParts
        key={message.messageId}
        message={message}
        currentEditId={currentEditId}
        setCurrentEditId={setCurrentEditId}
        siblingIdx={messagesTree.length - siblingIdx - 1}
        siblingCount={messagesTree.length}
        setSiblingIdx={setSiblingIdxRev}
      />
    );
  } else if (message.content) {
    return (
      <MessageContent
        key={message.messageId}
        message={message}
        currentEditId={currentEditId}
        setCurrentEditId={setCurrentEditId}
        siblingIdx={messagesTree.length - siblingIdx - 1}
        siblingCount={messagesTree.length}
        setSiblingIdx={setSiblingIdxRev}
      />
    );
  }

  return (
    <Message
      key={message.messageId}
      message={message}
      currentEditId={currentEditId}
      setCurrentEditId={setCurrentEditId}
      siblingIdx={messagesTree.length - siblingIdx - 1}
      siblingCount={messagesTree.length}
      setSiblingIdx={setSiblingIdxRev}
    />
  );
}
