import axiosInstance from "./axios";
import { env } from "@/env";

const PRINTER_CONFIG = {
  ip: env.PRINTER_IP,
  port: env.PRINTER_PORT,
  baseUrl: env.PRINTER_BASE_URL,
};

export async function authenticatePrinter(
  password: string,
): Promise<string | null> {
  try {
    const response = await axiosInstance.post(
      `${PRINTER_CONFIG.baseUrl}/home/status.html`,
      `B16f=${encodeURIComponent(password)}&loginurl=%2Fhome%2Fstatus.html`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      },
    );

    const setCookieHeader = response.headers["set-cookie"];
    if (!setCookieHeader) return null;

    const authCookie = setCookieHeader.find((cookie: string) =>
      cookie.includes("AuthCookie="),
    );

    if (!authCookie) return null;

    const match = authCookie.match(/AuthCookie=([^;]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error("Printer authentication error:", error);
    return null;
  }
}

export async function getPrinterCSRFToken(
  authCookie: string,
  page: string,
  elementId: string,
): Promise<string | null> {
  try {
    const response = await axiosInstance.get(
      `${PRINTER_CONFIG.baseUrl}${page}`,
      {
        headers: {
          Cookie: `AuthCookie=${authCookie}`,
        },
      },
    );

    const html = response.data;
    const regex = new RegExp(
      `id="${elementId}" name="CSRFToken" value="([^"]+)"`,
    );
    const csrfMatch = html.match(regex);
    return csrfMatch ? csrfMatch[1] : null;
  } catch (error) {
    console.error("Failed to get CSRF token:", error);
    return null;
  }
}

export async function initiateHeadCleaning(
  authCookie: string,
  csrfToken: string,
  cleaningType: number,
): Promise<string | null> {
  try {
    const response = await axiosInstance.post(
      `${PRINTER_CONFIG.baseUrl}/general/head_cleaning_confirm.html`,
      `CSRFToken=${encodeURIComponent(csrfToken)}&btn_def=${cleaningType}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `AuthCookie=${authCookie}`,
        },
      },
    );

    const html = response.data;
    const regex = new RegExp(
      `id="CSRFToken3" name="CSRFToken" value="([^"]+)"`,
    );
    const csrfMatch = html.match(regex);
    return csrfMatch ? csrfMatch[1] : null;
  } catch (error) {
    console.error("Failed to initiate head cleaning:", error);
    return null;
  }
}

export async function confirmHeadCleaning(
  authCookie: string,
  csrfToken: string,
  cleaningType: number,
): Promise<string | null> {
  try {
    const response = await axiosInstance.post(
      `${PRINTER_CONFIG.baseUrl}/general/head_cleaning_confirm.html?pc=12`,
      `CSRFToken=${encodeURIComponent(csrfToken)}&btn_def=${cleaningType}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `AuthCookie=${authCookie}`,
        },
      },
    );

    const html = response.data;

    const regex = new RegExp(
      `id="CSRFToken2" name="CSRFToken" value="([^"]+)"`,
    );
    const csrfMatch = html.match(regex);
    return csrfMatch ? csrfMatch[1] : null;
  } catch (error) {
    console.error("Failed to confirm head cleaning:", error);
    return null;
  }
}

export async function refreshHeadCleaning(
  authCookie: string,
  csrfToken: string,
): Promise<boolean> {
  try {
    const response = await axiosInstance.post(
      `${PRINTER_CONFIG.baseUrl}/general/head_cleaning.html`,
      `CSRFToken=${encodeURIComponent(csrfToken)}&btn_def=14`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `AuthCookie=${authCookie}`,
        },
      },
    );

    return response.data.includes('<div class="postSuccess">Accepted.</div>');
  } catch (error) {
    console.error("Failed to confirm head cleaning:", error);
    return false;
  }
}
