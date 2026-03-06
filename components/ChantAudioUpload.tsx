"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { linkFanChantAudio } from "@/app/battles/[slug]/chant-actions";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["mp3", "wav", "m4a"]);

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
    return "Only MP3, WAV, and M4A files are allowed.";
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return "Audio file must be 10MB or smaller.";
  }

  return null;
}

function resolveRecordingMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return null;
  }

  const preferredTypes = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/wav"];
  for (const mimeType of preferredTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
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
  const [recordingMimeType, setRecordingMimeType] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setRecordingMimeType(resolveRecordingMimeType());
  }, []);

  useEffect(() => {
    return () => {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
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

    if (!recordingMimeType) {
      setError("Microphone recording is not supported for M4A/WAV in this browser.");
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

      const mediaRecorder = new MediaRecorder(stream, { mimeType: recordingMimeType });
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
        const type = recordingMimeType.includes("wav") ? "audio/wav" : "audio/mp4";
        const extension = type.includes("wav") ? "wav" : "m4a";
        const blob = new Blob(recordingChunksRef.current, { type });
        const recordedFile = new File([blob], `recording-${Date.now()}.${extension}`, {
          type,
        });

        const validationError = validateAudioFile(recordedFile);
        if (validationError) {
          setSelectedFile(null);
          setError(validationError);
          setMessage(null);
        } else {
          setSelectedFile(recordedFile);
          setError(null);
          setMessage("Recording captured. Upload it to attach to your chant.");
        }

        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      setMessage("Recording started.");
    } catch (recordError) {
      console.error("chant audio recording failed", recordError);
      setError("Could not access microphone. Check browser permissions.");
    }
  };

  const stopRecording = () => {
    if (!isRecording) {
      return;
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
    const storagePath = `chant-${chantId}-${timestamp}.mp3`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("chant-audio")
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedFile.type || "audio/mpeg",
        });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("chant-audio")
        .getPublicUrl(storagePath);

      const audioUrl = publicUrlData.publicUrl;

      const linkResult = await linkFanChantAudio({
        chantId,
        battleSlug,
        userId,
        audioUrl,
      });

      if (!linkResult.success) {
        // Best-effort cleanup if DB linking fails after upload succeeds.
        try {
          await supabase.storage.from("chant-audio").remove([storagePath]);
        } catch (cleanupError) {
          console.error("chant audio cleanup failed", cleanupError);
        }

        setError(linkResult.message);
        return;
      }

      setSelectedFile(null);
      setMessage("Audio uploaded and linked to your chant.");
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
          Upload MP3, WAV, or M4A audio (max 10MB). Files are stored in the `chant-audio` bucket.
        </p>
      </div>

      <input
        type="file"
        accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/m4a"
        onChange={handleFileChange}
        className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-100 hover:file:bg-zinc-600"
      />

      {selectedFile && (
        <p className="text-xs text-zinc-400">
          Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {recordingMimeType && (
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

      {!recordingMimeType && (
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
