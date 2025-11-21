/**
 * Sentry Instrumentation
 * This file MUST be imported before any other modules to ensure proper instrumentation
 */

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { config as dotenvConfig } from "dotenv";

// Load environment variables first
dotenvConfig();

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || "development";
const SENTRY_ENABLE_PROFILING = process.env.SENTRY_ENABLE_PROFILING === "true";
const SENTRY_TRACES_SAMPLE_RATE = parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE || "1.0"
);
const SENTRY_PROFILES_SAMPLE_RATE = parseFloat(
    process.env.SENTRY_PROFILES_SAMPLE_RATE || "1.0"
);

// Only initialize Sentry if DSN is provided
if (SENTRY_DSN) {
    const integrations: any[] = [];

    // Add profiling integration if enabled
    if (SENTRY_ENABLE_PROFILING) {
        integrations.push(nodeProfilingIntegration());
    }

    // Add console logging integration to capture console logs as Sentry logs
    // Only capture warnings and errors to reduce noise
    integrations.push(
        Sentry.consoleLoggingIntegration({
            levels:
                SENTRY_ENVIRONMENT === "production"
                    ? ["warn", "error"]
                    : ["log", "warn", "error"],
        })
    );

    Sentry.init({
        dsn: SENTRY_DSN,

        environment: SENTRY_ENVIRONMENT,

        // Performance Monitoring
        tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,

        // Profiling
        profilesSampleRate: SENTRY_PROFILES_SAMPLE_RATE,

        // Enable Logs (requires Sentry v9.41.0+)
        enableLogs: true,

        // Integrations
        integrations,

        // Release tracking
        release: process.env.npm_package_version || "1.0.0",

        // Enhanced error context
        beforeSend(event, hint) {
            // Add custom context to all events
            if (event.contexts) {
                event.contexts.runtime = {
                    name: "node",
                    version: process.version,
                };
            }

            // Log errors to console in development
            if (SENTRY_ENVIRONMENT === "development") {
                console.error(
                    "Sentry Error:",
                    hint.originalException || hint.syntheticException
                );
            }

            return event;
        },

        // Breadcrumb filtering
        beforeBreadcrumb(breadcrumb, hint) {
            // Filter out sensitive data from breadcrumbs
            if (breadcrumb.category === "console") {
                // Don't send console logs as breadcrumbs in production
                if (SENTRY_ENVIRONMENT === "production") {
                    return null;
                }
            }
            return breadcrumb;
        },

        // Enable debug mode in development
        debug: SENTRY_ENVIRONMENT === "development",
    });

    console.log(`✅ Sentry initialized (Environment: ${SENTRY_ENVIRONMENT})`);
    if (SENTRY_ENABLE_PROFILING) {
        console.log("✅ Sentry profiling enabled");
    }
    console.log("✅ Sentry console logging enabled");

    // Log initialization details
    console.log("[Sentry] Initialized successfully", {
        environment: SENTRY_ENVIRONMENT,
        profiling: SENTRY_ENABLE_PROFILING,
        tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
        profilesSampleRate: SENTRY_PROFILES_SAMPLE_RATE,
    });
} else {
    console.log("⚠️  Sentry not configured (missing SENTRY_DSN)");
}

// Export Sentry for use in other modules
export { Sentry };
