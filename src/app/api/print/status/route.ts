import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface PrintJobStatus {
  jobId: string;
  status:
    | "pending"
    | "processing"
    | "completed"
    | "canceled"
    | "aborted"
    | "unknown";
  printer: string;
  user: string;
  files: string[];
  size: string;
  timestamp: string;
  errorMessage?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      const { stdout } = await execAsync("lpstat -p");
      return NextResponse.json({
        printerStatus: stdout,
        status: "idle",
      });
    }

    const printerName = jobId.split("-")[0];

    const { stdout, stderr } = await execAsync(`lpstat -o ${printerName}`);

    if (stderr) {
      console.error("Error checking jobs:", stderr);
      return NextResponse.json({
        jobId,
        status: "unknown",
        error: stderr,
      });
    }

    const jobInQueue = stdout.includes(jobId);

    if (jobInQueue) {
      const lines = stdout.split("\n");
      const jobLine = lines.find((line) => line.includes(jobId));

      if (jobLine) {
        return NextResponse.json({
          jobId,
          status: "processing",
          message: "Job is being processed",
          details: jobLine.trim(),
        });
      }
    }

    try {
      const { stdout: completedOutput } =
        await execAsync(`lpstat -W completed`);
      const jobCompleted = completedOutput.includes(jobId);

      if (jobCompleted) {
        return NextResponse.json({
          jobId,
          status: "completed",
          message: "Print job completed successfully",
        });
      }
    } catch (error) {
      console.log("Error checking completed jobs:", error);
    }

    try {
      const { stdout: printerStatus } = await execAsync(
        `lpstat -p ${printerName}`,
      );

      if (
        printerStatus.includes("disabled") ||
        printerStatus.includes("error")
      ) {
        return NextResponse.json({
          jobId,
          status: "aborted",
          message: "Printer is disabled or in error state",
          printerState: printerStatus.trim(),
        });
      }
    } catch (error) {
      console.log("Error checking printer status:", error);
    }

    return NextResponse.json({
      jobId,
      status: "completed",
      message: "Job is no longer in the queue (assumed completed)",
    });
  } catch (error) {
    console.error("Print status API error:", error);
    return NextResponse.json(
      { error: "Failed to get print job status", details: String(error) },
      { status: 500 },
    );
  }
}
