import * as React from 'react';
// import {
//     ThreadPair,
//     CopyBuffer,
//     ChatGptCopyBuffer,
//     WEB_INFO_SOURCE,
// } from '../../../constants/types';
// import styles from '../styles/chatGptStyle.module.css';
import CodeBlock from '../components/CodeBlock';
// import { DataController as VSCDataController } from '../../../data/DataController';
// import { SerializedDataController } from '../../../constants/types';
import {
    CopyBuffer,
    SerializedDataController,
    SerializedNodeDataController,
    WEB_INFO_SOURCE,
} from '../types/types';

interface CodeBlockPartition {
    code: string;
    language: string;
    source: WEB_INFO_SOURCE;
}

function getStyleFromSource(source: WEB_INFO_SOURCE) {
    switch (source) {
        case WEB_INFO_SOURCE.CHAT_GPT:
            // return styles.chatGpt;
            return { backgroundColor: '#519aba80' };
        case WEB_INFO_SOURCE.STACKOVERFLOW:
            // return styles.stackOverflow;
            return { backgroundColor: '#f4802463' };
        case WEB_INFO_SOURCE.VSCODE:
            // return styles.vsCode;
            return { backgroundColor: 'none' };
        case WEB_INFO_SOURCE.GITHUB:
            // return styles.github;
            return { backgroundColor: '#2f97ff63' };
        default:
            // return styles.vsCode;
            return { backgroundColor: 'none' };
    }
}

export function DataController() {
    const [dataController, setDataController] =
        React.useState<SerializedNodeDataController>();
    const [codeBlocks, _setCodeBlocks] = React.useState<CodeBlockPartition[]>(
        []
    );
    console.log('RENDERING');
    const [name, setName] = React.useState<string>('');
    const codeBlocksRef = React.useRef<CodeBlockPartition[]>([]);
    const setCodeBlocks = (codeBlocks: CodeBlockPartition[]) => {
        codeBlocksRef.current = codeBlocks;
        _setCodeBlocks(codeBlocks);
    };
    React.useEffect(() => {
        window.addEventListener('message', (e: MessageEvent<any>) => {
            const { command } = e.data;
            console.log('message', e.data);
            if (command === 'updateWebData') {
                const { data } = e.data;
                setDataController(data);
                partition(data);
            }
            if (command === 'updateTimeline') {
                const { data } = e.data;
                setDataController(data.data);
                // partition(data);
            }
        });
    });

    React.useEffect(() => {
        if (!dataController) {
            return;
        }
        const { node } = dataController;
        if (!node) {
            return;
        }
        const { id } = node;
        id.includes(':') ? setName(id.split(':')[0]) : setName(id);
    }, [dataController]);

    function getSource(metadata: CopyBuffer) {
        switch (metadata.type) {
            case 'CHAT_GPT':
                return WEB_INFO_SOURCE.CHAT_GPT;
            case 'STACKOVERFLOW':
                return WEB_INFO_SOURCE.STACKOVERFLOW;
            case 'VSCODE':
                return WEB_INFO_SOURCE.VSCODE;
            case 'GITHUB':
                return WEB_INFO_SOURCE.GITHUB;
            default:
                return WEB_INFO_SOURCE.VSCODE;
        }
    }

    function partition(dataController: SerializedDataController) {
        if (!dataController?.webMetadata?.length) {
            return [
                {
                    code: dataController?.node.location.content,
                    language: dataController?.node.location.fsPath
                        .split('.')
                        .pop(),
                    source: WEB_INFO_SOURCE.VSCODE,
                },
            ];
        }
        const codeBlocks: CodeBlockPartition[] =
            dataController.webMetadata.flatMap((data) => {
                console.log('data', data, 'node', dataController.node);
                const temp = dataController.node.location.content
                    .replace('\r', '')
                    .split(data.code);
                console.log('temp', temp);
                return [
                    {
                        code: temp[0],
                        language:
                            dataController.node.location.fsPath
                                .split('.')
                                .pop() || 'js',
                        source: WEB_INFO_SOURCE.VSCODE,
                    },
                    {
                        code: data.code,
                        language:
                            dataController.node.location.fsPath
                                .split('.')
                                .pop() || 'js',
                        source: getSource(data),
                    },
                ];
            });
        console.log('codeBlocks', codeBlocks);
        setCodeBlocks(codeBlocks);
    }
    console.log('dataController', dataController);
    return dataController ? (
        <div>
            <h2>{name}</h2>
            <CodeBlock
                key={dataController?.node.id}
                codeString={dataController.node.location.content}
                style={getStyleFromSource(WEB_INFO_SOURCE.VSCODE)}
            />
            {/* {dataController.pastVersions?.map((v) => {
                return (
                    <CodeBlock
                        key={v.id}
                        codeString={v.changeContent}
                        style={getStyleFromSource(WEB_INFO_SOURCE.VSCODE)}
                    />
                );
            })} */}
        </div>
    ) : (
        <div>Waiting for data</div>
    );
    // codeBlocksRef.current.length ? (
    //     <div>
    //         {codeBlocksRef.current.map((codeBlock, index) => (
    //             <CodeBlock
    //                 key={index}
    //                 codeString={codeBlock.code}
    //                 style={getStyleFromSource(codeBlock.source)}
    //             />
    //         ))}
    //     </div>
    // ) : (
    //     <div>Paste some code from online for it to be tracked</div>
    // );
}

export default DataController;
