interface ITask {
  runnable: () => unknown | PromiseLike<unknown>;
  resolve: (value: unknown | PromiseLike<unknown>) => void;
  reject: (reason?: unknown) => void;
}

// Task queue that executes tasks serially.
export class TaskQueue {
  private queue: ITask[];
  private currentTask?: ITask;

  public constructor() {
    this.queue = [];
  }

  public postAsync<T>(taskFunction: () => T | Promise<T>): Promise<T> {
    const taskItem: Partial<ITask> = {
      runnable: taskFunction,
      resolve: undefined,
      reject: undefined,
    };
    const result = new Promise((resolve, reject) => {
      // Extract resolve and reject to control the promise from the executor
      taskItem.resolve = resolve.bind(undefined);
      taskItem.reject = reject.bind(undefined);
    }) as Promise<T>;
    this.queue.push(taskItem as ITask);
    this.scheduleNextTask();
    return result;
  }

  private scheduleNextTask(): void {
    setTimeout(() => {
      this.executeNextTask();
    }, 0);
  }

  private executeNextTask(): void {
    if (this.currentTask) {
      return;
    }

    const task = this.queue.shift();
    if (!task) {
      return;
    }

    this.currentTask = task;

    let result: unknown;
    try {
      result = task.runnable();
    } catch (e) {
      this.taskCompleted(task, false, undefined, e);
      return;
    }

    if (result instanceof Promise) {
      result
        .then(promiseResult => {
          this.taskCompleted(task, true, promiseResult, undefined);
        })
        .catch(promiseError => {
          this.taskCompleted(task, false, undefined, promiseError);
        });
    } else {
      this.taskCompleted(task, true, result, undefined);
    }
  }

  private taskCompleted(task: ITask, success: boolean, result?: unknown, error?: unknown): void {
    if (success) {
      task.resolve(result);
    } else if (error !== undefined) {
      task.reject(error);
    } else {
      task.reject(new Error("Internal task queue error"));
    }

    if (this.currentTask === task) {
      this.currentTask = undefined;
    }

    if (this.queue.length > 0) {
      // Move on to the next task
      this.scheduleNextTask();
    }
  }
}
