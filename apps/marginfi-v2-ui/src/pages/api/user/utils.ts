import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { IncomingMessage } from "http";
import { PreviewData } from "next";
import { v4 as uuidv4 } from "uuid";

export const logSignupAttempt = async (
  publicKey: string,
  uuid: string | null,
  signature: string,
  successful: boolean
) => {
  try {
    const db = admin.firestore();
    const loginsCollection = db.collection("logins");
    await loginsCollection.add({
      publicKey,
      uuid,
      signature,
      successful,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error logging sign-up attempt:", error);
  }
};

export const logLoginAttempt = async (
  publicKey: string,
  uuid: string | null,
  signature: string,
  successful: boolean
) => {
  try {
    const db = admin.firestore();
    const loginsCollection = db.collection("logins");
    await loginsCollection.add({
      publicKey,
      uuid,
      signature,
      successful,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error logging log-in attempt:", error);
  }
};

export function initFirebaseIfNeeded() {
  // Check if the app is already initialized to avoid initializing multiple times
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }
}

export async function getFirebaseUserByWallet(walletAddress: string): Promise<UserRecord | undefined> {
  try {
    const user = await admin.auth().getUser(walletAddress);
    return user;
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      return undefined;
    }
    throw error;
  }
}

export async function createFirebaseUser(walletAddress: string, referralCode?: string) {
  const db = admin.firestore();
  let referredBy = null;

  // Validate referrer code if one exists
  let referrerQuery;
  const referralCodeLower = referralCode?.toLowerCase();
  if (referralCodeLower) {
    // Do the standard search
    referrerQuery = await db.collection("users").where("referralCode", "==", referralCodeLower).limit(1).get();
    if (!referrerQuery.empty) {
      console.log("found standard referral code");
      const referrerDoc = referrerQuery.docs[0];
      referredBy = referrerDoc.id;
    } else {
      referrerQuery = await db
        .collection("users")
        .where("referralCode", "array-contains", referralCodeLower)
        .limit(1)
        .get();
      if (!referrerQuery.empty) {
        console.log("found multiple referral codes for user");
        const referrerDoc = referrerQuery.docs[0];
        referredBy = referrerDoc.id;
      }
    }
  }

  // Create new user in Firebase Auth
  await admin.auth().createUser({
    uid: walletAddress,
  });

  // Create new user in Firestore
  await db.collection("users").doc(walletAddress).set({
    referredBy,
    referralCode: uuidv4(),
  });
}

export type SigningMethod = "memo" | "tx";

// ------- Next helpers

export declare type Env = {
  [key: string]: string | undefined;
};

export interface NextApiRequest<T> extends IncomingMessage {
  /**
   * Object of `query` values from url
   */
  query: Partial<{
    [key: string]: string | string[];
  }>;
  /**
   * Object of `cookies` from header
   */
  cookies: Partial<{
    [key: string]: string;
  }>;
  body: T;
  env: Env;
  preview?: boolean;
  /**
   * Preview data set on the request, if any
   * */
  previewData?: PreviewData;
}

export const STATUS_OK = 200;
export const STATUS_BAD_REQUEST = 400;
export const STATUS_UNAUTHORIZED = 401;
export const STATUS_NOT_FOUND = 404;
export const STATUS_INTERNAL_ERROR = 500;
