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
import {
    DataController,
    FirestoreControllerInterface,
} from '../data/DataController';
import { v4 as uuidv4 } from 'uuid';
// import { VscodeTsNodeMetadata } from './languageServiceProvider/LanguageServiceProvider';
import RangePlus from './locationApi/range';
import { isEmpty } from 'lodash';
import { SerializedReadableNode } from '../constants/types';
// import { debounce } from '../lib';
const tstraverse = require('tstraverse');

class DocumentWatcher extends Disposable {
    _disposable: Disposable | undefined;
    readonly _relativeFilePath: string;
    private _firestoreCollectionPath: string;
    _nodesInFile: SimplifiedTree<ReadableNode> | undefined;
    _writeWholeFile: boolean = false;

    constructor(
        readonly document: TextDocument,
        private readonly container: Container
    ) {
        super(() => this.dispose());
        this._relativeFilePath = getVisiblePath(
            workspace.name || getProjectName(this.document.uri.toString()),
            this.document.uri.fsPath
        ).replace(/\\/g, '/');
        this._firestoreCollectionPath = '';
        console.log('relative file path', this._relativeFilePath);

        this._nodesInFile = undefined;
        const otherListener = container.onNodesComplete(() => {
            // console.log('new project', this);
            if (this._nodesInFile === undefined) {
                // console.log('hewwo????', this);
                this._nodesInFile = this.initNodes();
                // console.log('NEW NODES', this._nodesInFile);
            }
        });

        const firestoreReadListener = container.onRead(
            (event: FileParsedEvent) => {
                // console.log('EVENT', event);
                const { filename, data, map, collectionPath } = event;
                if (filename === this._relativeFilePath) {
                    // console.log('HEWWWWOOOO!!!!!!!!!', event);
                    this._firestoreCollectionPath = collectionPath;
                    const tree = new SimplifiedTree<ReadableNode>({
                        name: this._relativeFilePath,
                    }).deserialize(
                        data,
                        new ReadableNode(
                            '',
                            new LocationPlus(
                                this.document.uri,
                                new Range(0, 0, 0, 0)
                            )
                        ),
                        this._relativeFilePath
                    );
                    this._nodesInFile = this.initNodes(tree, map);

                    console.log(
                        'file parsed complete for ' + this._relativeFilePath,
                        this
                    );
                }
            }
        );

        const saveListener = workspace.onDidSaveTextDocument((e) =>
            this.handleOnDidSaveDidClose(e)
        );
        const listeners = [
            saveListener,
            // listener,
            otherListener,
            firestoreReadListener,
            // docChangeListener,
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
        if (event.uri.fsPath === this.document.uri.fsPath) {
            // this.container.firestoreController?.write();
            // this.container.firestoreController?.writeFile(
            //     this.initSerialize(),
            //     this._firestoreCollectionPath
            // );
            // this._writeWholeFile = false;
            // console.log('before traverse', this._nodesInFile);
            // this._nodesInFile = this.traverse(this._nodesInFile);
            // console.log('after traverse', this._nodesInFile);
        }
    }

    initSerialize() {
        return (
            this._nodesInFile?.serialize().map((n) => {
                return {
                    node: n as unknown as SerializedReadableNode, // bad
                    changeBuffer: [],
                    webMetadata: [],
                };
            }) || []
        );
    }

    initNodes(oldTree?: SimplifiedTree<ReadableNode>, map?: Map<string, any>) {
        const tree = this.traverse(oldTree, map);
        return tree;
    }

    // updateTree(oldTree: SimplifiedTree<ReadableNode>) {
    //     const copy = oldTree.toArray()

    // }

    traverse(
        oldTree?: SimplifiedTree<ReadableNode>,
        map?: Map<string, FirestoreControllerInterface>
    ) {
        // traverse the document and find the code anchors
        const sourceFile = ts.createSourceFile(
            this.document.fileName,
            this.document.getText(),
            ts.ScriptTarget.Latest,
            true
        );
        let debug = false;
        let nodes: ts.Node[] = [];
        const docCopy = this.document;
        const tree = new SimplifiedTree<ReadableNode>({
            name: this._relativeFilePath,
        });
        const fileData = new ReadableNode(
            'file',
            new LocationPlus(
                this.document.uri,
                new Range(0, 0, docCopy.lineCount, 1000)
            )
        );
        fileData.location.updateContent(docCopy);
        fileData.dataController = new DataController(fileData, this.container);
        fileData.dataController._tree = tree;
        fileData.registerListeners();
        tree.initRoot(fileData); // initialize the root node
        // const fileLevelNode = new ReadableNode(
        //     'file',
        //     new LocationPlus(
        //         this.document.uri,
        //         new Range(0, 0, docCopy.lineCount, 1000)
        //     )
        // );

        // tree.insert(fileLevelNode, { name: this._relativeFilePath });
        let currTreeInstance: SimplifiedTree<ReadableNode>[] = [tree];
        const context = this;
        let otherTreeInstance: SimplifiedTree<ReadableNode> | undefined =
            oldTree;
        const crazyIdeaMap = new Map<string, ReadableNode>();
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
                (name.includes('getPathFromUrl') ||
                    name.includes('If:3144403a-2ac6-4161-9475-6b2d6f4417dd')) &&
                    (debug = true);
                debug &&
                    console.log('ADDING READABLE NODE', readableNode.copy());
                readableNode.dataController = new DataController(
                    readableNode,
                    context.container
                    // debug
                );
                let newNode = false;
                debug &&
                    console.log(
                        'adding data node',
                        readableNode.dataController
                    );
                readableNode.location.updateContent(docCopy);
                // we have a point of comparison

                if (otherTreeInstance && oldTree) {
                    const matchInfo = context.match(
                        otherTreeInstance,
                        oldTree,
                        readableNode,
                        name,
                        debug
                    );
                    name = matchInfo.name;
                    otherTreeInstance = matchInfo.otherTreeInstance;
                    newNode = matchInfo.new || false;
                }

                readableNode.setId(name);
                const firestoreCollectionPath = context._firestoreCollectionPath
                    .length
                    ? context._firestoreCollectionPath
                    : context.container.firestoreController!.getFileCollectionPath(
                          context.relativeFilePath
                      );
                // debug &&
                //     console.log('after collection', firestoreCollectionPath);
                if (!context._firestoreCollectionPath.length) {
                    context._firestoreCollectionPath = firestoreCollectionPath;
                }
                readableNode.dataController.firestoreControllerInterface =
                    map?.get(readableNode.id);
                if (newNode && context.container.firestoreController) {
                    readableNode.dataController._firestoreControllerInterface =
                        context.container.firestoreController.createNodeMetadata(
                            name,
                            firestoreCollectionPath
                        );
                }
                readableNode.registerListeners();
                const treeRef = currTreeInstance[
                    currTreeInstance.length - 1
                ].insert(
                    readableNode, // .readableNode,
                    { name }
                );
                if (name === 'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}') {
                    console.log(
                        'TREE REF',
                        treeRef,
                        'currTreeInstance',
                        currTreeInstance,
                        'map',
                        crazyIdeaMap,
                        'name',
                        name,
                        'readableNode',
                        readableNode,
                        'tree',
                        tree
                    );
                }
                readableNode.dataController.setTree(treeRef);
                currTreeInstance.push(treeRef);
                crazyIdeaMap.set(name, readableNode);
                debug = false;
            }
        }

