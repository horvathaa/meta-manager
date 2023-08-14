import * as ts from 'typescript';
import LocationPlus, {
    ChangeEvent,
    TypeOfChange,
} from '../document/locationApi/location';
import { TextDocument } from 'vscode';
import { nodeToRange } from '../document/lib';
import {
    AbstractTreeReadableNode,
    CompareSummary,
    SummaryStatus,
} from './tree';
import {
    intersectionBetweenStrings,
    stripNonAlphanumeric,
} from './helpers/lib';
import { Container } from '../container';
import { DataController } from '../data/DataController';
import { debounce } from '../utils/lib';
import { SerializedReadableNode } from '../constants/types';

export enum NodeState {
    UNCHANGED = 'UNCHANGED',
    MODIFIED_RANGE = 'MODIFIED_RANGE',
    MODIFIED_CONTENT = 'MODIFIED_CONTENT',
    MODIFIED_RANGE_AND_CONTENT = 'MODIFIED_RANGE_AND_CONTENT',
    DELETED = 'DELETED',
    ADDED = 'ADDED',
}

const LANGUAGE_ID_MAP: { [key: string]: any } = {
    ts: 'typescript',
    js: 'javascript',
    tsx: 'typescriptreact',
    jsx: 'javascriptreact',
};

class ReadableNode extends AbstractTreeReadableNode<ReadableNode> {
    readonly node: ts.Node | undefined;
    readonly humanReadableKind: string;
    readonly _container: Container | undefined;
    _dataController: DataController | undefined;
    location: LocationPlus;
    id: string;
    languageId: string;
    visited?: boolean;
    state?: NodeState;
    constructor(
        // private readonly container: Container,
        humanReadableKind: string,
        location: LocationPlus,
        container?: Container,
        node?: ts.Node,
        id?: string,
        firestore?: any
    ) {
        super();
        this.node = node;
        this.humanReadableKind = humanReadableKind;
        const fileExtension = location.uri.fsPath.split('.').pop();
        this.languageId =
            fileExtension && LANGUAGE_ID_MAP[fileExtension]
                ? LANGUAGE_ID_MAP[fileExtension]
                : 'typescript';
        this.location = location;
        this.id = id || '';
        this.visited = false;
    }

    static create(
        node: ts.Node,
        docOrLocation: TextDocument | LocationPlus,
        container?: Container,
        id?: string
    ) {
        const location =
            docOrLocation instanceof LocationPlus
                ? docOrLocation
                : new LocationPlus(
                      docOrLocation.uri,
                      nodeToRange(node, docOrLocation.getText()),
                      { doc: docOrLocation, id }
                  );
        return new ReadableNode(
            ts.SyntaxKind[node.parent.kind],
            location,
            container,
            node,
            id
        );
    }

    setId(id: string) {
        this.id = id;
    }

    get dataController() {
        return this._dataController;
    }

    set dataController(dataController: DataController | undefined) {
        this._dataController = dataController;
    }

    copy() {
        return new ReadableNode(
            this.humanReadableKind,
            this.location,
            this._container,
            this.node,
            this.id
        );
    }

    serialize() {
        return {
            humanReadableKind: this.humanReadableKind,
            location: this.location.serialize(),
            id: this.id,
        };
    }

    deserialize(serialized: SerializedReadableNode) {
        const location = LocationPlus.deserialize(serialized.location);
        return new ReadableNode(
            // serialized.node,
            serialized.humanReadableKind,
            location,
            undefined, // double uggo
            undefined, // ugly
            serialized.id
        );
    }

    getNodeState(typeOfChange: TypeOfChange) {
        switch (typeOfChange) {
            case TypeOfChange.CONTENT_ONLY:
                return NodeState.MODIFIED_CONTENT;
            case TypeOfChange.RANGE_ONLY:
                return NodeState.MODIFIED_RANGE;
            case TypeOfChange.RANGE_AND_CONTENT:
                return NodeState.MODIFIED_RANGE_AND_CONTENT;
            default:
                return NodeState.UNCHANGED;
        }
    }

