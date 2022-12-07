import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { doc, dom, DOMElement } from "com.batch.dom/ui/dom";
import updateClassNames from "com.batch.dom/ui/style";
import { ICONS_URL } from "com.batch.shared/../../config";
import { Delay } from "com.batch.shared/helpers/timed-promise";

import { IBatchSDK } from "../../public-api";
import { BasePopinComponent } from "../base-popin-component";
import { IPopinConfig } from "../popin/component";
import html from "./content.html";
import style, { IIndexableStyle } from "./style.css";

const ENABLE_LOGS = false;

const LSKEY = "_batch_ui_alert_dismissed";

const selectors = {
  alert: "div." + style["b-alert"],
  buttons: "a." + style["b-btn"],
  container: "div." + style["b-alert-container"],
  img: "img." + style["b-img"],
  buttonSpacer: "div." + style["b-btn-spacer"],
  extraButton: "a." + style["b-btn-extra"],
  negativeButton: "a." + style["b-btn-no"],
  positiveButton: "a." + style["b-btn-yes"],
  text: "span." + style["b-t"],
};

export interface IAlertButtonStyle {
  textColor?: string;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  fontSize?: string;
  shadow?: boolean;
}

export interface IExtraButtonConfig {
  label: string;
  link: string;
  style?: IAlertButtonStyle;
}

export interface IAlertConfig {
  attach?: string;
  autoShow: boolean;
  showIfPermissionGranted: boolean;
  hideFor: number;
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
  btnFontSize?: string;
  zIndex?: number;
  icon?: string;
  text: string;
  negativeBtnLabel: string;
  positiveSubBtnLabel: string;
  positiveUnsubBtnLabel: string;
  positiveBtnStyle?: IAlertButtonStyle;
  negativeBtnStyle?: IAlertButtonStyle;
  popin?: IPopinConfig;
  extraBtn?: IExtraButtonConfig;
}

enum VerticalAlignment {
  Top,
  Bottom,
}

enum HorizontalAlignment {
  Left,
  Center,
  Right,
}

/**
 * Intrusive popup
 */
export default class Alert extends BasePopinComponent<IAlertConfig> {
  private vAlign: VerticalAlignment;
  private hAlign: HorizontalAlignment;

  public constructor(api: IBatchSDK, config: IAlertConfig) {
    super(
      api,
      Object.assign(
        {
          autoShow: true,
          backgroundColor: "#FFF",
          btnFontSize: "14",
          btnTextColor: "#FFF",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Lucida Grande", "Segoe UI", verdana, arial, sans-serif',
          fontSize: "15",
          hideFor: 604800, // 7 days
          positiveBtnStyle: {},
          textColor: "#000",
          showIfPermissionGranted: true,
        },
        config
      ) as IAlertConfig,
      typeof config.popin === "object" ? config.popin : {}
    );

    this.conf.positiveBtnStyle = Object.assign(
      {
        backgroundColor: "#1dabe1",
        hoverBackgroundColor: "#0296d0",
        shadow: true,
        textColor: "#FFFFFF",
      },
      this.conf.positiveBtnStyle
    );

    this.vAlign = VerticalAlignment.Top;
    this.hAlign = HorizontalAlignment.Center;

    const attach = this.conf.attach;
    if (typeof attach === "string") {
      if (attach.indexOf("top") >= 0) {
        this.vAlign = VerticalAlignment.Top;
      } else if (attach.indexOf("bottom") >= 0) {
        this.vAlign = VerticalAlignment.Bottom;
      }

      if (attach.indexOf("left") >= 0) {
        this.hAlign = HorizontalAlignment.Left;
      } else if (attach.indexOf("right") >= 0) {
        this.hAlign = HorizontalAlignment.Right;
      } else if (attach.indexOf("center") >= 0) {
        this.hAlign = HorizontalAlignment.Center;
      }
    }
  }

