import { HttpsCallableResult } from '@firebase/functions-types';
import { httpsCallable } from 'firebase/functions';
import FirestoreController from '../FirestoreController';

export const getUserGithubData = async (
    firestoreController: FirestoreController,
    githubData: {
        [key: string]: any;
    }
): Promise<HttpsCallableResult> => {
    if (!firestoreController.functions) {
        throw new Error('FirestoreController: functions not initialized');
    }
    console.log('githubData', githubData);
    return await httpsCallable(
        firestoreController.functions,
        'getUserGithubData'
    )(githubData);
};
