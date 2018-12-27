type Task = () => Promise<void>;

export class TaskQueue {
    maxTasks: number;
    tasks: Task[] = [];
    inProgressTaskCount = 0;
    resolves: (() => void)[] = [];

    constructor(maxTasks: number) {
        this.maxTasks = maxTasks;
    }

    async doTasks() {
        if (this.inProgressTaskCount >= this.maxTasks)
            return;
        let task = this.tasks.pop();
        if (task === undefined) {
            for (let resolve of this.resolves)
              resolve();
            return;
        }
        this.inProgressTaskCount++;

        task().then(() => {
            this.inProgressTaskCount--;
            this.doTasks();
        });
        this.doTasks();
    }

    async queueTask(task: Task) {
        const shouldStart = this.tasks.length == 0;
        this.tasks.push(task);
        if (shouldStart)
            this.doTasks();
    }

    flush() {
        return new Promise(resolve => {
            this.resolves.push(resolve);
        });
    }
}