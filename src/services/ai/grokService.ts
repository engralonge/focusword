import { getSupabaseClient } from '@/services/supabase/client';

type SummaryInput = {
  reference: string;
  translation: string;
  verses: string;
};

export async function summarizePassage(
  input: SummaryInput,
): Promise<{ summary: string; error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      summary: '',
      error: 'Connect FocusWord to Supabase to enable AI study tools.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      summary?: string;
      error?: string;
    }>('summarize-passage', {
      body: input,
    });

    if (error) {
      return { summary: '', error: error.message };
    }

    const summary = data?.summary?.trim();
    if (!summary) {
      return { summary: '', error: data?.error ?? 'No summary was returned.' };
    }
    return { summary, error: null };
  } catch (error) {
    return {
      summary: '',
      error: error instanceof Error ? error.message : 'Failed to reach the study service.',
    };
  }
}
