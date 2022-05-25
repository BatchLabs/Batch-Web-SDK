import { isNumber, isString, isUnknownObject } from "com.batch.shared/helpers/primitive";
import { TaskQueue } from "com.batch.shared/helpers/task-queue";
import { LocalEventBus } from "com.batch.shared/local-event-bus";
import LocalSDKEvent from "com.batch.shared/local-sdk-events";
import { Log } from "com.batch.shared/logger";
import { ProbationManager } from "com.batch.shared/managers/probation-manager";
import { IComplexPersistenceProvider } from "com.batch.shared/persistence/persistence-provider";
import { hasUserDataChanged } from "com.batch.shared/user/user-data-diff";
import { BatchUserAttribute } from "com.batch.shared/user/user-data-public";
import { UserDataStorage } from "com.batch.shared/user/user-data-storage";
import { AttributesCheckService } from "com.batch.shared/webservice/attributes-check";
import { AttributesSendService } from "com.batch.shared/webservice/attributes-send";
import { IWebserviceExecutor } from "com.batch.shared/webservice/executor";
import { isAttributesCheckResponse } from "com.batch.shared/webservice/responses/attributes-check-response";
import { BatchSDK } from "public/types/public-api";

import { IOperation, UserAttributeEditor, UserAttributeType } from "./user-attribute-editor";
import { UserDataWriter } from "./user-data-writer";

const logModuleName = "User";

const MIN_ATTRIBUTES_CHECK_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes

export class UserModule {
  private probationManager;
  private persistence;
  private userDataStorage;
  private webserviceExecutor;
  // Task queue, ensuring that we handle persistence in a sequential way
  private taskQueue;

  public constructor(
    probationManager: ProbationManager,
    persistence: IComplexPersistenceProvider,
    webserviceExecutor: IWebserviceExecutor
  ) {
    this.probationManager = probationManager;
    this.persistence = persistence;
    this.userDataStorage = new UserDataStorage(this.persistence);
    this.webserviceExecutor = webserviceExecutor;
    this.taskQueue = new TaskQueue();

    LocalEventBus.subscribe(LocalSDKEvent.ExitedProbation, this.onExitedProbation.bind(this));
    LocalEventBus.subscribe(LocalSDKEvent.SessionStarted, this.onSessionStarted.bind(this));
  }

  // Returns the public-api version of the attributes
  public async getPublicAttributes(): Promise<{ [key: string]: BatchSDK.IUserAttribute }> {
    const privateAttributes = await this.userDataStorage.getAttributes();
    const publicAttributes: { [key: string]: BatchSDK.IUserAttribute } = {};

    for (const [key, typedValue] of Object.entries(privateAttributes)) {
      const type = typedValue.type;
      let value: unknown = typedValue.value;

      if (type === UserAttributeType.DATE) {
        // We can cast, storage is supposed to make sure that the value are coherent
        value = new Date(value as number);
      }

      publicAttributes[key] = new BatchUserAttribute(type, value);
    }

    return publicAttributes;
  }

  // Returns the public-api version of the tags
  public async getPublicTagCollections(): Promise<{ [key: string]: string[] }> {
    return await this.userDataStorage.getTagsAsArrays();
  }

  private onExitedProbation(): void {
    Log.debug(logModuleName, "User is out of probation, sending data.");
    this.scheduleAttributesSend();
  }

  private onSessionStarted(): void {
    this.scheduleAttributesCheck();
  }

  public editUserData(editor: UserAttributeEditor): void {
    // Immediatly send a task to the queue so that user data isn't subject to race conditions
    const operations = editor._getOperations();
    this.taskQueue.postAsync(() =>
      this.applyUserOperations(operations).catch(e => {
        Log.warn(logModuleName, "Failed to edit user data:", e);
      })
    );
  }

  private async applyUserOperations(operations: IOperation[]): Promise<void> {
    const oldAttributes = await this.userDataStorage.getAttributes();
    const oldTags = await this.userDataStorage.getTags();

    const userDataWriter = new UserDataWriter(oldAttributes, oldTags);
    const { attributes: newAttributes, tags: newTags } = await userDataWriter.applyOperations(operations);

    if (!hasUserDataChanged(oldAttributes, oldTags, newAttributes, newTags)) {
      Log.debug(logModuleName, "User saved data but no changes were detected.");
      return;
    }

    await Promise.all([
      this.userDataStorage.persistAttributes(newAttributes),
      this.userDataStorage.persistTags(newTags),
      // Data has been updated, any old TXID is irrelevant
      this.userDataStorage.removeTxid(),
      this.userDataStorage.removeLastCheckTimestamp(),
    ]);

    const isOutOfProbation = await this.probationManager.isOutOfProbation();
    // If we're in probation, version is always 1 as we're not gonna send the attributes
    if (!isOutOfProbation) {
      await this.userDataStorage.persistVersion(1);
      Log.debug(logModuleName, "User is in probation, not sending data.");
      return;
    }

    const newVersion = (await this.userDataStorage.getVersion()) + 1;
    await this.userDataStorage.persistVersion(newVersion);

    LocalEventBus.emit(LocalSDKEvent.DataChanged, null, true);

    this.scheduleAttributesSend();
  }

