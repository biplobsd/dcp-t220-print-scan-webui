import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { env } from "@/env";

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdtempAsync = promisify(fs.mkdtemp);

const MEDIA_SIZE_MAP: Record<string, string> = {
  a4: "iso_a4_210x297mm",
  letter: "na_letter_8.5x11in",
  legal: "na_legal_8.5x14in",
  executive: "na_executive_7.25x10.5in",
  a5: "iso_a5_148x210mm",
  a6: "iso_a6_105x148mm",
  photo4x6: "na_index-4x6_4x6in",
  photo5x7: "na_5x7_5x7in",
};

const QUALITY_MAP: Record<string, string> = {
  draft: "3",
  normal: "4",
  high: "5",
};

const COLOR_MAP: Record<string, string> = {
  color: "color",
  bw: "monochrome",
};

interface PrintSettings {
  quality: "draft" | "normal" | "high";
  color: "color" | "bw";
  copies: number;
  type: "document" | "photo";
  orientation?: "portrait" | "landscape";
  mediaSize?: string;
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const settings = JSON.parse(
      formData.get("settings") as string,
    ) as PrintSettings;

    if (!file) {
      console.error("No file provided in the request");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    tempDir = await mkdtempAsync(path.join(os.tmpdir(), "print-"));
    const sanitizedFileName = file.name
        .replace(/\s+/g, '_')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    tempFilePath = path.join(tempDir, sanitizedFileName);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFileAsync(tempFilePath, fileBuffer);

    console.log("File saved temporarily:", tempFilePath);

    const lpArgs: string[] = [];

    lpArgs.push("-d", env.PRINTER_NAME);

    if (settings.copies && settings.copies > 1) {
      lpArgs.push("-n", settings.copies.toString());
    }

    if (settings.quality && QUALITY_MAP[settings.quality]) {
      lpArgs.push("-o", `print-quality=${QUALITY_MAP[settings.quality]}`);
    }

    if (settings.color && COLOR_MAP[settings.color]) {
      lpArgs.push("-o", `print-color-mode=${COLOR_MAP[settings.color]}`);
    }

    if (settings.orientation && settings.orientation === "landscape") {
      lpArgs.push("-o", "orientation-requested=4");
    }

    if (settings.mediaSize && MEDIA_SIZE_MAP[settings.mediaSize]) {
      lpArgs.push("-o", `media=${MEDIA_SIZE_MAP[settings.mediaSize]}`);
    } else {
      lpArgs.push("-o", "media=iso_a4_210x297mm");
    }

    const mediaType =
      settings.type === "photo" ? "photographic-glossy" : "stationery";
    lpArgs.push("-o", `media-type=${mediaType}`);

    lpArgs.push("-t", `"${sanitizedFileName}"`);

    lpArgs.push(tempFilePath);

    const lpCommand = `lp ${lpArgs.join(" ")}`;
    console.log("Executing print command:", lpCommand);

    const { stdout, stderr } = await execAsync(lpCommand);

    const jobIdMatch = stdout.match(/request id is ([^\s]+)/);
    const jobId = jobIdMatch ? jobIdMatch[1] : "unknown";

    console.log("Print job submitted:", { jobId, stdout, stderr });

    return NextResponse.json({
      success: true,
      jobId,
      message: "Print job submitted successfully",
    });
  } catch (error) {
    console.error("Print API error:", error);
    return NextResponse.json(
      { error: "Failed to process print job", details: String(error) },
      { status: 500 },
    );
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await unlinkAsync(tempFilePath);
        console.log("Temporary file removed:", tempFilePath);
      } catch (e) {
        console.error("Error removing temporary file:", e);
      }
    }

    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmdir(tempDir, (err) => {
          if (err) console.error("Error removing temporary directory:", err);
          else console.log("Temporary directory removed:", tempDir);
        });
      } catch (e) {
        console.error("Error removing temporary directory:", e);
      }
    }
  }
}