  /**
   * Draw the popin
   */
  public draw(state: ISubscriptionState): void {
    this.popin.hide();
    this.popin.draw(state);

    let bannerClass = style["b-alert-container"];
    if (this.vAlign === VerticalAlignment.Bottom) {
      bannerClass += " " + style["b-alert-container__bottom"];
    } else {
      bannerClass += " " + style["b-alert-container__top"];
    }

    if (this.hAlign === HorizontalAlignment.Left) {
      bannerClass += " " + style["b-alert-container__left"];
    } else if (this.hAlign === HorizontalAlignment.Right) {
      bannerClass += " " + style["b-alert-container__right"];
    }

    const div = document.createElement("div");
    div.className = bannerClass;
    div.innerHTML = html;
    div.id = "batchsdk-ui-alert-container";
    updateClassNames(div, style as IIndexableStyle);

    this.container = dom(div);
    this.container.style({ display: "none" });

    if (Number.isInteger(this.conf.zIndex as number)) {
      this.container.style({ zIndex: String(this.conf.zIndex) });
    }

    this.container.selectOne(selectors.alert).style({
      backgroundColor: this.conf.backgroundColor ?? null,
      color: this.conf.textColor ?? null,
      fontFamily: this.conf.fontFamily ?? null,
      fontSize: this.conf.fontSize ? this.conf.fontSize + "px" : null,
    });

    this.container.select(selectors.buttons).style({
      fontSize: this.conf.btnFontSize ? this.conf.btnFontSize + "px" : null,
    });

    const { apiKey, defaultIcon } = this.api.getConfiguration();
    const icon = this.conf.icon ?? defaultIcon ?? `${ICONS_URL}/${apiKey}/default-icon.png`;
    if (icon) {
      this.container
        .selectOne(selectors.img)
        .wrapped.filter((e: Element): e is HTMLImageElement => {
          return e instanceof HTMLImageElement;
        })
        .forEach(image => {
          image.src = icon || "";
          image.onerror = function () {
            this.style.display = "none";
          };
        });
      this.container.selectOne(selectors.img).style({ display: "initial" });
    }

    this.container.selectOne(selectors.text).text(this.conf.text);
    this.container.selectOne(selectors.negativeButton).text(this.conf.negativeBtnLabel);

    // buttons

    if (this.conf.positiveBtnStyle !== null && typeof this.conf.positiveBtnStyle === "object") {
      this.applyButtonStyle("positive", this.conf.positiveBtnStyle, this.container.selectOne(selectors.positiveButton));
    }

    if (this.conf.negativeBtnStyle !== null && typeof this.conf.negativeBtnStyle === "object") {
      this.applyButtonStyle("negative", this.conf.negativeBtnStyle, this.container.selectOne(selectors.negativeButton));
    }

    this.drawExtraButton();

    this.container.selectOne(selectors.negativeButton).listenTo("click", (e: Event) => {
      e.preventDefault();
      this.hide();
    });

    this.container.selectOne(selectors.positiveButton).listenTo("click", (e: Event) => {
      e.preventDefault();
      this.onClick();
    });

    this.redraw(state);

    if (this.conf.autoShow) {
      this.show();
    }

    doc
      .body()
      .listenTo("click", (e: Event) => {
        if (!this.popin.containsElem(e.target as Element) && !this.containsElem(e.target as Element)) {
          this.popin.hide();
        }
      })
      // finally append this element
      .prepend(div, false);
  }

  private drawExtraButton(): void {
    if (this.conf.extraBtn !== null && typeof this.conf.extraBtn === "object") {
      const extraBtnConf = this.conf.extraBtn;
      // Bail if we don't have a valid label or link
      if (typeof extraBtnConf.label !== "string" || extraBtnConf.label.length === 0) {
        return;
      }
      if (typeof extraBtnConf.link !== "string" || extraBtnConf.link.length === 0) {
        return;
      }

      if (extraBtnConf.style !== null && typeof extraBtnConf.style === "object") {
        this.applyButtonStyle("extra", extraBtnConf.style, this.container.selectOne(selectors.extraButton));
      }

      this.container
        .selectOne(selectors.extraButton)
        .removeClass(style["b-hidden"])
        .style({
          fontSize: null,
        })
        .text(extraBtnConf.label)
        .href(extraBtnConf.link);
      this.container.selectOne(selectors.buttonSpacer).removeClass(style["b-hidden"]);
    }
  }

