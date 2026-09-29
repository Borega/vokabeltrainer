// Wiederholungsplanung: die gemeinsame Logik steht in public/schedule.js, damit der Browser
// beim Lernen ohne Internet genauso plant wie der Server.
import * as FSRS from 'ts-fsrs';
import { SAFE_LEVEL, createScheduler, levelFor } from '../public/schedule.js';

export const { GRADES, review } = createScheduler(FSRS);
export { SAFE_LEVEL, levelFor };
export const { State } = FSRS;
