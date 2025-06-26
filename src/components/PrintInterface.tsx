"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  Settings,
  Check,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { usePrinter } from "@/contexts/PrinterContextForPrint";
import FileUpload from "@/components/FileUpload";
import PdfPreview from "@/components/PdfPreview";
import { PDFDocument } from 'pdf-lib';

export default function PrintInterface() {
  const [printSettings, setPrintSettings] = useState({
    quality: "normal",
    color: "color",
    copies: 1,
    type: "document",
    mediaSize: "a4",
    orientation: "portrait",
    // PDF-specific options
    pageSelection: "all" as "all" | "odd" | "even" | "range",
    pageRange: "",
    reversePages: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedFile, setProcessedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [printResult, setPrintResult] = useState<{
    success?: boolean;
    message?: string;
    jobId?: string;
  } | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const { addJob, printerStatus, activeJobId, jobs } = usePrinter();

  useEffect(() => {
    if (selectedFile) {
      setPrintResult(null);
      setProcessedFile(null);
    }
  }, [selectedFile]);

  // Process PDF when page selection changes
  useEffect(() => {
    if (selectedFile && isPdfFile) {
      processPdfOnClient();
    }
  }, [selectedFile, printSettings.pageSelection, printSettings.pageRange, printSettings.reversePages]);

  const isPdfFile = selectedFile?.type === "application/pdf" || selectedFile?.name.toLowerCase().endsWith('.pdf');

  const parsePageRange = (range: string): number[] => {
    if (!range.trim()) return [];

    const pages: number[] = [];
    const parts = range.split(',').map(p => p.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(p => parseInt(p.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            if (i > 0) pages.push(i);
          }
        }
      } else {
        const page = parseInt(part);
        if (!isNaN(page) && page > 0) {
          pages.push(page);
        }
      }
    }

    return [...new Set(pages)].sort((a, b) => a - b);
  };

  const getPageIndices = async (pdfDoc: PDFDocument): Promise<number[]> => {
    const totalPageCount = pdfDoc.getPageCount();

    switch (printSettings.pageSelection) {
      case "all":
        return Array.from({ length: totalPageCount }, (_, i) => i);

      case "odd":
        return Array.from({ length: totalPageCount }, (_, i) => i)
          .filter(i => (i + 1) % 2 === 1);

      case "even":
        return Array.from({ length: totalPageCount }, (_, i) => i)
          .filter(i => (i + 1) % 2 === 0);

      case "range":
        const pageNumbers = parsePageRange(printSettings.pageRange);
        return pageNumbers
          .filter(pageNum => pageNum <= totalPageCount)
          .map(pageNum => pageNum - 1); // Convert to 0-based index

      default:
        return Array.from({ length: totalPageCount }, (_, i) => i);
    }
  };

  const processPdfOnClient = async () => {
    if (!selectedFile || !isPdfFile) {
      setProcessedFile(null);
      return;
    }

    // If it's "all" pages and no reverse, use original file
    if (printSettings.pageSelection === "all" && !printSettings.reversePages) {
      setProcessedFile(selectedFile);
      return;
    }

    if (printSettings.pageSelection === "range" && !validatePageRange(printSettings.pageRange)) {
      setProcessedFile(null);
      return;
    }

    try {
      setIsProcessingPdf(true);

      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      let pageIndices = await getPageIndices(pdfDoc);

      if (pageIndices.length === 0) {
        setProcessedFile(null);
        return;
      }

      // Apply reverse order if requested
      if (printSettings.reversePages) {
        pageIndices = pageIndices.reverse();
      }

      // Create a new PDF with the selected/ordered pages
      const newPdfDoc = await PDFDocument.create();

      // Copy pages to new document in the specified order
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach(page => newPdfDoc.addPage(page));

      // Generate the processed PDF
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const processedFileName = `processed_${selectedFile.name}`;
      const newFile = new File([blob], processedFileName, { type: 'application/pdf' });

      setProcessedFile(newFile);

    } catch (err) {
      console.error('Error processing PDF on client:', err);
      setProcessedFile(null);
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const validatePageRange = (range: string): boolean => {
    if (!range.trim()) return false;

    const parts = range.split(',').map(p => p.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(p => parseInt(p.trim()));
        if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
          return false;
        }
      } else {
        const page = parseInt(part);
        if (isNaN(page) || page < 1) {
          return false;
        }
      }
    }
    return true;
  };

  const handlePrint = async () => {
    if (!selectedFile) return;

    // Use processed file if available, otherwise use original file
    const fileToSend = (isPdfFile && processedFile) ? processedFile : selectedFile;

    setIsSubmitting(true);
    setPrintResult(null);

    try {
      const formData = new FormData();
      formData.append("file", fileToSend);

      // Remove PDF-specific settings since we're sending processed file
      const settingsToSend = {
        ...printSettings,
        pageSelection: "all", // Always "all" since we've already processed
        pageRange: ""
      };

      formData.append("settings", JSON.stringify(settingsToSend));

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

  const getPageSelectionDescription = () => {
    if (!isPdfFile || !selectedFile) return "";

    let baseDescription = "";
    switch (printSettings.pageSelection) {
      case "all":
        baseDescription = "All pages will be printed";
        break;
      case "odd":
        baseDescription = "Only odd pages will be printed";
        break;
      case "even":
        baseDescription = "Only even pages will be printed";
        break;
      case "range":
        if (printSettings.pageRange && validatePageRange(printSettings.pageRange)) {
          const pages = parsePageRange(printSettings.pageRange);
          baseDescription = `Pages ${pages.join(", ")} will be printed (${pages.length} page${pages.length !== 1 ? 's' : ''})`;
        } else {
          return "Enter a valid page range";
        }
        break;
      default:
        return "";
    }

    // Add reverse information if enabled
    if (printSettings.reversePages) {
      baseDescription += " in reverse order";
    }

    return baseDescription;
  };

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

          {/* PDF-specific options */}
          {isPdfFile && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Page Selection
              </label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "all", label: "All Pages" },
                    { value: "odd", label: "Odd Pages Only" },
                    { value: "even", label: "Even Pages Only" },
                    { value: "range", label: "Page Range" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setPrintSettings((prev) => ({
                          ...prev,
                          pageSelection: option.value as never,
                          pageRange: option.value !== "range" ? "" : prev.pageRange,
                        }))
                      }
                      className={`p-3 rounded-lg border-2 transition-all text-sm ${
                        printSettings.pageSelection === option.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {printSettings.pageSelection === "range" && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="e.g., 1, 3-5, 7"
                      value={printSettings.pageRange}
                      onChange={(e) =>
                        setPrintSettings((prev) => ({
                          ...prev,
                          pageRange: e.target.value,
                        }))
                      }
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500">
                      Enter page numbers separated by commas. Use ranges like `1-3` for consecutive pages.
                    </p>
                    {printSettings.pageRange && !validatePageRange(printSettings.pageRange) && (
                      <p className="text-xs text-red-500">
                        Invalid page range format. Use numbers, commas, and dashes only.
                      </p>
                    )}
                  </div>
                )}

                {/* Reverse Pages Option */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Reverse Page Order</label>
                    <p className="text-xs text-gray-500">Print pages in reverse order (last page first)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPrintSettings((prev) => ({
                        ...prev,
                        reversePages: !prev.reversePages,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      printSettings.reversePages
                        ? "bg-blue-600"
                        : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        printSettings.reversePages ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Processing indicator */}
                {isProcessingPdf && (
                  <div className="p-3 bg-blue-50 rounded-lg flex items-center space-x-2">
                    <Loader2 className="animate-spin text-blue-600" size={16} />
                    <span className="text-sm text-blue-700">Processing PDF pages...</span>
                  </div>
                )}

                {/* Page selection description */}
                {!isProcessingPdf && getPageSelectionDescription() && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">{getPageSelectionDescription()}</p>
                  </div>
                )}

                {/* Preview button - available when pages are processed or reverse is enabled */}
                {!isProcessingPdf && processedFile && (
                  printSettings.pageSelection !== "all" || printSettings.reversePages
                ) && (
                  <button
                    type="button"
                    onClick={() => setShowPdfPreview(true)}
                    className="w-full p-3 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center justify-center space-x-2"
                  >
                    <Eye size={16} />
                    <span>Preview Pages to Print</span>
                  </button>
                )}
              </div>
            </div>
          )}
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

      {/* PDF Preview Modal */}
      {showPdfPreview && processedFile && isPdfFile && (
        <PdfPreview
          file={processedFile}
          pageRange={printSettings.pageRange}
          pageSelection={printSettings.pageSelection}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </div>
  );
}
