import {
    Disposable,
    Location,
    Position,
    TextDocumentChangeEvent,
    Uri,
    Range,
    workspace,
    window,
    EventEmitter,
    TextEditor,
    TextEditorDecorationType,
    DecorationRenderOptions,
    TextEditorSelectionChangeEvent,
    TextDocument,
    TextDocumentContentChangeEvent,
} from 'vscode';
import RangePlus, { SerializedRangePlus } from './range';
import { isTextDocument } from '../lib';
import { debounce } from '../../lib';

export enum TypeOfChange {
    RANGE_ONLY,
    CONTENT_ONLY,
    RANGE_AND_CONTENT,
    NO_CHANGE,
}

export interface LocationPlusOptions {
    id?: string;
    textEditorDecoration?: TextEditorDecorationType;
    doc?: TextDocument;
    rangeFromTextDocumentContentChangeEvent?: TextDocumentContentChangeEvent;
}

export interface SerializedLocationPlus {
    fsPath: string;
    range: SerializedRangePlus;
    content: string;
    id?: string;
}

export interface PreviousRangeContent {
    oldRange: RangePlus;
    oldContent: string;
}

export interface ChangeEvent {
    location: LocationPlus;
    typeOfChange: TypeOfChange;
    previousRangeContent: PreviousRangeContent;
}

export default class LocationPlus extends Location {
    _disposable: Disposable;
    _range: RangePlus;
    _content: string;
    _id?: string;
    _textEditorDecoration?: TextEditorDecorationType;
    onDelete: EventEmitter<LocationPlus> = new EventEmitter<LocationPlus>();
    onChanged: EventEmitter<ChangeEvent> = new EventEmitter<ChangeEvent>();
    onSelected: EventEmitter<LocationPlus> = new EventEmitter<LocationPlus>();
    constructor(
        uri: Uri,
        rangeOrPosition: Range | Position,
        opts?: LocationPlusOptions
    ) {
        super(uri, rangeOrPosition);

        this._range =
            rangeOrPosition instanceof Range
                ? RangePlus.fromRange(rangeOrPosition)
                : rangeOrPosition instanceof Position
                ? RangePlus.fromPosition(rangeOrPosition)
                : RangePlus.fromLineNumbers(0, 0, 0, 0); // may just want to throw an error instead
        const debouncedOnTextDocumentChanged = debounce(
            (e: TextDocumentChangeEvent) => this.onTextDocumentChanged(e),
            500 // Adjust the debounce time (in milliseconds) to your needs
        );

        this._disposable = Disposable.from(
            workspace.onDidChangeTextDocument(
                (e) => debouncedOnTextDocumentChanged(e),
                this
            ),
            window.onDidChangeActiveTextEditor(
                this.onDidChangeActiveTextEditor,
                this
            ),
            window.onDidChangeVisibleTextEditors(
                this.onDidChangeVisibleTextEditors,
                this
            ),
            window.onDidChangeTextEditorSelection(
                this.onDidChangeTextEditorSelection,
                this
            ),
            this._range.onDelete.event((range: RangePlus) => {
                this._disposable.dispose();
                this.onDelete.fire(this);
            })
        );
        this._content = '';
        if (opts) {
            opts.id && this.setId(opts.id);
            opts.textEditorDecoration &&
                this.setTextEditorDecoration(opts.textEditorDecoration);
            opts.doc && this.updateContent(opts.doc);
            opts.rangeFromTextDocumentContentChangeEvent &&
                (this._range = RangePlus.fromTextDocumentContentChangeEvent(
                    opts.rangeFromTextDocumentContentChangeEvent
                ));
        }
    }

    public static fromLocation(location: Location, opts?: LocationPlusOptions) {
        return new LocationPlus(location.uri, location.range, opts);
    }

    dispose() {
        this._disposable.dispose();
    }

    get content(): string {
        return this._content;
    }

    get id(): string | undefined {
        return this._id;
    }

    public setId(id: string) {
        if (!this._id) {
            this._id = id;
        } else {
            throw new Error('Cannot set id more than once');
        }
    }

    get textEditorDecoration(): TextEditorDecorationType | undefined {
        return this._textEditorDecoration;
    }

    public setTextEditorDecoration(
        textEditorDecoration: TextEditorDecorationType | undefined
    ) {
        this._textEditorDecoration = textEditorDecoration;
    }

    createTextEditorDecorationType(renderOpts: DecorationRenderOptions) {
        this._textEditorDecoration =
            window.createTextEditorDecorationType(renderOpts);
    }

