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
    TextDocument,
} from 'vscode';
import { ClipboardMetadata, Container } from '../container';
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
import {
    CollectionReference,
    DocumentData,
    DocumentReference,
} from 'firebase/firestore';
import TimelineEvent from './timeline/TimelineEvent';
import { ParsedTsNode } from '../document/languageServiceProvider/LanguageServiceProvider';
import { debounce } from '../utils/lib';
import { patienceDiffPlus } from '../utils/PatienceDiff';
import {
    CopyBuffer,
    Event,
    SerializedDataController,
    SerializedLocationPlus,
    SerializedNodeDataController,
    VscodeCopyBuffer,
} from '../constants/types';
import MetaInformationExtractor from '../comments/CommentCreator';
import RangePlus from '../document/locationApi/range';
import { CodeComment, META_STATE } from '../comments/commentCreatorUtils';
import { CurrentGitState } from './git/GitController';

export type LegalDataType = (DefaultLogFields & ListLogLine) | DocumentData; // not sure this is the right place for this but whatever

interface PasteData {
    uri: Uri;
    textDocumentContentChangeEvent: TextDocumentContentChangeEvent;
}

type DiffLine = {
    aIndex: number;
    bIndex: number;
    line: string;
};
type Diff =
    | {
          lines: DiffLine[];
          lineCountDeleted: number;
          lineCountInserted: number;
          lineCountMoved: number;
          aMove: any[];
          aMoveIndex: any[];
          bMove: any[];
          bMoveIndex: any[];
      }
    | {
          lines: DiffLine[];
          lineCountDeleted: number;
          lineCountInserted: number;
          lineCountMoved: number;
          aMove?: undefined;
          aMoveIndex?: undefined;
          bMove?: undefined;
          bMoveIndex?: undefined;
      };

interface ChangeBuffer {
    location: LocationPlus | SerializedLocationPlus;
    typeOfChange: TypeOfChange;
    changeContent: string;
    time: number;
    diff?: Diff;
    uid: string;
    id: string;
    eventData?: {
        [Event.COMMENT]?: {
            newComments?: CodeComment[];
            removedComments?: CodeComment[];
            changedComments?: CodeComment[];
        };
        [Event.COPY]?: {
            copyContent: string;
        };
        [Event.PASTE]?: {
            pasteContent: string;
            nodeId?: string;
        };
        [Event.WEB]?: {
            copyBuffer: CopyBuffer;
        };
    };
}

export interface FirestoreControllerInterface {
    ref: DocumentReference<DocumentData>;
    pastVersionsCollection: CollectionReference<DocumentData>;
    write: (newNode: any) => void;
    logVersion: (versionId: string, newNode: any) => void;
    readPastVersions: () => Promise<SerializedDataController[]>;
}

export class DataController {
    // extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    _outputData: OutputDataController | undefined;
    _firestoreControllerInterface: FirestoreControllerInterface | undefined;
    _tree: SimplifiedTree<ReadableNode> | undefined;
    _metaInformationExtractor: MetaInformationExtractor;
    _pastVersions: SerializedDataController[] = [];
    // _readableNode: ReadableNode;
    // _chatGptData: VscodeCopyBuffer[] | undefined = [];
    _webMetaData: VscodeCopyBuffer[] = [];
    _vscNodeMetadata: ParsedTsNode | undefined;
    _disposable: Disposable | undefined;
    _debug: boolean = false;
    _emit: boolean = false;
    _seen: boolean = false;
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

    compare(other: ReadableNode): CompareSummary<ReadableNode> {
        return this.readableNode.compare(other);
    }

