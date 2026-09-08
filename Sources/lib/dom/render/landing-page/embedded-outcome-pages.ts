import type { MessageColor, MessagePayload } from "com.batch.dom/render/model/types";
import { MessageFormatValue } from "com.batch.dom/render/model/types";

import type { LandingPageLang } from "./landing-page-l10n";
import { LANDING_ERROR_PAGE_TEXTS } from "./landing-page-l10n";

const ERROR_ACCENT: MessageColor = ["#d93025ff", "#f87171ff"];

/** Builds the bundled error page payload, shown when a submit gets no verdict and no static error page is reachable. */
export function makeEmbeddedErrorPayload(lang: LandingPageLang): MessagePayload {
  const texts = LANDING_ERROR_PAGE_TEXTS[lang];
  return {
    format: MessageFormatValue.Fullscreen,
    position: "center",
    closeOptions: {},
    root: {
      backgroundColor: ["#ffffffff", "#151a1eff"],
      margin: [48, 16, 48, 16],
      marginDesktop: [72, 120, 72, 120],
      radius: [16],
      borderWidth: 1,
      borderColor: ["#e3e7ecff", "#2c343cff"],
      children: [
        { type: "spacer", height: "36px" },
        {
          type: "divider",
          color: ERROR_ACCENT,
          thickness: 4,
          width: "56px",
          align: "center",
          margin: [0, 0, 24, 0],
        },
        {
          type: "text",
          id: "title",
          fontSize: 22,
          fontSizeDesktop: 26,
          fontDecoration: ["bold"],
          textAlign: "center",
          color: ["#111318ff", "#f2f5f7ff"],
          margin: [0, 24, 8, 24],
        },
        {
          type: "text",
          id: "message",
          fontSize: 15,
          fontSizeDesktop: 16,
          textAlign: "center",
          color: ["#5c6672ff", "#a8b2bcff"],
          margin: [0, 24, 0, 24],
        },
        { type: "spacer", height: "36px" },
      ],
    },
    texts: { title: texts.title, message: texts.message },
    urls: {},
    actions: {},
  };
}
