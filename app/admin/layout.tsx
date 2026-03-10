import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user || !isAdmin(user)) {
    redirect("/");
  }

  return children;
}