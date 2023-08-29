import { Disposable } from 'vscode';
import { LegalDataType } from '../DataController';
import { DefaultLogFields, ListLogLine } from 'simple-git';
import { TS } from 'timelines-chart';
import { DocumentData } from 'firebase/firestore';
import { SerializedChangeBuffer } from '../../constants/types';

export interface GitType extends DefaultLogFields, ListLogLine {
    code: string;
    githubData: any[];
    linkedGithubData: any[];
}

interface TimelineData {
    timeRange: [TS, TS];
    val: string;
    code: string;
    labelVal?: string;
    x: number;
    y: number;
    commit: string;
    id: string;
    pullNumber?: number;
    source?: string;
    user?: string;
}

export enum DataSourceType {
    GIT = 'git',
    FIRESTORE = 'firestore',
    META_PAST_VERSION = 'meta-past-version',
}

function isLogResult(data: LegalDataType): data is GitType {
    return (data as DefaultLogFields & ListLogLine).hash !== undefined;
}

function isMetaPastVersion(data: any): data is SerializedChangeBuffer {
    return data?.typeOfChange !== undefined;
}

class TimelineEvent extends Disposable {
    _formattedData: TimelineData;
    _dataSourceType: DataSourceType;
    constructor(readonly originalData: LegalDataType) {
        super(() => this.dispose());
        this._dataSourceType = this.getDataSourceType();
        this._formattedData = this.formatData();
    }

    getDataSourceType() {
        if (isLogResult(this.originalData)) {
            return DataSourceType.GIT;
        }
        if (isMetaPastVersion(this.originalData)) {
            return DataSourceType.META_PAST_VERSION;
        }
        return DataSourceType.FIRESTORE; // will need more of these probably later
    }

    formatData(): TimelineData {
        switch (this._dataSourceType) {
            case DataSourceType.GIT: {
                const data = this.originalData as GitType;
                // console.log('data!', data);
                return {
                    x: new Date(data.date).getTime(),
                    y: data.code.split('\n').length,
                    timeRange: [
                        new Date(data.date).getTime(),
                        new Date(data.date).getTime() + 10000000,
                    ],
                    id: `${data.hash}-${data.author_email}-${data.date}`,
                    code: data.code,
                    user: data.author_email,
                    source: 'git',
                    val: DataSourceType.GIT,
                    labelVal: `${data.hash.slice(0, 6) || ''} ${
                        data.message
                    } by ${data.author_name} at ${data.date}`,
                    commit: data.hash,
                    pullNumber: data.githubData.length
                        ? data.githubData[0].number
                        : undefined,
                };
            }
            case DataSourceType.FIRESTORE: {
                const data = this.originalData as DocumentData;
                const endTimestamp = data.deletedTimestamp
                    ? data.deletedTimestamp
                    : data.editedTimestamp || data.createdTimestamp;
                return {
                    x: new Date(data.createdTimestamp).getTime(),
                    y: 1,
                    code: data.code,
                    user: data.uid,
                    id: `${data.id}`,
                    timeRange: [
                        new Date(data.createdTimestamp).getTime(),
                        new Date(endTimestamp).getTime(),
                    ],
                    val: DataSourceType.FIRESTORE,
                    labelVal: `${data.createdTimestamp} - ${endTimestamp}`,
                    commit: data.commit,
                };
            }
            case DataSourceType.META_PAST_VERSION: {
                const data = this.originalData as SerializedChangeBuffer;
                return {
                    x: data.time,
                    y: data.location.content.split('\n').length,
                    user: data.uid,
                    id: `${data.id}`,
                    timeRange: [data.time, data.time + 10000000],
                    val: DataSourceType.META_PAST_VERSION,
                    labelVal: `${data.time}`,
                    code: data.location.content, // maybe have change content as separate render
                    // @ts-ignore
                    commit: data.commit,
                };
            }
            default: {
                return {
                    timeRange: [0, 1],
                    val: 'val',
                    x: 0,
                    y: 0,
                    code: 'code',
                    commit: 'commit',
                    id: 'id',
                };
            }
        }
    }

    getTimeRange() {
        return [0, 1];
    }

    getVal() {
        return 'val';
    }
}

export default TimelineEvent;
