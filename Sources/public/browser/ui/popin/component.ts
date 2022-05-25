import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { doc, dom } from "com.batch.dom/ui/dom";
import { AnyEvent, BatchDomEvent } from "com.batch.dom/ui/dom-events";
import { fillPictureElement } from "com.batch.dom/ui/picture";
import { Position, Rectangle, windowDim } from "com.batch.dom/ui/size";
import updateClassNames from "com.batch.dom/ui/style";
import { Delay } from "com.batch.shared/helpers/timed-promise";
import { Browser, UserAgent } from "com.batch.shared/helpers/user-agent";

import { IS_WEBPACK_DEV_SERVER, SDK_VERSION, SSL_SCRIPT_URL } from "../../../../config";
import { IBatchSDK } from "../../public-api";
import { BaseComponent } from "../base-component";
import html from "./content.html";
import style, { IIndexableStyle } from "./style.css";

const selectors = {
  activate: "div." + style["b-activate"],
  container: "div." + style["b-popin"],
  header: "span." + style["b-popin__header__title"],
  notification: "div." + style["b-pe__c"],
  notificationBody: "div." + style["b-pe__c__b"],
  notificationImg: "img." + style["b-pe-img__image"],
  notificationImgPlaceholder: "svg." + style["b-pe-img__image__placeholder"],
  notificationTitle: "div." + style["b-pe__c__t"],
  placeholderNotification: "div." + style["b-pe__c__placeholder"],
  reactivate: "div." + style["b-reactivate"],
  reactivateImg: "div." + style["b-reactivate"] + " picture",
  step1: "b." + style.step1,
  step1Detail: "span." + style["step1-detail"],
  step2: "b." + style.step2,
  step2Detail: "span." + style["step2-detail"],
  subscribe: "a." + style["b-btn"],
};

const buttonSubscribePublicClass = "batchsdk-ui-popin__content-activate__button-positive";
const buttonUnsubscribePublicClass = "batchsdk-ui-popin__content-activate__button-negative";

export interface IPopinConfig {
  title: string;
  step1: string;
  step2: string;
  btnSub: string;
  btnUnsub: string;
  selector: string;
  position: string;
  align: string;
  firefox1: string;
  firefox2: string;
  chrome1: string;
  chrome2: string;
  safari1: string;
  safari2: string;
  example: {
    icon?: string;
    title: string;
    body: string;
  };
}

/**
 * The default overlay implementation with the batch button
 * A Garin, in other words
 */
export default class Popin extends BaseComponent<IPopinConfig> {
  private userAgent: UserAgent;
  private imagesLoaded: boolean;

  public constructor(api: IBatchSDK, config: Partial<IPopinConfig>) {
    super(
      api,
      Object.assign(
        {
          align: "best", // center, right, left
          example: null,
          position: "best", // best, above, below
          selector: "body", // by default the body
        },
        config
      ) as IPopinConfig
    );

    this.userAgent = new UserAgent(navigator.userAgent);
    this.imagesLoaded = false;
    this.container = dom();
  }

  // ----------------------------------->

  /**
   * Draw the popin
   */
  public draw(state: ISubscriptionState): void {
    const div = document.createElement("div");
    div.className = style["b-popin"];
    div.innerHTML = html;
    updateClassNames(div, style as IIndexableStyle);
    this.container = dom(div);
    this.container.selectOne(selectors.header).text(this.conf.title);
    this.container.selectOne(selectors.step1).text(this.conf.step1);
    this.container.selectOne(selectors.step2).text(this.conf.step2);

    // Don't add the images right now

    this.redraw(state);

    // subscribe
    this.container.selectOne(selectors.subscribe).listenTo("click", (e: Event) => {
      e.preventDefault();
      this.onClick();
    });

    doc.body().append(div, false);
  }

  // ----------------------------------->

  public containsElem(elem: Element | null | undefined): boolean {
    if (typeof elem === "undefined" || elem === null) {
      return false;
    }
    return dom(elem).closest(selectors.container).is(this.container);
  }

  public isShown(): boolean {
    return this.container.someElem((el: HTMLElement) => el.style.display === "block");
  }

  public show(): boolean {
    return this.showAt(doc.selectOne(this.conf.selector), this.conf.position, this.conf.align);
  }

