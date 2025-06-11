import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { env } from "@/env";

const TEMP_DIR = path.join(os.tmpdir(), env.SCAN_TEMP_DIR_NAME);

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    const metadataFile = path.join(TEMP_DIR, `${jobId}.json`);

    try {
      const metadataContent = await fs.readFile(metadataFile, "utf8");
      const metadata = JSON.parse(metadataContent);

      const previewUrl = `/api/scan/preview?jobId=${jobId}`;

      return NextResponse.json({
        jobId: metadata.jobId,
        status: "completed",
        timestamp: metadata.timestamp,
        settings: metadata.settings,
        fileSize: metadata.fileSize,
        previewUrl,
      });
    } catch (error) {
      console.error("Failed to read job metadata:", error);
      return NextResponse.json(
        { error: "Scan job not found" },
        { status: 404 },
      );
    }
  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json(
      { error: "Failed to get job status" },
      { status: 500 },
    );
  }
}
