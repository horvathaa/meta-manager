import styles from '../styles/timeline.module.css';
import GraphController from './GraphController';
import * as React from 'react';
import {
    VSCodeButton,
    VSCodeCheckbox,
    VSCodeRadio,
    VSCodeRadioGroup,
    VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';

const Search: React.FC<{ context: GraphController }> = ({ context }) => {
    // const [searchOpts, setSearchOpts] = React.useState<SearchOpts>({
    //     searchOnlyInPastedCode: false,
    //     searchAcrossAllTime: false,
    //     searchTimeSpan: null,
    //     searchScope: {
    //         onThisNode: true,
    //         onThisFile: false,
    //         onThisProject: false,
    //     },
    // });
    const [searchTerm, setSearchTerm] = React.useState('');
    const [showOpts, setShowOpts] = React.useState(false);
    return (
        <div className={styles['flex-col']}>
            <div className={styles['center']}>
                <VSCodeTextField
                    // className={styles['m2']}
                    placeholder="Search"
                    onChange={(e: any) => {
                        if (e.target.value.length === 0) {
                            context.search('');
                        }
                        setSearchTerm(e.target.value);
                    }}
                    style={{ marginRight: '10px' }}
                />
                <VSCodeButton
                    className={styles['m2']}
                    onClick={() => {
                        // context._queue.push(undefined);
                        context.search(searchTerm);
                    }}
                    style={{ marginRight: '10px' }}
                >
                    Search
                </VSCodeButton>
                {/* <VSCodeButton
                    appearance="secondary"
                    onClick={(e: any) => setShowOpts(!showOpts)}
                >
                    Options
                </VSCodeButton> */}
            </div>
        </div>
    );
};

export default Search;
