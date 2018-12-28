import { Aggregate } from './aggregate.js'
import { CalendarEvent } from './calendar_event.js'
import { TYPES, CALENDAR_ID, WORKING_DAY_START, WORKING_DAY_END } from './constants.js'
import { TaskQueue } from './task_queue.js'

function getStartOfWeek(date: Date): Date {
    const x = new Date(date);
    x.setHours(0, 0, 0);
    x.setDate(x.getDate() - x.getDay());
    return x;
}

function getDurationOverlappingWorkDay(start: Date, end: Date, day: Date) {
    const startOfDay = new Date(day);
    startOfDay.setHours(WORKING_DAY_START, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(WORKING_DAY_END, 0, 0);
    const startTime = Math.max(startOfDay.getTime(), start.getTime());
    const endTime = Math.min(endOfDay.getTime(), end.getTime());

    // No overlap.
    if (endTime - startTime < 0)
        return 0;
    return endTime - startTime;
}

function aggregateByWeek(aggregates: Aggregate[]) {
    const weekly: Aggregate[] = [];
    let currentWeekStart = getStartOfWeek(aggregates[0].start);
    let minutesPerType: Map<string, number> = new Map();

    for (let aggregate of aggregates) {
        const aggregateWeekStart = getStartOfWeek(aggregate.start);
        if (aggregateWeekStart.getTime() != currentWeekStart.getTime()) {
            weekly.push(new Aggregate(
                new Date(currentWeekStart), minutesPerType));
            minutesPerType = new Map();
            currentWeekStart = aggregateWeekStart;
        }
        for (let type of TYPES.keys()) {
            if (!minutesPerType.has(type))
                minutesPerType.set(type, 0);

            let aggregateValue = aggregate.minutesPerType.get(type);
            if (!aggregateValue)
                aggregateValue = 0;

            minutesPerType.set(type,
                minutesPerType.get(type)! + aggregateValue);
        }
    }
    weekly.push(new Aggregate(new Date(currentWeekStart), minutesPerType));
    return weekly;
}

function eventsToAggregates(events: CalendarEvent[]): Aggregate[] {
    enum EVENT_CHANGE {
        EVENT_START,
        EVENT_END,
        EVENT_WORKDAY,
    }

    interface EventChange {
        ts: Date,
        type: EVENT_CHANGE,
        event: CalendarEvent | null,
    }

    const eventChanges: EventChange[] = [];
    for (let event of events) {
        eventChanges.push({
            ts: event.start,
            type: EVENT_CHANGE.EVENT_START,
            event: event
        });
        eventChanges.push({
            ts: new Date(event.start.getTime() + event.duration),
            type: EVENT_CHANGE.EVENT_END,
            event: event,
        });
    }

    function sortEvents(a: EventChange, b: EventChange) {
        return a.ts.getTime() - b.ts.getTime();
    }
    // TODO - eliminate multiple sorts.
    eventChanges.sort(sortEvents)

    // Insert event changes at the beginning and end of the work
    // day. Needed for multi-day events to work.
    const firstDay = new Date(events[0].start);
    const lastDay = new Date(events[events.length - 1].start);

    // TODO - insert a change at the beginning and end of each day
    // and handle empty event change regions.
    for (const curDay = firstDay;
        curDay.getTime() <= lastDay.getTime();
        curDay.setDate(curDay.getDate() + 1)) {
        const dayStart = new Date(curDay);
        dayStart.setHours(WORKING_DAY_START, 0, 0);
        const dayEnd = new Date(curDay);
        dayEnd.setHours(WORKING_DAY_END, 0, 0);

        eventChanges.push({
            ts: dayStart,
            type: EVENT_CHANGE.EVENT_WORKDAY,
            event: null
        })
        eventChanges.push({
            ts: dayEnd,
            type: EVENT_CHANGE.EVENT_WORKDAY,
            event: null
        })
    }

    eventChanges.sort(sortEvents)

    const day = new Date(events[0].start);
    day.setHours(0, 0, 0);

    const aggregates: Aggregate[] = [];
    const inProgressEvents: Set<CalendarEvent> = new Set();
    let ts = day;

    let minutesPerType: Map<string, number> = new Map();

    for (let eventChange of eventChanges) {
        //if (day.toString() == new Date(2018,7,20).toString())
        //    debugger;
        let primaryInProgressEvents = Array.from(inProgressEvents);
        // OOO events take priority.
        const ooo = primaryInProgressEvents.filter(
            e => e.isOOOEvent());
        if (ooo.length !== 0) {
            primaryInProgressEvents = ooo;
        } else {
            // Otherwise, prioritize short events.
            const minInProgressDuration =
                primaryInProgressEvents.reduce((min, event) => {
                    return Math.min(event.duration, min);
                }, Infinity);

            primaryInProgressEvents = primaryInProgressEvents.filter(event => {
                return event.duration == minInProgressDuration
            })
        }
        const durationMinutes = getDurationOverlappingWorkDay(ts, eventChange.ts, day) / 60 / 1000;

        for (let inProgressEvent of primaryInProgressEvents) {
            if (!minutesPerType.has(inProgressEvent.type)) {
                minutesPerType.set(inProgressEvent.type, 0);
            }
            minutesPerType.set(inProgressEvent.type,
                minutesPerType.get(inProgressEvent.type)! +
                durationMinutes / primaryInProgressEvents.length);
        }

        if (eventChange.type == EVENT_CHANGE.EVENT_START) {
            if (eventChange.event === null)
                throw("Event start with null event.")
            inProgressEvents.add(eventChange.event);
        } else if (eventChange.type == EVENT_CHANGE.EVENT_END) {
            if (eventChange.event === null)
                throw("Event end with null event.")
            inProgressEvents.delete(eventChange.event)
        }
        ts = eventChange.ts;
        const tsDay = new Date(ts);
        tsDay.setHours(0, 0, 0);
        if (tsDay.getTime() != day.getTime()) {
            if (day.getDay() != 0 && day.getDay() != 6)
                aggregates.push(new Aggregate(new Date(day), minutesPerType));
            minutesPerType = new Map();
            day.setDate(day.getDate() + 1);
        }
    }
    for (let aggregate of aggregates) {
        aggregate.addTotalNonMeetingTime();
    }
    return aggregates;
}

export class Calendar {
    private events: CalendarEvent[] = [];
    private dayAggregates: Aggregate[] | null = null;
    private weekAggregates: Aggregate[] | null = null;

    private fetchingEvents: boolean = true;
    private onReceiveEventsChunkResolves: ((cs:CalendarEvent[]) => void)[] = [];
    private dayAggregateResolves: ((as:Aggregate[]) => void)[] = [];
    private weekAggregateResolves: ((as:Aggregate[]) => void)[] = [];

    getDayAggregates() : Promise<Aggregate[]>{
        if (this.dayAggregates !== null) {
            return new Promise(resolve => resolve(this.dayAggregates!));
        }
        return new Promise(resolve => {
            this.dayAggregateResolves.push(resolve);
        })
    }

    getWeekAggregates() : Promise<Aggregate[]>{
        if (this.weekAggregates !== null) {
            return new Promise(resolve => resolve(this.weekAggregates!));
        }
        return new Promise(resolve => {
            this.weekAggregateResolves.push(resolve);
        })
    }

    gotEventsChunk(events: CalendarEvent[]) {
        this.events = this.events.concat(events);
        for (const resolve of this.onReceiveEventsChunkResolves) {
            resolve(events);
        }
    }

    getEventsChunk() : Promise<CalendarEvent[]> {
        return new Promise((resolve) => {
            this.onReceiveEventsChunkResolves.push(resolve);
        })
    }

    async fetchEvents() {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 365);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 365);

        let pageToken = null;
        let pendingEvents: CalendarEvent[] = [];

        while (true) {
            const request = {
                calendarId: CALENDAR_ID,
                timeMin: startDate.toISOString(),
                timeMax: endDate.toISOString(),
                showDeleted: false,
                singleEvents: true,
                maxResults: 500, // Max is 2500.
                orderBy: 'startTime' as 'startTime',
                pageToken: undefined as string | undefined,
            }
            if (pageToken)
                request.pageToken = pageToken;

            let response = await gapi.client.calendar.events.list(request);

            pendingEvents =
                response.result.items.map(
                        i => new CalendarEvent(i)).filter(
                            e =>!e.getShouldIgnore());

            this.gotEventsChunk(pendingEvents);

            pageToken = response.result.nextPageToken;
            if (!pageToken)
                break;
        }
        this.events.sort(
            (a, b) => a.start.getTime() - b.start.getTime());
        this.fetchingEvents = false;
    }

    async colorizeEvents() {
        const taskQueue = new TaskQueue(3);
        for await (const event of this.getEvents()) {
            taskQueue.queueTask(() => event.setToTargetColor());
        };
    }

    async init() {
        await this.fetchEvents();
        this.dayAggregates = eventsToAggregates(this.events);
        this.weekAggregates = aggregateByWeek(this.dayAggregates);
        for (const resolve of this.dayAggregateResolves)
            resolve(this.dayAggregates);
        for (const resolve of this.weekAggregateResolves)
            resolve(this.weekAggregates);
    }

    async* getEvents() {
        for (const event of this.events)
            yield event;

        while (true) {
            if (!this.fetchingEvents)
                return;
            let events : CalendarEvent[] =
                await this.getEventsChunk();
            for (const event of events)
                yield event;
        }
    }
}