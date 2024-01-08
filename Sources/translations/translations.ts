import { translations as de } from "./de";
import { translations as en } from "./en";
import { translations as fr } from "./fr";

export interface ITranslationTexts {
  [key: string]: string;
}

export interface IUIComponentsTranslations {
  popin: ITranslationTexts;
  button: ITranslationTexts;
  banner: ITranslationTexts;
  alert: ITranslationTexts;
  [component: string]: ITranslationTexts | undefined;
}

export interface IBuiltinTranslations {
  [language: string]: IUIComponentsTranslations;
}

export const translations: IBuiltinTranslations = {
  en,
  fr,
  de,
};
