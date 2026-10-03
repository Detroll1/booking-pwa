import {z} from 'zod';
import {VStack} from '@astryxdesign/core/VStack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Text} from '@astryxdesign/core/Text';
import type {ApiCustomer} from '@/types/api';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Укажите имя').max(80, 'Слишком длинное имя'),
  phone: z
    .string()
    .trim()
    .min(6, 'Укажите телефон')
    .max(30, 'Слишком длинный номер')
    .regex(/^[+\d][\d\s()-]{5,}$/, 'Только цифры, пробелы и +()-'),
  car: z.string().trim().max(120, 'Слишком длинно').optional(),
  comment: z.string().trim().max(500, 'Слишком длинно').optional(),
});

export type ContactFormErrors = Partial<Record<keyof ApiCustomer, string>>;

export function validateContact(values: ApiCustomer): ContactFormErrors {
  const parsed = contactSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: ContactFormErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as keyof ApiCustomer] = issue.message;
    }
  }
  return errors;
}

export function hasContactErrors(errors: ContactFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function ContactForm({
  value,
  onChange,
  errors,
  showErrors,
}: {
  value: ApiCustomer;
  onChange: (next: ApiCustomer) => void;
  errors: ContactFormErrors;
  showErrors: boolean;
}) {
  const status = (key: keyof ApiCustomer) =>
    showErrors && errors[key] ? {type: 'error' as const, message: errors[key]} : undefined;

  return (
    <VStack gap={3}>
      <TextInput
        label="Имя"
        placeholder="Как к вам обращаться"
        value={value.name}
        onChange={(next) => onChange({...value, name: next})}
        status={status('name')}
        autoComplete="name"
        isRequired
      />
      <TextInput
        label="Телефон"
        placeholder="+7 900 000-00-00"
        value={value.phone}
        onChange={(next) => onChange({...value, phone: next})}
        status={status('phone')}
        autoComplete="tel"
        isRequired
      />
      <TextInput
        label="Автомобиль"
        placeholder="Например, BMW X5, чёрный"
        value={value.car ?? ''}
        onChange={(next) => onChange({...value, car: next})}
        status={status('car')}
        autoComplete="off"
      />
      <TextArea
        label="Комментарий"
        placeholder="Пожелания, особенности автомобиля"
        value={value.comment ?? ''}
        onChange={(next) => onChange({...value, comment: next})}
        status={status('comment')}
      />
      <Text type="supporting">Данные нужны только для этой записи. Согласие — подтверждением записи.</Text>
    </VStack>
  );
}
