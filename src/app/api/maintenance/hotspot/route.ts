import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

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
      // Start hostapd and dnsmasq services on host
      await execAsync("nsenter -t 1 -m -u -i -n -p -r -- systemctl start hostapd.service");
      await execAsync("nsenter -t 1 -m -u -i -n -p -r -- systemctl start dnsmasq.service");

      return NextResponse.json({
        success: true,
        message: "WiFi Hotspot started successfully",
        action: "start"
      });
    } else if (action === "stop") {
      // Stop hostapd and dnsmasq services on host
      await execAsync("nsenter -t 1 -m -u -i -n -p -r -- systemctl stop hostapd.service");
      await execAsync("nsenter -t 1 -m -u -i -n -p -r -- systemctl stop dnsmasq.service");

      return NextResponse.json({
        success: true,
        message: "WiFi Hotspot stopped successfully",
        action: "stop"
      });
    }
  } catch (error) {
    console.error("WiFi Hotspot management error:", error);
    return NextResponse.json(
      {
        error: `Failed to manage WiFi Hotspot service: ${
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
          `nsenter -t 1 -m -u -i -n -p -r -- systemctl is-active ${serviceName}`
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

    // Check hostapd and dnsmasq service status
    const hostapdStatus = await getServiceStatus("hostapd.service");
    const dnsmasqStatus = await getServiceStatus("dnsmasq.service");

    return NextResponse.json({
      hostapd: {
        status: hostapdStatus,
        isActive: hostapdStatus === "active"
      },
      dnsmasq: {
        status: dnsmasqStatus,
        isActive: dnsmasqStatus === "active"
      }
    });
  } catch (error) {
    console.error("Failed to check WiFi Hotspot service status:", error);
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
