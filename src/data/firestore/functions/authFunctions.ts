import {
    GithubAuthProvider,
    User,
    signInWithCredential,
    signInWithEmailAndPassword as firestoreSignInWithEmailAndPassword,
} from 'firebase/auth';
import FirestoreController from '../FirestoreController';

export const signInWithGithubCredential = async (
    firestoreController: FirestoreController,
    oauth: string
): Promise<User | undefined> => {
    const credential = GithubAuthProvider.credential(oauth);
    try {
        if (!firestoreController.auth) {
            throw new Error('FirestoreController: auth not initialized');
        }
        // console.log('credential', credential);
        const { user } = await signInWithCredential(
            firestoreController.auth,
            credential
        );
        return user;
    } catch (e) {
        console.error(
            'FirestoreController: could not sign in user with github credential',
            e
        );
        return await firestoreController.initAuthWithEmailAndPassword();
        // return undefined;
    }
};

export const signInWithEmailAndPassword = async (
    firestoreController: FirestoreController,
    email: string,
    password: string
): Promise<User | undefined> => {
    try {
        if (!firestoreController.auth) {
            throw new Error('FirestoreController: auth not initialized');
        }
        const { user } = await firestoreSignInWithEmailAndPassword(
            firestoreController.auth,
            email,
            password
        );
        return user;
    } catch (e) {
        throw new Error('FirestoreController: could not sign in user' + e);
    }
};
