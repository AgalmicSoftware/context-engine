/** Use the recorded container for uploads and retained-audio downloads. */
export function audioFileExtension(type: string): string {
  const mime = type.toLowerCase().split(';')[0].trim();
  const extensions: Record<string, string> = {
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/mp4': 'mp4',
    'video/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/ogg': 'ogg',
    'application/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/mpeg': 'mp3',
    'audio/aac': 'aac',
  };
  return extensions[mime] || 'wav';
}
