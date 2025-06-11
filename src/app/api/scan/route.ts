import { NextRequest, NextResponse } from "next/server";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import { ScanSettings } from "@/types/scan";
import { env } from "@/env";

const exec = promisify(execCb);

const TEMP_DIR = path.join(os.tmpdir(), env.SCAN_TEMP_DIR_NAME);

async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create temp directory:", error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const settings: ScanSettings = await request.json();
    await ensureTempDir();

    const jobId = uuidv4();
    const isPdf = settings.format === "pdf";
    const outputFile = path.join(TEMP_DIR, `${jobId}.${isPdf ? "pdf" : "jpg"}`);

    const resolutionMap = {
      draft: "150",
      normal: "300",
      high: "600",
    };
    const resolution = resolutionMap[settings.quality] || "300";

    const colorMode =
      settings.color === "bw"
        ? "Lineart"
        : settings.color === "grayscale"
          ? "Gray"
          : "Color";

    const scanCommand =
      `scanimage --device-name "${env.SCANNER_ESCL}" ` +
      `--resolution ${resolution} ` +
      `--mode ${colorMode} ` +
      `--format ${isPdf ? "pdf" : "jpeg"} ` +
      `> "${outputFile}"`;

    console.log("Executing scan command:", scanCommand);

    await exec(scanCommand);

    const fileStats = await fs.stat(outputFile);
    if (fileStats.size === 0) {
      throw new Error("Scanned file is empty");
    }

    const metadataFile = path.join(TEMP_DIR, `${jobId}.json`);
    await fs.writeFile(
      metadataFile,
      JSON.stringify({
        jobId,
        timestamp: new Date().toISOString(),
        settings,
        filePath: outputFile,
        fileSize: fileStats.size,
      }),
    );

    return NextResponse.json({
      success: true,
      jobId,
      format: settings.format,
      fileSize: fileStats.size,
      message: "Scan completed successfully",
    });
  } catch (error) {
    console.error("Scan API error:", error);
    return NextResponse.json(
      { error: "Failed to scan document" },
      { status: 500 },
    );
  }
}
