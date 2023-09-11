import { SerializedLocationPlus, SerializedRangePlus } from '../types/types';

export const getRangeOfNumbers = (location: SerializedLocationPlus) => {
    const { range } = location;
    const { start, end } = range;
    const { line: startLine } = start;
    const { line: endLine } = end;
    const rangeOfNumbers = [];
    for (let i = startLine; i <= endLine; i++) {
        rangeOfNumbers.push(i);
    }
    return rangeOfNumbers;
};

export const getRangeFromSubstring = (
    starterRange: SerializedRangePlus,
    code: string,
    substring: string
) => {
    if (!substring.length) {
        return starterRange;
    }
    const idx = code.indexOf(substring);
    const strSplit = code.split('\n');
    const linesInSubstring = substring.split('\n');
    const line = strSplit.findIndex((s) => s.includes(linesInSubstring[0]));
    const char = strSplit[line].indexOf(linesInSubstring[0]);
    const endLen = linesInSubstring[linesInSubstring.length - 1].length;

    return {
        start: {
            line: starterRange.start.line + line,
            character: char,
        },
        end: {
            line: starterRange.start.line + line + linesInSubstring.length - 1,
            character: endLen,
        },
    };
};
