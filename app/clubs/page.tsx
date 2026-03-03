import { mockClubs } from "../lib/mockClubs";
import { ClubCard } from "../components/ClubCard";

export default function ClubsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-50">Clubs</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {mockClubs.map((club) => (
          <ClubCard
            key={club.slug}
            slug={club.slug}
            name={club.name}
            fans={club.fans}
          />
        ))}
      </div>
    </div>
  );
}