  // Schedule an attribute synchronization with the server.
  // VisibleForTesting
  protected scheduleAttributesSend(): void {
    this.taskQueue.postAsync(() =>
      this.sendAttributes().catch(e => {
        Log.error(logModuleName, "Could not synchronize user data with the server:", e);
      })
    );
  }

  // Send the latest attributes to the server
  private async sendAttributes(): Promise<void> {
    const attributes = await this.userDataStorage.getAttributes();
    const tags = await this.userDataStorage.getTags();
    const version = await this.userDataStorage.getVersion();

    if (version < 1) {
      // No attributes to send, skip
      return;
    }

    const txid = await this.userDataStorage.getTxid();
    if (txid) {
      // No need to send if we already have a txid
      return;
    }

    const response = await this.webserviceExecutor.start(new AttributesSendService(attributes, tags, version));

    if (!isUnknownObject(response)) {
      throw new Error("Internal Error: bad server response (code 1)");
    }

    const responseTrid = response["trid"];
    if (!isString(responseTrid) || responseTrid.length === 0) {
      throw new Error("Internal Error: bad server response (code 2)");
    }

    const responseVersion = response["ver"];
    if (!isNumber(responseVersion)) {
      throw new Error("Internal Error: bad server response (code 3)");
    }

    // This should never happen
    if (version !== responseVersion) {
      Log.debug(logModuleName, "Server replied a txid for the wrong version, ignoring it.");
      return;
    }

    await this.userDataStorage.persistTxid(responseTrid);
  }

  // VisibleForTesting
  protected scheduleAttributesCheck(): void {
    this.taskQueue.postAsync(async () => {
      const lastCheck = await this.userDataStorage.getLastCheckTimestamp();
      // Check once every 5 minutes
      if (lastCheck && lastCheck + MIN_ATTRIBUTES_CHECK_INTERVAL_MS >= Date.now()) {
        return;
      }

      await this.checkWithServer().catch(e => {
        Log.error(logModuleName, "Could not verify user data with the server:", e);
      });
    });
  }

  // VisibleForTesting
  protected async checkWithServer(): Promise<void> {
    const txid = await this.userDataStorage.getTxid();
    if (!txid) {
      return;
    }

    const ver = await this.userDataStorage.getVersion();
    if (ver < 1) {
      return;
    }

    const response = await this.webserviceExecutor.start(new AttributesCheckService(txid, ver));
    if (!isAttributesCheckResponse(response)) {
      throw new Error("Could not parse server response");
    }

    response.action = response.action.toUpperCase() as typeof response.action;
    switch (response.action) {
      case "OK":
        this.userDataStorage.persistLastCheckTimestamp(Date.now());
        return;
      case "BUMP":
        {
          const currentVersion = await this.userDataStorage.getVersion();
          if (response.ver >= currentVersion) {
            this.scheduleBumpVersion(currentVersion, response.ver);
          }
        }
        return;
      case "RESEND":
        this.resendAttributes();
        return;
      case "RECHECK":
        // Not implemented on purpose
        return;
    }
  }

  protected async resendAttributes(): Promise<void> {
    await this.userDataStorage.removeTxid();
    this.scheduleAttributesSend();
  }

  // VisibleForTesting
  protected scheduleBumpVersion(fromVersion: number, serverVersion: number): void {
    this.taskQueue.postAsync(() => this.bumpVersion(fromVersion, serverVersion));
  }

  // VisibleForTesting
  protected async bumpVersion(fromVersion: number, serverVersion: number): Promise<void> {
    // Since we operate in a task queue, make sure that the bump operation is atomic:
    // we need to check that the version hasn't changed since the check!
    const currentVersion = await this.userDataStorage.getVersion();
    if (currentVersion !== fromVersion) {
      Log.debug(logModuleName, "Version changed since server asked us to bump it, ignoring.");
      return;
    }

    await this.userDataStorage.persistVersion(serverVersion + 1);
    await this.userDataStorage.removeTxid();
    this.scheduleAttributesSend();
  }
}
