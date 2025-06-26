"use client";

import { useState } from "react";
import { Scan, Download, Eye, Settings, Plus, Trash2 } from "lucide-react";
import { usePrinter } from "@/contexts/PrinterContext";
import ScanPreview from "./ScanPreview";
import { ScanSettings, ScanJob, ScanPage } from "@/types/scan";

export default function ScanInterface() {
  const [scanSettings, setScanSettings] = useState<ScanSettings>({
    format: "pdf",
    quality: "normal",
    color: "color",
    resolution: "300",
  });
  const [scannedPages, setScannedPages] = useState<ScanPage[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanEstimatedTime, setScanEstimatedTime] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isPreviewDownloading, setIsPreviewDownloading] = useState(false);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] =
    useState<ScanSettings["format"]>("pdf");
  const { addJob, printerStatus } = usePrinter();

  const handleScan = async () => {
    if (printerStatus.status !== "idle" || isScanning) return;

    setIsScanning(true);
    setScanProgress(0);

    // Estimate scanning time based on quality and color settings
    const getEstimatedTime = () => {
      let baseTime = 15; // Base 15 seconds for normal scan
      if (scanSettings.quality === "high") baseTime += 10;
      if (scanSettings.quality === "draft") baseTime -= 5;
      if (scanSettings.color === "color") baseTime += 5;
      return Math.max(baseTime, 8); // Minimum 8 seconds
    };

    setScanEstimatedTime(getEstimatedTime());

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scanSettings),
      });

      if (response.ok) {
        const scanResult = await response.json();

        if (scanResult.success) {
          addJob({
            type: "scan",
            fileName: `scan_${scanResult.jobId}.${scanSettings.format}`,
          });

          // Store the current format for this scan
          setSelectedFormat(scanSettings.format);

          // Start progress simulation
          const progressInterval = setInterval(() => {
            setScanProgress(prev => {
              if (prev >= 90) return prev; // Cap at 90% until actual completion
              return prev + Math.random() * 10;
            });
          }, 1000);

          // Poll for scan completion
          await pollScanStatus(scanResult.jobId, progressInterval);
        } else {
          console.error("Scan failed:", scanResult.error);
          setIsScanning(false);
          setScanProgress(0);
          setScanEstimatedTime(null);
        }
      } else {
        throw new Error("Failed to start scan");
      }
    } catch (error) {
      console.error("Scan failed:", error);
      setIsScanning(false);
      setScanProgress(0);
      setScanEstimatedTime(null);
    }
  };

  const pollScanStatus = async (jobId: string, progressInterval?: NodeJS.Timeout) => {
    try {
      const response = await fetch(`/api/scan/status?jobId=${jobId}`);

      if (response.ok) {
        const jobStatus: ScanJob = await response.json();

        if (jobStatus.status === "completed") {
          if (progressInterval) clearInterval(progressInterval);
          setScanProgress(100);

          // Set preview generating state
          setIsPreviewGenerating(jobId);

          const newPage: ScanPage = {
            id: jobStatus.jobId,
            preview: jobStatus.previewUrl,
            timestamp: new Date(jobStatus.timestamp),
          };

          setScannedPages((prev) => [...prev, newPage]);

          // Simulate preview generation delay
          setTimeout(() => {
            setIsPreviewGenerating(null);
            setIsScanning(false);
            setScanProgress(0);
            setScanEstimatedTime(null);
          }, 1500);
        } else {
          setTimeout(() => pollScanStatus(jobId, progressInterval), 1000);
        }
      } else {
        throw new Error("Failed to get scan status");
      }
    } catch (error) {
      console.error("Status polling failed:", error);
      if (progressInterval) clearInterval(progressInterval);
      setIsScanning(false);
      setScanProgress(0);
      setScanEstimatedTime(null);
      setIsPreviewGenerating(null);
    }
  };

  const handleDownload = async () => {
    if (scannedPages.length === 0 || isDownloading) return;

    setIsDownloading(true);

    try {
      const response = await fetch("/api/scan/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageIds: scannedPages.map((page) => page.id),
          format: scanSettings.format,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const timestamp = new Date().toISOString().split("T")[0];
        let filename;
        if (blob.type === "application/zip") {
          filename = `scans_${timestamp}.zip`;
        } else if (scannedPages.length > 1) {
          filename = `combined_scan_${timestamp}.${scanSettings.format}`;
        } else {
          filename = `scan_${timestamp}.${scanSettings.format}`;
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreview = (previewUrl: string) => {
    setSelectedPreview(previewUrl);
  };

  const handleDownloadPreview = async () => {
    if (!selectedPreview || isPreviewDownloading) return;

    setIsPreviewDownloading(true);

    try {
      const a = document.createElement("a");
      a.href = selectedPreview;
      a.download = `preview_${new Date().toISOString().split("T")[0]}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Preview download failed:", error);
    } finally {
      setIsPreviewDownloading(false);
    }
  };

  const handleRemovePage = (pageId: string) => {
    setScannedPages((prev) => prev.filter((page) => page.id !== pageId));
  };

  const formatOptions = [
    { value: "pdf" as const, label: "PDF", description: "Multi-page document" },
    { value: "jpg" as const, label: "JPEG", description: "Image format" },
    { value: "png" as const, label: "PNG", description: "High-quality image" },
  ];

  const qualityOptions = [
    { value: "draft" as const, label: "Draft (150 DPI)" },
    { value: "normal" as const, label: "Normal (300 DPI)" },
    { value: "high" as const, label: "High (600 DPI)" },
  ];

  const colorOptions = [
    { value: "color" as const, label: "Color" },
    { value: "grayscale" as const, label: "Grayscale" },
    { value: "bw" as const, label: "B&W" },
  ];

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="pt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Scan Document</h1>
        <p className="text-gray-600">Scan documents to digital format</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center mb-4">
          <Settings className="text-gray-600 mr-2" size={20} />
          <h2 className="text-lg font-semibold text-gray-900">Scan Settings</h2>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Output Format
          </label>
          <div className="space-y-2">
            {formatOptions.map((option) => (
              <button
                key={option.value}
                onClick={() =>
                  setScanSettings((prev) => ({ ...prev, format: option.value }))
                }
                className={`w-full p-3 text-left rounded-lg border transition-all ${
                  scanSettings.format === option.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-800"
                }`}
              >
                <div className="font-medium">{option.label}</div>
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
          <div className="grid grid-cols-3 gap-2">
            {colorOptions.map((mode) => (
              <button
                key={mode.value}
                onClick={() =>
                  setScanSettings((prev) => ({ ...prev, color: mode.value }))
                }
                className={`p-3 rounded-lg border-2 text-sm transition-all ${
                  scanSettings.color === mode.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-800"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Quality
          </label>
          <select
            value={scanSettings.quality}
            onChange={(e) => {
              const quality = e.target.value as ScanSettings["quality"];
              setScanSettings((prev) => ({ ...prev, quality }));
            }}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
          >
            {qualityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleScan}
        disabled={isScanning || printerStatus.status !== "idle"}
        className={`w-full py-4 rounded-xl font-semibold text-white transition-all mb-6 ${
          !isScanning && printerStatus.status === "idle"
            ? "bg-green-600 hover:bg-green-700 active:scale-[0.98]"
            : "bg-gray-400 cursor-not-allowed"
        }`}
      >
        <div className="flex items-center justify-center">
          {isScanning ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {isPreviewGenerating ? "Generating Preview..." : "Scanning..."}
            </>
          ) : (
            <>
              <Scan className="mr-2" size={20} />
              Start Scan
            </>
          )}
        </div>
      </button>

      {/* Scanning Progress Indicator */}
      {isScanning && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {isPreviewGenerating ? "Generating Preview" : "Scanning Document"}
              </h3>
              <span className="text-sm text-gray-600">
                {Math.round(scanProgress)}%
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-sm text-gray-600">
              <span>
                {isPreviewGenerating
                  ? "Processing scan data..."
                  : `Scanning at ${scanSettings.quality} quality (${scanSettings.color})`
                }
              </span>
              {scanEstimatedTime && !isPreviewGenerating && (
                <span>
                  Est. {scanEstimatedTime}s
                </span>
              )}
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center text-sm text-gray-500">
              <div className="animate-pulse mr-2">●</div>
              {isPreviewGenerating
                ? "Almost done! Creating preview image..."
                : "Please keep the document steady on the scanner bed"
              }
            </div>
          </div>
        </div>
      )}

      {scannedPages.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Scanned Pages ({scannedPages.length})
            </h2>
            <button
              onClick={() => setScannedPages([])}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {scannedPages.map((page, index) => (
              <div key={page.id} className="relative">
                <ScanPreview
                  previewUrl={page.preview}
                  format={selectedFormat}
                  pageNumber={index + 1}
                  isGenerating={isPreviewGenerating === page.id}
                />
                {/* Show generating overlay for the specific page */}
                {isPreviewGenerating === page.id && (
                  <div className="absolute inset-0 bg-white bg-opacity-90 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <div className="text-xs text-gray-600">Creating preview...</div>
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex space-x-1">
                  <button
                    onClick={() => handlePreview(page.preview)}
                    disabled={isPreviewGenerating === page.id}
                    className={`p-1 bg-white rounded-full shadow-md transition-colors ${
                      isPreviewGenerating === page.id 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-gray-100"
                    }`}
                    title="Preview"
                  >
                    <Eye size={16} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleRemovePage(page.id)}
                    disabled={isPreviewGenerating === page.id}
                    className={`p-1 bg-white rounded-full shadow-md transition-colors ${
                      isPreviewGenerating === page.id 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-gray-100"
                    }`}
                    title="Remove"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleScan}
              disabled={isScanning || printerStatus.status !== "idle"}
              className={`w-full py-3 border border-gray-300 rounded-lg transition-colors flex items-center justify-center ${
                !isScanning && printerStatus.status === "idle"
                  ? "text-gray-700 hover:bg-gray-50"
                  : "text-gray-400 cursor-not-allowed"
              }`}
            >
              <Plus className="mr-2" size={20} />
              Scan Another Page
            </button>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              {isDownloading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {scannedPages.length > 1
                    ? scanSettings.format === "pdf"
                      ? "Combining PDFs..."
                      : "Creating ZIP..."
                    : "Downloading..."}
                </>
              ) : (
                <>
                  <Download className="mr-2" size={20} />
                  {scannedPages.length > 1
                    ? scanSettings.format === "pdf"
                      ? "Download Combined PDF"
                      : "Download as ZIP"
                    : `Download ${scanSettings.format.toUpperCase()}`}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {selectedPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Scan Preview
              </h3>
              <button
                onClick={() => setSelectedPreview(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-gray-100">
              <img
                src={selectedPreview}
                alt="Scan preview"
                className="max-w-full max-h-[70vh] object-contain mx-auto bg-white shadow-sm"
                onError={(e) => {
                  // If image fails to load, show a message
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src =
                    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xMyAySDZ2OGg1djJIOVYxMkg1di0yaC0ydjRoNnYySDR2MmgydjJoMnYtMmgxdjJoMnYtNGg2di00aC00VjhINWMwIDAgMC0yIDItMmgxME0xNSA2SDlNOSA0aDE2djE2SDl2MmgxOFYySDl2MnoiLz48L3N2Zz4=";
                  target.style.padding = "2rem";
                }}
              />
            </div>
            <div className="p-4 border-t flex space-x-2">
              <button
                onClick={handleDownloadPreview}
                disabled={isPreviewDownloading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                {isPreviewDownloading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2" size={16} />
                    Download Preview
                  </>
                )}
              </button>
              <button
                onClick={() => setSelectedPreview(null)}
                className="flex-1 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
