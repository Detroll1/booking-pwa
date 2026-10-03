import {useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Plus, UploadSimple} from '@phosphor-icons/react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {AsyncBoundary} from '@/components/AsyncBoundary';
import {useOwnerSession} from '@/app/OwnerSessionContext';
import {ownerApi} from '@/lib/api/owner';
import {supabase} from '@/lib/supabase/client';

interface OwnerWork {
  id: string;
  imageUrl: string;
  caption: string | null;
  sort: number;
  storagePath: string;
}

export function OwnerMediaPage() {
  const {slug, session} = useOwnerSession();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addInput = useRef<HTMLInputElement | null>(null);
  const replaceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const query = useQuery({
    queryKey: ['owner', 'media', slug],
    queryFn: () => ownerApi.media(session.access_token, slug),
  });

  const upsert = useMutation({
    mutationFn: (work: {id?: string; storagePath: string; imageUrl?: string; caption?: string | null; sort?: number}) =>
      ownerApi.upsertMedia(session.access_token, slug, work),
    onSuccess: () => void client.invalidateQueries({queryKey: ['owner', 'media', slug]}),
  });

  async function upload(file: File, existing?: OwnerWork) {
    if (!supabase) {
      setError('Supabase Storage не настроен.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tenantId = query.data?.tenantId ?? 'unknown';
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${tenantId}/works/${crypto.randomUUID()}.${ext}`;
      const {error: uploadError} = await supabase.storage.from('tenant-media').upload(path, file, {upsert: false});
      if (uploadError) throw uploadError;
      const {data: publicUrl} = supabase.storage.from('tenant-media').getPublicUrl(path);
      await upsert.mutateAsync({
        id: existing?.id,
        storagePath: path,
        imageUrl: publicUrl.publicUrl,
        caption: existing?.caption ?? null,
        sort: existing?.sort,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить фото');
    } finally {
      setBusy(false);
    }
  }

  const works: OwnerWork[] = query.data?.works ?? [];

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center">
        <Heading level={1}>Фотографии работ</Heading>
        <Button label="Добавить" variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => addInput.current?.click()} isLoading={busy} />
      </HStack>
      <Text type="supporting">
        Загрузка одного фото не затрагивает остальные: каждая работа — отдельная карточка. Фото владельца сохраняются при
        переиздании настроек студии.
      </Text>
      <input
        ref={addInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }}
      />
      {error ? <Text type="supporting">{error}</Text> : null}

      <AsyncBoundary
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        isEmpty={works.length === 0}
        emptyTitle="Фотографий работ пока нет"
      >
        <VStack gap={3}>
          {works.map((work) => (
            <Card key={work.id} padding={3}>
              <VStack gap={2}>
                <img src={work.imageUrl} alt={work.caption ?? ''} className="h-40 w-full rounded-lg object-cover" />
                <HStack gap={2} vAlign="center">
                  <input
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-primary"
                    defaultValue={work.caption ?? ''}
                    placeholder="Подпись"
                    onBlur={(event) =>
                      upsert.mutate({
                        id: work.id,
                        storagePath: work.storagePath,
                        imageUrl: work.imageUrl,
                        caption: event.target.value,
                      })
                    }
                  />
                  <Button
                    label="Заменить"
                    variant="secondary"
                    size="sm"
                    icon={<UploadSimple size={16} />}
                    onClick={() => replaceRefs.current[work.id]?.click()}
                  />
                </HStack>
                <input
                  ref={(node) => {
                    replaceRefs.current[work.id] = node;
                  }}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file, work);
                    event.target.value = '';
                  }}
                />
              </VStack>
            </Card>
          ))}
        </VStack>
      </AsyncBoundary>
    </VStack>
  );
}
