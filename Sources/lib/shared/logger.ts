import { IS_DEV } from "../../config";
import safeGetWindow from "./helpers/window";

export enum LogLevel {
  None = 0,
  Public,
  PublicError,
  Error,
  Warn,
  Info,
  Trace,
  Debug,
}

export interface ILoggerInternalEvent extends Event {
  module: string;
  level: string;
}

const publicModuleName = "public";

class Logger {
  public level: LogLevel;
  public name: string; // the SDK name
  private enabledModules: Set<string>;
  private disabledModules: Set<string>;
  private tunnelingTo?: Window | MessagePort;

  public constructor() {
    this.level = LogLevel.PublicError;
    this.enabledModules = new Set();
    this.disabledModules = new Set();
    this.name = "SDK";

    this.enabledModules.add(publicModuleName);

    this.loadStorageSettings();

    if (IS_DEV) {
      this.addGlobalEventListeners();
    }
  }

  public loadStorageSettings(): void {
    const safeWindow = safeGetWindow();
    if (safeWindow != null && typeof safeWindow.localStorage === "object") {
      if (safeWindow.localStorage.getItem("com.batch.private.logger.listeners") === "1") {
        this.addGlobalEventListeners();
      }

      const rawLevel = safeWindow.localStorage.getItem("com.batch.private.logger.level");
      if (rawLevel != null) {
        const level = +rawLevel;

        if (level >= 0 && level <= 7) {
          this.level = level as LogLevel;
        }
      }

      try {
        const rawEnabledModules = safeWindow.localStorage.getItem("com.batch.private.logger.modules.enabled");
        if (rawEnabledModules) {
          const enabledModules = JSON.parse(rawEnabledModules);
          if (Array.isArray(enabledModules)) {
            enabledModules.forEach(m => {
              this.enableModule(m);
            });
          }
        }

        const rawDisabledModules = safeWindow.localStorage.getItem("com.batch.private.logger.modules.disabled");
        if (rawDisabledModules) {
          const disabledModules = JSON.parse(rawDisabledModules);
          if (Array.isArray(disabledModules)) {
            disabledModules.forEach(m => {
              this.disableModule(m);
            });
          }
        }
      } catch (_) {
        // We don't give a ... your guess
      }
    }
  }

  public addGlobalEventListeners(): void {
    const safeWindow = safeGetWindow();
    if (safeWindow == null) {
      return;
    }
    safeWindow.addEventListener("___batchSDK___.logger.enableModule", (e: ILoggerInternalEvent) => this.enableModule(e.module));
    safeWindow.addEventListener("___batchSDK___.logger.disableModule", (e: ILoggerInternalEvent) => this.disableModule(e.module));
    safeWindow.addEventListener("___batchSDK___.logger.setLogLevel", (e: ILoggerInternalEvent) => {
      let levelValue;
      switch (e.level.toLowerCase()) {
        case "none":
          levelValue = 0;
          break;
        case "public":
          levelValue = 1;
          break;
        case "publicerror":
          levelValue = 2;
          break;
        case "error":
          levelValue = 3;
          break;
        case "warn":
          levelValue = 4;
          break;
        case "info":
          levelValue = 5;
          break;
        case "trace":
          levelValue = 6;
          break;
        case "debug":
        default:
          levelValue = 7;
          break;
      }
      this.level = levelValue;
    });
  }

  public enableModule(module: string): void {
    this.enabledModules.add(module.toLowerCase());
  }

  public enableTunneling(to: Window | MessagePort): void {
    this.tunnelingTo = to;
  }

  public disableModule(module: string): void {
    this.disabledModules.add(module.toLowerCase());
  }

  public isModuleEnabled(module: string): boolean {
    const m = module.toLowerCase();
    return !this.disabledModules.has(m) && (this.enabledModules.has("*") || this.enabledModules.has(m));
  }

  public shouldLogForLevel(wantedLevel: LogLevel): boolean {
    return this.level > 0 && wantedLevel <= this.level;
  }

  // tslint:disable:no-console
  private logMethodForLevel(wantedLevel: LogLevel): (mesage?: unknown, ...args: unknown[]) => void {
    let method;

    switch (wantedLevel) {
      case LogLevel.Public:
        method = console.log;
        break;
      case LogLevel.PublicError:
      case LogLevel.Error:
        method = console.error;
        break;
      case LogLevel.Info:
        method = console.info;
        break;
      case LogLevel.Warn:
        method = console.warn;
        break;
      case LogLevel.Trace:
        method = console.trace;
        break;
      case LogLevel.Debug:
      default:
        method = console.debug;
        break;
    }

    // Fallback on browsers that don't support advanced methods
    return method || console.log;
  }
  // tslint:enable:no-console

  // tslint:disable:no-console
  // Workaround so that webpack does not strip the console method call
  private getGroupMethod(): (groupName?: string) => void {
    return console.group;
  }

  private getGroupEndMethod(): () => void {
    return console.groupEnd;
  }
  // tslint:enable:no-console

  private formatPrefix(moduleName: string): string {
    if (moduleName === publicModuleName) {
      return "Batch";
    }
    return "Batch " + this.name + " [" + moduleName + "]";
  }

  /* Logging methods */
  public public(...args: unknown[]): void {
    this.log(LogLevel.Public, publicModuleName, ...args);
  }

  public publicError(...args: unknown[]): void {
    this.log(LogLevel.PublicError, publicModuleName, ...args);
  }

  public error(module: string, ...args: unknown[]): void {
    this.log(LogLevel.Error, module, ...args);
  }

  public warn(module: string, ...args: unknown[]): void {
    this.log(LogLevel.Warn, module, ...args);
  }

  public info(module: string, ...args: unknown[]): void {
    this.log(LogLevel.Info, module, ...args);
  }

  public trace(module: string, ...args: unknown[]): void {
    this.log(LogLevel.Trace, module, ...args);
  }

  public debug(module: string, ...args: unknown[]): void {
    this.log(LogLevel.Debug, module, ...args);
  }

  public log(...args: unknown[]): void; // Define a function overload to make the dynamic call work

  public log(level: LogLevel, moduleName: string, ...args: unknown[]): void {
    if (this.tunnelingTo) {
      // convert args for message
      const a: unknown[] = [];
      args.forEach((v: unknown) => {
        switch (typeof v) {
          case "number":
          case "string":
          case "boolean":
            a.push(v);
            break;
          case "object": {
            try {
              a.push(v ? "[" + v.toString() + "]" : null);
            } catch (e) {
              a.push("[No toString method]");
            }
            break;
          }
          default:
            a.push("[Unsupported type " + typeof v + "]");
        }
      });
    }

    if (level === LogLevel.Public || level === LogLevel.PublicError) {
      moduleName = publicModuleName;
    }

    if (this.isModuleEnabled(moduleName) && this.shouldLogForLevel(level)) {
      this.logMethodForLevel(level).apply(console, [this.formatPrefix(moduleName) + " -", ...args]);
    }
  }

  public grouped(level: LogLevel, module: string, groupTitle: string | null, lines: unknown[]): void {
    if (this.isModuleEnabled(module) && this.shouldLogForLevel(level)) {
      if (groupTitle) {
        this.getGroupMethod().apply(console, [this.formatPrefix(module) + " -", groupTitle]);
      } else {
        this.getGroupMethod().apply(console, [this.formatPrefix(module)]);
      }
      const logMethod = this.logMethodForLevel(level);
      lines.forEach(l => logMethod.apply(console, [l]));
      this.getGroupEndMethod().apply(console, []);
    }
  }
}

const instance = new Logger();

export const Log = instance;
