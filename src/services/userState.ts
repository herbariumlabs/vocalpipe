import { UserLanguageSettings } from '../types';

export class UserStateService {
  private userLanguages = new Map<number, UserLanguageSettings>();

  getUserSettings(userId: number): UserLanguageSettings {
    return this.userLanguages.get(userId) || { input: 'hindi', output: 'hindi' };
  }

  setUserSettings(userId: number, settings: UserLanguageSettings): void {
    this.userLanguages.set(userId, settings);
  }

  setInputLanguage(userId: number, language: 'hindi' | 'english'): void {
    const currentSettings = this.getUserSettings(userId);
    currentSettings.input = language;
    this.setUserSettings(userId, currentSettings);
  }

  setOutputLanguage(userId: number, language: 'hindi' | 'english'): void {
    const currentSettings = this.getUserSettings(userId);
    currentSettings.output = language;
    this.setUserSettings(userId, currentSettings);
  }

  getLanguageFlags(settings: UserLanguageSettings): { inputFlag: string; outputFlag: string } {
    return {
      inputFlag: settings.input === 'hindi' ? '🇮🇳' : '🇺🇸',
      outputFlag: settings.output === 'hindi' ? '🇮🇳' : '🇺🇸',
    };
  }
}
