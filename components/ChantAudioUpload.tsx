"use client";

import { useEffect, useRef, useState } from "react";
import { linkFanChantAudio } from "@/app/battles/[slug]/chant-actions";
import { supabase } from "@/app/lib/supabase";
import { CHANT_AUDIO_BUCKET, toChantAudioStorageErrorMessage } from "@/app/lib/storage";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["mp3", "wav", "m4a", "webm", "ogg"]);

type RecordingFormat = {
  mimeType: string;
  extension: string;
  fileType: string;
};

const RECORDING_FORMATS: RecordingFormat[] = [
  {
    mimeType: "audio/webm;codecs=opus",
    extension: "webm",
    fileType: "audio/webm",
  },
  {
    mimeType: "audio/webm",
    extension: "webm",
    fileType: "audio/webm",
  },
  {
    mimeType: "audio/ogg;codecs=opus",
    extension: "ogg",
    fileType: "audio/ogg",
  },
  {
    mimeType: "audio/mp4;codecs=mp4a.40.2",
    extension: "m4a",
    fileType: "audio/mp4",
  },
  {
    mimeType: "audio/mp4",
    extension: "m4a",
    fileType: "audio/mp4",
  },
  {
    mimeType: "audio/wav",
    extension: "wav",
    fileType: "audio/wav",
  },
];

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateAudioFile(file: File) {
  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return "Only MP3, WAV, M4A, WEBM, and OGG files are allowed.";
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return "Audio file must be 10MB or smaller.";
  }

  return null;
}

function resolveRecordingFormat() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return null;
  }

  for (const format of RECORDING_FORMATS) {
    if (MediaRecorder.isTypeSupported(format.mimeType)) {
      return format;
    }
  }

  return null;
}

function sanitizePathSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function toUploadContentType(file: File) {
  if (file.type) {
    return file.type;
  }

  const extension = getFileExtension(file.name);
  if (extension === "wav") {
    return "audio/wav";
  }

  if (extension === "m4a") {
    return "audio/mp4";
  }

  if (extension === "webm") {
    return "audio/webm";
  }

  if (extension === "ogg") {
    return "audio/ogg";
  }

  return "audio/mpeg";
}

interface ChantAudioUploadProps {
  chantId: string;
  battleSlug: string;
  userId: string;
  onUploadComplete?: (audioUrl: string) => void;
}

export default function ChantAudioUpload({
  chantId,
  battleSlug,
  userId,
  onUploadComplete,
}: ChantAudioUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingFormat, setRecordingFormat] = useState<RecordingFormat | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setRecordingFormat(resolveRecordingFormat());
  }, []);

  useEffect(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);

    return () => {
      if (previewUrlRef.current === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        previewUrlRef.current = null;
      }
    };
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateAudioFile(file);
    if (validationError) {
      setSelectedFile(null);
      setError(validationError);
      setMessage(null);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setError(null);
    setMessage(null);
  };

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    if (!recordingFormat) {
      setError("Microphone recording is not supported in this browser for uploadable chant formats.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone access.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: recordingFormat.mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setError("Recording failed. Try uploading a file instead.");
        setIsRecording(false);
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };

      mediaRecorder.onstop = () => {
        const extension = recordingFormat.extension;
        const blob = new Blob(recordingChunksRef.current, { type: recordingFormat.fileType });
        const recordedFile = new File([blob], `recording-${Date.now()}.${extension}`, {
          type: recordingFormat.fileType,
        });

        const validationError = validateAudioFile(recordedFile);
        if (validationError) {
          setSelectedFile(null);
          setError(validationError);
          setMessage(null);
        } else {
          setSelectedFile(recordedFile);
          setError(null);
          setMessage("Recording captured. Preview it below, then upload to attach it to your chant.");
        }

        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setIsRecording(false);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setError(null);
      setMessage("Recording started. Click stop when your chant is complete.");
    } catch (recordError) {
      console.error("chant audio recording failed", recordError);
      const deniedPermission =
        recordError instanceof DOMException && recordError.name === "NotAllowedError";
      setError(
        deniedPermission
          ? "Microphone permission was denied. Enable microphone access and try again."
          : "Could not access microphone. Check browser permissions.",
      );
    }
  };

  const stopRecording = () => {
    if (!isRecording) {
      return;
    }

    try {
      mediaRecorderRef.current?.requestData();
    } catch {
      // Ignore requestData failures and still attempt to stop.
    }

    mediaRecorderRef.current?.stop();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Select or record an audio file first.");
      return;
    }

    const validationError = validateAudioFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);

    const timestamp = Date.now();
    const extension = getFileExtension(selectedFile.name) || "mp3";
    const safeBattleSlug = sanitizePathSegment(battleSlug) || "battle";
    const safeChantId = sanitizePathSegment(chantId) || `chant-${timestamp}`;
    const storagePath = `${safeBattleSlug}/${safeChantId}-${timestamp}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(CHANT_AUDIO_BUCKET)
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: toUploadContentType(selectedFile),
        });

      if (uploadError) {
        setError(toChantAudioStorageErrorMessage(uploadError.message || ""));
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(CHANT_AUDIO_BUCKET)
        .getPublicUrl(storagePath);

      const audioUrl = publicUrlData.publicUrl;

      if (!audioUrl) {
        setError("Upload succeeded but audio URL could not be created.");
        return;
      }

      const linkResult = await linkFanChantAudio({
        chantId,
        battleSlug,
        userId,
        audioUrl,
      });

      if (!linkResult.success) {
        try {
          await supabase.storage.from(CHANT_AUDIO_BUCKET).remove([storagePath]);
        } catch (cleanupError) {
          console.error("chant audio cleanup failed", cleanupError);
        }

        setError(linkResult.message);
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMessage("Audio uploaded and linked to your chant. Playback is now available on your chant card.");
      onUploadComplete?.(audioUrl);
    } catch (uploadError) {
      console.error("chant audio upload failed", uploadError);
      setError("Could not upload audio right now.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-50">Attach Fan Chant Audio</p>
        <p className="mt-1 text-xs text-zinc-400">
          Upload MP3, WAV, M4A, WEBM, or OGG audio (max 10MB). Files are stored in the
          {` ${CHANT_AUDIO_BUCKET} `}
          bucket.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.webm,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/webm,audio/ogg"
        onChange={handleFileChange}
        className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-100 hover:file:bg-zinc-600"
      />

      {selectedFile && (
        <p className="text-xs text-zinc-400">
          Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
        </p>
      )}

      {previewUrl && (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Preview</p>
          <audio controls preload="metadata" className="w-full" src={previewUrl}>
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {recordingFormat && (
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
          >
            {isRecording ? "Stop Recording" : "Record With Microphone"}
          </button>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {isUploading ? "Uploading..." : "Upload Audio"}
        </button>
      </div>

      {isRecording && <p className="text-xs text-amber-300">Recording in progress...</p>}

      {!recordingFormat && (
        <p className="text-xs text-zinc-500">
          Microphone recording is unavailable in this browser for supported chant formats.
        </p>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </section>
  );
}
