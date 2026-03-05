import { supabase } from "../lib/supabase";
import { mockClubs } from "../lib/mockClubs";
import { ClubCard } from "../components/ClubCard";

interface Club {
  id: string;
  slug: string;
  name: string;
  description?: string;
  fans?: number;
  [key: string]: unknown;
}

export default async function ClubsPage() {
  const { data: clubsData, error } = await supabase
    .from("clubs")
    .select("*");

  let clubs = (clubsData as Club[] | null) || [];
  if (error) {
    console.error("Error fetching clubs:", error);
    clubs = mockClubs as unknown as Club[];
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-50">Clubs</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(clubs || []).map((club: Club) => (
          <ClubCard
            key={(club.slug as string) || club.id}
            slug={club.slug as string}
            name={club.name as string}
            fans={club.fans as number}
          />
        ))}
      </div>
    </div>
  );
}
