/* eslint-env jest */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { TaskQueue } from "../task-queue";

describe("Task Queue", () => {
  let taskQueue: TaskQueue;

  beforeAll(() => {
    taskQueue = new TaskQueue();
  });

  it("executes synchronous tasks", () => {
    const result = 12345;
    expect(taskQueue.postAsync(() => result)).resolves.toEqual(result);
  });

  it("executes asynchronous tasks", () => {
    const result = 12345;
    expect(
      taskQueue.postAsync(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(result);
          }, 50);
        });
      })
    ).resolves.toEqual(result);
  });

  it("should handle failed tasks", () => {
    const expectedError = new Error("test error");

    expect(
      taskQueue.postAsync(() => {
        throw expectedError;
      })
    ).rejects.toThrowError(expectedError);

    expect(
      taskQueue.postAsync(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(expectedError);
          }, 50);
        });
      })
    ).rejects.toThrowError(expectedError);
  });

  it("should chain tasks sequentially", async () => {
    const immediateTask = (): number => {
      return 2;
    };

    let controlablePromiseResolve: any = undefined;
    const controlledPromise = new Promise(resolve => {
      controlablePromiseResolve = resolve;
    });

    // Test that our logic to wait for the task queue to execute works
    let firstTaskDone = false;
    const firstTask = taskQueue.postAsync(immediateTask).then(() => {
      firstTaskDone = true;
    });
    const controlledTask = taskQueue.postAsync(() => controlledPromise);
    let thirdTaskDone = false;
    const thirdTask = taskQueue.postAsync(immediateTask).then(() => {
      thirdTaskDone = true;
    });
    await firstTask;

    expect(firstTaskDone).toBe(true);
    expect(thirdTaskDone).toBe(false);

    controlablePromiseResolve(undefined);

    await controlledTask;

    // Kinda racing the runtime here, but it should never be true
    expect(thirdTaskDone).toBe(false);

    await thirdTask;
    expect(thirdTaskDone).toBe(true);
  });

  it("should execute async tasks in the right order", async () => {
    const expected: number[] = [];
    const actual: number[] = [];
    let lastTask: any;
    for (let i = 0; i < 20; i++) {
      expected.push(i);
      lastTask = taskQueue.postAsync(() => {
        actual.push(i);
        return new Promise(resolve => {
          setTimeout(
            () => {
              resolve(undefined);
            },
            Math.ceil(Math.random() * 45)
          );
        });
      });
    }

    await lastTask;
    expect(actual).toEqual(expected);
  });

  it("should chain tasks even if they're erroring", async () => {
    // We need to stop errored promises from bubbling as this will make the test fail
    const postCaughtPromise = (promise: any): any => {
      taskQueue.postAsync(promise).catch(() => {});
    };

    let expectedSuccesses = 0;
    let successCount = 0;
    const postSuccessTask = (): any => {
      expectedSuccesses++;
      return taskQueue.postAsync(() => "success").then(() => successCount++);
    };

    postSuccessTask();
    postCaughtPromise(() => {
      throw "err";
    });
    postSuccessTask();
    postCaughtPromise(() => Promise.reject("err"));
    postCaughtPromise(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject("err");
        }, 20);
      });
    });

    await postSuccessTask();
    expect(successCount).toEqual(expectedSuccesses);
  });
});