  private applyButtonStyle(btnName: string, btnStyle: IAlertButtonStyle, elem: DOMElement): void {
    const variables: Record<string, string> = {};

    const setVar = (name: string, value: string): void => {
      variables[`--batch-${btnName}btn-${name}`] = value;
    };

    if (btnStyle.textColor) {
      setVar("textcolor", btnStyle.textColor);
    }

    if (btnStyle.backgroundColor) {
      setVar("bgcolor", btnStyle.backgroundColor);
    }

    if (btnStyle.hoverBackgroundColor) {
      setVar("hover_bgcolor", btnStyle.hoverBackgroundColor);
    }

    if (btnStyle.fontSize) {
      setVar("fontSize", btnStyle.fontSize + "px");
    }

    if (btnStyle.shadow) {
      elem.addClass(style["b-btn-shadowed"]);
    }

    this.container.selectOne(selectors.alert).styleProperty(variables);
  }

  // ----------------------------------->

  private containsElem(elem: Element): boolean {
    return dom(elem).closest(selectors.container).is(this.container);
  }

  private isShown(): boolean {
    // Use a Partial<HTMLElement> because it might be an Element that doesn't have "style"
    return this.container.someElem((el: Partial<HTMLElement>) => {
      return el.style?.display !== "none";
    });
  }

  public async show(force: boolean = false): Promise<void> {
    this.isShown();
    if (!force && this.state && this.state.subscribed) {
      return;
    }
    if (!force && !this.conf.showIfPermissionGranted && (await this.api.getNotificationPermission()) === "granted") {
      return;
    }
    const dismissed = +(window.localStorage.getItem(LSKEY) as string);
    const now = Math.round(new Date().getTime() / 1000);
    if (force || !dismissed || (now - dismissed > this.conf.hideFor && this.conf.hideFor !== 0)) {
      this.container.style({ display: "block" });
    }
  }

  public hide(): void {
    this.container.style({ display: "none" });
    this.popin.hide();
    window.localStorage.setItem(LSKEY, Math.round(new Date().getTime() / 1000) + "");
  }

  public reset(): void {
    window.localStorage.removeItem(LSKEY);
  }

  public resetAndShow(): void {
    this.reset();
    this.show(true);
  }

  public toggle(): void {
    if (this.isShown()) {
      this.hide();
    } else {
      this.show();
    }
  }

  public startLoading(): void {
    this.container.addClass(style["b-alert__loading"]);
  }

  public stopLoading(): void {
    this.container.removeClass(style["b-alert__loading"]);
  }

  // ----------------------------------->

  public redraw(state: ISubscriptionState): void {
    if (!this.container) {
      return;
    }
    // keep the state
    this.state = state;
    // adapt the button name
    this.container
      .selectOne(selectors.positiveButton)
      .html(state.subscribed ? this.conf.positiveUnsubBtnLabel : this.conf.positiveSubBtnLabel);
    // update the popin
    this.popin.hide();
    this.popin.redraw(state);
  }

  private onClick(): void {
    if (this.state == null) {
      return;
    }

    const state: ISubscriptionState = this.state;

    if (ENABLE_LOGS) {
      console.debug("Batch Alert: clicked on sub/unsub. state: ", state);
    }

    let p: Promise<boolean> = Promise.resolve(false);
    let showLoading = true;

    if (state.subscribed) {
      p = this.api.unsubscribe();
    } else if (state.permission === "granted") {
      p = this.api.subscribe();
    } else if (state.permission === "denied") {
      this.popin.showAt(this.container.selectOne(selectors.alert), this.vAlign === VerticalAlignment.Bottom ? "above" : "below", "right");
      showLoading = false;
    } else {
      p = this.api.subscribe();
    }

    if (showLoading) {
      this.startLoading();
    }

    p.then(
      success => {
        if (ENABLE_LOGS) {
          console.debug("Batch Alert: got subscribe result, success:", success, " state: ", state);
        }
        Delay(700)
          .then(() => this.stopLoading())
          .then(() => {
            if (success) {
              this.hide();
            }
          });
      },
      () => {
        this.stopLoading();
      }
    );
  }
}
