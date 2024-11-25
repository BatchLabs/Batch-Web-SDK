import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { doc, dom } from "com.batch.dom/ui/dom";
import updateClassNames from "com.batch.dom/ui/style";
import { Delay } from "com.batch.shared/helpers/timed-promise";

import { IBatchSDK } from "../../public-api";
import { BasePopinComponent } from "../base-popin-component";
import { IPopinConfig } from "../popin/component";
import html from "./content.html";
import style, { IIndexableStyle } from "./style.css";

const LSKEY = "_batch_ui_banner_dismissed";

const selectors = {
  close: "a." + style["b-c"],
  container: "div." + style["b-banner"],
  img: "img." + style["b-img"],
  subscribe: "a." + style["b-btn"],
  text: "span." + style["b-t"],
};

export interface IBannerConfig {
  autoShow: boolean;
  fixed: boolean;
  hideFor: number;
  btnBackgroundColor: string;
  btnTextColor: string;
  btnHoverColor: string;
  textColor: string;
  backgroundColor: string;
  btnWidth: string;
  fontFamily: string;
  fontSize: string;
  btnFontSize: string;
  attachBottom: boolean;
  text: string;
  btnSub: string;
  btnUnsub: string;
  icon?: string;
  zIndex?: number;
  popin?: IPopinConfig;
}

/**
 * The default overlay implementation with the batch button
 */
export default class Banner extends BasePopinComponent<IBannerConfig> {
  private hiddenBodyPadding: number;
  private shownBodyPadding: number;

  // ----------------------------------->

  /**
   * Set the initial conf
   */
  public constructor(api: IBatchSDK, config: IBannerConfig) {
    super(
      api,
      Object.assign(
        {
          attachBottom: false,
          autoShow: true,
          backgroundColor: "#FFF",
          btnBackgroundColor: "#3E475C",
          btnFontSize: "11",
          btnHoverColor: "#303645",
          btnTextColor: "#FFF",
          btnWidth: "200",
          fixed: false,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Lucida Grande", "Segoe UI", verdana, arial, sans-serif',
          fontSize: "14",
          hideFor: 604800, // 7 days
          textColor: "#000",
        },
        config
      ),
      typeof config.popin === "object" ? config.popin : {}
    );
    this.hiddenBodyPadding = Number.parseFloat(
      window.getComputedStyle(document.body, null).getPropertyValue("padding-top").replace("px", "")
    );
    this.shownBodyPadding = this.hiddenBodyPadding;
    if (this.conf.attachBottom) {
      this.conf.fixed = true;
    }
  }

  /**
   * Draw the popin
   */
  public draw(state: ISubscriptionState): void {
    this.popin.hide();
    this.popin.draw(state);

    let bannerClass = style["b-banner"];
    if (this.conf.attachBottom) {
      bannerClass += " " + style["b-banner__bottom"];
    } else {
      bannerClass += " " + style["b-banner__top"];
    }

    const div = document.createElement("div");
    div.className = bannerClass;
    div.id = "batchsdk-ui-banner";
    div.innerHTML = html;

    updateClassNames(div, style as IIndexableStyle);

    this.container = dom(div);
    this.container.style({
      backgroundColor: this.conf.backgroundColor,
      color: this.conf.textColor,
      display: "none",
      fontFamily: this.conf.fontFamily,
      fontSize: this.conf.fontSize ? this.conf.fontSize + "px" : null,
      position: this.conf.fixed ? "fixed" : "absolute",
      zIndex: String(Number.isInteger(this.conf.zIndex as number) ? (this.conf.zIndex as number) : 16777271),
    });
    this.container.selectOne(selectors.subscribe).style({
      backgroundColor: this.conf.btnBackgroundColor,
      color: this.conf.btnTextColor,
      flex: "0 0 " + this.conf.btnWidth + "px",
      fontSize: this.conf.btnFontSize ? this.conf.btnFontSize + "px" : null,
    });
    if (this.conf.icon) {
      this.container.selectOne(selectors.img).forEachElem((el: HTMLImageElement) => (el.src = this.conf.icon || ""));
      this.container.selectOne(selectors.img).style({ display: "block" });
    }
    this.container.selectOne(selectors.text).text(this.conf.text);

    // button
    this.container.styleProperty({
      "--btn-bgcolor": this.conf.btnBackgroundColor,
      "--btn-hovercolor": this.conf.btnHoverColor,
      "--btn-textcolor": this.conf.btnTextColor,
    });

    this.container.selectOne(selectors.close).listenTo("click", (e: Event) => {
      e.preventDefault();
      this.hide();
    });

    this.container.selectOne(selectors.subscribe).listenTo("click", (e: Event) => {
      e.preventDefault();
      this.onClick();
    });

    if (this.conf.fixed && !this.conf.attachBottom) {
      // Hide the drop shadow
      this.container.style({ boxShadow: "0px 1px 2px 0px rgba(97,116,142,0.17)" });
    }

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

  // ----------------------------------->

  public containsElem(elem: Element): boolean {
    return dom(elem).closest(selectors.container).is(this.container);
  }

  public isShown(): boolean {
    return this.container.someElem((el: HTMLElement) => el.style.display === "flex");
  }

  public show(force: boolean = false): void {
    if (!force && this.state && this.state.subscribed) {
      return;
    }
    const dismissed = Number.parseInt(window.localStorage.getItem(LSKEY) || "0", 10);
    const now = Math.round(new Date().getTime() / 1000);
    if (force || !dismissed || (now - dismissed > this.conf.hideFor && this.conf.hideFor !== 0)) {
      this.container.style({ display: "flex" });
      if (this.conf.fixed) {
        this.shownBodyPadding = this.hiddenBodyPadding + this.container.dim().height;
        document.body.style.paddingTop = this.shownBodyPadding + "px";
      }
    }
  }

  public hide(): void {
    this.container.style({ display: "none" });
    this.popin.hide();
    if (this.conf.fixed) {
      document.body.style.paddingTop = this.hiddenBodyPadding + "px";
    }
    window.localStorage.setItem(LSKEY, String(Math.round(new Date().getTime() / 1000)));
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
    this.container.addClass(style["b-banner__loading"]);
  }

  public stopLoading(): void {
    this.container.removeClass(style["b-banner__loading"]);
  }

  // ----------------------------------->

  public redraw(state: ISubscriptionState): void {
    if (!this.container) {
      return;
    }
    // keep the state
    this.state = state;
    // adapt the button name
    this.container.selectOne(selectors.subscribe).html(state.subscribed ? this.conf.btnUnsub : this.conf.btnSub);
    // update the popin
    this.popin.hide();
    this.popin.redraw(state);
  }

  public onClick(): void {
    if (this.state == null) {
      return;
    }

    const state: ISubscriptionState = this.state;

    let p: Promise<boolean> = Promise.resolve(false);
    let showLoading = true;

    if (state.subscribed) {
      p = this.api.unsubscribe();
    } else if (state.permission === "granted") {
      p = this.api.subscribe();
    } else if (state.permission === "denied") {
      this.popin.showAt(this.container.selectOne(selectors.subscribe), this.conf.attachBottom ? "above" : "below", "right");
      showLoading = false;
    } else {
      p = this.api.subscribe();
    }

    if (showLoading) {
      this.startLoading();
    }

    p.then(
      success => {
        void Delay(700)
          .then(() => this.stopLoading())
          .then(() => {
            if (success) {
              this.container.selectOne(selectors.subscribe).style({ backgroundColor: this.conf.btnBackgroundColor });
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
