import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

import type { ExecException } from 'child_process';
const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (!action || !["start", "stop"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'start' or 'stop'" },
        { status: 400 }
      );
    }

    if (action === "start") {
      // Start VirtualHere service
      await execAsync("sudo systemctl start virtualhere.service");

      return NextResponse.json({
        success: true,
        message: "VirtualHere service started successfully",
        action: "start"
      });
    } else if (action === "stop") {
      // Stop VirtualHere service and restart IPP-USB service
      await execAsync("sudo systemctl stop virtualhere.service");
      await execAsync("sudo systemctl restart ipp-usb.service");

      return NextResponse.json({
        success: true,
        message: "VirtualHere service stopped and IPP-USB service restarted",
        action: "stop"
      });
    }
  } catch (error) {
    console.error("VirtualHere service management error:", error);
    return NextResponse.json(
      {
        error: `Failed to manage VirtualHere service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const getServiceStatus = async (serviceName: string) => {
      try {
        const { stdout } = await execAsync(
          `sudo systemctl is-active ${serviceName}`
        );
        return stdout.trim();
      } catch (error) {
        const errorTyped = error as { stdout?: string; stderr?: string };
        if (errorTyped.stdout) {
          return errorTyped.stdout.trim();
        }
        return "unknown";
      }
    };

    // Check VirtualHere service status
    const vhStatus = await getServiceStatus("virtualhere.service");

    // Check IPP-USB service status
    const ippStatus = await getServiceStatus("ipp-usb.service");

    return NextResponse.json({
      virtualhere: {
        status: vhStatus,
        isActive: vhStatus === "active"
      },
      ippUsb: {
        status: ippStatus,
        isActive: ippStatus === "active"
      }
    });
  } catch (error) {
    console.error("Failed to check service status:", error);
    return NextResponse.json(
      {
        error: `Failed to check service status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
