import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { doc, dom } from "com.batch.dom/ui/dom";
import updateClassNames from "com.batch.dom/ui/style";
import deepClone from "com.batch.shared/helpers/object-deep-clone";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";

import { IBatchSDK } from "../../public-api";
import { BaseComponent } from "../base-component";
import html from "./content.html";
import style, { IIndexableStyle } from "./style.css";

const selectors = {
  buttons: "a." + style["b-btn"],
  container: "div." + style["b-publicids-container"],
  closeButton: "a." + style["b-btn-close"],
  copyButtons: "div." + style["b-cnt-copyable-field"] + " button",
  title: "span." + style["b-cnt-title"],
  isRegisteredLabel: "span." + style["b-cnt-label-isregistered"],
  content: {
    installID: "." + style["b-cnt-field-installid"],
    userID: "." + style["b-cnt-field-userid"],
    isRegistered: "." + style["b-cnt-field-isregistered"],
    registration: "." + style["b-cnt-field-registration"],
  },
};

export interface IPublicIdentifiersConfig {
  titleLabel: string;
  isRegisteredLabel: string;
  closeLabel: string;
  loadingText: string;
  noValueText: string;
  errorText: string;
  copyLabel: string;
  yesText: string;
  noText: string;
}

/**
 * Component that displays various public identifiers inside of the page
 */
export default class PublicIdentifiers extends BaseComponent<IPublicIdentifiersConfig> {
  public constructor(api: IBatchSDK, config: IPublicIdentifiersConfig) {
    super(api, deepClone(config));
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Escape") {
      this.hide();
    }
  };

  /**
   * Draw the popin
   */
  public draw(state: ISubscriptionState): void {
    const div = document.createElement("div");
    div.className = style["b-publicids-container"];
    div.innerHTML = html;
    updateClassNames(div, style as IIndexableStyle);

    this.container = dom(div);
    this.container.style({ display: "none" });

    this.container.selectOne(selectors.title).text(this.conf.titleLabel);
    this.container.select(selectors.copyButtons).text(this.conf.copyLabel).listenTo("click", this.onCopyButtonClick.bind(this));
    this.container.selectOne(selectors.isRegisteredLabel).text(this.conf.isRegisteredLabel);
    this.container.selectOne(selectors.closeButton).text(this.conf.closeLabel).listenTo("click", this.onCloseButtonClick.bind(this));

    this.redraw(state);

    doc.body().prepend(div, false);
  }

  public show(_force: boolean = true): void {
    this.container.style({ display: "flex" });
    window.addEventListener("keyup", this.handleKeyDown, true);
  }

  public hide(): void {
    this.container.style({ display: "none" });
    window.removeEventListener("keyup", this.handleKeyDown, true);
  }

  public redraw(state: ISubscriptionState): void {
    this.state = state;

    Object.values(selectors.content).forEach(selector => {
      this.container.selectOne(selector).text(this.conf.loadingText);
    });

    this.loadValueFromPromise(selectors.content.installID, this.api.getInstallationID());
    this.loadValueFromPromise(
      selectors.content.userID,
      ParameterStore.getInstance().then(store => {
        return store.getParameterValue<string>(keysByProvider.profile.CustomIdentifier);
      })
    );
    this.loadValueFromPromise(
      selectors.content.registration,
      this.api.getSubscription().then(s => {
        if (typeof s === "string") {
          return s;
        }
        return s === null ? null : JSON.stringify(s);
      })
    );
    this.loadValueFromPromise(
      selectors.content.isRegistered,
      this.api.isSubscribed().then(isSub => {
        return isSub ? this.conf.yesText : this.conf.noText;
      })
    );
  }

  private onCloseButtonClick(e: Event): void {
    if (this.state == null) {
      return;
    }

    this.hide();
    e.preventDefault();
  }

  private onCopyButtonClick(e: Event): void {
    const button = e.target as HTMLButtonElement;
    const inputs = button.parentElement?.getElementsByTagName("input") || [];
    if (inputs.length > 0) {
      const value = inputs[0].value;
      if (value && value !== "") {
        void navigator.clipboard.writeText(value);
      }
    }
    e.preventDefault();
  }

  private loadValueFromPromise(selector: string, promise: Promise<string | null>, nullText: string | null = null): void {
    // .text/.placeholder order matters as span will only accept the last set value, as they don't support
    // placeholders
    const element = this.container.selectOne(selector);
    promise
      .then(val => {
        if (typeof val === "undefined" || val === null) {
          element.text("");
          element.placeholder(nullText ?? this.conf.noValueText);
          return;
        }
        element.placeholder("");
        element.text(val);
      })
      .catch(() => {
        element.text("");
        element.placeholder(this.conf.errorText);
      });
  }
}
