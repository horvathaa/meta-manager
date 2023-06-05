import {
    Disposable,
    Location,
    Position,
    TextDocumentChangeEvent,
    Uri,
    Range,
    workspace,
    EventEmitter,
} from 'vscode';
import RangePlus from './range';

export default class LocationPlus extends Location {
    _disposable: Disposable;
    _range: RangePlus;
    onDelete: EventEmitter<LocationPlus> = new EventEmitter<LocationPlus>();
    constructor(
        uri: Uri,
        rangeOrPosition: Range | Position,
        public readonly id?: string
    ) {
        super(uri, rangeOrPosition);

        this._range =
            rangeOrPosition instanceof Range
                ? RangePlus.fromRange(rangeOrPosition)
                : rangeOrPosition instanceof Position
                ? RangePlus.fromPosition(rangeOrPosition)
                : RangePlus.fromLineNumbers(0, 0, 0, 0); // may just want to throw an error instead
        this._disposable = Disposable.from(
            workspace.onDidChangeTextDocument(this.onTextDocumentChanged, this),
            this._range.onDelete.event((range: RangePlus) => {
                console.log('DELETED', range);
                this._disposable.dispose();
                this.onDelete.fire(this);
            })
        );
    }

    onTextDocumentChanged(onTextDocumentChanged: TextDocumentChangeEvent) {
        if (this.uri.fsPath === onTextDocumentChanged.document.uri.fsPath) {
            for (const change of onTextDocumentChanged.contentChanges) {
                this._range.updateRangeLength(onTextDocumentChanged.document);
                const oldRange = this._range.copy();
                this._range = RangePlus.fromRange(
                    onTextDocumentChanged.document.validateRange(
                        this._range.update(change)
                    )
                );
                const furtherNormalizedStart =
                    onTextDocumentChanged.document.getWordRangeAtPosition(
                        this._range.start
                    ) || this._range;
                const furtherNormalizedEnd =
                    onTextDocumentChanged.document.getWordRangeAtPosition(
                        this._range.end
                    ) || this._range;
                this._range = RangePlus.fromPositions(
                    furtherNormalizedStart.start,
                    furtherNormalizedEnd.end
                );
                if (!this._range.isEqual(oldRange)) {
                    console.log(
                        'OLD RANGE',
                        oldRange,
                        'NEW RANGE',
                        this._range
                    );
                }
                this._range.updateRangeLength(onTextDocumentChanged.document);
            }
        }
    }
}
