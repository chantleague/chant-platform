const configuredBucket = String(process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET || "").trim();

export const CHANT_AUDIO_BUCKET = configuredBucket || "chant-audio";

export function toChantAudioStorageErrorMessage(rawMessage: string) {
  const message = String(rawMessage || "").trim();

  if (!message) {
    return "Could not upload audio right now.";
  }

  if (/bucket.*not found/i.test(message)) {
    return `Audio storage bucket "${CHANT_AUDIO_BUCKET}" is missing. Create it in Supabase Storage before uploading chant audio.`;
  }

  if (/row-level security|permission denied|not allowed/i.test(message)) {
    return "Audio upload is blocked by Supabase storage policies. Verify insert permissions for chant audio uploads.";
  }

  return `Upload failed: ${message}`;
}
