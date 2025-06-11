import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import os from "os";
import { promisify } from "util";
import { env } from "@/env";
const execAsync = promisify(exec);
const TEMP_DIR = path.join(os.tmpdir(), env.SCAN_TEMP_DIR_NAME);
const PREVIEW_DIR = path.join(TEMP_DIR, env.SCAN_TEMP_PREVIEW_DIR_NAME);

async function ensurePreviewDir() {
  try {
    await fs.mkdir(PREVIEW_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create preview directory:", error);
  }
}

async function generatePdfPreview(
  pdfPath: string,
  outputPath: string,
): Promise<boolean> {
  const methods = [
    async () => {
      try {
        await execAsync(
          `pdftoppm -jpeg -f 1 -singlefile "${pdfPath}" "${outputPath.replace(/\.jpg$/, "")}"`,
        );
        return true;
      } catch (error) {
        console.log("pdftoppm method failed:", error);
        return false;
      }
    },

    async () => {
      try {
        await execAsync(
          `gs -sDEVICE=jpeg -dTextAlphaBits=4 -r150 -dFirstPage=1 -dLastPage=1 -dNOPAUSE -dBATCH -sOutputFile="${outputPath}" "${pdfPath}"`,
        );
        return true;
      } catch (error) {
        console.log("ghostscript method failed:", error);
        return false;
      }
    },

    async () => {
      try {
        await execAsync(
          `convert -density 150 "${pdfPath}[0]" -quality 90 "${outputPath}"`,
        );
        return true;
      } catch (error) {
        console.log("ImageMagick alternative method failed:", error);
        return false;
      }
    },

    async () => {
      try {
        await execAsync(
          `convert -size 300x400 -background white -fill black -gravity center -font Arial -pointsize 20 label:"PDF Preview\nNot Available" "${outputPath}"`,
        );
        return true;
      } catch (error) {
        console.log("Placeholder creation failed:", error);

        try {
          await execAsync(`convert -size 300x400 xc:white "${outputPath}"`);
          return true;
        } catch (e) {
          console.error("Even basic image creation failed:", e);
          return false;
        }
      }
    },
  ];

  for (const method of methods) {
    if (await method()) {
      return true;
    }
  }

  return false;
}

export async function GET(request: NextRequest) {
  try {
    await ensurePreviewDir();

    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    const metadataFile = path.join(TEMP_DIR, `${jobId}.json`);
    let metadata;

    try {
      const metadataContent = await fs.readFile(metadataFile, "utf8");
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      console.error("Failed to read job metadata:", error);
      return NextResponse.json(
        { error: "Scan job not found" },
        { status: 404 },
      );
    }

    const originalFile = metadata.filePath;
    const previewFile = path.join(PREVIEW_DIR, `${jobId}_preview.jpg`);

    try {
      await fs.access(previewFile);
    } catch {
      try {
        if (metadata.settings.format === "pdf") {
          const success = await generatePdfPreview(originalFile, previewFile);

          if (!success) {
            await fs.writeFile(
              previewFile,
              Buffer.from(
                "R0lGODlhLQBkAPf/AP///wAAAP7+/vz8/Pn5+ff39/X19fLy8vDw8O3t7evr6+np6ebm5uTk5OLi4t/f393d3dvb29jY2NbW1tTU1NHR0c/Pz8zMzMrKysfHx8XFxcPDw7+/v729vbq6ura2trS0tLGxsa+vr6urq6ioqKampqSkpKGhoZ+fn52dnZqampiYmJWVlZOTk5CQkI6OjouLi4mJiYaGhoSEhIGBgX9/f319fXp6enl5eXd3d3V1dXNzc3FxcW5ubmxsbGpqamdnZ2VlZWNjY2BgYF5eXlxcXFlZWVdXV1VVVVNTUy0tLQEBAf///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAAP8ALAAAAAAtAGQAAAj/AP8JHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHEmypMmTKFOqXMmypcuXMGPKnEmzps2bOHPq3Mmzp8+fQIMKHUq0qNGjSJMqXcq0qdOnUKNKnUq1qtWrWLNq3cq1q9evYMOKHUu2rNmzaL2aGKEChZIUImqwOELDxRMnLlqQYBGjRgURNZLo2PFWLokWO3jw6MGjNI+/JUjIqBGjRg0RNmgoWZKEyZMoT1SAXLECRY0cHT6oKAJZ6ozTJUzIuPGDh5AiMEiUaOGkSRMUK1zAiCFjxo0dPX4EGeIjSZcvRWbIwJGj9Y8iUJo4/7HSxIUMGCxeuGjBAgUKEyVIjBAxIgQIEBAyRFDAQTnEDOy15MJOO2VkEXcX+QabQrwxlVEMMaSg3XsVzcZcRjX8N9BvCc3W2EgVxcDhQxm5IBFw9d1nkUcwGJRRDQhZtEJCHA30G0QagRdRDeRlNENCGsVgkEUhIDSQC/pthJILA4lEg0I/5veQD/c5FIJ+wkFHkAnz3YfRCvpRFIJCdXYUQ30PKVQRCwVpRINCQeiXkUT6ZVSRCgWtAOhEHbxJUUME7ecjRDXo10JEHugHnEQW6PfCRCDoBwFFD+jnAkUW6KfCRB3oB8NEGugHQkYQFVRoRA0ZVNAIHMFQUEAN7P+ZkQb6+SARBvopQNEC+klAEQf6TUBRBvphQJED+llgUQb6VVDRZ0o+FIB+C0wEgH4QUMT0fgNIZIB+BEgkgH4DRITAfn9PRIB+fEckgH58S4SAfnpHJIB+eU+0QED5adRDfoRDhANB+FH0QkHTUcRCQddNlAJB2U2UQkHXVbQCQdVNhPxEx1HE/EDBUfRCQcFFRPRBvVHEA0G7UfQDQbdRBARBuEW0w0G3VcQDQbRRpANBslHkA0GyVQQEQbFRFARBrznUdkBSO1T2QM0VdDZAxzlEtkBnHxS2QGcr9PVAZ9uzNUNm27N1Q2fjw/VDZsfj9WkCAQA7",
                "base64",
              ),
            );
          }
        } else {
          await execAsync(
            `convert "${originalFile}" -resize 300x400 "${previewFile}"`,
          );
        }
      } catch (conversionError) {
        console.error("Preview generation error:", conversionError);

        try {
          await execAsync(
            `convert -size 300x400 -background white -fill black -gravity center -font Arial -pointsize 20 label:"Preview\nNot Available" "${previewFile}"`,
          );
        } catch (placeholderError) {
          console.error("Failed to create placeholder:", placeholderError);

          return new NextResponse(
            Buffer.from(
              "R0lGODlhLQBkAPf/AP///wAAAP7+/vz8/Pn5+ff39/X19fLy8vDw8O3t7evr6+np6ebm5uTk5OLi4t/f393d3dvb29jY2NbW1tTU1NHR0c/Pz8zMzMrKysfHx8XFxcPDw7+/v729vbq6ura2trS0tLGxsa+vr6urq6ioqKampqSkpKGhoZ+fn52dnZqampiYmJWVlZOTk5CQkI6OjouLi4mJiYaGhoSEhIGBgX9/f319fXp6enl5eXd3d3V1dXNzc3FxcW5ubmxsbGpqamdnZ2VlZWNjY2BgYF5eXlxcXFlZWVdXV1VVVVNTUy0tLQEBAf///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAAP8ALAAAAAAtAGQAAAj/AP8JHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHEmypMmTKFOqXMmypcuXMGPKnEmzps2bOHPq3Mmzp8+fQIMKHUq0qNGjSJMqXcq0qdOnUKNKnUq1qtWrWLNq3cq1q9evYMOKHUu2rNmzaL2aGKEChZIUImqwOELDxRMnLlqQYBGjRgURNZLo2PFWLokWO3jw6MGjNI+/JUjIqBGjRg0RNmgoWZKEyZMoT1SAXLECRY0cHT6oKAJZ6ozTJUzIuPGDh5AiMEiUaOGkSRMUK1zAiCFjxo0dPX4EGeIjSZcvRWbIwJGj9Y8iUJo4/7HSxIUMGCxeuGjBAgUKEyVIjBAxIgQIEBAyRFDAQTnEDOy15MJOO2VkEXcX+QabQrwxlVEMMaSg3XsVzcZcRjX8N9BvCc3W2EgVxcDhQxm5IBFw9d1nkUcwGJRRDQhZtEJCHA30G0QagRdRDeRlNENCGsVgkEUhIDSQC/pthJILA4lEg0I/5veQD/c5FIJ+wkFHkAnz3YfRCvpRFIJCdXYUQ30PKVQRCwVpRINCQeiXkUT6ZVSRCgWtAOhEHbxJUUME7ecjRDXo10JEHugHnEQW6PfCRCDoBwFFD+jnAkUW6KfCRB3oB8NEGugHQkYQFVRoRA0ZVNAIHMFQUEAN7P+ZkQb6+SARBvopQNEC+klAEQf6TUBRBvphQJED+llgUQb6VVDRZ0o+FIB+C0wEgH4QUMT0fgNIZIB+BEgkgH4DRITAfn9PRIB+fEckgH58S4SAfnpHJIB+eU+0QED5adRDfoRDhANB+FH0QkHTUcRCQddNlAJB2U2UQkHXVbQCQdVNhPxEx1HE/EDBUfRCQcFFRPRBvVHEA0G7UfQDQbdRBARBuEW0w0G3VcQDQbRRpANBslHkA0GyVQQEQbFRFARBrznUdkBSO1T2QM0VdDZAxzlEtkBnHxS2QGcr9PVAZ9uzNUNm27N1Q2fjw/VDZsfj9WkCAQA7",
              "base64",
            ),
            {
              headers: {
                "Content-Type": "image/gif",
                "Cache-Control": "public, max-age=86400",
              },
            },
          );
        }
      }
    }

    try {
      const previewBuffer = await fs.readFile(previewFile);

      return new NextResponse(previewBuffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (readError) {
      console.error("Failed to read preview file:", readError);

      return new NextResponse(
        Buffer.from(
          "R0lGODlhLQBkAPf/AP///wAAAP7+/vz8/Pn5+ff39/X19fLy8vDw8O3t7evr6+np6ebm5uTk5OLi4t/f393d3dvb29jY2NbW1tTU1NHR0c/Pz8zMzMrKysfHx8XFxcPDw7+/v729vbq6ura2trS0tLGxsa+vr6urq6ioqKampqSkpKGhoZ+fn52dnZqampiYmJWVlZOTk5CQkI6OjouLi4mJiYaGhoSEhIGBgX9/f319fXp6enl5eXd3d3V1dXNzc3FxcW5ubmxsbGpqamdnZ2VlZWNjY2BgYF5eXlxcXFlZWVdXV1VVVVNTUy0tLQEBAf///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAAP8ALAAAAAAtAGQAAAj/AP8JHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHEmypMmTKFOqXMmypcuXMGPKnEmzps2bOHPq3Mmzp8+fQIMKHUq0qNGjSJMqXcq0qdOnUKNKnUq1qtWrWLNq3cq1q9evYMOKHUu2rNmzaL2aGKEChZIUImqwOELDxRMnLlqQYBGjRgURNZLo2PFWLokWO3jw6MGjNI+/JUjIqBGjRg0RNmgoWZKEyZMoT1SAXLECRY0cHT6oKAJZ6ozTJUzIuPGDh5AiMEiUaOGkSRMUK1zAiCFjxo0dPX4EGeIjSZcvRWbIwJGj9Y8iUJo4/7HSxIUMGCxeuGjBAgUKEyVIjBAxIgQIEBAyRFDAQTnEDOy15MJOO2VkEXcX+QabQrwxlVEMMaSg3XsVzcZcRjX8N9BvCc3W2EgVxcDhQxm5IBFw9d1nkUcwGJRRDQhZtEJCHA30G0QagRdRDeRlNENCGsVgkEUhIDSQC/pthJILA4lEg0I/5veQD/c5FIJ+wkFHkAnz3YfRCvpRFIJCdXYUQ30PKVQRCwVpRINCQeiXkUT6ZVSRCgWtAOhEHbxJUUME7ecjRDXo10JEHugHnEQW6PfCRCDoBwFFD+jnAkUW6KfCRB3oB8NEGugHQkYQFVRoRA0ZVNAIHMFQUEAN7P+ZkQb6+SARBvopQNEC+klAEQf6TUBRBvphQJED+llgUQb6VVDRZ0o+FIB+C0wEgH4QUMT0fgNIZIB+BEgkgH4DRITAfn9PRIB+fEckgH58S4SAfnpHJIB+eU+0QED5adRDfoRDhANB+FH0QkHTUcRCQddNlAJB2U2UQkHXVbQCQdVNhPxEx1HE/EDBUfRCQcFFRPRBvVHEA0G7UfQDQbdRBARBuEW0w0G3VcQDQbRRpANBslHkA0GyVQQEQbFRFARBrznUdkBSO1T2QM0VdDZAxzlEtkBnHxS2QGcr9PVAZ9uzNUNm27N1Q2fjw/VDZsfj9WkCAQA7",
          "base64",
        ),
        {
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "public, max-age=86400",
          },
        },
      );
    }
  } catch (error) {
    console.error("Preview API error:", error);
    return NextResponse.json(
      { error: "Failed to get preview", details: error },
      { status: 500 },
    );
  }
}
