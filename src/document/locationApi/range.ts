import {
    EventEmitter,
    Position,
    Range,
    TextDocument,
    TextDocumentContentChangeEvent,
} from 'vscode';
import { SerializedRangePlus } from '../../constants/types';

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
    UNKNOWN,
}

interface Delta {
    lineDelta: number;
    characterDelta: number;
}

export interface CompareDelta {
    startDelta: Delta;
    endDelta: Delta;
}

interface ContentChangeContext {
    isAddition: boolean;
    isSingleLineChange: boolean;
    rangeIntersectionType: RangeIntersectionType;
    isPaste?: boolean;
}

class RangePlus extends Range {
    _rangeLength: number;
    onDelete: EventEmitter<RangePlus>;
    public constructor(
        public readonly _start: Position,
        public readonly _end: Position
    ) {
        super(_start, _end);
        this._rangeLength = 0;
        this.onDelete = new EventEmitter<RangePlus>();
    }

    public get rangeLength(): number {
        return this._rangeLength;
    }

    public set rangeLength(value: number) {
        this._rangeLength = value;
    }

    public computeRangeLength(doc: TextDocument): number {
        return doc.offsetAt(this.end) - doc.offsetAt(this.start);
    }

    public updateRangeLength(doc: TextDocument): void {
        this._rangeLength = this.computeRangeLength(doc);
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

    public translate(range: Range) {
        return RangePlus.fromLineNumbers(
            this.start.line + range.start.line,
            this.start.line === range.start.line
                ? this.start.character + range.start.character
                : range.start.character,
            this.start.line + range.end.line,
            this.start.line === range.end.line
                ? this.start.character + range.end.character
                : range.end.character
        );
    }

    public static fromRangeAndText(range: Range, text: string) {
        const numNewlines = text.split('\n').length - 1;
        if (numNewlines) {
            const end = new Position(
                range.start.line + numNewlines,
                text.substring(text.lastIndexOf('\n')).length
            );
            return RangePlus.fromPositions(range.start, end);
        } else {
            return RangePlus.fromPositions(
                range.start,
                range.end.translate(0, text.length)
            );
        }
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
            return RangePlus.fromRangeAndText(range, text);
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

    public copy(): RangePlus {
        return RangePlus.fromPositions(this.start, this.end);
    }

    public serialize(): SerializedRangePlus {
        return {
            start: {
                line: this.start.line,
                character: this.start.character,
            },
            end: {
                line: this.end.line,
                character: this.end.character,
            },
        };
    }

    public static deserialize(
        serializedRangePlus: SerializedRangePlus
    ): RangePlus {
        return RangePlus.fromLineNumbers(
            serializedRangePlus.start.line,
            serializedRangePlus.start.character,
            serializedRangePlus.end.line,
            serializedRangePlus.end.character
        );
    }

    public compare(range: Range): CompareDelta {
        return {
            startDelta: this.getDifferenceFromStart(range.start),
            endDelta: this.getDifferenceFromEnd(range.end),
        };
    }

    public update(
        contentChange: TextDocumentContentChangeEvent,
        debug = false
    ): RangePlus {
        const contentChangeRange =
            RangePlus.fromTextDocumentContentChangeEvent(contentChange);
        const changeContext = getContentChangeContext(
            contentChange,
            contentChangeRange,
            this
        );
        // debug &&
        //     console.log(
        //         'changeContext',
        //         changeContext,
        //         'contentChangeRange',
        //         contentChangeRange,
        //         'our range',
        //         this
        //     );
        if (
            changeContext.rangeIntersectionType ===
                RangeIntersectionType.UNKNOWN ||
            changeContext.rangeIntersectionType ===
                RangeIntersectionType.STARTS_AFTER_OUR_END_ENDS_AFTER_OUR_END
        ) {
            return this;
        }
        if (changeContext.isPaste) {
            const res = this.updateWithDeletion(
                contentChange,
                contentChangeRange,
                changeContext
            );
            const copy = {
                ...contentChange,
                range: new Range(
                    contentChangeRange.start,
                    contentChangeRange.start
                ),
            };
            const newRange = RangePlus.fromTextDocumentContentChangeEvent(copy);
            const newChangeContext = getContentChangeContext(
                copy,
                newRange,
                res
            );

            const postAddition = res.updateWithAddition(
                copy,
                newRange,
                newChangeContext
            );
            return postAddition;
        }
        if (!changeContext.isAddition) {
            const res = this.updateWithDeletion(
                contentChange,
                contentChangeRange,
                changeContext
            );
            return res;
        }

        const res = this.updateWithAddition(
            contentChange,
            contentChangeRange,
            changeContext
        );

        return res;
    }

    private singleLineAndSingleLineChangeDeletion(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ) {
        const { rangeIntersectionType } = changeContext;
        const { rangeLength } = contentChange;
        switch (rangeIntersectionType) {
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME:
                return this;
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START:
                return RangePlus.fromPositions(
                    this.start.translate(0, -rangeLength),
                    this.end.translate(0, -rangeLength)
                );
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_START:
                return RangePlus.fromPositions(
                    contentChangeRange.start,
                    this.end.translate(0, -rangeLength)
                );
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_END:
                this.onDelete.fire(this);
                return this;
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END:
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_BEFORE_OUR_END:
                return RangePlus.fromPositions(
                    this.start,
                    this.end.translate(0, -rangeLength)
                );
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END:
                return RangePlus.fromPositions(
                    this.start,
                    contentChangeRange.start
                );
        }
        return this;
    }

    private multiLineAndSingleLineChangeDeletion(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ) {
        const { rangeIntersectionType } = changeContext;
        const { rangeLength } = contentChange;
        switch (rangeIntersectionType) {
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME:
                return this;
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START:
                return RangePlus.fromPositions(
                    this.start.translate(0, -rangeLength),
                    this.end
                );
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_START:
                return RangePlus.fromPositions(
                    contentChangeRange.start,
                    this.end
                );
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END:
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END:
                if (
                    this.end.line === contentChangeRange.start.line &&
                    contentChangeRange.contains(this.end)
                ) {
                    return RangePlus.fromPositions(
                        this.start,
                        contentChangeRange.start
                    );
                } else if (
                    this.end.line === contentChangeRange.start.line &&
                    this.contains(contentChangeRange.end)
                ) {
                    return RangePlus.fromPositions(
                        this.start,
                        this.end.translate(0, -rangeLength)
                    );
                } else {
                    return this;
                }
        }
        return this;
    }

    private singleLineAndMultiLineChangeDeletion(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ) {
        const { rangeIntersectionType } = changeContext;
        const lineDifference =
            contentChangeRange.end.line - contentChangeRange.start.line;
        switch (rangeIntersectionType) {
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME:
                return RangePlus.fromPositions(
                    this.start.translate(lineDifference, 0),
                    this.end.translate(lineDifference, 0)
                );
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START: {
                const { characterDelta } = this.getDifferenceFromStart(
                    contentChangeRange.end
                );
                const newStart = new Position(
                    contentChangeRange.start.line,
                    contentChangeRange.start.character - characterDelta
                );
                const newEnd = new Position(
                    contentChangeRange.start.line,
                    newStart.character + this.rangeLength
                );
                return RangePlus.fromPositions(newStart, newEnd);
            }
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_START:
                const newEnd = new Position(
                    contentChangeRange.start.line,
                    contentChangeRange.start.character + this.rangeLength
                );
                return RangePlus.fromPositions(
                    contentChangeRange.start,
                    newEnd
                );
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_END:
                this.onDelete.fire(this);
                return this;
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END:
                return RangePlus.fromPositions(
                    this.start,
                    contentChangeRange.start
                );
        }
        return this;
    }

    private multiLineAndMultiLineChangeDeletion(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ) {
        const { rangeIntersectionType } = changeContext;
        const lineDifference =
            -1 * (contentChangeRange.end.line - contentChangeRange.start.line);
        switch (rangeIntersectionType) {
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME:
                return RangePlus.fromPositions(
                    this.start.translate(lineDifference, 0),
                    this.end.translate(lineDifference, 0)
                );
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START: {
                const { characterDelta } = this.getDifferenceFromStart(
                    contentChangeRange.end
                );
                const newStart = new Position(
                    contentChangeRange.start.line,
                    contentChangeRange.start.character - characterDelta
                );

                return RangePlus.fromPositions(
                    newStart,
                    this.end.translate(lineDifference, 0)
                );
            }
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_START:
                return RangePlus.fromPositions(
                    contentChangeRange.start,
                    this.end.translate(lineDifference, 0)
                );
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_END:
                this.onDelete.fire(this);
                return this;
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END:
                return RangePlus.fromPositions(
                    this.start,
                    contentChangeRange.start
                );
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END:
                if (this.end.line === contentChangeRange.end.line) {
                    const { characterDelta } = this.getDifferenceFromEnd(
                        contentChangeRange.end
                    );
                    const newEnd = contentChangeRange.start.translate(
                        0,
                        -characterDelta
                    );
                    return RangePlus.fromPositions(this.start, newEnd);
                }
                return RangePlus.fromPositions(
                    this.start,
                    this.end.translate(lineDifference, 0)
                );
        }
        return this;
    }

    private updateWithDeletion(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ): RangePlus {
        const { isSingleLineChange } = changeContext;
        if (this.isSingleLine && isSingleLineChange) {
            return this.singleLineAndSingleLineChangeDeletion(
                contentChange,
                contentChangeRange,
                changeContext
            );
        } else if (!this.isSingleLine && isSingleLineChange) {
            return this.multiLineAndSingleLineChangeDeletion(
                contentChange,
                contentChangeRange,
                changeContext
            );
        }

        if (this.isSingleLine && !isSingleLineChange) {
            return this.singleLineAndMultiLineChangeDeletion(
                contentChange,
                contentChangeRange,
                changeContext
            );
        } else if (!this.isSingleLine && !isSingleLineChange) {
            return this.multiLineAndMultiLineChangeDeletion(
                contentChange,
                contentChangeRange,
                changeContext
            );
        }
        // should never get here
        return this;
    }

    private singleLineAndSingleLineChangeAddition(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ) {
        const { rangeIntersectionType } = changeContext;
        const { text } = contentChange;
        switch (rangeIntersectionType) {
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME:
                return this;
            default:
                return this.start.isEqual(contentChangeRange.start)
                    ? RangePlus.fromPositions(
                          this.start,
                          this.end.translate(0, text.length)
                      )
                    : RangePlus.fromPositions(
                          this.start.translate(0, text.length),
                          this.end.translate(0, text.length)
                      );
        }
    }

    private multiLineAndSingleLineChangeAddition(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ) {
        const { rangeIntersectionType } = changeContext;
        const { text } = contentChange;
        switch (rangeIntersectionType) {
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME:
                return this;
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_START:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START:
                return this.start.isEqual(contentChangeRange.start)
                    ? this
                    : RangePlus.fromPositions(
                          this.start.translate(0, text.length),
                          this.end
                      );
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END:
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END:
                return this.end.line === contentChangeRange.start.line &&
                    this.end.isBeforeOrEqual(contentChangeRange.start)
                    ? RangePlus.fromPositions(
                          this.start,
                          this.end.translate(0, text.length)
                      )
                    : this;
            default:
                return this;
        }
    }

    private singleLineAndMultiLineChangeAddition(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ) {
        const { rangeIntersectionType } = changeContext;
        const { text } = contentChange;
        const numNewlines = text.split('\n').length - 1;
        const endTextLength = text.substring(text.lastIndexOf('\n')).length;
        switch (rangeIntersectionType) {
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME:
                return RangePlus.fromPositions(
                    this.start.translate(numNewlines, 0),
                    this.end.translate(numNewlines, 0)
                );
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_END:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_START:
                return RangePlus.fromPositions(
                    this.start.translate(numNewlines, endTextLength),
                    this.end.translate(numNewlines, endTextLength)
                );
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_AFTER_OUR_END:
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_BEFORE_OUR_END:
                return RangePlus.fromPositions(
                    this.start,
                    this.end.translate(
                        numNewlines,
                        endTextLength + this._rangeLength
                    )
                );
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END:
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END:
                const splitRangeLen =
                    this.end.character - contentChangeRange.start.character;
                return RangePlus.fromPositions(
                    this.start,
                    this.end.translate(
                        numNewlines,
                        contentChangeRange.end.character + splitRangeLen
                    )
                );
        }
        return this;
    }

    private multiLineAndMultiLineChangeAddition(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ) {
        const { rangeIntersectionType } = changeContext;
        const { text } = contentChange;
        const numNewlines = text.split('\n').length - 1;
        const endTextLength = text.substring(text.lastIndexOf('\n')).length;
        switch (rangeIntersectionType) {
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_ON_SAME_LINE_AS_OUR_START:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_BEFORE_NO_LINES_SAME:
                return RangePlus.fromPositions(
                    this.start.translate(numNewlines, 0),
                    this.end.translate(numNewlines, 0)
                );
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_END:
            case RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_START:
                return RangePlus.fromPositions(
                    this.start.translate(numNewlines, endTextLength),
                    this.end.translate(numNewlines, endTextLength)
                );
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_AFTER_OUR_END:
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_ON_OUR_START_ENDS_BEFORE_OUR_END:
                return RangePlus.fromPositions(
                    this.start,
                    this.end.translate(
                        numNewlines,
                        endTextLength + this._rangeLength
                    )
                );
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_BEFORE_OUR_END:
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_ON_OUR_END:
            case RangeIntersectionType.STARTS_AFTER_OUR_START_ENDS_AFTER_OUR_END:
                if (this.end.line === contentChangeRange.start.line) {
                    const translateDif = endTextLength - this.end.character;
                    return RangePlus.fromPositions(
                        this.start,
                        this.end.translate(numNewlines, translateDif)
                    );
                } else {
                    return RangePlus.fromPositions(
                        this.start,
                        this.end.translate(numNewlines, 0)
                    );
                }
        }
        return this;
    }

    private updateWithAddition(
        contentChange: TextDocumentContentChangeEvent,
        contentChangeRange: RangePlus,
        changeContext: ContentChangeContext
    ): RangePlus {
        const { isSingleLineChange } = changeContext;
        if (this.isSingleLine && isSingleLineChange) {
            return this.singleLineAndSingleLineChangeAddition(
                contentChange,
                contentChangeRange,
                changeContext
            );
        } else if (!this.isSingleLine && isSingleLineChange) {
            return this.multiLineAndSingleLineChangeAddition(
                contentChange,
                contentChangeRange,
                changeContext
            );
        }

        if (this.isSingleLine && !isSingleLineChange) {
            // multiline change
            return this.singleLineAndMultiLineChangeAddition(
                contentChange,
                contentChangeRange,
                changeContext
            );
        } else {
            return this.multiLineAndMultiLineChangeAddition(
                contentChange,
                contentChangeRange,
                changeContext
            );
            // multiline change
        }
    }
}

export const getContentChangeContext = (
    contentChange: TextDocumentContentChangeEvent,
    changeRange: RangePlus,
    ourRange: RangePlus
): ContentChangeContext => {
    return {
        isAddition: contentChange.text.length > 0,
        isSingleLineChange: changeRange.isSingleLine,
        rangeIntersectionType: getRangeIntersectionType(changeRange, ourRange),
        isPaste: contentChange.text.length > 0 && !contentChange.range.isEmpty,
    };
};

const getRangeIntersectionType = (
    changeRange: RangePlus,
    ourRange: RangePlus
) => {
    if (ourRange.isBefore(changeRange)) {
        return RangeIntersectionType.STARTS_AFTER_OUR_END_ENDS_AFTER_OUR_END;
    }
    if (ourRange.isEqual(changeRange)) {
        return RangeIntersectionType.STARTS_ON_OUR_START_ENDS_ON_OUR_END;
    }
    if (changeRange.contains(ourRange)) {
        return RangeIntersectionType.STARTS_BEFORE_ENDS_AFTER_OUR_END;
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
    return RangeIntersectionType.UNKNOWN;
};

export default RangePlus;
