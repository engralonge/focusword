import { getFunctionErrorMessage } from '@/services/supabase/functionError';

describe('getFunctionErrorMessage', () => {
  it('prefers a structured Edge Function response', async () => {
    const response = new Response(
      JSON.stringify({ error: 'Only the host can manage the stage' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );

    await expect(
      getFunctionErrorMessage(
        {
          message: 'Edge Function returned a non-2xx status code',
          context: response,
        },
        undefined,
        'Could not update the live stage.',
      ),
    ).resolves.toBe('Only the host can manage the stage');
  });

  it('uses returned data and useful client messages before the fallback', async () => {
    await expect(
      getFunctionErrorMessage(null, 'The room has ended', 'Fallback'),
    ).resolves.toBe('The room has ended');
    await expect(
      getFunctionErrorMessage(new Error('Network request failed'), null, 'Fallback'),
    ).resolves.toBe('Network request failed');
  });

  it('hides the generic non-2xx client message', async () => {
    await expect(
      getFunctionErrorMessage(
        new Error('Edge Function returned a non-2xx status code'),
        null,
        'Could not join the live room.',
      ),
    ).resolves.toBe('Could not join the live room.');
  });
});
