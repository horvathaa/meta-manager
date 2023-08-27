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
    Selection,
} from 'vscode';
import RangePlus from './range';
import { isTextDocument } from '../lib';
import { debounce } from '../../utils/lib';
import { SerializedLocationPlus } from '../../constants/types';

export enum TypeOfChange {
    RANGE_ONLY = 'RANGE_ONLY',
    CONTENT_ONLY = 'CONTENT_ONLY',
    RANGE_AND_CONTENT = 'RANGE_AND_CONTENT',
    NO_CHANGE = 'NO_CHANGE',
}

export interface LocationPlusOptions {
    id?: string;
    textEditorDecoration?: TextEditorDecorationType;
    doc?: TextDocument;
    rangeFromTextDocumentContentChangeEvent?: TextDocumentContentChangeEvent;
}

export interface PreviousRangeContent {
    oldRange: RangePlus;
    oldContent: string;
}

export interface ChangeEvent {
    location: LocationPlus;
    typeOfChange: TypeOfChange;
    previousRangeContent: PreviousRangeContent;
    originalChangeEvent: TextDocumentContentChangeEvent;
    addedContent?: string;
    removedContent?: string | null;
    isInsertion?: boolean;
    isRemoval?: boolean;
    removedRange?: Range;
    insertedRange?: RangePlus | null;
}

