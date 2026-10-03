import {useState} from 'react';
import {PaperPlaneRight, Sparkle} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Spinner} from '@astryxdesign/core/Spinner';
import {useTenantContext} from '@/app/TenantContext';
import {useAssistant, type AssistantMessage} from '@/hooks/useAssistant';
import {ApiFailure} from '@/lib/api/client';
import {CLIENT_SUGGESTIONS} from '@/lib/assistant/router';
import {TenantHeader} from '@/components/layout/TenantHeader';

/** Full-screen "Запись с ИИ": a free rule-based assistant grounded in real studio data. */
export function AssistantPage() {
  const {tenant} = useTenantContext();
  const slug = tenant.slug;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const assistant = useAssistant(slug, 'client');

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
      setMessages((prev) => [
        ...prev,
        {role: 'assistant', content: error instanceof ApiFailure ? error.message : 'Помощник недоступен. Запись доступна обычным способом.'},
      ]);
    }
  }

  return (
    <>
      <TenantHeader />
      <VStack gap={4} paddingInline={4} paddingBlockEnd={8} className="min-h-[70vh]">
        <VStack gap={1}>
          <Heading level={1}>Запись с ИИ</Heading>
          <Text type="supporting">Напишите, что нужно: «Хочу мойку завтра после 6». Помощник ответит по реальным услугам и свободным окнам студии — бесплатно, без нейросетей.</Text>
        </VStack>

        <VStack gap={3}>
          {messages.length === 0 ? (
            <VStack gap={2}>
              <HStack gap={2} vAlign="center" className="rounded-2xl border border-border bg-surface p-3">
                <Sparkle size={20} className="text-tenant-accent" aria-hidden />
                <Text type="body">Примеры вопросов:</Text>
              </HStack>
              <HStack gap={2} wrap="wrap">
                {CLIENT_SUGGESTIONS.map((s) => (
                  <Button key={s} label={s} variant="secondary" size="sm" onClick={() => void send(s)} />
                ))}
              </HStack>
            </VStack>
          ) : null}

          <VStack gap={2}>
            {messages.map((m, index) => (
              <VStack
                key={`${m.role}-${index}`}
                className={
                  m.role === 'user'
                    ? 'self-end max-w-[85%] rounded-2xl border border-tenant-accent tenant-accent-soft px-3 py-2'
                    : 'self-start max-w-[85%] rounded-2xl border border-border bg-surface px-3 py-2'
                }
              >
                <Text type="body">{m.content}</Text>
              </VStack>
            ))}
            {assistant.isPending ? <Spinner /> : null}
          </VStack>
        </VStack>

        <HStack gap={2} vAlign="center" className="sticky bottom-20">
          <input
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-primary"
            placeholder="Ваш вопрос…"
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
            icon={<PaperPlaneRight size={18} />}
            isLoading={assistant.isPending}
            onClick={() => void send(input)}
          />
        </HStack>
      </VStack>
    </>
  );
}