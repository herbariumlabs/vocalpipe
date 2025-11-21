/**
 * Sentry Service
 * Centralized service for Sentry error tracking, performance monitoring, and custom instrumentation
 */

import * as Sentry from "@sentry/node";
import { config } from "../config";

export class SentryService {
    private static instance: SentryService;
    private isEnabled: boolean = false;

    private constructor() {
        this.isEnabled = !!config.sentryDsn;
    }

    static getInstance(): SentryService {
        if (!SentryService.instance) {
            SentryService.instance = new SentryService();
        }
        return SentryService.instance;
    }

    /**
     * Check if Sentry is enabled
     */
    isActive(): boolean {
        return this.isEnabled;
    }

    /**
     * Set user context for error tracking
     */
    setUser(user: {
        id: number;
        username?: string;
        firstName?: string;
        lastName?: string;
    }): void {
        if (!this.isEnabled) return;

        Sentry.setUser({
            id: String(user.id),
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
        });
    }

    /**
     * Clear user context
     */
    clearUser(): void {
        if (!this.isEnabled) return;
        Sentry.setUser(null);
    }

    /**
     * Set custom tags for filtering and grouping
     */
    setTag(key: string, value: string | number | boolean): void {
        if (!this.isEnabled) return;
        Sentry.setTag(key, value);
    }

    /**
     * Set multiple tags at once
     */
    setTags(tags: Record<string, string | number | boolean>): void {
        if (!this.isEnabled) return;
        Sentry.setTags(tags);
    }

    /**
     * Set custom context for additional information
     */
    setContext(name: string, context: Record<string, any>): void {
        if (!this.isEnabled) return;
        Sentry.setContext(name, context);
    }

    /**
     * Add breadcrumb for debugging trail
     */
    addBreadcrumb(breadcrumb: {
        message: string;
        category?: string;
        level?: "fatal" | "error" | "warning" | "info" | "debug";
        data?: Record<string, any>;
    }): void {
        if (!this.isEnabled) return;

        Sentry.addBreadcrumb({
            message: breadcrumb.message,
            category: breadcrumb.category || "custom",
            level: breadcrumb.level || "info",
            data: breadcrumb.data,
            timestamp: Date.now() / 1000,
        });
    }

    /**
     * Capture an exception with additional context
     */
    captureException(
        error: Error | unknown,
        context?: {
            tags?: Record<string, string | number | boolean>;
            extra?: Record<string, any>;
            level?: "fatal" | "error" | "warning" | "info" | "debug";
            user?: {
                id: number;
                username?: string;
                firstName?: string;
                lastName?: string;
            };
        }
    ): string | undefined {
        if (!this.isEnabled) return undefined;

        return Sentry.captureException(error, {
            tags: context?.tags,
            extra: context?.extra,
            level: context?.level || "error",
            user: context?.user
                ? {
                      id: String(context.user.id),
                      username: context.user.username,
                      firstName: context.user.firstName,
                      lastName: context.user.lastName,
                  }
                : undefined,
        });
    }

    /**
     * Capture a message with additional context
     */
    captureMessage(
        message: string,
        level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
        context?: {
            tags?: Record<string, string | number | boolean>;
            extra?: Record<string, any>;
        }
    ): string | undefined {
        if (!this.isEnabled) return undefined;

        return Sentry.captureMessage(message, {
            level,
            tags: context?.tags,
            extra: context?.extra,
        });
    }

    /**
     * Start a span for performance monitoring
     */
    startSpan<T>(
        context: {
            name: string;
            op: string;
            description?: string;
        },
        callback: (span: Sentry.Span | undefined) => T
    ): T {
        if (!this.isEnabled) {
            return callback(undefined);
        }

        return Sentry.startSpan(context, callback);
    }

