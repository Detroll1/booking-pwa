import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {TextInput} from '@astryxdesign/core/TextInput';
import {isSupabaseConfigured, supabase} from '@/lib/supabase/client';
import {ApiFailure} from '@/lib/api/client';
import {ownerPath} from '@/lib/tenant/resolve';

export function OwnerLoginPage() {
  const {slug = ''} = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!supabase) {
      setError('Supabase не настроен. См. SETUP.md.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const {error: authError} = await supabase.auth.signInWithPassword({email, password});
      if (authError) throw new ApiFailure(authError.message, 'auth', 401);
      void navigate(ownerPath(slug, 'schedule'), {replace: true});
    } catch (cause) {
      setError(cause instanceof ApiFailure ? cause.message : 'Не удалось войти');
    } finally {
      setPending(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <VStack padding={6} minHeight="100dvh" justify="center">
        <Card>
          <VStack gap={2}>
            <Heading level={1}>Вход для владельца</Heading>
            <Text type="supporting">Supabase не настроен. Инструкция — в SETUP.md.</Text>
          </VStack>
        </Card>
      </VStack>
    );
  }

  return (
    <VStack padding={6} minHeight="100dvh" justify="center">
      <Card>
        <VStack gap={4}>
          <VStack gap={1}>
            <Heading level={1}>Вход для владельца</Heading>
            <Text type="supporting">
              Владельца заводит администратор студии. Публичной регистрации нет.
            </Text>
          </VStack>
          <VStack gap={3}>
            <TextInput
              label="Почта"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              isRequired
            />
            <TextInput
              label="Пароль"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              isRequired
            />
            {error ? (
              <Text type="supporting" role="alert">
                {error}
              </Text>
            ) : null}
            <Button
              label={pending ? 'Входим…' : 'Войти'}
              variant="primary"
              width="100%"
              isLoading={pending}
              onClick={() => void submit()}
            />
          </VStack>
        </VStack>
      </Card>
    </VStack>
  );
}
