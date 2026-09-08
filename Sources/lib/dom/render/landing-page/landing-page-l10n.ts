import {
  RENDER_TEXT_KEY_FORM_COMPLETED_STATUS,
  RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR,
  RENDER_TEXT_KEY_FORM_NETWORK_ERROR,
  RENDER_TEXT_KEY_FORM_REQUIRED_ERROR,
  RENDER_TEXT_KEY_FORM_SUBMIT_ERROR,
  RENDER_TEXT_KEY_IMAGE_INTERACTIVE,
} from "com.batch.dom/render/render-constants";

/** Languages embedded in the bundle: the SDK ships en, fr, de and es. */
export type LandingPageLang = "en" | "fr" | "de" | "es";

/** Resolves the landing page language from the marker's `data-lang`, falling back to `en`. */
export function resolveLandingPageLang(lang: string | undefined): LandingPageLang {
  // Literal comparisons keep an attacker-supplied `data-lang="constructor"` away from `TEXTS`.
  return lang === "fr" || lang === "de" || lang === "es" ? lang : "en";
}

const TEXTS: Record<LandingPageLang, Readonly<Record<string, string>>> = {
  en: Object.freeze({
    [RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]: "This field is required.",
    [RENDER_TEXT_KEY_FORM_INVALID_ERROR]: "This value is invalid.",
    [RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR]: "Please enter a valid email address.",
    [RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR]: "Please enter a valid phone number.",
    [RENDER_TEXT_KEY_FORM_SUBMIT_ERROR]: "Something went wrong. Please try again.",
    [RENDER_TEXT_KEY_FORM_NETWORK_ERROR]: "We couldn't reach the server. Please try again.",
    [RENDER_TEXT_KEY_FORM_COMPLETED_STATUS]: "Form submitted.",
    [RENDER_TEXT_KEY_IMAGE_INTERACTIVE]: "Interactive",
  }),
  fr: Object.freeze({
    [RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]: "Ce champ est obligatoire.",
    [RENDER_TEXT_KEY_FORM_INVALID_ERROR]: "Cette valeur est invalide.",
    [RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR]: "Veuillez saisir une adresse e-mail valide.",
    [RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR]: "Veuillez saisir un numéro de téléphone valide.",
    [RENDER_TEXT_KEY_FORM_SUBMIT_ERROR]: "Une erreur est survenue. Veuillez réessayer.",
    [RENDER_TEXT_KEY_FORM_NETWORK_ERROR]: "Impossible de contacter le serveur. Veuillez réessayer.",
    [RENDER_TEXT_KEY_FORM_COMPLETED_STATUS]: "Formulaire envoyé.",
    [RENDER_TEXT_KEY_IMAGE_INTERACTIVE]: "Interactif",
  }),
  de: Object.freeze({
    [RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]: "Dieses Feld ist erforderlich.",
    [RENDER_TEXT_KEY_FORM_INVALID_ERROR]: "Dieser Wert ist ungültig.",
    [RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR]: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    [RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR]: "Bitte geben Sie eine gültige Telefonnummer ein.",
    [RENDER_TEXT_KEY_FORM_SUBMIT_ERROR]: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    [RENDER_TEXT_KEY_FORM_NETWORK_ERROR]: "Der Server ist nicht erreichbar. Bitte versuchen Sie es erneut.",
    [RENDER_TEXT_KEY_FORM_COMPLETED_STATUS]: "Formular gesendet.",
    [RENDER_TEXT_KEY_IMAGE_INTERACTIVE]: "Interaktiv",
  }),
  es: Object.freeze({
    [RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]: "Este campo es obligatorio.",
    [RENDER_TEXT_KEY_FORM_INVALID_ERROR]: "Este valor no es válido.",
    [RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR]: "Introduzca una dirección de correo electrónico válida.",
    [RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR]: "Introduzca un número de teléfono válido.",
    [RENDER_TEXT_KEY_FORM_SUBMIT_ERROR]: "Se ha producido un error. Inténtelo de nuevo.",
    [RENDER_TEXT_KEY_FORM_NETWORK_ERROR]: "No se ha podido contactar con el servidor. Inténtelo de nuevo.",
    [RENDER_TEXT_KEY_FORM_COMPLETED_STATUS]: "Formulario enviado.",
    [RENDER_TEXT_KEY_IMAGE_INTERACTIVE]: "Interactivo",
  }),
};

/** Built-in localized strings for the reserved `texts` keys. Spread them under the payload's own `texts`. */
export function landingDefaultTexts(lang: LandingPageLang): Readonly<Record<string, string>> {
  return TEXTS[lang];
}

/** Copy of the bundled error page. The keys are the text component ids of that payload. */
export interface LandingErrorPageTexts {
  title: string;
  message: string;
}

/** Copy of the bundled error page, per language. */
export const LANDING_ERROR_PAGE_TEXTS: Record<LandingPageLang, Readonly<LandingErrorPageTexts>> = {
  en: Object.freeze({ title: "Something went wrong", message: "We couldn't process your request. Please try again later." }),
  fr: Object.freeze({
    title: "Une erreur est survenue",
    message: "Nous n'avons pas pu traiter votre demande. Veuillez réessayer plus tard.",
  }),
  de: Object.freeze({
    title: "Ein Fehler ist aufgetreten",
    message: "Ihre Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es später erneut.",
  }),
  es: Object.freeze({
    title: "Se ha producido un error",
    message: "No hemos podido procesar su solicitud. Inténtelo de nuevo más tarde.",
  }),
};