  /**
   * Show at the given position relative to the given element
   */
  public showAt(element?: unknown, position?: string, align?: string): boolean {
    if (!this.imagesLoaded) {
      const baseImageURL = IS_WEBPACK_DEV_SERVER ? window.location.origin + "/" : "https://" + SSL_SCRIPT_URL + "/" + SDK_VERSION + "/";

      if (this.userAgent.browser === Browser.Firefox) {
        this.container.selectOne(selectors.step1Detail).text(this.conf.firefox1);
        this.container.selectOne(selectors.step2Detail).text(this.conf.firefox2);
        this.container
          .selectOne(selectors.reactivateImg)
          .forEachElem((el: HTMLPictureElement) => fillPictureElement(el, baseImageURL + "help_firefox", true, true));
      } else if (this.userAgent.browser === Browser.Safari) {
        this.container.selectOne(selectors.step1Detail).text(this.conf.safari1);
        this.container.selectOne(selectors.step2Detail).text(this.conf.safari2);
        this.container
          .selectOne(selectors.reactivateImg)
          .forEachElem((el: HTMLPictureElement) => fillPictureElement(el, baseImageURL + "help_safari", true, true));
      } else {
        this.container.selectOne(selectors.step1Detail).text(this.conf.chrome1);
        this.container.selectOne(selectors.step2Detail).text(this.conf.chrome2);
        this.container
          .selectOne(selectors.reactivateImg)
          .forEachElem((el: HTMLPictureElement) => fillPictureElement(el, baseImageURL + "help_chrome", true, true));
      }
      this.imagesLoaded = true;
    }

    const reference = dom(element).first();
    if (reference.empty() || this.container.empty()) {
      return false;
    }

    // display the popin out of the screen
    if (!this.isShown()) {
      this.container.style({ display: "block", top: "-10000px", left: "-10000px" });
    }

    const refRect = reference.rect();
    const fixed = reference.isFixed();
    const outer = fixed ? new Rectangle(new Position(0, 0), windowDim()) : doc.body().rect();

    // adapt the position to the outer element
    refRect.pos.left -= outer.pos.left;
    refRect.pos.top -= outer.pos.top;

    // the final position
    const pos = {
      bottom: "",
      left: "",
      position: fixed ? "fixed" : "absolute",
      right: "",
      top: "",
    };

    /*
     * Compute the top position
     */

    switch (position) {
      case "above": {
        pos.bottom = outer.height() - refRect.top() + 15 + "px";
        break;
      }
      case "below": {
        pos.top = refRect.bottom() + 15 + "px";
        break;
      }
      default: {
        // TODO handle the best (for now act as top)
        pos.top = refRect.bottom() + 15 + "px";
        break;
      }
    }

    /*
     * Compute the left position
     */

    switch (align) {
      case "left": {
        pos.left = refRect.left() + "px";
        break;
      }
      case "right": {
        pos.right = outer.width() - refRect.right() + "px";
        break;
      }
      default: {
        // TODO handle the best (for now act as left)
        pos.left = refRect.left() + "px";
        break;
      }
    }

    /*
     * Finally update the position
     */

    this.container.style(pos);
    this.dispatchVisibilityChanged();
    return true;
  }

  public hide(): void {
    this.container.style({ display: "none" });
    this.dispatchVisibilityChanged();
  }

  public toggle(): void {
    if (this.isShown()) {
      this.show();
    } else {
      this.hide();
    }
  }

  public startLoading(): void {
    this.container.addClass(style["b-popin__loading"]);
  }

  public stopLoading(): void {
    this.container.removeClass(style["b-popin__loading"]);
  }

  // ----------------------------------->

  public listenToVisibility(callback: EventListenerOrEventListenerObject): void {
    this.listenTo(BatchDomEvent.VisibilityChanged, callback);
  }

  public listenTo(evt: AnyEvent, callback: EventListenerOrEventListenerObject): void {
    this.container.listenTo(evt, callback);
  }

  public dispatchVisibilityChanged(): void {
    this.dispatchEvent(BatchDomEvent.VisibilityChanged);
  }

  public dispatchEvent(code: BatchDomEvent): void {
    const browserEvent = new CustomEvent(code, { bubbles: true, cancelable: false });
    this.container.forEachElem(e => e.dispatchEvent(browserEvent));
  }

  // ----------------------------------->

  public redraw(state: ISubscriptionState): void {
    if (!this.container) {
      return;
    }
    // keep the state
    this.state = state;
    // adapt the button name
    const subscribeBtn = this.container.selectOne(selectors.subscribe);
    if (state.subscribed) {
      subscribeBtn.html(this.conf.btnUnsub);
      subscribeBtn.addClass(style["b-btn-unsub"]);
      subscribeBtn.removeClass(buttonSubscribePublicClass);
      subscribeBtn.addClass(buttonUnsubscribePublicClass);
    } else {
      subscribeBtn.html(this.conf.btnSub);
      subscribeBtn.removeClass(style["b-btn-unsub"]);
      subscribeBtn.addClass(buttonSubscribePublicClass);
      subscribeBtn.removeClass(buttonUnsubscribePublicClass);
    }

    const denied: boolean = state.permission === "denied";
    this.container.selectOne(selectors.activate).style({ display: denied ? "none" : "block" });
    this.container.selectOne(selectors.reactivate).style({ display: denied ? "block" : "none" });

    const drawExampleNotification = this.conf.example != null && typeof this.conf.example === "object";
    this.container.selectOne(selectors.placeholderNotification).style({ display: drawExampleNotification ? "none" : "initial" });
    this.container.selectOne(selectors.notification).style({ display: drawExampleNotification ? "initial" : "none" });

    const notificationImage = this.container.selectOne(selectors.notificationImg);
    notificationImage.style({ display: drawExampleNotification ? "initial" : "none" });

    if (drawExampleNotification) {
      const confExampleImgSrc = this.conf.example.icon;
      const notificationImageElem = notificationImage.elem() as HTMLImageElement;
      if (confExampleImgSrc && notificationImageElem) {
        notificationImageElem.src = confExampleImgSrc;
        // .style doesn't support SVGElements
        this.container.selectOne(selectors.notificationImgPlaceholder).wrapped.forEach((e: HTMLImageElement) => {
          // eslint-disable-next-line
          e.style.display = "none";
        });
      }

      const title = this.conf.example.title;
      const body = this.conf.example.body;
      if (title) {
        this.container.selectOne(selectors.notificationTitle).text(title);
      }
      if (body) {
        this.container.selectOne(selectors.notificationBody).text(body);
      }
    }
  }

  public onClick(): void {
    if (this.state == null) {
      return;
    }

    const state: ISubscriptionState = this.state;
    this.startLoading();

    let p: Promise<boolean> = Promise.resolve(false);

    if (state.subscribed) {
      p = this.api.unsubscribe();
    } else if (state.permission === "granted") {
      p = this.api.subscribe();
    } else {
      p = this.api.subscribe();
    }

    p.then(
      success => {
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
