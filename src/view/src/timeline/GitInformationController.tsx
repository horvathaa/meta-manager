import TimelineEvent, { GitType } from '../../../data/timeline/TimelineEvent';
import TimelineController from './TimelineController';
import styles from '../styles/timeline.module.css';
import * as React from 'react';

class GitInformationController {
    constructor(private readonly timelineController: TimelineController) {}
    render(g: TimelineEvent) {
        const { originalData } = g;
        const data = originalData as GitType;
        return (
            <div className={styles['git-information']}>
                <div>
                    {data.author_email} {new Date(data.date).toString()}
                </div>
                <div>{data.message}</div>
            </div>
        );
    }
}

export default GitInformationController;
