import {useState} from 'react';
import {ChatCircleDots, PaperPlaneRight} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose} from '@/components/ui/drawer';
import {useAssistant, type AssistantMessage} from '@/hooks/useAssistant';
import {ApiFailure} from '@/lib/api/client';
import {CLIENT_SUGGESTIONS, OWNER_SUGGESTIONS} from '@/lib/assistant/router';

export function AssistantSheet({
  slug,
  scope,
  accessToken,
}: {
  slug: string;
  scope: 'client' | 'owner';
  accessToken?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const assistant = useAssistant(slug, scope, accessToken);
  const suggestions = scope === 'owner' ? OWNER_SUGGESTIONS : CLIENT_SUGGESTIONS;

  async function send(text: string) {
    const message = text.trim();
    if (!message) return;
    const history = messages;
    setMessages([...history, {role: 'user', content: message}]);
    setInput('');
    try {
      const reply = await assistant.mutateAsync({message, history});
      setMessages((prev) => [...prev, {role: 'assistant', content: reply.reply}]);
    } catch (error) {
      const text = error instanceof ApiFailure ? error.message : 'Помощник недоступен. Можно записаться обычным способом.';
      setMessages((prev) => [...prev, {role: 'assistant', content: text}]);
    }
  }

  return (
    <>
      <Button
        label="Помощник"
        variant="secondary"
        size="sm"
        icon={<ChatCircleDots size={16} />}
        onClick={() => setOpen(true)}
      />
      <Drawer open={open} onOpenChange={setOpen} swipeDirection="down">
        <DrawerContent>
          <DrawerHeader>
            <HStack hAlign="between" vAlign="center">
              <DrawerTitle>Помощник студии</DrawerTitle>
              <DrawerClose className="rounded-md px-2 py-1 text-sm text-secondary hover:text-primary">Закрыть</DrawerClose>
            </HStack>
          </DrawerHeader>
          <VStack gap={3}>
            {messages.length === 0 ? (
              <VStack gap={2}>
                <Text type="supporting">Спросите обычным языком — помощник ответит по данным этой студии.</Text>
                <HStack gap={2} wrap="wrap">
                  {suggestions.map((s) => (
                    <Button key={s} label={s} variant="secondary" size="sm" onClick={() => void send(s)} />
                  ))}
                </HStack>
              </VStack>
            ) : null}
            <VStack gap={2}>
              {messages.map((m, index) => (
                <VStack
                  key={`${m.role}-${index}`}
                  className={m.role === 'user' ? 'self-end rounded-xl border border-tenant-accent tenant-accent-soft px-3 py-2' : 'self-start rounded-xl border border-border bg-surface px-3 py-2'}
                >
                  <Text type="body">{m.content}</Text>
                </VStack>
              ))}
              {assistant.isPending ? <Spinner /> : null}
            </VStack>
            <HStack gap={2} vAlign="center">
              <input
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-primary"
                placeholder="Ваш вопрос"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void send(input);
                }}
              />
              <Button
                label="Отправить"
                isIconOnly
                variant="primary"
                icon={<PaperPlaneRight size={16} />}
                isLoading={assistant.isPending}
                onClick={() => void send(input)}
              />
            </HStack>
          </VStack>
        </DrawerContent>
      </Drawer>
    </>
  );
}
