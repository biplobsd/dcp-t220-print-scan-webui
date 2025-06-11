"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface PrinterStatus {
  status: "idle" | "printing" | "scanning" | "error" | "maintenance";
  message: string;
  progress: number;
  inkLevels: {
    black: number;
    cyan: number;
    magenta: number;
    yellow: number;
  };
  jobQueue: Array<{
    id: string;
    type: "print" | "scan";
    status: "pending" | "processing" | "completed" | "failed";
    fileName: string;
    progress: number;
  }>;
  printerState: string;
  printerStateReasons: string;
  isAcceptingJobs: boolean;
  printerName: string;
  printerInfo: string;
  printerLocation: string;
  printerModel: string;
  printerUpTime: number;
  printerMoreInfo: string;
  printerAlert: string;
  printerAlertDescription: string;
  mediaReady: string[];
  lastUpdated: string;
}

interface PrinterContextType {
  printerStatus: PrinterStatus;
  updateStatus: (status: Partial<PrinterStatus>) => void;
  addJob: (job: { type: "print" | "scan"; fileName: string }) => string;
  removeJob: (id: string) => void;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
    status: "idle",
    message: "Printer ready",
    progress: 0,
    inkLevels: {
      black: 85,
      cyan: 72,
      magenta: 68,
      yellow: 91,
    },
    jobQueue: [],
    printerState: "unknown",
    printerStateReasons: "none",
    isAcceptingJobs: true,
    printerName: "Loading...",
    printerInfo: "Loading printer information...",
    printerLocation: "",
    printerModel: "",
    printerUpTime: 0,
    printerMoreInfo: "",
    printerAlert: "",
    printerAlertDescription: "",
    mediaReady: [],
    lastUpdated: new Date().toISOString(),
  });

  const updateStatus = (status: Partial<PrinterStatus>) => {
    setPrinterStatus((prev) => ({ ...prev, ...status }));
  };

  const addJob = (job: { type: "print" | "scan"; fileName: string }) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newJob = {
      id,
      ...job,
      status: "pending" as const,
      progress: 0,
    };

    setPrinterStatus((prev) => ({
      ...prev,
      jobQueue: [...prev.jobQueue, newJob],
    }));

    return id;
  };

  const removeJob = (id: string) => {
    setPrinterStatus((prev) => ({
      ...prev,
      jobQueue: prev.jobQueue.filter((job) => job.id !== id),
    }));
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/status");
        if (response.ok) {
          const data = await response.json();
          updateStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch status:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <PrinterContext.Provider
      value={{ printerStatus, updateStatus, addJob, removeJob }}
    >
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error("usePrinter must be used within a PrinterProvider");
  }
  return context;
}
