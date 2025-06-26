"use client";

import { useState, useEffect } from "react";
import {
  Droplets,
  AlertTriangle,
  CheckCircle,
  Settings,
  ChevronDown,
  Info,
  Clock,
  Zap,
  Server,
  Play,
  Square,
  Wifi,
} from "lucide-react";

import { usePrinter } from "@/contexts/PrinterContext";

import {
  CleaningType,
  CleaningOption,
  MaintenanceResult,
} from "@/types/maintenance";

interface VirtualHereStatus {
  virtualhere: {
    status: string;
    isActive: boolean;
  };
  ippUsb: {
    status: string;
    isActive: boolean;
  };
}

export default function MaintenancePanel() {
  const [isRunningMaintenance, setIsRunningMaintenance] =
    useState<boolean>(false);
  const [maintenanceResult, setMaintenanceResult] =
    useState<MaintenanceResult | null>(null);
  const [selectedCleaningType, setSelectedCleaningType] =
    useState<CleaningType>(CleaningType.ALL_NORMAL);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isManagingVirtualHere, setIsManagingVirtualHere] = useState<boolean>(false);
  const [virtualHereStatus, setVirtualHereStatus] = useState<VirtualHereStatus | null>(null);
  const [virtualHereResult, setVirtualHereResult] = useState<MaintenanceResult | null>(null);
  const { printerStatus, updateStatus } = usePrinter();

  const cleaningOptions: CleaningOption[] = [
    {
      id: CleaningType.BLACK_NORMAL,
      label: "Black only - Normal",
      description: "Standard cleaning for black print head",
      duration: 15000,
      inkUsage: "low",
    },
    {
      id: CleaningType.BLACK_STRONG,
      label: "Black only - Strong",
      description: "Intensive cleaning for black print head",
      duration: 20000,
      inkUsage: "medium",
    },
    {
      id: CleaningType.BLACK_STRONGEST,
      label: "Black only - Strongest",
      description: "Deep cleaning for black print head",
      duration: 30000,
      inkUsage: "high",
    },
    {
      id: CleaningType.COLOR_NORMAL,
      label: "Color only - Normal",
      description: "Standard cleaning for color print heads",
      duration: 15000,
      inkUsage: "low",
    },
    {
      id: CleaningType.COLOR_STRONG,
      label: "Color only - Strong",
      description: "Intensive cleaning for color print heads",
      duration: 20000,
      inkUsage: "medium",
    },
    {
      id: CleaningType.COLOR_STRONGEST,
      label: "Color only - Strongest",
      description: "Deep cleaning for color print heads",
      duration: 30000,
      inkUsage: "high",
    },
    // All options
    {
      id: CleaningType.ALL_NORMAL,
      label: "All - Normal",
      description: "Standard cleaning for all print heads",
      duration: 15000,
      inkUsage: "medium",
    },
    {
      id: CleaningType.ALL_STRONG,
      label: "All - Strong",
      description: "Intensive cleaning for all print heads",
      duration: 25000,
      inkUsage: "high",
    },
    {
      id: CleaningType.ALL_STRONGEST,
      label: "All - Strongest",
      description: "Deep cleaning for all print heads",
      duration: 35000,
      inkUsage: "very-high",
    },
    // Special
    {
      id: CleaningType.SPECIAL,
      label: "Special Cleaning",
      description: "Special cleaning sequence for severe clogs",
      duration: 40000,
      inkUsage: "very-high",
    },
  ];

  const getSelectedOption = (): CleaningOption => {
    return (
      cleaningOptions.find((option) => option.id === selectedCleaningType) ||
      cleaningOptions[6]
    );
  };

  const runHeadCleaning = async (): Promise<void> => {
    if (
      !confirm(
        "Are you sure you want to start print head cleaning? This will use ink.",
      )
    ) {
      return;
    }

    setIsRunningMaintenance(true);
    setMaintenanceResult(null);
    const selectedOption = getSelectedOption();

    try {
      updateStatus({
        status: "maintenance",
        message: `Initiating ${selectedOption.label} cleaning...`,
      });

      const response = await fetch("/api/maintenance/head-cleaning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: selectedCleaningType }),
      });

      if (response.ok) {
        await response.json();

        updateStatus({
          status: "maintenance",
          message: `Running ${selectedOption.label} cleaning...`,
        });

        setTimeout(() => {
          setIsRunningMaintenance(false);
          setMaintenanceResult({
            success: true,
            message: `${selectedOption.label} completed successfully`,
            timestamp: new Date(),
          });
          updateStatus({ status: "idle", message: "Printer ready" });
        }, selectedOption.duration);
      } else {
        const errorData: { error: string } = await response.json();
        throw new Error(errorData.error || "Failed to start head cleaning");
      }
    } catch (error) {
      console.error("Head cleaning failed:", error);
      setIsRunningMaintenance(false);
      setMaintenanceResult({
        success: false,
        message: `Head cleaning failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      });
      updateStatus({ status: "error", message: "Maintenance failed" });
    }
  };

  const renderInkUsageIndicator = (usage: string) => {
    const colors = {
      low: "bg-green-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      "very-high": "bg-red-500",
    };

    const colorClass = colors[usage as keyof typeof colors] || "bg-gray-500";

    return (
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full ${colorClass} mr-2`}></div>
        <span className="text-gray-700 text-sm capitalize">
          {usage.replace("-", " ")}
        </span>
      </div>
    );
  };

  const getOptionsByCategory = () => {
    return {
      black: cleaningOptions.slice(0, 3),
      color: cleaningOptions.slice(3, 6),
      all: cleaningOptions.slice(6, 9),
      special: cleaningOptions.slice(9),
    };
  };

  const categories = getOptionsByCategory();

  // Fetch VirtualHere status on component mount
  useEffect(() => {
    fetchVirtualHereStatus();
  }, []);

  const fetchVirtualHereStatus = async (): Promise<void> => {
    try {
      const response = await fetch("/api/maintenance/virtualhere");
      if (response.ok) {
        const status = await response.json();
        setVirtualHereStatus(status);
      }
    } catch (error) {
      console.error("Failed to fetch VirtualHere status:", error);
    }
  };

  const manageVirtualHereService = async (action: "start" | "stop"): Promise<void> => {
    const actionText = action === "start" ? "starting" : "stopping";

    if (
      !confirm(
        `Are you sure you want to ${action} the VirtualHere service?${
          action === "stop" ? " This will also restart the IPP-USB service." : ""
        }`
      )
    ) {
      return;
    }

    setIsManagingVirtualHere(true);
    setVirtualHereResult(null);

    try {
      updateStatus({
        status: "maintenance",
        message: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} VirtualHere service...`,
      });

      const response = await fetch("/api/maintenance/virtualhere", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const result = await response.json();
        setVirtualHereResult({
          success: true,
          message: result.message,
          timestamp: new Date(),
        });
        updateStatus({ status: "idle", message: "Printer ready" });

        // Refresh status after action
        setTimeout(() => {
          fetchVirtualHereStatus();
        }, 1000);
      } else {
        const errorData: { error: string } = await response.json();
        throw new Error(errorData.error || `Failed to ${action} VirtualHere service`);
      }
    } catch (error) {
      console.error(`VirtualHere service ${action} failed:`, error);
      setVirtualHereResult({
        success: false,
        message: `VirtualHere service ${action} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      });
      updateStatus({ status: "error", message: "Service management failed" });
    } finally {
      setIsManagingVirtualHere(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="p-4 max-w-md mx-auto">
        <div className="pt-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Printer Maintenance
          </h1>
          <p className="text-gray-600">
            Keep your printer running smoothly with regular cleaning
          </p>
        </div>

        {maintenanceResult && (
          <div
            className={`p-4 rounded-lg mb-6 ${
              maintenanceResult.success
                ? "bg-green-50 border-l-4 border-green-400"
                : "bg-red-50 border-l-4 border-red-400"
            }`}
          >
            <div className="flex items-center">
              {maintenanceResult.success ? (
                <CheckCircle className="text-green-500 mr-3" size={24} />
              ) : (
                <AlertTriangle className="text-red-500 mr-3" size={24} />
              )}
              <div>
                <p
                  className={`font-semibold ${
                    maintenanceResult.success
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  {maintenanceResult.message}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Completed at{" "}
                  {maintenanceResult.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {isRunningMaintenance && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <div className="animate-spin mr-3">
                <Settings size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 text-lg">
                  Cleaning in Progress
                </h3>
                <p className="text-blue-700">
                  Running {getSelectedOption().label}
                </p>
              </div>
            </div>

            <div className="bg-blue-200 rounded-full h-3 mb-2">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{
                  width: "100%",
                  animation: `progress ${getSelectedOption().duration / 1000}s linear forwards`,
                }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-sm text-blue-700">
              <span className="flex items-center">
                <Clock size={16} className="mr-1" />
                Estimated time: {getSelectedOption().duration / 1000} seconds
              </span>
              <span>Please wait...</span>
            </div>
          </div>
        )}

        {/* VirtualHere Service Management Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Server className="mr-2" size={24} />
              VirtualHere Service
            </h2>
            <p className="text-purple-100 mt-1">
              Manage USB over network sharing service
            </p>
          </div>

          <div className="p-6">
            {virtualHereResult && (
              <div
                className={`p-4 rounded-lg mb-4 ${
                  virtualHereResult.success
                    ? "bg-green-50 border-l-4 border-green-400"
                    : "bg-red-50 border-l-4 border-red-400"
                }`}
              >
                <div className="flex items-center">
                  {virtualHereResult.success ? (
                    <CheckCircle className="text-green-500 mr-3" size={20} />
                  ) : (
                    <AlertTriangle className="text-red-500 mr-3" size={20} />
                  )}
                  <div>
                    <p
                      className={`font-medium text-sm ${
                        virtualHereResult.success
                          ? "text-green-800"
                          : "text-red-800"
                      }`}
                    >
                      {virtualHereResult.message}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {virtualHereResult.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {virtualHereStatus && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-800 mb-3">Service Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 flex items-center">
                      <Server className="mr-2" size={16} />
                      VirtualHere
                    </span>
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2 ${
                          virtualHereStatus.virtualhere.isActive
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <span
                        className={`text-sm font-medium ${
                          virtualHereStatus.virtualhere.isActive
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {virtualHereStatus.virtualhere.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 flex items-center">
                      <Wifi className="mr-2" size={16} />
                      IPP-USB
                    </span>
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2 ${
                          virtualHereStatus.ippUsb.isActive
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <span
                        className={`text-sm font-medium ${
                          virtualHereStatus.ippUsb.isActive
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {virtualHereStatus.ippUsb.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <Info
                  className="text-amber-500 mr-3 flex-shrink-0 mt-0.5"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-amber-900 mb-1">
                    Important Note
                  </h4>
                  <p className="text-sm text-amber-800">
                    Starting VirtualHere will stop IPP-USB. When stopping VirtualHere,
                    IPP-USB will be automatically restarted to restore local printer access.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => manageVirtualHereService("start")}
                disabled={
                  isManagingVirtualHere ||
                  printerStatus.status !== "idle" ||
                  virtualHereStatus?.virtualhere.isActive
                }
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center ${
                  isManagingVirtualHere ||
                  printerStatus.status !== "idle" ||
                  virtualHereStatus?.virtualhere.isActive
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl"
                }`}
              >
                {isManagingVirtualHere ? (
                  <div className="animate-spin mr-2">
                    <Settings size={16} />
                  </div>
                ) : (
                  <Play className="mr-2" size={16} />
                )}
                Start Service
              </button>

              <button
                onClick={() => manageVirtualHereService("stop")}
                disabled={
                  isManagingVirtualHere ||
                  printerStatus.status !== "idle" ||
                  !virtualHereStatus?.virtualhere.isActive
                }
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center ${
                  isManagingVirtualHere ||
                  printerStatus.status !== "idle" ||
                  !virtualHereStatus?.virtualhere.isActive
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl"
                }`}
              >
                {isManagingVirtualHere ? (
                  <div className="animate-spin mr-2">
                    <Settings size={16} />
                  </div>
                ) : (
                  <Square className="mr-2" size={16} />
                )}
                Stop Service
              </button>
            </div>

            {printerStatus.status !== "idle" && !isManagingVirtualHere && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 text-center">
                  <AlertTriangle className="inline mr-1" size={16} />
                  Printer must be idle to manage services. Current status:{" "}
                  <span className="font-medium">{printerStatus.status}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Existing Print Head Cleaning Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Droplets className="mr-2" size={24} />
              Print Head Cleaning
            </h2>
            <p className="text-blue-100 mt-1">
              Select cleaning type and intensity level
            </p>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Select Cleaning Type
              </label>
              <div className="relative">
                <button
                  type="button"
                  className="relative w-full bg-white border border-gray-300 rounded-lg shadow-sm px-4 py-3 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={isRunningMaintenance}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="block text-gray-900 font-medium">
                        {getSelectedOption().label}
                      </span>
                      <span className="block text-sm text-gray-500 mt-1">
                        {getSelectedOption().description}
                      </span>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`text-gray-400 transition-transform ${
                        isDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-20 mt-2 w-full bg-white shadow-xl max-h-80 rounded-lg border border-gray-200 overflow-auto">
                    {Object.entries(categories).map(
                      ([categoryName, options]) => (
                        <div key={categoryName}>
                          <div className="sticky top-0 bg-gray-100 px-4 py-2 border-b border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-700 capitalize">
                              {categoryName === "all"
                                ? "All Colors"
                                : categoryName}
                            </h4>
                          </div>
                          {options.map((option) => (
                            <button
                              key={option.id}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                                selectedCleaningType === option.id
                                  ? "bg-blue-50 border-r-4 border-blue-500"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedCleaningType(option.id);
                                setIsDropdownOpen(false);
                              }}
                            >
                              <div>
                                <span className="font-medium text-gray-900 block">
                                  {option.label}
                                </span>
                                <span className="text-sm text-gray-600 block mt-1">
                                  {option.description}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-800 mb-3">
                Cleaning Details
              </h4>
              <div className="flex-wrap space-y-1">
                <div className="flex items-center">
                  <Clock className="text-gray-500 mr-2" size={16} />
                  <span className="text-gray-700">
                    <span className="font-medium">
                      {getSelectedOption().duration / 1000}s
                    </span>{" "}
                    duration
                  </span>
                </div>
                <div className="flex items-center">
                  <Zap className="text-gray-500 mr-2" size={16} />
                  <div className="flex items-center">
                    <span className="text-gray-700 mr-2">Ink usage:</span>
                    {renderInkUsageIndicator(getSelectedOption().inkUsage)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Info
                  className="text-blue-500 mr-3 flex-shrink-0 mt-0.5"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">
                    When to use cleaning
                  </h4>
                  <p className="text-sm text-blue-800">
                    Use head cleaning when you notice print quality issues like
                    streaks, missing colors, or faded prints. Start with normal
                    intensity and increase if needed.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle
                  className="text-amber-500 mr-3 flex-shrink-0 mt-0.5"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-amber-900 mb-1">
                    Important Notice
                  </h4>
                  <p className="text-sm text-amber-800">
                    Ensure sufficient ink levels before cleaning. Running
                    cleaning cycles with low ink may damage the printer.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={runHeadCleaning}
              disabled={isRunningMaintenance || printerStatus.status !== "idle"}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                isRunningMaintenance || printerStatus.status !== "idle"
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              }`}
            >
              {isRunningMaintenance ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin mr-2">
                    <Settings size={20} />
                  </div>
                  Cleaning in Progress...
                </div>
              ) : (
                "Start Cleaning Process"
              )}
            </button>

            {printerStatus.status !== "idle" && !isRunningMaintenance && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 text-center">
                  <AlertTriangle className="inline mr-1" size={16} />
                  Printer must be idle to start maintenance. Current status:{" "}
                  <span className="font-medium">{printerStatus.status}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
