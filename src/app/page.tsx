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

export default function Home() {
  const [activeSection, setActiveSection] = useState<string>("dashboard");

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
    <PrinterProvider>
      <PrintCtxProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          <Navigation
            activeSection={activeSection}
            onNavigate={setActiveSection}
          />
          <main className="pb-20">{renderActiveSection()}</main>
        </div>
      </PrintCtxProvider>
    </PrinterProvider>
  );
}
