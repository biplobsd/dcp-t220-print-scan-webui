import { NextResponse } from "next/server";
import {
  GetPrinterAttributesRequest,
  Printer,
  PrinterDescription,
  RequestedPrinterAttributeGroups,
} from "ipp";
import { env } from "@/env";

async function getPrinterStatus() {
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
          console.error("Error communicating with printer:", err);
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

        const queuedJobCount = printerAttrs["queued-job-count"] || 0;

        const jobQueue = Array(queuedJobCount)
          .fill(null)
          .map((_, i) => ({
            id: i + 1,
            name: `Job ${i + 1}`,
          }));

        const printerState = printerAttrs["printer-state"];
        const printerStateReasons = printerAttrs["printer-state-reasons"];

        let progress = 0;
        if (printerState === "processing") {
          progress = 50;
        } else if (printerState === "idle" && queuedJobCount === 0) {
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
          jobQueue,
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
  try {
    const printerStatus = await getPrinterStatus();
    return NextResponse.json(printerStatus);
  } catch (error) {
    console.error("Error getting printer status:", error);
    return NextResponse.json({
      status: "error",
      message: `Failed to communicate with printer: ${error}`,
      progress: 0,
      inkLevels: { black: 0, cyan: 0, magenta: 0, yellow: 0 },
      jobQueue: [],
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
