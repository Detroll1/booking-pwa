import {VStack} from '@astryxdesign/core/VStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';

export function NotFoundPage() {
  return (
    <VStack gap={3} align="center" justify="center" minHeight="100dvh" padding={6}>
      <Heading level={1}>Страница не найдена</Heading>
      <Text type="supporting" justify="center">
        Проверьте ссылку или вернитесь на главную страницу студии.
      </Text>
      <Button label="На главную" variant="primary" href="/" />
    </VStack>
  );
}
