import {
    Disposable,
    Location,
    Position,
    TextDocumentChangeEvent,
    Uri,
    Range,
    workspace,
} from 'vscode';
import RangePlus from './range';

export default class LocationPlus extends Location {
    _disposable: Disposable;
    range: RangePlus;
    constructor(
        uri: Uri,
        rangeOrPosition: Range | Position,
        public readonly id?: string
    ) {
        super(uri, rangeOrPosition);
        this._disposable = Disposable.from(
            workspace.onDidChangeTextDocument(this.onTextDocumentChanged, this)
        );
        this.range =
            rangeOrPosition instanceof Range
                ? RangePlus.fromRange(rangeOrPosition)
                : rangeOrPosition instanceof Position
                ? RangePlus.fromPosition(rangeOrPosition)
                : RangePlus.fromLineNumbers(0, 0, 0, 0); // may just want to throw an error instead
    }

    onTextDocumentChanged(onTextDocumentChanged: TextDocumentChangeEvent) {
        if (this.uri.fsPath === onTextDocumentChanged.document.uri.fsPath) {
            for (const change of onTextDocumentChanged.contentChanges) {
                this.range = this.range.update(change);
            }
        }
    }
}
