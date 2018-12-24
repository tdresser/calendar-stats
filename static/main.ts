import { CalendarEvent } from './calendar_event.js'
import { TYPES, TYPE_COLORS } from './constants.js'
import { Aggregate } from './aggregate.js'

const CLIENT_ID = "960408234665-mr7v9joc0ckj65eju460e04mji08dsd7.apps.googleusercontent.com";
const API_KEY = "AIzaSyDZ2rBkT9mfS-zSrkovKw74hd_HmNBSahQ";
const CALENDAR_ID = "primary";

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

    // @ts-ignore
    gapi.load('client:auth2', initClient);
}

main();

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
    // @ts-ignore TODO: Figure out how to get types for gapi client libraries.
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        // Listen for sign-in state changes.
        // @ts-ignore
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state.
        // @ts-ignore
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
    console.log(aggregateByWeek);
    const weekly: Aggregate[] = [];
    let currentWeekStart = getStartOfWeek(aggregates[0].start);
    let minutesPerType = new Array(TYPES.length).fill(0);

    for (let aggregate of aggregates) {
        const aggregateWeekStart = getStartOfWeek(aggregate.start);
        if (aggregateWeekStart.getTime() != currentWeekStart.getTime()) {
            weekly.push(new Aggregate(
                new Date(currentWeekStart), minutesPerType.slice()));
            currentWeekStart = aggregateWeekStart;
            minutesPerType.fill(0);
        }
        for (let typeIndex = 0; typeIndex < TYPES.length; ++typeIndex) {
            minutesPerType[typeIndex] += aggregate.minutesPerType[typeIndex];
        }
    }
    weekly.push(new Aggregate(new Date(currentWeekStart), minutesPerType));
    console.log(weekly);
    return weekly;
}

async function chartData(aggregates: Aggregate[], divId:string) {
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

    for (let type_index = 0; type_index < TYPES.length; ++type_index) {
        const ys = aggregates.map(day => day.minutesPerType[type_index]);
        data.push({
            x: dates,
            y: ys,
            name: TYPES[type_index],
            type: "bar",
            marker: {
                color: hexToRGB(colors[TYPE_COLORS[type_index]].background),
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
        const events = await getEvents();
        const days = eventsToAggregates(events);
        //writeToSheet(days);
        chartData(days, "day_plot");
        chartData(aggregateByWeek(days), "week_plot")
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
    }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
    // @ts-ignore
    gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
    // @ts-ignore
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

    let minutesPerType: number[] = new Array(TYPES.length).fill(0);

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
            minutesPerType[TYPES.indexOf(inProgressEvent.type)] +=
                durationMinutes / primaryInProgressEvents.length;
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
            minutesPerType = new Array(TYPES.length).fill(0);
            day.setDate(day.getDate() + 1);
        }
    }
    for (let aggregate of aggregates) {
        aggregate.addTotalNonMeetingTime();
    }
    return aggregates;
}

//@ts-ignore
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

    const labelRow = ["Day"].concat(TYPES);
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

function parseDate(dateString: string): Date {
    let parts = dateString.split('T');
    parts[0] = parts[0].replace(/-/g, '/');
    return new Date(parts.join(' '));
}

async function getColors() {
    //@ts-ignore
    let response = await gapi.client.calendar.colors.get({
        calendarId: CALENDAR_ID
    });

    return await response.result.calendar;
}

async function getEvents() {
    const events = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);
    const endDate = new Date();

    //@ts-ignore
    const response = await gapi.client.calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 1000000,
        //maxResults: 100,
        orderBy: 'startTime',
    });

    const items = response.result.items.filter(
        (e: any) => e.transparency != "transparent");

    for (const item of items) {
        let start = item.start.dateTime;
        if (!start)
            start = item.start.date;

        let end = item.end.dateTime;
        if (!end)
            end = item.end.date;

        if (!item.attendees)
            item.attendees = [];

        item.attendees = item.attendees.filter(
            (attendee: any) => !attendee.resource && !attendee.self)

        events.push(new CalendarEvent(
            item.summary,
            parseDate(start),
            parseDate(end),
            item.attendees.length,
            item.recurringEventId != null,
        ));
    };
    return events;
}