// tslint:disable:object-literal-sort-keys

const shared = {
  step1: "Step 1:",
  step2: "Step 2:",
  chrome1: "Click on the button to the left of the address bar",
  chrome2: "On the Notifications permission, click on Allow",
  firefox1: "Click on the bubble button to the left of the address bar",
  firefox2: 'Click on the cross [x] next to "Blocked"',
  safari1: "Click on Safari > Preferences in the top menu",
  safari2: "In Notifications, choose Allow for this website",
};

export const translations = {
  popin: {
    title: "Allow notifications",
    btnSub: "Subscribe",
    btnUnsub: "Unsubscribe",
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
    hover: "Manage notifications ",
  },

  banner: {
    text: "Never miss an update !",
    btnSub: "Subscribe",
    btnUnsub: "Unsubscribe",
    title: "Reactivate notifications",
    step1: shared.step1,
    step2: shared.step2,
    chrome1: shared.chrome1,
    chrome2: shared.chrome2,
    firefox1: shared.firefox1,
    firefox2: shared.firefox2,
  },

  alert: {
    text: "Never miss an update !",
    positiveSubBtnLabel: "Subscribe",
    positiveUnsubBtnLabel: "Unsubscribe",
    negativeBtnLabel: "No, thanks",
    title: "Reactivate notifications",
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
