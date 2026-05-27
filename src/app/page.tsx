"use client";

import { useState } from "react";
import Dashboard from "@/components/Dashboard";
import PrintInterface from "@/components/PrintInterface";
import ScanInterface from "@/components/ScanInterface";
import StatusMonitor from "@/components/StatusMonitor";
import MaintenancePanel from "@/components/MaintenancePanel";
import Navigation from "@/components/Navigation";
import { PrinterProvider } from "@/contexts/PrinterContext";
import { PrinterProvider as PrintCtxProvider } from "@/contexts/PrinterContextForPrint";

import { usePrinter } from "@/contexts/PrinterContext";

function MainAppContent({
  activeSection,
  setActiveSection,
}: {
  activeSection: string;
  setActiveSection: (s: string) => void;
}) {
  const { printerStatus } = usePrinter();

  if (printerStatus.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute w-8 h-8 bg-blue-600 rounded-full animate-ping opacity-20"></div>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mt-6 animate-pulse">
          Connecting to printer...
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Checking USB status and initializing server.
        </p>
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard onNavigate={setActiveSection} />;
      case "print":
        return <PrintInterface />;
      case "scan":
        return <ScanInterface />;
      case "status":
        return <StatusMonitor />;
      case "maintenance":
        return <MaintenancePanel />;
      default:
        return <Dashboard onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navigation
        activeSection={activeSection}
        onNavigate={setActiveSection}
      />
      <main className="pb-20">{renderActiveSection()}</main>
    </div>
  );
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<string>("dashboard");

  return (
    <PrinterProvider>
      <PrintCtxProvider>
        <MainAppContent
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />
      </PrintCtxProvider>
    </PrinterProvider>
  );
}

