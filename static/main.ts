import { CalendarEvent } from './calendar_event.js'

const CLIENT_ID = "960408234665-mr7v9joc0ckj65eju460e04mji08dsd7.apps.googleusercontent.com";
const API_KEY = "AIzaSyDZ2rBkT9mfS-zSrkovKw74hd_HmNBSahQ";

let authorizeButton : HTMLElement;
let signoutButton : HTMLElement;

function init() {
    let authorizeButtonNullable = document.getElementById('authorize_button');
    if (authorizeButtonNullable == null)
      throw('No authorize button found.')
    authorizeButton = authorizeButtonNullable;
    let signoutButtonNullable = document.getElementById('signout_button');
    if (signoutButtonNullable == null)
      throw('No signout button found.')
    signoutButton = signoutButtonNullable;
}

init();

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

/**
 *  On load, called to load the auth2 library and API client library.
 */
function main() {
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

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
async function updateSigninStatus(isSignedIn: boolean) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        console.log(JSON.stringify(await getEvents()));
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

//const SHEET_ID = "1iHkcf56qpi0BtK2L5FFFKO3n5Ph1uJrFiaLNGzwZj68";
//const RANGE = "A:Z";
const USERNAME = "tdresser";



// TODO - only things I accepted.
// TODO - split out recurring.



/*function writeToSheet() {
  const valueRange = Sheets.newValueRange();
  valueRange.values = [];
  const events = getEvents();

  // TODO - maybe tiebreak on duration?
  events.sort((a, b) => {
    let delta = a.start.getTime() - b.start.getTime();
    if (delta == 0)
      return a.duration - b.duration;
    return delta;
  })

  const minDay = events[0].day;
  const maxDay = events[events.length - 1].day;
  const days = [];

  //valueRange.values = valueRange.values.concat([[JSON.stringify(events)]]);

  let day = minDay;

  for (let day = minDay; day.getTime() <= maxDay.getTime(); day.setDate(day.getDate() + 1)) {
    // Skip weekends.
    if (day.getDay() == 0 || day.getDay() == 6) {
      continue;
    }
    const dayEvents = [];
    // TODO - figure out how to compare date.
    while (events.length && events[0].day.getTime() == day.getTime()) {
      dayEvents.push(events.shift());
    }
    // Make sure to copy date so we don't end up mutating it later.
    days.push(new Day(new Date(day.getTime()), dayEvents));
  }

  const labelRow = ["Day"].concat(TYPES);
  valueRange.values.push(labelRow);
  for (const day of days) {
    valueRange.values.push(day.toRow());
  }

  Sheets.Spreadsheets.Values.clear({}, SHEET_ID, RANGE);
  const result = Sheets.Spreadsheets.Values.update(valueRange, SHEET_ID, RANGE, {
    valueInputOption: "RAW"
  });
};*/

function parseDate(dateString: string): Date {
    let parts = dateString.split('T');
    parts[0] = parts[0].replace(/-/g, '/');
    return new Date(parts.join(' '));
}

async function getEvents() {
    const events = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);
    const endDate = new Date();
    const calendarId = 'primary';

    //@ts-ignore
    const response = await gapi.client.calendar.events.list({
        calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        showDeleted: false,
        singleEvents: true,
        //maxResults: 1000000,
        maxResults: 100,
        orderBy: 'startTime',
    });

    const items = response.result.items;
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

        const oneOnOnAttendee = item.attendees.length == 1 ? item.attendees[0].displayName : null;

        const myAttendees = item.attendees.filter(
            (x: any) => x.email.includes(USERNAME));

        console.log(item.summary)
        console.log(item.attendees);
        console.log(item.organizer);
        console.log(item.creator);
        console.log(myAttendees)

        //if (myAttendees.length == 0) {
        //    continue;
        //}

        const myResponse = "foo";//myAttendees[0].responseStatus;

        if (item.attendees.length) {
            events.push(new CalendarEvent(
                item.summary,
                parseDate(start),
                parseDate(end),
                myResponse,
                oneOnOnAttendee,
            ));
        }
    };
    return events;
}