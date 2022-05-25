import { ITranslationTexts, IUIComponentsTranslations, translations } from "com.batch.translations/translations";
import { BatchSDK } from "public/types/public-api";

const comps = ["button", "switcher", "banner", "popin", "alert", "public-identifiers"];

const getTransForLang = (languageCode: string): IUIComponentsTranslations => {
  if (Object.prototype.hasOwnProperty.call(translations, languageCode)) {
    return translations[languageCode];
  }
  return translations.en;
};

const getTransForComponent = (languageCode: string, componentCode: string): ITranslationTexts => {
  const translationsMap = getTransForLang(languageCode);
  if (Object.prototype.hasOwnProperty.call(translationsMap, componentCode)) {
    return translationsMap[componentCode] || {};
  }
  return {};
};

class Translator {
  public lg: string;

  public constructor(languageCode: string) {
    this.lg = languageCode;
  }

  public setLanguage(languageCode: string): void {
    this.lg = languageCode;
  }

  public populateDefaultComponentText(
    uiConfig: BatchSDK.ISDKUIElementConfiguration,
    componentCode: string
  ): BatchSDK.ISDKUIElementConfiguration {
    if (comps.indexOf(componentCode) === -1) {
      return uiConfig;
    }
    const defaultTranslations = getTransForComponent(this.lg, componentCode);
    uiConfig = Object.assign({}, defaultTranslations, uiConfig);
    return uiConfig;
  }
}

let instance: Translator | null = null;

const getInstance = (languageCode?: string): Translator => {
  if (instance) {
    if (languageCode) {
      instance.setLanguage(languageCode);
    }
  } else {
    instance = new Translator(typeof languageCode === "string" ? languageCode : navigator.language);
  }
  return instance;
};

export default getInstance;
