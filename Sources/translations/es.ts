// tslint:disable:object-literal-sort-keys

const shared = {
  step1: "Paso 1:",
  step2: "Paso 2:",
  chrome1: "Haga clic en el botón situado a la izquierda de la barra de direcciones",
  chrome2: "En el permiso Notificaciones, haga clic en Permitir",
  firefox1: "Haga clic en el botón de burbuja situado a la izquierda de la barra de direcciones",
  firefox2: 'Haga clic en la cruz [x] junto a "Bloqueado"',
  safari1: "Abra Safari > Configuración y seleccione la pestaña Sitios web",
  safari2: "En Notificaciones, configure este sitio web como Permitir",
};

export const translations = {
  popin: {
    title: "Permitir notificaciones",
    btnSub: "Suscribirse",
    btnUnsub: "Cancelar la suscripción",
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
    hover: "Gestionar las notificaciones ",
  },

  banner: {
    text: "¡No se pierda ninguna novedad!",
    btnSub: "Suscribirse",
    btnUnsub: "Cancelar la suscripción",
    title: "Reactivar las notificaciones",
    step1: shared.step1,
    step2: shared.step2,
    chrome1: shared.chrome1,
    chrome2: shared.chrome2,
    firefox1: shared.firefox1,
    firefox2: shared.firefox2,
  },

  alert: {
    text: "¡No se pierda ninguna novedad!",
    positiveSubBtnLabel: "Suscribirse",
    positiveUnsubBtnLabel: "Cancelar la suscripción",
    negativeBtnLabel: "No, gracias",
    title: "Reactivar las notificaciones",
    step1: shared.step1,
    step2: shared.step2,
    chrome1: shared.chrome1,
    chrome2: shared.chrome2,
    firefox1: shared.firefox1,
    firefox2: shared.firefox2,
  },

  "public-identifiers": {
    titleLabel: "Batch SDK - Identificadores",
    isRegisteredLabel: "¿Suscrito a las notificaciones?",
    closeLabel: "Cerrar",
    loadingText: "Cargando...",
    noValueText: "<Sin valor>",
    errorText: "<Error>",
    copyLabel: "Copiar",
    yesText: "Sí",
    noText: "No",
  },
};
