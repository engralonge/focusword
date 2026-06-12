type FunctionErrorLike = {
  message?: unknown;
  context?: unknown;
};

function isResponse(value: unknown): value is Response {
  return (
    typeof Response !== 'undefined' &&
    value instanceof Response
  );
}

export async function getFunctionErrorMessage(
  error: unknown,
  dataError: unknown,
  fallback: string,
): Promise<string> {
  if (typeof dataError === 'string' && dataError.trim()) {
    return dataError.trim();
  }

  const candidate = error as FunctionErrorLike | null;
  if (isResponse(candidate?.context)) {
    try {
      const payload = await candidate.context.clone().json() as {
        error?: unknown;
        message?: unknown;
      };
      const responseMessage =
        typeof payload.error === 'string'
          ? payload.error
          : typeof payload.message === 'string'
            ? payload.message
            : null;
      if (responseMessage?.trim()) {
        return responseMessage.trim();
      }
    } catch {
      try {
        const responseText = await candidate.context.clone().text();
        if (responseText.trim()) {
          return responseText.trim().slice(0, 500);
        }
      } catch {
        // Fall through to the client error message.
      }
    }
  }

  if (
    typeof candidate?.message === 'string' &&
    candidate.message.trim() &&
    !candidate.message.includes('Edge Function returned a non-2xx status code')
  ) {
    return candidate.message.trim();
  }

  return fallback;
}
