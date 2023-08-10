import * as admin from "firebase-admin";
import {
  NextApiRequest,
  STATUS_BAD_REQUEST,
  STATUS_INTERNAL_ERROR,
  STATUS_NOT_FOUND,
  STATUS_OK,
  STATUS_UNAUTHORIZED,
  SigningMethod,
  getFirebaseUserByWallet,
  initFirebaseIfNeeded,
  logLoginAttempt,
} from "./utils";
import { MEMO_PROGRAM_ID } from "@mrgnlabs/mrgn-common";
import { PublicKey, Transaction } from "@solana/web3.js";
import base58 from "bs58";
import { Infer, is, object, string } from "superstruct";
import nacl from "tweetnacl";

initFirebaseIfNeeded();

export interface LoginRequest {
  method: SigningMethod;
  signedAuthDataRaw: string;
}

const LoginPayload = object({
  uuid: string(),
});
export type LoginPayload = Infer<typeof LoginPayload>;

export default async function handler(req: NextApiRequest<LoginRequest>, res: any) {
  const { method, signedAuthDataRaw } = req.body;

  let signer;
  try {
    const loginData = validateAndUnpackLoginData(signedAuthDataRaw, method);
    signer = loginData.signer.toBase58();
  } catch (error: any) {
    let status;
    switch (error.message) {
      case "Invalid signup tx":
      case "Invalid signup payload":
        status = STATUS_BAD_REQUEST;
        break;
      case "Invalid signup payload":
        status = STATUS_UNAUTHORIZED;
        break;
      default:
        status = STATUS_INTERNAL_ERROR;
    }
    return res.status(status).json({ error: error.message });
  }

  let user;
  try {
    const userResult = await getFirebaseUserByWallet(signer);
    if (userResult === undefined) {
      await logLoginAttempt(signer, null, signedAuthDataRaw, false);
      return res.status(STATUS_NOT_FOUND).json({ error: "User not found" });
    }
    user = userResult;
  } catch (error: any) {
    return res.status(STATUS_INTERNAL_ERROR).json({ error: error.message }); // An unexpected error occurred
  }

  await logLoginAttempt(signer, user.uid, signedAuthDataRaw, true);

  // Generate a custom token for the client to log in
  const customToken = await admin.auth().createCustomToken(signer);

  return res.status(STATUS_OK).json({ status: "success", uid: signer, token: customToken });
}

// -------- Helpers

export function validateAndUnpackLoginData(
  signedAuthDataRaw: string,
  signingMethod: SigningMethod
): { signer: PublicKey } {
  let signerWallet: PublicKey;
  if (signingMethod === "tx") {
    const tx = Transaction.from(Buffer.from(signedAuthDataRaw, "base64"));
    const isValidSignature = tx.verifySignatures();
    if (!isValidSignature) {
      throw new Error("Invalid signature");
    }

    const memoIx = tx.instructions.find((x) => x.programId.equals(MEMO_PROGRAM_ID));
    const isValidSignupTx =
      !!tx.feePayer &&
      memoIx !== undefined &&
      memoIx.keys.length === 1 &&
      memoIx.keys[0].isSigner &&
      tx.signatures.length === 1 &&
      memoIx.keys[0].pubkey.equals(tx.feePayer);

    if (!isValidSignupTx) throw new Error("Invalid signup tx");

    const authData = JSON.parse(memoIx.data.toString("utf8"));
    signerWallet = tx.feePayer!;

    if (!is(authData, LoginPayload)) {
      throw new Error("Invalid signup payload");
    }
  } else {
    const { data, signature, signer } = JSON.parse(signedAuthDataRaw);
    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(JSON.stringify(data)),
      base58.decode(signature),
      base58.decode(signer)
    );
    if (!verified) {
      throw new Error("Invalid signature");
    }

    signerWallet = new PublicKey(signer);
  }

  return { signer: signerWallet };
}
