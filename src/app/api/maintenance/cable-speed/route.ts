import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";

const execAsync = promisify(exec);
const QUIRKS_FILE = "/usr/share/ipp-usb/quirks/default.conf";

export async function GET() {
  try {
    let mode = "short"; // default to standard short cable

    try {
      const content = await fs.readFile(QUIRKS_FILE, "utf-8");
      if (content.includes("usb-max-interfaces = 1")) {
        mode = "long";
      }
    } catch (readError) {
      console.warn("Failed to read quirks file directly, trying via cat:", readError);
      try {
        const { stdout } = await execAsync(`cat ${QUIRKS_FILE}`);
        if (stdout.includes("usb-max-interfaces = 1")) {
          mode = "long";
        }
      } catch (cmdError) {
        console.error("Failed to read quirks file via cat:", cmdError);
      }
    }

    return NextResponse.json({
      success: true,
      mode,
    });
  } catch (error) {
    console.error("Failed to check cable speed mode:", error);
    return NextResponse.json(
      {
        error: `Failed to check cable speed mode: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { mode } = await request.json();

    if (!mode || !["short", "long"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'short' or 'long'" },
        { status: 400 }
      );
    }

    let writeCommand = "";
    if (mode === "long") {
      // Long Cable / Stable Mode: disable scanner to prevent loops
      writeCommand = `printf "[*]\\n  # Drop Connection: header by default\\n  http-connection = \\"\\"\\n  usb-max-interfaces = 1\\n" | sudo tee ${QUIRKS_FILE}`;
    } else {
      // Short Cable / Standard Mode: enable printing and scanning
      writeCommand = `printf "[*]\\n  # Drop Connection: header by default\\n  http-connection = \\"\\"\\n" | sudo tee ${QUIRKS_FILE}`;
    }

    // 1. Write the new quirks file
    await execAsync(writeCommand);

    // 2. Stop ipp-usb service
    await execAsync("sudo systemctl stop ipp-usb.service");

    // 3. Try to hard power-cycle the USB port to clean-boot the printer USB stack (optional/robust)
    try {
      await execAsync("sudo /home/pi/uhubctl/uhubctl -l 1-1 -p 3 -a 0 && sleep 1 && sudo /home/pi/uhubctl/uhubctl -l 1-1 -p 3 -a 1");
    } catch (uhubctlError) {
      console.warn("Optional USB port power-cycle skipped/failed:", uhubctlError);
    }

    // 4. Start ipp-usb service
    await execAsync("sudo systemctl start ipp-usb.service");

    return NextResponse.json({
      success: true,
      mode,
      message: `USB Connection Mode updated to ${mode === "long" ? "Stable (Long Cable)" : "Standard (Short Cable)"} successfully`,
    });
  } catch (error) {
    console.error("USB connection mode management error:", error);
    return NextResponse.json(
      {
        error: `Failed to update USB connection mode: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
