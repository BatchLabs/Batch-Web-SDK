import { createCoreActionExecutor } from "com.batch.dom/sdk-impl/render-host/core-action-registry";
import type { RenderEventAttributeValue } from "com.batch.shared/actions/contracts";
import { MessageActionExecutor } from "com.batch.shared/actions/executor";

import { BatchSDK } from "../types/public-api";

/** Composes the SDK-side action executor from the public API, bound to Core-backed effects. */
export function createCoreActionExecutorFromApi(api: BatchSDK.IPublicAPI): MessageActionExecutor {
  return createCoreActionExecutor({
    trackEvent: (name, attributes) => {
      if (!attributes) {
        api.trackEvent(name);
        return;
      }
      const eventAttributes: Record<string, RenderEventAttributeValue> = {};
      for (const [key, value] of Object.entries(attributes)) {
        if (value !== undefined) {
          eventAttributes[key] = value;
        }
      }
      // The public type requires $label/$tags and no `undefined`, while the runtime treats every attribute as optional.
      api.trackEvent(name, { attributes: eventAttributes as BatchSDK.EventDataAttributeType });
    },
    showUIComponent: (code, force) => api.ui.show(code, force),
    updateUserTag: async (action, collection, tag) => {
      // A tag collection is an array attribute of the profile.
      const profile = await api.profile();
      await profile.edit(editor => {
        if (action === "add") {
          editor.addToArray(collection, [tag]);
          return;
        }
        editor.removeFromArray(collection, [tag]);
      });
    },
  });
}
