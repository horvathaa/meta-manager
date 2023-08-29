import { SerializedLocationPlus } from '../types/types';

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
