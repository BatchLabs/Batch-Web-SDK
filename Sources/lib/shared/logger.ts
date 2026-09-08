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

export interface ILoggerEntryEventDetail {
  level: LogLevel;
  levelName: keyof typeof LogLevel;
  module: string;
  prefix: string;
  args: unknown[];
  timestamp: number;
}

const publicModuleName = "public";
export const LOGGER_ENTRY_EVENT_NAME = "___batchSDK___.logger.entry";
export const LOGGER_WRITE_EVENT_NAME = "___batchSDK___.logger.write";

class Logger {
  public level: LogLevel;
  public name: string; // the SDK name
  private enabledModules: Set<string>;
  private disabledModules: Set<string>;
  private tunnelingTo?: Window | MessagePort;
  private hasGlobalEventListeners: boolean;

  public constructor() {
    this.level = LogLevel.PublicError;
    this.enabledModules = new Set();
    this.disabledModules = new Set();
    this.name = "SDK";
    this.hasGlobalEventListeners = false;

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
          this.level = level;
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
      } catch (e: unknown) {
        console.warn("Batch SDK: failed to parse logger module settings from localStorage:", e);
      }
    }
  }

  public addGlobalEventListeners(): void {
    if (this.hasGlobalEventListeners) {
      return;
    }

    const safeWindow = safeGetWindow();
    if (safeWindow == null) {
      return;
    }
    this.hasGlobalEventListeners = true;
    safeWindow.addEventListener("___batchSDK___.logger.enableModule", (e: ILoggerInternalEvent) => this.enableModule(e.module));
    safeWindow.addEventListener("___batchSDK___.logger.disableModule", (e: ILoggerInternalEvent) => this.disableModule(e.module));
    safeWindow.addEventListener("___batchSDK___.logger.setLogLevel", (e: ILoggerInternalEvent) => {
      this.level = this.parseLogLevel(e.level);
    });
    safeWindow.addEventListener(LOGGER_WRITE_EVENT_NAME, event => {
      const detail = (event as CustomEvent<{ level?: unknown; module?: unknown; args?: unknown }>).detail;
      if (!detail) {
        return;
      }

      const level = this.parseLogLevel(detail.level);
      const module = typeof detail.module === "string" ? detail.module : publicModuleName;
      const args = Array.isArray(detail.args) ? detail.args : [];
      this.log(level, module, ...args);
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
  private getGroupMethod(): (...data: unknown[]) => void {
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
    if (level === LogLevel.Public || level === LogLevel.PublicError) {
      moduleName = publicModuleName;
    }

    if (this.isModuleEnabled(moduleName) && this.shouldLogForLevel(level)) {
      const prefix = this.formatPrefix(moduleName);
      this.logMethodForLevel(level).apply(console, [prefix + " -", ...args]);
      this.emitEntry(level, moduleName, prefix, args);
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

  private emitEntry(level: LogLevel, moduleName: string, prefix: string, args: unknown[]): void {
    const detail: ILoggerEntryEventDetail = {
      level,
      levelName: LogLevel[level] as keyof typeof LogLevel,
      module: moduleName,
      prefix,
      args: this.serializeArgs(args),
      timestamp: Date.now(),
    };

    if (this.tunnelingTo && "postMessage" in this.tunnelingTo) {
      this.tunnelingTo.postMessage({
        type: LOGGER_ENTRY_EVENT_NAME,
        detail,
      });
    }

    const safeWindow = safeGetWindow();
    if (safeWindow == null || typeof safeWindow.dispatchEvent !== "function") {
      return;
    }

    safeWindow.dispatchEvent(new CustomEvent<ILoggerEntryEventDetail>(LOGGER_ENTRY_EVENT_NAME, { detail }));
  }

  private serializeArgs(args: unknown[]): unknown[] {
    const serialized: unknown[] = [];
    args.forEach((v: unknown) => {
      switch (typeof v) {
        case "number":
        case "string":
        case "boolean":
          serialized.push(v);
          break;
        case "object": {
          try {
            serialized.push(v ? "[" + v.toString() + "]" : null);
          } catch (_e) {
            serialized.push("[No toString method]");
          }
          break;
        }
        default:
          serialized.push("[Unsupported type " + typeof v + "]");
      }
    });
    return serialized;
  }

  private parseLogLevel(level: unknown): LogLevel {
    const value = typeof level === "string" ? level.toLowerCase() : "";
    switch (value) {
      case "none":
        return LogLevel.None;
      case "public":
        return LogLevel.Public;
      case "publicerror":
        return LogLevel.PublicError;
      case "error":
        return LogLevel.Error;
      case "warn":
        return LogLevel.Warn;
      case "info":
        return LogLevel.Info;
      case "trace":
        return LogLevel.Trace;
      case "debug":
        return LogLevel.Debug;
      default:
        // Historical contract of the setLogLevel window event: an unknown level
        // enables everything rather than silently disabling logging.
        return LogLevel.Debug;
    }
  }
}

const instance = new Logger();

export const Log = instance;
