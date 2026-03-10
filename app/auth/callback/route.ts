import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

function toSafeNextPath(nextParam: string | null) {
  if (!nextParam) {
    return "/";
  }

  return nextParam.startsWith("/") ? nextParam : "/";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = toSafeNextPath(requestUrl.searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=missing_token", requestUrl.origin));
  }

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired_link", requestUrl.origin));
  }

  return response;
}