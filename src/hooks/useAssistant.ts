import {useMutation} from '@tanstack/react-query';
import {callFunction} from '@/lib/api/client';
import type {ApiAssistantReply} from '@/types/api';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useAssistant(slug: string, scope: 'client' | 'owner', accessToken?: string) {
  return useMutation({
    mutationFn: (input: {message: string; history: AssistantMessage[]}) =>
      callFunction<ApiAssistantReply>('assistant', {
        body: {slug, scope, message: input.message, history: input.history},
        accessToken,
      }),
  });
}
