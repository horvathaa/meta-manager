import {
    Uri,
    Range,
    Disposable,
    window,
    workspace,
    TextDocumentContentChangeEvent,
    commands,
    TextEditor,
    TextEditorEdit,
} from 'vscode';
import { Container } from '../container';
import {
    AbstractTreeReadableNode,
    CompareSummary,
    SimplifiedTree,
} from '../tree/tree';
import ReadableNode from '../tree/node';
import LocationPlus, {
    ChangeEvent,
    TypeOfChange,
} from '../document/locationApi/location';
import { ListLogLine, DefaultLogFields } from 'simple-git';
import { DocumentData } from 'firebase/firestore';
import TimelineEvent from './timeline/TimelineEvent';
import { ParsedTsNode } from '../document/languageServiceProvider/LanguageServiceProvider';
import { debounce } from '../utils/lib';
import { patienceDiffPlus } from '../utils/PatienceDiff';
import { CopyBuffer, VscodeCopyBuffer } from '../constants/types';
import MetaInformationExtractor from '../comments/CommentCreator';
import RangePlus from '../document/locationApi/range';
import { CodeComment, META_STATE } from '../comments/commentCreatorUtils';
import { CurrentGitState } from './git/GitController';

export type LegalDataType = (DefaultLogFields & ListLogLine) | DocumentData; // not sure this is the right place for this but whatever

interface PasteData {
    uri: Uri;
    textDocumentContentChangeEvent: TextDocumentContentChangeEvent;
}

interface ChangeBuffer {
    location: LocationPlus;
    typeOfChange: TypeOfChange;
    changeContent: string;
    time: number;
    diff:
        | {
              lines: any[];
              lineCountDeleted: number;
              lineCountInserted: number;
              lineCountMoved: number;
              aMove: any[];
              aMoveIndex: any[];
              bMove: any[];
              bMoveIndex: any[];
          }
        | {
              lines: any[];
              lineCountDeleted: number;
              lineCountInserted: number;
              lineCountMoved: number;
              aMove?: undefined;
              aMoveIndex?: undefined;
              bMove?: undefined;
              bMoveIndex?: undefined;
          };

    uid: string;
    changeInfo?: {
        newComments?: CodeComment[];
        removedComments?: CodeComment[];
        changedComments?: CodeComment[];
    };
}

export class DataController {
    // extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    _outputData: OutputDataController | undefined;
    _tree: SimplifiedTree<ReadableNode> | undefined;
    _metaInformationExtractor: MetaInformationExtractor;
    // _readableNode: ReadableNode;
    // _chatGptData: VscodeCopyBuffer[] | undefined = [];
    _webMetaData: VscodeCopyBuffer[] = [];
    _vscNodeMetadata: ParsedTsNode | undefined;
    _disposable: Disposable | undefined;
    _debug: boolean = false;
    _changeBuffer: ChangeBuffer[];
    // _pasteDisposable: Disposable;

