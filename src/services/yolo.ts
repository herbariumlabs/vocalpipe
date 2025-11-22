/**
 * YOLOv8 ML Service
 * Handles oyster mushroom disease classification and stage detection
 */

import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";
import sharp from "sharp";
import { logger } from "./logger";
import { sentryService } from "./sentry";

export interface ClassificationResult {
    className: string;
    confidence: number;
    allPredictions: Array<{ className: string; confidence: number }>;
}

export interface DetectionResult {
    detections: Array<{
        className: string;
        confidence: number;
        bbox: { x: number; y: number; width: number; height: number };
    }>;
    annotatedImagePath: string;
}

export class YOLOService {
    private static instance: YOLOService;
    private classificationModelPath: string;
    private detectionModelPath: string;
    private modelsDir: string;
    private initialized = false;

    private readonly CLASSIFICATION_MODEL_URL =
        "https://huggingface.co/rahulbarman/oyster-mushroom-disease-classifier/resolve/main/yolov8s_cls_oyster_disease_v1.0.pt";
    private readonly DETECTION_MODEL_URL =
        "https://huggingface.co/rahulbarman/oyster-mushroom-stage-detection/resolve/main/yolov8n_det_oyster_stage_v1.0.pt";

    private constructor() {
        this.modelsDir = path.join(process.cwd(), "models");
        this.classificationModelPath = path.join(
            this.modelsDir,
            "classification_model.pt"
        );
        this.detectionModelPath = path.join(
            this.modelsDir,
            "detection_model.pt"
        );
    }

    static getInstance(): YOLOService {
        if (!YOLOService.instance) {
            YOLOService.instance = new YOLOService();
        }
        return YOLOService.instance;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        return await sentryService.trackOperation(
            "yolo.initialize",
            async () => {
                logger.info("Initializing YOLO service");

                // Create models directory if it doesn't exist
                if (!fs.existsSync(this.modelsDir)) {
                    fs.mkdirSync(this.modelsDir, { recursive: true });
                }

                // Download models if they don't exist
                await this.downloadModelIfNeeded(
                    this.CLASSIFICATION_MODEL_URL,
                    this.classificationModelPath,
                    "classification"
                );
                await this.downloadModelIfNeeded(
                    this.DETECTION_MODEL_URL,
                    this.detectionModelPath,
                    "detection"
                );

                this.initialized = true;
                logger.info("YOLO service initialized successfully");
            },
            {
                tags: { component: "yolo_service" },
            }
        );
    }

    private async downloadModelIfNeeded(
        url: string,
        filePath: string,
        modelType: string
    ): Promise<void> {
        if (fs.existsSync(filePath)) {
            logger.info(`${modelType} model already exists`, { filePath });
            return;
        }

        logger.info(`Downloading ${modelType} model`, { url });

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(
                    `Failed to download model: ${response.statusText}`
                );
            }

            const buffer = await response.buffer();
            fs.writeFileSync(filePath, buffer);

            logger.info(`${modelType} model downloaded successfully`, {
                filePath,
                size: buffer.length,
            });
        } catch (error) {
            logger.error(`Failed to download ${modelType} model`, {
                error: error instanceof Error ? error.message : "Unknown error",
                url,
            });
            throw error;
        }
    }

    async classifyImage(imagePath: string): Promise<ClassificationResult> {
        await this.initialize();

        return await sentryService.trackModelInference(
            "yolov8_classification",
            async () => {
                logger.info("Running classification inference", { imagePath });

                // For now, we'll use Python subprocess to run YOLOv8
                // This is a placeholder - you'll need to implement actual inference
                const result = await this.runPythonInference(
                    this.classificationModelPath,
                    imagePath,
                    "classification"
                );

                logger.info("Classification completed", {
                    className: result.className,
                    confidence: result.confidence,
                });

                return result;
            },
            {
                inputLength: 1,
            }
        );
    }

    async detectObjects(imagePath: string): Promise<DetectionResult> {
        await this.initialize();

        return await sentryService.trackModelInference(
            "yolov8_detection",
            async () => {
                logger.info("Running detection inference", { imagePath });

                const result = await this.runPythonDetection(
                    this.detectionModelPath,
                    imagePath
                );

                logger.info("Detection completed", {
                    detectionsCount: result.detections.length,
                });

                return result;
            },
            {
                inputLength: 1,
            }
        );
    }

    private async runPythonInference(
        modelPath: string,
        imagePath: string,
        type: "classification"
    ): Promise<ClassificationResult> {
        // This is a placeholder implementation
        // You'll need to create a Python script to run actual inference
        const { execSync } = require("child_process");

        try {
            const pythonScript = path.join(
                process.cwd(),
                "scripts",
                "yolo_classify.py"
            );
            const command = `python3 ${pythonScript} ${modelPath} ${imagePath} 2>/dev/null`;

            const output = execSync(command, { encoding: "utf-8" });
            const result = JSON.parse(output);

            return result;
        } catch (error) {
            logger.error("Python inference failed", {
                error: error instanceof Error ? error.message : "Unknown error",
            });

            // Fallback mock result for development
            return {
                className: "Healthy",
                confidence: 0.95,
                allPredictions: [
                    { className: "Healthy", confidence: 0.95 },
                    { className: "Diseased", confidence: 0.05 },
                ],
            };
        }
    }

    private async runPythonDetection(
        modelPath: string,
        imagePath: string
    ): Promise<DetectionResult> {
        const { execSync } = require("child_process");

        try {
            const pythonScript = path.join(
                process.cwd(),
                "scripts",
                "yolo_detect.py"
            );
            const outputPath = imagePath.replace(
                path.extname(imagePath),
                "_annotated.jpg"
            );
            const command = `python3 ${pythonScript} ${modelPath} ${imagePath} ${outputPath} 2>/dev/null`;

            const output = execSync(command, { encoding: "utf-8" });
            const result = JSON.parse(output);

            return {
                ...result,
                annotatedImagePath: outputPath,
            };
        } catch (error) {
            logger.error("Python detection failed", {
                error: error instanceof Error ? error.message : "Unknown error",
            });

            // Fallback: create annotated image with mock detections
            const outputPath = imagePath.replace(
                path.extname(imagePath),
                "_annotated.jpg"
            );
            await this.createMockAnnotatedImage(imagePath, outputPath);

            return {
                detections: [
                    {
                        className: "Pinning Stage",
                        confidence: 0.92,
                        bbox: { x: 100, y: 100, width: 200, height: 200 },
                    },
                ],
                annotatedImagePath: outputPath,
            };
        }
    }

    private async createMockAnnotatedImage(
        inputPath: string,
        outputPath: string
    ): Promise<void> {
        // Copy the original image as a fallback
        await sharp(inputPath).toFile(outputPath);
    }
}

export const yoloService = YOLOService.getInstance();
