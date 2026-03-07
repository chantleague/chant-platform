import { permanentRedirect } from "next/navigation";

type BattleParams = { slug: string | string[] };

export default async function Page({
  params,
}: {
  params: BattleParams | Promise<BattleParams>;
}) {
  const { slug: rawSlug } = await Promise.resolve(params);
  const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const slug = (maybeSlug ?? "").toString().trim().toLowerCase();

  if (!slug) {
    permanentRedirect("/battles");
  }

  permanentRedirect(`/battles/${encodeURIComponent(slug)}`);
}

