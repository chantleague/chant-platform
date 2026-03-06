interface SunoAudioResult {
  success: boolean;
  audioUrl: string | null;
  trackId: string | null;
  error?: string;
}

function extractAudioUrl(payload: unknown): { audioUrl: string | null; trackId: string | null } {
  const body = payload as Record<string, unknown> | null;
  if (!body) {
    return { audioUrl: null, trackId: null };
  }

  const directAudio = body.audio_url || body.audioUrl || body.url;
  const directTrackId = body.id || body.track_id || body.trackId;

  if (typeof directAudio === "string") {
    return {
      audioUrl: directAudio,
      trackId: typeof directTrackId === "string" ? directTrackId : null,
    };
  }

  const data = body.data;
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    const nestedAudio = first?.audio_url || first?.audioUrl || first?.url;
    const nestedTrackId = first?.id || first?.track_id || first?.trackId;

    return {
      audioUrl: typeof nestedAudio === "string" ? nestedAudio : null,
      trackId: typeof nestedTrackId === "string" ? nestedTrackId : null,
    };
  }

  return { audioUrl: null, trackId: null };
}

export async function generateChantAudio(chantText: string): Promise<SunoAudioResult> {
  const prompt = chantText.trim();
  if (!prompt) {
    return {
      success: false,
      audioUrl: null,
      trackId: null,
      error: "Missing chant text.",
    };
  }

  const apiKey = process.env.SUNO_API_KEY;
  const apiUrl = process.env.SUNO_API_URL || "https://api.suno.ai/v1/generate";

  if (!apiKey) {
    return {
      success: false,
      audioUrl: null,
      trackId: null,
      error: "SUNO_API_KEY not configured.",
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        style: "stadium chant",
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        audioUrl: null,
        trackId: null,
        error: `Suno request failed with status ${response.status}.`,
      };
    }

    const payload = (await response.json()) as unknown;
    const extracted = extractAudioUrl(payload);

    if (!extracted.audioUrl) {
      return {
        success: false,
        audioUrl: null,
        trackId: extracted.trackId,
        error: "Suno response did not include an audio URL.",
      };
    }

    return {
      success: true,
      audioUrl: extracted.audioUrl,
      trackId: extracted.trackId,
    };
  } catch (error) {
    return {
      success: false,
      audioUrl: null,
      trackId: null,
      error: error instanceof Error ? error.message : "Unknown Suno error.",
    };
  }
}
