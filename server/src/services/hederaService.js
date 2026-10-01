import {
    AccountId,
    Client,
    PrivateKey,
    TokenAssociateTransaction,
    TokenId,
    TokenMintTransaction,
    TransferTransaction
} from "@hashgraph/sdk";

// Initialize client from environment
const getClient = () => {
    if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_OPERATOR_KEY) {
        throw new Error("Hedera credentials not found in environment (HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY)");
    }
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID);
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);

    // Default to testnet
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);
    return { client, operatorId, operatorKey };
};

export const awardOnChainPoints = async (userAccountIdStr, amount) => {
    const tokenIdStr = process.env.HEDERA_POINTS_TOKEN_ID;

    if (!tokenIdStr) {
        console.warn("HEDERA_POINTS_TOKEN_ID not set. Skipping on-chain reward.");
        return null;
    }

    try {
        const { client, operatorId, operatorKey } = getClient();
        const userAccountId = AccountId.fromString(userAccountIdStr);
        const tokenId = TokenId.fromString(tokenIdStr);

        console.log(`[Hedera] Minting ${amount} tokens for ${userAccountIdStr}...`);

        // 1. Mint tokens to Treasury (Operator)
        // In a real generic fungible token, you might mint to treasury first or just transfer if treasury has supply.
        // The snippet assumes infinite supply and minting on demand.
        const mintTx = await new TokenMintTransaction()
            .setTokenId(tokenId)
            .setAmount(amount)
            .freezeWith(client)
            .sign(operatorKey);

        const mintSubmit = await mintTx.execute(client);
        await mintSubmit.getReceipt(client);

        console.log(`[Hedera] Minted. Transferring to user...`);

        // 2. Transfer from Treasury to User
        const transferTx = await new TransferTransaction()
            .addTokenTransfer(tokenId, operatorId, -amount)
            .addTokenTransfer(tokenId, userAccountId, amount)
            .freezeWith(client)
            .sign(operatorKey);

        const transferSubmit = await transferTx.execute(client);
        const receipt = await transferSubmit.getReceipt(client);

        console.log(`[Hedera] Success! Transaction status: ${receipt.status.toString()}`);
        return receipt.status.toString();
    } catch (error) {
        console.error("[Hedera] Error awarding points:", error);
        // Don't crash the request if blockchain fails, just log it
        return null;
    }
};

export const associateUserWithToken = async (userAccountIdStr, userPrivateKeyStr) => {
    const tokenIdStr = process.env.HEDERA_POINTS_TOKEN_ID;
    if (!tokenIdStr) return;

    try {
        const { client } = getClient();
        const userAccountId = AccountId.fromString(userAccountIdStr);
        const userPrivateKey = PrivateKey.fromString(userPrivateKeyStr);
        const tokenId = TokenId.fromString(tokenIdStr);

        console.log(`[Hedera] Associating user ${userAccountIdStr} with token ${tokenIdStr}...`);

        const associateTx = await new TokenAssociateTransaction()
            .setAccountId(userAccountId)
            .setTokenIds([tokenId])
            .freezeWith(client)
            .sign(userPrivateKey);

        const submit = await associateTx.execute(client);
        await submit.getReceipt(client);
        console.log(`[Hedera] Association successful`);
        return true;
    } catch (error) {
        console.error("[Hedera] Association error:", error);
        return false;
    }
};
