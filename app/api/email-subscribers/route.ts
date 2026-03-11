import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabaseServer";

const SUCCESS_MESSAGE = "You're on the chant list.";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isDuplicateKeyError(errorCode?: string, errorMessage?: string) {
  if (errorCode === "23505") {
    return true;
  }

  return /duplicate|unique/i.test(errorMessage || "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 },
      );
    }

    const insertResult = await supabaseServer.from("email_subscribers").insert([{ email }]);

    if (insertResult.error) {
      if (isDuplicateKeyError(insertResult.error.code, insertResult.error.message)) {
        return NextResponse.json(
          {
            success: true,
            message: SUCCESS_MESSAGE,
            duplicate: true,
          },
          { status: 200 },
        );
      }

      console.error("api/email-subscribers: insert failed", {
        message: insertResult.error.message,
        code: insertResult.error.code,
        details: insertResult.error.details,
        hint: insertResult.error.hint,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Could not save your email right now.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: SUCCESS_MESSAGE,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("api/email-subscribers: invalid request body", error);

    return NextResponse.json(
      {
        success: false,
        message: "Invalid request body.",
      },
      { status: 400 },
    );
  }
}