    constructor(
        private readonly readableNode: ReadableNode,
        private readonly container: Container,
        private readonly debug = false
    ) {
        // super();
        // this._readableNode = readableNode;
        this._changeBuffer = [];
        this.debug && console.log('MAKING META', this.readableNode);
        this._metaInformationExtractor = new MetaInformationExtractor(
            this.readableNode.languageId,
            this.readableNode.location.content,
            this.debug
        );
        this.debug && console.log('this', this);
        // this._pasteDisposable =
        this.initListeners();
        this.debug && console.log('init complete');
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

    handleUpdateChangeBuffer(
        oldContent: string,
        newContent: string,
        changeEvent: ChangeEvent
    ) {
        const diff = patienceDiffPlus(
            oldContent.split(/[\[\](){}.,;:!?\s]/),
            newContent.split(/[\[\](){}.,;:!?\s]/)
        );
        const oldComments = this._metaInformationExtractor.foundComments;
        this._metaInformationExtractor.updateMetaInformation(newContent);
        this._metaInformationExtractor.foundComments.forEach((c) => {
            c.location = (
                this.readableNode.location.range as RangePlus
            ).translate(c.location);
        });
        let commentInfo = undefined;
        if (
            oldComments.length !==
            this._metaInformationExtractor.foundComments.length
        ) {
            commentInfo = {
                newComments:
                    this._metaInformationExtractor.foundComments.filter(
                        (c) => c.state && c.state === META_STATE.NEW
                    ),
            };
        }
        this._changeBuffer.push({
            ...(commentInfo && { changeInfo: commentInfo }), // condiiontal property add
            ...{
                diff,
                location: changeEvent.location,
                typeOfChange: changeEvent.typeOfChange,
                changeContent: newContent,
                time: Date.now(),
                uid:
                    this.container.firestoreController?._user?.uid ||
                    'anonymous',
            },
        });
        console.log('this!!!!', this);
    }

    async handleUpdateNodeMetadata(newContent: string, location: LocationPlus) {
        const editor = window.activeTextEditor || window.visibleTextEditors[0];
        const doc =
            editor.document.uri.fsPath === location.uri.fsPath
                ? editor.document
                : await workspace.openTextDocument(location.uri); // idk when this would ever happen??? maybe in a git pull where a whole bunch of docs are being updated

        const newNodeMetadata =
            this.container.languageServiceProvider.parseCodeBlock(
                newContent,
                doc,
                location
            );
        // console.log(
        //     'newNodeMetadata',
        //     newNodeMetadata,
        //     'this',
        //     this
        // );
        this._vscNodeMetadata = newNodeMetadata;
    }

    initListeners() {
        this._disposable = Disposable.from(
            // this._pasteDisposable,
            // tbd how much info to copy in the copy event -- probably would need
            // to transmit back to container? put in copy buffer
            this.container.onCopy((copyEvent) => {
                if (this.readableNode.location.contains(copyEvent.location)) {
                    console.log('COPIED', this, 'copy', copyEvent);
                }
            }),
            // same questions as above for paste -- what to save
            // from console logs it seems like this event gets fired before the
            // on change but that's probably due to the debounce for that...?
            // tbd
            this.container.onPaste((pasteEvent) => {
                if (this.readableNode.location.contains(pasteEvent.location)) {
                    console.log('PASTED', this, 'paste', pasteEvent);
                }
            }),
            this.readableNode.location.onChanged.event(
                debounce(async (changeEvent: ChangeEvent) => {
                    // console.log('hewwo???', location);
                    // console.log('this', this);
                    const location = changeEvent.location;
                    const newContent = location.content;
                    const oldContent =
                        changeEvent.previousRangeContent.oldContent;
                    // this._debug && console.log('chatgpt', this._chatGptData);
                    if (
                        // newContent.replace(/\s/g, '') ===
                        // oldContent.replace(/\s/g, '')
                        changeEvent.typeOfChange !==
                            TypeOfChange.CONTENT_ONLY &&
                        changeEvent.typeOfChange !==
                            TypeOfChange.RANGE_AND_CONTENT
                    ) {
                        return;
                    }

                    console.log(
                        'changeEvent!!!!!!!',
                        changeEvent,
                        'this!!!!!',
                        this
                    );
                    if (
                        this.container.copyBuffer &&
                        changeEvent.addedContent &&
                        changeEvent.addedContent ===
                            this.container.copyBuffer.code
                    ) {
                        this.addWebData(this.container.copyBuffer, {
                            uri: location.uri,
                            textDocumentContentChangeEvent:
                                changeEvent.originalChangeEvent,
                        });
                    }
                    this.handleUpdateChangeBuffer(
                        oldContent,
                        newContent,
                        changeEvent
                    );
                    this.handleUpdateNodeMetadata(newContent, location);
                })
            ),
            this.readableNode.location.onSelected.event(
                async (location: LocationPlus) => {
                    // can probably break these out into their own pages
                    this._debug = true;
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

    addWebData(data: CopyBuffer, initChatGptData: PasteData) {
        const { uri, textDocumentContentChangeEvent } = initChatGptData;
        console.log('gitcontroller', this.container.gitController);
        const { repository, ...rest } = this.container.gitController
            ?.gitState as CurrentGitState;
        this._webMetaData?.push({
            ...data,
            location: new LocationPlus(
                uri,
                RangePlus.fromTextDocumentContentChangeEvent(
                    textDocumentContentChangeEvent
                )
            ),
            pasteTime: Date.now(),
            gitMetadata: rest,
            // gitMetadata: null,
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

    set vscNodeMetadata(newNodeMetadata: ParsedTsNode) {
        this._vscNodeMetadata = newNodeMetadata;
    }

    get vscodeNodeMetadata() {
        return this._vscNodeMetadata;
    }

    get webMetaData() {
        return this._webMetaData;
    }

    set tree(newTree: SimplifiedTree<ReadableNode> | undefined) {
        this._tree = newTree;
    }

    get tree() {
        return this._tree;
    }
}
