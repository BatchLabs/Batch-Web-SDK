import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { doc, dom, DOMElement } from "com.batch.dom/ui/dom";
import updateClassNames from "com.batch.dom/ui/style";
import { Delay } from "com.batch.shared/helpers/timed-promise";

import { IBatchSDK } from "../../public-api";
import { BasePopinComponent } from "../base-popin-component";
import html from "./content.html";
import style, { IIndexableStyle } from "./style.css";

const selectors = {
  container: "label." + style["b-switch"],
};

export interface ISwitcherConfig {
  selector?: string;
}

export default class Switcher extends BasePopinComponent<ISwitcherConfig> {
  public constructor(api: IBatchSDK, config: ISwitcherConfig) {
    super(api, Object.assign({}, config), {});
  }

  /**
   * Draw the popin
   */
  public draw(state: ISubscriptionState): void {
    if (!this.conf.selector) {
      return;
    }

    // draw the popin
    this.popin.draw(state);

    // search the outer div
    const outer = doc.select(this.conf.selector);

    const div = document.createElement("label");
    div.className = style["b-switch"];
    div.innerHTML = html;

    updateClassNames(div, style as IIndexableStyle);
    this.container = dom(div);

    // draw according to the initial state
    this.redraw(state);
    // insert in all selectors
    this.container = outer.append(div, true);

    // bind actions after inserting (the clone don't keep actions)
    this.container.select("input").listenTo("click", (e: Event) => {
      e.preventDefault();
      this.onClick(e.target as Element);
    });

    // outside
    doc.body().listenTo("click", (e: Event) => {
      if (!this.popin.containsElem(e.target as Element) && !this.containsElem(e.target as Element)) {
        this.popin.hide();
      }
    });
  }

  // ----------------------------------->

  public containsElem(elem: Element): boolean {
    return dom(elem).closest(selectors.container).is(this.container);
  }

  public startLoading(): void {
    this.container.addClass(style["b-switch__loading"]);
  }

  public stopLoading(): void {
    this.container.removeClass(style["b-switch__loading"]);
  }

  // ----------------------------------->

  public redraw(state: ISubscriptionState): void {
    if (!this.container) {
      return;
    }
    // keep the state
    this.state = state;
    this.container.select("input").forEachElem((e: HTMLInputElement) => (e.checked = state.subscribed));
    this.popin.redraw(state);
    this.popin.hide();
  }

  public onClick(target: Element | null): void {
    const t: DOMElement = dom(target).closest(selectors.container);

    if (this.state == null) {
      return;
    }

    const state: ISubscriptionState = this.state;
    let p: Promise<boolean> = Promise.resolve(false);

    if (state.subscribed) {
      p = this.api.unsubscribe();
    } else if (state.permission === "granted") {
      p = this.api.subscribe();
    } else if (state.permission === "denied") {
      this.popin.showAt(t, "below", "left");
    } else {
      this.startLoading();
      p = this.api.subscribe();
    }

    p.then(
      () => {
        void Delay(200).then(() => this.stopLoading());
      },
      () => {
        this.stopLoading();
      }
    );
  }
}
