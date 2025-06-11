export interface ScanSettings {
    format: "pdf" | "jpg" | "png";
    quality: "draft" | "normal" | "high";
    color: "color" | "grayscale" | "bw";
    resolution: string;
}

export interface ScanJob {
    jobId: string;
    status: "pending" | "scanning" | "completed" | "failed";
    timestamp: string;
    settings: ScanSettings;
    fileSize: number;
    previewUrl: string;
}

export interface ScanPage {
    id: string;
    preview: string;
    timestamp: Date;
}
