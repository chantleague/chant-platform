"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import ChantPackUploadForm from "@/app/components/ChantPackUploadForm";
import DistributionMessageGenerator from "@/app/components/DistributionMessageGenerator";

export default function Page() {
  const params = useParams();
  const battleId = params.id as string;

  const [activeTab, setActiveTab] = useState<"chants" | "distribution">("chants");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Battle Management
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Manage Battle Chants
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Upload official chant packs and generate distribution messages for social platforms.
        </p>
      </header>

      <div className="flex gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("chants")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "chants"
              ? "border-b-2 border-emerald-500 text-emerald-400"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Upload Chants
        </button>
        <button
          onClick={() => setActiveTab("distribution")}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "distribution"
              ? "border-b-2 border-emerald-500 text-emerald-400"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Distribution Messages
        </button>
      </div>

      <div>
        {activeTab === "chants" && <ChantPackUploadForm battleId={battleId} />}
        {activeTab === "distribution" && (
          <DistributionMessageGenerator battleId={battleId} />
        )}
      </div>
    </div>
  );
}
