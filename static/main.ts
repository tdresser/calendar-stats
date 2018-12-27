import { CalendarEvent } from './calendar_event.js'
import { TYPES, CALENDAR_ID } from './constants.js'
import { Aggregate } from './aggregate.js'
import { TaskQueue } from './task_queue.js'

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

function hexToRGB(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
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
    let minutesPerType : Map<string, number> = new Map();

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

async function chartData(aggregates: Aggregate[], divId: string) {
    const colors = await getColors();
    const dates = aggregates.map(day => day.start);

    interface PlotlySeries {
        x: Date[],
        y: number[],
        name: string,
        type: string,
        marker: {
            color: string,
        }
    }
    const data: PlotlySeries[] = [];

    for (let type of TYPES.keys()) {
        const ys = aggregates.map(day => day.minutesPerType.get(type)!);
        data.push({
            x: dates,
            y: ys,
            name: type,
            type: "bar",
            marker: {
                color: hexToRGB(colors[TYPES.get(type)].background),
            }
        });
    }

    // @ts-ignore
    Plotly.newPlot(divId, data, { barmode: 'stack' });
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
        const taskQueue = new TaskQueue(10);
        for await (const event of getEvents()) {
            taskQueue.queueTask(() => event.setToTargetColor());
            events.push(event);
        };
        events.sort((a, b) => a.start.getTime() - b.start.getTime());
        const days = eventsToAggregates(events);
        //writeToSheet(days);
        chartData(days, "day_plot");
        chartData(aggregateByWeek(days), "week_plot");
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
    startOfDay.setHours(9, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(17, 0, 0);
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
    }

    interface EventChange {
        ts: Date,
        type: EVENT_CHANGE,
        event: CalendarEvent
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

    eventChanges.sort((a: EventChange, b: EventChange) => {
        return a.ts.getTime() - b.ts.getTime();
    })

    const aggregates: Aggregate[] = [];
    const day = new Date(events[0].start);
    day.setHours(0, 0, 0);
    const inProgressEvents: Set<CalendarEvent> = new Set();
    let ts = day;

    let minutesPerType: Map<string, number> = new Map();

    for (let eventChange of eventChanges) {
        let primaryInProgressEvents = Array.from(inProgressEvents);
        const minInProgressDuration =
            primaryInProgressEvents.reduce((min, event) => {
                return Math.min(event.duration, min);
            }, Infinity);

        primaryInProgressEvents = primaryInProgressEvents.filter(event => {
            return event.duration == minInProgressDuration
        })

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
            inProgressEvents.add(eventChange.event);
        } else if (eventChange.type == EVENT_CHANGE.EVENT_END) {
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

async function getColors() {
    //@ts-ignore
    let response = await gapi.client.calendar.colors.get({
        calendarId: CALENDAR_ID,
    });
    return response.result.event;
}

async function* getEvents() {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 50);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 0);

    let pageToken = null;
    let pendingEvents: CalendarEvent[] = [];

    // TODO - start streaming things.
    while (true) {
        const request = {
            calendarId: CALENDAR_ID,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            showDeleted: false,
            singleEvents: true,
            maxResults: 100, //2500, // Max.
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
            response.result.items.filter(
                e => e.transparency != "transparent").map(
                    i => new CalendarEvent(i));

        pageToken = response.result.nextPageToken;
        if (!pageToken)
            break;
    }
}