        // Leave function will be executed after all children have been interacted with
        function leave(node: ts.Node) {
            const topNode = nodes.pop();
            if (topNode && ts.isBlock(topNode)) {
                const node = currTreeInstance.pop();
                if (node?.name === 'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}') {
                    console.log(
                        'POPPPPPPINGGGGGG',
                        node,
                        'map',
                        crazyIdeaMap,
                        'top',
                        topNode
                    );
                }
                const nodeToUpdate = crazyIdeaMap.get(node?.name || '');
                if (nodeToUpdate && node) {
                    nodeToUpdate.dataController!.setTree(node);
                    tree.swapNodes(node.root!.data, nodeToUpdate);
                    if (
                        node?.name ===
                        'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}'
                    ) {
                        console.log(
                            'POST SET!!!!!!!!!!',
                            node,
                            'map',
                            crazyIdeaMap,
                            'top',
                            nodeToUpdate,
                            'tree',
                            tree
                        );
                    }
                    // context._relativeFilePath === 'source/utils/utils.ts' &&
                    //     console.log('popping', nodeToUpdate);
                    // can either have each node update itself and parents
                    // then notify document that _nodesInFile has changed at whatever
                    // level it is at
                } else {
                    console.log(
                        'WHEN DOES THIS HAPPEN',
                        node?.name,
                        crazyIdeaMap
                    );
                }
            }
        }
        sourceFile && tstraverse.traverse(sourceFile, { enter, leave });
        return tree;
    }

    match(
        otherTreeInstance: SimplifiedTree<ReadableNode>,
        oldTree: SimplifiedTree<ReadableNode>,
        readableNode: ReadableNode,
        name: string,
        debug: boolean
    ) {
        const matchInfo = otherTreeInstance.getNodeOfBestMatch(
            readableNode // .readableNode
        );
        debug && console.log('wtf', readableNode, matchInfo);

        if (matchInfo.status === SummaryStatus.SAME && matchInfo.bestMatch) {
            return {
                name: matchInfo.bestMatch.id,
                otherTreeInstance: matchInfo.subtree,
            };
        } else if (matchInfo.status === SummaryStatus.MODIFIED) {
            return {
                name: matchInfo.modifiedNodes?.id || name,
                otherTreeInstance: matchInfo.subtree,
            };
        } else {
            const matchInfo = oldTree.getNodeOfBestMatch(
                readableNode // .readableNode
            );
            debug &&
                console.log(
                    'wtf bigger search',
                    readableNode,
                    matchInfo,
                    oldTree
                );
            if (
                matchInfo.status === SummaryStatus.SAME &&
                matchInfo.bestMatch
            ) {
                return {
                    name: matchInfo.bestMatch.id,
                    otherTreeInstance: matchInfo.subtree,
                };
            } else if (
                matchInfo.status === SummaryStatus.MODIFIED // may want to do something smarter with this
            ) {
                return {
                    name: matchInfo.modifiedNodes?.id || name,
                    otherTreeInstance: matchInfo.subtree,
                };
            } else {
                // console.log('NEWBIE!!!!!!!!!!!!!', name, oldTree, readableNode);
                return {
                    name: `${name}:${uuidv4()}`,
                    otherTreeInstance: oldTree,
                    new: true,
                };
            }
        }
    }
}

export default DocumentWatcher;
