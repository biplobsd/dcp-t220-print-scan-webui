"use client";

import {
  Printer,
  Scan,
  Activity,
  Wifi,
  AlertCircle,
  Info,
  Settings,
} from "lucide-react";
import StatusIndicator from "@/components/StatusIndicator";
import { usePrinter } from "@/contexts/PrinterContext";

interface DashboardProps {
  onNavigate: (section: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { printerStatus } = usePrinter();

  const quickActions = [
    {
      id: "print",
      title: "Print Document",
      description: "Upload and print PDFs or photos",
      icon: Printer,
      color: "bg-blue-500",
      disabled:
        printerStatus.status === "error" ||
        printerStatus.status === "maintenance",
    },
    {
      id: "scan",
      title: "Scan Document",
      description: "Scan to PDF or image format",
      icon: Scan,
      color: "bg-green-500",
      disabled:
        printerStatus.status === "error" ||
        printerStatus.status === "maintenance",
    },
    {
      id: "status",
      title: "View Status",
      description: "Check printer status and jobs",
      icon: Activity,
      color: "bg-purple-500",
      disabled: false,
    },
  ];

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="text-center mb-8 pt-6">
        <div className="flex items-center justify-center mb-4">
          <Wifi className="text-blue-600 mr-2" size={24} />
          <h1 className="text-2xl font-bold text-gray-900">Printer Server</h1>
        </div>
        <p className="text-gray-600">
          {printerStatus.printerModel || "Brother DCP-T220"} Connected
        </p>
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
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${printerStatus.progress}%` }}
            />
          </div>
        )}

        {printerStatus.printerAlertDescription && (
          <div className="flex items-center mt-4 p-3 bg-yellow-50 rounded-lg">
            <Settings
              className={`mr-2 ${printerStatus.status === "maintenance" ? "animate-spin text-yellow-500" : "text-gray-500"}`}
              size={20}
            />
            <span className="text-yellow-700 text-sm">
              {printerStatus.printerAlertDescription}
            </span>
          </div>
        )}

        {printerStatus.status === "error" && (
          <div className="flex items-center mt-4 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <span className="text-red-700 text-sm">
              Check printer connection and paper
            </span>
          </div>
        )}

        {printerStatus.mediaReady.length > 0 && (
          <div className="mt-4 flex items-center">
            <Info className="text-blue-500 mr-2" size={18} />
            <span className="text-sm text-gray-600">
              Paper loaded: {printerStatus.mediaReady.join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>

        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => !action.disabled && onNavigate(action.id)}
              disabled={action.disabled}
              className={`w-full p-4 bg-white rounded-xl shadow-sm border border-gray-200 text-left transition-all ${
                action.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              <div className="flex items-center">
                <div className={`${action.color} p-3 rounded-lg mr-4`}>
                  <Icon className="text-white" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h3 className="font-semibold text-gray-900 mb-4">Ink Levels</h3>
        <div className="space-y-3">
          {Object.entries(printerStatus.inkLevels).map(([color, level]) => (
            <div key={color} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 capitalize">
                {color}
              </span>
              <div className="flex items-center flex-1 ml-4">
                <div className="w-full bg-gray-200 rounded-full h-2 flex-1">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      level > 50
                        ? "bg-green-500"
                        : level > 20
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${level}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 ml-2 min-w-[3rem]">
                  {level}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
