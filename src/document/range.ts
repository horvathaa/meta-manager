import {
    Disposable,
    Position,
    Range,
    TextDocumentChangeEvent,
    TextDocumentContentChangeEvent,
    workspace,
} from 'vscode';

interface Delta {
    lineDelta: number;
    characterDelta: number;
}

interface EndRangeDeletionContext {
    endPositionIsTheSame: boolean;
    endPositionIsBefore: boolean;
    endPositionIsAfter: boolean;
}

interface DeletionContext {
    isMultilineDeletion: boolean;
    doesFullyContainDeletion: boolean;
    deletionFullyContains: boolean;
    deletionEndsBefore: boolean;
    deletionStartsBefore: boolean;
    deletionEndsOnOrAfter: boolean;
    deletionStartsOnOrAfter: boolean;
}

interface ChangeContext {
    isOurRangeSingleLine: boolean;
    isTheirRangeSingleLine: boolean;
    isDeletion: boolean | DeletionContext;
}

class RangePlus extends Range {
    public constructor(
        public readonly start: Position,
        public readonly end: Position
    ) {
        super(start, end);
    }

    public static fromRange(range: Range): RangePlus {
        return new RangePlus(range.start, range.end);
    }

    public static fromPosition(position: Position): RangePlus {
        return new RangePlus(position, position);
    }

    public static fromPositions(start: Position, end: Position): RangePlus {
        return new RangePlus(start, end);
    }

    public static fromTextDocumentContentChangeEvent(
        textDocumentContentChangeEvent: TextDocumentContentChangeEvent
    ): RangePlus {
        // deletion
        if (
            !textDocumentContentChangeEvent.range.start.isEqual(
                textDocumentContentChangeEvent.range.end
            )
        ) {
            return RangePlus.fromRange(textDocumentContentChangeEvent.range);
        } // addition
        else {
            const { range, text } = textDocumentContentChangeEvent;
            const numNewlines = text.split('\n').length - 1;
            if (numNewlines) {
                return RangePlus.fromPositions(
                    range.start,
                    range.end.translate(
                        numNewlines,
                        text.substring(text.lastIndexOf('\n')).length
                    )
                );
            } else {
                return RangePlus.fromPositions(
                    range.start,
                    range.end.translate(0, text.length)
                );
            }
        }
    }

    public static fromLineNumbers(
        startLine: number,
        startChar: number,
        endLine: number,
        endChar: number
    ): RangePlus {
        return new RangePlus(
            new Position(startLine, startChar),
            new Position(endLine, endChar)
        );
    }

    public startsBefore(range: Range): boolean {
        return this.start.isBefore(range.start);
    }

    public startsAfter(range: Range): boolean {
        return this.start.isAfter(range.start);
    }

    public endsBefore(range: Range): boolean {
        return this.end.isBefore(range.end);
    }

    public endsAfter(range: Range): boolean {
        return this.end.isAfter(range.end);
    }

    public isBefore(range: Range): boolean {
        return this.end.isBefore(range.start);
    }

    public isAfter(range: Range): boolean {
        return this.start.isAfter(range.end);
    }

    public isBeforeNotSameLine(range: Range): boolean {
        return this.end.line < range.start.line;
    }

    public isBeforeSameLine(range: Range): boolean {
        return this.end.line === range.start.line && !this.doesTouchEnd(range);
    }

    public isAfterNotSameLine(range: Range): boolean {
        return this.start.line > range.end.line;
    }

    public isAfterSameLine(range: Range): boolean {
        return (
            this.start.line === range.end.line && !this.doesTouchStart(range)
        );
    }

    public isAfterSameLineTouchingStart(range: Range): boolean {
        return this.start.line === range.end.line && this.doesTouchStart(range);
    }

    public doesFullyContain(range: Range): boolean {
        return this.contains(range.start) && this.contains(range.end);
    }

    public doesIntersect(range: Range): boolean {
        return this.contains(range.start) || this.contains(range.end);
    }

    public doesTouchEnd(range: Range): boolean {
        return this.end.isEqual(range.start);
    }

    public doesTouchStart(range: Range): boolean {
        return this.start.isEqual(range.end);
    }

    public getIntersection(range: Range): RangePlus {
        if (this.doesIntersect(range)) {
            return RangePlus.fromPositions(
                this.start.isBefore(range.start) ? range.start : this.start,
                this.end.isBefore(range.end) ? this.end : range.end
            );
        }
        return RangePlus.fromPositions(new Position(0, 0), new Position(0, 0));
    }

    public getUnion(range: Range): RangePlus {
        return RangePlus.fromPositions(
            this.start.isBefore(range.start) ? this.start : range.start,
            this.end.isBefore(range.end) ? range.end : this.end
        );
    }

    public getDifferenceFromStart = (position: Position): Delta => {
        return {
            lineDelta: position.line - this.start.line,
            characterDelta: position.character - this.start.character,
        };
    };

