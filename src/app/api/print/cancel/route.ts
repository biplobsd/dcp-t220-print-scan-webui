import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // Sanitize jobId to prevent command injection
    if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      return NextResponse.json({ error: "Invalid jobId format" }, { status: 400 });
    }

    // Run cancel command using sudo
    console.log(`Executing: sudo cancel ${jobId}`);
    const { stdout, stderr } = await execAsync(`sudo cancel ${jobId}`);
    console.log(`Cancelled job ${jobId} successfully:`, { stdout, stderr });

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} cancelled successfully`,
    });
  } catch (error) {
    console.error("Cancel job API error:", error);
    return NextResponse.json(
      { error: "Failed to cancel job", details: String(error) },
      { status: 500 },
    );
  }
}
