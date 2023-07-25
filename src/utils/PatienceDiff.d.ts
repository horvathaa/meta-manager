/**
 * program: "patienceDiffPlus" algorithm implemented in javascript.
 * author: Jonathan Trent
 * version: 2.0
 *
 * use:  patienceDiffPlus( aLines[], bLines[] )
 *
 * where:
 *      aLines[] contains the original text lines.
 *      bLines[] contains the new text lines.
 *
 * returns an object with the following properties:
 *      lines[] with properties of:
 *          line containing the line of text from aLines or bLines.
 *          aIndex referencing the index in aLine[].
 *          bIndex referencing the index in bLines[].
 *              (Note:  The line is text from either aLines or bLines, with aIndex and bIndex
 *               referencing the original index. If aIndex === -1 then the line is new from bLines,
 *               and if bIndex === -1 then the line is old from aLines.)
 *          moved is true if the line was moved from elsewhere in aLines[] or bLines[].
 *      lineCountDeleted is the number of lines from aLines[] not appearing in bLines[].
 *      lineCountInserted is the number of lines from bLines[] not appearing in aLines[].
 *      lineCountMoved is the number of lines that moved.
 *
 */
export function patienceDiffPlus(aLines: any, bLines: any): {
    lines: any[];
    lineCountDeleted: number;
    lineCountInserted: number;
    lineCountMoved: number;
    aMove: any[];
    aMoveIndex: any[];
    bMove: any[];
    bMoveIndex: any[];
} | {
    lines: any[];
    lineCountDeleted: number;
    lineCountInserted: number;
    lineCountMoved: number;
    aMove?: undefined;
    aMoveIndex?: undefined;
    bMove?: undefined;
    bMoveIndex?: undefined;
};
