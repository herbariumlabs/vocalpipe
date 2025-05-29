import { UserLanguageSettings } from "../types";

export class UserStateService {
    private userLanguages = new Map<number, UserLanguageSettings>();

    getUserSettings(userId: number): UserLanguageSettings {
        return (
            this.userLanguages.get(userId) || {
                input: "hindi",
                output: "hindi",
            }
        );
    }

    setUserSettings(userId: number, settings: UserLanguageSettings): void {
        this.userLanguages.set(userId, settings);
    }

    setInputLanguage(
        userId: number,
        language: "hindi" | "english" | "assamese" | "punjabi"
    ): void {
        const currentSettings = this.getUserSettings(userId);
        currentSettings.input = language;
        this.setUserSettings(userId, currentSettings);
    }

    setOutputLanguage(
        userId: number,
        language: "hindi" | "english" | "assamese" | "punjabi"
    ): void {
        const currentSettings = this.getUserSettings(userId);
        currentSettings.output = language;
        this.setUserSettings(userId, currentSettings);
    }

    getLanguageFlags(settings: UserLanguageSettings): {
        inputFlag: string;
        outputFlag: string;
    } {
        const getFlag = (language: string): string => {
            switch (language) {
                case "hindi":
                    return "🇮🇳";
                case "assamese":
                    return "🇮🇳"; // Using India flag for Assamese as well
                case "punjabi":
                    return "🇮🇳"; // Using India flag for Punjabi as well
                case "english":
                    return "🇺🇸";
                default:
                    return "🇺🇸";
            }
        };

        return {
            inputFlag: getFlag(settings.input),
            outputFlag: getFlag(settings.output),
        };
    }
}