    initListeners() {
        this._disposable = Disposable.from(
            // this._pasteDisposable,
            // tbd how much info to copy in the copy event -- probably would need
            // to transmit back to container? put in copy buffer
            this.container.onCopy((copyEvent) => {
                if (this.readableNode.location.contains(copyEvent.location)) {
                    this.handleOnCopy(copyEvent);
                }
            }),
            // same questions as above for paste -- what to save
            // from console logs it seems like this event gets fired before the
            // on change but that's probably due to the debounce for that...?
            // tbd
            this.container.onPaste((pasteEvent) => {
                if (
                    this.readableNode.location.range.contains(
                        pasteEvent.location.range.start
                    )
                ) {
                    this.handleOnPaste(pasteEvent);
                }
            }),
            this.readableNode.location.onChanged.event(
                // debounce(async (changeEvent: ChangeEvent) => {
                (changeEvent: ChangeEvent) => this.handleOnChange(changeEvent)
            ),
            // ),
            this.readableNode.location.onSelected.event(
                async (location: LocationPlus) => {
                    // can probably break these out into their own pages
                    this.handleOnSelected(location);
                }
            ),
            workspace.onDidSaveTextDocument((document) => {
                if (
                    document.uri.fsPath ===
                        this.readableNode.location.uri.fsPath &&
                    this._changeBuffer.length > 0
                ) {
                    this.handleOnSaveTextDocument(document);
                }
            }),
            window.onDidChangeActiveTextEditor((editor) => {
                // console.log('is this getting called lol', document);
                this.handleOnDidChangeActiveTextEditor(editor?.document);
            })
        );
        return () => this.dispose();
    }

