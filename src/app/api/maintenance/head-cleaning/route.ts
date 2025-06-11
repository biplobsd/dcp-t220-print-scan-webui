import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  authenticatePrinter,
  getPrinterCSRFToken,
  initiateHeadCleaning,
  confirmHeadCleaning,
  refreshHeadCleaning,
} from "@/lib/webAccessPrinter";
import { CleaningType } from "@/types/maintenance";
import { env } from "@/env";

export interface CleaningRequestBody {
  type: CleaningType;
}

export async function POST(request: Request) {
  try {
    const body: CleaningRequestBody = await request.json();

    const printerPassword = env.PRINTER_PASSWORD;

    const authCookie = await authenticatePrinter(printerPassword);

    if (!authCookie) {
      return NextResponse.json(
        { error: "Failed to authenticate with printer" },
        { status: 401 },
      );
    }

    (await cookies()).set("printerAuthCookie", authCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    const cleaningType: number = body.type;

    const csrfTokenId = `CSRFToken${cleaningType}`;
    const initialCsrfToken = await getPrinterCSRFToken(
      authCookie,
      "/general/head_cleaning.html",
      csrfTokenId,
    );

    if (!initialCsrfToken) {
      return NextResponse.json(
        { error: "Failed to get initial CSRF token" },
        { status: 500 },
      );
    }

    const confirmCsrfToken = await initiateHeadCleaning(
      authCookie,
      initialCsrfToken,
      cleaningType,
    );

    if (!confirmCsrfToken) {
      return NextResponse.json(
        { error: "Failed to initiate head cleaning" },
        { status: 500 },
      );
    }

    const refreshCsrfToken = await confirmHeadCleaning(
      authCookie,
      confirmCsrfToken,
      cleaningType,
    );

    if (!refreshCsrfToken) {
      return NextResponse.json(
        {
          error:
            "Failed to get the refresh CSRF token after confirming head cleaning",
        },
        { status: 500 },
      );
    }

    const success = await refreshHeadCleaning(authCookie, refreshCsrfToken);

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Head cleaning started",
      });
    } else {
      return NextResponse.json(
        { error: "Failed to confirm head cleaning" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Head cleaning API error:", error);
    return NextResponse.json(
      { error: "Failed to start head cleaning" },
      { status: 500 },
    );
  }
}
