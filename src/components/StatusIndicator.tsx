interface StatusIndicatorProps {
  status: "idle" | "printing" | "scanning" | "error" | "maintenance";
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  const statusConfig = {
    idle: { color: "bg-green-500", text: "Ready", pulse: false },
    printing: { color: "bg-blue-500", text: "Printing", pulse: true },
    scanning: { color: "bg-purple-500", text: "Scanning", pulse: true },
    error: { color: "bg-red-500", text: "Error", pulse: false },
    maintenance: { color: "bg-yellow-500", text: "Maintenance", pulse: true },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center">
      <div
        className={`w-3 h-3 rounded-full ${config.color} ${
          config.pulse ? "animate-pulse" : ""
        } mr-2`}
      />
      <span className="text-sm font-medium text-gray-700">{config.text}</span>
    </div>
  );
}
