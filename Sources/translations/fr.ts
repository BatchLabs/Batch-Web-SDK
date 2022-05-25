// tslint:disable:object-literal-sort-keys

const shared = {
  step1: "Etape 1:",
  step2: "Etape 2:",
  chrome1: "Cliquez sur le bouton à gauche de la barre d'adresse",
  chrome2: "Sur la permission Notifications, cliquez sur Autoriser",
  firefox1: "Cliquez sur le bouton bulle à gauche de la barre d'adresse",
  firefox2: 'Cliquez sur la croix [x] à côté de "Bloqué"',
  safari1: "Cliquer sur Safari > Preferences dans le menu",
  safari2: "Dans Notifications, choisir Autoriser pour ce site",
};

export const translations = {
  popin: {
    title: "Recevoir les notifications",
    btnSub: "Je m'abonne",
    btnUnsub: "Ne plus recevoir",
    step1: shared.step1,
    step2: shared.step2,
    chrome1: shared.chrome1,
    chrome2: shared.chrome2,
    firefox1: shared.firefox1,
    firefox2: shared.firefox2,
    safari1: shared.safari1,
    safari2: shared.safari2,
  },

  button: {
    hover: "Gérer les notifications ",
  },

  banner: {
    text: "Ne ratez plus jamais une nouveauté !",
    btnSub: "Je m'abonne",
    btnUnsub: "Ne plus recevoir",
    title: "Reactiver les notifications",
    step1: shared.step1,
    step2: shared.step2,
    chrome1: shared.chrome1,
    chrome2: shared.chrome2,
    firefox1: shared.firefox1,
    firefox2: shared.firefox2,
  },

  alert: {
    text: "Ne ratez plus jamais une nouveauté !",
    positiveSubBtnLabel: "Je m'abonne",
    positiveUnsubBtnLabel: "Ne plus recevoir",
    negativeBtnLabel: "Non merci",
    title: "Reactiver les notifications",
    step1: shared.step1,
    step2: shared.step2,
    chrome1: shared.chrome1,
    chrome2: shared.chrome2,
    firefox1: shared.firefox1,
    firefox2: shared.firefox2,
  },

  "public-identifiers": {
    titleLabel: "Batch SDK - Identifiants",
    isRegisteredLabel: "Est abonné aux notifications ?",
    closeLabel: "Fermer",
    loadingText: "Chargement...",
    noValueText: "<Aucune valeur>",
    errorText: "<Erreur>",
    copyLabel: "Copier",
    yesText: "Oui",
    noText: "Non",
  },
};