    handleUpdateChangeBuffer(
        oldContent: string,
        newContent: string,
        changeEvent: ChangeEvent
    ) {
        const diff = patienceDiffPlus(
            oldContent.split(/\n/),
            newContent.split(/\n/)
        );
        // this.parseDiff(diff);
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
            ...(commentInfo && {
                changeInfo: commentInfo.newComments.map((n) => {
                    return {
                        ...n,
                        location: (n.location as RangePlus).serialize(),
                    };
                }),
            }),
            ...this.getBaseChangeBuffer(),
            typeOfChange: changeEvent.typeOfChange,
            changeContent: newContent,
        });
    }

    private getBaseChangeBuffer() {
        const time = Date.now();
        return {
            time,
            uid: this.container.firestoreController?._user?.uid || 'anonymous',
            id: `${this.readableNode.id}:${time}`,
            location: this.readableNode.location.serialize(),
            changeContent: this.readableNode.location.content,
        };
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
        this._vscNodeMetadata = newNodeMetadata;
    }

    handleOnCopy(copyEvent: ClipboardMetadata) {
        if (this.readableNode.location.contains(copyEvent.location)) {
            this._changeBuffer.push({
                ...this.getBaseChangeBuffer(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: this.readableNode.location.content,
                eventData: {
                    [Event.COPY]: {
                        copyContent: copyEvent.text,
                    },
                },
            });
        }
    }

    handleOnPaste(pasteEvent: ClipboardMetadata) {
        console.log(
            'PASTED',
            this,
            'paste',
            pasteEvent,
            this.container.copyBuffer
        );
        if (this.container.copyBuffer) {
            const { repository, ...rest } = this.container.gitController
                ?.gitState as CurrentGitState;
            const details = {
                ...this.container.copyBuffer,
                location: pasteEvent.location,
                pasteTime: Date.now(),
                gitMetadata: rest,
            };
            this._webMetaData.push(details);
            this._changeBuffer.push({
                ...this.getBaseChangeBuffer(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: pasteEvent.location.content,
                eventData: {
                    [Event.WEB]: {
                        copyBuffer: this.container.copyBuffer,
                    },
                },
            });
            this._debug = true;
            this._emit = true;
            console.log('posting', this.serialize());
        } else {
            this._changeBuffer.push({
                ...this.getBaseChangeBuffer(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: pasteEvent.location.content,
                eventData: {
                    [Event.PASTE]: {
                        pasteContent: pasteEvent.location.content,
                        nodeId: this.readableNode.id, // replace with readable node id that was copiedd
                    },
                },
            });
        }
    }

    handleOnChange(changeEvent: ChangeEvent) {
        const location = changeEvent.location;
        const newContent = location.content;
        const oldContent = changeEvent.previousRangeContent.oldContent;

        if (
            changeEvent.typeOfChange !== TypeOfChange.CONTENT_ONLY &&
            changeEvent.typeOfChange !== TypeOfChange.RANGE_AND_CONTENT
        ) {
            return;
        }

        this._debug &&
            console.log('changeEvent!!!!!!!', changeEvent, 'this!!!!!', this);
        // this._emit = true;
        this.handleUpdateChangeBuffer(oldContent, newContent, changeEvent);
        this.handleUpdateNodeMetadata(newContent, location);
        this.handleUpdateTree(newContent);
        // if (this._emit) {
        //     this.container.webviewController?.postMessage({
        //         command: 'updateWebData',
        //         data: this.serialize(),
        //     });
        // }
    }

    async handleOnSelected(location: LocationPlus) {
        this._debug = true;
        const gitRes = (await this.getGitData())?.all || [];
        if (gitRes.length > 0) {
            this._gitData = gitRes.map((r) => new TimelineEvent(r));
        } else {
            this._gitData = [];
        }
        const fireStoreRes = (await this.getFirestoreData()) || [];
        if (fireStoreRes.length > 0) {
            this._firestoreData = fireStoreRes.map((r) => new TimelineEvent(r));
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
    }

    handleOnSaveTextDocument(textDocument: TextDocument) {
        console.log('posting', this.serialize());
        this._firestoreControllerInterface?.write({
            ...this.serialize(),
        });
        if (this.container.gitController?.gitState) {
            const { commit, branch } = this.container.gitController
                ?.gitState as CurrentGitState;
            this._changeBuffer.forEach((c) => {
                this._firestoreControllerInterface?.logVersion(c.id, {
                    ...c,
                    commit, // tbd if we just want this as a subcollection
                    branch,
                });
            });
            this._changeBuffer = [];
        }
    }

    async handleOnDidChangeActiveTextEditor(
        textDocument: TextDocument | undefined
    ) {
        if (
            textDocument?.uri.fsPath ===
                this.readableNode.location.uri.fsPath &&
            !this._seen
        ) {
            console.log('opening', this);
            this._seen = true;
            this._pastVersions =
                (await this._firestoreControllerInterface?.readPastVersions()) ||
                [];
            console.log('this', this);
        }
    }

    async handleUpdateTree(newContent: string) {
        // const editor = window.activeTextEditor || window.visibleTextEditors[0];
        // const doc =
        //     editor.document.uri.fsPath === this.readableNode.location.uri.fsPath
        //         ? editor.document
        //         : await workspace.openTextDocument(this.readableNode.location.uri); // idk when this would ever happen??? maybe in a git pull where a whole bunch of docs are being updated
        // const newTree = await this.container.treeCreator.createTree(
        //     doc,
        //     this.readableNode.location,
        //     newContent
        // );
        // this._tree = newTree;
        // compute parsed subtree when this node is marked as deleted
        // or when count of function defs or ifs or whatever changes -- heuristic
        // get parsed subtree -- how to do this though since typescript parser doesnt
        // really like parsing a snippet out of context?
        // look into this or have doc keep a reference to the parsed AST
        // and request there
        // update our instance of tree
        // set parent's children to new tree (how to avoid race condition...)
        // call parent's update
        // recurse to top of tree
        // to do this on save? or other time??
    }

    getGitData() {
        return this.container.gitController?.gitLog(this.readableNode.location);
    }

    async getFirestoreData() {
        return await this.container.firestoreController?.query(
            this.readableNode.id
        );
    }

    // serialize(): SerializedDataController {
    serialize(): SerializedNodeDataController {
        return {
            node: this.readableNode.serialize(),
            lastUpdatedTime: Date.now(),
            lastUpdatedBy:
                this.container.firestoreController?._user?.uid || 'anonymous',
            setOfEventIds: this._changeBuffer // keep track of this since we reset change buffer on push
                .filter((c) => c.eventData)
                .map((c) => c.id),
            // setOfEvents: this._changeBuffer.,
            // webMetadata: this.webMetaData,
            // changeBuffer: [],

            // this._changeBuffer.map((c) => {
            //     return {
            //         ...c,
            //         location: c.location.serialize(),
            //     };
            // }),
            // vscNodeMetadata: this.vscodeNodeMetadata, // need to remove ts nodes
        };
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

    get firestoreControllerInterface() {
        return this._firestoreControllerInterface;
    }

    set firestoreControllerInterface(newFirestoreControllerInterface) {
        this._firestoreControllerInterface = newFirestoreControllerInterface;
    }
}
