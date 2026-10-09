export async function tryCopyText(
  text: string,
  clipboard?: { writeText(text: string): Promise<void> },
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
