"use client";

import { useState } from "react";
import { FileIcon } from "lucide-react";

interface ScanPreviewProps {
  previewUrl: string;
  format: string;
  pageNumber?: number;
}

export default function ScanPreview({
  previewUrl,
  format,
  pageNumber = 1,
}: ScanPreviewProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="aspect-[3/4] bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center overflow-hidden">
      {!imageError ? (
        <img
          src={previewUrl}
          alt={`Page ${pageNumber}`}
          className="object-contain w-full h-full"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-gray-500">
          <FileIcon size={48} className="mb-2" />
          <div className="text-center">
            <div className="font-medium">{format.toUpperCase()} Document</div>
            <div className="text-sm">Page {pageNumber}</div>
          </div>
        </div>
      )}
    </div>
  );
}
