import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function getAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(user: Pick<User, "email"> | null | undefined) {
  const userEmail = String(user?.email || "").trim().toLowerCase();
  if (!userEmail) {
    return false;
  }

  const adminEmails = getAdminEmails();
  return adminEmails.has(userEmail);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore writes in render-only contexts where cookie mutation is unavailable.
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }

  return data.user ?? null;
}