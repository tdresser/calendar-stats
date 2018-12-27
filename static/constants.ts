export const TYPE_MEETING_RECURRING = "Recurring meeting";
export const TYPE_MEETING_NON_RECURRING = "Non-recurring meeting";
export const TYPE_ONE_ON_ONE_RECURRING = "Recurring one on one";
export const TYPE_ONE_ON_ONE_NON_RECURRING = "Non-recurring one on one";
export const TYPE_FOCUS_RECURRING = "Recurring focus block";
export const TYPE_FOCUS_NON_RECURRING = "Non-recurring focus block";
export const TYPE_UNBOOKED = "Unbooked time";
export const TYPE_OOO = "OOO"
export const CALENDAR_ID = "primary";

export const TYPES : Map<string, number> = new Map([
    [TYPE_MEETING_RECURRING, 3],        // #dbadff
    [TYPE_MEETING_NON_RECURRING, 11],   // #dc2127
    [TYPE_ONE_ON_ONE_RECURRING, 10],    // #51b749
    [TYPE_ONE_ON_ONE_NON_RECURRING, 4], // #ff7537
    [TYPE_FOCUS_RECURRING, 1],          // #a4bdfc
    [TYPE_FOCUS_NON_RECURRING, 2],      // #7ae7bf
    [TYPE_UNBOOKED, 8],                 // #e1e1e1
    [TYPE_OOO, 5],                      // #fbd75b
]);

//1: #a4bdfc
//2: #7ae7bf
//3: #dbadff
//4: #ff887c
//5: #fbd75b
//6: #ffb878
//7: #46d6db
//8: #e1e1e1
//9: #5484ed
//10: #51b749
//11: #dc2127
