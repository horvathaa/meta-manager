import {
    Disposable,
    TextDocument,
    // TextDocumentChangeEvent,
    workspace,
    window,
    Range,
    TextEditorSelectionChangeEvent,
    TextDocumentContentChangeEvent,
    TextDocumentChangeEvent,
} from 'vscode';
import { Container } from '../container';
import { getProjectName, getVisiblePath, makeReadableNode } from './lib';
import {
    SimplifiedTree,
    SummaryStatus,
    getSimplifiedTreeName,
} from '../tree/tree';
import * as ts from 'typescript';
// import { ReadableNode, isReadableNode } from '../constants/types';
import ReadableNode, { NodeState } from '../tree/node';
import LocationPlus from './locationApi/location';
import { FileParsedEvent } from '../fs/FileSystemController';
import { DataController } from '../data/DataController';
import { v4 as uuidv4 } from 'uuid';
// import { VscodeTsNodeMetadata } from './languageServiceProvider/LanguageServiceProvider';
import RangePlus from './locationApi/range';
import { isEmpty } from 'lodash';
// import { debounce } from '../lib';
const tstraverse = require('tstraverse');

class DocumentWatcher extends Disposable {
    _disposable: Disposable | undefined;
    readonly _relativeFilePath: string;
    _nodesInFile: SimplifiedTree<ReadableNode> | undefined;

    constructor(
        readonly document: TextDocument,
        private readonly container: Container
    ) {
        super(() => this.dispose());
        this._relativeFilePath = getVisiblePath(
            workspace.name || getProjectName(this.document.uri.toString()),
            this.document.uri.fsPath
        );

        this._nodesInFile = undefined;
        const listener = container.fileSystemController?.onFileParsed(
            (event: FileParsedEvent) => {
                const { filename, data } = event;
                if (filename === this._relativeFilePath) {
                    const tree = new SimplifiedTree<ReadableNode>({
                        name: this._relativeFilePath,
                    }).deserialize(
                        data.data,
                        new ReadableNode(
                            '',
                            new LocationPlus(
                                this.document.uri,
                                new Range(0, 0, 0, 0)
                            )
                        ),
                        this._relativeFilePath
                    );
                    this._nodesInFile = this.initNodes(tree);
                    console.log('file parsed complete', this);
                }
            }
        );
        const otherListener = container.onNodesComplete(() => {
            if (!this._nodesInFile) {
                this._nodesInFile = this.initNodes();
            }
        });

        const docChangeListener = workspace.onDidChangeTextDocument((e) =>
            this.handleOnDocumentChange(e)
        );
        const saveListener = workspace.onDidSaveTextDocument((e) =>
            this.handleOnDidSaveDidClose(e)
        );
        const listeners = [
            saveListener,
            listener,
            otherListener,
            docChangeListener,
        ].filter((d) => d) as Disposable[];
        this._disposable = Disposable.from(...listeners);
    }

    get relativeFilePath() {
        return this._relativeFilePath;
    }

    get nodesInFile() {
        return this._nodesInFile;
    }

    handleOnDidSaveDidClose(event: TextDocument) {
        // if (event === this.document) {
        //     this._nodesInFile = this.initNodes(this._nodesInFile);
        // }
    }

    handleOnDocumentChange(event: TextDocumentChangeEvent) {
        if (event.document === this.document) {
            for (const change of event.contentChanges) {
                const range =
                    RangePlus.fromTextDocumentContentChangeEvent(change);
                const path = this._nodesInFile?.getLastNodeInPath(
                    (d: ReadableNode) => {
                        return !isEmpty(d) && d.location.range.contains(range);
                    }
                );
                // console.log('path', path, 'nopdes in file', this._nodesInFile);
                if (!path) {
                    console.error(
                        'could not get path -- doc change',
                        change,
                        'copy buffer',
                        this.container.copyBuffer
                    );
                    return;
                }
                const n = path;
                // console.log('mostAccuratePath', mostAccuratePath);
                // mostAccuratePath.forEach((n) => {
                //     this.container.copyBuffer &&
                //         n.dataController?.addChatGptData(
                //             this.container.copyBuffer,
                //             {
                //                 uri: this.document.uri,
                //                 textDocumentContentChangeEvent: change,
                //             }
                //         );
                //     console.log('n', n);
                n.dataController?.chatGptData &&
                    this.container.webviewController?.postMessage({
                        command: 'renderChatGptHistory',
                        payload: n.dataController.chatGptData[0],
                    });
                // });
                // }
            }
        }
    }

