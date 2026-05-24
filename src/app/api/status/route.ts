import { NextResponse } from "next/server";
import {
  GetPrinterAttributesRequest,
  Printer,
  PrinterDescription,
  RequestedPrinterAttributeGroups,
} from "ipp";
import { env } from "@/env";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);
const CONFIG_PATH = path.join(process.cwd(), "usb-power.json");

// Singleton USB Power Manager for safety and efficiency
class UsbPowerManager {
  private static instance: UsbPowerManager;
  private lastActiveTime = Date.now();
  private wakingUpUntil = 0;
  private lastTransitionTime = 0;
  private isChecking = false;

  private constructor() {
    if (typeof window === "undefined") {
      // Background idle check loop every 30 seconds
      setInterval(() => this.checkIdleTimeout(), 30000);
      console.log("[USB Power Manager] Background idle check loop started.");
    }
  }

  public static getInstance(): UsbPowerManager {
    if (!UsbPowerManager.instance) {
      UsbPowerManager.instance = new UsbPowerManager();
    }
    return UsbPowerManager.instance;
  }

  public async tick() {
    this.lastActiveTime = Date.now();
    
    try {
      const config = await this.readConfig();
      if (config.enabled) {
        const actualState = await this.getActualState(config.location, config.port);
        if (actualState === "off" && Date.now() > this.wakingUpUntil) {
          console.log(`[USB Power Manager] Auto-waking port ${config.port} on location ${config.location}...`);
          
          const elapsed = Date.now() - this.lastTransitionTime;
          if (elapsed < 60000) {
            console.warn("[USB Power Manager] Auto-wake ignored due to safety cooldown.");
            return;
          }

          await execAsync(`sudo /home/pi/uhubctl/uhubctl -l ${config.location} -p ${config.port} -a 1`);
          this.lastTransitionTime = Date.now();
          this.wakingUpUntil = Date.now() + 5000; // Allow 5 seconds for printer to boot up
          console.log("[USB Power Manager] Port powered ON successfully.");
        }
      }
    } catch (err) {
      console.error("[USB Power Manager] Error during tick:", err);
    }
  }

  public isWakingUp(): boolean {
    return Date.now() < this.wakingUpUntil;
  }

  private async checkIdleTimeout() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const config = await this.readConfig();
      if (!config.enabled) {
        this.isChecking = false;
        return;
      }

      const idleTimeoutMs = config.idleTimeout * 60 * 1000;
      const elapsed = Date.now() - this.lastActiveTime;

      if (elapsed > idleTimeoutMs) {
        const actualState = await this.getActualState(config.location, config.port);
        if (actualState === "on") {
          // Double check active CUPS jobs before powering off
          const { stdout: lpstatOut } = await execAsync("lpstat -o");
          if (lpstatOut.trim()) {
            console.log("[USB Power Manager] Idle timeout reached, but power-off deferred because CUPS has active print jobs.");
            this.isChecking = false;
            return;
          }

          const cooldownElapsed = Date.now() - this.lastTransitionTime;
          if (cooldownElapsed < 60000) {
            this.isChecking = false;
            return;
          }

          console.log(`[USB Power Manager] Idle timeout reached (${config.idleTimeout} mins). Powering OFF port ${config.port}...`);
          await execAsync(`sudo /home/pi/uhubctl/uhubctl -l ${config.location} -p ${config.port} -a 0`);
          this.lastTransitionTime = Date.now();
          console.log("[USB Power Manager] Port powered OFF successfully.");
        }
      }
    } catch (err) {
      console.error("[USB Power Manager] Error in idle check:", err);
    } finally {
      this.isChecking = false;
    }
  }

  private async readConfig() {
    try {
      const data = await fs.readFile(CONFIG_PATH, "utf-8");
      return JSON.parse(data);
    } catch {
      return { enabled: false, location: "1-1", port: "3", idleTimeout: 10 };
    }
  }

  private async getActualState(location: string, port: string): Promise<"on" | "off"> {
    try {
      const { stdout } = await execAsync(`sudo /home/pi/uhubctl/uhubctl -l ${location} -p ${port}`);
      const portLine = stdout.split("\n").find((line) => line.includes(`Port ${port}:`));
      if (portLine && portLine.toLowerCase().includes("off")) {
        return "off";
      }
      return "on";
    } catch {
      return "on";
    }
  }
}