    /**
     * Wrap an async function with automatic error capturing
     */
    wrapAsync<T extends (...args: any[]) => Promise<any>>(
        fn: T,
        context?: {
            name?: string;
            tags?: Record<string, string | number | boolean>;
        }
    ): T {
        if (!this.isEnabled) return fn;

        return (async (...args: any[]) => {
            try {
                if (context?.tags) {
                    this.setTags(context.tags);
                }
                return await fn(...args);
            } catch (error) {
                this.captureException(error, {
                    tags: context?.tags,
                    extra: {
                        functionName: context?.name || fn.name,
                        arguments: args,
                    },
                });
                throw error;
            }
        }) as T;
    }

    /**
     * Track a custom metric
     */
    trackMetric(
        name: string,
        value: number,
        unit?: string,
        tags?: Record<string, string>
    ): void {
        if (!this.isEnabled) return;

        // Add as breadcrumb for now (Sentry metrics API is in beta)
        this.addBreadcrumb({
            message: `Metric: ${name}`,
            category: "metric",
            level: "info",
            data: {
                value,
                unit,
                ...tags,
            },
        });
    }

    /**
     * Track processing time for operations
     */
    async trackOperation<T>(
        operationName: string,
        operation: () => Promise<T>,
        context?: {
            tags?: Record<string, string | number | boolean>;
            extra?: Record<string, any>;
        }
    ): Promise<T> {
        if (!this.isEnabled) {
            return await operation();
        }

        const startTime = Date.now();

        return await this.startSpan(
            {
                name: operationName,
                op: "operation",
            },
            async (span) => {
                try {
                    if (context?.tags && span) {
                        Object.entries(context.tags).forEach(([key, value]) => {
                            span.setAttribute(key, String(value));
                        });
                    }

                    const result = await operation();

                    const duration = Date.now() - startTime;
                    if (span) {
                        span.setAttribute("duration_ms", duration);
                        span.setStatus({ code: 1 }); // OK status
                    }

                    this.trackMetric(
                        `${operationName}.duration`,
                        duration,
                        "ms",
                        context?.tags as Record<string, string>
                    );

                    return result;
                } catch (error) {
                    const duration = Date.now() - startTime;
                    if (span) {
                        span.setAttribute("duration_ms", duration);
                        span.setStatus({ code: 2 }); // ERROR status
                    }

                    this.captureException(error, {
                        tags: {
                            ...context?.tags,
                            operation: operationName,
                        },
                        extra: {
                            ...context?.extra,
                            duration_ms: duration,
                        },
                    });

                    throw error;
                }
            }
        );
    }

    /**
     * Track database query performance
     */
    async trackDatabaseQuery<T>(
        queryName: string,
        query: () => Promise<T>,
        context?: {
            table?: string;
            operation?: string;
        }
    ): Promise<T> {
        return await this.trackOperation(`db.${queryName}`, query, {
            tags: {
                db_table: context?.table || "unknown",
                db_operation: context?.operation || "query",
            },
        });
    }

    /**
     * Track external API calls
     */
    async trackApiCall<T>(
        apiName: string,
        apiCall: () => Promise<T>,
        context?: {
            endpoint?: string;
            method?: string;
        }
    ): Promise<T> {
        return await this.trackOperation(`api.${apiName}`, apiCall, {
            tags: {
                api_endpoint: context?.endpoint || "unknown",
                api_method: context?.method || "unknown",
            },
        });
    }

    /**
     * Track AI/ML model inference
     */
    async trackModelInference<T>(
        modelName: string,
        inference: () => Promise<T>,
        context?: {
            inputLength?: number;
            outputLength?: number;
            temperature?: number;
        }
    ): Promise<T> {
        return await this.trackOperation(`model.${modelName}`, inference, {
            tags: {
                model_name: modelName,
            },
            extra: context,
        });
    }

    /**
     * Flush all pending events (useful before shutdown)
     */
    async flush(timeout: number = 2000): Promise<boolean> {
        if (!this.isEnabled) return true;
        return await Sentry.flush(timeout);
    }

    /**
     * Close the Sentry client
     */
    async close(timeout: number = 2000): Promise<boolean> {
        if (!this.isEnabled) return true;
        return await Sentry.close(timeout);
    }
}

// Export singleton instance
export const sentryService = SentryService.getInstance();