    private applyDecorations(textEditor: TextEditor) {
        if (this._textEditorDecoration) {
            textEditor.setDecorations(this._textEditorDecoration, [
                this._range,
            ]);
        }
    }

    updateContent(textEditorOrDocument: TextEditor | TextDocument) {
        this._content = isTextDocument(textEditorOrDocument)
            ? textEditorOrDocument.getText(this._range)
            : textEditorOrDocument.document.getText(this._range);
    }

    private getTypeOfChange(
        oldRange: RangePlus,
        oldContent: string,
        contentChangeRange: RangePlus
    ) {
        const newRange = this._range;
        const newContent = this._content;
        const cleanedNewContent = newContent.replace(/\s/g, '');
        const cleanedOldContent = oldContent.replace(/\s/g, '');
        if (
            !oldRange.isEqual(newRange) &&
            cleanedOldContent !== cleanedNewContent &&
            oldRange.contains(contentChangeRange)
        ) {
            return TypeOfChange.RANGE_AND_CONTENT;
        } else if (!oldRange.isEqual(newRange)) {
            return TypeOfChange.RANGE_ONLY;
        } else if (
            cleanedOldContent !== cleanedNewContent &&
            oldRange.contains(contentChangeRange)
        ) {
            return TypeOfChange.CONTENT_ONLY;
        } else {
            return TypeOfChange.NO_CHANGE;
        }
    }

    onTextDocumentChanged(
        onTextDocumentChanged: TextDocumentChangeEvent,
        thisArg?: any
    ) {
        // debounce(() => {
        const { document, contentChanges } = onTextDocumentChanged;
        if (this.uri.fsPath === document.uri.fsPath) {
            for (const change of contentChanges) {
                const oldRange = this._range.copy();
                const oldContent = this._content;
                const previousRangeContent: PreviousRangeContent = {
                    oldRange,
                    oldContent,
                };
                const updated = this._range.update(change);
                this._range = RangePlus.fromRange(
                    document.validateRange(updated)
                );
                const furtherNormalizedStart =
                    document.getWordRangeAtPosition(this._range.start) ||
                    this._range;
                const furtherNormalizedEnd =
                    document.getWordRangeAtPosition(this._range.end) ||
                    this._range;
                this._range = RangePlus.fromPositions(
                    furtherNormalizedStart.start,
                    furtherNormalizedEnd.end
                );
                this._content = document.getText(this._range);
                // if (
                //     !this._range.isEqual(oldRange) ||
                //     this._content !== oldContent
                // ) {
                const contentChangeRange =
                    RangePlus.fromTextDocumentContentChangeEvent(change);
                const typeOfChange = this.getTypeOfChange(
                    oldRange,
                    oldContent,
                    contentChangeRange
                );
                // console.log('this is firing', this);
                this.onChanged.fire({
                    location: this,
                    typeOfChange,
                    previousRangeContent,
                });
                // }
                this.range = this._range;
                this._range.updateRangeLength(document);
            }
        }
        // });
    }

    onDidChangeActiveTextEditor(textEditor: TextEditor | undefined) {
        if (textEditor && textEditor.document.uri.fsPath === this.uri.fsPath) {
            this.updateContent(textEditor);
            this.applyDecorations(textEditor);
        }
    }

    onDidChangeVisibleTextEditors(textEditors: readonly TextEditor[]) {
        const matchingEditor = textEditors.find(
            (textEditor) => textEditor.document.uri.fsPath === this.uri.fsPath
        );
        if (matchingEditor) {
            this.updateContent(matchingEditor);
            this.applyDecorations(matchingEditor);
        }
    }

    onDidChangeTextEditorSelection(
        selectionEvent: TextEditorSelectionChangeEvent
    ) {
        if (selectionEvent.textEditor.document.uri.fsPath === this.uri.fsPath) {
            const { selections } = selectionEvent;
            const selection = selections[0];
            if (this._range.contains(selection.active)) {
                this.onSelected.fire(this);
            }
        }
    }

    serialize(): SerializedLocationPlus {
        return {
            fsPath: this.uri.fsPath,
            range: this._range.serialize(),
            content: this._content,
        };
    }

    static deserialize(serializedLocationPlus: SerializedLocationPlus) {
        // tbd what to do with content here
        const { fsPath, range, content, id } = serializedLocationPlus;
        const newLocationPlus = id
            ? new LocationPlus(Uri.file(fsPath), RangePlus.deserialize(range), {
                  id,
              })
            : new LocationPlus(Uri.file(fsPath), RangePlus.deserialize(range));
        newLocationPlus._content = content;
        return newLocationPlus;
    }

    // assume same file
    compare(other: LocationPlus) {
        return this._range.compare(other._range);
    }
}
