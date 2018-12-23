import { TYPES, TYPE_UNBOOKED } from './constants.js';

export class Day {
    day: Date;
    minutesPerType: number[];
    constructor(day : Date, minutesPerType : number[]) {
      this.day = day;
      this.minutesPerType = minutesPerType;

      let totalMeetingTime = 0;
      for (let typeId = 0; typeId < TYPES.length; ++typeId) {
        totalMeetingTime += this.minutesPerType[typeId];
      }

      if (totalMeetingTime > 8 * 60) {
        debugger;
        throw("Too much total meeting time");
      }

      let totalNonMeetingTime = 8*60 - totalMeetingTime;
      if (totalNonMeetingTime < 0)
        totalNonMeetingTime = 0;

      this.minutesPerType[TYPES.indexOf(TYPE_UNBOOKED)] = totalNonMeetingTime;
    }

    toRow() {
      return [
        this.day.toDateString()].concat(
          this.minutesPerType.map(x => x.toString()));
    }
  }