async function getCupsJobs() {
  try {
    const { stdout } = await execAsync("lpstat -o");
    if (!stdout.trim()) return [];

    let activeJobId = "";
    try {
      const { stdout: pStdout } = await execAsync("lpstat -p");
      const match = pStdout.match(/now printing ([^\s\.]+)/);
      if (match) {
        activeJobId = match[1];
      }
    } catch {}

    return stdout
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const tokens = line.trim().split(/\s+/);
        if (tokens.length < 3) return null;
        const id = tokens[0];
        const bytes = parseInt(tokens[2], 10);
        const sizeFormatted = isNaN(bytes) ? "" : ` (${(bytes / 1024).toFixed(1)} KB)`;

        return {
          id,
          type: "print" as const,
          status: id === activeJobId ? ("processing" as const) : ("pending" as const),
          fileName: `${id}${sizeFormatted}`,
          progress: id === activeJobId ? 50 : 0,
        };
      })
      .filter((job): job is NonNullable<typeof job> => job !== null);
  } catch (error) {
    console.error("Failed to query CUPS jobs:", error);
    return [];
  }
}

interface CupsJob {
  id: string;
  type: "print";
  status: "pending" | "processing";
  fileName: string;
  progress: number;
}

async function getPrinterStatus(cupsJobs: CupsJob[]) {
  return new Promise((resolve, reject) => {
    try {
      const ippUrl = env.PRINTER_IPP;

      const msg: GetPrinterAttributesRequest = {
        "operation-attributes-tag": {
          "attributes-charset": "utf-8",
          "attributes-natural-language": "en",
          "printer-uri": ippUrl,
          "requesting-user-name": "nextjs-app",
          "requested-attributes": [
            "marker-levels",
            "marker-names",
            "queued-job-count",
            "printer-state",
            "printer-state-reasons",
            "printer-is-accepting-jobs",
            "printer-name",
            "printer-info",
            "printer-alert",
            "printer-alert-description",
            "printer-up-time",
            "printer-location",
            "printer-make-and-model",
            "printer-more-info",
            "media-ready",
          ] as
            | Array<RequestedPrinterAttributeGroups | keyof PrinterDescription>
            | undefined,
        },
      };

      const printer = new Printer(ippUrl);

      printer.execute("Get-Printer-Attributes", msg, (err, res) => {
        if (err) {
          return reject(err);
        }

        const printerAttrs = res["printer-attributes-tag"] as {
          "marker-levels": Array<number>;
          "marker-names": Array<string>;
          "queued-job-count": number;
          "printer-state": string;
          "printer-state-reasons": string;
          "printer-is-accepting-jobs": boolean;
          "printer-name": string;
          "printer-info": string;
          "printer-alert": string;
          "printer-alert-description": string;
          "printer-up-time": number;
          "printer-location": string;
          "printer-make-and-model": string;
          "printer-more-info": string;
          "media-ready": string;
        };

        const markerLevels = printerAttrs["marker-levels"] || [-2, -2, -2, -2];
        const markerNames = printerAttrs["marker-names"] || [
          "M",
          "C",
          "Y",
          "BK",
        ];

        const getInkLevel = (level: number) => {
          if (level === -2 || level === -3) return 0; // Unknown level
          return Math.max(0, Math.min(100, level)); // Clamp between 0-100
        };

        const inkLevels = {
          black: getInkLevel(
            markerLevels[markerNames.indexOf("BK")] || markerLevels[3],
          ),
          cyan: getInkLevel(
            markerLevels[markerNames.indexOf("C")] || markerLevels[1],
          ),
          magenta: getInkLevel(
            markerLevels[markerNames.indexOf("M")] || markerLevels[0],
          ),
          yellow: getInkLevel(
            markerLevels[markerNames.indexOf("Y")] || markerLevels[2],
          ),
        };

        const printerState = printerAttrs["printer-state"];
        const printerStateReasons = printerAttrs["printer-state-reasons"];

        let progress = 0;
        if (printerState === "processing") {
          progress = 50;
        } else if (printerState === "idle" && cupsJobs.length === 0) {
          progress = 0;
        }

        let printerStatus = "idle";
        if (printerState === "processing") {
          printerStatus = "printing";
        } else if (printerState === "stopped") {
          printerStatus = "error";
        }

        const alertDescription =
          printerAttrs["printer-alert-description"] || "";
        if (alertDescription.toLowerCase().includes("cleaning")) {
          printerStatus = "maintenance";
        }

        const mediaReady = [printerAttrs["media-ready"]];

        const status = {
          progress,
          inkLevels,
          jobQueue: cupsJobs,
          status: printerStatus,
          message:
            alertDescription ||
            (printerStateReasons !== "none"
              ? printerStateReasons
              : "Printer ready"),
          printerState: printerState || "unknown",
          printerStateReasons: printerStateReasons || "none",
          isAcceptingJobs: printerAttrs["printer-is-accepting-jobs"] || false,
          printerName: printerAttrs["printer-name"] || "Unknown",
          printerInfo: printerAttrs["printer-info"] || "Unknown Printer",
          printerLocation: printerAttrs["printer-location"] || "",
          printerModel: printerAttrs["printer-make-and-model"] || "",
          printerUpTime: printerAttrs["printer-up-time"] || 0,
          printerMoreInfo: printerAttrs["printer-more-info"] || "",
          printerAlert: printerAttrs["printer-alert"] || "",
          printerAlertDescription: alertDescription,
          mediaReady: mediaReady,
          lastUpdated: new Date().toISOString(),
        };

        resolve(status);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function GET() {
  const powerManager = UsbPowerManager.getInstance();
  await powerManager.tick();

  if (powerManager.isWakingUp()) {
    return NextResponse.json({
      status: "maintenance",
      message: "USB Hub waking up...",
      progress: 50,
      inkLevels: { black: 0, cyan: 0, magenta: 0, yellow: 0 },
      jobQueue: [],
      printerState: "unknown",
      printerStateReasons: "waking",
      isAcceptingJobs: false,
      printerName: "Waking...",
      printerInfo: "Waking USB Hub...",
      printerLocation: "",
      printerModel: "",
      printerUpTime: 0,
      printerMoreInfo: "",
      printerAlert: "",
      printerAlertDescription: "Powering ON the USB Hub. Please wait.",
      mediaReady: [],
      lastUpdated: new Date().toISOString(),
    });
  }

  const cupsJobs = await getCupsJobs();
  try {
    const printerStatus = await getPrinterStatus(cupsJobs);
    return NextResponse.json(printerStatus);
  } catch (error) {
    const err = error as { code?: string; message?: string };
    const isConnRefused = err && err.code === "ECONNREFUSED";
    if (isConnRefused) {
      console.warn(`[Printer Status] Printer is offline (Connection refused at ${env.PRINTER_IPP})`);
    } else {
      console.error("Error getting printer status:", error);
    }
    return NextResponse.json({
      status: "error",
      message: isConnRefused
        ? "Printer offline"
        : `Failed to communicate with printer: ${err?.message || String(error)}`,
      progress: 0,
      inkLevels: { black: 0, cyan: 0, magenta: 0, yellow: 0 },
      jobQueue: cupsJobs,
      printerState: "unknown",
      printerStateReasons: "error",
      isAcceptingJobs: false,
      printerName: "Unknown",
      printerInfo: "Unknown Printer",
      printerLocation: "",
      printerModel: "",
      printerUpTime: 0,
      printerMoreInfo: "",
      printerAlert: "",
      printerAlertDescription: "",
      mediaReady: [],
      lastUpdated: new Date().toISOString(),
    });
  }
}