export default class LocationPlus extends Location {
    _disposable: Disposable;
    _range: RangePlus;
    _content: string;
    _id?: string;
    _textEditorDecoration?: TextEditorDecorationType;
    _lastEditedTime: NodeJS.Timeout | null;
    _tempInsertedRange: RangePlus | null = null;
    _selectedCode: string | null = null;
    onDelete: EventEmitter<LocationPlus> = new EventEmitter<LocationPlus>();
    onChanged: EventEmitter<ChangeEvent> = new EventEmitter<ChangeEvent>();
    onSelected: EventEmitter<Selection> = new EventEmitter<Selection>();
    constructor(
        uri: Uri,
        rangeOrPosition: Range | Position,
        opts?: LocationPlusOptions
    ) {
        super(uri, rangeOrPosition);
        this._lastEditedTime = null;
        this._range =
            rangeOrPosition instanceof Range
                ? RangePlus.fromRange(rangeOrPosition)
                : rangeOrPosition instanceof Position
                ? RangePlus.fromPosition(rangeOrPosition)
                : RangePlus.fromLineNumbers(0, 0, 0, 0); // may just want to throw an error instead
        const debouncedOnTextDocumentChanged = // debounce(
            (e: TextDocumentChangeEvent) => this.onTextDocumentChanged(e); //,
        // 500 // Adjust the debounce time (in milliseconds) to your needs
        //);

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
            (oldRange.contains(contentChangeRange) ||
                oldRange.doesIntersect(contentChangeRange))
        ) {
            return TypeOfChange.RANGE_AND_CONTENT;
        } else if (!oldRange.isEqual(newRange)) {
            return TypeOfChange.RANGE_ONLY;
        } else if (
            cleanedOldContent !== cleanedNewContent &&
            (oldRange.contains(contentChangeRange) ||
                oldRange.doesIntersect(contentChangeRange))
        ) {
            return TypeOfChange.CONTENT_ONLY;
        } else {
            return TypeOfChange.NO_CHANGE;
        }
    }

    posToLine(pos: number) {
        const code = this.content.slice(0, pos).split('\n');
        // console.log('CODE???', code);
        return new Position(
            this.range.start.line + code.length - 1,
            code[code.length - 1].length
        );
    }

    deriveRangeFromOffset(offsetStart: number, offsetEnd: number) {
        const start = this.posToLine(offsetStart);
        // console.log('START', start);
        const end = this.posToLine(offsetEnd);
        return RangePlus.fromPositions(start, end);
    }

    private cleanRange(range: RangePlus, document: TextDocument) {
        const updated = RangePlus.fromRange(document.validateRange(range));
        const furtherNormalizedStart =
            document.getWordRangeAtPosition(updated.start) || updated;
        const furtherNormalizedEnd =
            document.getWordRangeAtPosition(updated.end) || updated;
        const cleaned = RangePlus.fromPositions(
            furtherNormalizedStart.start,
            furtherNormalizedEnd.end
        );
        return cleaned;
    }

    onTextDocumentChanged(
        onTextDocumentChanged: TextDocumentChangeEvent,
        thisArg?: any
    ) {
        // debounce(() => {
        const { document, contentChanges } = onTextDocumentChanged;
        if (this.uri.fsPath === document.uri.fsPath) {
            for (const change of contentChanges) {
                // let justAdded = false;
                if (!this._tempInsertedRange && change.text.length > 0) {
                    this._tempInsertedRange =
                        RangePlus.fromTextDocumentContentChangeEvent(change);
                    // justAdded = true;
                    // console.log(
                    //     'init temp inserted',
                    //     this._tempInsertedRange.copy()
                    // );
                }
                const oldRange = this._range.copy();
                const oldContent = this._content;
                const previousRangeContent: PreviousRangeContent = {
                    oldRange,
                    oldContent,
                };
                // console.log('change', change);
                const updated = this._range.update(change);
                if (this._tempInsertedRange) {
                    const updated = this._tempInsertedRange.update(change);
                    this._tempInsertedRange = this.cleanRange(
                        updated,
                        document
                    );
                }
                this._range = this.cleanRange(updated, document);
                // the base Location property range
                // is not staying in sync with our internal range so we need to update it
                this.range = this._range;
                // only fire the onchanged event after the user has stopped typing for 5 seconds
                // can tinker with the wait time but 5 seconds seems ok for now
                // we do this so the parser can do a smarter diff
                this._lastEditedTime && clearTimeout(this._lastEditedTime);
                this._lastEditedTime = setTimeout(() => {
                    this._content = document.getText(this._range);
                    const contentChangeRange =
                        RangePlus.fromTextDocumentContentChangeEvent(change);
                    const typeOfChange = this.getTypeOfChange(
                        oldRange,
                        oldContent,
                        this._tempInsertedRange || contentChangeRange
                    );

                    this.onChanged.fire({
                        ...{
                            location: this,
                            typeOfChange,
                            previousRangeContent,
                            originalChangeEvent: change,
                        },
                        ...(change.text.length > 0 &&
                            this._tempInsertedRange && {
                                addedContent: document.getText(
                                    this._tempInsertedRange
                                ),
                                isInsertion: true,
                                insertedRange: this._tempInsertedRange,
                            }),
                        ...(change.text.length === 0 && {
                            removedRange: change.range,
                            removedContent: this._selectedCode,
                            isRemoval: true,
                        }),
                    });
                    this._range.updateRangeLength(document);
                    this._tempInsertedRange = null;
                }, 2000);
            }
        }
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
                this.onSelected.fire(selection);
                this._selectedCode =
                    selectionEvent.textEditor.document.getText(selection);
            } else {
                this._selectedCode = null;
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

    getDocument() {
        return workspace.openTextDocument(this.uri);
    }

    contains(otherLocation: Location) {
        return (
            this.uri.toString() === otherLocation.uri.toString() &&
            this._range.contains(otherLocation.range)
        );
    }

    containsStart(otherLocation: Location) {
        return (
            this.uri.toString() === otherLocation.uri.toString() &&
            this._range.contains(otherLocation.range.start)
        );
    }

    containsPartOf(otherLocation: Location) {
        return (
            (this.uri.toString() === otherLocation.uri.toString() &&
                this.range.contains(otherLocation.range.start)) ||
            this.range.contains(otherLocation.range.end) ||
            otherLocation.range.contains(this.range.start) ||
            otherLocation.range.contains(this.range.end)
        );
    }
}
