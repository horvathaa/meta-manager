import * as ts from 'typescript';
import LocationPlus, {
    SerializedLocationPlus,
} from '../document/locationApi/location';
import { TextDocument } from 'vscode';
import { nodeToRange } from '../document/lib';
import { AbstractTreeReadableNode } from './tree';

interface SerializedReadableNode {
    humanReadableKind: string;
    location: SerializedLocationPlus;
    id: string;
    // parentId: string; // tree handles this
}

class ReadableNode extends AbstractTreeReadableNode<ReadableNode> {
    readonly node: ts.Node | undefined;
    readonly humanReadableKind: string;
    location: LocationPlus;
    id: string;
    constructor(
        humanReadableKind: string,
        location: LocationPlus,
        node?: ts.Node,
        id?: string
    ) {
        super();
        this.node = node;
        this.humanReadableKind = humanReadableKind;
        this.location = location;
        this.id = id || '';
    }

    static create(
        node: ts.Node,
        docOrLocation: TextDocument | LocationPlus,
        id?: string
    ) {
        const location =
            docOrLocation instanceof LocationPlus
                ? docOrLocation
                : new LocationPlus(
                      docOrLocation.uri,
                      nodeToRange(node, docOrLocation.getText())
                  );
        return new ReadableNode(ts.SyntaxKind[node.kind], location, node, id);
    }

    setId(id: string) {
        this.id = id;
    }

    copy() {
        return new ReadableNode(
            this.humanReadableKind,
            this.location,
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
            undefined, // ugly
            serialized.id
        );
    }
}

export default ReadableNode;
