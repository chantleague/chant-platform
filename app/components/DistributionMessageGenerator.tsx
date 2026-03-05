"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
// not using ChantPack type directly here

// only minimal fields are fetched here
interface MinimalChant {
  id: string;
  title: string;
  description: string;
}

// interface DistributionMessages stays local

interface DistributionMessages {
  whatsapp: string;
  tiktok: string;
  youtube: string;
}

const generateMessages = (pack: MinimalChant): DistributionMessages => {
  return {
    whatsapp: `🎵 Official Chant Alert! 🎵\n\nCheck out "${pack.title}" - the official club chant for this matchday!\n\n${pack.description}\n\nDiscover more chants and join the battle at our chant platform.`,
    tiktok: `🔥 NEW Official Chant Drop! 🔥\n\n"${pack.title}"\n\nJoin thousands of fans and unleash your voice! 🎤\n\n#OfficialChant #MatchdayVibes #FansUnited`,
    youtube: `Official Matchday Chant: "${pack.title}"\n\nDescription:\n${pack.description}\n\nThis is an official club chant. Join our community and discover more chants for this matchday!`,
  };
};

export default function DistributionMessageGenerator({ battleId }: { battleId: string }) {
  const [chantPacks, setChantPacks] = useState<MinimalChant[]>([]);
  const [selectedPack, setSelectedPack] = useState<string>("");
  const [messages, setMessages] = useState<DistributionMessages | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchChantPacks = async () => {
      const { data } = await supabase
        .from("chant_packs")
        .select("id, title, description")
        .eq("match_id", battleId)
        .eq("official", true);

      if (data) {
        // cast to minimal structure
        setChantPacks(data as MinimalChant[]);
        if (data.length > 0) {
          setSelectedPack((data as MinimalChant[])[0].id);
          setMessages(generateMessages((data as MinimalChant[])[0]));
        }
      }
      setIsLoading(false);
    };

    fetchChantPacks();
  }, [battleId]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const packId = e.target.value;
    setSelectedPack(packId);
    const pack = chantPacks.find((p) => p.id === packId);
    if (pack) {
      setMessages(generateMessages(pack));
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-400">Loading chant packs...</p>
      </div>
    );
  }

  if (chantPacks.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-6 text-center">
        <p className="text-zinc-400">
          No official chant packs found. Upload a chant pack first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <label htmlFor="pack-select" className="block text-sm font-medium text-zinc-300 mb-2">
          Select Chant Pack
        </label>
        <select
          id="pack-select"
          value={selectedPack}
          onChange={handleSelectChange}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 focus:border-emerald-500 focus:outline-none"
        >
          {chantPacks.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.title}
            </option>
          ))}
        </select>
      </div>

      {messages && (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          {/* WhatsApp */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-50">WhatsApp</h3>
              <span className="text-2xl">💬</span>
            </div>
            <div className="rounded-lg bg-zinc-900 p-3 mb-4 min-h-[200px]">
              <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
                {messages.whatsapp}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(messages.whatsapp, "whatsapp")}
              className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                copied === "whatsapp"
                  ? "bg-green-600 text-white"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              {copied === "whatsapp" ? "✓ Copied!" : "Copy"}
            </button>
          </div>

          {/* TikTok */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-50">TikTok</h3>
              <span className="text-2xl">🎬</span>
            </div>
            <div className="rounded-lg bg-zinc-900 p-3 mb-4 min-h-[200px]">
              <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
                {messages.tiktok}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(messages.tiktok, "tiktok")}
              className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                copied === "tiktok"
                  ? "bg-green-600 text-white"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              {copied === "tiktok" ? "✓ Copied!" : "Copy"}
            </button>
          </div>

          {/* YouTube */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-50">YouTube</h3>
              <span className="text-2xl">📺</span>
            </div>
            <div className="rounded-lg bg-zinc-900 p-3 mb-4 min-h-[200px]">
              <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
                {messages.youtube}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(messages.youtube, "youtube")}
              className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                copied === "youtube"
                  ? "bg-green-600 text-white"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              {copied === "youtube" ? "✓ Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-blue-950/50 border border-blue-800 p-4">
        <p className="text-sm text-blue-400">
          💡 <strong>Tip:</strong> Copy these messages to your preferred platform and share
          with your fanbase. Each message is optimized for the platform&rsquo;s best practices.
        </p>
      </div>
    </div>
  );
}
