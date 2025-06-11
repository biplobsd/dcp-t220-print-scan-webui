"use client";

import { Printer, Scan, Activity, Settings, Home } from "lucide-react";

interface NavigationProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export default function Navigation({
  activeSection,
  onNavigate,
}: NavigationProps) {
  const navItems = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "print", label: "Print", icon: Printer },
    { id: "scan", label: "Scan", icon: Scan },
    { id: "status", label: "Status", icon: Activity },
    { id: "maintenance", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-md mx-auto px-4">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center py-3 px-2 transition-colors ${
                  isActive
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={20} className="mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
