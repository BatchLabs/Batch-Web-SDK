// tslint:disable:object-literal-sort-keys

const shared = {
  step1: "Schritt 1:",
  step2: "Schritt 2:",
  chrome1: "Klicken Sie auf den Button links neben der Adressleiste",
  chrome2: 'Klicken Sie bei der Berechtigung "Benachrichtigungen" auf Zulassen',
  firefox1: "Klicken Sie auf die Schaltfläche mit der Sprechblase links neben der Adressleiste",
  firefox2: 'Klicken Sie auf das Kreuz [x] neben "Gesperrt"',
  safari1: "Klicken Sie im oberen Menü auf Safari > Einstellungen",
  safari2: "Wählen Sie unter Benachrichtigungen die Option Für diese Website zulassen",
};

export const translations = {
  popin: {
    title: "Benachrichtigungen zulassen",
    btnSub: "Abonnieren",
    btnUnsub: "Abbestellen",
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
    hover: "Benachrichtigungen verwalten ",
  },

  banner: {
    text: "Verpassen Sie kein Update!",
    btnSub: "Abonnieren",
    btnUnsub: "Abbestellen",
    title: "Benachrichtigungen reaktivieren",
    step1: shared.step1,
    step2: shared.step2,
    chrome1: shared.chrome1,
    chrome2: shared.chrome2,
    firefox1: shared.firefox1,
    firefox2: shared.firefox2,
  },

  alert: {
    text: "Verpassen Sie kein Update!",
    positiveSubBtnLabel: "Abonnieren",
    positiveUnsubBtnLabel: "Abbestellen",
    negativeBtnLabel: "Nein, danke",
    title: "Benachrichtigungen reaktivieren",
    step1: shared.step1,
    step2: shared.step2,
    chrome1: shared.chrome1,
    chrome2: shared.chrome2,
    firefox1: shared.firefox1,
    firefox2: shared.firefox2,
  },

  "public-identifiers": {
    titleLabel: "Batch SDK - Identifiers",
    isRegisteredLabel: "Subscribed to notifications?",
    closeLabel: "Close",
    loadingText: "Loading...",
    noValueText: "<No value>",
    errorText: "<Error>",
    copyLabel: "Copy",
    yesText: "Yes",
    noText: "No",
  },
};
