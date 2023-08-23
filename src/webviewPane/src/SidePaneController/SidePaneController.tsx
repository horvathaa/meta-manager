import { createRoot } from 'react-dom/client';
import {
    AdditionalMetadata,
    CopyBuffer,
    WEB_INFO_SOURCE,
} from '../../../view/src/types/types';
import ChatGptHistory from '../ChatGptHistory/ChatGptHistory';
import * as React from 'react';

interface InitData {
    type: WEB_INFO_SOURCE;
    node: any;
    copyBuffer: CopyBuffer;
}

class SidePaneController {
    private readonly _ref;
    // _graphController: GraphController;
    // _gitInformationController: GitInformationController;
    // _metaInformationController: MetaInformationController;
    // _node: Payload | undefined;
    constructor(initData?: InitData) {
        console.log('constructing');
        const container =
            document.getElementById('root') || document.createElement('div');
        console.log('container', container);
        this._ref = createRoot(container);
        console.log('ref', this._ref, initData);
        // this._graphController = new GraphController(this);
        // this._gitInformationController = new GitInformationController(this);
        // this._metaInformationController = new MetaInformationController(this);
        // console.log('graph', this._graphController);
        this.initListeners();
        if (initData) {
            this._ref.render(
                <ChatGptHistory copyBufferProps={initData.copyBuffer} />
            );
        }
        // this.constructGraph();
    }

    initListeners() {
        console.log('hewwo!!!!!!!!!!!!!!');
        window.addEventListener('message', (e) =>
            this.handleIncomingMessage(e, this)
        );
        return () =>
            window.removeEventListener('message', (e) =>
                this.handleIncomingMessage(e, this)
            );
    }

    // updateTimeline(title: string, data: any[]) {
    //     this._graphController.constructGraph(data);
    //     this.renderMetadata();
    // }

    // renderFirstInstance() {
    //     if (this._node) {
    //         const { firstInstance } = this._node;
    //         switch (firstInstance._dataSourceType) {
    //             case 'git': {
    //                 return this._gitInformationController.render(firstInstance);
    //             }
    //             case 'meta-past-version': {
    //                 return this._metaInformationController.render(
    //                     firstInstance
    //                 );
    //             }
    //             default: {
    //                 return null;
    //             }
    //         }
    //     }
    //     return null;
    // }

    // openView(additionalMetadata: AdditionalMetadata, type: WEB_INFO_SOURCE) {
    //     VS_CODE_API.postMessage({
    //         command: 'openView',
    //         data: {
    //             additionalMetadata,
    //             type,
    //             node: this._node,
    //         },
    //     });
    // }

    // renderVersion(k: TimelineEvent) {
    //     return <CodeBlock codeString={k._formattedData.code || ''} />;
    // }

    // renderNode() {
    //     console.log('this.node', this._node);
    //     if (this._node) {
    //         const { node } = this._node;
    //         const { content } = node.location;
    //         return (
    //             <div className={styles['m2']}>
    //                 <div>
    //                     <h2>Where did this code come from?</h2>
    //                     {this.renderFirstInstance()}
    //                 </div>
    //                 <div>
    //                     <h3>What did it used to look like?</h3>
    //                     <CodeBlock
    //                         codeString={
    //                             this._node.firstInstance._formattedData.code ||
    //                             ''
    //                         }
    //                     />
    //                 </div>
    //             </div>
    //         );
    //     }
    //     return null;
    // }

    // renderMetadata(k?: TimelineEvent) {
    //     console.log('k', k);
    //     this._ref.render(
    //         <div>
    //             <h1>{this._node?.node.id.split(':')[0]}</h1>
    //             {k ? this.renderVersion(k) : this.renderNode()}
    //         </div>
    //     );
    // }

    handleIncomingMessage(e: MessageEvent<any>, context: SidePaneController) {
        const message = e.data; // The JSON data our extension sent
        console.log('hewwo?????', message);
        switch (message.command) {
            case 'updateTimeline': {
                const { data } = message;
                const { id, metadata } = data;
                console.log('stuff', data, id, metadata);
                // this._node = metadata as Payload;
                // context.updateTimeline(id, metadata);
                break;
            }
            default: {
                console.log('default');
            }
        }
    }
}
// new TimelineController();
export default SidePaneController;
