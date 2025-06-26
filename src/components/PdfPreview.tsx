"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";

interface PdfPreviewProps {
  file: File;
  pageRange: string;
  pageSelection: "all" | "odd" | "even" | "range";
  onClose: () => void;
}

export default function PdfPreview({ file, pageRange, pageSelection, onClose }: PdfPreviewProps) {
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string>("");

  useEffect(() => {
    // Since we're receiving the already processed PDF file, just create a URL for it
    const url = URL.createObjectURL(file);
    setPreviewPdfUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const downloadPreview = () => {
    if (previewPdfUrl) {
      const link = document.createElement('a');
      link.href = previewPdfUrl;
      link.download = `preview_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getPageSelectionText = () => {
    switch (pageSelection) {
      case "all":
        return "All pages";
      case "odd":
        return "Odd pages only";
      case "even":
        return "Even pages only";
      case "range":
        return `Page range: ${pageRange}`;
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-black">PDF Preview - Pages to Print</h3>
          <div className="flex items-center space-x-2">
            {previewPdfUrl && (
              <button
                onClick={downloadPreview}
                className="p-2 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50"
                title="Download preview PDF"
              >
                <Download size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="font-medium text-blue-900 mb-1">Preview Settings:</div>
              <div>{getPageSelectionText()}</div>
              <div className="mt-1">This preview shows exactly what will be printed</div>
            </div>

            {previewPdfUrl && (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={previewPdfUrl}
                  className="w-full h-96"
                  title="PDF Preview"
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-between items-center">
          <div className="text-sm text-gray-500">
            This preview contains only the selected pages
          </div>
          <div className="flex space-x-2">
            {previewPdfUrl && (
              <button
                onClick={downloadPreview}
                className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg flex items-center space-x-1"
              >
                <Download size={16} />
                <span>Download Preview</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
