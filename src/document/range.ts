import {
    Position,
    Range,
    TextDocumentChangeEvent,
    TextDocumentContentChangeEvent,
} from 'vscode';

interface EndRangeDeletionContext {
    endPositionIsTheSame: boolean;
    endPositionIsBefore: boolean;
    endPositionIsAfter: boolean;
}

interface DeletionContext {
    isMultilineDeletion: boolean;
    doesFullyContainDeletion: boolean;
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

    public static fromPositions(start: Position, end: Position): RangePlus {
        return new RangePlus(start, end);
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

    public update(contentChange: TextDocumentContentChangeEvent): RangePlus {
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

export default RangePlus;
