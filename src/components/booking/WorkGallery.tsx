import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Text} from '@astryxdesign/core/Text';
import type {ApiWork} from '@/types/api';

export function WorkGallery({works}: {works: ApiWork[]}) {
  if (works.length === 0) return null;
  return (
    <HStack gap={3} isScrollable paddingBlockEnd={1}>
      {works.map((work) => (
        <VStack key={work.id} gap={1} width={230} className="shrink-0">
          <img
            src={work.imageUrl}
            alt={work.caption ?? 'Пример работы'}
            loading="lazy"
            className="h-44 w-full rounded-xl border border-border object-cover"
          />
          {work.caption ? (
            <Text type="supporting" maxLines={2}>
              {work.caption}
            </Text>
          ) : null}
        </VStack>
      ))}
    </HStack>
  );
}