    registerListeners() {
        const deleteDisposable = this.location.onDelete.event(
            (location: LocationPlus) => {
                this.state = NodeState.DELETED; // should let tree know to remove this node
                // mark as event for code
                changedDisposable.dispose();
                selectedDisposable.dispose();
            }
        );
        const changedDisposable = this.location.onChanged.event(
            (changeEvent: ChangeEvent) => {
                this.state = this.getNodeState(changeEvent.typeOfChange);
                // debounce(() => {
                //     const newContent = this.location.content;
                //     const numConsoleLogs = newContent.split('console.');
                // });
            }
        );
        const selectedDisposable = this.location.onSelected.event(
            async (location: LocationPlus) => {
                // placeholder
            }
        );

        return () => {
            deleteDisposable.dispose();
            changedDisposable.dispose();
            selectedDisposable.dispose();
        };
    }

    compare(node: ReadableNode): CompareSummary<ReadableNode> {
        // if (this.visited) {
        //     return {
        //         status: SummaryStatus.UNKNOWN,
        //     };
        // }
        const res = {
            distanceDelta: this.location.compare(node.location),
            // bagOfWordsScore: this.getBagOfWordsScore(node),
            // bagOfWordsScore: calculateSimilarityProportion(
            bagOfWordsScore: calculateBagOfWordsScore(
                this.location.content,
                node.location.content
            ),
            isSameType: this.humanReadableKind === node.humanReadableKind,
            isSameName: this.location.id === node.location.id,
        };

        if (this.id === 'handleAddAnchor' || node.id === 'handleAddAnchor') {
            console.log('what is HAPPENING', this, 'NODE', {
                status: SummaryStatus.SAME,
                bestMatch: this,
                additionalData: res,
                node,
            });
        }
        // paper said .9 or above pretty much meant it is the same
        // if (res.bagOfWordsScore >= 0.9 && res.isSameType && res.isSameName) {
        if (res.bagOfWordsScore >= 0.9) {
            this.visited = true;
            return {
                status: SummaryStatus.SAME,
                bestMatch: this,
                additionalData: res,
            };
        } else if (res.bagOfWordsScore >= 0.5 && res.isSameType) {
            this.visited = true; // ?
            return {
                status: SummaryStatus.MODIFIED,
                modifiedNodes: this,
                additionalData: res,
            };
        } else {
            return {
                status: SummaryStatus.UNKNOWN,
                additionalData: res,
            };
        }
    }

    // similar approach to this paper
    // https://dl.acm.org/doi/abs/10.1145/2858036.2858442?casa_token=m_c4cxv1br8AAAAA:JSXZo8OMn9CV3YaYBawsRvZhZFhOsLJurX5qXfckEL_cO1dgBMS1hhbudI9P7JpM0F015wEzrJMf
    private getBagOfWordsScore(node: ReadableNode) {
        const contentWords = stripNonAlphanumeric(this.location.content);
        const thisWordLengthProportion =
            contentWords.length > 0 ? 1 / contentWords.length : 0;

        const otherContentWords = stripNonAlphanumeric(node.location.content);
        const otherWordLengthProportion =
            otherContentWords.length > 0 ? 1 / otherContentWords.length : 0;
        return (
            0.5 *
            intersectionBetweenStrings(contentWords, otherContentWords) *
            (thisWordLengthProportion + otherWordLengthProportion)
        );
    }
}

function calculateBagOfWordsScore(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const uniqueWords = [...new Set([...words1, ...words2])];
    const commonWordsCount = words1.filter((word) =>
        words2.includes(word)
    ).length;

    const score = commonWordsCount / uniqueWords.length;
    return score;
}

function calculateSimilarityProportion(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const combinedWords = [...new Set([...words1, ...words2])]; // Unique words from both strings

    const wordFrequency1: { [word: string]: number } = {};
    const wordFrequency2: { [word: string]: number } = {};

    // Count word frequencies in the first string
    for (const word of words1) {
        if (wordFrequency1[word]) {
            wordFrequency1[word]++;
        } else {
            wordFrequency1[word] = 1;
        }
    }

    // Count word frequencies in the second string
    for (const word of words2) {
        if (wordFrequency2[word]) {
            wordFrequency2[word]++;
        } else {
            wordFrequency2[word] = 1;
        }
    }

    // Calculate the proportion of similarity
    let commonWordsCount = 0;
    for (const word of combinedWords) {
        const frequency1 = wordFrequency1[word] || 0;
        const frequency2 = wordFrequency2[word] || 0;
        commonWordsCount += Math.min(frequency1, frequency2);
    }

    const totalWords = combinedWords.length;
    const similarityProportion = commonWordsCount / totalWords;

    return similarityProportion;
}

export default ReadableNode;
