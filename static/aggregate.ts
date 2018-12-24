import { TYPES, TYPE_UNBOOKED } from './constants.js';

export class Aggregate {
    start: Date;
    minutesPerType: number[];
    constructor(start : Date, minutesPerType : number[]) {
      this.start = start;
      this.minutesPerType = minutesPerType;
    }

    addTotalNonMeetingTime() {
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
        this.start.toDateString()].concat(
          this.minutesPerType.map(x => x.toString()));
    }
  }