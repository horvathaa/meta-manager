import {
    Uri,
    Range,
    Disposable,
    window,
    workspace,
    TextDocumentContentChangeEvent,
} from 'vscode';
import { Container } from '../container';
import { AbstractTreeReadableNode, CompareSummary } from '../tree/tree';
import ReadableNode from '../tree/node';
import LocationPlus, { ChangeEvent } from '../document/locationApi/location';
import { ListLogLine, DefaultLogFields } from 'simple-git';
import { DocumentData } from 'firebase/firestore';
import TimelineEvent from './timeline/TimelineEvent';
import { VscodeTsNodeMetadata } from '../document/languageServiceProvider/LanguageServiceProvider';
import { debounce } from '../lib';
import { CopyBuffer } from '../constants/types';

export type LegalDataType = (DefaultLogFields & ListLogLine) | DocumentData; // not sure this is the right place for this but whatever
interface VscodeChatGptData extends CopyBuffer {
    location: LocationPlus;
    pasteTime: number;
    gitMetadata: any;
}

interface InitChatGptData {
    uri: Uri;
    textDocumentContentChangeEvent: TextDocumentContentChangeEvent;
}

export class DataController {
    // extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    _outputData: OutputDataController | undefined;
    // _readableNode: ReadableNode;
    _chatGptData: VscodeChatGptData[] | undefined = [];
    _vscNodeMetadata: VscodeTsNodeMetadata[];
    _disposable: Disposable | undefined;
    _debug: boolean = false;

    constructor(
        private readonly readableNode: ReadableNode,
        private readonly container: Container
    ) {
        // super();
        // this._readableNode = readableNode;
        this._vscNodeMetadata = [];
        this.initListeners();
    }

    // get readableNode() {
    //     return this._readableNode;
    // }

    // serialize() {
    //     return {
    //         readableNode: this.readableNode.serialize(),
    //     };
    // }

    // deserialize(data: any) {
    //     // would be better if deserialize was static
    //     this.readableNode = new ReadableNode(
    //         '',
    //         new LocationPlus(Uri.file(''), new Range(0, 0, 0, 0))
    //     ).deserialize(data.readableNode);
    //     return this.readableNode;
    // }

    compare(other: ReadableNode): CompareSummary<ReadableNode> {
        return this.readableNode.compare(other);
    }

    initListeners() {
        this._disposable = Disposable.from(
            this.readableNode.location.onChanged.event(
                debounce(async (changeEvent: ChangeEvent) => {
                    // console.log('hewwo???', location);
                    const location = changeEvent.location;
                    const newContent = location.content;
                    const oldContent = this.readableNode.location.content;
                    this._debug &&
                        console.log(
                            'newContent',
                            newContent.replace(/\s/g, ''),
                            'oldContent',
                            oldContent.replace(/\s/g, '')
                        );
                    this._debug && console.log('chatgpt', this._chatGptData);
                    if (
                        newContent.replace(/\s/g, '') ===
                        oldContent.replace(/\s/g, '')
                    ) {
                        return;
                    }
                    const editor =
                        window.activeTextEditor || window.visibleTextEditors[0];
                    const doc =
                        editor.document.uri.fsPath === location.uri.fsPath
                            ? editor.document
                            : await workspace.openTextDocument(location.uri); // idk when this would ever happen??? maybe in a git pull where a whole bunch of docs are being updated

                    const newNodeMetadata =
                        this.container.languageServiceProvider.parseCodeBlock(
                            newContent,
                            doc
                        );

                    this.vscNodeMetadata = newNodeMetadata;
                })
            ),
            this.readableNode.location.onSelected.event(
                async (location: LocationPlus) => {
                    // can probably break these out into their own pages
                    const gitRes = (await this.getGitData())?.all || [];
                    if (gitRes.length > 0) {
                        this._gitData = gitRes.map((r) => new TimelineEvent(r));
                    } else {
                        this._gitData = [];
                    }
                    const fireStoreRes = (await this.getFirestoreData()) || [];
                    if (fireStoreRes.length > 0) {
                        this._firestoreData = fireStoreRes.map(
                            (r) => new TimelineEvent(r)
                        );
                    } else {
                        this._firestoreData = [];
                    }
                    const allData = [...this._firestoreData, ...this._gitData];
                    this.container.webviewController?.postMessage({
                        command: 'updateTimeline',
                        data: {
                            id: this.readableNode.id,
                            timelineData: allData,
                        },
                    });
                    // console.log('this', this, 'location', location);
                }
            )
        );
        return () => this.dispose();
    }

    addChatGptData(data: CopyBuffer, initChatGptData: InitChatGptData) {
        const { uri, textDocumentContentChangeEvent } = initChatGptData;
        console.log('gitcontroller', this.container.gitController);
        this._chatGptData?.push({
            ...data,
            location: new LocationPlus(
                uri,
                initChatGptData.textDocumentContentChangeEvent.range,
                {
                    rangeFromTextDocumentContentChangeEvent:
                        textDocumentContentChangeEvent,
                }
            ),
            pasteTime: Date.now(),
            gitMetadata: this.container.gitController?.gitState,
        });
        this._debug = true;
    }

    getGitData() {
        return this.container.gitController?.gitLog(this.readableNode.location);
    }

    async getFirestoreData() {
        return await this.container.firestoreController?.query(
            this.readableNode.id
        );
    }

    dispose() {
        this._disposable?.dispose();
    }

    set vscNodeMetadata(newNodeMetadata: VscodeTsNodeMetadata[]) {
        this._vscNodeMetadata = newNodeMetadata;
    }

    get vscodeNodeMetadata() {
        return this._vscNodeMetadata;
    }
}
