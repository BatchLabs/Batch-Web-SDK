import { ISubscriptionState } from "com.batch.dom/sdk-impl/sdk";
import { doc, dom } from "com.batch.dom/ui/dom";
import updateClassNames from "com.batch.dom/ui/style";

import { IBatchSDK } from "../../public-api";
import { BasePopinComponent } from "../base-popin-component";
import { IPopinConfig } from "../popin/component";
import popinStyle from "../popin/style.css";
import html from "./content.html";
import style, { IIndexableStyle } from "./style.css";

const selectors = {
  button: "a." + style["b-popin-trigger"],
  container: "div." + style["b-container"],
  header: popinStyle["b-popin__header"] + " > h5",
  hover: "span." + style["b-popin-open__content"],
  img: "img." + popinStyle["b-pe-img__image"],
  popin: "div." + popinStyle["b-popin"],
};

export interface IButtonConfig {
  autoShow: boolean;
  hover: string;
  corner: string;
  backgroundColor: string;
  foregroundColor: string;
  hoverColor: string;
  hoverForegroundColor: string;
  title: string;
  icon?: string;
  popin?: IPopinConfig;
  zIndex?: number;
}

/**
 * The default overlay implementation with the batch button
 * A Garin, in other words
 */
export default class Button extends BasePopinComponent<IButtonConfig> {
  // determines the button position
  // on the screen
  private readonly isTop: boolean;
  private readonly isLeft: boolean;

  public constructor(api: IBatchSDK, config: IButtonConfig) {
    super(
      api,
      Object.assign(
        {
          autoShow: true,
          backgroundColor: "#475066",
          corner: "bottom left",
          foregroundColor: "#FFFFFF",
          hover: "Subscribe to push notifications",
          hoverColor: "#303645",
          hoverForegroundColor: "#FFFFFF",
        },
        config
      ),
      typeof config.popin === "object" ? config.popin : undefined
    );
    this.isTop = this.conf.corner.indexOf("top") >= 0;
    this.isLeft = this.conf.corner.indexOf("left") >= 0;
  }

  // ----------------------------------->

  /**
   * Draw the popin
   */
  public draw(state: ISubscriptionState): void {
    // first of all, draw the popin
    this.popin.draw(state);
    // update the button according the visbility of the popin
    this.popin.listenToVisibility(() => this.updateButton());

    const div = document.createElement("div");
    div.className = style["b-container"];
    div.innerHTML = html;
    updateClassNames(div, style as IIndexableStyle);

    this.container = dom(div);
    this.container.style({ display: "none" });
    this.container.addClass(this.isTop ? style.top : style.bottom);
    this.container.addClass(this.isLeft ? style.left : style.right);

    if (Number.isInteger(this.conf.zIndex as number)) {
      this.container.style({ zIndex: String(this.conf.zIndex) });
    }

    this.container.selectOne(selectors.header).html(this.conf.title);
    this.container.selectOne(selectors.img).forEachElem((el: HTMLImageElement) => (el.src = this.conf.icon || ""));
    this.container.selectOne(selectors.hover).text(this.conf.hover);

    this.container.styleProperty({
      "--batchsdk-ui-button_bgcolor": this.conf.backgroundColor,
      "--batchsdk-ui-button_fgcolor": this.conf.foregroundColor,
      "--batchsdk-ui-button_hover_bgcolor": this.conf.hoverColor,
      "--batchsdk-ui-button_hover_fgcolor": this.conf.hoverForegroundColor,
    });

    this.container.selectOne(selectors.button).listenTo("click", (e: Event) => {
      e.preventDefault();
      // this.container.selectOne(selectors.button).style({ 'pointer-events': 'none' });
      this.toggle();
    });

    if (this.conf.autoShow) {
      this.show();
    }

    // outside
    doc
      .body()
      .listenTo("click", (e: Event) => {
        if (!this.popin.containsElem(e.target as Element) && !this.containsElem(e.target as Element)) {
          this.close();
        }
      })
      // finally append this element
      .append(div, false);
  }

  // ----------------------------------->

  public containsElem(elem: Element): boolean {
    return dom(elem).closest(selectors.container).is(this.container);
  }

  public isOpened(): boolean {
    return this.popin.isShown();
  }

  public open(): void {
    this.popin.showAt(this.container.selectOne(selectors.button), this.isTop ? "below" : "above", this.isLeft ? "left" : "right");
  }

  public close(): void {
    this.popin.hide();
  }

  public updateButton(): void {
    if (this.isOpened()) {
      this.container.select(selectors.button).addClass(style["b-popin-trigger--opened"]);
    } else {
      this.container.select(selectors.button).removeClass(style["b-popin-trigger--opened"]);
    }
  }

  public show(): void {
    this.container.style({ display: "initial" });
    this.popin.hide();
  }

  public hide(): void {
    this.container.style({ display: "none" });
    this.popin.hide();
  }

  public toggle(): void {
    if (this.isOpened()) {
      this.close();
    } else {
      this.open();
    }
  }

  public startLoading(): void {
    this.container.select(selectors.popin).addClass(popinStyle["b-popin__loading"]);
  }

  public stopLoading(): void {
    this.container.select(selectors.popin).removeClass(popinStyle["b-popin__loading"]);
  }

  // ----------------------------------->

  public redraw(state: ISubscriptionState): void {
    if (!this.popin) {
      return;
    }
    this.popin.redraw(state);
  }
}
