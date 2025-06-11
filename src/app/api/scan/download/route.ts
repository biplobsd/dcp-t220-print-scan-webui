import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import os from "os";
import { promisify } from "util";
import archiver from "archiver";
import { env } from "@/env";

const execAsync = promisify(exec);
const TEMP_DIR = path.join(os.tmpdir(), env.SCAN_TEMP_DIR_NAME);

export async function POST(request: NextRequest) {
  try {
    const { pageIds, format } = await request.json();

    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json(
        { error: "Valid page IDs are required" },
        { status: 400 },
      );
    }

    const filePaths = [];
    for (const jobId of pageIds) {
      const metadataFile = path.join(TEMP_DIR, `${jobId}.json`);
      try {
        const metadataContent = await fs.readFile(metadataFile, "utf8");
        const metadata = JSON.parse(metadataContent);
        filePaths.push({
          path: metadata.filePath,
          originalFormat: metadata.settings.format,
        });
      } catch (error) {
        console.error(`Failed to read metadata for job ${jobId}:`, error);
        return NextResponse.json(
          { error: `Scan job ${jobId} not found` },
          { status: 404 },
        );
      }
    }

    if (filePaths.length > 1) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const outputFile = path.join(TEMP_DIR, `combined_${timestamp}`);

      if (format === "pdf") {
        const outputPdfFile = `${outputFile}.pdf`;

        const pdfFiles: string[] = [];
        for (let i = 0; i < filePaths.length; i++) {
          const file = filePaths[i];
          if (file.originalFormat !== "pdf") {
            const tempPdfFile = path.join(
              TEMP_DIR,
              `temp_${i}_${timestamp}.pdf`,
            );
            await execAsync(`convert "${file.path}" "${tempPdfFile}"`);
            pdfFiles.push(tempPdfFile);
          } else {
            pdfFiles.push(file.path);
          }
        }

        const pdfFilesStr = pdfFiles.map((f) => `"${f}"`).join(" ");
        await execAsync(
          `gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -sOutputFile="${outputPdfFile}" ${pdfFilesStr}`,
        );

        for (let i = 0; i < pdfFiles.length; i++) {
          if (pdfFiles[i].includes("temp_")) {
            await fs
              .unlink(pdfFiles[i])
              .catch((e) =>
                console.error(`Failed to delete temp file: ${pdfFiles[i]}`, e),
              );
          }
        }

        const fileBuffer = await fs.readFile(outputPdfFile);

        fs.unlink(outputPdfFile).catch((e) =>
          console.error(`Failed to delete output file: ${outputPdfFile}`, e),
        );

        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="scan_${timestamp}.pdf"`,
          },
        });
      } else {
        const outputZipFile = `${outputFile}.zip`;

        const output = await fs.open(outputZipFile, "w");
        const outputStream = output.createWriteStream();

        const archive = archiver("zip", {
          zlib: { level: 9 }, // Maximum compression
        });

        archive.pipe(outputStream);

        for (let i = 0; i < filePaths.length; i++) {
          const file = filePaths[i];

          if (file.originalFormat !== format) {
            const tempFile = path.join(
              TEMP_DIR,
              `temp_${i}_${timestamp}.${format}`,
            );
            await execAsync(`convert "${file.path}" "${tempFile}"`);

            const fileContent = await fs.readFile(tempFile);
            archive.append(fileContent, { name: `scan_${i + 1}.${format}` });

            fs.unlink(tempFile).catch((e) =>
              console.error(`Failed to delete temp file: ${tempFile}`, e),
            );
          } else {
            const fileContent = await fs.readFile(file.path);
            archive.append(fileContent, { name: `scan_${i + 1}.${format}` });
          }
        }

        await new Promise<void>((resolve, reject) => {
          outputStream.on("close", resolve);
          archive.on("error", reject);
          archive.finalize();
        });

        await output.close();

        const zipBuffer = await fs.readFile(outputZipFile);

        fs.unlink(outputZipFile).catch((e) =>
          console.error(`Failed to delete ZIP file: ${outputZipFile}`, e),
        );

        return new NextResponse(zipBuffer, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="scans_${timestamp}.zip"`,
          },
        });
      }
    } else {
      const filePath = filePaths[0].path;
      const originalFormat = filePaths[0].originalFormat;

      if (format && originalFormat !== format) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const outputFile = path.join(
          TEMP_DIR,
          `converted_${timestamp}.${format}`,
        );

        await execAsync(`convert "${filePath}" "${outputFile}"`);

        const fileBuffer = await fs.readFile(outputFile);

        fs.unlink(outputFile).catch((e) =>
          console.error("Failed to delete converted file:", e),
        );

        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type":
              format === "pdf" ? "application/pdf" : `image/${format}`,
            "Content-Disposition": `attachment; filename="scan_${timestamp}.${format}"`,
          },
        });
      }

      const fileBuffer = await fs.readFile(filePath);

      const contentType =
        originalFormat === "pdf"
          ? "application/pdf"
          : originalFormat === "png"
            ? "image/png"
            : "image/jpeg";

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="scan_${timestamp}.${originalFormat}"`,
        },
      });
    }
  } catch (error) {
    console.error("Download API error:", error);
    return NextResponse.json(
      { error: "Failed to download file", details: error },
      { status: 500 },
    );
  }
}
