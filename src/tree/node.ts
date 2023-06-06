import * as ts from 'typescript';
import LocationPlus from '../document/locationApi/location';
import { TextDocument } from 'vscode';
import { nodeToRange } from '../document/lib';

class ReadableNode {
    readonly node: ts.Node;
    readonly humanReadableKind: string;
    location: LocationPlus;
    id: string;
    constructor(
        node: ts.Node,
        humanReadableKind: string,
        location: LocationPlus,
        id?: string
    ) {
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
        return new ReadableNode(node, ts.SyntaxKind[node.kind], location, id);
    }

    setId(id: string) {
        this.id = id;
    }

    copy() {
        return new ReadableNode(
            this.node,
            this.humanReadableKind,
            this.location,
            this.id
        );
    }
}

export default ReadableNode;