    initNodes(oldTree?: SimplifiedTree<ReadableNode>) {
        const tree = this.traverse(oldTree);
        return tree;
    }

    traverse(oldTree?: SimplifiedTree<ReadableNode>) {
        // traverse the document and find the code anchors
        const sourceFile = ts.createSourceFile(
            this.document.fileName,
            this.document.getText(),
            ts.ScriptTarget.Latest,
            true
        );

        let nodes: ts.Node[] = [];
        const docCopy = this.document;
        // const nodeMetadata =
        //     this.container.languageServiceProvider.parseCodeBlock(
        //         docCopy.getText(),
        //         // readableNode.readableNode.location.content,
        //         docCopy
        //     );
        const tree = new SimplifiedTree<ReadableNode>({
            name: this._relativeFilePath,
        });
        tree.initRoot(); // initialize the root node
        // let currTreeInstance: SimplifiedTree<ReadableNode>[] = [tree];
        let currTreeInstance: SimplifiedTree<ReadableNode>[] = [tree];
        const context = this;
        let otherTreeInstance: SimplifiedTree<ReadableNode> | undefined =
            oldTree;
        // Enter function will be executed as each node is first interacted with
        function enter(node: ts.Node) {
            nodes.push(node);

            // probably need to add in other scopes such as object literals
            // some of the scopes do not use the block node
            // i'm not sure why
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) => n);
                let name = `${getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                )}`;
                const readableNode = // context.initNode(
                    // new DataController(
                    ReadableNode.create(node, docCopy, context.container, name);
                // context.container
                // );
                // );
                readableNode.dataController = new DataController(
                    readableNode,
                    context.container
                );
                readableNode.location.updateContent(docCopy);
                // we have a point of comparison
                if (otherTreeInstance && oldTree) {
                    const matchInfo = otherTreeInstance.getNodeOfBestMatch(
                        readableNode // .readableNode
                    );
                    if (
                        matchInfo.status === SummaryStatus.SAME &&
                        matchInfo.bestMatch
                    ) {
                        name = matchInfo.bestMatch.id;
                        otherTreeInstance = matchInfo.subtree; // any :-(
                    } else {
                        const matchInfo = oldTree.getNodeOfBestMatch(
                            readableNode // .readableNode
                        );
                        if (
                            matchInfo.status === SummaryStatus.SAME &&
                            matchInfo.bestMatch
                        ) {
                            name = matchInfo.bestMatch.id;
                            otherTreeInstance = matchInfo.subtree; // any :-(
                        } else {
                            otherTreeInstance = oldTree; // set back to top for future search
                        }
                    }
                }
                // we do not have a point of comparison so we init new nodes
                else {
                    name = `${name}:${uuidv4()}}`;
                }

                readableNode.setId(name);
                readableNode.registerListeners();
                // v expensive to compute all this metadata
                // tbd whether/how to speed it up
                // const nodeInfo: VscodeTsNodeMetadata[] = [];
                //  nodeMetadata.filter((n) =>
                //     readableNode.readableNode.location.range.contains(
                //         n.location.range
                //     )
                // );

                // readableNode.dataController.vscNodeMetadata = nodeInfo;
                const treeRef = currTreeInstance[
                    currTreeInstance.length - 1
                ].insert(
                    readableNode, // .readableNode,
                    { name }
                );
                // readableNode.dataController.tree = treeRef; // this is wrong lol
                currTreeInstance.push(treeRef);
            }
        }

        // Leave function will be executed after all children have been interacted with
        function leave(node: ts.Node) {
            const topNode = nodes.pop();
            if (topNode && ts.isBlock(topNode)) {
                // console.log('currTreeInstance', currTreeInstance);
                currTreeInstance.pop();
            }
        }

        sourceFile && tstraverse.traverse(sourceFile, { enter, leave });
        if (!oldTree) {
            this.container.fileSystemController?.writeToFile(
                tree.serialize(),
                tree.name
            );
        }

        console.log('newTree', tree);
        return tree;
    }
}

export default DocumentWatcher;
