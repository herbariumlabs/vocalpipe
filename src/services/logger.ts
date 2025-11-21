/**
 * Logger Service
 * Provides structured logging that integrates with Sentry v9+
 * Uses Sentry.logger API for direct log capture
 */

import * as Sentry from "@sentry/node";

export class LoggerService {
    private static instance: LoggerService;
    private sentryEnabled: boolean = false;

    private constructor() {
        // Check if Sentry is initialized
        this.sentryEnabled = !!process.env.SENTRY_DSN;
    }

    static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    /**
     * Trace level logging (most verbose) - only to console, not Sentry
     */
    trace(message: string, context?: Record<string, any>): void {
        if (process.env.NODE_ENV === "development") {
            console.log(`[TRACE] ${message}`, context || "");
        }
        // Don't send TRACE to Sentry - too verbose
    }

    /**
     * Debug level logging - only to console in development, not Sentry
     */
    debug(message: string, context?: Record<string, any>): void {
        if (process.env.NODE_ENV === "development") {
            console.log(`[DEBUG] ${message}`, context || "");
        }
        // Don't send DEBUG to Sentry in production - too verbose
    }

    /**
     * Info level logging
     */
    info(message: string, context?: Record<string, any>): void {
        console.log(`[INFO] ${message}`, context || "");
        if (this.sentryEnabled && Sentry.logger) {
            Sentry.logger.info(message, context);
        }
    }

    /**
     * Warning level logging
     */
    warn(message: string, context?: Record<string, any>): void {
        console.warn(`[WARN] ${message}`, context || "");
        if (this.sentryEnabled && Sentry.logger) {
            Sentry.logger.warn(message, context);
        }
    }

    /**
     * Error level logging
     */
    error(message: string, context?: Record<string, any>): void {
        console.error(`[ERROR] ${message}`, context || "");
        if (this.sentryEnabled && Sentry.logger) {
            Sentry.logger.error(message, context);
        }
    }

    /**
     * Fatal level logging (most severe)
     */
    fatal(message: string, context?: Record<string, any>): void {
        console.error(`[FATAL] ${message}`, context || "");
        if (this.sentryEnabled && Sentry.logger) {
            Sentry.logger.fatal(message, context);
        }
    }

    /**
     * Log with template literal formatting using Sentry.logger.fmt
     */
    fmt(strings: TemplateStringsArray, ...values: any[]): string {
        if (this.sentryEnabled && Sentry.logger && Sentry.logger.fmt) {
            return Sentry.logger.fmt(strings, ...values);
        }
        // Fallback for when Sentry is not available
        return strings.reduce((result, str, i) => {
            return (
                result +
                str +
                (values[i] !== undefined ? String(values[i]) : "")
            );
        }, "");
    }
}

// Export singleton instance
export const logger = LoggerService.getInstance();
