"use client";

import { useState } from "react";
import { FileIcon } from "lucide-react";

interface ScanPreviewProps {
  previewUrl: string;
  format: string;
  pageNumber?: number;
  isGenerating?: boolean;
}

export default function ScanPreview({
  previewUrl,
  format,
  pageNumber = 1,
  isGenerating = false,
}: ScanPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  if (isGenerating) {
    return (
      <div className="aspect-[3/4] bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center justify-center p-4 text-gray-500">
          <div className="relative mb-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <div className="text-center">
            <div className="font-medium text-sm">Generating Preview</div>
            <div className="text-xs animate-pulse">
              Processing page {pageNumber}...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-[3/4] bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center overflow-hidden relative">
      {imageLoading && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="flex flex-col items-center justify-center p-4 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
            <div className="text-xs">Loading preview...</div>
          </div>
        </div>
      )}

      {!imageError ? (
        <img
          src={previewUrl}
          alt={`Page ${pageNumber}`}
          className="object-contain w-full h-full"
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
          style={{ opacity: imageLoading ? 0 : 1 }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-gray-500">
          <FileIcon size={48} className="mb-2" />
          <div className="text-center">
            <div className="font-medium">{format.toUpperCase()} Document</div>
            <div className="text-sm">Page {pageNumber}</div>
            <div className="text-xs text-red-500 mt-1">Preview unavailable</div>
          </div>
        </div>
      )}
    </div>
  );
}
