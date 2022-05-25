/* eslint-env browser */

import { Log, LogLevel } from "com.batch.shared/logger";

import { IS_DEV } from "../../config";
import NewPublicAPI from "./public-api";
import { BatchWindow } from "./ui/sdk";

// init the log
Log.name = "SDK";
if (IS_DEV) {
  Log.level = LogLevel.Debug;
  Log.enableModule("*");
  Log.disableModule("local-bus");
}

const logModuleName = "boostrap";

(function main(w: BatchWindow): void {
  // create the api
  const api = NewPublicAPI();

  /**
   * Execute the received messages according tshose rules
   * - if the first arguments is a string, then this is a function name
   *   and the next args are the arguments to give back to the called function
   * - if the first argument is an array, the content of the array is acting like the first rule
   * - then, if the first argument, or the argument just after the array is a function, this is a callback
   *   the callback will always be invoked with as first argument the api, and as second the result of the execution, if any
   */
  function execute(...args: unknown[]): void {
    if (args.length === 0) {
      Log.warn(logModuleName, "No arguments given");
      return;
    }

    // array of a message (function to be called)
    let mArgs: unknown[] | null = null;

    /**
     * Is the message call given as an array
     */

    if (args[0] instanceof Array) {
      mArgs = args[0];
      args = args.slice(1);
    }

    /**
     * Expecting a callback
     * or a list of arguments if the first argument wasn't an array
     */

    // the callback if any
    type callbackType = (api: unknown, result: unknown) => unknown;
    let callback: callbackType | null = null;

    if (args.length > 0) {
      if (typeof args[0] === "function") {
        if (args.length > 1) {
          Log.warn(logModuleName, "No arguments expected after a callback");
        }
        callback = args[0] as callbackType;
      } else if (mArgs == null) {
        mArgs = args;
      }
    }

    /**
     * Execute the message call
     * if given
     */

    let result: unknown;

    if (mArgs != null) {
      if (typeof mArgs[0] !== "string") {
        Log.warn(logModuleName, "No message name given");
      } else {
        const message = mArgs[0];
        let msg = message;
        // Erase the SDK type as we want to dynamically call a method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let who = api as any;
        mArgs = mArgs.slice(1);

        // handle ui messages
        if (msg.startsWith("ui.")) {
          msg = msg.substring(3);
          who = api.ui;
        }

        if (!who[msg]) {
          Log.warn(logModuleName, "Unknown message", message);
        } else {
          result = who[msg].apply(api, mArgs);
        }
      }
    }

    /**
     * Execute the callback, if given
     */

    if (callback) {
      callback(api, result);
    }
  }

  // Use this batchsdk as any since it's actually the placeholder which holds a call queue
  // There's a typescript trick to expose "q" but it's too troublesome for just one line
  // As we'll instantly remove this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue = (w.batchSDK && (w.batchSDK as any).q) || [];
  if (Array.isArray(queue)) {
    w.batchSDK = (...args: unknown[]) => queue.push(args);
    let job;
    // tslint:disable-next-line:no-conditional-assignment
    while ((job = queue.shift())) {
      execute.apply(w, job);
    }
    w.batchSDK = (...args: unknown[]) => execute.apply(w, args);
  }

  // Debug browser extension support
  const devToolApi = w["_com.batchsdk.web.devtool.api"];
  if (devToolApi) {
    Log.warn(logModuleName, "Enabling devtool support");
    const oldSDK = w.batchSDK;

    if (typeof devToolApi.sdkCalled === "function") {
      w.batchSDK = (...args: unknown[]) => {
        devToolApi.sdkCalled.apply(w, args);
        oldSDK.apply(w, args);
      };
    }

    if (typeof devToolApi.setSdkApi === "function") {
      devToolApi.setSdkApi((...args: unknown[]) => {
        oldSDK.apply(w, args);
      });
    }

    if (typeof devToolApi.sdkLoaded === "function") {
      devToolApi.sdkLoaded();
    }
  }
})(window as unknown as BatchWindow);
