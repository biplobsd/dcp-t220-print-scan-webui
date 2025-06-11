"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface PrintJob {
  id?: string;
  type: "print" | "scan";
  fileName: string;
  status:
    | "pending"
    | "processing"
    | "completed"
    | "canceled"
    | "aborted"
    | "unknown";
  timestamp: string;
  error?: string;
}

interface PrinterStatus {
  status: "idle" | "printing" | "error" | "disconnected";
  message?: string;
}

interface PrinterContextType {
  jobs: PrintJob[];
  printerStatus: PrinterStatus;
  activeJobId: string | null;
  addJob: (
    job: Omit<PrintJob, "status" | "timestamp"> & { id?: string },
  ) => void;
  updateJobStatus: (
    jobId: string,
    status: PrintJob["status"],
    error?: string,
  ) => void;
  clearJobs: () => void;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
    status: "idle",
  });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeJobId) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/print/status?jobId=${activeJobId}`);
        const data = await response.json();

        if (response.ok) {
          const jobStatus = data.status as PrintJob["status"];
          updateJobStatus(activeJobId, jobStatus, data.error);

          if (
            ["completed", "canceled", "aborted", "unknown"].includes(jobStatus)
          ) {
            setActiveJobId(null);
            setPrinterStatus({
              status: jobStatus === "completed" ? "idle" : "error",
              message:
                jobStatus === "completed"
                  ? "Print completed successfully"
                  : data.message || "There was an issue with the print job",
            });

            if (jobStatus === "completed") {
              setTimeout(() => {
                setPrinterStatus({ status: "idle" });
              }, 5000);
            }
          }
        } else {
          console.error("Error checking job status:", data.error);
          updateJobStatus(activeJobId, "unknown", data.error);
        }
      } catch (error) {
        console.error("Failed to check job status:", error);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [activeJobId]);

  useEffect(() => {
    if (activeJobId) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch("/api/print/status");
        const data = await response.json();

        if (response.ok && data.status !== printerStatus.status) {
          setPrinterStatus({
            status: data.status,
            message: data.message,
          });
        }
      } catch (error) {
        console.log("Failed to check printer status:", error);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeJobId, printerStatus.status]);

  const addJob = (
    job: Omit<PrintJob, "status" | "timestamp"> & { id?: string },
  ) => {
    const newJob: PrintJob = {
      ...job,
      status: "pending",
      timestamp: new Date().toISOString(),
    };

    setJobs((prev) => [newJob, ...prev]);
    setPrinterStatus({
      status: "printing",
      message: `Printing ${job.fileName}`,
    });

    if (job.id) {
      setActiveJobId(job.id);
    }
  };

  const updateJobStatus = (
    jobId: string,
    status: PrintJob["status"],
    error?: string,
  ) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id === jobId) {
          return { ...job, status, error };
        }
        return job;
      }),
    );

    if (status === "unknown" || status === "aborted") {
      setPrinterStatus({
        status: "error",
        message: error || "An error occurred during printing",
      });
    }
  };

  const clearJobs = () => {
    setJobs([]);
  };

  return (
    <PrinterContext.Provider
      value={{
        jobs,
        printerStatus,
        activeJobId,
        addJob,
        updateJobStatus,
        clearJobs,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (context === undefined) {
    throw new Error("usePrinter must be used within a PrinterProvider");
  }
  return context;
}