    public getDifferenceFromEnd = (position: Position): Delta => {
        return {
            lineDelta: position.line - this.end.line,
            characterDelta: position.character - this.end.character,
        };
    };

    public update(contentChange: TextDocumentContentChangeEvent): RangePlus {
        const contentChangeRange =
            RangePlus.fromTextDocumentContentChangeEvent(contentChange);
        return this;
        // if (contentChange.text.length) {
        //     // return this.updateWithAddition(contentChange);
        // } else {
        //     return this.updateWithDeletion(contentChange);
        // }
    }

    private updateWithDeletion(contentChange: TextDocumentContentChangeEvent) {
        return this;
    }

    private updateWithAddition(
        contentChange: TextDocumentContentChangeEvent,
        changeContext: ChangeContext
    ): RangePlus {
        const { range, text } = contentChange;
        // const context = {
        //     isOurRangeSingleLine: this.isSingleLine,
        //     isTheirRangeSingleLine: range.isSingleLine,
        //     isDeletion
        // }

        // not impacted
        if (this.end.isBefore(range.start)) {
            return this;
        }

        const numNewlines = text.split('\n').length - 1;
        if (this.start.isAfter(range.end)) {
            return RangePlus.fromPositions(
                this.start.translate(numNewlines, 0),
                this.end.translate(numNewlines, 0)
            );
        }

        if (this.doesIntersect(range)) {
            // return RangePlus.fromPositions(
            //     this.start.isBefore(range.start) ? this.start : this.start.translate(numNewlines, contentChange.text.length),
        }
        return this;
    }

    private getCharacterDeltaAddition(
        contentChange: TextDocumentContentChangeEvent
    ): number {
        const { text } = contentChange;
        const numNewlines = text.split('\n').length - 1;
        const numChars = numNewlines
            ? text.substring(text.lastIndexOf('\n')).length
            : text.length - numNewlines;
        return numChars;
    }

    private getCharacterDeltaDeletion(
        contentChange: TextDocumentContentChangeEvent
    ): number {
        const { range } = contentChange;
        const numNewlines = range.end.line - range.start.line;
        const numChars = numNewlines
            ? range.end.character + range.start.character
            : range.end.character - range.start.character;
        return numChars;
    }
}

export const getContentChangeContext = (
    contentChange: TextDocumentContentChangeEvent,
    changeRange: RangePlus,
    ourRange: RangePlus
) => {
    return {
        isAddition: contentChange.text.length > 0,
        isSinglineLineChange: changeRange.isSingleLine,
        rangeIntersectionType: getRangeIntersectionType(changeRange, ourRange),
    };
};

enum RangeIntersectionType {
    STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME,
    STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START,
    STARTS_BEFORE_ENDS_AFTER_OUR_START,
    STARTS_BEFORE_ENDS_AFTER_OUR_END,
    STARTS_ON_OUR_START_ENDS_BEFORE_OUR_END,
    STARTS_ON_OUR_START_ENDS_ON_OUR_END,
    STARTS_ON_OUR_START_ENDS_AFTER_OUR_END,
    STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END,
    STARTS_AFTER_OUR_START_ENDS_ON_OUR_END,
    STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END,
    STARTS_AFTER_OUR_END_ENDS_AFTER_OUR_END,
}

const getRangeIntersectionType = (
    changeRange: RangePlus,
    ourRange: RangePlus
) => {
    if (ourRange.isBefore(changeRange)) {
        return RangeIntersectionType.STARTS_AFTER_OUR_END_ENDS_AFTER_OUR_END;
    }
    if (ourRange.isAfter(changeRange)) {
        if (ourRange.isAfterNotSameLine(changeRange)) {
            return RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME;
        } else if (ourRange.isAfterSameLine(changeRange)) {
            return RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START;
        }
    }
    if (
        ourRange.startsBefore(changeRange) &&
        ourRange.doesIntersect(changeRange)
    ) {
        if (ourRange.endsAfter(changeRange)) {
            return RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END;
        }
        if (ourRange.endsBefore(changeRange)) {
            return RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END;
        }
    }
    if (ourRange.startsAfter(changeRange)) {
        if (ourRange.endsAfter(changeRange)) {
            return RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_START;
        } else if (ourRange.endsBefore(changeRange)) {
            return RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_END;
        }
    }
    // if (changeRange.isBefore(ourRange)) {
    //     if (changeRange.isBeforeNotSameLine(ourRange)) {
    //         return RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME;
    //     } else if (changeRange.isBeforeSameLine(ourRange)) {
    //         return RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START;
    //     }
    // }
    // if (changeRange.isAfter(ourRange)) {
    //     return RangeIntersectionType.STARTS_AFTER_OUR_END_ENDS_AFTER_OUR_END;
    // }
};

export default RangePlus;
