"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  Settings,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { usePrinter } from "@/contexts/PrinterContextForPrint";
import FileUpload from "@/components/FileUpload";

export default function PrintInterface() {
  const [printSettings, setPrintSettings] = useState({
    quality: "normal",
    color: "color",
    copies: 1,
    type: "document",
    mediaSize: "a4",
    orientation: "portrait",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printResult, setPrintResult] = useState<{
    success?: boolean;
    message?: string;
    jobId?: string;
  } | null>(null);

  const { addJob, printerStatus, activeJobId, jobs } = usePrinter();

  useEffect(() => {
    if (selectedFile) {
      setPrintResult(null);
    }
  }, [selectedFile]);

  const handlePrint = async () => {
    if (!selectedFile) return;
    setIsSubmitting(true);
    setPrintResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("settings", JSON.stringify(printSettings));

      const response = await fetch("/api/print", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setPrintResult({
          success: true,
          message: result.message,
          jobId: result.jobId,
        });

        // Add to job queue
        addJob({
          id: result.jobId,
          type: "print",
          fileName: selectedFile.name,
        });
      } else {
        setPrintResult({
          success: false,
          message: result.error || "Failed to submit print job",
        });
      }
    } catch (error) {
      console.error("Print failed:", error);
      setPrintResult({
        success: false,
        message: "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActiveJob = () => {
    if (!activeJobId) return null;
    return jobs.find((job) => job.id === activeJobId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "printing":
      case "pending":
      case "processing":
        return "text-blue-600";
      case "completed":
        return "text-green-600";
      case "error":
      case "canceled":
      case "aborted":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const qualityOptions = [
    { value: "draft", label: "Draft", description: "Fast, basic quality" },
    {
      value: "normal",
      label: "Normal",
      description: "Balanced speed and quality",
    },
    { value: "high", label: "High", description: "Best quality, slower" },
  ];

  const mediaSizeOptions = [
    { value: "a4", label: "A4" },
    { value: "letter", label: "Letter" },
    { value: "legal", label: "Legal" },
    { value: "a5", label: "A5" },
    { value: "photo4x6", label: "Photo 4×6" },
    { value: "photo5x7", label: "Photo 5×7" },
  ];

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="pt-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Print Document
        </h1>
        <p className="text-gray-600">Upload files or take photos to print</p>
      </div>

      {printerStatus.status !== "idle" && (
        <div
          className={`mb-6 p-4 rounded-lg text-sm ${
            printerStatus.status === "printing"
              ? "bg-blue-50 text-blue-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center">
            {printerStatus.status === "printing" ? (
              <Loader2 className="animate-spin mr-2" size={18} />
            ) : (
              <AlertCircle className="mr-2" size={18} />
            )}
            <div>
              <p className="font-medium">
                {printerStatus.status === "printing"
                  ? "Printing in progress"
                  : "Printer error"}
              </p>
              <p>{printerStatus.message || "Please wait..."}</p>
              {getActiveJob() && (
                <p className="mt-1">
                  Job: {getActiveJob()?.fileName} -
                  <span
                    className={getStatusColor(getActiveJob()?.status || "")}
                  >
                    {getActiveJob()?.status}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Select File
        </h2>
        <FileUpload
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
          accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp"
        />
      </div>

      {selectedFile && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center mb-4">
            <Settings className="text-gray-600 mr-2" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">
              Print Settings
            </h2>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Document Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "document", label: "Document", icon: FileText },
                { value: "photo", label: "Photo", icon: ImageIcon },
              ].map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        type: type.value,
                      }))
                    }
                    className={`p-3 rounded-lg border-2 transition-all ${
                      printSettings.type === type.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <Icon className="mx-auto mb-2" size={20} />
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Paper Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {mediaSizeOptions.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() =>
                    setPrintSettings((prev) => ({
                      ...prev,
                      mediaSize: size.value,
                    }))
                  }
                  className={`p-2 rounded-lg border-2 transition-all ${
                    printSettings.mediaSize === size.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <span className="text-sm font-medium">{size.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Orientation
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "portrait", label: "Portrait" },
                { value: "landscape", label: "Landscape" },
              ].map((orientation) => (
                <button
                  key={orientation.value}
                  type="button"
                  onClick={() =>
                    setPrintSettings((prev) => ({
                      ...prev,
                      orientation: orientation.value,
                    }))
                  }
                  className={`p-3 rounded-lg border-2 transition-all ${
                    printSettings.orientation === orientation.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {orientation.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Print Quality
            </label>
            <div className="space-y-2">
              {qualityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setPrintSettings((prev) => ({
                      ...prev,
                      quality: option.value,
                    }))
                  }
                  className={`w-full p-3 text-left rounded-lg border transition-all ${
                    printSettings.quality === option.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-gray-900">
                    {option.label}
                  </div>
                  <div className="text-sm text-gray-600">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Color Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "color", label: "Color" },
                { value: "bw", label: "Black & White" },
              ].map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() =>
                    setPrintSettings((prev) => ({ ...prev, color: mode.value }))
                  }
                  className={`p-3 rounded-lg border-2 transition-all ${
                    printSettings.color === mode.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <span className="text-sm font-medium">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Number of Copies
            </label>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() =>
                  setPrintSettings((prev) => ({
                    ...prev,
                    copies: Math.max(1, prev.copies - 1),
                  }))
                }
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-700"
              >
                -
              </button>
              <span className="text-lg font-semibold min-w-[3rem] text-center text-gray-900">
                {printSettings.copies}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPrintSettings((prev) => ({
                    ...prev,
                    copies: Math.min(99, prev.copies + 1),
                  }))
                }
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-700"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFile && (
        <>
          {printResult && (
            <div
              className={`mb-4 p-4 rounded-lg text-sm ${
                printResult.success
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              <div className="flex items-center">
                {printResult.success ? (
                  <Check className="mr-2" size={18} />
                ) : (
                  <AlertCircle className="mr-2" size={18} />
                )}
                <span>{printResult.message}</span>
              </div>
              {printResult.jobId && (
                <div className="mt-1 ml-6">Job ID: {printResult.jobId}</div>
              )}
            </div>
          )}

          <button
            onClick={handlePrint}
            disabled={isSubmitting || printerStatus.status !== "idle"}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
              isSubmitting
                ? "bg-blue-400 cursor-not-allowed"
                : printerStatus.status !== "idle"
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin mr-2" size={20} />
                <span>Sending print job...</span>
              </div>
            ) : printerStatus.status !== "idle" ? (
              "Printer Busy"
            ) : (
              "Start Printing"
            )}
          </button>
        </>
      )}
    </div>
  );
}
