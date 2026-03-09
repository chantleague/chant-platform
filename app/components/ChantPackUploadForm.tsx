"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { CHANT_AUDIO_BUCKET, toChantAudioStorageErrorMessage } from "@/app/lib/storage";

export default function ChantPackUploadForm({ battleId }: { battleId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let audioUrl = null;

      // Upload audio file if provided
      if (audioFile) {
        const fileName = `${Date.now()}-${audioFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from(CHANT_AUDIO_BUCKET)
          .upload(`${battleId}/${fileName}`, audioFile);

        if (uploadError) {
          throw new Error(toChantAudioStorageErrorMessage(uploadError.message || ""));
        }

        const { data: publicUrl } = supabase.storage
          .from(CHANT_AUDIO_BUCKET)
          .getPublicUrl(`${battleId}/${fileName}`);

        audioUrl = publicUrl.publicUrl;
      }

      // Insert chant pack
      const { error: dbError } = await supabase.from("chant_packs").insert([
        {
          match_id: battleId,
          title: formData.title,
          description: formData.description,
          audio_url: audioUrl,
          official: true,
        },
      ]);

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      setSuccess(true);
      setFormData({ title: "", description: "" });
      setAudioFile(null);

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-800 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-emerald-950/50 border border-emerald-800 p-4 text-sm text-emerald-400">
            Chant pack uploaded successfully!
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-300 mb-2">
            Chant Pack Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g., Victor Matfield Memorial Chant"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Describe the chant and its significance..."
            rows={4}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label htmlFor="audio" className="block text-sm font-medium text-zinc-300 mb-2">
            Audio File
          </label>
          <div className="rounded-lg border-2 border-dashed border-zinc-700 p-6 text-center hover:border-zinc-500 transition-colors">
            <input
              type="file"
              id="audio"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="audio" className="cursor-pointer">
              {audioFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-400">✓ {audioFile.name}</p>
                  <p className="text-xs text-zinc-500">
                    {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-300">
                    Drop audio file here or click to select
                  </p>
                  <p className="text-xs text-zinc-500">MP3, WAV, or M4A • Max 50MB</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:cursor-not-allowed px-4 py-3 font-medium text-white transition-colors"
        >
          {isLoading ? "Uploading..." : "Upload Chant Pack"}
        </button>
      </form>
    </div>
  );
}
