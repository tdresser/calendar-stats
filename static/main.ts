import { CalendarEvent } from './calendar_event.js'
import { TYPES, CALENDAR_ID, WORKING_DAY_START, WORKING_DAY_END } from './constants.js'
import { Aggregate } from './aggregate.js'
import { TaskQueue } from './task_queue.js'
import { Charter } from './charter.js';

const CLIENT_ID = "960408234665-mr7v9joc0ckj65eju460e04mji08dsd7.apps.googleusercontent.com";
const API_KEY = "AIzaSyDZ2rBkT9mfS-zSrkovKw74hd_HmNBSahQ";

let authorizeButton: HTMLElement;
let signoutButton: HTMLElement;

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
    "https://sheets.googleapis.com/$discovery/rest?version=v4",
];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets";

/**
 *  On load, called to load the auth2 library and API client library.
 */
function main() {
    let authorizeButtonNullable = document.getElementById('authorize_button');
    if (authorizeButtonNullable == null)
        throw ('No authorize button found.')
    authorizeButton = authorizeButtonNullable;
    let signoutButtonNullable = document.getElementById('signout_button');
    if (signoutButtonNullable == null)
        throw ('No signout button found.')
    signoutButton = signoutButtonNullable;

    gapi.load('client:auth2', initClient);
}

main();

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }, function (error: Error) {
        console.log(JSON.stringify(error, null, 2));
    });
}

function getStartOfWeek(date: Date): Date {
    const x = new Date(date);
    x.setHours(0, 0, 0);
    x.setDate(x.getDate() - x.getDay());
    return x;
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

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
async function updateSigninStatus(isSignedIn: boolean) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        const events = [];
        const taskQueue = new TaskQueue(4);
        for await (const event of getEvents()) {
            taskQueue.queueTask(() => event.setToTargetColor());
            events.push(event);
        };
        events.sort((a, b) => a.start.getTime() - b.start.getTime());
        const days = eventsToAggregates(events);
        //writeToSheet(days);
        const charter = new Charter();
        await charter.init();
        charter.chartData(days, "day_plot");
        charter.chartData(aggregateByWeek(days), "week_plot");
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
    }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

const SHEET_ID = "1iHkcf56qpi0BtK2L5FFFKO3n5Ph1uJrFiaLNGzwZj68";
const RANGE = "A:Z";

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

// @ts-ignore (to ignore unused)
async function writeToSheet(days: Aggregate[]) {
    const valueRange: {
        range: string,
        majorDimension: string,
        values: string[][]
    } = {
        range: RANGE,
        majorDimension: 'ROWS',
        values: [],
    }

    const labelRow = ["Day"].concat(Array.from(TYPES.keys()));
    valueRange.values.push(labelRow);
    for (const day of days) {
        valueRange.values.push(day.toRow());
    }

    // @ts-ignore
    let response = await gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: RANGE,
    }, {
            spreadsheetId: SHEET_ID,
            //clearedRange: RANGE,
        });

    // @ts-ignore
    response = await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: RANGE,
        valueInputOption: "USER_ENTERED",
    },
        valueRange);
};

async function* getEvents() {
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

        const promise = gapi.client.calendar.events.list(request);
        while (true) {
            const event = pendingEvents.pop();
            if (!event)
                break;
            yield event;
        }

        const response = await promise;
        pendingEvents =
            response.result.items.map(
                    i => new CalendarEvent(i)).filter(
                        e =>!e.getShouldIgnore());

        pageToken = response.result.nextPageToken;
        if (!pageToken)
            break;
    }
}