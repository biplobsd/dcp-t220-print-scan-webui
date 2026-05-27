import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);
const CONFIG_PATH = path.join(process.cwd(), "usb-power.json");

interface UsbPowerConfig {
  enabled: boolean;
  location: string;
  port: string;
  idleTimeout: number; // in minutes
  currentState: "on" | "off";
}

const DEFAULT_CONFIG: UsbPowerConfig = {
  enabled: false,
  location: "1-1",
  port: "3",
  idleTimeout: 10,
  currentState: "on",
};

// Simple global memory variables to enforce safety cooldowns
let lastTransitionTime = 0;
const COOLDOWN_MS = 60 * 1000; // 60 seconds

async function readConfig(): Promise<UsbPowerConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function writeConfig(config: UsbPowerConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

async function getActualPortState(location: string, port: string): Promise<"on" | "off"> {
  try {
    // Sanitize to prevent command injection
    if (!/^[a-zA-Z0-9_-]+$/.test(location) || !/^[0-9]+$/.test(port)) {
      return "on";
    }
    const { stdout } = await execAsync(`/usr/local/sbin/uhubctl -l ${location} -p ${port}`);
    // Check if the specific port line contains "off"
    const portLine = stdout.split("\n").find((line) => line.includes(`Port ${port}:`));
    if (portLine && portLine.toLowerCase().includes("off")) {
      return "off";
    }
    return "on";
  } catch {
    return "on";
  }
}

export async function GET() {
  try {
    const config = await readConfig();
    const actualState = await getActualPortState(config.location, config.port);
    config.currentState = actualState;
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to read USB power config:", error);
    return NextResponse.json({ error: "Failed to read configuration" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = await readConfig();

    const { enabled, location, port, idleTimeout, action } = body;

    // 1. Update basic settings
    if (enabled !== undefined) config.enabled = Boolean(enabled);
    if (location !== undefined && /^[a-zA-Z0-9_-]+$/.test(location)) config.location = String(location);
    if (port !== undefined && /^[0-9]+$/.test(port)) config.port = String(port);
    if (idleTimeout !== undefined && !isNaN(Number(idleTimeout))) config.idleTimeout = Number(idleTimeout);

    let transitionMessage = "";

    // 2. Handle manual power actions (if provided)
    if (action && ["on", "off"].includes(action)) {
      const now = Date.now();
      const elapsed = now - lastTransitionTime;

      if (elapsed < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          { error: `Safety Cooldown Active: Please wait ${remaining} seconds before toggling power again.` },
          { status: 429 }
        );
      }

      // Check for active print jobs before powering off
      if (action === "off") {
        try {
          const { stdout: lpstatOut } = await execAsync("lpstat -o");
          if (lpstatOut.trim()) {
            return NextResponse.json(
              { error: "Power Off Rejected: There are active print jobs in the queue." },
              { status: 400 }
            );
          }
        } catch (lpstatErr) {
          console.error("Failed to query CUPS print queue during safety check:", lpstatErr);
        }
      }

      // Execute power command
      const powerState = action === "on" ? "1" : "0";
      console.log(`Executing safety USB power control: /usr/local/sbin/uhubctl -l ${config.location} -p ${config.port} -a ${powerState}`);
      await execAsync(`/usr/local/sbin/uhubctl -l ${config.location} -p ${config.port} -a ${powerState}`);
      
      lastTransitionTime = now;
      config.currentState = action;
      transitionMessage = `Port ${config.port} successfully powered ${action.toUpperCase()}.`;
    }

    await writeConfig(config);

    return NextResponse.json({
      success: true,
      message: transitionMessage || "Configuration updated successfully",
      config,
    });
  } catch (error) {
    console.error("USB power settings management error:", error);
    return NextResponse.json(
      { error: `Failed to update configuration: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
