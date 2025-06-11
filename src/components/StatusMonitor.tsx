"use client";

import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { usePrinter } from "@/contexts/PrinterContext";
import StatusIndicator from "@/components/StatusIndicator";

export default function StatusMonitor() {
  const { printerStatus } = usePrinter();

  const getJobIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="text-green-500" size={20} />;
      case "failed":
        return <XCircle className="text-red-500" size={20} />;
      case "processing":
        return <Clock className="text-blue-500 animate-spin" size={20} />;
      default:
        return <Clock className="text-gray-400" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "processing":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatLastUpdated = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString();
    } catch (e) {
      console.log("Error parsing date: ", e);
      return "Unknown";
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="pt-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Printer Status
        </h1>
        <p className="text-gray-600">Monitor jobs and printer health</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Current Status
          </h2>
          <StatusIndicator status={printerStatus.status} />
        </div>

        <p className="text-gray-600 mb-4">{printerStatus.message}</p>

        {printerStatus.progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{printerStatus.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${printerStatus.progress}%` }}
              />
            </div>
          </div>
        )}

        {printerStatus.printerAlertDescription && (
          <div className="flex items-center mt-4 p-3 bg-yellow-50 rounded-lg">
            <AlertCircle className="text-yellow-500 mr-2" size={20} />
            <span className="text-yellow-700 text-sm">
              {printerStatus.printerAlertDescription}
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Printer Details
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">Model:</span>
            <span className="text-sm text-gray-900">
              {printerStatus.printerModel}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">Name:</span>
            <span className="text-sm text-gray-900">
              {printerStatus.printerName}
            </span>
          </div>
          {printerStatus.printerLocation && (
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">
                Location:
              </span>
              <span className="text-sm text-gray-900">
                {printerStatus.printerLocation}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">State:</span>
            <span className="text-sm text-gray-900 capitalize">
              {printerStatus.printerState}
            </span>
          </div>
          {printerStatus.printerStateReasons !== "none" && (
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">
                State Reason:
              </span>
              <span className="text-sm text-gray-900">
                {printerStatus.printerStateReasons}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">
              Accepting Jobs:
            </span>
            <span
              className={`text-sm ${printerStatus.isAcceptingJobs ? "text-green-600" : "text-red-600"}`}
            >
              {printerStatus.isAcceptingJobs ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">Uptime:</span>
            <span className="text-sm text-gray-900">
              {formatUptime(printerStatus.printerUpTime)}
            </span>
          </div>
          {printerStatus.mediaReady.length > 0 && (
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">
                Paper Loaded:
              </span>
              <span className="text-sm text-gray-900">
                {printerStatus.mediaReady.join(", ")}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">
              Last Updated:
            </span>
            <span className="text-sm text-gray-900">
              {formatLastUpdated(printerStatus.lastUpdated)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ink Levels</h2>
        <div className="space-y-4">
          {Object.entries(printerStatus.inkLevels).map(([color, level]) => (
            <div key={color}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {color}
                </span>
                <span
                  className={`text-sm font-medium ${
                    level > 50
                      ? "text-green-600"
                      : level > 20
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {level}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    level > 50
                      ? "bg-green-500"
                      : level > 20
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${level}%` }}
                />
              </div>
              {level <= 20 && (
                <div className="flex items-center mt-2">
                  <AlertCircle className="text-red-500 mr-1" size={16} />
                  <span className="text-sm text-red-600">Low ink level</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Job Queue ({printerStatus.jobQueue.length})
        </h2>

        {printerStatus.jobQueue.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto mb-3 text-gray-400" size={48} />
            <p className="text-gray-600">No active jobs</p>
          </div>
        ) : (
          <div className="space-y-4">
            {printerStatus.jobQueue.map((job) => (
              <div
                key={job.id}
                className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg"
              >
                {getJobIcon(job.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">{job.fileName}</p>
                    <span
                      className={`text-sm font-medium capitalize ${getStatusColor(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 capitalize">
                    {job.type} job
                  </p>

                  {job.status === "processing" && job.progress > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
