"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { File, X } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  accept: string;
}

export default function FileUpload({
  onFileSelect,
  selectedFile,
  accept,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(",").reduce(
      (acc, curr) => {
        // Convert from comma-separated string to object format expected by react-dropzone
        acc[curr] = [];
        return acc;
      },
      {} as Record<string, string[]>,
    ),
    maxFiles: 1,
    multiple: false,
  });

  const removeFile = () => {
    onFileSelect(null);
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center">
            <File className="text-gray-400 mb-2" size={36} />
            <p className="text-sm font-medium text-gray-900 mb-1">
              {isDragActive
                ? "Drop the file here"
                : "Drag and drop your file here"}
            </p>
            <p className="text-xs text-gray-500">
              or <span className="text-blue-600">browse</span> to upload
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Supported: PDF, JPG, PNG, GIF, BMP
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-center">
            <File className="text-gray-500 mr-3" size={24} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={removeFile}
              className="p-1 rounded-full hover:bg-gray-100"
              aria-label="Remove file"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
